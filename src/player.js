import * as THREE from 'three';
import { PLATFORM_RADIUS } from './world.js';
import { showHint } from './hud.js';

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
const JUMP = 7.5; // upward speed of a jump (about 1.4 units high)
const AIR_CONTROL = 5; // how quickly WASD steers you in the air
const BODY = 0.35; // player radius, for bumping into orbs
const SIT_REACH = 3; // how close the crosshair must be to the chair to sit
const SIT_TIME = 0.6;
const SEATED_EYE = new THREE.Vector3(0, 0.8, 0); // eye height above the seat
const CHAIR_RADIUS = 0.6; // the chair is solid within this distance of its centre

// Walking, falling off the edge, and coming back without a cut: below the
// fog line the player is moved to the same height above the island and keeps
// falling, so the island rises out of the fog towards them.
export function createPlayer(camera, controls, keys) {
  const vel = new THREE.Vector3();
  const move = new THREE.Vector3();
  let dip = 1; // landing dip progress, 0..1 (1 = standing)
  let dipDepth = 0;
  let stunned = 0; // seconds of no air control after being knocked
  const player = {
    grounded: true,
    on: null, // the orb being stood on, if any
    orbs: [], // set by main.js once the orbs exist
    chair: null, // set by main.js
    seated: false,
    standing: false, // easing back up out of the chair
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
    player.on = null;
    player.seated = false;
    player.standing = false;
    sitT = 1;
    stunned = 1.5;
  }

  function wrap(p) {
    p.set(LAND.x, player.depth, LAND.y);
    vel.x = vel.z = 0;
    player.wrapped = true;
    player.depth = WRAP;
    player.onWrap?.();
  }

  const lastOrbPos = new THREE.Vector3();

  function land(p, eyeY, orb = null) {
    dipDepth = DIP * Math.min(1, -vel.y / SOFT_FALL);
    dip = dipDepth > 0.05 ? 0 : 1;
    p.y = eyeY;
    vel.set(0, 0, 0);
    player.grounded = true;
    player.wrapped = false;
    player.on = orb;
    if (orb) lastOrbPos.copy(orb.group.position);
  }

  // Eye height when standing on top of an orb at the player's spot, or null if off its top.
  function orbTop(o, p) {
    const c = o.group.position;
    const h = Math.hypot(p.x - c.x, p.z - c.z);
    if (h > o.radius * 0.9) return null;
    return c.y + Math.sqrt(o.radius ** 2 - h * h) + EYE;
  }

  // Orbs (and the chair) are solid: walking or flying into one pushes you round it.
  function bump(p) {
    const chair = player.chair?.position;
    if (chair && p.y - EYE < 1.2) {
      const dx = p.x - chair.x, dz = p.z - chair.z;
      const d = Math.hypot(dx, dz);
      const min = CHAIR_RADIUS + BODY;
      if (d < min && d > 1e-3) { p.x += (dx / d) * (min - d); p.z += (dz / d) * (min - d); }
    }
    for (const o of player.orbs) {
      if (o === player.on || o.held) continue;
      const c = o.group.position;
      const feet = p.y - EYE;
      if (feet >= c.y + o.radius * 0.8) continue; // above it: landing handles that
      const dx = p.x - c.x, dz = p.z - c.z;
      const dy = THREE.MathUtils.clamp(c.y, feet, p.y) - c.y; // nearest point of the body to the centre
      const d = Math.hypot(dx, dy, dz);
      const min = o.radius + BODY;
      const flat = Math.hypot(dx, dz);
      if (d >= min || flat < 1e-3) continue;
      const out = (min - d) / flat;
      p.x += dx * out;
      p.z += dz * out;
    }
  }

  // --- Sitting in the chair ---------------------------------------------------
  const ray = new THREE.Raycaster();
  const CENTER = new THREE.Vector2(0, 0);
  const sitFrom = new THREE.Vector3();
  const sitTo = new THREE.Vector3();
  const quatFrom = new THREE.Quaternion();
  const quatTo = new THREE.Quaternion();
  let sitT = 1; // 0..1 progress of easing into or out of the seat

  // Crosshair on the chair, close enough, standing on the ground.
  function lookingAtChair() {
    if (!player.chair || !player.grounded || player.on || !controls.isLocked) return false;
    camera.updateMatrixWorld(); // the camera may have just moved this frame
    ray.setFromCamera(CENTER, camera);
    ray.far = SIT_REACH;
    return ray.intersectObject(player.chair, true).length > 0;
  }

  function startMove(to, faceChairForward) {
    sitFrom.copy(camera.position);
    sitTo.copy(to);
    quatFrom.copy(camera.quaternion);
    if (faceChairForward) quatTo.setFromEuler(new THREE.Euler(0, player.chair.rotation.y + Math.PI, 0, 'YXZ'));
    else quatTo.copy(camera.quaternion);
    sitT = 0;
  }

  player.toggleSit = () => {
    if (player.seated) return standUp();
    if (!lookingAtChair()) return;
    player.seated = true;
    vel.set(0, 0, 0);
    startMove(player.chair.localToWorld(new THREE.Vector3(0, 0.47, 0.02)).add(SEATED_EYE), true);
  };

  function standUp() {
    player.seated = false;
    player.standing = true;
    const spot = player.chair.localToWorld(new THREE.Vector3(0, 0, 1.0));
    spot.y = EYE;
    startMove(spot, false);
  }

  // Ease the camera into or out of the seat. Returns true while it is busy.
  function updateSit(dt) {
    if (sitT < 1) {
      sitT = Math.min(1, sitT + dt / SIT_TIME);
      const k = sitT * sitT * (3 - 2 * sitT); // smoothstep
      camera.position.lerpVectors(sitFrom, sitTo, k);
      if (player.seated) camera.quaternion.slerpQuaternions(quatFrom, quatTo, k);
      if (sitT === 1 && player.standing) player.standing = false;
      return true;
    }
    if (!player.seated) return false;
    camera.position.copy(sitTo);
    // Any movement key stands you up.
    if (controls.isLocked && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.Space)) standUp();
    return true;
  }

  // WASD as a direction on the ground plane, relative to where the camera faces.
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  function wishDir() {
    move.set(0, 0, 0);
    if (!controls.isLocked) return move;
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, camera.up);
    move.addScaledVector(forward, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0));
    move.addScaledVector(right, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0));
    return move.lengthSq() > 0 ? move.normalize() : move;
  }

  function update(dt) {
    if (updateSit(dt)) return showHint(player.seated ? 'SEATED · E, WASD OR SPACE TO STAND' : null, 'chair');
    showHint(lookingAtChair() ? 'CHAIR · E TO SIT' : null, 'chair');
    const p = camera.position;
    const wish = wishDir();

    if (player.grounded) {
      // Ride along with the orb underneath.
      const orb = player.on;
      if (orb?.held) {
        // Grabbed the orb you were standing on: drop off it.
        player.grounded = false;
        player.on = null;
        return;
      }
      if (orb) {
        p.add(orb.group.position).sub(lastOrbPos);
        lastOrbPos.copy(orb.group.position);
      }
      // Walking speed is kept in vel, so stepping or jumping off an edge carries you out.
      vel.set(wish.x * SPEED, 0, wish.z * SPEED);
      p.addScaledVector(vel, dt);
      bump(p);

      const ground = orb ? orbTop(orb, p) : EYE;
      if (ground === null) {
        player.grounded = false; // walked off the orb
        player.on = null;
        return;
      }
      // Knees bend and straighten after a landing.
      if (dip < 1) dip = Math.min(1, dip + dt / DIP_TIME);
      p.y = ground - dipDepth * Math.sin(dip * Math.PI);

      if (keys.Space && controls.isLocked) {
        vel.y = JUMP;
        p.y = ground;
        dip = 1;
        player.grounded = false;
        player.on = null;
      } else if (!orb && Math.hypot(p.x, p.z) > PLATFORM_RADIUS) {
        player.grounded = false; // walked off the edge
      }
      return;
    }

    // In the air: gravity, plus some steering (not while dropping back in from above).
    const prevY = p.y;
    vel.y = Math.max(vel.y - GRAVITY * dt, -MAX_FALL);
    stunned = Math.max(0, stunned - dt);
    if (!player.wrapped && stunned === 0) {
      const k = Math.min(1, AIR_CONTROL * dt);
      vel.x += (wish.x * SPEED - vel.x) * k * wish.lengthSq();
      vel.z += (wish.z * SPEED - vel.z) * k * wish.lengthSq();
    }
    // Coming back in: slow down near the ground, like a soft parachute.
    if (player.wrapped) {
      const near = THREE.MathUtils.clamp((p.y - EYE) / 40, 0, 1);
      vel.y = Math.max(vel.y, -THREE.MathUtils.lerp(SOFT_FALL, MAX_FALL, near));
    }
    p.addScaledVector(vel, dt);
    bump(p);

    if (vel.y <= 0) {
      // Land on the island...
      if (Math.hypot(p.x, p.z) < PLATFORM_RADIUS && prevY >= EYE && p.y <= EYE) return land(p, EYE);
      // ...or on top of an orb (a little leeway, since orbs bob up to meet you).
      for (const o of player.orbs) {
        if (o.held) continue;
        const top = orbTop(o, p);
        if (top !== null && p.y <= top && prevY >= top - 0.6) return land(p, top, o);
      }
    }
    if (p.y < -player.depth) wrap(p);
  }

  return player;
}
