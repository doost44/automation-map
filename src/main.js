import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildWorld } from './world.js';
import { buildChair } from './chair.js';
import { buildOrbs, updateOrbs, resetOrbits } from './orbs.js';
import { buildPanels, updatePanels } from './panels.js';
import { createInteraction } from './interaction.js';
import { createRocks } from './rocks.js';
import { createPlayer, START } from './player.js';
import { createDoom } from './doom.js';
import { createOptions } from './options.js';
import { steadyMouse } from './mouse.js';
import { startSound, updateSound } from './sound.js';
import { setSubtitle, showTotals, showError } from './hud.js';
import { capturePNG } from './capture.js';

const OVERVIEW = new THREE.Vector3(38, 22, 42);

const canvas = document.getElementById('view');
const overlay = document.getElementById('overlay');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(0.5); // half internal resolution, upscaled pixelated by CSS (changeable in options)
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
steadyMouse(controls);
overlay.addEventListener('click', () => {
  options.restoreFullscreen();
  startSound(); // browsers only allow audio to start from a click
  controls.lock();
});
controls.addEventListener('lock', () => {
  overlay.classList.add('hidden');
  document.activeElement?.blur(); // so Space (jump) doesn't press a menu button
});
controls.addEventListener('unlock', () => {
  interaction?.release();
  if (!overview.on && !options.isOpen) overlay.classList.remove('hidden');
});

const options = createOptions({
  renderer, camera, controls,
  onOpen: () => overlay.classList.add('hidden'),
  onClose: () => { if (!overview.on) overlay.classList.remove('hidden'); },
  onResetOrbs: () => resetOrbs(),
});
document.getElementById('options-button').addEventListener('click', (e) => {
  e.stopPropagation(); // don't also enter the game
  options.open();
});

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; });
addEventListener('keyup', (e) => { keys[e.code] = false; });
const player = createPlayer(camera, controls, keys);
player.chair = chair;

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
  player.orbs = orbs;
  setSubtitle(data);
  showTotals(data);
} catch (err) {
  showError(`Could not load data/log.json: ${err.message}`);
}

addEventListener('keydown', (e) => {
  // With Esc taken over in fullscreen (see options.js), a tap still frees the mouse.
  if (e.code === 'Escape' && controls.isLocked) controls.unlock();
  if (e.code === 'KeyC') toggleOverview();
  if (e.code === 'KeyR') resetOrbs();
  if (e.code === 'KeyE') player.toggleSit();
  if (e.code === 'KeyP' && data) {
    capturePNG({ renderer, scene, camera, data, beforeRender: () => updatePanels(panels, camera, 1) });
  }
});

// R or the options button: drop anything held, then every orb glides back to its original orbit.
function resetOrbs() {
  interaction?.release();
  resetOrbits(orbs);
}

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
  updateSound(dt, camera, orbs);
  renderer.render(scene, camera);
});

// Handy for debugging in the browser console.
window.automationMap = { scene, camera, controls, keys, orbs, panels, rocks, player, doom, toggleOverview };
