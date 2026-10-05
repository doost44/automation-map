import * as THREE from 'three';
import { PLATFORM_RADIUS } from './world.js';
import { hitOrb } from './orbs.js';
import { crackPanel } from './panels.js';
import { showHint } from './hud.js';
import { rng } from './textures.js';

const ROCKS = 6; // fist-sized rocks near the start
const PEBBLES = 12; // small stones scattered over the rest of the platform
const REACH = 3.2; // how close a rock has to be to pick it up
const THROW_SPEED = 30;
const GRAVITY = 4; // light, so far-off orbs are still reachable with a small arc
const VOID_Y = -15; // below this a rock has fallen off the world for good
const CENTER = new THREE.Vector2(0, 0);
const HAND = new THREE.Vector3(0.6, -0.45, -1.4); // lower right of the view, in camera space

// Throwable rocks: right click or G picks one up, right click or G again throws it.
// Rocks that fall off the platform are gone until reset() (or a page reload).
export function createRocks(scene, camera, controls, orbs, panels) {
  const r = rng(5);
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a8378, flatShading: true });
  const rocks = [];
  const add = (radius, a, d) => {
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), mat);
    mesh.scale.set(1, 0.75 + r() * 0.2, 1);
    const home = new THREE.Vector3(Math.cos(a) * d, radius * 0.75, Math.sin(a) * d);
    const spin = new THREE.Euler(r() * 3, r() * 3, 0);
    scene.add(mesh);
    rocks.push({ mesh, radius, home, spin, vel: new THREE.Vector3(), state: 'rest', hits: new Set() });
  };
  for (let i = 0; i < ROCKS; i++) add(0.16 + r() * 0.07, 0.2 + (i / ROCKS) * Math.PI * 1.6 + r() * 0.3, 2.2 + r() * 3);
  for (let i = 0; i < PEBBLES; i++) add(0.1 + r() * 0.08, r() * Math.PI * 2, 2 + r() * (PLATFORM_RADIUS - 3));

  // Put every rock back on its spot.
  function reset() {
    held = null;
    for (const rock of rocks) {
      rock.mesh.position.copy(rock.home);
      rock.mesh.rotation.copy(rock.spin);
      rock.mesh.visible = true;
      rock.vel.set(0, 0, 0);
      rock.state = 'rest';
    }
  }

  // What a thrown rock can hit, and how to react to it.
  const targets = new Map();
  for (const o of orbs) targets.set(o.mesh, { orb: o });
  for (const p of panels) targets.set(p.mesh, { panel: p });
  const hittable = [...targets.keys()];

  const raycaster = new THREE.Raycaster();
  let held = null;
  let aimed = null;

  function act() {
    if (!controls.isLocked) return;
    if (held) throwRock(held);
    else if (aimed) { held = aimed; held.state = 'held'; }
  }

  const dir = new THREE.Vector3();
  function throwRock(rock) {
    camera.getWorldDirection(dir);
    rock.mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
    rock.vel.copy(dir).multiplyScalar(THROW_SPEED);
    rock.vel.y += 2;
    rock.state = 'flying';
    rock.hits.clear();
    held = null;
  }

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('mousedown', (e) => { if (e.button === 2) act(); });
  addEventListener('keydown', (e) => { if (e.code === 'KeyG') act(); });

  const step = new THREE.Vector3();
  const stepDir = new THREE.Vector3();

  function fly(rock, dt) {
    const p = rock.mesh.position;
    rock.vel.y -= GRAVITY * dt;
    step.copy(rock.vel).multiplyScalar(dt);
    const len = step.length();
    stepDir.copy(step).divideScalar(len || 1);

    // Sweep this frame's movement so fast rocks can't skip through thin panels.
    raycaster.set(p, stepDir);
    raycaster.far = len + rock.radius;
    const hit = raycaster.intersectObjects(hittable, false).find((h) => !rock.hits.has(h.object));
    if (hit) {
      const t = targets.get(hit.object);
      if (t.orb) hitOrb(t.orb, stepDir);
      else crackPanel(t.panel, hit.uv);
      rock.hits.add(hit.object);
      p.copy(hit.point).addScaledVector(stepDir, -rock.radius);
      rock.vel.multiplyScalar(-0.2);
      rock.vel.y = 3;
      return;
    }
    p.add(step);
    rock.mesh.rotation.x += dt * 9;
    rock.mesh.rotation.z += dt * 6;

    // Land on the platform with a couple of small bounces.
    const onPlatform = Math.hypot(p.x, p.z) < PLATFORM_RADIUS - rock.radius;
    const rest = rock.radius * 0.75;
    if (onPlatform && p.y < rest && p.y > -0.5 && rock.vel.y < 0) {
      p.y = rest;
      if (rock.vel.y < -3) {
        rock.vel.y *= -0.2;
        rock.vel.x *= 0.15;
        rock.vel.z *= 0.15;
      } else {
        rock.vel.set(0, 0, 0);
        rock.state = 'rest';
      }
    }

    // Fell off the edge: gone.
    if (p.y < VOID_Y) {
      rock.state = 'gone';
      rock.mesh.visible = false;
    }
  }

  function update(dt) {
    aimed = null;
    if (controls.isLocked && !held) {
      raycaster.setFromCamera(CENTER, camera);
      raycaster.far = REACH;
      const resting = rocks.filter((k) => k.state === 'rest').map((k) => k.mesh);
      const hit = raycaster.intersectObjects(resting, false)[0];
      aimed = hit ? rocks.find((k) => k.mesh === hit.object) : null;
    }

    for (const rock of rocks) {
      if (rock.state === 'flying') fly(rock, dt);
      else if (rock.state === 'held') {
        rock.mesh.position.copy(HAND).applyQuaternion(camera.quaternion).add(camera.position);
        rock.mesh.rotation.y += dt;
      }
    }

    if (held) showHint('ROCK · RIGHT CLICK / G TO THROW');
    else if (aimed) showHint('ROCK · RIGHT CLICK / G TO PICK UP');
    else showHint(null);
  }

  reset();
  const remaining = () => rocks.filter((k) => k.state !== 'gone').length;
  return { update, reset, remaining, rocks, throwRock };
}
