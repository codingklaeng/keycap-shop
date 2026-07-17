"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { PreviewLetter } from "@/components/KeycapPreview";
import type { BaseShape } from "@/lib/types";

type Props = {
  letters: PreviewLetter[];
  baseColor: string | null;
  layout: "horizontal" | "vertical";
  shape: BaseShape;
  pendantName: string | null;
  pendantImage: string | null;
};

// Prism geometry params per keycap shape: radial segments + the cylinder
// thetaStart that orients the polygon flat-top (a flat edge on top & bottom).
// Orienting via thetaStart (not a mesh z-rotation) keeps the keycap facing the
// camera — a z-rotation in the Euler would tilt it out of plane.
function prismFor(shape: BaseShape): { segments: number; thetaStart: number } | null {
  switch (shape) {
    case "circle":
      return { segments: 48, thetaStart: 0 };
    case "hexagon":
      return { segments: 6, thetaStart: Math.PI / 6 };
    case "octagon":
      return { segments: 8, thetaStart: Math.PI / 8 };
    default:
      return null; // rounded_square -> RoundedBox
  }
}

function emojiFor(name: string | null): string | null {
  if (!name || name.includes("ไม่มี")) return null;
  if (name.includes("หัวใจ")) return "❤️";
  if (name.includes("ดาว")) return "⭐";
  if (name.includes("กระดิ่ง")) return "🔔";
  return "🧷";
}

function makeTexture(
  text: string,
  color: string,
  bold = true,
  fontPx = 170
): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, s / 2, s / 2 + 10);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function Label({ char, color }: { char: string; color: string }) {
  const tex = useMemo(() => makeTexture(char, color, true, 230), [char, color]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0, 0.27]}>
      <planeGeometry args={[0.92, 0.92]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}

function Keycap({
  letter,
  position,
  shape,
}: {
  letter: PreviewLetter;
  position: [number, number, number];
  shape: BaseShape;
}) {
  const prism = prismFor(shape);
  return (
    <group position={position}>
      {prism ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry
            args={[0.48, 0.48, 0.5, prism.segments, 1, false, prism.thetaStart, Math.PI * 2]}
          />
          <meshStandardMaterial color={letter.key} roughness={0.45} metalness={0.08} />
        </mesh>
      ) : (
        <RoundedBox args={[0.96, 0.96, 0.5]} radius={0.1} smoothness={4}>
          <meshStandardMaterial color={letter.key} roughness={0.45} metalness={0.08} />
        </RoundedBox>
      )}
      <Label char={letter.char} color={letter.text} />
    </group>
  );
}

const CHARM_REACH = 0.85; // charm centre distance from the ring centre
const CHARM_HALF = 0.35; // half the charm plane
const CHARM_LINK = CHARM_REACH - 0.3; // link stops short of the charm centre

// Charm on a link off the ring (anchor = ring position). It hangs down when the
// ring is on the left, and points right when the ring is on top — dangling from
// a top ring would drop the charm over the plate.
function EmojiCharm({
  emoji,
  anchor,
  direction,
}: {
  emoji: string;
  anchor: [number, number, number];
  direction: "down" | "right";
}) {
  const tex = useMemo(() => makeTexture(emoji, "#000", false), [emoji]);
  useEffect(() => () => tex.dispose(), [tex]);
  const [ax, ay] = anchor;
  const down = direction === "down";
  const linkPos: [number, number, number] = down
    ? [ax, ay - CHARM_LINK / 2, 0]
    : [ax + CHARM_LINK / 2, ay, 0];
  // the cylinder runs along its local Y, so lay it flat for the right-pointing link
  const linkRot: [number, number, number] = down ? [0, 0, 0] : [0, 0, Math.PI / 2];
  const charmPos: [number, number, number] = down
    ? [ax, ay - CHARM_REACH, 0]
    : [ax + CHARM_REACH, ay, 0];
  // z stays at 0, the ring's own plane, so the link meets the ring instead of
  // floating in front of it when the model is turned side-on
  return (
    <>
      <mesh position={linkPos} rotation={linkRot}>
        <cylinderGeometry args={[0.02, 0.02, CHARM_LINK, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={charmPos}>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </>
  );
}

// Gently rocks the model left-right while spinning (so a flat keychain never
// shows an edge-on side), and eases back to facing front when stopped.
function SpinGroup({
  spinning,
  children,
}: {
  spinning: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = ref.current;
    if (!g) return;
    if (spinning) {
      g.rotation.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.55;
    } else {
      g.rotation.y += (0 - g.rotation.y) * 0.12; // ease to front
    }
  });
  return <group ref={ref}>{children}</group>;
}

function Model({ letters, baseColor, layout, shape, pendantName }: Props) {
  const ghost = letters.length === 0;
  const shown: PreviewLetter[] = ghost
    ? ["A", "B", "C"].map((c) => ({ char: c, key: "#d1d5db", text: "#9ca3af" }))
    : letters;

  const n = shown.length;
  const gap = 1.08;
  const horizontal = layout === "horizontal";

  const plateDepth = 0.8; // thicker base (was 0.25)
  const keycapDepth = 0.5;
  // sink the keycaps into the plate so ~30% of their depth sticks out
  const keycapZ = plateDepth / 2 + keycapDepth * 0.3 - keycapDepth / 2;
  const positions: [number, number, number][] = shown.map((_, i) => {
    const offset = (i - (n - 1) / 2) * gap;
    return horizontal ? [offset, 0, keycapZ] : [0, -offset, keycapZ];
  });

  // base plate sized to fit (always a rounded rectangle — the shape is per keycap)
  const padW = horizontal ? n * gap + 0.5 : 1.5;
  const padH = horizontal ? 1.5 : n * gap + 0.5;
  const plateTop = padH / 2;

  const emoji = emojiFor(pendantName);

  // keyring: top-center for vertical, left-center for horizontal
  const ringPos: [number, number, number] = horizontal
    ? [-padW / 2 - 0.35, 0, 0]
    : [0, plateTop + 0.35, 0];
  const connPos: [number, number, number] = horizontal
    ? [-padW / 2 - 0.08, 0, 0]
    : [0, plateTop + 0.08, 0];
  const connRot: [number, number, number] = horizontal
    ? [0, 0, Math.PI / 2]
    : [0, 0, 0];

  return (
    <group>
      {/* keyring — tinted to the base color */}
      <mesh position={ringPos}>
        <torusGeometry args={[0.22, 0.06, 14, 28]} />
        <meshStandardMaterial color={baseColor ?? "#9ca3af"} metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={connPos} rotation={connRot}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 10]} />
        <meshStandardMaterial color={baseColor ?? "#9ca3af"} metalness={0.45} roughness={0.3} />
      </mesh>

      {/* base plate */}
      <RoundedBox args={[padW, padH, plateDepth]} radius={0.14} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={baseColor ?? "#e5e7eb"} roughness={0.6} metalness={0.05} />
      </RoundedBox>

      {/* keycaps — shaped per base type */}
      {shown.map((l, i) => (
        <Keycap key={i} letter={l} position={positions[i]} shape={shape} />
      ))}

      {/* pendant — off the ring: down when the ring is on the left, right when on top */}
      {emoji && (
        <EmojiCharm emoji={emoji} anchor={ringPos} direction={horizontal ? "down" : "right"} />
      )}
    </group>
  );
}

const GAP = 1.08;
const FOV = 32;

// Bounding metrics of the model so the camera can frame it fully (incl. the
// keyring and the pendant), for any layout / text length. The ring sits on top
// for vertical and on the left for horizontal, and the charm follows it: down
// from a left ring, right from a top ring.
function metrics(layout: "horizontal" | "vertical", n: number, hasPendant: boolean) {
  const horizontal = layout === "horizontal";
  const padH = horizontal ? 1.5 : n * GAP + 0.5;
  const padW = horizontal ? n * GAP + 0.5 : 1.5;
  const plateTop = padH / 2;
  const ring = 0.63; // ring reach beyond the plate edge
  const charm = 0.35 + CHARM_HALF; // ring offset + half the charm plane

  // vertical: the charm sits beside the top ring, reaching a touch above it
  const maxY = horizontal ? plateTop : plateTop + (hasPendant ? charm : ring);
  // horizontal: the charm drops below the left ring to ~-1.25
  const minY =
    horizontal && hasPendant ? Math.min(-plateTop - 0.05, -1.25) : -plateTop - 0.05;
  const minX = horizontal ? -padW / 2 - (hasPendant ? 0.7 : ring) : -padW / 2;
  // vertical: the charm reaches right of the plate edge
  const maxX =
    horizontal || !hasPendant ? padW / 2 : Math.max(padW / 2, CHARM_REACH + CHARM_HALF);

  return {
    H: maxY - minY,
    W: maxX - minX,
    Xc: (maxX + minX) / 2,
    Yc: (maxY + minY) / 2,
  };
}

export function KeycapScene(props: Props) {
  const [spinning, setSpinning] = useState(true);

  const n = props.letters.length === 0 ? 3 : props.letters.length;
  const hasPendant = emojiFor(props.pendantName) !== null;
  const { H, W, Xc, Yc } = metrics(props.layout, n, hasPendant);

  // distance that fits both the height and the width (with margin)
  const tanHalf = Math.tan((FOV * Math.PI) / 360);
  const aspect = 1.7; // conservative (narrow phones) so width never clips
  const distH = H / 2 / tanHalf;
  const distW = W / 2 / (tanHalf * aspect);
  const dist = Math.max(distH, distW, 4.5) * 1.18;
  const camPos: [number, number, number] = [dist * 0.12, dist * 0.12, dist * 0.95];

  return (
    <div className="relative">
      <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height: 185 }}>
        <PerspectiveCamera makeDefault position={camPos} fov={FOV} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 6]} intensity={1.15} />
        <directionalLight position={[-4, -2, 3]} intensity={0.35} />
        <SpinGroup spinning={spinning}>
          {/* re-center the model so it never clips and spins about its center */}
          <group position={[-Xc, -Yc, 0]}>
            <Model {...props} />
          </group>
        </SpinGroup>
        {/* zoom (incl. pinch) always available; manual rotate only when paused
            so it doesn't fight the auto-spin */}
        <OrbitControls
          enableZoom
          enablePan={false}
          enableRotate={!spinning}
          minDistance={dist * 0.45}
          maxDistance={dist * 1.8}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(3 * Math.PI) / 4}
        />
      </Canvas>

      <button
        type="button"
        onClick={() => setSpinning((s) => !s)}
        className="absolute right-2 top-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:text-foreground"
      >
        {spinning ? "⏸ หยุดหมุน" : "↻ หมุน"}
      </button>
      <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted">
        {spinning ? "ถ่างนิ้ว/สกอลล์เพื่อซูม" : "ลากเพื่อหมุน · ถ่างนิ้วเพื่อซูม"}
      </span>
    </div>
  );
}
