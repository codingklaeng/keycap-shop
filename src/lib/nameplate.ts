"use client";

import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { contours } from "d3-contour";

export type RingPos = "left" | "top" | "right" | "none";
export type EdgeStyle = "sharp" | "round" | "contour";
export type FontStyle = "normal" | "italic";

export type NameplateSpec = {
  text: string;
  font: string; // CSS font-family
  weight: number; // 300..700
  style?: FontStyle; // normal | italic
  size: number; // text height (mm)
  thickness: number; // text depth (mm)
  letterSpacing: number; // extra spacing (px in the render canvas)
  ring: RingPos;
  baseThickness: number; // backing plate depth (mm)
  color: string; // text color (preview)
  baseColor?: string; // base plate + ring color (preview)
  edge: EdgeStyle; // sharp | round (rectangular base) | contour (hugs the text)
  // optional middle stroke layer (outline around the text)
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number; // how far the outline extends outward (mm)
  strokeHeight?: number; // outline layer depth (mm)
};

export const NAMEPLATE_FONTS = [
  "Sarabun",
  "Mitr",
  "Prompt",
  "Charm",
  "Kanit",
  "Noto Sans Thai",
  "Sriracha",
  "Kodchasan",
  "K2D",
  "Itim",
  "KoHo",
];

function fontString(spec: NameplateSpec, fontPx: number): string {
  const style = spec.style === "italic" ? "italic " : "";
  return `${style}${spec.weight} ${fontPx}px "${spec.font}", "Noto Sans Thai", sans-serif`;
}

async function ensureFont(spec: NameplateSpec) {
  try {
    await document.fonts.load(fontString(spec, 140), spec.text);
    await document.fonts.ready;
  } catch {}
}

type TextMetricsInfo = { ascent: number; descent: number; textW: number };

function measureTextPx(spec: NameplateSpec, fontPx: number): TextMetricsInfo {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = fontString(spec, fontPx);
  ctx.letterSpacing = `${spec.letterSpacing}px`;
  const m = ctx.measureText(spec.text || " ");
  return {
    ascent: m.actualBoundingBoxAscent || fontPx * 0.8,
    descent: m.actualBoundingBoxDescent || fontPx * 0.25,
    textW: m.width,
  };
}

// contour-trace a B/W canvas into polygons with holes (marching squares)
function traceCanvas(ctx: CanvasRenderingContext2D, W: number, H: number): THREE.Shape[] {
  const px = ctx.getImageData(0, 0, W, H).data;
  const values = new Array<number>(W * H);
  for (let i = 0; i < W * H; i++) values[i] = 255 - px[i * 4]; // dark = high
  const result = contours().size([W, H]).smooth(true).thresholds([128])(values);
  const multi = (result[0]?.coordinates ?? []) as number[][][][];
  const shapes: THREE.Shape[] = [];
  for (const poly of multi) {
    if (!poly.length || poly[0].length < 3) continue;
    const shape = new THREE.Shape();
    poly[0].forEach((p, i) => (i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])));
    for (let hi = 1; hi < poly.length; hi++) {
      const hole = new THREE.Path();
      poly[hi].forEach((p, i) => (i ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1])));
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }
  return shapes;
}

// Render the text (optionally with an outward stroke of `expandPx`) on a fixed
// canvas/origin so every layer shares the same coordinate frame, then trace it.
function traceLayer(
  spec: NameplateSpec,
  fontPx: number,
  W: number,
  H: number,
  originX: number,
  originY: number,
  expandPx: number
): THREE.Shape[] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.ceil(W));
  canvas.height = Math.max(8, Math.ceil(H));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontString(spec, fontPx);
  ctx.letterSpacing = `${spec.letterSpacing}px`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (expandPx > 0) {
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = expandPx * 2;
    ctx.strokeText(spec.text, originX, originY);
  }
  ctx.fillStyle = "#000000";
  ctx.fillText(spec.text, originX, originY);
  return traceCanvas(ctx, canvas.width, canvas.height);
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const rr = Math.min(r, w / 2, h / 2);
  s.moveTo(-w / 2 + rr, -h / 2);
  s.lineTo(w / 2 - rr, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  s.lineTo(w / 2, h / 2 - rr);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
  s.lineTo(-w / 2 + rr, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
  s.lineTo(-w / 2, -h / 2 + rr);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  return s;
}

export type NameplateResult = {
  group: THREE.Group;
  sizeMM: { w: number; h: number; d: number };
};

// extrude traced shapes (px) into a mm geometry, upright (y-up, not mirrored)
function extrudeLayer(
  shapes: THREE.Shape[],
  thickness: number,
  k: number,
  bevelMM: number
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shapes, {
    depth: thickness / k,
    bevelEnabled: bevelMM > 0,
    bevelThickness: bevelMM / k,
    bevelSize: bevelMM / k,
    bevelSegments: 2,
    curveSegments: 6,
    steps: 1,
  });
  geo.scale(k, -k, k);
  return geo;
}

/** Build the full nameplate (base + optional stroke + text + ring) in mm. */
export async function buildNameplate(spec: NameplateSpec): Promise<NameplateResult> {
  await ensureFont(spec);
  const fontPx = 140;
  const mi = measureTextPx(spec, fontPx);
  const textHpx = mi.ascent + mi.descent;
  const k = spec.size / Math.max(1, textHpx); // mm per px (from metrics)

  const bevelMM = spec.edge === "round" ? 0.6 : 0;
  const padMM = Math.max(3, spec.size * 0.35);
  const baseT = spec.baseThickness;
  const hasStroke = !!spec.stroke && (spec.strokeWidth ?? 0) > 0;
  const strokeWmm = hasStroke ? (spec.strokeWidth as number) : 0;
  const strokeHmm = hasStroke ? spec.strokeHeight ?? 2 : 0;

  // px expansions for stroke layer + (contour) base outline
  const strokeExpandPx = hasStroke ? strokeWmm / k : 0;
  const contourExpandMM = Math.max(padMM, strokeWmm + 1.5);
  const baseExpandPx = spec.edge === "contour" ? contourExpandMM / k : 0;
  const maxExpandPx = Math.max(strokeExpandPx, baseExpandPx);

  // shared canvas frame so all traced layers align
  const padPx = Math.ceil(maxExpandPx) + 8;
  const W = mi.textW + padPx * 2;
  const H = textHpx + padPx * 2;
  const originX = padPx;
  const originY = padPx + mi.ascent;

  const group = new THREE.Group();
  const textMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const baseMat = new THREE.MeshStandardMaterial({ color: spec.baseColor ?? spec.color, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  const strokeMat = new THREE.MeshStandardMaterial({ color: spec.strokeColor ?? "#111827", roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });

  const strokeBackZ = baseT;
  const textBackZ = baseT + strokeHmm;

  // --- text layer (frontmost) ---
  const textShapes = traceLayer(spec, fontPx, W, H, originX, originY, 0);
  let cx = 0,
    cy = 0,
    textWmm = spec.size * 2,
    textHmm = spec.size;
  if (textShapes.length) {
    const geo = extrudeLayer(textShapes, spec.thickness, k, bevelMM);
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    const s = new THREE.Vector3();
    geo.boundingBox!.getCenter(c);
    geo.boundingBox!.getSize(s);
    cx = c.x;
    cy = c.y;
    textWmm = s.x;
    textHmm = s.y;
    geo.translate(-cx, -cy, textBackZ);
    group.add(new THREE.Mesh(geo, textMat));
  }

  // --- stroke layer (middle) ---
  if (hasStroke) {
    const strokeShapes = traceLayer(spec, fontPx, W, H, originX, originY, strokeExpandPx);
    if (strokeShapes.length) {
      const geo = extrudeLayer(strokeShapes, strokeHmm, k, bevelMM);
      geo.translate(-cx, -cy, strokeBackZ);
      group.add(new THREE.Mesh(geo, strokeMat));
    }
  }

  // --- base layer (back): rectangular OR contour-hugging the text ---
  if (spec.edge === "contour") {
    const baseShapes = traceLayer(spec, fontPx, W, H, originX, originY, baseExpandPx);
    if (baseShapes.length) {
      const geo = extrudeLayer(baseShapes, baseT, k, 0);
      geo.translate(-cx, -cy, 0);
      group.add(new THREE.Mesh(geo, baseMat));
    }
  } else {
    const plateW = textWmm + padMM * 2;
    const plateH = textHmm + padMM * 2;
    const r = spec.edge === "round" ? Math.min(plateW, plateH) * 0.18 : 0.4;
    const baseGeo = new THREE.ExtrudeGeometry(roundedRectShape(plateW, plateH, r), {
      depth: baseT,
      bevelEnabled: spec.edge === "round",
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2,
    });
    group.add(new THREE.Mesh(baseGeo, baseMat));
  }

  // keyring placed at the outer edge of the whole plate (in y-up space)
  if (spec.ring !== "none") {
    group.updateMatrixWorld(true);
    const pbox = new THREE.Box3().setFromObject(group);
    const pw = pbox.max.x - pbox.min.x;
    const ph = pbox.max.y - pbox.min.y;
    const rOuter = Math.min(pw, ph) * 0.13 + 2;
    const tube = rOuter * 0.32;
    const ringGeo = new THREE.TorusGeometry(rOuter, tube, 12, 28);
    let rx = 0,
      ry = 0;
    if (spec.ring === "left") rx = pbox.min.x - rOuter * 0.7;
    else if (spec.ring === "right") rx = pbox.max.x + rOuter * 0.7;
    else ry = pbox.max.y + rOuter * 0.7; // top
    ringGeo.translate(rx, ry, baseT / 2);
    group.add(new THREE.Mesh(ringGeo, baseMat));
  }

  // center the whole model (including the ring) at the origin
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  group.position.set(-center.x, -center.y, -center.z);
  group.updateMatrixWorld(true);

  return { group, sizeMM: { w: size.x, h: size.y, d: size.z } };
}

/** Export a built nameplate group to a binary STL Blob. */
export function exportSTL(group: THREE.Object3D): Blob {
  group.updateMatrixWorld(true);
  const exporter = new STLExporter();
  const data = exporter.parse(group, { binary: true }) as unknown as DataView;
  return new Blob([data as unknown as BlobPart], { type: "model/stl" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
