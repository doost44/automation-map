import * as THREE from 'three';
import { PLATFORM_RADIUS } from './world.js';
import { canvas, crunchy, rng } from './textures.js';
import { settings } from './options.js';

// What happens when the last rock is thrown off the island:
// the sky goes black, a red aura opens overhead, a giant rock crashes down and
// knocks the player into the void. While they fall back in from above, everything is put back.

const DARKEN = 3; // seconds for the sky to go black
const AURA_START = 1.5;
const DROP_AT = 5.5; // when the giant rock starts falling
const BIG = 3.2; // giant rock radius
const AURA_Y = 55;
const RESTORE = 2.5;

export function createDoom(scene, camera, rocks, player) {
  const ambient = scene.children.find((o) => o.isAmbientLight);
  const sun = scene.children.find((o) => o.isDirectionalLight);
  const base = {
    fog: scene.fog.color.clone(),
    ambient: ambient.intensity,
    ambientColor: ambient.color.clone(),
    sun: sun.intensity,
  };
  const DOOM_FOG = new THREE.Color(0x140404);
  const DOOM_AMBIENT = new THREE.Color(0xff6050);

  // A black dome around the player, faded in over the sky gradient.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(300, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x060101, side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false }),
  );
  dome.renderOrder = -1;
  dome.visible = false;
  scene.add(dome);

  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: auraTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false,
  }));
  aura.position.set(0, AURA_Y, 0);
  aura.visible = false;
  scene.add(aura);

  const giant = new THREE.Mesh(
    jaggedRock(BIG),
    new THREE.MeshLambertMaterial({ color: 0x8a7e74, emissive: 0x240604, flatShading: true }),
  );
  giant.visible = false;
  scene.add(giant);

  const debris = [];
  const debrisMat = new THREE.MeshLambertMaterial({ color: 0x5c4634, flatShading: true });
  const dustMat = new THREE.SpriteMaterial({ map: puffTexture('140,122,106'), transparent: true, opacity: 0.6, depthWrite: false });

  let state = 'calm';
  let t = 0;
  let fallSpeed = 0;
  let shake = 0;
  const view = document.getElementById('view');

  // Once the falling player wraps round to above the island (nothing is visible then), undo everything.
  player.onWrap = () => {
    if (state === 'calm' || state === 'restore') return;
    if (state !== 'fallen' && rocks.remaining() > 0) return;
    rocks.reset();
    giant.visible = false;
    aura.visible = false; // it ignores fog, so it would pop from above to below
    for (const d of debris) scene.remove(d.obj);
    debris.length = 0;
    state = 'restore';
    t = 0;
  };

  function setDarkness(k) {
    dome.visible = k > 0;
    dome.material.opacity = k * 0.94;
    scene.fog.color.copy(base.fog).lerp(DOOM_FOG, k);
    ambient.intensity = base.ambient * (1 - 0.6 * k);
    ambient.color.copy(base.ambientColor).lerp(DOOM_AMBIENT, k * 0.6);
    sun.intensity = base.sun * (1 - 0.8 * k);
  }

  function impact() {
    state = 'fallen';
    giant.position.y = BIG * 0.7;
    shake = 1;
    aura.scale.multiplyScalar(1.3);

    // Throw the player outwards, off the edge.
    const away = new THREE.Vector3(camera.position.x, 0, camera.position.z);
    if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    player.knock(away, 18, 11);
    player.depth = 240; // a longer fall than walking off the edge

    // Chunks of dirt and puffs of dust.
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      if (i < 28) {
        const obj = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.35, 0), debrisMat);
        obj.position.copy(dir).multiplyScalar(BIG * 0.8).setY(0.5);
        const vel = dir.multiplyScalar(4 + Math.random() * 10).setY(5 + Math.random() * 10);
        debris.push({ obj, vel, life: 4 });
        scene.add(obj);
      } else {
        const obj = new THREE.Sprite(dustMat.clone());
        obj.position.copy(dir).multiplyScalar(BIG).setY(0.6);
        obj.scale.setScalar(2);
        debris.push({ obj, vel: dir.multiplyScalar(3 + Math.random() * 3).setY(0.6), life: 2.5, dust: true });
        scene.add(obj);
      }
    }
  }

  function updateDebris(dt) {
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      d.obj.position.addScaledVector(d.vel, dt);
      if (d.dust) {
        d.obj.scale.addScalar(dt * 3);
        d.obj.material.opacity = Math.max(0, d.life / 2.5) * 0.6;
      } else {
        d.vel.y -= 20 * dt;
        d.obj.rotation.x += dt * 5;
        // Chunks that land on the island stay put; the rest fall away.
        const onIsland = Math.hypot(d.obj.position.x, d.obj.position.z) < PLATFORM_RADIUS;
        if (onIsland && d.obj.position.y < 0.1 && d.obj.position.y > -0.5 && d.vel.y < 0) {
          d.obj.position.y = 0.1;
          d.vel.set(0, 0, 0);
        }
      }
      if (d.life <= 0 && (d.dust || d.obj.position.y < -20)) {
        scene.remove(d.obj);
        debris.splice(i, 1);
      }
    }
  }

  function update(dt, time) {
    dome.position.copy(camera.position);
    t += dt;

    if (state === 'calm') {
      if (rocks.remaining() === 0) { state = 'dark'; t = 0; }
    } else if (state === 'dark' || state === 'falling' || state === 'fallen') {
      setDarkness(Math.min(1, t / DARKEN));
      const grow = THREE.MathUtils.clamp((t - AURA_START) / (DROP_AT - AURA_START), 0, 1);
      aura.visible = grow > 0;
      if (state !== 'fallen') aura.scale.setScalar(80 * grow * (1 + 0.06 * Math.sin(time * 6)));
      if (state === 'dark' && t >= DROP_AT) {
        state = 'falling';
        fallSpeed = 0;
        giant.position.set(0, AURA_Y, 0);
        giant.visible = true;
      }
    } else if (state === 'restore') {
      const k = 1 - Math.min(1, t / RESTORE);
      setDarkness(k);
      aura.scale.multiplyScalar(Math.pow(0.1, dt));
      aura.material.opacity = k;
      if (k === 0) {
        state = 'calm';
        aura.visible = false;
        aura.material.opacity = 1;
      }
    }

    if (state === 'falling') {
      fallSpeed += 35 * dt;
      giant.position.y -= fallSpeed * dt;
      giant.rotation.x += dt * 0.8;
      giant.rotation.z += dt * 0.5;
      if (giant.position.y <= BIG * 0.7) impact();
    }

    updateDebris(dt);

    // Screen shake on the canvas itself, so it doesn't fight mouse look.
    if (shake > 0.01 && settings.shake) {
      shake *= Math.pow(0.03, dt);
      const s = shake * 24;
      view.style.transform = `translate(${(Math.random() - 0.5) * s}px, ${(Math.random() - 0.5) * s}px)`;
    } else if (view.style.transform) {
      view.style.transform = '';
    }
  }

  return { update, get state() { return state; } };
}

// Soft red glow, painted small so it stays pixelated.
function auraTexture() {
  return glow([[0, 'rgba(255,90,60,1)'], [0.3, 'rgba(220,20,10,0.8)'], [0.7, 'rgba(120,0,0,0.35)'], [1, 'rgba(60,0,0,0)']]);
}

// Round dust puff in the given 'r,g,b' colour.
function puffTexture(rgb) {
  return glow([[0, `rgba(${rgb},1)`], [0.6, `rgba(${rgb},0.6)`], [1, `rgba(${rgb},0)`]]);
}

function glow(stops) {
  const c = canvas(32, 32);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 1, 16, 16, 16);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return crunchy(c);
}

// A lumpy low-poly boulder: a dodecahedron with its corners pushed around.
function jaggedRock(radius) {
  const geo = new THREE.DodecahedronGeometry(radius, 1);
  const pos = geo.attributes.position;
  const r = rng(13);
  const offsets = new Map(); // same offset for shared corners, so the faces stay closed
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(2)},${pos.getY(i).toFixed(2)},${pos.getZ(i).toFixed(2)}`;
    if (!offsets.has(key)) offsets.set(key, 0.8 + r() * 0.4);
    const s = offsets.get(key);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return geo;
}
