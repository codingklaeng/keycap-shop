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
  ringDiameter?: number; // outer Ø of the keyring loop (mm)
  ringThickness?: number; // bar/tube thickness of the loop (mm)
  ringOffsetX?: number; // nudge the ring along x (mm)
  ringOffsetY?: number; // nudge the ring along y (mm)
  baseThickness: number; // backing plate depth (mm)
  color: string; // text color (preview)
  baseColor?: string; // base plate + ring color (preview)
  edge: EdgeStyle; // sharp | round (rectangular base) | contour (hugs the text)
  // optional middle stroke layer (outline around the text)
  stroke?: boolean;
  strokeColor?: string;
  strokeWidth?: number; // how far the outline extends outward (mm)
  strokeHeight?: number; // outline layer depth (mm)
  // optional decorative icon next to the text (heart, star, flower, …)
  icon?: IconName; // "none" or unset = no icon
  iconPos?: "left" | "right"; // which side of the text
  iconScale?: number; // icon height relative to the text height
  iconColor?: string; // main icon color
  iconAccentColor?: string; // 2nd-tone color (flower center, star inner, …)
  iconOffsetX?: number; // nudge the icon along x (mm); may overlap the text
  iconOffsetY?: number; // nudge the icon along y (mm)
};

export type IconName =
  | "none"
  | "heart"
  | "star"
  | "flower"
  | "crown"
  | "butterfly"
  | "cloud"
  | "pawDog"
  | "pawCat";

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

// Icons available for the nameplate. `accent` = has a 2nd-tone detail part.
export const NAMEPLATE_ICONS: { name: IconName; label: string; accent: boolean }[] = [
  { name: "heart", label: "หัวใจ", accent: true },
  { name: "star", label: "ดาว", accent: true },
  { name: "flower", label: "ดอกไม้", accent: true },
  { name: "crown", label: "มงกุฎ", accent: true },
  { name: "butterfly", label: "ผีเสื้อ", accent: true },
  { name: "cloud", label: "เมฆ", accent: false },
  { name: "pawDog", label: "อุ้งเท้าหมา", accent: false },
  { name: "pawCat", label: "อุ้งเท้าแมว", accent: false },
];

type IconPart = "main" | "accent" | "all";

// Each icon paints filled black inside a 100×100 box (the caller has already
// translated/scaled the context and set a black fill). Every primitive is its
// own fill so overlapping pieces union cleanly on the bitmap before tracing.
const ICON_DRAW: Record<
  Exclude<IconName, "none">,
  (ctx: CanvasRenderingContext2D, part: IconPart) => void
> = {
  heart(ctx, part) {
    if (part !== "accent") {
      ctx.beginPath();
      ctx.moveTo(50, 86);
      ctx.bezierCurveTo(18, 62, 6, 42, 6, 26);
      ctx.bezierCurveTo(6, 12, 22, 6, 36, 14);
      ctx.bezierCurveTo(43, 18, 48, 24, 50, 30);
      ctx.bezierCurveTo(52, 24, 57, 18, 64, 14);
      ctx.bezierCurveTo(78, 6, 94, 12, 94, 26);
      ctx.bezierCurveTo(94, 42, 82, 62, 50, 86);
      ctx.closePath();
      ctx.fill();
    }
    if (part !== "main") {
      ctx.beginPath();
      ctx.ellipse(34, 31, 7, 10, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  star(ctx, part) {
    const draw = (outer: number, inner: number) => {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? inner : outer;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const x = 50 + Math.cos(a) * r;
        const y = 52 + Math.sin(a) * r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    };
    if (part !== "accent") draw(46, 19);
    if (part !== "main") draw(22, 9);
  },
  flower(ctx, part) {
    if (part !== "accent") {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        const x = 50 + Math.cos(a) * 24;
        const y = 48 + Math.sin(a) * 24;
        ctx.beginPath();
        ctx.arc(x, y, 17, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (part !== "main") {
      ctx.beginPath();
      ctx.arc(50, 48, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  crown(ctx, part) {
    if (part !== "accent") {
      ctx.beginPath();
      ctx.moveTo(12, 72);
      ctx.lineTo(12, 38);
      ctx.lineTo(31, 55);
      ctx.lineTo(50, 28);
      ctx.lineTo(69, 55);
      ctx.lineTo(88, 38);
      ctx.lineTo(88, 72);
      ctx.closePath();
      ctx.fill();
    }
    if (part !== "main") {
      for (const [x, y, r] of [
        [50, 33, 6],
        [14, 41, 5],
        [86, 41, 5],
      ] as const) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.rect(12, 64, 76, 8);
      ctx.fill();
    }
  },
  butterfly(ctx, part) {
    if (part !== "accent") {
      for (const [x, y, rx, ry, rot] of [
        [32, 36, 21, 23, -0.4],
        [68, 36, 21, 23, 0.4],
        [35, 66, 15, 16, 0.5],
        [65, 66, 15, 16, -0.5],
      ] as const) {
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (part !== "main") {
      ctx.beginPath();
      ctx.ellipse(50, 52, 5, 27, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(50, 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  cloud(ctx, part) {
    if (part === "accent") return;
    for (const [x, y, r] of [
      [33, 57, 18],
      [50, 44, 23],
      [69, 57, 18],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.rect(33, 57, 36, 18);
    ctx.fill();
  },
  pawDog(ctx, part) {
    if (part === "accent") return;
    ctx.beginPath();
    ctx.ellipse(50, 66, 23, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, r] of [
      [24, 38, 9],
      [42, 26, 10],
      [58, 26, 10],
      [76, 38, 9],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  pawCat(ctx, part) {
    if (part === "accent") return;
    ctx.beginPath();
    ctx.ellipse(50, 64, 21, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y, r] of [
      [27, 43, 8],
      [43, 32, 8.5],
      [57, 32, 8.5],
      [73, 43, 8],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

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

// separable box blur of a scalar field — softens the hard pixel-grid edges so
// the traced contour is a smooth curve instead of a zig-zag of 1px steps
// (which otherwise show up as vertical striations on the extruded walls).
function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  if (r < 1) return src;
  const win = 2 * r + 1;
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const clamp = (v: number, hi: number) => (v < 0 ? 0 : v > hi ? hi : v);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[row + clamp(x, W - 1)];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = acc / win;
      acc += src[row + clamp(x + r + 1, W - 1)] - src[row + clamp(x - r, W - 1)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, H - 1) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / win;
      acc += tmp[clamp(y + r + 1, H - 1) * W + x] - tmp[clamp(y - r, H - 1) * W + x];
    }
  }
  return out;
}

// contour-trace a B/W canvas into polygons with holes (marching squares)
function traceCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  blurR: number
): THREE.Shape[] {
  const px = ctx.getImageData(0, 0, W, H).data;
  const raw = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) raw[i] = 255 - px[i * 4]; // dark = high
  const values = boxBlur(raw, W, H, blurR);
  const result = contours()
    .size([W, H])
    .smooth(true)
    .thresholds([128])(values as unknown as number[]);
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

// A blank white frame that every layer is drawn onto, so traced px coordinates
// of text + icon line up across layers.
function newFrame(W: number, H: number): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(8, Math.ceil(W));
  canvas.height = Math.max(8, Math.ceil(H));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

// Paint the text, optionally grown outward by `expandPx` (half line width).
// Defaults to black for tracing; the thumbnail passes real colors.
function drawTextOn(
  ctx: CanvasRenderingContext2D,
  spec: NameplateSpec,
  fontPx: number,
  originX: number,
  originY: number,
  expandPx: number,
  color = "#000000"
) {
  ctx.font = fontString(spec, fontPx);
  ctx.letterSpacing = `${spec.letterSpacing}px`;
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (expandPx > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = expandPx * 2;
    ctx.strokeText(spec.text, originX, originY);
  }
  ctx.fillStyle = color;
  ctx.fillText(spec.text, originX, originY);
}

// Paint an icon part inside a [boxX,boxY] sizePx square. `growPx` enlarges the
// box outward to approximate an outline halo for the stroke/base layers.
function drawIconOn(
  ctx: CanvasRenderingContext2D,
  icon: Exclude<IconName, "none">,
  part: IconPart,
  boxX: number,
  boxY: number,
  sizePx: number,
  growPx: number,
  color = "#000000"
) {
  const sz = sizePx + 2 * growPx;
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(boxX - growPx, boxY - growPx);
  ctx.scale(sz / 100, sz / 100);
  ICON_DRAW[icon](ctx, part);
  ctx.restore();
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

export type BuildQuality = "preview" | "export";

/** Build the full nameplate (base + optional stroke + text + ring) in mm.
 *  `quality` trades render resolution for speed: "preview" stays light/snappy
 *  on screen, "export" maxes out smoothness for the downloaded STL. */
export async function buildNameplate(
  spec: NameplateSpec,
  quality: BuildQuality = "preview"
): Promise<NameplateResult> {
  await ensureFont(spec);
  // Higher render resolution → the marching-squares contour follows curves much
  // more finely; combined with boxBlur on the raster (smooths the pixel-grid
  // zig-zag) this removes the faceting / vertical striations on the walls.
  const fontPx = quality === "export" ? 720 : 360;
  const blurR = quality === "export" ? 3 : 2;
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

  // optional decorative icon next to the text
  const icon = spec.icon && spec.icon !== "none" ? spec.icon : null;
  const iconDef = icon ? NAMEPLATE_ICONS.find((i) => i.name === icon) : null;
  const iconHasAccent = !!iconDef?.accent;
  const iconSizePx = icon ? textHpx * (spec.iconScale ?? 1.2) : 0;
  const iconGapPx = icon ? textHpx * 0.18 : 0;
  const iconSide = spec.iconPos === "right" ? "right" : "left";

  // Lay text + icon out in a working space (text top-left = origin), apply the
  // icon offset (which may push it onto the text), then size the canvas to the
  // union ± padding so nothing ever clips regardless of offsets.
  const textRect = { x: 0, y: 0, w: mi.textW, h: textHpx };
  const iconRect =
    icon
      ? {
          x:
            (iconSide === "left" ? -(iconGapPx + iconSizePx) : mi.textW + iconGapPx) +
            (spec.iconOffsetX ?? 0) / k,
          y: (textHpx - iconSizePx) / 2 - (spec.iconOffsetY ?? 0) / k,
          w: iconSizePx,
          h: iconSizePx,
        }
      : null;

  let minX = textRect.x;
  let minY = textRect.y;
  let maxX = textRect.x + textRect.w;
  let maxY = textRect.y + textRect.h;
  if (iconRect) {
    minX = Math.min(minX, iconRect.x);
    minY = Math.min(minY, iconRect.y);
    maxX = Math.max(maxX, iconRect.x + iconRect.w);
    maxY = Math.max(maxY, iconRect.y + iconRect.h);
  }

  const padPx = Math.ceil(maxExpandPx) + 8;
  const dx = padPx - minX;
  const dy = padPx - minY;
  const W = maxX - minX + padPx * 2;
  const H = maxY - minY + padPx * 2;
  const originX = textRect.x + dx;
  const originY = textRect.y + dy + mi.ascent;
  const iconX = iconRect ? iconRect.x + dx : 0;
  const iconTop = iconRect ? iconRect.y + dy : 0;
  // gap carved out of the icon where the text overlaps it (text wins)
  const carvePx = Math.max(0.35 / k, 1);

  const group = new THREE.Group();
  const textMat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const baseMat = new THREE.MeshStandardMaterial({ color: spec.baseColor ?? spec.color, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide });
  const strokeMat = new THREE.MeshStandardMaterial({ color: spec.strokeColor ?? "#111827", roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const iconMat = new THREE.MeshStandardMaterial({ color: spec.iconColor ?? "#ef4444", roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });
  const iconAccentMat = new THREE.MeshStandardMaterial({ color: spec.iconAccentColor ?? "#fde047", roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide });

  const strokeBackZ = baseT;
  const textBackZ = baseT + strokeHmm;

  // --- text layer (frontmost) ---
  const textCtx = newFrame(W, H);
  drawTextOn(textCtx, spec, fontPx, originX, originY, 0);
  const textShapes = traceCanvas(textCtx, textCtx.canvas.width, textCtx.canvas.height, blurR);
  let cx = 0,
    cy = 0;
  if (textShapes.length) {
    const geo = extrudeLayer(textShapes, spec.thickness, k, bevelMM);
    geo.computeBoundingBox();
    const c = new THREE.Vector3();
    geo.boundingBox!.getCenter(c);
    cx = c.x;
    cy = c.y;
    geo.translate(-cx, -cy, textBackZ);
    group.add(new THREE.Mesh(geo, textMat));
  }

  // --- icon layers (front, same level as the text) ---
  // Where the icon overlaps the text, the text is carved out of the icon so the
  // text always reads cleanly on top (the icon gets notched).
  const carveText = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    drawTextOn(ctx, spec, fontPx, originX, originY, carvePx);
    ctx.restore();
  };
  if (icon) {
    const mc = newFrame(W, H);
    drawIconOn(mc, icon, "main", iconX, iconTop, iconSizePx, 0);
    carveText(mc);
    const mShapes = traceCanvas(mc, mc.canvas.width, mc.canvas.height, blurR);
    if (mShapes.length) {
      const geo = extrudeLayer(mShapes, spec.thickness, k, bevelMM);
      geo.translate(-cx, -cy, textBackZ);
      group.add(new THREE.Mesh(geo, iconMat));
    }
    if (iconHasAccent) {
      const ac = newFrame(W, H);
      drawIconOn(ac, icon, "accent", iconX, iconTop, iconSizePx, 0);
      carveText(ac);
      const aShapes = traceCanvas(ac, ac.canvas.width, ac.canvas.height, blurR);
      if (aShapes.length) {
        // raise the accent slightly so it reads as an inlay on top of the main color
        const geo = extrudeLayer(aShapes, spec.thickness, k, bevelMM);
        geo.translate(-cx, -cy, textBackZ + Math.min(0.5, spec.thickness * 0.4));
        group.add(new THREE.Mesh(geo, iconAccentMat));
      }
    }
  }

  // --- stroke layer (middle): outline around text + icon ---
  if (hasStroke) {
    const sc = newFrame(W, H);
    drawTextOn(sc, spec, fontPx, originX, originY, strokeExpandPx);
    if (icon) drawIconOn(sc, icon, "all", iconX, iconTop, iconSizePx, strokeExpandPx);
    const sShapes = traceCanvas(sc, sc.canvas.width, sc.canvas.height, blurR);
    if (sShapes.length) {
      const geo = extrudeLayer(sShapes, strokeHmm, k, bevelMM);
      geo.translate(-cx, -cy, strokeBackZ);
      group.add(new THREE.Mesh(geo, strokeMat));
    }
  }

  // --- base layer (back): rectangular OR contour-hugging the text + icon ---
  if (spec.edge === "contour") {
    const bc = newFrame(W, H);
    drawTextOn(bc, spec, fontPx, originX, originY, baseExpandPx);
    if (icon) drawIconOn(bc, icon, "all", iconX, iconTop, iconSizePx, baseExpandPx);
    const bShapes = traceCanvas(bc, bc.canvas.width, bc.canvas.height, blurR);
    if (bShapes.length) {
      // The base is a SOLID plate: drop the inner holes (letter counters) so the
      // text never appears inside the base layers — the text is its own raised
      // layer sitting on top of this solid plate.
      for (const s of bShapes) s.holes = [];
      const geo = extrudeLayer(bShapes, baseT, k, 0);
      geo.translate(-cx, -cy, 0);
      group.add(new THREE.Mesh(geo, baseMat));
    }
  } else {
    // rectangular/rounded plate sized to enclose everything added so far
    group.updateMatrixWorld(true);
    const cbox = new THREE.Box3().setFromObject(group);
    const cw = cbox.max.x - cbox.min.x;
    const ch = cbox.max.y - cbox.min.y;
    const ccx = (cbox.max.x + cbox.min.x) / 2;
    const ccy = (cbox.max.y + cbox.min.y) / 2;
    const plateW = cw + padMM * 2;
    const plateH = ch + padMM * 2;
    const r = spec.edge === "round" ? Math.min(plateW, plateH) * 0.18 : 0.4;
    const baseGeo = new THREE.ExtrudeGeometry(roundedRectShape(plateW, plateH, r), {
      depth: baseT,
      bevelEnabled: spec.edge === "round",
      bevelThickness: 0.5,
      bevelSize: 0.5,
      bevelSegments: 2,
    });
    baseGeo.translate(ccx, ccy, 0);
    group.add(new THREE.Mesh(baseGeo, baseMat));
  }

  // keyring placed at the outer edge of the whole plate (in y-up space)
  if (spec.ring !== "none") {
    group.updateMatrixWorld(true);
    const pbox = new THREE.Box3().setFromObject(group);
    const pw = pbox.max.x - pbox.min.x;
    const ph = pbox.max.y - pbox.min.y;
    // ring sizing: explicit (mm) from the user, or auto-scaled to the plate
    const outerD =
      spec.ringDiameter && spec.ringDiameter > 0
        ? spec.ringDiameter
        : Math.min(pw, ph) * 0.26 + 4;
    const barT =
      spec.ringThickness && spec.ringThickness > 0
        ? spec.ringThickness
        : outerD * 0.32;
    const tube = Math.max(0.4, barT / 2); // torus tube radius
    const rMean = Math.max(tube + 0.3, outerD / 2 - tube); // torus mean radius
    const rOuter = rMean + tube;
    const ringGeo = new THREE.TorusGeometry(rMean, tube, 18, 48);
    let rx = 0,
      ry = 0;
    if (spec.ring === "left") rx = pbox.min.x - rOuter * 0.7;
    else if (spec.ring === "right") rx = pbox.max.x + rOuter * 0.7;
    else ry = pbox.max.y + rOuter * 0.7; // top
    rx += spec.ringOffsetX ?? 0;
    ry += spec.ringOffsetY ?? 0;
    // the lowest point of the ring sits flush with the base bottom (z = 0) so
    // it doesn't dip below the plate when the piece is printed lying flat.
    ringGeo.translate(rx, ry, tube);
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

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A flat top-view colored thumbnail (PNG data URL) of the nameplate — light
 *  enough to show many at once on the shop board (no WebGL), and it matches how
 *  the printed piece lies flat so staff can grab the right one. */
export async function nameplateThumbnail(spec: NameplateSpec): Promise<string> {
  await ensureFont(spec);
  const fontPx = 110;
  const mi = measureTextPx(spec, fontPx);
  const textH = mi.ascent + mi.descent;
  const pxPerMM = textH / Math.max(1, spec.size);

  const icon = spec.icon && spec.icon !== "none" ? spec.icon : null;
  const iconHasAccent = !!(icon && NAMEPLATE_ICONS.find((i) => i.name === icon)?.accent);
  const iconSize = icon ? textH * (spec.iconScale ?? 1.2) : 0;
  const iconGap = icon ? textH * 0.18 : 0;
  const iconSide = spec.iconPos === "right" ? "right" : "left";
  const hasStroke = !!spec.stroke && (spec.strokeWidth ?? 0) > 0;
  const strokeW = hasStroke ? (spec.strokeWidth as number) * pxPerMM : 0;

  // working space: text top-left = (0,0), y-down (canvas)
  const iconX =
    (iconSide === "left" ? -(iconGap + iconSize) : mi.textW + iconGap) +
    (spec.iconOffsetX ?? 0) * pxPerMM;
  const iconY = (textH - iconSize) / 2 - (spec.iconOffsetY ?? 0) * pxPerMM;

  let minX = 0;
  let minY = 0;
  let maxX = mi.textW;
  let maxY = textH;
  if (icon) {
    minX = Math.min(minX, iconX);
    minY = Math.min(minY, iconY);
    maxX = Math.max(maxX, iconX + iconSize);
    maxY = Math.max(maxY, iconY + iconSize);
  }

  const basePad = Math.max(textH * 0.34, strokeW + 6, 10);
  const bx0 = minX - basePad;
  const by0 = minY - basePad;
  const bx1 = maxX + basePad;
  const by1 = maxY + basePad;

  // ring (top-view annulus)
  const ringOn = !!spec.ring && spec.ring !== "none";
  const ringR = ringOn ? Math.max(5, (spec.ringDiameter ?? 12) / 2) * pxPerMM : 0;
  const ringBar = ringOn ? Math.max(2, ((spec.ringThickness ?? 3.5) / 2) * pxPerMM) : 0;
  let rcx = 0;
  let rcy = 0;
  if (ringOn) {
    if (spec.ring === "left") {
      rcx = bx0 - ringR * 0.7;
      rcy = (by0 + by1) / 2;
    } else if (spec.ring === "right") {
      rcx = bx1 + ringR * 0.7;
      rcy = (by0 + by1) / 2;
    } else {
      rcx = (bx0 + bx1) / 2;
      rcy = by0 - ringR * 0.7;
    }
    rcx += (spec.ringOffsetX ?? 0) * pxPerMM;
    rcy -= (spec.ringOffsetY ?? 0) * pxPerMM;
  }

  let loX = bx0;
  let loY = by0;
  let hiX = bx1;
  let hiY = by1;
  if (ringOn) {
    loX = Math.min(loX, rcx - ringR);
    loY = Math.min(loY, rcy - ringR);
    hiX = Math.max(hiX, rcx + ringR);
    hiY = Math.max(hiY, rcy + ringR);
  }

  const pad = 6;
  const W = Math.ceil(hiX - loX + pad * 2);
  const H = Math.ceil(hiY - loY + pad * 2);
  const dx = pad - loX;
  const dy = pad - loY;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const baseColor = spec.baseColor ?? "#e5e7eb";
  const tX = dx;
  const tY = dy + mi.ascent;
  const iX = iconX + dx;
  const iY = iconY + dy;

  // keyring (under the plate)
  if (ringOn) {
    ctx.lineWidth = ringBar * 2;
    ctx.strokeStyle = baseColor;
    ctx.beginPath();
    ctx.arc(rcx + dx, rcy + dy, Math.max(1, ringR - ringBar), 0, Math.PI * 2);
    ctx.stroke();
  }

  // base layer
  if (spec.edge === "contour") {
    drawTextOn(ctx, spec, fontPx, tX, tY, basePad, baseColor);
    if (icon) drawIconOn(ctx, icon, "all", iX, iY, iconSize, basePad, baseColor);
  } else {
    const r = spec.edge === "round" ? Math.min(bx1 - bx0, by1 - by0) * 0.18 : 3;
    ctx.fillStyle = baseColor;
    roundRectPath(ctx, bx0 + dx, by0 + dy, bx1 - bx0, by1 - by0, r);
    ctx.fill();
  }

  // stroke layer
  if (hasStroke) {
    const sc = spec.strokeColor ?? "#111827";
    drawTextOn(ctx, spec, fontPx, tX, tY, strokeW, sc);
    if (icon) drawIconOn(ctx, icon, "all", iX, iY, iconSize, strokeW, sc);
  }

  // icon
  if (icon) {
    drawIconOn(ctx, icon, "main", iX, iY, iconSize, 0, spec.iconColor ?? "#ef4444");
    if (iconHasAccent)
      drawIconOn(ctx, icon, "accent", iX, iY, iconSize, 0, spec.iconAccentColor ?? "#fde047");
  }

  // text (front)
  drawTextOn(ctx, spec, fontPx, tX, tY, 0, spec.color);

  return canvas.toDataURL("image/png");
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
