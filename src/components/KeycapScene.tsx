"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { PreviewLetter } from "@/components/KeycapPreview";

type Props = {
  letters: PreviewLetter[];
  baseColor: string | null;
  layout: "horizontal" | "vertical";
  pendantName: string | null;
  pendantImage: string | null;
};

function emojiFor(name: string | null): string | null {
  if (!name || name.includes("ไม่มี")) return null;
  if (name.includes("หัวใจ")) return "❤️";
  if (name.includes("ดาว")) return "⭐";
  if (name.includes("กระดิ่ง")) return "🔔";
  return "🧷";
}

function makeTexture(text: string, color: string, bold = true): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, s, s);
  ctx.fillStyle = color;
  ctx.font = `${bold ? "bold " : ""}170px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, s / 2, s / 2 + 12);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function Label({ char, color }: { char: string; color: string }) {
  const tex = useMemo(() => makeTexture(char, color), [char, color]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, 0, 0.27]}>
      <planeGeometry args={[0.82, 0.82]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}

function Keycap({
  letter,
  position,
}: {
  letter: PreviewLetter;
  position: [number, number, number];
}) {
  return (
    <group position={position}>
      <RoundedBox args={[0.96, 0.96, 0.5]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color={letter.key} roughness={0.45} metalness={0.08} />
      </RoundedBox>
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

function Model({ letters, baseColor, layout, pendantName }: Props) {
  const ghost = letters.length === 0;
  const shown: PreviewLetter[] = ghost
    ? ["A", "B", "C"].map((c) => ({ char: c, key: "#d1d5db", text: "#9ca3af" }))
    : letters;

  const n = shown.length;
  const gap = 1.08;
  const horizontal = layout === "horizontal";

  const positions: [number, number, number][] = shown.map((_, i) => {
    const offset = (i - (n - 1) / 2) * gap;
    return horizontal ? [offset, 0, 0.25] : [0, -offset, 0.25];
  });

  // base plate sized to fit
  const padW = horizontal ? n * gap + 0.5 : 1.5;
  const padH = horizontal ? 1.5 : n * gap + 0.5;
  const plateTop = padH / 2;

  const emoji = emojiFor(pendantName);

  return (
    <group>
      {/* keyring */}
      <mesh position={[0, plateTop + 0.35, 0]}>
        <torusGeometry args={[0.22, 0.06, 14, 28]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, plateTop + 0.08, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 10]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.25} />
      </mesh>

      {/* base plate */}
      <RoundedBox args={[padW, padH, 0.25]} radius={0.12} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={baseColor ?? "#e5e7eb"} roughness={0.6} metalness={0.05} />
      </RoundedBox>

      {/* keycaps */}
      {shown.map((l, i) => (
        <Keycap key={i} letter={l} position={positions[i]} />
      ))}

      {/* pendant */}
      {emoji && <EmojiCharm emoji={emoji} y={-plateTop - 0.7} />}
    </group>
  );
}

export function KeycapScene(props: Props) {
  const [spinning, setSpinning] = useState(true);

  // distance to frame the model
  const n = Math.max(props.letters.length, 3);
  const extent = props.layout === "horizontal" ? n * 1.08 + 1 : n * 1.08 + 2.5;
  const dist = Math.max(6, extent * 1.15);
  // slightly elevated 3/4 hero view (depth reads, text stays legible at rest)
  const camPos: [number, number, number] = [dist * 0.16, dist * 0.16, dist * 0.97];

  return (
    <div className="relative">
      <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height: 180 }}>
        <PerspectiveCamera makeDefault position={camPos} fov={32} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 6]} intensity={1.15} />
        <directionalLight position={[-4, -2, 3]} intensity={0.35} />
        <SpinGroup spinning={spinning}>
          <Model {...props} />
        </SpinGroup>
        {/* manual inspection enabled only when not auto-spinning */}
        <OrbitControls
          enabled={!spinning}
          enableZoom={false}
          enablePan={false}
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
      {!spinning && (
        <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted">
          ลากเพื่อหมุนดูรอบด้าน
        </span>
      )}
    </div>
  );
}
