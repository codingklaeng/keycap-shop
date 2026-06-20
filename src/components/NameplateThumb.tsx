"use client";

import { useEffect, useState } from "react";
import { nameplateThumbnail, type NameplateSpec } from "@/lib/nameplate";

// cache flat-thumbnail data URLs by spec content so the board (which re-polls
// every few seconds) doesn't regenerate them on every refresh.
const cache = new Map<string, string>();

export function NameplateThumb({
  spec,
  className,
}: {
  spec: NameplateSpec;
  className?: string;
}) {
  const key = JSON.stringify(spec);
  const [url, setUrl] = useState<string | null>(() => cache.get(key) ?? null);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setUrl(cached);
      return;
    }
    let alive = true;
    nameplateThumbnail(JSON.parse(key) as NameplateSpec)
      .then((u) => {
        cache.set(key, u);
        if (alive) setUrl(u);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <div
      className="flex items-center justify-center rounded-lg border border-border p-2"
      style={{
        backgroundColor: "#f8fafc",
        backgroundImage:
          "linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)",
        backgroundSize: "14px 14px",
        backgroundPosition: "0 0,0 7px,7px -7px,-7px 0px",
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="ตัวอย่างป้าย" className={className} />
      ) : (
        <div className={className} />
      )}
    </div>
  );
}
