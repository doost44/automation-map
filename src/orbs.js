import * as THREE from 'three';
import { wordTexture, rng } from './textures.js';
import { buildLogo } from './logos.js';

// Retro palette, one colour per category.
export const CATEGORY_COLORS = {
  feed: 0xe0503c,
  recommendation: 0xe8a33a,
  pricing: 0x7fc24a,
  moderation: 0x4fa3c9,
  autocomplete: 0xb06ad8,
  'ai-tool': 0x3ad6b8,
  navigation: 0xd8d24a,
  search: 0x6c7cf4,
  notification: 0xf06aa8,
  other: 0x9a9a9a,
};

const MIN_AIM = 1.4; // smallest aim/grab sphere, so tiny orbs are still easy to click

const CONTROL_LABELS = {
  'chosen-for-me': 'chosen for me',
  'chosen-by-me': 'chosen by me',
  delegated: 'delegated',
};
export const controlLabel = (c) => CONTROL_LABELS[c] ?? c;

export function buildOrbs(scene, systems) {
  const r = rng(99);
  const maxMinutes = Math.max(...systems.map((s) => s.minutesPerDay || 0), 1);
  const orbs = [];

  systems.forEach((system, i) => {
    const color = CATEGORY_COLORS[system.category] ?? CATEGORY_COLORS.other;
    const radius = 0.7 + Math.sqrt(system.timesPerDay || 1) * 0.32;
    const glow = 0.15 + 0.85 * ((system.minutesPerDay || 0) / maxMinutes);

    const group = new THREE.Group();
    // Invisible sphere that grabs, aiming and rock hits test against.
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(Math.max(radius, MIN_AIM), 1), new THREE.MeshBasicMaterial({ visible: false }));
    group.add(mesh);

    // The logo itself, glowing by minutes per day.
    const body = buildLogo(system.logo, color);
    body.scale.setScalar(radius * 0.9);
    group.add(body);
    const materials = [];
    body.traverse((m) => {
      if (!m.isMesh) return;
      for (const mt of [m.material].flat()) {
        if (mt.map) { mt.emissiveMap = mt.map; mt.emissive.set(0xffffff); } else mt.emissive.copy(mt.color);
        mt.emissiveIntensity = glow * 0.45;
        mt.userData.glow = { color: mt.emissive.clone(), intensity: mt.emissiveIntensity };
        materials.push(mt);
      }
    });

    // A moon on a tilted orbit in the category colour, like an electron round an atom.
    const tilt = new THREE.Group();
    tilt.rotation.set((r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
    const electron = new THREE.Group();
    const moon = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 0.16, 0),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6, flatShading: true }),
    );
    moon.position.x = radius * 1.45;
    electron.add(moon);
    tilt.add(electron, orbitLine(radius * 1.45, color));
    group.add(tilt);

    // Highlight shell, shown when targeted or held.
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * 1.12, 1),
      new THREE.MeshBasicMaterial({ color: 0xffb43c, wireframe: true, transparent: true, opacity: 0.9 }),
    );
    shell.visible = false;
    group.add(shell);

    // Rings of words: split the words over one or two tilted rings.
    const words = system.words ?? [];
    const ringCount = words.length > 5 ? 2 : 1;
    const rings = [];
    for (let k = 0; k < ringCount; k++) {
      const ring = new THREE.Group();
      ring.rotation.set((r() - 0.5) * 1.2 + (k ? 0.9 : 0), r() * Math.PI, (r() - 0.5) * 0.8);
      const ringWords = words.filter((_, w) => w % ringCount === k);
      const ringRadius = radius + 1.4 + k * 1.1;
      ringWords.forEach((word, w) => {
        const { texture, aspect } = wordTexture(word);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
        const h = 0.55;
        sprite.scale.set(h * aspect, h, 1);
        const a = (w / ringWords.length) * Math.PI * 2;
        sprite.position.set(Math.cos(a) * ringRadius, 0, Math.sin(a) * ringRadius);
        ring.add(sprite);
      });
      ring.userData.spin = (0.25 + r() * 0.3) * (k ? -1 : 1);
      group.add(ring);
      rings.push(ring);
    }

    // Control decides the orbit: things chosen for me sit far out and move fast.
    const forMe = system.control === 'chosen-for-me';
    const orbitRadius = forMe ? 27 + r() * 12 : 13 + r() * 7;
    const orbitSpeed = (forMe ? 0.05 : 0.018) * (0.7 + r() * 0.6);
    const angle = (i / systems.length) * Math.PI * 2 + r() * 0.4;
    const height = (forMe ? 3 : 1.5) + r() * 9;

    scene.add(group);

    const orb = {
      system, group, mesh, body, materials, electron, shell, rings, radius, color,
      angle, orbitRadius, orbitSpeed, height,
      bobPhase: r() * Math.PI * 2,
      orbitPos: new THREE.Vector3(),
      held: false,
      returning: false,
      targeted: false,
      free: false, // flying loose after a fling, bump or rock hit
      vel: new THREE.Vector3(), // velocity while free
      heldVel: new THREE.Vector3(), // how fast it moves while held (set by interaction.js)
      wobble: 0,
      flash: 0,
    };
    mesh.userData.orb = orb;
    orbs.push(orb);
  });

  spreadOut(orbs);
  for (const o of orbs) o.home = { angle: o.angle, orbitRadius: o.orbitRadius, orbitSpeed: o.orbitSpeed, height: o.height };
  const lines = buildConnections(scene, orbs);
  return { orbs, lines };
}

const DRAG = 0.3; // fraction of speed kept per second while flying loose
const SETTLE_SPEED = 0.6;
const BOUNCE = 0.8;
const SIZE = 1.15; // collision radius, relative to the orb radius

// Cut an orb loose from its orbit, moving at its current orbit speed.
function makeFree(o) {
  if (o.free || o.held) return;
  o.free = true;
  o.returning = false;
  const r = o.orbitRadius;
  o.vel.set(-Math.sin(o.angle) * r, 0, Math.cos(o.angle) * r).multiplyScalar(o.orbitSpeed);
}

// Send every orb back to its original, evenly spaced orbit (they glide there).
export function resetOrbits(orbs) {
  for (const o of orbs) {
    if (o.held) continue;
    Object.assign(o, o.home);
    o.free = false;
    o.vel.set(0, 0, 0);
    o.returning = true;
  }
}

// Pick up orbiting again from wherever the orb is now, at its usual speed.
export function settle(o) {
  const p = o.group.position;
  o.orbitRadius = Math.hypot(p.x, p.z);
  o.angle = Math.atan2(p.z, p.x);
  o.height = p.y;
  o.free = false;
  o.vel.set(0, 0, 0);
  o.returning = true; // smooths over the small bob offset
}

// Let go of a held orb: a quick swipe throws it, otherwise it just starts orbiting there.
export function releaseOrb(o) {
  o.held = false;
  o.reading = false;
  if (o.heldVel.length() > 2) {
    o.free = true;
    o.vel.copy(o.heldVel).multiplyScalar(1.3).clampLength(0, 40);
  } else {
    settle(o);
  }
}

// A rock hit: shove the orb along the throw, squash it and flash it white.
export function hitOrb(orb, dir) {
  makeFree(orb);
  if (!orb.held) orb.vel.addScaledVector(dir, 12);
  orb.wobble = 1;
  orb.flash = 1;
}

function fly(o, dt) {
  const p = o.group.position;
  p.addScaledVector(o.vel, dt);
  o.vel.multiplyScalar(Math.pow(DRAG, dt));
  // Soft walls: stay above the island and inside the sky.
  if (p.y < o.radius + 1 && o.vel.y < 0) o.vel.y *= -BOUNCE;
  if (p.y > 40 && o.vel.y > 0) o.vel.y *= -BOUNCE;
  const out = Math.hypot(p.x, p.z);
  if (out > 70) {
    const nx = p.x / out, nz = p.z / out;
    const along = o.vel.x * nx + o.vel.z * nz;
    if (along > 0) { o.vel.x -= 2 * along * nx; o.vel.z -= 2 * along * nz; }
  }
  if (o.vel.length() < SETTLE_SPEED) settle(o);
}

// Orbs bounce off each other like balls; bigger ones are heavier. Held orbs push but don't budge.
const _n = new THREE.Vector3();
const _va = new THREE.Vector3();
const _vb = new THREE.Vector3();
function collide(orbs) {
  for (let i = 0; i < orbs.length; i++) {
    for (let j = i + 1; j < orbs.length; j++) {
      const a = orbs[i], b = orbs[j];
      if (a.held && b.held) continue;
      _n.subVectors(b.group.position, a.group.position);
      const dist = _n.length();
      const min = (a.radius + b.radius) * SIZE;
      if (dist >= min || dist < 1e-4) continue;
      _n.divideScalar(dist);
      makeFree(a);
      makeFree(b);
      const ia = a.held ? 0 : 1 / a.radius ** 3; // inverse mass
      const ib = b.held ? 0 : 1 / b.radius ** 3;
      // Push apart so they no longer overlap.
      const push = (min - dist) / (ia + ib);
      a.group.position.addScaledVector(_n, -push * ia);
      b.group.position.addScaledVector(_n, push * ib);
      // Bounce: swap momentum along the line between them.
      _va.copy(a.held ? a.heldVel : a.vel);
      _vb.copy(b.held ? b.heldVel : b.vel);
      const closing = _vb.sub(_va).dot(_n);
      const impulse = (-(1 + BOUNCE) * Math.min(closing, -1.5)) / (ia + ib);
      a.vel.addScaledVector(_n, -impulse * ia);
      b.vel.addScaledVector(_n, impulse * ib);
      a.wobble = Math.max(a.wobble, 0.4);
      b.wobble = Math.max(b.wobble, 0.4);
    }
  }
}

const WHITE = new THREE.Color(0xffffff);

function updateHit(o, t, dt) {
  if (o.wobble > 0.01) {
    o.wobble *= Math.pow(0.04, dt);
    const s = 1 + 0.35 * o.wobble * Math.sin(t * 30);
    const b = o.radius * 0.9;
    o.body.scale.set(b * s, b * (2 - s), b * s);
  } else {
    o.body.scale.setScalar(o.radius * 0.9);
  }
  if (o.flash > 0) {
    o.flash = Math.max(0, o.flash - dt * 3);
    for (const m of o.materials) {
      m.emissive.copy(m.userData.glow.color).lerp(WHITE, o.flash);
      m.emissiveIntensity = m.userData.glow.intensity + o.flash * 1.5;
    }
  }
}

// Lift orbs whose starting spots overlap until every pair is clear.
function spreadOut(orbs) {
  const start = (o) => new THREE.Vector3(
    Math.cos(o.angle) * o.orbitRadius, o.height + Math.sin(o.bobPhase) * 0.5, Math.sin(o.angle) * o.orbitRadius,
  );
  for (let pass = 0; pass < 50; pass++) {
    let moved = false;
    for (let i = 0; i < orbs.length; i++) {
      for (let j = i + 1; j < orbs.length; j++) {
        const a = orbs[i], b = orbs[j];
        const gap = start(a).distanceTo(start(b)) - (a.radius + b.radius) * SIZE - 1;
        if (gap < 0) { b.height += -gap + 0.5; moved = true; }
      }
    }
    if (!moved) break;
  }
}

// A thin circle in the XZ plane, for the moon's orbit.
function orbitLine(radius, color) {
  const pts = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5 }),
  );
}

// One line per feedsInto pair, so a held orb can brighten its own lines.
function buildConnections(scene, orbs) {
  const byId = new Map(orbs.map((o) => [o.system.id, o]));
  const seen = new Set();
  const lines = [];
  for (const a of orbs) {
    for (const id of a.system.feedsInto ?? []) {
      const b = byId.get(id);
      const key = [a.system.id, id].sort().join('|');
      if (!b || seen.has(key)) continue;
      seen.add(key);
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.35 });
      const line = new THREE.Line(geo, mat);
      line.frustumCulled = false;
      scene.add(line);
      lines.push({ a, b, line, phase: Math.random() * 10 });
    }
  }
  return lines;
}

export function updateOrbs(orbs, lines, t, dt) {
  for (const o of orbs) {
    o.angle += o.orbitSpeed * dt;
    o.orbitPos.set(
      Math.cos(o.angle) * o.orbitRadius,
      o.height + Math.sin(t * 0.8 + o.bobPhase) * 0.5,
      Math.sin(o.angle) * o.orbitRadius,
    );
    // Held orbs are positioned by interaction.js; loose ones fly; the rest orbit.
    if (o.free) {
      fly(o, dt);
    } else if (!o.held) {
      if (o.returning) {
        o.group.position.lerp(o.orbitPos, 1 - Math.pow(0.02, dt));
        if (o.group.position.distanceTo(o.orbitPos) < 0.05) o.returning = false;
      } else {
        o.group.position.copy(o.orbitPos);
      }
    }
    updateHit(o, t, dt);
    o.body.rotation.y += dt * 0.5;
    o.electron.rotation.y += dt * 2;
    for (const ring of o.rings) ring.rotation.y += ring.userData.spin * dt;
    o.shell.visible = o.targeted || o.held;
  }
  collide(orbs);

  for (const l of lines) {
    const p = l.line.geometry.attributes.position;
    p.setXYZ(0, ...l.a.group.position.toArray());
    p.setXYZ(1, ...l.b.group.position.toArray());
    p.needsUpdate = true;
    const hot = l.a.held || l.b.held;
    const flicker = Math.sin(t * 13 + l.phase) * Math.sin(t * 7.3 + l.phase * 2) > 0.6 ? 0.4 : 1;
    l.line.material.opacity = (hot ? 1 : 0.35) * flicker;
  }
}
