/**
 * Tiny WebAudio sound module. Synthesises short UI tones on demand — no
 * external assets, no bundle weight. Off by default; the toggle persists in
 * localStorage so it survives reloads. Lazily initialises the AudioContext
 * on first play to satisfy browsers' autoplay-suspend rules.
 */
export type SoundName = "plant" | "harvest" | "build" | "money";

const STORAGE_KEY = "smallholding.audio";

let ctx: AudioContext | null = null;
let enabled = false;
let hydrated = false;

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  enabled = window.localStorage.getItem(STORAGE_KEY) === "on";
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor: typeof AudioContext = (window as any).AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isAudioEnabled(): boolean {
  hydrate();
  return enabled;
}

export function setAudioEnabled(on: boolean): void {
  hydrate();
  enabled = on;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  }
}

export function playSound(name: SoundName): void {
  hydrate();
  if (!enabled) return;
  const ac = ensureCtx();
  if (!ac) return;
  switch (name) {
    case "plant":
      blip(ac, [180, 220], "square", 0.06, 80);
      break;
    case "harvest":
      chord(ac, [660, 880, 1100], "triangle", 0.05, 180);
      break;
    case "build":
      blip(ac, [110, 60], "sine", 0.08, 120);
      break;
    case "money":
      blip(ac, [600, 900], "triangle", 0.05, 110);
      break;
  }
}

// --- Synth primitives -------------------------------------------------------
function blip(ac: AudioContext, freqs: number[], type: OscillatorType, gain: number, durationMs: number): void {
  const now = ac.currentTime;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
  g.connect(ac.destination);
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freqs[0], now);
    o.frequency.linearRampToValueAtTime(f, now + ((i + 1) / freqs.length) * (durationMs / 1000));
    o.connect(g);
    o.start(now);
    o.stop(now + durationMs / 1000 + 0.02);
  });
}

function chord(ac: AudioContext, freqs: number[], type: OscillatorType, gainEach: number, durationMs: number): void {
  const now = ac.currentTime;
  for (const f of freqs) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gainEach, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    g.connect(ac.destination);
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(g);
    o.start(now);
    o.stop(now + durationMs / 1000 + 0.02);
  }
}
