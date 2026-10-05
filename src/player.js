import * as THREE from 'three';
import { PLATFORM_RADIUS } from './world.js';

export const EYE = 1.7;
export const START = new THREE.Vector3(1.4, EYE, 1.2);
const SPEED = 4.5;
const GRAVITY = 20;
const MAX_FALL = 40; // terminal velocity
const WRAP = 170; // this far below the island the fog hides everything
const LAND = new THREE.Vector2(2.6, 2.2); // where a wrapped fall comes down: open grass, clear of the chair
const SOFT_FALL = 12; // fall speed just before touching down
const DIP = 0.45; // how far the camera sinks on a hard landing
const DIP_TIME = 0.4;

// Walking, falling off the edge, and coming back without a cut: below the
// fog line the player is moved to the same height above the island and keeps
// falling, so the island rises out of the fog towards them.
export function createPlayer(camera, controls, keys) {
  const vel = new THREE.Vector3();
  const move = new THREE.Vector3();
  let dip = 1; // landing dip progress, 0..1 (1 = standing)
  let dipDepth = 0;
  const player = {
    grounded: true,
    wrapped: false, // falling back in from above
    depth: WRAP, // how far to fall before wrapping (the giant rock makes it longer)
    onWrap: null, // called at the moment of the wrap, while nothing is visible
    update,
    knock,
  };

  // Send the player flying, e.g. when the giant rock lands.
  function knock(dir, speed, up) {
    vel.set(dir.x, 0, dir.z).normalize().multiplyScalar(speed);
    vel.y = up;
    player.grounded = false;
  }

  function wrap(p) {
    p.set(LAND.x, player.depth, LAND.y);
    vel.x = vel.z = 0;
    player.wrapped = true;
    player.depth = WRAP;
    player.onWrap?.();
  }

  function land(p) {
    dipDepth = DIP * Math.min(1, -vel.y / SOFT_FALL);
    dip = dipDepth > 0.05 ? 0 : 1;
    p.y = EYE;
    vel.set(0, 0, 0);
    player.grounded = true;
    player.wrapped = false;
  }

  function update(dt) {
    const p = camera.position;

    if (player.grounded) {
      if (controls.isLocked) {
        move.set(
          (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
          0,
          (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0),
        );
        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(SPEED * dt);
          controls.moveRight(move.x);
          controls.moveForward(move.z);
        }
      }
      // Knees bend and straighten after a landing.
      if (dip < 1) {
        dip = Math.min(1, dip + dt / DIP_TIME);
        p.y = EYE - dipDepth * Math.sin(dip * Math.PI);
      }
      // Walked off the edge.
      if (Math.hypot(p.x, p.z) > PLATFORM_RADIUS) player.grounded = false;
      return;
    }

    // In the air: gravity, no steering.
    const wasAbove = p.y >= EYE;
    vel.y = Math.max(vel.y - GRAVITY * dt, -MAX_FALL);
    // Coming back in: slow down near the ground, like a soft parachute.
    if (player.wrapped) {
      const near = THREE.MathUtils.clamp((p.y - EYE) / 40, 0, 1);
      vel.y = Math.max(vel.y, -THREE.MathUtils.lerp(SOFT_FALL, MAX_FALL, near));
    }
    p.addScaledVector(vel, dt);

    const over = Math.hypot(p.x, p.z) < PLATFORM_RADIUS;
    if (over && wasAbove && p.y <= EYE) return land(p);
    if (p.y < -player.depth) wrap(p);
  }

  return player;
}
