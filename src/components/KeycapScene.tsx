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

// Prism geometry params for non-rounded-square plates: radial segments + an
// in-plane rotation so a flat edge sits on top.
function prismFor(shape: BaseShape): { segments: number; zRot: number } | null {
  switch (shape) {
    case "circle":
      return { segments: 48, zRot: 0 };
    case "hexagon":
      return { segments: 6, zRot: Math.PI / 6 };
    case "octagon":
      return { segments: 8, zRot: Math.PI / 8 };
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
        <mesh rotation={[Math.PI / 2, 0, prism.zRot]}>
          <cylinderGeometry args={[0.48, 0.48, 0.5, prism.segments]} />
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

function EmojiCharm({ emoji, y }: { emoji: string; y: number }) {
  const tex = useMemo(() => makeTexture(emoji, "#000", false), [emoji]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, y, 0.2]}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh>
        <planeGeometry args={[0.7, 0.7]} />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
    </group>
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
  const keycapZ = plateDepth / 2 + 0.25; // keycaps sit on the front face
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

      {/* pendant */}
      {emoji && <EmojiCharm emoji={emoji} y={-plateTop - 0.7} />}
    </group>
  );
}

const GAP = 1.08;
const FOV = 32;

// Bounding metrics of the model so the camera can frame it fully (incl. the
// keyring and the pendant below), for any layout / text length. The ring sits
// on top for vertical and on the left for horizontal.
function metrics(layout: "horizontal" | "vertical", n: number, hasPendant: boolean) {
  const horizontal = layout === "horizontal";
  const padH = horizontal ? 1.5 : n * GAP + 0.5;
  const padW = horizontal ? n * GAP + 0.5 : 1.5;
  const plateTop = padH / 2;
  const ring = 0.63; // ring reach beyond the plate edge

  const maxY = horizontal ? plateTop : plateTop + ring;
  const minY = hasPendant ? -plateTop - 1.05 : -plateTop - 0.05;
  const minX = horizontal ? -padW / 2 - ring : -padW / 2;
  const maxX = padW / 2;

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
