import * as THREE from 'three';
import { showTarget } from './hud.js';

const CENTER = new THREE.Vector2(0, 0);
const MAX_DIST = 40;

export function createInteraction(camera, controls, orbs, panels) {
  const raycaster = new THREE.Raycaster();
  const targets = [...orbs.map((o) => o.mesh), ...panels.map((p) => p.mesh)];
  const state = { targeted: null, held: null, dist: 0, wantDist: 0 };

  document.addEventListener('mousedown', (e) => {
    if (!controls.isLocked || e.button !== 0) return;
    if (state.held) {
      state.held.held = false;
      state.held.returning = true;
      state.held = null;
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
    const min = state.held.radius + 1.5;
    state.wantDist = THREE.MathUtils.clamp(state.wantDist + Math.sign(e.deltaY) * 1.5, min, MAX_DIST);
  }, { passive: true });

  const dir = new THREE.Vector3();
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
      state.dist += (state.wantDist - state.dist) * Math.min(1, dt * 6);
      camera.getWorldDirection(dir);
      goal.copy(camera.position).addScaledVector(dir, state.dist);
      state.held.group.position.lerp(goal, Math.min(1, dt * 10));
    }
    showTarget(state.held ?? aimed, !!state.held);
  }

  function release() {
    if (!state.held) return;
    state.held.held = false;
    state.held.returning = true;
    state.held = null;
  }

  return { update, release };
}
