"use client";

import { useEffect, useState, type ComponentType } from "react";
import { NfcPreview2D, type NfcPreviewProps } from "@/components/NfcPreview2D";

// Loads the three.js NFC scene on the client only; shows the 2D preview while
// it loads and as a fallback if the import/WebGL fails.
export function NfcPreview3D(props: NfcPreviewProps) {
  const [Scene, setScene] = useState<ComponentType<NfcPreviewProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ok = true;
    import("@/components/NfcScene")
      .then((m) => {
        if (ok) setScene(() => m.NfcScene);
      })
      .catch(() => {
        if (ok) setFailed(true);
      });
    return () => {
      ok = false;
    };
  }, []);

  if (failed || !Scene) return <NfcPreview2D {...props} />;
  return <Scene {...props} />;
}
