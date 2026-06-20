"use client";

import { useState } from "react";
import {
  buildNameplate,
  exportSTL,
  downloadBlob,
  type NameplateSpec,
} from "@/lib/nameplate";

// Regenerates the STL from the stored design spec and downloads it.
export function DownloadStlButton({
  spec,
  filename,
}: {
  spec: NameplateSpec;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          // regenerate at maximum smoothness for the printable file
          const { group } = await buildNameplate(spec, "export");
          downloadBlob(exportSTL(group), filename);
        } catch {
          alert("สร้างไฟล์ STL ไม่สำเร็จ");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
    >
      {busy ? "กำลังสร้าง…" : "⬇️ ดาวน์โหลด STL"}
    </button>
  );
}
