"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/items-actions";

export function ImageUpload({
  folder,
  initialUrl,
  name = "image_url",
}: {
  folder: string;
  initialUrl?: string | null;
  name?: string;
}) {
  const [url, setUrl] = useState<string>(initialUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("folder", folder);
      const u = await uploadImage(fd);
      setUrl(u);
    } catch {
      alert("อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={url} />
      <div
        className="h-12 w-12 shrink-0 rounded-lg border border-border bg-background bg-cover bg-center"
        style={{ backgroundImage: url ? `url(${url})` : undefined }}
      />
      <label className="cursor-pointer rounded-lg border border-border px-2 py-1 text-xs text-muted hover:text-foreground">
        {busy ? "กำลังอัป..." : url ? "เปลี่ยนรูป" : "อัปโหลดรูป"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onPick}
          disabled={busy}
        />
      </label>
      {url && (
        <button
          type="button"
          onClick={() => setUrl("")}
          className="text-xs text-red-500"
        >
          ลบ
        </button>
      )}
    </div>
  );
}
