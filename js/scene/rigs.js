/* Assembled pieces shared by the landing page scene and the pitch deck:
   the studio lighting, the atom (kettlebell nucleus with equipment on three
   orbits), the barbell that loads plate by plate, and a crossed dumbbell pair.
   Each rig returns its group plus an update function driven by the caller. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  PLATE_KINDS, createPlate, createBarbell, createDumbbell, createKettlebell, createOrbitRing,
} from './equipment.js';

/* Plate pairs in loading order: heavy first, change plates last. */
export const PLATE_ORDER = ['red', 'blue', 'red', 'blue', 'white', 'white'];

/* Room-light reflections plus a key light, a blue rim from the left and a
   red rim from the right, so the chrome picks up the brand colours. */
export function addStudioLighting(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 4, 5);
  const blueRim = new THREE.DirectionalLight(0x3d6bff, 2.4);
  blueRim.position.set(-4, 1.2, -2.5);
  const redRim = new THREE.DirectionalLight(0xff2b3d, 2);
  redRim.position.set(4, -0.8, -2.5);
  scene.add(key, blueRim, redRim);
}

const ORBITS = [
  { radius: 0.62, color: 0x2f6bff, strength: 2.6, tilt: [1.2, 0, 0.25], speed: 0.42, electrons: [['plate', 'red', 0], ['dumbbell', null, Math.PI]] },
  { radius: 0.8, color: 0xff2b3d, strength: 2.4, tilt: [1.75, 0, -0.8], speed: -0.3, electrons: [['plate', 'blue', 2.2]] },
  { radius: 0.98, color: 0xdfe6ff, strength: 1.8, tilt: [2.02, 0, 1], speed: 0.22, electrons: [['dumbbell', null, 4.1], ['plate', 'white', 0.6]] },
];

export function createAtom(materials) {
  const group = new THREE.Group();
  const nucleus = createKettlebell(materials);
  nucleus.scale.setScalar(1.7);
  nucleus.position.y = -0.22;
  group.add(nucleus);

  const orbits = ORBITS.map((spec, orbitIndex) => {
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.set(spec.tilt[0], spec.tilt[1], spec.tilt[2]);
    const pivot = new THREE.Group();
    const ring = createOrbitRing(spec.radius, spec.color, spec.strength);
    pivot.add(ring);
    const electrons = spec.electrons.map(([type, kind, angle], i) => {
      const object = type === 'plate' ? createPlate(kind, materials) : createDumbbell(materials);
      object.scale.setScalar(type === 'plate' ? 0.42 : 0.9);
      const holder = new THREE.Group();
      holder.add(object);
      pivot.add(holder);
      return { holder, object, angle, spin: 0.45 + ((orbitIndex * 3 + i) % 5) * 0.1 };
    });
    tiltGroup.add(pivot);
    group.add(tiltGroup);
    return { spec, pivot, ring, electrons };
  });

  /* spread pushes the orbits outward (1 = resting); ringAlpha fades the rings. */
  function update({ delta, animate, spread, ringAlpha, velocity = 0 }) {
    if (animate) nucleus.rotation.y += delta * 0.25;
    orbits.forEach(({ spec, pivot, ring, electrons }) => {
      if (animate) pivot.rotation.y += delta * spec.speed * (1 + velocity);
      ring.scale.setScalar(spread);
      ring.material.opacity = ringAlpha;
      ring.visible = ringAlpha > 0.02;
      electrons.forEach((e) => {
        const r = spec.radius * spread;
        e.holder.position.set(Math.cos(e.angle) * r, 0, Math.sin(e.angle) * r);
        if (animate) {
          e.object.rotation.x += delta * e.spin;
          e.object.rotation.y += delta * e.spin * 0.6;
        }
      });
    });
  }

  return { group, update };
}

/* Barbell with six plate pairs that slide on from the sleeve ends. */
export function createLoadableBar(materials) {
  const barbell = createBarbell(materials);
  const group = new THREE.Group();
  group.add(barbell.group);
  const plates = [];
  let offset = barbell.plateStart;
  PLATE_ORDER.forEach((kind, index) => {
    [1, -1].forEach((side) => {
      const plate = createPlate(kind, materials);
      const loadedX = side * (offset + plate.userData.thickness / 2);
      plate.position.x = side * (barbell.sleeveEnd + 0.9);
      plate.visible = false;
      group.add(plate);
      plates.push({ plate, index, side, loadedX, load: 0 });
    });
    offset += PLATE_KINDS[kind].thickness + 0.002;
  });

  /* count: how many plate pairs should be on the bar. factor: 0..1 easing per frame. */
  function update(count, factor) {
    plates.forEach((p) => {
      const target = p.index < count ? 1 : 0;
      p.load += (target - p.load) * factor;
      const t = p.load;
      const offX = p.side * (barbell.sleeveEnd + 0.9);
      p.plate.position.x = offX + (p.loadedX - offX) * (1 - Math.pow(1 - t, 3));
      p.plate.rotation.x = (1 - t) * Math.PI * 1.5 * p.side;
      p.plate.visible = t > 0.01;
    });
  }

  return { group, update };
}

/* Two hex dumbbells crossed over each other. */
export function createDumbbellPair(materials) {
  const group = new THREE.Group();
  const a = createDumbbell(materials);
  const b = createDumbbell(materials);
  a.position.set(0, 0.07, 0);
  a.rotation.set(0.3, 0.6, 0.5);
  b.position.set(0.02, -0.08, 0.06);
  b.rotation.set(-0.2, -0.5, -0.35);
  group.add(a, b);
  return { group };
}
