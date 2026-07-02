"use client";

import { useEffect, useRef, useState } from "react";

const EMOJI_CATEGORIES: { label: string; emojis: string }[] = [
  { label: "หัวใจ & ดาว", emojis: "❤️🧡💛💚💙💜🖤🤍🤎💕💞💓💗💖💘💝💟✨⭐🌟💫⚡" },
  { label: "หน้า", emojis: "😀😁😂🤣😊😍🥰😘😜😎🥳😇🙂🙃😉🥲😢😭😡🥺😴🤔😋🤩" },
  { label: "มือ", emojis: "👍👎👏🙌🤝🙏✋🤚🖐️✌️🤟🤙👌💪🫶👋🤳" },
  { label: "สัตว์", emojis: "🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦄🐝🐢🐬" },
  { label: "ธรรมชาติ", emojis: "☀️🌙⭐☁️🌈❄️🔥💧🌊🌸🌷🌹🌻🌼🍀🌿🌴🌵🍂" },
  { label: "อาหาร", emojis: "🍎🍊🍋🍉🍇🍓🍒🍑🍍🥝🍕🍔🍟🌭🍩🍪🍰🎂🍫🍬☕🧋" },
  { label: "กิจกรรม/ของใช้", emojis: "⚽🏀🎈🎉🎁🎵🎶🚗✈️🚀⏰📷💡💎👑🎀💍🔑🎯🏆📚🎮" },
  { label: "สัญลักษณ์", emojis: "✅❌💯🔥💥💤🆗🚫⚠️♻️🔔💬👑🔞∞" },
];

// Emoji picker button + popover, categorized for quick scanning. Inserts the
// chosen emoji at the current caret position of the given text input.
export function EmojiPicker({
  inputRef,
  value,
  onChange,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointer(e: PointerEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  function insert(emoji: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    // restore focus + caret after the inserted emoji (after React re-renders)
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + emoji.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="แทรกอิโมจิ"
        aria-label="แทรกอิโมจิ"
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-lg transition ${
          open ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary"
        }`}
      >
        🙂
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-20 mt-2 max-h-72 w-72 max-w-[85vw] overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-lg sm:w-80"
        >
          {EMOJI_CATEGORIES.map((cat) => (
            <div key={cat.label} className="mb-3 last:mb-0">
              <div className="mb-1.5 text-xs font-medium text-muted">{cat.label}</div>
              <div className="grid grid-cols-7 gap-1 sm:grid-cols-8">
                {Array.from(cat.emojis).map((em, i) => (
                  <button
                    key={`${cat.label}-${i}`}
                    type="button"
                    onClick={() => insert(em)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none transition hover:bg-background"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
