"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Bounds,
  Text,
  Billboard,
} from "@react-three/drei";
import * as THREE from "three";

type Size = { w: number; h: number; d: number };

// A cm ruler drawn around the model (1 world unit = 1 mm). Ticks every 5 mm,
// labelled every 1 cm, along the bottom (X) and left (Y) edges.
function Ruler({ w, h }: { w: number; h: number }) {
  const { geom, labels } = useMemo(() => {
    const pts: number[] = [];
    const labels: { pos: [number, number, number]; text: string }[] = [];
    const gap = 4; // mm clearance from the model
    const major = 10; // 1 cm
    const minor = 5; // half-cm minor ticks
    const tMaj = 3;
    const tMin = 1.5;

    // horizontal ruler (bottom)
    const xMax = Math.max(major, Math.ceil(w / 2 / major) * major);
    const yBar = -h / 2 - gap;
    pts.push(-xMax, yBar, 0, xMax, yBar, 0);
    for (let x = 0; x <= xMax + 0.001; x += minor) {
      const maj = Math.round(x) % major === 0;
      const t = maj ? tMaj : tMin;
      for (const sx of x === 0 ? [0] : [x, -x]) {
        pts.push(sx, yBar, 0, sx, yBar - t, 0);
        if (maj && x > 0)
          labels.push({ pos: [sx, yBar - t - 2.6, 0], text: String(Math.round(x / 10)) });
      }
    }
    labels.push({ pos: [xMax + 5.5, yBar, 0], text: "cm" });

    // vertical ruler (left)
    const yMax = Math.max(major, Math.ceil(h / 2 / major) * major);
    const xBar = -w / 2 - gap;
    pts.push(xBar, -yMax, 0, xBar, yMax, 0);
    for (let y = 0; y <= yMax + 0.001; y += minor) {
      const maj = Math.round(y) % major === 0;
      const t = maj ? tMaj : tMin;
      for (const sy of y === 0 ? [0] : [y, -y]) {
        pts.push(xBar, sy, 0, xBar - t, sy, 0);
        if (maj && y > 0)
          labels.push({ pos: [xBar - t - 3.4, sy, 0], text: String(Math.round(y / 10)) });
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return { geom: g, labels };
  }, [w, h]);

  return (
    <group>
      <lineSegments geometry={geom}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.95} />
      </lineSegments>
      {labels.map((l, i) => (
        <Billboard key={i} position={l.pos}>
          <Text fontSize={3} color="#64748b" anchorX="center" anchorY="middle">
            {l.text}
          </Text>
        </Billboard>
      ))}
    </group>
  );
}

export function NameplateCanvas({
  group,
  size,
  height = 260,
}: {
  group: THREE.Group | null;
  size?: Size;
  height?: number;
}) {
  const [spinning, setSpinning] = useState(true);
  const [ruler, setRuler] = useState(true);
  return (
    <div className="relative">
      <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height }}>
        {/* front view (+z); model is built upright and un-mirrored */}
        <PerspectiveCamera makeDefault position={[0, 6, 120]} fov={30} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[30, 50, 80]} intensity={1.15} />
        <directionalLight position={[-30, -10, 50]} intensity={0.35} />
        {group && (
          <Bounds key={`${group.uuid}-${ruler ? "r" : "n"}`} fit clip observe margin={1.2}>
            <primitive object={group} />
            {ruler && size && <Ruler w={size.w} h={size.h} />}
          </Bounds>
        )}
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={false}
          autoRotate={spinning}
          autoRotateSpeed={1.4}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={(3 * Math.PI) / 4}
        />
      </Canvas>
      <button
        type="button"
        onClick={() => setRuler((r) => !r)}
        className="absolute left-2 top-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:text-foreground"
      >
        {ruler ? "📏 ซ่อนไม้บรรทัด" : "📏 ไม้บรรทัด"}
      </button>
      <button
        type="button"
        onClick={() => setSpinning((s) => !s)}
        className="absolute right-2 top-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:text-foreground"
      >
        {spinning ? "⏸ หยุดหมุน" : "↻ หมุน"}
      </button>
    </div>
  );
}
