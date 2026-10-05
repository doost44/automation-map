import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld, PLATFORM_RADIUS } from './world.js';
import { buildChair } from './chair.js';
import { buildOrbs, updateOrbs } from './orbs.js';
import { buildPanels, updatePanels } from './panels.js';
import { createInteraction } from './interaction.js';
import { setSubtitle, showTotals, showError } from './hud.js';
import { capturePNG } from './capture.js';

const EYE = 1.7;
const SPEED = 4.5;
const START = new THREE.Vector3(1.4, EYE, 1.2);
const OVERVIEW = new THREE.Vector3(38, 22, 42);

const canvas = document.getElementById('view');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(0.5); // half internal resolution, upscaled pixelated by CSS
renderer.setSize(innerWidth, innerHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 400);
camera.position.copy(START);
camera.lookAt(-4, 4, 30);

buildWorld(scene);
const chair = buildChair();
chair.rotation.y = 0.3;
scene.add(chair);

const controls = new PointerLockControls(camera, document.body);
overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => {
  interaction?.release();
  if (!overview.on) overlay.classList.remove('hidden');
});

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// C toggles an elevated three-quarter view for the submission still.
const overview = { on: false, pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
function toggleOverview() {
  overview.on = !overview.on;
  document.body.classList.toggle('overview', overview.on);
  if (overview.on) {
    overview.pos.copy(camera.position);
    overview.quat.copy(camera.quaternion);
    controls.unlock();
    overlay.classList.add('hidden');
    camera.position.copy(OVERVIEW);
    camera.lookAt(-4, -1, 0);
  } else {
    camera.position.copy(overview.pos);
    camera.quaternion.copy(overview.quat);
    overlay.classList.remove('hidden');
  }
}

let orbs = [], lines = [], panels = [], interaction = null, data = null;

try {
  const res = await fetch('data/log.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
  ({ orbs, lines } = buildOrbs(scene, data.systems));
  panels = buildPanels(scene, orbs);
  interaction = createInteraction(camera, controls, orbs, panels);
  setSubtitle(data);
  showTotals(data.systems);
} catch (err) {
  showError(`Could not load data/log.json: ${err.message}`);
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyC') toggleOverview();
  if (e.code === 'KeyP' && data) {
    capturePNG({ renderer, scene, camera, data, beforeRender: () => updatePanels(panels, camera, 1) });
  }
});

const clock = new THREE.Clock();
const move = new THREE.Vector3();

function walk(dt) {
  if (!controls.isLocked) return;
  move.set(
    (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    0,
    (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
  );
  if (move.lengthSq() === 0) return;
  move.normalize().multiplyScalar(SPEED * dt);
  controls.moveRight(move.x);
  controls.moveForward(move.z);

  // Stay on the platform.
  const p = camera.position;
  const d = Math.hypot(p.x, p.z);
  const max = PLATFORM_RADIUS - 0.6;
  if (d > max) { p.x *= max / d; p.z *= max / d; }
  p.y = EYE;
}

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  walk(dt);
  updateOrbs(orbs, lines, t, dt);
  interaction?.update(dt);
  updatePanels(panels, camera, dt);
  renderer.render(scene, camera);
});

// Handy for debugging in the browser console.
window.automationMap = { scene, camera, orbs, toggleOverview };
