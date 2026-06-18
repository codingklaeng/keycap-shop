"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Bounds } from "@react-three/drei";
import * as THREE from "three";

export function NameplateCanvas({
  group,
  height = 260,
}: {
  group: THREE.Group | null;
  height?: number;
}) {
  const [spinning, setSpinning] = useState(true);
  return (
    <div className="relative">
      <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height }}>
        {/* front view (+z); model is built upright and un-mirrored */}
        <PerspectiveCamera makeDefault position={[0, 6, 120]} fov={30} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[30, 50, 80]} intensity={1.15} />
        <directionalLight position={[-30, -10, 50]} intensity={0.35} />
        {group && (
          <Bounds key={group.uuid} fit clip observe margin={1.2}>
            <primitive object={group} />
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
        onClick={() => setSpinning((s) => !s)}
        className="absolute right-2 top-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted shadow-sm backdrop-blur transition hover:text-foreground"
      >
        {spinning ? "⏸ หยุดหมุน" : "↻ หมุน"}
      </button>
    </div>
  );
}
