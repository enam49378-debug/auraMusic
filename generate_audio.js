const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const totalDuration = 7.6; // seconds
const totalSamples = Math.floor(sampleRate * totalDuration);

const leftBuf = new Float32Array(totalSamples);
const rightBuf = new Float32Array(totalSamples);

// Utility functions
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const smooth = n => { n = clamp(n, 0, 1); return n * n * (3 - 2 * n); };
const lerp = (a, b, t) => a + (b - a) * t;

// 1. REVERB / STEREO DELAY SYSTEM
class DelayLine {
  constructor(delaySamples, feedback = 0.35, damp = 0.25) {
    this.buffer = new Float32Array(delaySamples);
    this.idx = 0;
    this.feedback = feedback;
    this.damp = damp;
    this.filterState = 0;
  }
  process(input) {
    const out = this.buffer[this.idx];
    this.filterState = out * (1 - this.damp) + this.filterState * this.damp;
    this.buffer[this.idx] = input + this.filterState * this.feedback;
    this.idx = (this.idx + 1) % this.buffer.length;
    return out;
  }
}

const delayL1 = new DelayLine(Math.floor(sampleRate * 0.089), 0.36, 0.3);
const delayR1 = new DelayLine(Math.floor(sampleRate * 0.113), 0.36, 0.3);
const delayL2 = new DelayLine(Math.floor(sampleRate * 0.178), 0.28, 0.4);
const delayR2 = new DelayLine(Math.floor(sampleRate * 0.211), 0.28, 0.4);

// ── LAYER 1: 0.0s - 1.05s SEEKER LINE SWELL & SUB-BASS DRONE ──
// Reference signature: D2 (73.4 Hz) warm sub drone with fluid forward glide
for (let i = 0; i < Math.floor(sampleRate * 1.6); i++) {
  const t = i / sampleRate;
  
  let env = 0;
  if (t < 0.08) env = smooth(t / 0.08);
  else if (t < 1.05) env = 1.0;
  else env = Math.exp(-(t - 1.05) * 4.0);

  // Sub bass 73.4 Hz + 2nd harmonic (146.8 Hz)
  const sub = Math.sin(2 * Math.PI * 73.4 * t) * 0.38
            + Math.sin(2 * Math.PI * 146.8 * t) * 0.12;

  // Seeker light ribbon glide (340 Hz -> 920 Hz)
  let ribbon = 0;
  if (t < 1.05) {
    const sweepU = smooth(t / 1.05);
    const freq = lerp(340, 920, sweepU);
    const ribEnv = Math.sin(Math.PI * sweepU) * 0.09;
    ribbon = Math.sin(2 * Math.PI * freq * t) * ribEnv;
  }

  const val = Math.tanh((sub + ribbon) * env);
  leftBuf[i] += val * 0.95;
  rightBuf[i] += val * 0.95;
}

// ── LAYER 2: 1.05s - 1.65s YOUTUBE MUSIC REVEAL CHIME (D Major Triad) ──
// Immediate crystalline chime right when the dot morphs into YouTube Music
const chimeNotes = [
  { f: 587.33, pan: -0.25, gain: 0.24, delay: 0.00 }, // D5
  { f: 739.99, pan: 0.25, gain: 0.22, delay: 0.015 }, // F#5
  { f: 880.00, pan: -0.15, gain: 0.20, delay: 0.030 }, // A5
  { f: 1174.66, pan: 0.15, gain: 0.16, delay: 0.045 }  // D6
];

chimeNotes.forEach(note => {
  const startSample = Math.floor(sampleRate * (1.05 + note.delay));
  const noteSamples = Math.floor(sampleRate * 2.0);
  for (let j = 0; j < noteSamples && (startSample + j) < totalSamples; j++) {
    const t = j / sampleRate;
    const env = Math.exp(-t * 3.8);
    const mod = Math.sin(2 * Math.PI * (note.f * 2.75) * t) * 0.25 * Math.exp(-t * 7.5);
    const sig = (Math.sin(2 * Math.PI * note.f * t + mod) + Math.sin(2 * Math.PI * (note.f * 2) * t) * 0.2) * env * note.gain;

    const idx = startSample + j;
    leftBuf[idx] += sig * (0.5 - note.pan * 0.5);
    rightBuf[idx] += sig * (0.5 + note.pan * 0.5);
  }
});

// ── LAYER 3: 1.53s - 2.18s AURAMUSIC DROP & ELASTIC BOUNCE ──
// Falling cosmic swoop (1.53s -> 1.95s)
const dropStart = Math.floor(sampleRate * 1.53);
const dropDuration = Math.floor(sampleRate * 0.42);
for (let j = 0; j < dropDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.42;
  const freq = lerp(950, 190, smooth(u));
  const env = Math.sin(Math.PI * u) * 0.13;
  const sig = Math.sin(2 * Math.PI * freq * t) * env;
  const idx = dropStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sig * 0.3;
    rightBuf[idx] += sig * 0.9;
  }
}

// Elastic bounce at t = 1.95s
const bounce1Start = Math.floor(sampleRate * 1.95);
for (let j = 0; j < Math.floor(sampleRate * 0.35); j++) {
  const t = j / sampleRate;
  const env = Math.exp(-t * 18);
  const freq = 120 * Math.exp(-t * 12) + 65;
  const sig = Math.sin(2 * Math.PI * freq * t) * env * 0.34;
  const idx = bounce1Start + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sig * 0.4;
    rightBuf[idx] += sig * 0.8;
  }
}

// Sparkle stardust for AuraMusic (1.98s - 2.22s)
const sparkles = [
  { f: 1760, t: 1.98, pan: 0.6 },
  { f: 2349, t: 2.04, pan: 0.8 },
  { f: 2959, t: 2.10, pan: 0.7 },
  { f: 3520, t: 2.16, pan: 0.5 }
];
sparkles.forEach(s => {
  const start = Math.floor(sampleRate * s.t);
  for (let j = 0; j < Math.floor(sampleRate * 0.35); j++) {
    const t = j / sampleRate;
    const env = Math.exp(-t * 15) * 0.08;
    const sig = Math.sin(2 * Math.PI * s.f * t) * env;
    const idx = start + j;
    if (idx < totalSamples) {
      leftBuf[idx] += sig * (0.5 - s.pan * 0.5);
      rightBuf[idx] += sig * (0.5 + s.pan * 0.5);
    }
  }
});

// ── LAYER 4: 2.18s - 2.98s NEON ENERGY CHARGE ──
const chargeStart = Math.floor(sampleRate * 2.18);
const chargeDuration = Math.floor(sampleRate * 0.80);
for (let j = 0; j < chargeDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.80;
  const env = smooth(u) * 0.17;

  // Red channel (Left): 160 Hz -> 380 Hz with 12 Hz pulse
  const freqL = lerp(160, 380, smooth(u));
  const lfoL = 0.6 + 0.4 * Math.sin(2 * Math.PI * 12 * t);
  const sigL = Math.sin(2 * Math.PI * freqL * t) * env * lfoL;

  // Purple channel (Right): 200 Hz -> 480 Hz with 16 Hz pulse
  const freqR = lerp(200, 480, smooth(u));
  const lfoR = 0.6 + 0.4 * Math.sin(2 * Math.PI * 16 * t);
  const sigR = Math.sin(2 * Math.PI * freqR * t) * env * lfoR;

  const idx = chargeStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sigL;
    rightBuf[idx] += sigR;
  }
}

// ── LAYER 5: 2.98s - 3.48s MAGNETIC COLLISION (Doppler Inward Pull) ──
const pullStart = Math.floor(sampleRate * 2.98);
const pullDuration = Math.floor(sampleRate * 0.50);
for (let j = 0; j < pullDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.50;
  const env = Math.pow(u, 2.2) * 0.28;

  const freq = lerp(220, 850, smooth(u));
  const pan = (1 - u);
  const sig = Math.sin(2 * Math.PI * freq * t) * env;

  const idx = pullStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sig * (0.5 + pan * 0.4);
    rightBuf[idx] += sig * (0.5 - pan * 0.4);
  }
}

// ── LAYER 6: 3.48s - 4.68s FUSION IMPACT & 50/50 EMBLEM BIRTH ──
const impactStart = Math.floor(sampleRate * 3.48);

// Sub-boom (55 Hz punch)
for (let j = 0; j < Math.floor(sampleRate * 1.5); j++) {
  const t = j / sampleRate;
  const env = Math.exp(-t * 3.2);
  const pitchDrop = 110 * Math.exp(-t * 22) + 52;
  const subSig = Math.sin(2 * Math.PI * pitchDrop * t) * env * 0.68;
  const idx = impactStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += subSig;
    rightBuf[idx] += subSig;
  }
}

// High-energy spark impact transient (first 60ms)
for (let j = 0; j < Math.floor(sampleRate * 0.08); j++) {
  const t = j / sampleRate;
  const env = Math.exp(-t * 55) * 0.35;
  const noise = (Math.random() * 2 - 1) * env;
  const idx = impactStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += noise;
    rightBuf[idx] += noise;
  }
}

// Ethereal D Major 9th Majesty Chord
const majestyChord = [
  { f: 146.83, gain: 0.18, pan: 0.0 },  // D3
  { f: 220.00, gain: 0.16, pan: -0.2 }, // A3
  { f: 369.99, gain: 0.18, pan: 0.2 },  // F#4
  { f: 554.37, gain: 0.16, pan: -0.3 }, // C#5
  { f: 659.25, gain: 0.14, pan: 0.3 },  // E5
  { f: 880.00, gain: 0.10, pan: 0.0 }   // A5
];

majestyChord.forEach(note => {
  const noteSamples = Math.floor(sampleRate * 3.4);
  for (let j = 0; j < noteSamples && (impactStart + j) < totalSamples; j++) {
    const t = j / sampleRate;
    let env = 0;
    if (t < 0.08) env = smooth(t / 0.08);
    else env = Math.exp(-(t - 0.08) * 0.95);

    const detune = Math.sin(2 * Math.PI * 0.5 * t) * 0.6;
    const osc1 = Math.sin(2 * Math.PI * (note.f + detune) * t);
    const osc2 = Math.sin(2 * Math.PI * (note.f * 2) * t) * 0.25;
    const sig = (osc1 + osc2) * env * note.gain;

    const idx = impactStart + j;
    leftBuf[idx] += sig * (0.5 - note.pan * 0.5);
    rightBuf[idx] += sig * (0.5 + note.pan * 0.5);
  }
});

// ── LAYER 7: 4.68s - 7.50s PORTAL FLIGHT INTO YOUTUBE MUSIC ──
const portalStart = Math.floor(sampleRate * 4.68);
const portalDuration = Math.floor(sampleRate * 2.8);
for (let j = 0; j < portalDuration; j++) {
  const t = j / sampleRate;
  const u = t / 2.8;
  
  let env = 0;
  if (u < 0.7) env = smooth(u / 0.7);
  else env = Math.exp(-(u - 0.7) * 4.5);

  const sweepFreq = lerp(200, 1400, smooth(u));
  const noise = (Math.random() * 2 - 1) * 0.07;
  const filtered = noise * Math.sin(2 * Math.PI * sweepFreq * t);
  const padTone = Math.sin(2 * Math.PI * 293.66 * t) * 0.08 * env;

  const idx = portalStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += (filtered + padTone) * env * 0.8;
    rightBuf[idx] += (filtered + padTone) * env * 0.8;
  }
}

// ── POST-PROCESSING: STEREO REVERB DELAYS + SOFT LIMITER ──
for (let i = 0; i < totalSamples; i++) {
  const inL = leftBuf[i];
  const inR = rightBuf[i];

  const revL = delayL1.process(inL) * 0.35 + delayL2.process(inL) * 0.25;
  const revR = delayR1.process(inR) * 0.35 + delayR2.process(inR) * 0.25;

  let outL = inL + revL;
  let outR = inR + revR;

  outL = Math.tanh(outL * 1.15) * 0.92;
  outR = Math.tanh(outR * 1.15) * 0.92;

  leftBuf[i] = outL;
  rightBuf[i] = outR;
}

// ── EXPORT TO 16-BIT STEREO WAV BUFFER ──
const wavDataLength = totalSamples * 4;
const wavBuffer = Buffer.alloc(44 + wavDataLength);

wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(36 + wavDataLength, 4);
wavBuffer.write('WAVE', 8);
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20);
wavBuffer.writeUInt16LE(2, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * 4, 28);
wavBuffer.writeUInt16LE(4, 32);
wavBuffer.writeUInt16LE(16, 34);
wavBuffer.write('data', 36);
wavBuffer.writeUInt32LE(wavDataLength, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const l = clamp(Math.round(leftBuf[i] * 32767), -32768, 32767);
  const r = clamp(Math.round(rightBuf[i] * 32767), -32768, 32767);
  wavBuffer.writeInt16LE(l, offset);
  wavBuffer.writeInt16LE(r, offset + 2);
  offset += 4;
}

const outPath = path.join(__dirname, 'assets', 'startup_original.wav');
fs.writeFileSync(outPath, wavBuffer);
console.log('✅ Soundtrack original generado con éxito en:', outPath);
