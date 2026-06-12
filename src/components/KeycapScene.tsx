"use client";

import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
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
  // distance to frame the model
  const n = Math.max(props.letters.length, 3);
  const extent = props.layout === "horizontal" ? n * 1.08 + 1 : n * 1.08 + 2.5;
  const dist = Math.max(6, extent * 1.15);

  return (
    <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height: 170 }}>
      <PerspectiveCamera makeDefault position={[0, 0, dist]} fov={32} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 6]} intensity={1.15} />
      <directionalLight position={[-4, -2, 3]} intensity={0.35} />
      <Model {...props} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.4}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />
    </Canvas>
  );
}
