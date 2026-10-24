/* 3D background for the pitch deck. Reuses the landing page's equipment and
   rigs; each slide has a target pose and every value eases toward it. On the
   offer slide, each build step slides one more plate pair onto the bar. */
import * as THREE from 'three';
import { createMaterials, createParticles } from '../js/scene/equipment.js';
import { addStudioLighting, createAtom, createLoadableBar, createDumbbellPair } from '../js/scene/rigs.js';

const HIDDEN = 0.0001;
const OFFER_SLIDE = 2;

/* One pose per slide, in slide order. */
const POSES = [
  { atom: [1.36, 0, 0], atomScale: 0.8, spread: 1, ring: 1, bar: [3.6, 0, -0.5], barRot: [0, -1, 0], barScale: HIDDEN, db: HIDDEN, camZ: 3.4, exposure: 1.05 },
  { atom: [1.3, 0, -0.5], atomScale: 0.95, spread: 2.3, ring: 0.22, bar: [3.6, 0, -0.5], barRot: [0, -1, 0], barScale: HIDDEN, db: HIDDEN, camZ: 3.8, exposure: 0.85 },
  { atom: [1.2, 0.3, -2.5], atomScale: HIDDEN, spread: 3.4, ring: 0, bar: [1.25, -0.04, -0.6], barRot: [0.05, -1, 0], barScale: 0.72, db: HIDDEN, camZ: 3.2, exposure: 1 },
  { atom: [1.2, 0.3, -2.5], atomScale: HIDDEN, spread: 3.4, ring: 0, bar: [1.15, 0.5, -1.4], barRot: [0.2, -0.7, 0.1], barScale: 0.6, db: HIDDEN, camZ: 3.4, exposure: 1 },
  { atom: [1.2, 0.3, -2.5], atomScale: HIDDEN, spread: 3.4, ring: 0, bar: [-3.6, 0.4, 0], barRot: [0, 0.2, 0], barScale: HIDDEN, db: 2.3, camZ: 3.3, exposure: 1.02 },
  { atom: [1.4, 0, -1], atomScale: 0.8, spread: 1.6, ring: 0.4, bar: [-3.6, 0.4, 0], barRot: [0, 0.2, 0], barScale: HIDDEN, db: HIDDEN, camZ: 3.6, exposure: 0.95 },
  { atom: [1.36, 0, 0], atomScale: 0.8, spread: 1, ring: 1, bar: [-3.6, 0.4, 0], barRot: [0, 0.2, 0], barScale: HIDDEN, db: HIDDEN, camZ: 3.4, exposure: 1.05 },
];

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isStatic = new URLSearchParams(window.location.search).has('static');
const isPresenter = new URLSearchParams(window.location.search).has('presenter');

if (!isPresenter) {
  try {
    start();
  } catch (error) {
    console.error('[gym-neutron] deck 3D failed to start', error);
  }
}

function start() {
  const canvas = document.getElementById('stage3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: isStatic });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070b);
  scene.fog = new THREE.FogExp2(0x06070b, 0.085);
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 40);
  camera.position.set(0, 0, 3.4);

  addStudioLighting(renderer, scene);
  const materials = createMaterials('high');
  const atomRig = createAtom(materials);
  const barRig = createLoadableBar(materials);
  const dumbbells = createDumbbellPair(materials).group;
  scene.add(atomRig.group, barRig.group, dumbbells, createParticles(600));

  // Poses are authored for a 16:9 window; on other shapes, keep objects in
  // the same place relative to the scaled stage.
  let xScale = 1;
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    xScale = Math.min(1, (w / h) / (16 / 9));
  }
  window.addEventListener('resize', onResize);
  onResize();

  // Current values ease toward the active slide's pose.
  const pose = POSES[0];
  const cur = {
    atom: [...pose.atom], atomScale: HIDDEN, spread: pose.spread, ring: pose.ring,
    bar: [...pose.bar], barRot: [...pose.barRot], barScale: HIDDEN, db: HIDDEN, camZ: 6, exposure: pose.exposure,
  };
  let target = pose;
  let plates = 0;
  const snap = isStatic || reducedMotion;

  function onChange(detail) {
    target = POSES[Math.min(POSES.length - 1, detail.slide)];
    if (detail.slide === OFFER_SLIDE) plates = detail.step;
    else plates = detail.slide > OFFER_SLIDE ? 6 : 0;
  }
  document.addEventListener('deck:change', (e) => onChange(e.detail));
  if (window.__deck) onChange({ slide: window.__deck.state.slide, step: window.__deck.state.step });

  const mix = (a, b, f) => a + (b - a) * f;
  const mixArr = (a, b, f) => a.map((v, i) => mix(v, b[i], f));

  const clock = new THREE.Clock();
  function tick() {
    const delta = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    // The first slide eases in from further back and smaller (cur starts at
    // camZ 6, scale ~0); static export and reduced motion jump straight there.
    const f = snap ? 1 : 1 - Math.pow(1 - 0.06, delta * 60);
    Object.keys(cur).forEach((k) => {
      cur[k] = Array.isArray(cur[k]) ? mixArr(cur[k], target[k], f) : mix(cur[k], target[k], f);
    });

    const animate = !reducedMotion && !isStatic;
    atomRig.group.position.set(cur.atom[0] * xScale, cur.atom[1], cur.atom[2]);
    atomRig.group.scale.setScalar(cur.atomScale);
    atomRig.group.visible = cur.atomScale > 0.01;
    atomRig.group.rotation.y = animate ? Math.sin(t * 0.2) * 0.12 : 0;
    atomRig.update({ delta: animate ? delta : 0, animate, spread: cur.spread, ringAlpha: cur.ring });

    barRig.group.position.set(cur.bar[0] * xScale, cur.bar[1] + (animate ? Math.sin(t * 0.8) * 0.012 : 0), cur.bar[2]);
    barRig.group.rotation.set(cur.barRot[0], cur.barRot[1], cur.barRot[2]);
    barRig.group.scale.setScalar(cur.barScale);
    barRig.group.visible = cur.barScale > 0.01;
    barRig.update(plates, snap ? 1 : 1 - Math.pow(1 - 0.09, delta * 60));

    dumbbells.position.set(1.2 * xScale, 0.02, 0);
    dumbbells.scale.setScalar(cur.db);
    dumbbells.visible = cur.db > 0.01;
    if (animate) {
      dumbbells.rotation.y += delta * 0.35;
      dumbbells.rotation.x = Math.sin(t * 0.5) * 0.2;
    }

    camera.position.set(0, 0, cur.camZ);
    camera.lookAt(0, 0, 0);
    renderer.toneMappingExposure = cur.exposure;
    renderer.render(scene, camera);
    if (!document.documentElement.classList.contains('stage-ready')) document.documentElement.classList.add('stage-ready');
    requestAnimationFrame(tick);
  }

  renderer.compile(scene, camera);
  requestAnimationFrame(tick);
}
