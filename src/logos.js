import * as THREE from 'three';
import { canvas, crunchy } from './textures.js';

// Low-poly 3D versions of each system's logo, picked by the "logo" field in
// data/log.json. Every builder returns a group about 1 unit in radius, facing +Z;
// orbs.js scales it to the orb's size. Unknown names fall back to a faceted planet.

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

// Extrude a flat outline into a slab of the given depth, centred on z = 0.
// curveSegments: 3 keeps rounded corners chunky; circles need a few more to read as round.
function slab(shape, depth, material, curveSegments = 3) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments });
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

function circle(r, x = 0, y = 0) {
  const s = new THREE.Shape();
  s.absarc(x, y, r, 0, Math.PI * 2, false);
  return s;
}

// A flat ring (washer) shape.
function ringShape(outer, inner) {
  const s = circle(outer);
  s.holes.push(circle(inner));
  return s;
}

// A disc facing +Z.
function disc(r, depth, material, segments = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, depth, segments), material);
  m.rotation.x = Math.PI / 2;
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

  claude() {
    // The Claude spark: blades at uneven angles and lengths around a solid centre.
    const orange = mat(0xda7756);
    const parts = [front(disc(0.24, 0.18, orange, 10), 0)];
    const rays = [
      [8, 0.95], [-12, 0.85], [-42, 0.98], [-78, 0.9], [-102, 0.95], [-135, 0.9],
      [-160, 0.72], [172, 0.96], [145, 0.95], [112, 0.98], [82, 0.95], [52, 0.92],
    ];
    for (const [d, len] of rays) {
      // A straight blade of even width with a blunt, slightly angled tip.
      const ray = slab(poly([[0, -0.08], [len - 0.06, -0.08], [len + 0.03, 0.08], [0, 0.08]]), 0.18, orange);
      ray.rotation.z = (d * Math.PI) / 180;
      parts.push(ray);
    }
    return group(...parts);
  },


  outlook() {
    // An open envelope with a peaked top, roughly square.
    const body = slab(poly([[-0.92, -0.78], [0.92, -0.78], [0.92, 0.38], [0, 0.92], [-0.92, 0.38]]), 0.3, mat(0x18a8f5));
    // Three folded bands across the top, sloping down to the lower left (lines y = 0.6x + c).
    const bands = [
      [0x5ad2ff, [[-0.92, 0.368], [0, 0.92], [0.267, 0.76], [-0.92, 0.048]]],
      [0x1f6fe0, [[-0.92, 0.048], [0.267, 0.76], [0.533, 0.6], [-0.92, -0.272]]],
      [0x3a2fbf, [[-0.92, -0.272], [0.533, 0.6], [0.8, 0.44], [-0.92, -0.592]]],
    ].map(([color, pts]) => front(slab(poly(pts), 0.06, mat(color)), 0.18));
    // The V-shaped front flap rising from both bottom corners, light on the left.
    const flaps = [
      [0x45d4ff, [[-0.92, 0.18], [0.06, -0.37], [0.42, -0.78], [-0.92, -0.78]]],
      [0x12a2f2, [[0.06, -0.37], [0.92, 0.15], [0.92, -0.78], [0.42, -0.78]]],
    ].map(([color, pts]) => front(slab(poly(pts), 0.06, mat(color)), 0.23));
    // Dark blue tile with a white O, over the lower-left corner.
    const tile = front(slab(roundedRect(0.84, 0.84, 0.2), 0.2, mat(0x1458d0)), 0.34);
    tile.position.set(-0.6, -0.36, 0.34);
    const o = front(slab(ringShape(0.25, 0.14), 0.08, mat(0xffffff), 12), 0.47);
    o.position.set(-0.6, -0.36, 0.47);
    o.scale.y = 1.15;
    return group(body, ...bands, ...flaps, tile, o);
  },



  messages() {
    const tile = slab(roundedRect(2, 2, 0.5), 0.45, mat(0x34c759));
    const white = mat(0xffffff);
    const bubble = front(slab(roundedRect(1.36, 1, 0.46), 0.12, white), 0.27);
    bubble.position.y = 0.08;
    const tail = front(slab(poly([[-0.5, -0.3], [-0.68, -0.66], [-0.2, -0.38]]), 0.12, white), 0.27);
    return group(tile, bubble, tail);
  },

  'chrome-gemini'() {
    // Chrome: three 120-degree sectors, a white ring and a blue centre.
    const parts = [[0xdb4437, 30], [0xf4b400, 270], [0x0f9d58, 150]].map(([color, start]) => {
      const a0 = (start * Math.PI) / 180;
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.absarc(0, 0, 1, a0, a0 + (Math.PI * 2) / 3, false);
      s.lineTo(0, 0);
      return slab(s, 0.36, mat(color), 6);
    });
    const ring = front(disc(0.5, 0.4, mat(0xffffff)), 0.02);
    const centre = front(disc(0.38, 0.46, mat(0x4285f4)), 0.04);
    // Gemini: a small four-pointed star, two crossed thin diamonds.
    const diamond = poly([[0, 0.42], [0.08, 0], [0, -0.42], [-0.08, 0]]);
    const tall = slab(diamond, 0.08, mat(0x4285f4));
    const wide = slab(diamond, 0.1, mat(0x9b72cb));
    wide.rotation.z = Math.PI / 2;
    const star = group(tall, wide);
    star.position.set(0.95, 0.95, 0.25);
    return group(...parts, ring, centre, star);
  },

  pinterest() {
    const red = disc(1, 0.4, mat(0xe60023), 14);
    const white = mat(0xffffff);
    // The script p: a thick ring for the bowl, open at the lower left where the stem comes out...
    const deg = (d) => (d * Math.PI) / 180;
    const bowl = new THREE.Shape();
    bowl.absarc(0.06, 0.13, 0.58, deg(-95), deg(205), false);
    bowl.absarc(0.06, 0.13, 0.33, deg(205), deg(-95), true);
    const bowlMesh = front(slab(bowl, 0.12, white, 10), 0.24);
    // ...and a tapered stem slanting down past the bottom-left edge of the disc.
    const stem = front(slab(poly([[-0.24, 0.26], [-0.04, 0.27], [-0.18, -0.62], [-0.3, -0.95], [-0.36, -0.72]]), 0.12, white), 0.24);
    return group(red, bowlMesh, stem);
  },


  marketplace() {
    const blue = mat(0x1877f2);
    const white = mat(0xffffff);
    const tile = slab(roundedRect(2, 2, 0.5), 0.45, blue);
    const store = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 0.14), white);
    store.position.set(0, -0.3, 0.29);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.38, 0.16), blue);
    door.position.set(0, -0.42, 0.3);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.14, 0.16), white);
    bar.position.set(0, 0.2, 0.3);
    // Scalloped awning: half-cylinders hanging under the bar.
    const scallops = [];
    for (let i = 0; i < 5; i++) {
      const half = new THREE.Mesh(new THREE.CylinderGeometry(0.124, 0.124, 0.16, 8, 1, false, -Math.PI / 2, Math.PI), white);
      half.rotation.x = Math.PI / 2;
      half.position.set(-0.496 + i * 0.248, 0.13, 0.3);
      scallops.push(half);
    }
    return group(tile, store, door, bar, ...scallops);
  },

  steam() {
    const navy = disc(1, 0.4, mat(0x171a21), 14);
    const grey = mat(0xc7d5e0);
    const big = front(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 4, 12), grey), 0.24);
    big.position.set(0.3, 0.3, 0.24);
    const small = front(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.07, 4, 10), grey), 0.24);
    small.position.set(-0.46, -0.36, 0.24);
    // Thick bar joining the two rings.
    const a = new THREE.Vector2(-0.36, -0.28), b = new THREE.Vector2(0.14, 0.18);
    const len = a.distanceTo(b);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.12), grey);
    bar.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0.24);
    bar.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    return group(navy, big, small, bar);
  },

  fotmob() {
    const green = disc(1, 0.4, mat(0x00985f), 14);
    const white = mat(0xffffff);
    // The F: a vertical bar and a top bar with a rounded outer corner (no middle bar).
    const f = new THREE.Shape();
    f.moveTo(-0.52, -0.68);
    f.lineTo(-0.52, 0.71);
    f.lineTo(0.48, 0.71);
    f.quadraticCurveTo(0.59, 0.71, 0.59, 0.6);
    f.lineTo(0.59, 0.47);
    f.lineTo(-0.26, 0.47);
    f.lineTo(-0.26, -0.68);
    f.lineTo(-0.52, -0.68);
    const letter = front(slab(f, 0.12, white), 0.24);
    // The ball where the middle bar would end, with three speed streaks fanning out to the lower left.
    const ball = front(disc(0.18, 0.16, white, 10), 0.26);
    ball.position.set(0.13, -0.03, 0.26);
    // Each streak is a thin wedge, widening to the left, set just in front of the F so they don't flicker.
    const streaks = [
      [[-0.02, 0.05], [-0.97, -0.08], [-0.97, -0.25], [-0.02, -0.01]],
      [[-0.03, -0.05], [-0.93, -0.33], [-0.88, -0.48], [-0.02, -0.1]],
      [[-0.01, -0.13], [-0.82, -0.55], [-0.72, -0.67], [0.01, -0.17]],
    ].map((pts) => front(slab(poly(pts), 0.1, white), 0.29));
    // Thin green gaps either side of each streak, cutting across the F like in the real logo.
    const gapMat = mat(0x00985f);
    const gaps = [
      [[-0.02, 0.09], [-0.97, -0.02], [-0.97, -0.08], [-0.02, 0.05]],
      [[-0.02, -0.01], [-0.97, -0.25], [-0.93, -0.33], [-0.03, -0.05]],
      [[-0.02, -0.1], [-0.88, -0.48], [-0.82, -0.55], [-0.01, -0.13]],
      [[0.01, -0.17], [-0.72, -0.67], [-0.66, -0.74], [0.02, -0.21]],
    ].map((pts) => front(slab(poly(pts), 0.1, gapMat), 0.27));
    return group(green, letter, ball, ...streaks, ...gaps);
  },

};

export function buildLogo(name, fallbackColor) {
  const build = BUILDERS[name];
  if (build) return build();
  return group(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), mat(fallbackColor)));
}
