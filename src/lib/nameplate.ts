"use client";

import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { contours } from "d3-contour";

export type RingPos = "left" | "top" | "right" | "none";
export type EdgeStyle = "sharp" | "round";

export type NameplateSpec = {
  text: string;
  font: string; // CSS font-family
  weight: number; // 400..800
  size: number; // text height (mm)
  thickness: number; // text depth (mm)
  letterSpacing: number; // extra spacing (px in the render canvas)
  ring: RingPos;
  baseThickness: number; // backing plate depth (mm)
  color: string; // text color (preview)
  baseColor?: string; // base plate + ring color (preview)
  edge: EdgeStyle;
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
];

async function ensureFont(spec: NameplateSpec) {
  try {
    await document.fonts.load(`${spec.weight} 200px "${spec.font}"`, spec.text);
    await document.fonts.ready;
  } catch {}
}

// Render the styled text to a canvas (browser does correct Thai shaping),
// trace it to vector paths, and return THREE.Shapes (with holes).
async function textToShapes(spec: NameplateSpec): Promise<THREE.Shape[]> {
  await ensureFont(spec);
  const fontPx = 140;
  const pad = 18;
  const measure = document.createElement("canvas").getContext("2d")!;
  const fontStr = `${spec.weight} ${fontPx}px "${spec.font}", "Noto Sans Thai", sans-serif`;
  measure.font = fontStr;
  measure.letterSpacing = `${spec.letterSpacing}px`;
  const m = measure.measureText(spec.text || " ");
  const ascent = m.actualBoundingBoxAscent || fontPx * 0.8;
  const descent = m.actualBoundingBoxDescent || fontPx * 0.25;
  const w = Math.ceil(m.width) + pad * 2;
  const h = Math.ceil(ascent + descent) + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, w);
  canvas.height = Math.max(8, h);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = fontStr;
  ctx.letterSpacing = `${spec.letterSpacing}px`;
  ctx.fillStyle = "#000000";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(spec.text, pad, pad + ascent);

  // contour-trace the bitmap into polygons with holes (marching squares)
  const W = canvas.width;
  const H = canvas.height;
  const px = ctx.getImageData(0, 0, W, H).data;
  const values = new Array<number>(W * H);
  for (let i = 0; i < W * H; i++) values[i] = 255 - px[i * 4]; // dark text = high
  const result = contours().size([W, H]).smooth(true).thresholds([128])(values);
  const multi = (result[0]?.coordinates ?? []) as number[][][][];

  const shapes: THREE.Shape[] = [];
  for (const poly of multi) {
    if (!poly.length || poly[0].length < 3) continue;
    const shape = new THREE.Shape();
    poly[0].forEach((p, i) =>
      i ? shape.lineTo(p[0], p[1]) : shape.moveTo(p[0], p[1])
    );
    for (let hi = 1; hi < poly.length; hi++) {
      const hole = new THREE.Path();
      poly[hi].forEach((p, i) =>
        i ? hole.lineTo(p[0], p[1]) : hole.moveTo(p[0], p[1])
      );
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }
  return shapes;
}

function shapesBBox(shapes: THREE.Shape[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const s of shapes) {
    for (const p of s.getPoints(8)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
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

/** Build the full nameplate (text + base + ring) as a THREE.Group in mm. */
export async function buildNameplate(spec: NameplateSpec): Promise<NameplateResult> {
  const shapes = await textToShapes(spec);
  const group = new THREE.Group();
  const baseCol = spec.baseColor ?? spec.color;

  const textMat = new THREE.MeshStandardMaterial({
    color: spec.color,
    roughness: 0.5,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const baseMat = new THREE.MeshStandardMaterial({
    color: baseCol,
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const padMM = Math.max(3, spec.size * 0.35); // plate padding around text
  let textW = spec.size * 2;
  let textH = spec.size;

  if (shapes.length) {
    const bb = shapesBBox(shapes);
    const k = spec.size / (bb.h || 1); // px -> mm (text height = spec.size)
    textW = bb.w * k;
    textH = bb.h * k;
    const depthPx = spec.thickness / k;
    const bevPx = (spec.edge === "round" ? 0.6 : 0) / k;

    const geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depthPx,
      bevelEnabled: bevPx > 0,
      bevelThickness: bevPx,
      bevelSize: bevPx,
      bevelSegments: 3,
      curveSegments: 8,
      steps: 1,
    });
    // -> mm; negate Y so the text is upright (y-up) and NOT mirrored
    geo.scale(k, -k, k);
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox!.getCenter(c);
    // center in X/Y, sit the back of the text on z=0 (front toward +z)
    geo.translate(-c.x, -c.y, -geo.boundingBox!.min.z);
    geo.computeVertexNormals();
    group.add(new THREE.Mesh(geo, textMat));
  }

  // base plate (behind the text, z: -baseThickness..0)
  const plateW = textW + padMM * 2;
  const plateH = textH + padMM * 2;
  const baseShape = roundedRectShape(plateW, plateH, Math.min(plateW, plateH) * 0.18);
  const baseGeo = new THREE.ExtrudeGeometry(baseShape, {
    depth: spec.baseThickness,
    bevelEnabled: spec.edge === "round",
    bevelThickness: 0.5,
    bevelSize: 0.5,
    bevelSegments: 2,
  });
  baseGeo.translate(0, 0, -spec.baseThickness);
  group.add(new THREE.Mesh(baseGeo, baseMat));

  // keyring (y-up space: top=+y, left=-x, right=+x)
  if (spec.ring !== "none") {
    const rOuter = Math.min(plateH, plateW) * 0.18 + 1.5;
    const tube = rOuter * 0.32;
    const ringGeo = new THREE.TorusGeometry(rOuter, tube, 12, 28);
    let rx = 0,
      ry = 0;
    if (spec.ring === "left") rx = -plateW / 2 - rOuter * 0.7;
    else if (spec.ring === "right") rx = plateW / 2 + rOuter * 0.7;
    else ry = plateH / 2 + rOuter * 0.7; // top
    ringGeo.translate(rx, ry, -spec.baseThickness / 2);
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

  return {
    group,
    sizeMM: { w: size.x, h: size.y, d: size.z },
  };
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
