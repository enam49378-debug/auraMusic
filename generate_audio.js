const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const totalDuration = 8.5; // seconds
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

const delayL1 = new DelayLine(Math.floor(sampleRate * 0.089), 0.38, 0.3);
const delayR1 = new DelayLine(Math.floor(sampleRate * 0.113), 0.38, 0.3);
const delayL2 = new DelayLine(Math.floor(sampleRate * 0.178), 0.30, 0.4);
const delayR2 = new DelayLine(Math.floor(sampleRate * 0.211), 0.30, 0.4);

// SOUND LAYERS

// ── LAYER 1: 0.0s - 1.45s SEEKER LINE SWELL & SUB-BASS DRONE ──
// Reference signature: D2 (73.4 Hz) warm sub drone with gentle swell
for (let i = 0; i < Math.floor(sampleRate * 2.2); i++) {
  const t = i / sampleRate;
  
  // Drone envelope
  let env = 0;
  if (t < 0.12) env = smooth(t / 0.12);
  else if (t < 1.45) env = 1.0;
  else env = Math.exp(-(t - 1.45) * 2.8);

  // Sub bass 73.4 Hz + subtle 2nd harmonic (146.8 Hz)
  const sub = Math.sin(2 * Math.PI * 73.4 * t) * 0.38
            + Math.sin(2 * Math.PI * 146.8 * t) * 0.12;

  // Seeker light ribbon glide (420 Hz -> 980 Hz)
  let ribbon = 0;
  if (t < 1.45) {
    const sweepU = smooth(t / 1.45);
    const freq = lerp(320, 880, sweepU);
    const ribEnv = Math.sin(Math.PI * sweepU) * 0.08;
    ribbon = Math.sin(2 * Math.PI * freq * t) * ribEnv;
  }

  // Add subtle analog warmth (soft saturation)
  const val = Math.tanh((sub + ribbon) * env);
  leftBuf[i] += val * 0.95;
  rightBuf[i] += val * 0.95;
}

// ── LAYER 2: 1.45s - 2.05s YOUTUBE MUSIC REVEAL CHIME (D Major Triad) ──
// Harmonic glass bells: D5 (587.3 Hz), F#5 (739.9 Hz), A5 (880.0 Hz), D6 (1174.6 Hz)
const chimeNotes = [
  { f: 587.33, pan: -0.25, gain: 0.22, delay: 0.00 },
  { f: 739.99, pan: 0.25, gain: 0.20, delay: 0.02 },
  { f: 880.00, pan: -0.15, gain: 0.18, delay: 0.04 },
  { f: 1174.66, pan: 0.15, gain: 0.14, delay: 0.06 }
];

chimeNotes.forEach(note => {
  const startSample = Math.floor(sampleRate * (1.46 + note.delay));
  const noteSamples = Math.floor(sampleRate * 2.2);
  for (let j = 0; j < noteSamples && (startSample + j) < totalSamples; j++) {
    const t = j / sampleRate;
    // Bell envelope: instant attack, long crystal decay
    const env = Math.exp(-t * 3.6);
    // FM synthesis for glass bell shimmer
    const mod = Math.sin(2 * Math.PI * (note.f * 2.75) * t) * 0.25 * Math.exp(-t * 7.0);
    const sig = (Math.sin(2 * Math.PI * note.f * t + mod) + Math.sin(2 * Math.PI * (note.f * 2) * t) * 0.2) * env * note.gain;

    const idx = startSample + j;
    leftBuf[idx] += sig * (0.5 - note.pan * 0.5);
    rightBuf[idx] += sig * (0.5 + note.pan * 0.5);
  }
});

// ── LAYER 3: 1.98s - 2.68s AURAMUSIC DROP & ELASTIC BOUNCE ──
// Falling whoosh (1.98s -> 2.40s)
const dropStart = Math.floor(sampleRate * 1.98);
const dropDuration = Math.floor(sampleRate * 0.45);
for (let j = 0; j < dropDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.45;
  const freq = lerp(900, 180, smooth(u));
  const env = Math.sin(Math.PI * u) * 0.12;
  const sig = Math.sin(2 * Math.PI * freq * t) * env;
  const idx = dropStart + j;
  leftBuf[idx] += sig * 0.3; // pan right as Aura drops from right
  rightBuf[idx] += sig * 0.9;
}

// Elastic bounce 1 (t = 2.38s)
const bounce1Start = Math.floor(sampleRate * 2.38);
for (let j = 0; j < Math.floor(sampleRate * 0.35); j++) {
  const t = j / sampleRate;
  const env = Math.exp(-t * 18);
  const freq = 120 * Math.exp(-t * 12) + 65;
  const sig = Math.sin(2 * Math.PI * freq * t) * env * 0.32;
  const idx = bounce1Start + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sig * 0.4;
    rightBuf[idx] += sig * 0.8;
  }
}

// Sparkle stardust for AuraMusic (2.42s - 2.70s)
const sparkles = [
  { f: 1760, t: 2.43, pan: 0.6 },
  { f: 2349, t: 2.48, pan: 0.8 },
  { f: 2959, t: 2.54, pan: 0.7 },
  { f: 3520, t: 2.60, pan: 0.5 }
];
sparkles.forEach(s => {
  const start = Math.floor(sampleRate * s.t);
  for (let j = 0; j < Math.floor(sampleRate * 0.4); j++) {
    const t = j / sampleRate;
    const env = Math.exp(-t * 14) * 0.07;
    const sig = Math.sin(2 * Math.PI * s.f * t) * env;
    const idx = start + j;
    if (idx < totalSamples) {
      leftBuf[idx] += sig * (0.5 - s.pan * 0.5);
      rightBuf[idx] += sig * (0.5 + s.pan * 0.5);
    }
  }
});

// ── LAYER 4: 2.68s - 3.53s NEON CHARGE (Stereo Pulsing Tension) ──
const chargeStart = Math.floor(sampleRate * 2.68);
const chargeDuration = Math.floor(sampleRate * 0.85);
for (let j = 0; j < chargeDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.85;
  const env = smooth(u) * 0.16;

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

// ── LAYER 5: 3.53s - 4.03s MAGNETIC COLLISION (Doppler Inward Pull) ──
const pullStart = Math.floor(sampleRate * 3.53);
const pullDuration = Math.floor(sampleRate * 0.50);
for (let j = 0; j < pullDuration; j++) {
  const t = j / sampleRate;
  const u = t / 0.50;
  const env = Math.pow(u, 2.2) * 0.28;

  // Accelerating inward pitch
  const freq = lerp(220, 850, smooth(u));
  // Stereo panning converging from ±1 to 0 (center)
  const pan = (1 - u);
  const sig = Math.sin(2 * Math.PI * freq * t) * env;

  const idx = pullStart + j;
  if (idx < totalSamples) {
    leftBuf[idx] += sig * (0.5 + pan * 0.4);
    rightBuf[idx] += sig * (0.5 - pan * 0.4);
  }
}

// ── LAYER 6: 4.03s - 5.33s FUSION IMPACT & 50/50 EMBLEM BIRTH ──
// Massive cinematic sub-boom + crystalline plasma burst + D Major 9th majesty chord
const impactStart = Math.floor(sampleRate * 4.03);

// 1. Sub-boom (55 Hz punch)
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

// 2. High-energy spark impact transient (first 60ms)
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

// 3. Ethereal D Major 9th Majesty Chord (D3, A3, F#4, C#5, E5)
const majestyChord = [
  { f: 146.83, gain: 0.18, pan: 0.0 },  // D3
  { f: 220.00, gain: 0.16, pan: -0.2 }, // A3
  { f: 369.99, gain: 0.18, pan: 0.2 },  // F#4
  { f: 554.37, gain: 0.16, pan: -0.3 }, // C#5
  { f: 659.25, gain: 0.14, pan: 0.3 },  // E5
  { f: 880.00, gain: 0.10, pan: 0.0 }   // A5
];

majestyChord.forEach(note => {
  const noteSamples = Math.floor(sampleRate * 3.8);
  for (let j = 0; j < noteSamples && (impactStart + j) < totalSamples; j++) {
    const t = j / sampleRate;
    // Warm lush pad envelope
    let env = 0;
    if (t < 0.08) env = smooth(t / 0.08);
    else env = Math.exp(-(t - 0.08) * 0.95);

    // Warm multi-sine with subtle detuning chorus
    const detune = Math.sin(2 * Math.PI * 0.5 * t) * 0.6;
    const osc1 = Math.sin(2 * Math.PI * (note.f + detune) * t);
    const osc2 = Math.sin(2 * Math.PI * (note.f * 2) * t) * 0.25;
    const sig = (osc1 + osc2) * env * note.gain;

    const idx = impactStart + j;
    leftBuf[idx] += sig * (0.5 - note.pan * 0.5);
    rightBuf[idx] += sig * (0.5 + note.pan * 0.5);
  }
});

// ── LAYER 7: 5.33s - 8.20s PORTAL FLIGHT & EXPANSION INTO YOUTUBE MUSIC ──
// Deep cosmic whoosh through the triangle opening into YouTube Music
const portalStart = Math.floor(sampleRate * 5.33);
const portalDuration = Math.floor(sampleRate * 2.8);
for (let j = 0; j < portalDuration; j++) {
  const t = j / sampleRate;
  const u = t / 2.8;
  
  // Whoosh swell that peaks around u = 0.7 (when triangle engulfs screen)
  let env = 0;
  if (u < 0.7) env = smooth(u / 0.7);
  else env = Math.exp(-(u - 0.7) * 4.5);

  // Filtered stereo noise sweep (spatial immersion)
  const sweepFreq = lerp(200, 1400, smooth(u));
  const noise = (Math.random() * 2 - 1) * 0.07;
  const filtered = noise * Math.sin(2 * Math.PI * sweepFreq * t);

  // Warm resolving tone (D4 -> D3)
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

  // Reverb send
  const revL = delayL1.process(inL) * 0.35 + delayL2.process(inL) * 0.25;
  const revR = delayR1.process(inR) * 0.35 + delayR2.process(inR) * 0.25;

  let outL = inL + revL;
  let outR = inR + revR;

  // Master soft limiter (transparent saturation without clipping)
  outL = Math.tanh(outL * 1.15) * 0.92;
  outR = Math.tanh(outR * 1.15) * 0.92;

  leftBuf[i] = outL;
  rightBuf[i] = outR;
}

// ── EXPORT TO 16-BIT STEREO WAV BUFFER ──
const wavDataLength = totalSamples * 4; // 2 channels * 2 bytes
const wavBuffer = Buffer.alloc(44 + wavDataLength);

// RIFF header
wavBuffer.write('RIFF', 0);
wavBuffer.writeUInt32LE(36 + wavDataLength, 4);
wavBuffer.write('WAVE', 8);
wavBuffer.write('fmt ', 12);
wavBuffer.writeUInt32LE(16, 16); // subchunk1 size
wavBuffer.writeUInt16LE(1, 20);  // PCM format
wavBuffer.writeUInt16LE(2, 22);  // 2 channels
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * 4, 28); // byte rate
wavBuffer.writeUInt16LE(4, 32);  // block align
wavBuffer.writeUInt16LE(16, 34); // bits per sample
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
console.log('✅ Soundtrack original generado con éxito en:', outPath, '(' + wavBuffer.length + ' bytes)');
