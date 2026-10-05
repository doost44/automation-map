import * as THREE from 'three';

// Small seeded RNG so the procedural textures look the same on every load.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Chunky retro texture: nearest-neighbour, no mipmaps.
export function crunchy(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

// Fill every pixel with a base colour plus random brightness noise.
function noisy(size, base, spread, seed) {
  const c = canvas(size, size);
  const g = c.getContext('2d');
  const r = rng(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = (r() - 0.5) * spread;
      g.fillStyle = `rgb(${base[0] + n},${base[1] + n * 1.2},${base[2] + n * 0.6})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  return { c, g, r };
}

export function grassTexture() {
  const { c, g, r } = noisy(64, [74, 108, 44], 40, 7);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = r() > 0.5 ? '#3d5a22' : '#8aa04a';
    g.fillRect((r() * 64) | 0, (r() * 64) | 0, 1, 2);
  }
  return crunchy(c, 6);
}

export function dirtTexture() {
  const { c, g, r } = noisy(64, [92, 70, 50], 46, 11);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = r() > 0.5 ? '#4a3a2c' : '#7c7066';
    g.fillRect((r() * 64) | 0, (r() * 64) | 0, 2 + ((r() * 3) | 0), 2);
  }
  return crunchy(c, 3);
}

export function plasticTexture() {
  const { c } = noisy(32, [232, 230, 222], 14, 3);
  return crunchy(c);
}

// Vertical dusk gradient, used as the scene background.
export function skyTexture() {
  const c = canvas(2, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3a4a66');
  grad.addColorStop(0.45, '#7c7f8c');
  grad.addColorStop(0.62, '#c98a56');
  grad.addColorStop(1, '#5b4a48');
  g.fillStyle = grad;
  g.fillRect(0, 0, 2, 256);
  return crunchy(c);
}

// A word rendered for a sprite. Returns the texture and its aspect ratio.
export function wordTexture(text, color = '#ffd27a') {
  const font = 'bold 20px "Courier New", monospace';
  const probe = canvas(1, 1).getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 12;
  const c = canvas(w, 28);
  const g = c.getContext('2d');
  g.font = font;
  g.textBaseline = 'middle';
  g.fillStyle = '#000';
  g.fillText(text, 8, 16);
  g.fillStyle = color;
  g.fillText(text, 6, 14);
  return { texture: crunchy(c), aspect: w / 28 };
}
