/* Gym Neutron 3D scene: renderer, lighting, post-processing, scroll cursor
   and the damped animation loop. Loaded as an ES module; if it fails (no
   WebGL, offline, opened from file://) the page keeps its CSS backdrop and
   every form, countdown and quiz feature still works from js/app.js. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createMaterials, createParticles } from './equipment.js';
import { PLATE_ORDER, addStudioLighting, createAtom, createLoadableBar, createDumbbellPair } from './rigs.js';
import { SECTION_IDS, plateThreshold, sampleScene } from './choreography.js';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const quality = isMobile ? 'low' : 'high';

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (error) {
    return false;
  }
}

if (hasWebGL()) {
  try {
    start();
  } catch (error) {
    root.classList.add('no-webgl');
    console.error('[gym-neutron] 3D scene failed to start', error);
  }
} else {
  root.classList.add('no-webgl');
}

function start() {
  gsap.registerPlugin(ScrollTrigger);
  const canvas = document.getElementById('scene');

  // ── renderer ────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'low', powerPreference: 'high-performance', stencil: false });
  const pixelRatio = () => Math.min(window.devicePixelRatio, quality === 'low' ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06070b);
  scene.fog = new THREE.FogExp2(0x06070b, 0.085);

  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 40);
  camera.position.set(0, 0, 7);

  addStudioLighting(renderer, scene);
  const materials = createMaterials(quality);

  // The atom (hero, fear, claim), the bar that loads during the offer, and
  // the dumbbell pair for the element quiz. All start hidden at scale ~0.
  const atomRig = createAtom(materials);
  const atom = atomRig.group;
  atom.scale.setScalar(0.0001);
  scene.add(atom);

  const barRig = createLoadableBar(materials);
  const barGroup = barRig.group;
  barGroup.scale.setScalar(0.0001);
  scene.add(barGroup);

  const dumbbells = createDumbbellPair(materials).group;
  dumbbells.scale.setScalar(0.0001);
  scene.add(dumbbells);

  const particles = createParticles(quality === 'low' ? 260 : 700);
  scene.add(particles);

  // ── post-processing (desktop only) ──────────────────────────────────
  let composer = null;
  let grainPass = null;
  if (quality === 'high') {
    const target = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType });
    composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(pixelRatio());
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    // High threshold: only the orbit rings (rendered above 1.0) bloom, not chrome highlights.
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.4, 0.98));
    composer.addPass(new ShaderPass(vignetteShader()));
    composer.addPass(new OutputPass());
    grainPass = new ShaderPass(grainShader());
    composer.addPass(grainPass);
  }

  // ── damped state ────────────────────────────────────────────────────
  const ease = reducedMotion ? 1 : 0.07;
  const vec = (x, y, z) => ({ current: [x, y, z], target: [x, y, z] });
  const num = (v) => ({ current: v, target: v });
  const state = {
    atomPos: vec(0.92, 0.02, 0), atomScale: num(0.0001), spread: num(1), ringAlpha: num(1),
    barPos: vec(3.6, -0.1, 0), barRot: vec(0, -0.9, 0), barScale: num(0.0001),
    dbPos: vec(3, 0, 0), dbScale: num(0.0001),
    camPos: vec(0, 0, 7), exposure: num(1.05),
    mouseX: num(0), mouseY: num(0),
  };
  function damp(entry, factor) {
    if (Array.isArray(entry.current)) {
      entry.current = entry.current.map((v, i) => v + (entry.target[i] - v) * factor);
    } else {
      entry.current += (entry.target - entry.current) * factor;
    }
  }

  // ── scroll cursor ───────────────────────────────────────────────────
  let cursor = 0.5;
  let needsRender = true;
  SECTION_IDS.forEach((id, index) => {
    const el = document.getElementById(id);
    if (!el) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top center',
      end: 'bottom center',
      onUpdate: (self) => { cursor = index + self.progress; needsRender = true; },
      onToggle: (self) => { if (self.isActive) { cursor = index + self.progress; needsRender = true; } },
    });
  });

  let lenis = null;
  if (!reducedMotion) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, prevent: () => false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__gnLenis = lenis;
  }

  window.addEventListener('pointermove', (event) => {
    state.mouseX.target = (event.clientX / window.innerWidth) * 2 - 1;
    state.mouseY.target = -((event.clientY / window.innerHeight) * 2 - 1);
    needsRender = true;
  }, { passive: true });

  // Offer stack items light up as their plate pair goes on the bar.
  const stackItems = Array.from(document.querySelectorAll('[data-plate-step]'));
  const totalEl = document.querySelector('[data-stack-total]');
  let loadedCount = -1;
  function syncStack(count) {
    if (count === loadedCount) return;
    loadedCount = count;
    let total = 0;
    stackItems.forEach((item, i) => {
      const on = i < count;
      item.classList.toggle('is-loaded', on);
      if (on) total += Number(item.dataset.value || 0);
    });
    if (totalEl) totalEl.textContent = `₱${total.toLocaleString('en-PH')}`;
  }
  if (stackItems.length) root.classList.add('stack-live');

  // ── fit the 3D into the space beside the text column ────────────────
  // Keyframes are authored at 1440×900. On narrower desktops the text column
  // takes a bigger share of the width, so objects shift right and shrink to
  // stay in the free space; phones keep their own centred keyframes.
  const BASE = { colFrac: 708 / 1440, aspect: 1440 / 900, freeRatio: (1440 - 708) / 900 };
  const fit = { shift: 0, scale: 1 };
  function measureLayout() {
    if (isMobile) return;
    const col = document.querySelector('#fear .col') || document.querySelector('.col');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const colRight = col ? Math.min(col.getBoundingClientRect().right, w * 0.7) : w * 0.5;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    fit.scale = Math.min(1.08, Math.max(0.6, ((w - colRight) / h) / BASE.freeRatio));
    fit.shift = ((colRight / w) * (w / h) - BASE.colFrac * BASE.aspect) * 3.3 * tanHalf;
  }
  measureLayout();

  // ── resize ──────────────────────────────────────────────────────────
  let resizeQueued = false;
  window.addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      measureLayout();
      resizeQueued = false;
      needsRender = true;
    });
  });

  // ── loop ────────────────────────────────────────────────────────────
  const clock = new THREE.Clock();
  let running = true;
  let rafId = 0;
  let firstFrame = true;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      clock.getDelta();
      rafId = requestAnimationFrame(tick);
    }
  });

  let frames = 0;
  window.__gnDebug = () => ({ cursor, frames, running, hidden: document.hidden, contextLost: renderer.getContext().isContextLost() });

  function tick() {
    if (!running) return;
    frames += 1;
    const delta = Math.min(clock.getDelta(), 0.1);
    const time = clock.elapsedTime;
    const animate = !reducedMotion;

    if (animate || needsRender || firstFrame) {
      const targets = sampleScene(cursor, isMobile);
      Object.keys(targets).forEach((k) => { if (state[k]) state[k].target = targets[k]; });
      const factor = 1 - Math.pow(1 - ease, delta * 60);
      Object.values(state).forEach((entry) => damp(entry, firstFrame && reducedMotion ? 1 : factor));

      applyScene(targets.offerProgress, time, delta, animate);
      if (composer) {
        if (grainPass) grainPass.uniforms.uTime.value = time;
        composer.render(delta);
      } else {
        renderer.render(scene, camera);
      }
      needsRender = false;
      if (firstFrame) {
        firstFrame = false;
        root.classList.add('scene-ready');
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  function applyScene(offerProgress, time, delta, animate) {
    const velocity = lenis ? Math.min(Math.abs(lenis.velocity) * 0.04, 2.5) : 0;

    // Atom
    atom.position.fromArray(state.atomPos.current);
    atom.position.x += fit.shift;
    atom.scale.setScalar(state.atomScale.current * fit.scale);
    atom.visible = state.atomScale.current > 0.01;
    atom.rotation.y = state.mouseX.current * 0.25 + (animate ? Math.sin(time * 0.2) * 0.1 : 0);
    atom.rotation.x = -state.mouseY.current * 0.15;
    atomRig.update({ delta, animate, velocity, spread: state.spread.current, ringAlpha: state.ringAlpha.current });

    // Bar and its plates
    barGroup.position.fromArray(state.barPos.current);
    barGroup.position.x += fit.shift;
    barGroup.rotation.set(state.barRot.current[0], state.barRot.current[1], state.barRot.current[2]);
    barGroup.scale.setScalar(state.barScale.current * fit.scale);
    barGroup.visible = state.barScale.current > 0.01;
    if (animate) barGroup.position.y += Math.sin(time * 0.8) * 0.012;

    let count = 0;
    PLATE_ORDER.forEach((_, i) => { if (offerProgress >= plateThreshold(i)) count = i + 1; });
    if (cursor > 3) count = PLATE_ORDER.length; // stays loaded after the offer
    if (cursor < 2) count = 0;
    syncStack(count);

    barRig.update(count, reducedMotion ? 1 : 1 - Math.pow(1 - 0.09, delta * 60));

    // Dumbbells
    dumbbells.position.fromArray(state.dbPos.current);
    dumbbells.position.x += fit.shift;
    dumbbells.scale.setScalar(state.dbScale.current * fit.scale);
    dumbbells.visible = state.dbScale.current > 0.01;
    if (animate) {
      dumbbells.rotation.y += delta * 0.35;
      dumbbells.rotation.x = Math.sin(time * 0.5) * 0.2;
    }

    // Particles drift slowly; scrolling speeds them up a little.
    if (animate) particles.rotation.y += delta * (0.012 + velocity * 0.01);

    // Camera
    const [cx, cy, cz] = state.camPos.current;
    camera.position.set(cx + state.mouseX.current * 0.12, cy + state.mouseY.current * 0.08, cz);
    camera.lookAt(cx * 0.5, cy * 0.5, 0);
    renderer.toneMappingExposure = state.exposure.current;
  }

  // Shader compile before the first visible frame avoids a hitch.
  renderer.compile(scene, camera);
  rafId = requestAnimationFrame(tick);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

function vignetteShader() {
  return {
    uniforms: { tDiffuse: { value: null }, uOffset: { value: 0.35 }, uDarkness: { value: 0.6 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision mediump float;
      uniform sampler2D tDiffuse; uniform float uOffset; uniform float uDarkness; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float v = smoothstep(0.85, uOffset, length(vUv - 0.5));
        gl_FragColor = vec4(mix(c.rgb * (1.0 - uDarkness), c.rgb, v), c.a);
      }`,
  };
}

function grainShader() {
  return {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uIntensity: { value: 0.045 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision mediump float;
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uIntensity; varying vec2 vUv;
      float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float n = rand(vUv + fract(uTime)) - 0.5;
        gl_FragColor = vec4(c.rgb + n * uIntensity, c.a);
      }`,
  };
}
