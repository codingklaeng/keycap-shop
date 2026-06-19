"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { buildNameplate, type NameplateSpec } from "@/lib/nameplate";
import { NameplateControls } from "@/components/NameplateControls";
import { saveNameplateSpec } from "@/lib/admin-actions";
import { DownloadStlButton } from "@/components/DownloadStlButton";

const NameplateCanvas = dynamic(
  () => import("@/components/NameplateCanvas").then((m) => m.NameplateCanvas),
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

// Admin editor: tweak a placed nameplate order's design for print suitability,
// using the very same controls + 3D preview the customer designs with.
export function NameplateEditorModal({
  orderId,
  queueNumber,
  initialSpec,
  onClose,
  onSaved,
}: {
  orderId: string;
  queueNumber: string;
  initialSpec: NameplateSpec;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [spec, setSpec] = useState<NameplateSpec>(initialSpec);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [size, setSize] = useState({ w: 40, h: 20, d: 7 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  function set<K extends keyof NameplateSpec>(k: K, v: NameplateSpec[K]) {
    setSpec((s) => ({ ...s, [k]: v }));
  }

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await buildNameplate(spec);
        if (!alive) {
          disposeGroup(r.group);
          return;
        }
        disposeGroup(groupRef.current);
        groupRef.current = r.group;
        setGroup(r.group);
        setSize(r.sizeMM);
      } catch (e) {
        if (alive) setError(String(e));
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [spec]);

  async function save() {
    setError(null);
    if (!spec.text.trim()) {
      setError("ข้อความห้ามว่าง");
      return;
    }
    setSaving(true);
    try {
      await saveNameplateSpec(orderId, spec, spec.text.trim());
      onSaved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50" onClick={onClose}>
      <div
        className="mx-auto mt-4 flex max-h-[94vh] w-full max-w-lg flex-1 flex-col overflow-hidden rounded-2xl bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="text-sm font-medium">แก้ไขแบบ · คิว {queueNumber}</div>
          <button onClick={onClose} className="text-sm text-muted">
            ✕ ปิด
          </button>
        </header>

        <div className="relative border-b border-border">
          <NameplateCanvas group={group} size={size} height={200} />
          <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted">
            {size.w.toFixed(0)}×{size.h.toFixed(0)}×{size.d.toFixed(0)} มม.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <NameplateControls spec={spec} set={set} />
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-4 py-3">
          {group && (
            <DownloadStlButton spec={spec} filename={`${queueNumber}-${spec.text}.stl`} />
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted">
            ยกเลิก
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกแบบ"}
          </button>
        </footer>
      </div>
    </div>
  );
}
