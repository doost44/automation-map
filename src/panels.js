import * as THREE from 'three';
import { canvas, crunchy } from './textures.js';
import { controlLabel } from './orbs.js';

const W = 512, H = 384;
const AMBER = '#ffb43c', WHITE = '#f2ecd8', DIM = '#8a8468';

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
  g.font = 'bold 22px "Courier New", monospace';
  g.textBaseline = 'middle';
  g.fillText(system.name.toUpperCase().slice(0, 34), 14, 25);
  g.font = 'bold 14px "Courier New", monospace';
  const cat = system.category.toUpperCase();
  g.fillText(cat, W - 14 - g.measureText(cat).width, 25);

  g.textBaseline = 'alphabetic';
  const label = (text, x, y) => {
    g.fillStyle = DIM;
    g.font = 'bold 13px "Courier New", monospace';
    g.fillText(text, x, y);
  };

  label('TIMES/DAY', 16, 72);
  g.fillStyle = WHITE;
  g.font = 'bold 64px "Courier New", monospace';
  g.fillText(String(system.timesPerDay), 16, 130);

  label('MINUTES/DAY', 200, 72);
  g.fillStyle = AMBER;
  g.font = 'bold 40px "Courier New", monospace';
  g.fillText(String(system.minutesPerDay), 200, 116);

  label('CONTROL', 360, 72);
  g.fillStyle = WHITE;
  g.font = 'bold 16px "Courier New", monospace';
  g.fillText(controlLabel(system.control).toUpperCase(), 360, 96);

  label('WHAT FOR', 16, 160);
  wrap(g, system.whatFor ?? '', 16, 180, W - 32, 18, WHITE, 2);

  // Response bar: went along / pushed back / noticed.
  const resp = system.response ?? {};
  const parts = [
    ['WENT ALONG', resp.wentAlong ?? 0, '#d8a03a'],
    ['PUSHED BACK', resp.pushedBack ?? 0, '#d0503a'],
    ['NOTICED', resp.noticed ?? 0, '#4fa3c9'],
  ];
  const total = parts.reduce((s, p) => s + p[1], 0) || 1;
  label('HOW I RESPONDED', 16, 232);
  let x = 16;
  for (const [, n, col] of parts) {
    const w = ((W - 32) * n) / total;
    g.fillStyle = col;
    g.fillRect(x, 240, w, 16);
    x += w;
  }
  g.font = 'bold 12px "Courier New", monospace';
  let lx = 16;
  for (const [name, n, col] of parts) {
    g.fillStyle = col;
    const t = `${name} ${n}`;
    g.fillText(t, lx, 272);
    lx += g.measureText(t).width + 18;
  }

  label('KEPT FOR MYSELF', 16, 300);
  wrap(g, system.keptForMyself ?? '', 16, 318, W - 32, 18, WHITE, 1);

  label('LOG', 16, 344);
  wrap(g, system.notes ?? '', 16, 362, W - 32, 16, AMBER, 1, 14);

  // Scanlines.
  g.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);

  return crunchy(c);
}

function wrap(g, text, x, y, maxW, lineH, color, maxLines, size = 16) {
  g.fillStyle = color;
  g.font = `bold ${size}px "Courier New", monospace`;
  const words = String(text).split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (g.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) { line += '…'; break; }
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
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 4.5),
      new THREE.MeshBasicMaterial({ map: drawPanel(orb.system, orb.color), fog: false }),
    );
    mesh.userData.orb = orb;
    scene.add(mesh);

    const tether = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffb43c, transparent: true, opacity: 0.5 }),
    );
    tether.frustumCulled = false;
    scene.add(tether);

    const panel = { orb, mesh, tether, brightness: 0.4, read: 0 };
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

    const pos = p.tether.geometry.attributes.position;
    pos.setXYZ(0, ...o.group.position.toArray());
    pos.setXYZ(1, p.mesh.position.x - _side.x * 3, p.mesh.position.y, p.mesh.position.z - _side.z * 3);
    pos.needsUpdate = true;

    const lit = o.targeted || o.held;
    const target = lit ? 1 : THREE.MathUtils.clamp(1.1 - dist / 70, 0.3, 0.6);
    p.brightness += (target - p.brightness) * Math.min(1, dt * 8);
    p.mesh.material.color.setScalar(p.brightness);
    p.tether.material.opacity = p.brightness * 0.7;
  }
}
