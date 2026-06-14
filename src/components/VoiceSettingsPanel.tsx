"use client";

import { useEffect, useState } from "react";
import {
  getVoiceSettings,
  setVoiceSettings,
  listVoices,
  testVoice,
  type VoiceSettings,
} from "@/lib/announce";

export function VoiceSettingsPanel({ onClose }: { onClose: () => void }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [s, setS] = useState<VoiceSettings>(() => getVoiceSettings());

  useEffect(() => {
    const upd = () => setVoices(listVoices());
    upd();
    window.speechSynthesis?.addEventListener?.("voiceschanged", upd);
    return () =>
      window.speechSynthesis?.removeEventListener?.("voiceschanged", upd);
  }, []);

  function update(p: Partial<VoiceSettings>) {
    setS(setVoiceSettings(p));
  }

  // Thai voices first, then the rest
  const sorted = [...voices].sort((a, b) => {
    const ta = a.lang?.toLowerCase().startsWith("th") ? 0 : 1;
    const tb = b.lang?.toLowerCase().startsWith("th") ? 0 : 1;
    return ta - tb || a.name.localeCompare(b.name);
  });

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">ตั้งค่าเสียงเรียกคิว</h2>
        <button onClick={onClose} className="text-sm text-muted">
          ปิด ✕
        </button>
      </div>

      <label className="mb-1 block text-sm text-muted">เสียง</label>
      <select
        value={s.voiceURI ?? ""}
        onChange={(e) => update({ voiceURI: e.target.value || null })}
        className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">อัตโนมัติ (เสียงไทยในเครื่อง)</option>
        {sorted.map((v) => (
          <option key={v.voiceURI} value={v.voiceURI}>
            {v.name} ({v.lang})
          </option>
        ))}
      </select>
      {voices.length === 0 && (
        <p className="mb-3 text-xs text-amber-700">
          เครื่องนี้ยังไม่พบรายชื่อเสียง — ลองกดทดสอบหรือเปิดบนเครื่องที่จะใช้จริง
        </p>
      )}

      <label className="mb-1 block text-sm text-muted">
        ความเร็ว: {s.rate.toFixed(2)}×
      </label>
      <input
        type="range"
        min={0.5}
        max={1.5}
        step={0.05}
        value={s.rate}
        onChange={(e) => update({ rate: Number(e.target.value) })}
        className="mb-3 w-full"
      />

      <label className="mb-1 block text-sm text-muted">
        โทนเสียง: {s.pitch.toFixed(1)}
      </label>
      <input
        type="range"
        min={0}
        max={2}
        step={0.1}
        value={s.pitch}
        onChange={(e) => update({ pitch: Number(e.target.value) })}
        className="mb-4 w-full"
      />

      <label className="mb-1 block text-sm text-muted">
        คำลงท้าย (ให้เข้ากับเสียง)
      </label>
      <div className="mb-4 flex gap-2">
        {[
          { v: "ค่ะ", label: "ค่ะ (หญิง)" },
          { v: "ครับ", label: "ครับ (ชาย)" },
          { v: "", label: "ไม่มี" },
        ].map((o) => (
          <button
            key={o.v}
            onClick={() => update({ particle: o.v })}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              s.particle === o.v
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={testVoice}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          🔈 ทดสอบเสียง
        </button>
        <button
          onClick={() => update({ voiceURI: null, rate: 0.95, pitch: 1, particle: "ค่ะ" })}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted"
        >
          รีเซ็ต
        </button>
      </div>
    </div>
  );
}
