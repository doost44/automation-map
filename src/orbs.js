import * as THREE from 'three';
import { wordTexture, rng } from './textures.js';

// Retro palette, one colour per category.
export const CATEGORY_COLORS = {
  feed: 0xe0503c,
  recommendation: 0xe8a33a,
  pricing: 0x7fc24a,
  moderation: 0x4fa3c9,
  autocomplete: 0xb06ad8,
  'ai-tool': 0x3ad6b8,
  navigation: 0xd8d24a,
  other: 0x9a9a9a,
};

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
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      new THREE.MeshLambertMaterial({
        color,
        emissive: color,
        emissiveIntensity: glow * 0.6,
        flatShading: true,
      }),
    );
    group.add(mesh);

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
      system, group, mesh, shell, rings, radius, color,
      angle, orbitRadius, orbitSpeed, height,
      bobPhase: r() * Math.PI * 2,
      orbitPos: new THREE.Vector3(),
      held: false,
      returning: false,
      targeted: false,
    };
    mesh.userData.orb = orb;
    orbs.push(orb);
  });

  const lines = buildConnections(scene, orbs);
  return { orbs, lines };
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
    // Held orbs are positioned by interaction.js; released ones ease home.
    if (!o.held) {
      if (o.returning) {
        o.group.position.lerp(o.orbitPos, 1 - Math.pow(0.02, dt));
        if (o.group.position.distanceTo(o.orbitPos) < 0.05) o.returning = false;
      } else {
        o.group.position.copy(o.orbitPos);
      }
    }
    o.mesh.rotation.y += dt * 0.2;
    for (const ring of o.rings) ring.rotation.y += ring.userData.spin * dt;
    o.shell.visible = o.targeted || o.held;
  }

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
