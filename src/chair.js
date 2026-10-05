import * as THREE from 'three';
import { plasticTexture } from './textures.js';

// A white plastic lawn chair from boxes and cylinders. Front faces +Z.
export function buildChair() {
  const mat = new THREE.MeshLambertMaterial({ map: plasticTexture(), color: 0xf4f2ea, flatShading: true });
  const chair = new THREE.Group();

  const box = (w, h, d, x, y, z, rx = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    chair.add(m);
    return m;
  };
  const tube = (len, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 6), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    chair.add(m);
    return m;
  };

  // Slatted seat.
  for (let i = 0; i < 5; i++) box(0.56, 0.04, 0.09, 0, 0.45, -0.22 + i * 0.11);
  box(0.6, 0.05, 0.05, 0, 0.42, -0.26);
  box(0.6, 0.05, 0.05, 0, 0.42, 0.26);

  // Slatted back, leaning back.
  const lean = -0.22;
  for (let i = 0; i < 5; i++) {
    box(0.07, 0.62, 0.035, -0.22 + i * 0.11, 0.8, -0.34, lean);
  }
  box(0.6, 0.07, 0.05, 0, 1.1, -0.41, lean);
  box(0.6, 0.05, 0.05, 0, 0.55, -0.29, lean);

  // Legs, splayed slightly.
  tube(0.45, -0.27, 0.22, 0.24, 0.12, 0.08);
  tube(0.45, 0.27, 0.22, 0.24, 0.12, -0.08);
  tube(0.45, -0.27, 0.22, -0.27, -0.12, 0.08);
  tube(0.45, 0.27, 0.22, -0.27, -0.12, -0.08);

  // Armrests and their front posts.
  for (const x of [-0.33, 0.33]) {
    box(0.07, 0.035, 0.6, x, 0.68, -0.02);
    tube(0.24, x, 0.56, 0.25);
  }

  chair.scale.setScalar(1.25);
  return chair;
}
