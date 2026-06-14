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

function pickThaiVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang?.toLowerCase().startsWith("th")) ?? null;
}

function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "th-TH";
  u.rate = 0.95;
  const th = pickThaiVoice();
  if (th) u.voice = th;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// read the queue number digit-by-digit so it's clear (K001 -> "K 0 0 1")
function spell(q: string): string {
  return q.split("").join(" ");
}

/** Chime, then announce the queue number + customer name. */
export function announceQueue(queueNumber: string, name?: string | null) {
  chime();
  const who = name ? ` คุณ ${name}` : "";
  const text = `เชิญคิว ${spell(queueNumber)}${who} รับสินค้าได้ค่ะ`;
  // small delay so the chime is heard before speech
  window.setTimeout(() => speak(text), 380);
}

/** Call once on a user gesture to unlock audio + confirm it works. */
export function primeAudio() {
  getCtx();
  // warm up voices list and confirm aloud
  pickThaiVoice();
  speak("เปิดเสียงเรียกคิวแล้วค่ะ");
}
