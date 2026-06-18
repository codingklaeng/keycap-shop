"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

export function NameplateCanvas({
  group,
  sizeMM,
  height = 260,
}: {
  group: THREE.Group | null;
  sizeMM: { w: number; h: number; d: number };
  height?: number;
}) {
  const dist = Math.max(sizeMM.w, sizeMM.h, 20) * 1.5 + 25;
  return (
    <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height }}>
      {/* text faces -z after the upright flip, so view from -z */}
      <PerspectiveCamera makeDefault position={[0, 0, -dist]} fov={32} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[-30, 40, -80]} intensity={1.15} />
      <directionalLight position={[30, -20, -40]} intensity={0.35} />
      {group && <primitive object={group} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={1.3}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />
    </Canvas>
  );
}
