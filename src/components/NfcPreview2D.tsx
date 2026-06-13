"use client";

export type NfcPreviewProps = {
  name: string | null;
  icon: string | null;
  imageUrl: string | null;
  brandColor: string | null;
  value: string;
};

// Lightweight 2D fallback shown while the 3D scene loads (or if WebGL fails).
export function NfcPreview2D({ name, icon, imageUrl, value }: NfcPreviewProps) {
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      {/* tag */}
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-gray-400" />
        <div className="flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card shadow">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <span className="text-2xl">{icon ?? "🔗"}</span>
          )}
          <span className="max-w-[56px] truncate text-[9px] text-muted">
            {value || name || ""}
          </span>
        </div>
      </div>
      {/* tap */}
      <div className="text-2xl">📲</div>
    </div>
  );
}
