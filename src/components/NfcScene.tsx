"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

export type NfcSceneProps = {
  name: string | null;
  icon: string | null;
  imageUrl: string | null;
  value: string;
};

const PRIMARY = "#6d28d9";

// A texture that shows the emoji immediately and swaps to the uploaded image
// once it loads (CORS-permitting). Falls back gracefully to the emoji.
function usePlatformTexture(url: string | null, emoji: string | null) {
  const obj = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const draw = (em: string | null) => {
      ctx.clearRect(0, 0, 256, 256);
      if (em) {
        ctx.font = "150px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(em, 128, 138);
      }
    };
    draw(emoji ?? "🔗");
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return { c, ctx, t };
  }, [emoji]);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        obj.ctx.clearRect(0, 0, 256, 256);
        const s = 200;
        obj.ctx.drawImage(img, 28, 28, s, s);
        obj.t.needsUpdate = true;
      } catch {
        /* tainted canvas — keep emoji */
      }
    };
    img.src = url;
    return () => {
      img.onload = null;
    };
  }, [url, obj]);

  useEffect(() => () => obj.t.dispose(), [obj]);
  return obj.t;
}

function Model({ name, icon, imageUrl, value }: NfcSceneProps) {
  const iconTex = usePlatformTexture(imageUrl, icon);
  const screenIconTex = usePlatformTexture(imageUrl, icon);

  const phone = useRef<THREE.Group>(null);
  const idle = useRef<THREE.Group>(null);
  const app = useRef<THREE.Group>(null);
  const ripples = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  const CYCLE = 3.6;

  useFrame((state) => {
    const t = state.clock.elapsedTime % CYCLE;
    const p = t / CYCLE;

    // phone X: 1.9 (rest) -> 0.35 (tapping) -> back
    let x = 1.9;
    if (p < 0.3) x = 1.9 - (1.9 - 0.35) * easeOut(p / 0.3);
    else if (p < 0.82) x = 0.35;
    else x = 0.35 + (1.9 - 0.35) * easeIn((p - 0.82) / 0.18);
    if (phone.current) {
      phone.current.position.x = x;
      phone.current.position.y = -0.1 + Math.sin(state.clock.elapsedTime * 1.6) * 0.05;
      phone.current.rotation.y = -0.45;
    }

    const opened = p >= 0.32 && p < 0.85;
    if (idle.current) idle.current.visible = !opened;
    if (app.current) app.current.visible = opened;

    // NFC ripples during tap
    ripples.forEach((r, i) => {
      const m = r.current;
      if (!m) return;
      if (!opened) {
        m.visible = false;
        return;
      }
      const local = ((t - 0.32 + i * 0.35) % 1.2) / 1.2;
      m.visible = true;
      const sc = 0.25 + local * 1.3;
      m.scale.set(sc, sc, sc);
      (m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.5 * (1 - local));
    });
  });

  return (
    <group>
      {/* ---- NFC tag (left) ---- */}
      <group position={[-1.6, 0, 0]}>
        {/* keyring */}
        <mesh position={[0, 1.15, 0]}>
          <torusGeometry args={[0.16, 0.05, 12, 24]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.25} />
        </mesh>
        {/* card */}
        <RoundedBox args={[1.4, 1.7, 0.14]} radius={0.12} smoothness={4}>
          <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.05} />
        </RoundedBox>
        {/* icon on the tag */}
        <mesh position={[0, 0.18, 0.08]}>
          <planeGeometry args={[0.85, 0.85]} />
          <meshBasicMaterial map={iconTex} transparent />
        </mesh>
        {/* handle / name */}
        <TagLabel text={value || name || ""} />
        {/* ripples emitted from the tag toward the phone */}
        {ripples.map((r, i) => (
          <mesh key={i} ref={r} position={[0.85, 0.18, 0.1]} rotation={[0, Math.PI / 2, 0]} visible={false}>
            <ringGeometry args={[0.34, 0.4, 24]} />
            <meshBasicMaterial color={PRIMARY} transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>

      {/* ---- Phone (right, animated) ---- */}
      <group ref={phone} position={[1.9, -0.1, 0.4]}>
        <RoundedBox args={[1.05, 2.0, 0.12]} radius={0.14} smoothness={4}>
          <meshStandardMaterial color="#1f2937" roughness={0.4} metalness={0.3} />
        </RoundedBox>

        {/* idle screen */}
        <group ref={idle} position={[0, 0, 0.07]}>
          <mesh>
            <planeGeometry args={[0.86, 1.78]} />
            <meshBasicMaterial color="#0b1220" />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.4, 0.05]} />
            <meshBasicMaterial color="#475569" />
          </mesh>
        </group>

        {/* app screen (opened) */}
        <group ref={app} position={[0, 0, 0.07]} visible={false}>
          <mesh>
            <planeGeometry args={[0.86, 1.78]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          {/* app header bar */}
          <mesh position={[0, 0.8, 0.01]}>
            <planeGeometry args={[0.86, 0.22]} />
            <meshBasicMaterial color={PRIMARY} />
          </mesh>
          {/* app icon */}
          <mesh position={[0, 0.1, 0.02]}>
            <planeGeometry args={[0.6, 0.6]} />
            <meshBasicMaterial map={screenIconTex} transparent />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function TagLabel({ text }: { text: string }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const t = (text || "").slice(0, 16);
    ctx.fillText(t, 256, 70);
    const tx = new THREE.CanvasTexture(c);
    tx.anisotropy = 8;
    return tx;
  }, [text]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={[0, -0.5, 0.08]}>
      <planeGeometry args={[1.1, 0.28]} />
      <meshBasicMaterial map={tex} transparent />
    </mesh>
  );
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x;

export function NfcScene(props: NfcSceneProps) {
  return (
    <Canvas dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} style={{ height: 190 }}>
      <PerspectiveCamera makeDefault position={[0.3, 0.5, 6.4]} fov={32} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 6]} intensity={1.1} />
      <directionalLight position={[-4, -1, 3]} intensity={0.3} />
      <Model {...props} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={(2 * Math.PI) / 3}
      />
    </Canvas>
  );
}
