import { settings } from './options.js';

// Sound, made with the Web Audio API. Effects are synthesised on the fly
// (oscillators and filtered noise). The one audio file is Charlie's own bass line
// (assets/audio/bassline.m4a, cut from their ambient track), which drifts round the
// space as a musical wind. Browsers only allow sound after a click, so nothing plays
// until startSound() is called from one (entering the game).

const BASSLINE = 'assets/audio/bassline.m4a';

// The track sits in A-flat major pentatonic, so the orb synths only use these notes.
const SCALE = [8, 10, 0, 3, 5]; // Ab Bb C Eb F, as semitones above C
const noteFreq = (i, octave) => {
  const pc = SCALE[((i % 5) + 5) % 5];
  const midi = 12 * (octave + 1 + Math.floor(i / 5)) + pc;
  return 440 * 2 ** ((midi - 69) / 12);
};

let ctx = null;
let master = null;
let echo = null; // shared delay the synth sounds are sent into
let heldBus = null; // the held orb's sounds go through here, louder the closer it is
let noiseBuf = null;
const loops = {}; // continuous sounds whose level is turned up and down
let wind = null; // the bass-line wind

export function startSound() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  buildEcho();
  buildLoops();
  startWind();
}

const ready = () => ctx && ctx.state === 'running';
export const audioState = () => (ctx ? ctx.state + (wind ? ', bass line playing' : '') : 'not started'); // for debugging

// Send a node to the speakers, panned left (-1) to right (1), optionally into the echo too.
function out(node, pan = 0, echoAmount = 0) {
  let last = node;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    last = p;
  }
  last.connect(master);
  if (echoAmount) {
    const send = ctx.createGain();
    send.gain.value = echoAmount;
    last.connect(send);
    send.connect(echo);
  }
}

// A soft, dark echo: 3/8 of a second, fading repeats.
function buildEcho() {
  echo = ctx.createDelay(1);
  echo.delayTime.value = 0.375;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.38;
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 1800;
  echo.connect(tone);
  tone.connect(feedback);
  feedback.connect(echo);
  tone.connect(master);

  heldBus = ctx.createGain();
  heldBus.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.5;
  heldBus.connect(send);
  send.connect(echo);
}

// Gain that rises quickly then fades, so sounds don't click.
function envelope(vol, attack, dur, t = ctx.currentTime) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  return g;
}

function tone({ freq, to = freq, dur = 0.15, type = 'sine', vol = 0.2, pan = 0, attack = 0.005, delay = 0 }) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + attack + dur);
  const g = envelope(vol, attack, dur, t);
  o.connect(g);
  out(g, pan);
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function noise({ dur = 0.2, filter = 'lowpass', freq = 1000, to = freq, q = 1, vol = 0.2, pan = 0, attack = 0.005, delay = 0 }) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + attack + dur);
  const g = envelope(vol, attack, dur, t);
  src.connect(f);
  f.connect(g);
  out(g, pan);
  src.start(t, Math.random() * 0.5);
  src.stop(t + attack + dur + 0.05);
}

// One synth note: two slightly detuned oscillators through a filter that closes
// as the note fades (a classic analogue pluck/pad), sent into the echo.
function synth({ freq, dur = 0.3, type = 'sawtooth', vol = 0.06, pan = 0, attack = 0.01, cutoff = 2400, cutoffEnd = 400, echoAmount = 0.35, delay = 0, spread = 7, bus = null }) {
  if (!ready()) return;
  const t = ctx.currentTime + delay;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 4;
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(cutoffEnd, t + attack + dur);
  const g = envelope(vol, attack, dur, t);
  f.connect(g);
  if (bus) g.connect(bus);
  else out(g, pan, echoAmount);
  for (const detune of [-spread, spread]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(f);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }
}

// --- Continuous sounds --------------------------------------------------------

function loop(name, base, build) {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  loops[name] = { gain, base, ...build(gain) };
}

function noiseInto(dest, type, freq, q = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f);
  f.connect(dest);
  src.start();
  return f;
}

function oscInto(dest, type, freq) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(dest);
  o.start();
  return o;
}

function lowpassInto(dest, freq, q = 1) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = freq;
  f.Q.value = q;
  f.connect(dest);
  return f;
}

// Slowly push an audio setting up and down with a sine (an LFO).
function wobble(param, rate, amount) {
  const depth = ctx.createGain();
  depth.gain.value = amount;
  oscInto(depth, 'sine', rate * (0.9 + Math.random() * 0.2));
  depth.connect(param);
}

function buildLoops() {
  // Falling: wind. Two resonant bands of noise whose pitch wanders (the howl and
  // whistle of real wind) over a soft airy rush, all gusting up and down unevenly.
  loop('fall', 0.16, (g) => {
    const gust = ctx.createGain();
    gust.gain.value = 0.6;
    wobble(gust.gain, 0.17, 0.25);
    wobble(gust.gain, 0.53, 0.12);
    gust.connect(g);
    const howl = noiseInto(gust, 'bandpass', 450, 6);
    wobble(howl.frequency, 0.13, 180);
    wobble(howl.frequency, 0.37, 60);
    const whistle = noiseInto(gust, 'bandpass', 900, 5);
    wobble(whistle.frequency, 0.21, 320);
    const air = ctx.createGain();
    air.gain.value = 0.35;
    air.connect(gust);
    noiseInto(air, 'highpass', 900, 0.5);
    return { filter: whistle };
  });
  loop('rumble', 0.5, (g) => { noiseInto(g, 'lowpass', 90); oscInto(g, 'sine', 38); return {}; });
  loop('drone', 0.1, (g) => {
    const f = lowpassInto(g, 500);
    return { osc: oscInto(f, 'sawtooth', 55), osc2: oscInto(f, 'sawtooth', 55.6) };
  });
  loop('whistle', 0.08, (g) => ({ osc: oscInto(g, 'sine', 1200) }));
}

// Fade a continuous sound to a level from 0 to 1, optionally retuning it.
function setLoop(name, level, freq) {
  const l = loops[name];
  if (!l) return;
  const t = ctx.currentTime;
  l.gain.gain.setTargetAtTime(level * l.base, t, 0.08);
  if (freq && l.osc) {
    l.osc.frequency.setTargetAtTime(freq, t, 0.05);
    l.osc2?.frequency.setTargetAtTime(freq * 1.01, t, 0.05);
  }
  if (freq && l.filter) l.filter.frequency.setTargetAtTime(freq, t, 0.1);
}

// --- Bass-line wind ---------------------------------------------------------------
// The bass line loops through a slowly sweeping filter and a 3D panner that circles
// the player, with a breath of airy noise on top, so it whooshes round the space.

async function startWind() {
  try {
    const res = await fetch(BASSLINE);
    const buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const sweep = ctx.createBiquadFilter();
    sweep.type = 'bandpass';
    sweep.Q.value = 0.9;
    sweep.frequency.value = 180;

    const air = ctx.createBiquadFilter(); // airy noise riding the same sweep
    air.type = 'bandpass';
    air.Q.value = 1.2;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.05;
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noiseBuf;
    airSrc.loop = true;
    airSrc.connect(air);
    air.connect(airGain);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 6, rolloffFactor: 0.6 });

    src.connect(sweep);
    sweep.connect(gain);
    airGain.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    src.start();
    airSrc.start();
    wind = { sweep, air, gain, panner, t: 0 };
  } catch {
    // No bass line (file missing or format unsupported): the map is fine without it.
  }
}

function updateWind(dt, camera) {
  if (!wind) return;
  const t = (wind.t += dt);
  const now = ctx.currentTime;
  // Swells in and out, and the filter opens and closes like a gust.
  const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.13 + 1);
  wind.gain.gain.setTargetAtTime((0.25 + 0.3 * gust) * (settings.music ?? 0.7), now, 0.3);
  wind.sweep.frequency.setTargetAtTime(110 + 260 * gust, now, 0.3);
  wind.air.frequency.setTargetAtTime(600 + 1400 * gust, now, 0.3);
  // Circle round the player at changing speed and height.
  const a = t * 0.35 + Math.sin(t * 0.17) * 2;
  const r = 9 + 4 * Math.sin(t * 0.11);
  const p = camera.position;
  setPos(wind.panner, p.x + Math.cos(a) * r, p.y + 2 + 3 * Math.sin(t * 0.23), p.z + Math.sin(a) * r);
}

function setPos(node, x, y, z) {
  if (node.positionX) {
    node.positionX.value = x;
    node.positionY.value = y;
    node.positionZ.value = z;
  } else {
    node.setPosition(x, y, z);
  }
}

// The listener's ears follow the camera, so 3D sounds move as you turn.
function updateListener(camera) {
  const l = ctx.listener;
  const p = camera.position;
  const e = camera.matrixWorld.elements;
  const fwd = [-e[8], -e[9], -e[10]], up = [e[4], e[5], e[6]];
  if (l.positionX) {
    l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
    l.forwardX.value = fwd[0]; l.forwardY.value = fwd[1]; l.forwardZ.value = fwd[2];
    l.upX.value = up[0]; l.upY.value = up[1]; l.upZ.value = up[2];
  } else {
    l.setPosition(p.x, p.y, p.z);
    l.setOrientation(...fwd, ...up);
  }
}

// Each orb (by its position in the log) gets its own voice: waveform, octave, a short
// note pattern and how fast it plays, so orbs are easy to tell apart by ear.
// All synth-line style: filtered saw, square and triangle waves.
const VOICES = [
  { type: 'triangle', octave: 5, pattern: [0, 2, 4], rate: 3, cutoff: 4000 },
  { type: 'square', octave: 4, pattern: [0, 4], rate: 2, cutoff: 1600 },
  { type: 'sawtooth', octave: 5, pattern: [0, 1, 2, 3], rate: 3.5, cutoff: 2000 },
  { type: 'sawtooth', octave: 4, pattern: [0, 2], rate: 1.6, cutoff: 1300 },
  { type: 'triangle', octave: 6, pattern: [4, 2, 0], rate: 4.5, cutoff: 5000 },
  { type: 'square', octave: 5, pattern: [0, 3], rate: 2.5, cutoff: 2200 },
  { type: 'sawtooth', octave: 4, pattern: [0, 2, 4, 2], rate: 2, cutoff: 1500 },
  { type: 'sawtooth', octave: 5, pattern: [0, 4, 3], rate: 3, cutoff: 1800 },
  { type: 'triangle', octave: 5, pattern: [0, 4], rate: 1.2, cutoff: 3000 },
  { type: 'square', octave: 6, pattern: [2, 0], rate: 4, cutoff: 2600 },
];
const voiceOf = (i) => VOICES[((i % VOICES.length) + VOICES.length) % VOICES.length];

// Play one note in an orb's voice: step is a scale step above the orb's own root note.
function voice(i, step = 0, { vol = 0.04, dur, octave = 0, pan = 0, delay = 0, echoAmount = 0.35 } = {}) {
  const v = voiceOf(i);
  const freq = noteFreq(i + step, v.octave + octave);
  const len = dur ?? Math.min(0.35, 0.9 / v.rate);
  synth({ freq, dur: len, type: v.type, vol, pan, delay, cutoff: v.cutoff, cutoffEnd: v.cutoff * 0.25, echoAmount });
}

// While an orb is held it softly plays its own little pattern, over and over.
// A long, slowly swelling synth pad in an orb's voice, like the pads in the ambient track.
// Each orb differs in chord, octave, brightness, detune width, swell and length.
function pad(i, steps, { vol = 0.028, delay = 0, short = false, bus = null } = {}) {
  const v = voiceOf(i);
  const type = v.type === 'square' ? 'sawtooth' : v.type; // squares are too buzzy held long
  const octave = Math.min(v.octave, 5) - 1;
  steps.forEach((step, k) => synth({
    freq: noteFreq(i + step, octave),
    type,
    vol,
    attack: short ? 0.05 : 0.3 + (i % 3) * 0.15 + k * 0.08,
    dur: short ? 0.8 : 1.8 + (i % 4) * 0.4,
    cutoff: 250,
    cutoffEnd: v.cutoff,
    spread: 5 + ((i * 3) % 12),
    echoAmount: 0.5,
    delay: delay + k * 0.04,
    bus,
  }));
}

let held = null; // { i, step, timer }
function updateHeld(dt, camera, orbs) {
  if (!held) return;
  // Pulling the orb in with the wheel makes it louder (and a little busier); pushing it away fades it.
  const d = orbs[held.i] ? camera.position.distanceTo(orbs[held.i].group.position) : 20;
  const near = Math.max(0, Math.min(1, 1 - (d - 3) / 25));
  heldBus.gain.setTargetAtTime(0.3 + 1.7 * near ** 1.5, ctx.currentTime, 0.1);
  held.timer -= dt;
  if (held.timer > 0) return;
  const v = voiceOf(held.i);
  // One soft pad note at a time from the orb's pattern, overlapping into a slow, evolving drift.
  pad(held.i, [v.pattern[held.step % v.pattern.length]], { vol: 0.016, bus: heldBus });
  held.step++;
  held.timer = (1.6 + (held.i % 3) * 0.4) * (1 - 0.45 * near);
}

// --- The sound effects, by what causes them -------------------------------------

const rnd = (a, b) => a + Math.random() * (b - a);
let stepSide = 1;

export const sfx = {
  // Player: grass rustle, a few crunchy blades and a soft heel thump; left/right alternate.
  step() {
    stepSide = -stepSide;
    const pan = stepSide * 0.15;
    noise({ dur: rnd(0.08, 0.12), filter: 'bandpass', freq: rnd(2800, 4200), to: 1800, q: 0.7, vol: rnd(0.05, 0.07), pan, attack: 0.01 });
    noise({ dur: 0.06, filter: 'bandpass', freq: rnd(2000, 3000), q: 0.9, vol: 0.035, pan, delay: rnd(0.04, 0.07) });
    for (let i = 0; i < 3; i++) noise({ dur: 0.012, filter: 'highpass', freq: rnd(5000, 8000), vol: 0.025, pan, delay: rnd(0, 0.06) });
    noise({ dur: 0.05, filter: 'lowpass', freq: 160, vol: 0.06, pan });
  },
  // Jump: a scuff of grass as you push off, and air rushing past.
  jump() {
    noise({ dur: 0.1, filter: 'bandpass', freq: 2600, to: 1500, q: 0.8, vol: 0.08 });
    noise({ dur: 0.05, filter: 'lowpass', freq: 200, vol: 0.06 });
    noise({ dur: 0.3, filter: 'bandpass', freq: 900, to: 350, q: 0.6, vol: 0.05, attack: 0.04, delay: 0.03 });
  },
  land(strength = 0.5) {
    const s = Math.max(0, Math.min(1, strength));
    noise({ dur: 0.12 + s * 0.2, filter: 'lowpass', freq: 300, to: 80, vol: 0.1 + s * 0.3 });
    tone({ freq: 90, to: 40, dur: 0.15 + s * 0.2, vol: 0.08 + s * 0.3 });
    noise({ dur: 0.12, filter: 'bandpass', freq: 3000, to: 1800, q: 0.7, vol: 0.05 + s * 0.05 }); // grass
  },
  creak() {
    tone({ freq: 140, to: 100, dur: 0.35, type: 'sawtooth', vol: 0.04, attack: 0.05 });
    tone({ freq: 210, to: 160, dur: 0.25, type: 'sawtooth', vol: 0.025, attack: 0.08 });
  },
  // Orbs: each in its own voice (see VOICES), all in the track's key.
  aim: (i = 0) => voice(i, 0, { vol: 0.03, echoAmount: 0.25 }),
  grab(i = 0) {
    pad(i, [...new Set([0, ...voiceOf(i).pattern])].slice(0, 3), { bus: heldBus });
    held = { i, step: 1, timer: 1.5 };
  },
  drop(i = 0) {
    pad(i, [2], { vol: 0.025, short: true });
    pad(i, [0], { vol: 0.025, short: true, delay: 0.12 });
  },
  release() { held = null; },
  whoosh(speed = 1, i = 0) {
    noise({ dur: 0.35, filter: 'bandpass', freq: 2200, to: 300, q: 1.2, vol: Math.min(0.2, 0.06 + speed * 0.004) });
    voice(i, 4, { vol: 0.03, dur: 0.3 });
  },
  bonk(size = 1, strength = 1, i = 0, j = i) {
    const octave = size > 2.2 ? -1 : 0; // the biggest orbs ring an octave lower
    const v = Math.min(0.09, 0.03 + strength * 0.005);
    voice(i, 0, { vol: v, octave, echoAmount: 0.4 });
    voice(j, 0, { vol: v * 0.7, octave, echoAmount: 0.4, delay: 0.03 });
  },
  readOn() {
    noise({ dur: 0.015, filter: 'highpass', freq: 2000, vol: 0.12 });
    [0, 2, 4].forEach((k, i) => synth({ freq: noteFreq(k, 4), dur: 0.15, type: 'square', vol: 0.025, cutoff: 3000, cutoffEnd: 800, delay: i * 0.06 }));
  },
  readOff() {
    noise({ dur: 0.02, filter: 'highpass', freq: 1500, vol: 0.1 });
    [4, 0].forEach((k, i) => synth({ freq: noteFreq(k, 4), dur: 0.12, type: 'square', vol: 0.02, cutoff: 2500, cutoffEnd: 600, delay: i * 0.06 }));
  },
  // Rocks
  pickup: () => noise({ dur: 0.14, filter: 'highpass', freq: 1800, to: 900, vol: 0.1 }),
  throwRock: () => noise({ dur: 0.22, filter: 'bandpass', freq: 1800, to: 400, q: 1.5, vol: 0.12 }),
  thunk(pan = 0) {
    tone({ freq: 160, to: 60, dur: 0.16, vol: 0.22, pan });
    noise({ dur: 0.08, filter: 'lowpass', freq: 600, vol: 0.12, pan });
  },
  crack(pan = 0) {
    for (let i = 0; i < 6; i++) noise({ dur: 0.03, filter: 'highpass', freq: rnd(2500, 6000), vol: 0.15, pan, delay: i * rnd(0.01, 0.035) });
    noise({ dur: 0.6, filter: 'bandpass', freq: 3000, q: 0.5, vol: 0.06, pan, delay: 0.05 }); // static
    tone({ freq: 50, dur: 0.5, type: 'square', vol: 0.025, pan, attack: 0.05 }); // mains buzz
  },
  rockLand: () => noise({ dur: 0.08, filter: 'lowpass', freq: 400, vol: 0.08 }),
  // Giant-rock event
  boom() {
    noise({ dur: 2.2, filter: 'lowpass', freq: 400, to: 60, vol: 0.8 });
    tone({ freq: 70, to: 22, dur: 2, vol: 0.55 });
    noise({ dur: 0.4, filter: 'highpass', freq: 1500, to: 400, vol: 0.18 });
  },
};

// Levels for the continuous sounds, set every frame by whoever owns them.
export const loopsLevel = {
  // Grows gently (level squared) and brightens as you speed up.
  wind: (level) => ready() && setLoop('fall', level ** 1.5, 600 + level * 1100),
  rumble: (level) => ready() && setLoop('rumble', level),
  drone: (level) => ready() && setLoop('drone', level, 55 + level * 55),
  whistle: (level, freq) => ready() && setLoop('whistle', level, freq),
};

// Each frame: volume, ears, the bass-line wind, and faint synth chatter from nearby
// orbs, busier for the apps that take up more minutes per day, so you can hear the
// data as well as see it. Each orb has its own note in the scale.
const _to = { x: 0, y: 0, z: 0 };
let maxMinutes = 0;
export function updateSound(dt, camera, orbs) {
  if (!ready()) return;
  master.gain.setTargetAtTime(settings.mute ? 0 : settings.volume, ctx.currentTime, 0.05);
  updateListener(camera);
  updateWind(dt, camera);
  updateHeld(dt, camera, orbs);
  if (!maxMinutes) maxMinutes = Math.max(1, ...orbs.map((o) => o.system.minutesPerDay || 0));
  const e = camera.matrixWorld.elements; // camera right vector is the first column
  orbs.forEach((o, i) => {
    const p = o.group.position;
    _to.x = p.x - camera.position.x;
    _to.y = p.y - camera.position.y;
    _to.z = p.z - camera.position.z;
    const d = Math.hypot(_to.x, _to.y, _to.z);
    if (d > 45) return;
    const busy = (o.system.minutesPerDay || 0) / maxMinutes;
    if (Math.random() > (0.15 + busy * 1.6) * dt) return;
    const pan = (_to.x * e[0] + _to.y * e[1] + _to.z * e[2]) / (d || 1);
    const pattern = voiceOf(i).pattern;
    voice(i, pattern[Math.floor(Math.random() * pattern.length)], { vol: 0.022 * (1 - d / 45), pan, echoAmount: 0.45 });
  });
}

