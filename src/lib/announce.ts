// Voice queue announcements for the shop board (plays through whatever audio
// output the device uses — e.g. a Bluetooth speaker). Browser-only.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

// two-tone attention chime
function chime() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1175].forEach((freq, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = "sine";
    o.frequency.value = freq;
    const t = now + i * 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.start(t);
    o.stop(t + 0.34);
  });
}

// ---- adjustable voice settings (persisted) ----
export type VoiceSettings = {
  voiceURI: string | null;
  rate: number;
  pitch: number;
  particle: string; // คำลงท้าย: "ค่ะ" | "ครับ" | ""
};
const SETTINGS_KEY = "keycap_voice";
const DEFAULT_SETTINGS: VoiceSettings = {
  voiceURI: null,
  rate: 0.95,
  pitch: 1,
  particle: "ค่ะ",
};

export function getVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const r = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      voiceURI: r.voiceURI ?? null,
      rate: typeof r.rate === "number" ? r.rate : DEFAULT_SETTINGS.rate,
      pitch: typeof r.pitch === "number" ? r.pitch : DEFAULT_SETTINGS.pitch,
      particle: typeof r.particle === "string" ? r.particle : DEFAULT_SETTINGS.particle,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setVoiceSettings(p: Partial<VoiceSettings>): VoiceSettings {
  const next = { ...getVoiceSettings(), ...p };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const s = getVoiceSettings();
  const voices = window.speechSynthesis.getVoices();
  let voice: SpeechSynthesisVoice | null = null;
  if (s.voiceURI) voice = voices.find((v) => v.voiceURI === s.voiceURI) ?? null;
  if (!voice) voice = voices.find((v) => v.lang?.toLowerCase().startsWith("th")) ?? null;

  const u = new SpeechSynthesisUtterance(text);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = "th-TH";
  }
  u.rate = s.rate;
  u.pitch = s.pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/** Speak a sample using the current settings (for the settings panel). */
export function testVoice() {
  chime();
  const p = getVoiceSettings().particle;
  window.setTimeout(
    () => speak(`ทดสอบเสียงเรียกคิว เชิญคิว เอ หนึ่ง รับสินค้าได้${p}`),
    380
  );
}

// read the queue number digit-by-digit so it's clear (K001 -> "K 0 0 1")
function spell(q: string): string {
  return q.split("").join(" ");
}

/** Chime, then announce the queue number + customer name. */
export function announceQueue(queueNumber: string, name?: string | null) {
  chime();
  const who = name ? ` คุณ ${name}` : "";
  const p = getVoiceSettings().particle;
  const text = `เชิญคิว ${spell(queueNumber)}${who} รับสินค้าได้${p}`;
  // small delay so the chime is heard before speech
  window.setTimeout(() => speak(text), 380);
}

/** Call once on a user gesture to unlock audio + confirm it works. */
export function primeAudio() {
  getCtx();
  listVoices(); // warm up the voices list
  speak("เปิดเสียงเรียกคิวแล้วค่ะ");
}
