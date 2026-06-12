"use client";

import { useEffect, useState, type ComponentType } from "react";
import { KeycapPreview, type PreviewLetter } from "@/components/KeycapPreview";

type Props = {
  letters: PreviewLetter[];
  baseColor: string | null;
  layout: "horizontal" | "vertical";
  pendantName: string | null;
  pendantImage: string | null;
};

// Loads the heavy three.js scene on the client only, showing the lightweight
// 2D mockup until it's ready (and as a fallback if WebGL/import fails).
export function KeycapPreview3D(props: Props) {
  const [Scene, setScene] = useState<ComponentType<Props> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ok = true;
    import("@/components/KeycapScene")
      .then((m) => {
        if (ok) setScene(() => m.KeycapScene);
      })
      .catch(() => {
        if (ok) setFailed(true);
      });
    return () => {
      ok = false;
    };
  }, []);

  if (failed || !Scene) {
    return (
      <KeycapPreview
        letters={props.letters}
        baseColor={props.baseColor}
        layout={props.layout}
        pendantName={props.pendantName}
        pendantImage={props.pendantImage}
      />
    );
  }
  return <Scene {...props} />;
}
