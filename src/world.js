import * as THREE from 'three';
import { grassTexture, dirtTexture, skyTexture, rng } from './textures.js';

export const PLATFORM_RADIUS = 8;

export function buildWorld(scene) {
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x8a8590, 45, 150);

  scene.add(new THREE.AmbientLight(0xb8b4c8, 1.4));
  const sun = new THREE.DirectionalLight(0xffd8a8, 2.2);
  sun.position.set(-30, 40, 20);
  scene.add(sun);

  const platform = new THREE.Group();
  const r = rng(42);

  // Grass top: a low cylinder, flat shaded.
  const top = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS * 0.96, 0.6, 16),
    [
      new THREE.MeshLambertMaterial({ map: dirtTexture(), flatShading: true }),
      new THREE.MeshLambertMaterial({ map: grassTexture() }),
      new THREE.MeshLambertMaterial({ map: grassTexture() }),
    ],
  );
  top.position.y = -0.3;
  platform.add(top);

  // Jagged rock underside: a cone with its vertices pushed around.
  const coneGeo = new THREE.ConeGeometry(PLATFORM_RADIUS * 0.96, 9, 14, 4);
  coneGeo.rotateX(Math.PI);
  const pos = coneGeo.attributes.position;
  const jitter = new Map(); // same offset for duplicated seam vertices, so no cracks
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 4.4) continue; // keep the rim flush with the grass
    const key = `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    if (!jitter.has(key)) jitter.set(key, [0.8 + r() * 0.4, (r() - 0.5) * 1.2]);
    const [s, dy] = jitter.get(key);
    pos.setXYZ(i, x * s, y + dy, z * s);
  }
  coneGeo.computeVertexNormals();
  const underside = new THREE.Mesh(
    coneGeo,
    new THREE.MeshLambertMaterial({ map: dirtTexture(), flatShading: true }),
  );
  underside.position.y = -0.6 - 4.5;
  platform.add(underside);

  // Grass tufts and pebbles.
  const tuftMat = new THREE.MeshLambertMaterial({ color: 0x5f7d34, flatShading: true });
  const pebbleMat = new THREE.MeshLambertMaterial({ color: 0x8a8378, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const a = r() * Math.PI * 2;
    const d = 1.5 + r() * (PLATFORM_RADIUS - 2);
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35 + r() * 0.3, 3), tuftMat);
    tuft.position.set(Math.cos(a) * d, 0.15, Math.sin(a) * d);
    tuft.rotation.z = (r() - 0.5) * 0.5;
    platform.add(tuft);
  }
  for (let i = 0; i < 12; i++) {
    const a = r() * Math.PI * 2;
    const d = 2 + r() * (PLATFORM_RADIUS - 3);
    const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12 + r() * 0.15, 0), pebbleMat);
    pebble.position.set(Math.cos(a) * d, 0.05, Math.sin(a) * d);
    platform.add(pebble);
  }

  scene.add(platform);
  return platform;
}
