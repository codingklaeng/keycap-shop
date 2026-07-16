"use client";

import type { CSSProperties } from "react";
import type { BaseShape } from "@/lib/types";

export type PreviewLetter = { char: string; key: string; text: string };

// Silhouette of the base plate per shape (applied via border-radius / clip-path).
function shapeStyle(shape: BaseShape): CSSProperties {
  switch (shape) {
    case "circle":
      return { borderRadius: "9999px" };
    case "hexagon":
      return { clipPath: "polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)" };
    case "octagon":
      return {
        clipPath:
          "polygon(30% 0%,70% 0%,100% 30%,100% 70%,70% 100%,30% 100%,0% 70%,0% 30%)",
      };
    default:
      return { borderRadius: "0.75rem" }; // rounded_square
  }
}

function pendantEmoji(name: string | null, image: string | null): string | null {
  if (!name || name.includes("ไม่มี")) return null;
  if (image) return null; // image handled separately
  if (name.includes("หัวใจ")) return "❤️";
  if (name.includes("ดาว")) return "⭐";
  if (name.includes("กระดิ่ง")) return "🔔";
  return "🧷";
}

/** Live 2D mockup of the keycap keychain built from the current selection. */
export function KeycapPreview({
  letters,
  baseColor,
  layout,
  shape,
  pendantName,
  pendantImage,
}: {
  letters: PreviewLetter[];
  baseColor: string | null;
  layout: "horizontal" | "vertical";
  shape: BaseShape;
  pendantName: string | null;
  pendantImage: string | null;
}) {
  const ghost = letters.length === 0;
  const shown: PreviewLetter[] = ghost
    ? ["A", "B", "C"].map((c) => ({ char: c, key: "#d1d5db", text: "#9ca3af" }))
    : letters;
  const plate = baseColor ?? "#e5e7eb";
  const emoji = pendantEmoji(pendantName, pendantImage);

  // keycap size shrinks a little when there are many, to fit
  const size = shown.length > 5 ? 30 : 36;

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="flex flex-col items-center">
        {/* keyring */}
        <div className="h-4 w-4 rounded-full border-[3px] border-gray-400" />
        <div className="h-1.5 w-1 bg-gray-400" />

        {/* base plate holding the keycaps */}
        <div
          className={`flex max-w-[260px] items-center gap-1 shadow-inner ${
            shape === "rounded_square" ? "overflow-x-auto" : ""
          } ${shape === "rounded_square" ? "p-2" : "px-5 py-4"}`}
          style={{
            background: plate,
            boxShadow: "inset 0 1px 2px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.12)",
            ...shapeStyle(shape),
          }}
        >
          <div
            className={`flex gap-1 ${
              layout === "vertical" ? "flex-col" : "flex-row"
            }`}
          >
            {shown.map((l, i) => (
              <span
                key={i}
                className="relative flex items-center justify-center rounded-md font-bold"
                style={{
                  width: size,
                  height: size,
                  background: l.key,
                  color: l.text,
                  fontSize: size * 0.5,
                  boxShadow:
                    "0 1px 2px rgba(0,0,0,.3), inset 0 -2px 2px rgba(0,0,0,.18)",
                }}
              >
                {/* top gloss */}
                <span
                  className="pointer-events-none absolute inset-x-0.5 top-0.5 rounded-t-md"
                  style={{
                    height: size * 0.34,
                    background:
                      "linear-gradient(rgba(255,255,255,.4), rgba(255,255,255,0))",
                  }}
                />
                <span className="relative">{l.char}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* pendant charm */}
      {(emoji || pendantImage) && (
        <div className="flex flex-col items-center">
          <div className="h-3 w-px bg-gray-400" />
          {pendantImage ? (
            <span
              className="h-9 w-9 rounded-full border border-border bg-cover bg-center"
              style={{ backgroundImage: `url(${pendantImage})` }}
            />
          ) : (
            <span className="text-2xl">{emoji}</span>
          )}
        </div>
      )}
    </div>
  );
}
