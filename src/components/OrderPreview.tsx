"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { buildNameplate, type NameplateSpec } from "@/lib/nameplate";
import type { PreviewLetter } from "@/components/KeycapPreview";
import type { OrderDetail } from "@/lib/types";

const NameplateCanvas = dynamic(
  () => import("@/components/NameplateCanvas").then((m) => m.NameplateCanvas),
  { ssr: false }
);
const KeycapScene = dynamic(
  () => import("@/components/KeycapScene").then((m) => m.KeycapScene),
  { ssr: false }
);
const NfcScene = dynamic(
  () => import("@/components/NfcScene").then((m) => m.NfcScene),
  { ssr: false }
);

function disposeGroup(g: THREE.Object3D | null) {
  g?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat.dispose();
    }
  });
}

// Rebuilds the nameplate 3D model from its stored spec (same preview the
// customer designed with) so they can compare it against the physical piece.
function NameplatePreview({ spec }: { spec: NameplateSpec }) {
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [size, setSize] = useState({ w: 40, h: 20, d: 7 });
  const ref = useRef<THREE.Group | null>(null);
  // The tracking page re-polls and hands us a fresh spec object every few
  // seconds; key the rebuild on the spec *content* so we don't regenerate the
  // 3D model (and flicker) when nothing actually changed.
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    let alive = true;
    buildNameplate(JSON.parse(specKey) as NameplateSpec)
      .then((r) => {
        if (!alive) {
          disposeGroup(r.group);
          return;
        }
        disposeGroup(ref.current);
        ref.current = r.group;
        setGroup(r.group);
        setSize(r.sizeMM);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [specKey]);

  useEffect(() => () => disposeGroup(ref.current), []);

  return (
    <div className="relative">
      <NameplateCanvas group={group} size={size} height={200} />
      <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted">
        {size.w.toFixed(0)}×{size.h.toFixed(0)}×{size.d.toFixed(0)} มม.
      </span>
    </div>
  );
}

// Product preview shown at the top of the customer's order-tracking page so they
// have a visual reference of what they ordered when collecting it.
export function OrderPreview({ order }: { order: OrderDetail }) {
  if (order.product_type === "nameplate") {
    if (!order.nameplate) return null;
    return <NameplatePreview spec={order.nameplate.spec as unknown as NameplateSpec} />;
  }

  if (order.product_type === "nfc") {
    return (
      <NfcScene
        name={order.nfc?.platform ?? null}
        icon={order.nfc?.icon ?? null}
        imageUrl={order.nfc?.image ?? null}
        brandColor={null}
        value={order.nfc?.value ?? order.text}
      />
    );
  }

  const letters: PreviewLetter[] = order.letters.map((l) => ({
    char: l.char,
    key: l.color?.key_color ?? "#888888",
    text: l.color?.text_color ?? "#ffffff",
  }));
  return (
    <KeycapScene
      letters={letters}
      baseColor={order.base_color?.swatch ?? null}
      layout={order.layout ?? "horizontal"}
      pendantName={order.pendant?.name ?? null}
      pendantImage={null}
    />
  );
}
