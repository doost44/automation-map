import * as THREE from 'three';
import { showTarget } from './hud.js';

const CENTER = new THREE.Vector2(0, 0);
const MAX_DIST = 40;
const SWIPE = 40; // horizontal wheel distance that counts as a swipe

export function createInteraction(camera, controls, orbs, panels) {
  const raycaster = new THREE.Raycaster();
  const targets = [...orbs.map((o) => o.mesh), ...panels.map((p) => p.mesh)];
  const state = { targeted: null, held: null, dist: 0, wantDist: 0, swipe: 0 };

  // Reading mode brings the held orb's panel to the middle of the view.
  function setReading(on) {
    if (state.held) state.held.reading = on;
  }

  document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked || e.button !== 0) return;
    if (state.held) {
      release();
    } else if (state.targeted) {
      const o = state.targeted;
      o.held = true;
      o.returning = false;
      state.held = o;
      state.dist = state.wantDist = camera.position.distanceTo(o.group.position);
    }
  });

  document.addEventListener('wheel', (e) => {
    if (!state.held) return;
    // Two-finger swipe on a trackpad: right reads the panel, left goes back to the orb.
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      state.swipe += e.deltaX;
      if (Math.abs(state.swipe) > SWIPE) {
        setReading(state.swipe > 0);
        state.swipe = 0;
      }
      return;
    }
    state.swipe = 0;
    if (state.held.reading) return;
    const min = state.held.radius + 1.5;
    state.wantDist = THREE.MathUtils.clamp(state.wantDist + Math.sign(e.deltaY) * 1.5, min, MAX_DIST);
  }, { passive: true });

  addEventListener('keydown', (e) => {
    if (!state.held) return;
    if (e.code === 'KeyF') setReading(!state.held.reading);
    if (e.code === 'ArrowRight') setReading(true);
    if (e.code === 'ArrowLeft') setReading(false);
  });

  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  const goal = new THREE.Vector3();

  function update(dt) {
    // Aim with the crosshair (screen centre), which works under pointer lock.
    let aimed = null;
    if (controls.isLocked) {
      raycaster.setFromCamera(CENTER, camera);
      const hit = raycaster.intersectObjects(targets, false)[0];
      aimed = hit ? hit.object.userData.orb : null;
    }
    for (const o of orbs) o.targeted = o === aimed && !state.held;
    state.targeted = aimed;

    if (state.held) {
      const o = state.held;
      state.dist += (state.wantDist - state.dist) * Math.min(1, dt * 6);
      camera.getWorldDirection(dir);
      goal.copy(camera.position).addScaledVector(dir, state.dist);
      // While reading, the orb steps out of the way to the left.
      if (o.reading) {
        side.crossVectors(dir, camera.up).normalize();
        goal.addScaledVector(side, -(o.radius + 3.5));
      }
      o.group.position.lerp(goal, Math.min(1, dt * 10));
    }
    showTarget(state.held ?? aimed, !!state.held);
  }

  function release() {
    if (!state.held) return;
    state.held.held = false;
    state.held.reading = false;
    state.held.returning = true;
    state.held = null;
  }

  return { update, release };
}
