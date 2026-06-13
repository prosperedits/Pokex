// Synthesize the card-inspect reveal sound — pure Node, no deps, writes a 16-bit
// stereo WAV. Design: a deep sub "thoom" for weight, a soft filtered-air swell for
// the whoosh, and a brief iridescent shimmer chord (the "holo" sparkle) on the tail.
// Run:  node scripts/make-whoosh.mjs   →   assets/sfx/whoosh.wav
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SR = 44100;
const DUR = 0.95;                       // seconds
const N = Math.floor(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const TAU = Math.PI * 2;
const clamp = (x) => Math.max(-1, Math.min(1, x));
// smooth attack/decay envelope (raised-cosine attack, exponential-ish decay)
function env(t, attack, hold, release) {
  if (t < attack) return 0.5 - 0.5 * Math.cos((t / attack) * Math.PI);
  const td = t - attack;
  if (td < hold) return 1;
  const tr = td - hold;
  return tr < release ? Math.pow(1 - tr / release, 1.8) : 0;
}

// one-pole lowpass state for the air swell
let lp = 0;
// shimmer chord — a soft, bright major triad an octave up (the holo glint)
const SHIMMER = [783.99, 987.77, 1174.66, 1567.98]; // G5 B5 D6 G6
let seed = 1337;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

for (let i = 0; i < N; i++) {
  const t = i / SR;
  let sl = 0, sr = 0;

  // 1) sub "thoom" — sine glide 150→58 Hz, lands fast, gives the body
  const subF = 58 + (150 - 58) * Math.exp(-t * 7);
  const subPhase = TAU * (58 * t + (150 - 58) * (1 - Math.exp(-t * 7)) / 7);
  const sub = Math.sin(subPhase) * env(t, 0.012, 0.05, 0.55) * 0.6;
  sl += sub; sr += sub;

  // 2) air swell — white noise through a sweeping lowpass, the actual "whoosh"
  const cutoff = 0.04 + 0.5 * Math.exp(-Math.pow((t - 0.18) / 0.16, 2)); // peaks mid
  lp += cutoff * (rnd() - lp);
  const airEnv = env(t, 0.06, 0.02, 0.6) * 0.32;
  // tiny stereo decorrelation for width
  sl += lp * airEnv * (1 + 0.15 * Math.sin(t * 30));
  sr += lp * airEnv * (1 - 0.15 * Math.sin(t * 30 + 1.1));

  // 3) shimmer chord — enters on the tail, brief, panned per-partial for sparkle
  const shEnv = env(t, 0.14, 0.0, 0.7) * 0.12;
  for (let k = 0; k < SHIMMER.length; k++) {
    const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * t + k);     // slow vibrato
    const f = SHIMMER[k] * vib;
    const partial = Math.sin(TAU * f * t) * shEnv * (1 - k * 0.16);
    const pan = (k / (SHIMMER.length - 1)) * 2 - 1;          // spread across stereo
    sl += partial * (0.5 - pan * 0.4);
    sr += partial * (0.5 + pan * 0.4);
  }

  // master soft-clip + gentle overall fade-out tail
  const masterFade = t > DUR - 0.08 ? (DUR - t) / 0.08 : 1;
  L[i] = clamp(Math.tanh(sl * 1.1)) * masterFade;
  R[i] = clamp(Math.tanh(sr * 1.1)) * masterFade;
}

// ---- write 16-bit PCM stereo WAV ----
const bytesPerSample = 2, channels = 2;
const dataLen = N * channels * bytesPerSample;
const buf = Buffer.alloc(44 + dataLen);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataLen, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(channels, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * channels * bytesPerSample, 28);
buf.writeUInt16LE(channels * bytesPerSample, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(dataLen, 40);
let o = 44;
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * 32767), o); o += 2;
  buf.writeInt16LE(Math.round(R[i] * 32767), o); o += 2;
}
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sfx', 'whoosh.wav');
writeFileSync(out, buf);
console.log(`wrote ${out}  (${(buf.length / 1024).toFixed(1)} KB, ${DUR}s stereo)`);
