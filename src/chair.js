import * as THREE from 'three';
import { paintTexture, cushionTexture } from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);
const LEAN = -0.46; // how far the back loop tilts back, in radians
const LOOP = 1.0; // length of each front-leg/back-upright tube

// An old white metal folding chair with a red seat. Front faces +Z.
export function buildChair() {
  const paint = new THREE.MeshLambertMaterial({ map: paintTexture(), flatShading: true, side: THREE.DoubleSide });
  const cushion = new THREE.MeshLambertMaterial({ map: cushionTexture(), flatShading: true });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true });
  const chair = new THREE.Group();

  // A 6-sided tube between two points.
  const tube = (parent, a, b, r = 0.02) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 6), paint);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(UP, d.normalize());
    parent.add(m);
  };
  const foot = (x, z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 6), rubber);
    m.position.set(x, 0.025, z);
    chair.add(m);
  };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  // Back loop: front legs that rise into the back uprights and a rounded top, tilted back.
  const loop = new THREE.Group();
  loop.position.z = 0.26;
  loop.rotation.x = LEAN;
  chair.add(loop);
  for (const x of [-0.22, 0.22]) tube(loop, v(x, 0, 0), v(x, LOOP, 0));
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 8, Math.PI), paint);
  arch.position.y = LOOP;
  loop.add(arch);

  // Curved backrest under the arch: a slice of an open cylinder, bowed away from the sitter.
  const R = 0.6;
  const span = 2 * Math.asin(0.22 / R);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.26, 4, 1, true, Math.PI - span / 2, span), paint);
  back.position.set(0, LOOP - 0.08, R);
  loop.add(back);

  // Rear legs: from the back feet up to the front of the seat, joined by a low brace.
  for (const x of [-0.18, 0.18]) tube(chair, v(x, 0, -0.34), v(x, 0.42, 0.28));
  tube(chair, v(-0.18, 0.12, -0.22), v(0.18, 0.12, -0.22), 0.014);

  // Seat: painted tray with a red cushion.
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.42), paint);
  tray.position.set(0, 0.43, 0.1);
  tray.rotation.x = 0.06;
  chair.add(tray);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.035, 0.36), cushion);
  pad.position.set(0, 0.47, 0.1);
  pad.rotation.x = 0.06;
  chair.add(pad);

  foot(-0.22, 0.26);
  foot(0.22, 0.26);
  foot(-0.18, -0.34);
  foot(0.18, -0.34);

  chair.scale.setScalar(1.3);
  return chair;
}
