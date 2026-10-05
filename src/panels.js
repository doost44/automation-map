import * as THREE from 'three';
import { canvas, crunchy } from './textures.js';
import { controlLabel } from './orbs.js';
import { showReader } from './hud.js';

const W = 512, H = 384;
const AMBER = '#ffb43c', WHITE = '#f2ecd8', DIM = '#b0a888';
const FONT = (size) => `bold ${size}px 'Courier New', monospace`;

// Draw one terminal-style panel for a system.
function drawPanel(system, color) {
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const hex = '#' + color.toString(16).padStart(6, '0');

  g.fillStyle = '#1e2420';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = AMBER;
  g.lineWidth = 4;
  g.strokeRect(2, 2, W - 4, H - 4);

  // Header bar.
  g.fillStyle = hex;
  g.fillRect(4, 4, W - 8, 40);
  g.fillStyle = '#111';
  g.textBaseline = 'middle';
  g.font = FONT(14);
  const cat = system.category.toUpperCase();
  const catW = g.measureText(cat).width;
  g.fillText(cat, W - 14 - catW, 25);
  g.font = FONT(22);
  g.fillText(fit(g, system.name.toUpperCase(), W - 50 - catW), 14, 25);

  g.textBaseline = 'alphabetic';
  const label = (text, x, y) => {
    g.fillStyle = DIM;
    g.font = FONT(14);
    g.fillText(text, x, y);
  };

  label('TIMES/DAY', 16, 70);
  g.fillStyle = WHITE;
  g.font = FONT(60);
  g.fillText(String(system.timesPerDay), 16, 126);

  label('MINUTES/DAY', 196, 70);
  g.fillStyle = AMBER;
  g.font = FONT(40);
  g.fillText(String(system.minutesPerDay), 196, 114);

  label('CONTROL', 352, 70);
  wrap(g, controlLabel(system.control).toUpperCase(), 352, 94, W - 368, 18, WHITE, 2);

  label('WHAT FOR', 16, 152);
  wrap(g, system.whatFor ?? '', 16, 172, W - 32, 18, WHITE, 2);

  // Response bar: went along / pushed back / noticed.
  const resp = system.response ?? {};
  const parts = [
    ['WENT ALONG', resp.wentAlong ?? 0, '#e0aa44'],
    ['PUSHED BACK', resp.pushedBack ?? 0, '#e86048'],
    ['NOTICED', resp.noticed ?? 0, '#5cb4dc'],
  ];
  const total = parts.reduce((s, p) => s + p[1], 0) || 1;
  label('HOW I RESPONDED', 16, 220);
  let x = 16;
  for (const [, n, col] of parts) {
    const w = ((W - 32) * n) / total;
    g.fillStyle = col;
    g.fillRect(x, 228, w, 16);
    x += w;
  }
  g.font = FONT(13);
  let lx = 16;
  for (const [name, n, col] of parts) {
    g.fillStyle = col;
    const t = `${name} ${n}`;
    g.fillText(t, lx, 262);
    lx += g.measureText(t).width + 18;
  }

  label('KEPT FOR MYSELF', 16, 288);
  wrap(g, system.keptForMyself ?? '', 16, 306, W - 32, 18, WHITE, 1);

  label('LOG', 16, 330);
  wrap(g, system.notes ?? '', 16, 348, W - 32, 18, AMBER, 2, 15);

  // Scanlines.
  g.fillStyle = 'rgba(0,0,0,0.2)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);

  return crunchy(c);
}

// Shorten text with an ellipsis until it fits.
function fit(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text;
  while (text.length > 1 && g.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text.trimEnd() + '…';
}

function wrap(g, text, x, y, maxW, lineH, color, maxLines, size = 16) {
  g.fillStyle = color;
  g.font = FONT(size);
  const words = String(text).split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) { line = fit(g, line + ' ' + words.slice(i).join(' '), maxW); break; }
      g.fillText(line, x, y + lines * lineH);
      lines++;
      line = words[i];
    } else {
      line = test;
    }
  }
  g.fillText(line, x, y + lines * lineH);
}

export function buildPanels(scene, orbs) {
  return orbs.map((orb) => {
    const screen = drawPanel(orb.system, orb.color);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 4.5),
      new THREE.MeshBasicMaterial({ map: screen, fog: false, transparent: true }),
    );
    mesh.userData.orb = orb;
    scene.add(mesh);

    const tether = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffb43c, transparent: true, opacity: 0.5 }),
    );
    tether.frustumCulled = false;
    scene.add(tether);

    const panel = { orb, mesh, tether, brightness: 0.4, read: 0, screen, shake: 0, glitch: 0 };
    orb.panel = panel;
    return panel;
  });
}

const _toCam = new THREE.Vector3();
const _side = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _front = new THREE.Vector3();
const READ_DIST = 4.6; // close enough that the 6 x 4.5 panel fills most of the view

export function updatePanels(panels, camera, dt) {
  let reading = null;
  for (const p of panels) {
    const o = p.orb;
    // Sit beside the orb, on its right as seen from the player.
    _toCam.subVectors(camera.position, o.group.position);
    const dist = _toCam.length();
    _side.crossVectors(UP, _toCam).normalize();
    p.mesh.position.copy(o.group.position)
      .addScaledVector(_side, o.radius + 4)
      .addScaledVector(UP, 1);
    p.mesh.lookAt(camera.position);

    // Reading mode: glide to the middle of the view, square to the screen.
    p.read += ((o.reading ? 1 : 0) - p.read) * Math.min(1, dt * 7);
    if (p.read > 0.001) {
      camera.getWorldDirection(_dir);
      _front.copy(camera.position).addScaledVector(_dir, READ_DIST);
      p.mesh.position.lerp(_front, p.read);
      p.mesh.quaternion.slerp(camera.quaternion, p.read);
    }
    if (o.reading && p.read > 0.9) reading = p;

    const pos = p.tether.geometry.attributes.position;
    pos.setXYZ(0, ...o.group.position.toArray());
    pos.setXYZ(1, p.mesh.position.x - _side.x * 3, p.mesh.position.y, p.mesh.position.z - _side.z * 3);
    pos.needsUpdate = true;

    const lit = o.targeted || o.held;
    const target = lit ? 1 : THREE.MathUtils.clamp(1.1 - dist / 70, 0.3, 0.6);
    p.brightness += (target - p.brightness) * Math.min(1, dt * 8);
    p.mesh.material.color.setScalar(p.brightness);
    // Panels ignore fog to stay readable, so fade them out by hand when very far
    // away (e.g. while falling through the void).
    const far = THREE.MathUtils.clamp((150 - dist) / 50, 0, 1);
    p.mesh.material.opacity = far;
    p.mesh.visible = far > 0;
    p.tether.material.opacity = p.brightness * 0.7 * far;
    if (p.shake > 0.01 || p.glitch > 0) reactToHit(p, dt);
  }
  // Once the panel has arrived, show its canvas as a sharp 2D overlay exactly on top,
  // so nothing in the scene (word rings, other panels) can cover or blur it.
  showReader(reading?.screen.image ?? null);
}

// --- Rock hits -------------------------------------------------------------

const GLITCH_COLORS = [[1, 0.25, 0.25], [0.25, 1, 1], [0.3, 1, 0.4], [0.1, 0.1, 0.1]];
let staticTex = null;

// Shared TV-static texture, scrolled randomly so it looks alive.
function staticTexture() {
  if (staticTex) return staticTex;
  const c = canvas(128, 96);
  const g = c.getContext('2d');
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 128; x++) {
      const v = (Math.random() * 255) | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x, y, 1, 1);
    }
  }
  staticTex = crunchy(c, 2);
  return staticTex;
}

// Shake, flicker between static and colour-split glitches, then settle.
function reactToHit(p, dt) {
  p.shake *= Math.pow(0.02, dt);
  p.mesh.translateX((Math.random() - 0.5) * p.shake * 0.5);
  p.mesh.translateY((Math.random() - 0.5) * p.shake * 0.5);

  const mat = p.mesh.material;
  p.glitch -= dt;
  if (p.glitch <= 0) {
    mat.map = p.screen;
    return;
  }
  const roll = Math.random();
  if (roll < 0.3) {
    mat.map = staticTexture();
    staticTex.offset.set(Math.random(), Math.random());
  } else {
    mat.map = p.screen;
    if (roll < 0.75) mat.color.setRGB(...GLITCH_COLORS[(Math.random() * GLITCH_COLORS.length) | 0]);
  }
}

// Crack the panel's screen where the rock hit (uv on the plane). Cracks stay and stack.
export function crackPanel(p, uv) {
  const g = p.screen.image.getContext('2d');
  const x = uv.x * W;
  const y = (1 - uv.y) * H;

  // Dead pixels: a dark patch with a few stuck bright pixels.
  g.fillStyle = 'rgba(0,0,0,0.9)';
  jagged(g, x, y, 14, 9);
  g.fill();
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * Math.random() * 40;
    g.fillStyle = Math.random() < 0.8 ? '#050505' : ['#f0f', '#0f4', '#08f', '#fff'][i % 4];
    const s = 2 + ((Math.random() * 4) | 0);
    g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, s, s);
  }

  // Small shatter ring round the impact.
  g.strokeStyle = 'rgba(230,240,240,0.9)';
  g.lineWidth = 1.5;
  jagged(g, x, y, 22, 12);
  g.stroke();

  // Jagged cracks radiating out, some branching.
  const n = 8 + ((Math.random() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    crackLine(g, x, y, a, 60 + Math.random() * 150, 2);
  }
  p.screen.needsUpdate = true;
  p.shake = 1;
  p.glitch = 0.7;
}

function jagged(g, x, y, r, points) {
  g.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const d = r * (0.7 + Math.random() * 0.5);
    g.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  g.closePath();
}

function crackLine(g, x, y, angle, length, depth) {
  const pts = [[x, y]];
  let px = x, py = y, a = angle, travelled = 0;
  while (travelled < length) {
    const seg = 10 + Math.random() * 14;
    a += (Math.random() - 0.5) * 0.7;
    px += Math.cos(a) * seg;
    py += Math.sin(a) * seg;
    travelled += seg;
    pts.push([px, py]);
  }
  // Dark gap with a bright edge, like broken glass catching light.
  for (const [style, width, off] of [['rgba(0,0,0,0.85)', 3, 0], ['rgba(235,245,245,0.85)', 1, 1]]) {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    for (const [qx, qy] of pts) g.lineTo(qx + off, qy + off);
    g.stroke();
  }
  if (depth > 0 && Math.random() < 0.45) {
    const [bx, by] = pts[(pts.length / 2) | 0];
    crackLine(g, bx, by, angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), length * 0.4, depth - 1);
  }
}
