"use client";

import { useState } from "react";

export function CopyButton({ text, label = "คัดลอก" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore
        }
      }}
      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
        copied ? "border-green-400 text-green-600" : "border-primary text-primary"
      }`}
    >
      {copied ? "คัดลอกแล้ว ✓" : label}
    </button>
  );
}
