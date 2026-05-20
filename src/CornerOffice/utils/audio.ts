// Corner Office SFX + corporate elevator-muzak ambient.
//
// Muzak phrasing: cheerful F major office-elevator bloop punctuated by a
// 3-5s breath (per the "no continuous drone even at low volume" rule). The
// jaunty melody under a burnout-themed climb IS the joke.

let ctx: AudioContext | null = null;
function ac(): AudioContext {
  if (!ctx) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx!;
}

export function unlockAudio() {
  try {
    const c = ac();
    if (c.state === 'suspended') c.resume().catch(() => {});
  } catch { /* ignore */ }
}

function tone(freq: number, dur: number, peak: number, type: OscillatorType = 'sine', filterHz?: number) {
  try {
    const c = ac();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let last: AudioNode = o;
    if (filterHz) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filterHz;
      o.connect(lp);
      last = lp;
    }
    last.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + dur + 0.04);
  } catch { /* ignore */ }
}

function sweep(fStart: number, fEnd: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  try {
    const c = ac();
    const now = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(fStart, now);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), now + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(c.destination);
    o.start(now);
    o.stop(now + dur + 0.04);
  } catch { /* ignore */ }
}

function noise(dur: number, peak: number, hp: number) {
  try {
    const c = ac();
    const now = c.currentTime;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const hpf = c.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hp;
    const g = c.createGain();
    g.gain.value = peak;
    src.connect(hpf).connect(g).connect(c.destination);
    src.start(now);
  } catch { /* ignore */ }
}

/** Soft pip on every normal bounce. Quiet so it doesn't fatigue. */
export function sfxBounce() {
  tone(520, 0.08, 0.05, 'triangle', 2400);
}

/** Spring — kombucha tap pop. Bright cartoon "boing". */
export function sfxSpring() {
  sweep(280, 1100, 0.18, 0.12, 'triangle');
  tone(1300, 0.08, 0.05, 'sine');
}

/** Latte pickup — coin-ish bright two-tone. */
export function sfxLatte() {
  tone(880, 0.06, 0.08, 'square');
  setTimeout(() => tone(1320, 0.10, 0.07, 'square'), 50);
}

/** Vest pickup — heavier "armor up" thunk. */
export function sfxVest() {
  tone(220, 0.10, 0.10, 'sawtooth', 800);
  setTimeout(() => tone(440, 0.14, 0.10, 'triangle'), 40);
}

/** Adderall pickup — punchy upward zip. */
export function sfxAdderall() {
  sweep(440, 1800, 0.20, 0.10, 'square');
}

/** Burnout hit — angry buzz + low thud. */
export function sfxBurnout() {
  sweep(380, 80, 0.32, 0.18, 'sawtooth');
  noise(0.20, 0.12, 600);
}

/** Game over — sad trombone (lifted from the parody-series family). */
export function sfxGameOver() {
  try {
    const c = ac();
    const now = c.currentTime;
    tone(80, 0.10, 0.14, 'sawtooth');
    tone(58, 0.12, 0.08, 'sine');
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(392, now + 0.06);
    o.frequency.exponentialRampToValueAtTime(262, now + 0.28);
    o.frequency.exponentialRampToValueAtTime(220, now + 0.46);
    const lfo = c.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(o.frequency);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, now + 0.06);
    g.gain.linearRampToValueAtTime(0.16, now + 0.10);
    g.gain.setValueAtTime(0.14, now + 0.38);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    o.connect(lp).connect(g).connect(c.destination);
    o.start(now + 0.06);
    o.stop(now + 0.62);
    lfo.start(now + 0.06);
    lfo.stop(now + 0.62);
  } catch { /* ignore */ }
}

/** Top-floor fanfare — ominous "you made it (it's a coffin)" three-chord stab. */
export function sfxCleared() {
  // Minor 6-3-1 cadence on E minor — triumphant but tilted.
  const ts = [
    [330, 0.20, 0.12], [392, 0.24, 0.10], [494, 0.36, 0.10],
  ] as Array<[number, number, number]>;
  ts.forEach(([f, d, p], i) => setTimeout(() => tone(f, d, p, 'triangle'), i * 180));
  // Low organ underneath
  setTimeout(() => tone(82, 1.0, 0.10, 'sawtooth', 600), 0);
}

// ─── Ambient elevator-muzak phrases ───────────────────────────────────

function nHz(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }
const N: Record<string, number> = {
  C3: 48, F3: 53, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, E4: 64, F4: 65,
  G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, E5: 76, F5: 77, G5: 79,
};

interface Note { midi: number; beat: number; dur: number; gain?: number }
interface Phrase { melody: Note[]; bass: Note[]; beats: number; tempoBpm: number }

function bass(bars: Array<[number, number]>): Note[] {
  return bars.flatMap(([root, fifth], i) => [
    { midi: root,  beat: i * 2,     dur: 0.45, gain: 0.08 },
    { midi: fifth, beat: i * 2 + 1, dur: 0.45, gain: 0.06 },
  ]);
}

// F-major "elevator hold" — placid four-bar lounge.
const PHRASE_A: Phrase = {
  beats: 8,
  tempoBpm: 96,
  melody: [
    { midi: N.F4, beat: 0, dur: 0.75 },
    { midi: N.A4, beat: 0.75, dur: 0.5 },
    { midi: N.C5, beat: 1.25, dur: 0.75 },
    { midi: N.A4, beat: 2, dur: 1.0 },
    { midi: N.G4, beat: 3, dur: 0.5 },
    { midi: N.A4, beat: 3.5, dur: 0.5 },
    { midi: N.Bb4, beat: 4, dur: 0.5 },
    { midi: N.C5, beat: 4.5, dur: 1.0 },
    { midi: N.A4, beat: 5.5, dur: 0.5 },
    { midi: N.G4, beat: 6, dur: 0.5 },
    { midi: N.F4, beat: 6.5, dur: 1.5 },
  ],
  bass: bass([
    [N.F3 - 12, N.C4 - 12],
    [N.Bb3 - 12, N.F4 - 12],
    [N.C4 - 12, N.G4 - 12],
    [N.F3 - 12, N.C4 - 12],
  ]),
};

// A-minor "second-floor variation" — minor tilt as floors rise.
const PHRASE_B: Phrase = {
  beats: 8,
  tempoBpm: 96,
  melody: [
    { midi: N.A4, beat: 0, dur: 0.75 },
    { midi: N.C5, beat: 0.75, dur: 0.5 },
    { midi: N.E5, beat: 1.25, dur: 0.75 },
    { midi: N.D5, beat: 2, dur: 1.0 },
    { midi: N.C5, beat: 3, dur: 0.5 },
    { midi: N.Bb4, beat: 3.5, dur: 0.5 },
    { midi: N.A4, beat: 4, dur: 1.0 },
    { midi: N.G4, beat: 5, dur: 0.5 },
    { midi: N.E4, beat: 5.5, dur: 0.5 },
    { midi: N.F4, beat: 6, dur: 0.5 },
    { midi: N.A4, beat: 6.5, dur: 1.5 },
  ],
  bass: bass([
    [N.A3 - 12, N.E4 - 12],
    [N.F3 - 12, N.C4 - 12],
    [N.G3 - 12, N.D4 - 12],
    [N.A3 - 12, N.E4 - 12],
  ]),
};

const PHRASES: Phrase[] = [PHRASE_A, PHRASE_B];

function scheduleNote(c: AudioContext, freq: number, start: number, duration: number, peak: number, type: OscillatorType, filterHz?: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.linearRampToValueAtTime(peak, start + 0.020);
  g.gain.setValueAtTime(peak, start + duration * 0.65);
  g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  let last: AudioNode = o;
  if (filterHz) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = filterHz;
    o.connect(lp);
    last = lp;
  }
  last.connect(g).connect(c.destination);
  o.start(start);
  o.stop(start + duration + 0.05);
}

let ambientStop: (() => void) | null = null;
export function startAmbient() {
  stopAmbient();
  let alive = true;
  const c = ac();
  let nextTimer: number | null = null;
  let idx = Math.floor(Math.random() * PHRASES.length);

  const play = () => {
    if (!alive) return;
    const phrase = PHRASES[idx];
    idx = (idx + 1) % PHRASES.length;
    const beatSec = 60 / phrase.tempoBpm;
    const phraseSec = phrase.beats * beatSec;
    const t0 = c.currentTime + 0.05;

    // Muted Rhodes-ish melody
    phrase.melody.forEach(n => {
      scheduleNote(c, nHz(n.midi), t0 + n.beat * beatSec, n.dur * beatSec * 0.95,
        (n.gain ?? 0.045), 'sine');
      scheduleNote(c, nHz(n.midi) * 2, t0 + n.beat * beatSec, n.dur * beatSec * 0.7,
        (n.gain ?? 0.045) * 0.20, 'sine');
    });
    // Soft tuba bass
    phrase.bass.forEach(n => {
      scheduleNote(c, nHz(n.midi), t0 + n.beat * beatSec, n.dur * beatSec,
        n.gain ?? 0.06, 'sawtooth', 320);
    });

    const breathSec = 3 + Math.random() * 2;
    nextTimer = window.setTimeout(play, (phraseSec + breathSec) * 1000);
  };
  play();
  ambientStop = () => { alive = false; if (nextTimer !== null) clearTimeout(nextTimer); };
}

export function stopAmbient() {
  if (ambientStop) ambientStop();
  ambientStop = null;
}
