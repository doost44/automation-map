import * as THREE from 'three';
import { canvas, crunchy } from './textures.js';

// Low-poly 3D versions of each system's logo, picked by the "logo" field in
// data/log.json. Every builder returns a group about 1 unit in radius, facing +Z;
// orbs.js scales it to the orb's size. Unknown names fall back to a faceted planet.

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// Extrude a flat outline into a slab of the given depth, centred on z = 0.
function slab(shape, depth, material) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 3 });
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}

function poly(points) {
  return new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Part of a thick ring, from angle a0 to a1 (radians, 0 = +X, counter-clockwise).
function arc(radius, tube, a0, a1, material) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 10, a1 - a0), material);
  m.rotation.z = a0;
  return m;
}

function group(...parts) {
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
}

// Put a part on the front face of a slab.
const front = (mesh, z) => { mesh.position.z = z; return mesh; };

const BUILDERS = {
  youtube() {
    const body = slab(roundedRect(2, 1.4, 0.4), 0.5, mat(0xff1a1a));
    const play = front(slab(poly([[-0.25, -0.32], [0.38, 0], [-0.25, 0.32]]), 0.12, mat(0xffffff)), 0.28);
    return group(body, play);
  },

  netflix() {
    const n = poly([
      [-0.7, -1], [-0.32, -1], [-0.32, 0.3], [0.32, -1], [0.7, -1],
      [0.7, 1], [0.32, 1], [0.32, -0.3], [-0.32, 1], [-0.7, 1],
    ]);
    const letter = slab(n, 0.5, mat(0xe50914));
    const back = front(slab(roundedRect(1.9, 2.3, 0.25), 0.2, mat(0x141414)), -0.32);
    return group(back, letter);
  },

  spotify() {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.4, 10), mat(0x1ed760));
    disc.rotation.x = Math.PI / 2;
    const black = mat(0x111111);
    // Three bars that curve down at the ends, biggest on top.
    const bars = [[0.66, -0.2, 0.08], [0.5, -0.36, 0.07], [0.36, -0.5, 0.06]].map(([r, cy, t]) => {
      const a = arc(r, t, Math.PI * 0.22, Math.PI * 0.78, black);
      a.position.set(0, cy, 0.22);
      return a;
    });
    return group(disc, ...bars);
  },

  instagram() {
    // Purple-to-orange gradient on the front and back of the rounded square.
    const c = canvas(32, 32);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 32, 32, 0);
    grad.addColorStop(0, '#feda75');
    grad.addColorStop(0.35, '#fa7e1e');
    grad.addColorStop(0.65, '#d62976');
    grad.addColorStop(1, '#4f5bd5');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    const tex = crunchy(c);
    tex.repeat.set(0.5, 0.5); // extruded caps use shape coordinates (-1..1) as UVs
    tex.offset.set(0.5, 0.5);
    const body = slab(roundedRect(2, 2, 0.55), 0.45, [mat(0xffffff, { map: tex }), mat(0xc13584)]);

    const white = mat(0xffffff);
    const outline = roundedRect(1.5, 1.5, 0.4);
    outline.holes.push(roundedRect(1.26, 1.26, 0.3));
    const frame = front(slab(outline, 0.1, white), 0.26);
    const lens = front(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.09, 4, 10), white), 0.26);
    const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), white);
    flash.position.set(0.42, 0.42, 0.26);
    return group(body, frame, lens, flash);
  },

  google() {
    // A thick multicoloured G with a blue bar.
    const t = 0.24, r = 0.75;
    const deg = (d) => (d * Math.PI) / 180;
    const parts = [
      arc(r, t, deg(40), deg(150), mat(0xea4335)),
      arc(r, t, deg(150), deg(215), mat(0xfbbc05)),
      arc(r, t, deg(215), deg(320), mat(0x34a853)),
      arc(r, t, deg(320), deg(360), mat(0x4285f4)),
    ];
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.36, 0.48), mat(0x4285f4));
    bar.position.x = 0.5;
    return group(...parts, bar);
  },

  keycap() {
    // A square keycap, wider at the bottom, with a letter on top.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 0.8, 4, 1), mat(0xe8e4dc));
    cap.rotation.y = Math.PI / 4;
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.2, 1.95), mat(0x55524c));
    base.position.y = -0.5;
    const c = canvas(32, 32);
    const g = c.getContext('2d');
    g.fillStyle = '#e8e4dc';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#222';
    g.font = 'bold 24px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('A', 16, 17);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshLambertMaterial({ map: crunchy(c) }));
    label.rotation.x = -Math.PI / 2;
    label.position.y = 0.41;
    const key = group(cap, base, label);
    key.rotation.x = 0.6; // tip it towards the viewer so the letter shows
    return group(key);
  },

  uber() {
    const block = slab(roundedRect(2, 2, 0.3), 0.6, mat(0x111111));
    const u = poly([[-0.55, 0.6], [-0.3, 0.6], [-0.3, -0.15], [0.3, -0.15], [0.3, 0.6], [0.55, 0.6], [0.55, -0.42], [-0.55, -0.42]]);
    const letter = front(slab(u, 0.14, mat(0xffffff)), 0.36);
    return group(block, letter);
  },

  gmail() {
    const envelope = slab(roundedRect(2.1, 1.5, 0.15), 0.4, mat(0xf4f2ee));
    const m = poly([
      [-0.85, -0.6], [-0.6, -0.6], [-0.6, 0.15], [0, -0.28], [0.6, 0.15], [0.6, -0.6], [0.85, -0.6],
      [0.85, 0.6], [0.62, 0.6], [0, 0.12], [-0.62, 0.6], [-0.85, 0.6],
    ]);
    const letter = front(slab(m, 0.14, mat(0xea4335)), 0.25);
    return group(envelope, letter);
  },

  'maps-pin'() {
    const red = mat(0xea4335);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), red);
    head.position.y = 0.35;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.05, 8), red);
    tip.rotation.x = Math.PI;
    tip.position.y = -0.4;
    const hole = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), mat(0x8a1a12));
    hole.position.set(0, 0.38, 0.48);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 8), mat(0x34a853));
    ground.position.y = -0.95;
    return group(head, tip, hole, ground);
  },

  'ai-spark'() {
    // A faceted starburst: spikes of different lengths around a small core.
    const orange = mat(0xd97757);
    const parts = [new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), orange)];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const len = i % 2 ? 0.75 : 1.0;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.14, len, 4), orange);
      const a = (i / n) * Math.PI * 2;
      spike.position.set(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, 0);
      spike.rotation.z = a - Math.PI / 2;
      parts.push(spike);
    }
    return group(...parts);
  },
};

export function buildLogo(name, fallbackColor) {
  const build = BUILDERS[name];
  if (build) return build();
  return group(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(fallbackColor)));
}
