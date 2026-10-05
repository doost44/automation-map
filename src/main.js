import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld } from './world.js';
import { buildChair } from './chair.js';
import { buildOrbs, updateOrbs } from './orbs.js';
import { buildPanels, updatePanels } from './panels.js';
import { createInteraction } from './interaction.js';
import { createRocks } from './rocks.js';
import { createPlayer, START } from './player.js';
import { createDoom } from './doom.js';
import { setSubtitle, showTotals, showError } from './hud.js';
import { capturePNG } from './capture.js';

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
const player = createPlayer(camera, controls, keys);

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

let orbs = [], lines = [], panels = [], interaction = null, rocks = null, doom = null, data = null;

try {
  const res = await fetch('data/log.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  data = await res.json();
  ({ orbs, lines } = buildOrbs(scene, data.systems));
  panels = buildPanels(scene, orbs);
  interaction = createInteraction(camera, controls, orbs, panels);
  rocks = createRocks(scene, camera, controls, orbs, panels);
  doom = createDoom(scene, camera, rocks, player);
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

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (!overview.on) player.update(dt);
  updateOrbs(orbs, lines, t, dt);
  interaction?.update(dt);
  updatePanels(panels, camera, dt);
  rocks?.update(dt);
  doom?.update(dt, t);
  renderer.render(scene, camera);
});

// Handy for debugging in the browser console.
window.automationMap = { scene, camera, orbs, panels, rocks, player, doom, toggleOverview };
