/* Procedural gym equipment, modelled at real-world size (1 unit = 1 metre).
   Bumper plates:  450 mm across, 50 mm bore, steel hub, recessed face, raised rim.
   Olympic bar:    2.2 m long, 28 mm knurled shaft, 50 mm sleeves, collars.
   Hex dumbbell:   six-sided rubber heads, chrome knurled handle and collars.
   Kettlebell:     round body with a flat base, a separate steel handle with two horns. */
import * as THREE from 'three';

const TAU = Math.PI * 2;

export const PLATE_KINDS = {
  red: { kg: 25, thickness: 0.066, color: 0xc8142d },
  blue: { kg: 20, thickness: 0.055, color: 0x1f4fd6 },
  white: { kg: 5, thickness: 0.03, color: 0xc9ced8 },
};

export function createMaterials(quality) {
  const physical = quality === 'high';
  const paint = physical
    ? new THREE.MeshPhysicalMaterial({ color: 0x2f6bff, metalness: 0.15, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 })
    : new THREE.MeshStandardMaterial({ color: 0x2f6bff, metalness: 0.2, roughness: 0.3 });
  return {
    chrome: new THREE.MeshStandardMaterial({ color: 0xe8ebf0, metalness: 1, roughness: 0.16 }),
    knurl: new THREE.MeshStandardMaterial({ color: 0xaeb4bf, metalness: 1, roughness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: 0.3 }),
    rawSteel: new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.9, roughness: 0.42 }),
    blackRubber: new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0, roughness: 0.72 }),
    paint,
    rubber: Object.fromEntries(Object.entries(PLATE_KINDS).map(([kind, spec]) => [
      kind,
      new THREE.MeshStandardMaterial({ color: spec.color, metalness: 0, roughness: kind === 'white' ? 0.48 : 0.56 }),
    ])),
  };
}

/* A cylinder lying along the X axis, centred on x. */
function barCylinder(radius, length, x, material, segments = 40) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1);
  geometry.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.x = x;
  return mesh;
}

/* Small "25 KG" style label printed on a plate face. */
const labelCache = new Map();
function plateLabelTexture(text, dark) {
  const key = `${text}-${dark}`;
  if (labelCache.has(key)) return labelCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = dark ? '#1a1c22' : '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 76px Archivo, "Arial Black", sans-serif';
  ctx.fillText(text, 128, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  labelCache.set(key, texture);
  return texture;
}

const plateGeometryCache = new Map();
function plateGeometries(thickness) {
  if (plateGeometryCache.has(thickness)) return plateGeometryCache.get(thickness);
  const h = thickness / 2;
  const face = h * 0.78; // the recessed face sits inside the rim
  const v = (r, y) => new THREE.Vector2(r, y);
  // Rubber body: inner edge at the hub, recessed face, ramp up to a rounded rim.
  const rubberProfile = [
    v(0.0605, -face), v(0.183, -face), v(0.2, -h), v(0.219, -h),
    v(0.225, -h + 0.006), v(0.225, h - 0.006), v(0.219, h), v(0.2, h),
    v(0.183, face), v(0.0605, face), v(0.0605, -face),
  ];
  // Steel hub insert: stands slightly proud of the rubber face.
  const hubH = face + 0.003;
  const hubProfile = [v(0.0255, -hubH), v(0.06, -hubH), v(0.06, hubH), v(0.0255, hubH), v(0.0255, -hubH)];
  const geometries = {
    rubber: new THREE.LatheGeometry(rubberProfile, 72),
    hub: new THREE.LatheGeometry(hubProfile, 48),
    face,
  };
  plateGeometryCache.set(thickness, geometries);
  return geometries;
}

/* A bumper plate whose bore runs along the X axis. */
export function createPlate(kind, materials) {
  const spec = PLATE_KINDS[kind];
  const { rubber, hub, face } = plateGeometries(spec.thickness);
  const plate = new THREE.Group();
  plate.name = `plate-${kind}`;

  const body = new THREE.Group(); // lathe geometry spins around Y, so turn it onto X
  body.rotation.z = Math.PI / 2;
  const rubberMaterial = materials.rubber[kind].clone();
  rubberMaterial.side = THREE.DoubleSide;
  body.add(new THREE.Mesh(rubber, rubberMaterial));
  const hubMaterial = materials.steel.clone();
  hubMaterial.side = THREE.DoubleSide;
  body.add(new THREE.Mesh(hub, hubMaterial));
  plate.add(body);

  // Weight printed on both faces, above the hub.
  const labelMaterial = new THREE.MeshBasicMaterial({
    map: plateLabelTexture(`${spec.kg} KG`, kind === 'white'),
    transparent: true,
    depthWrite: false,
  });
  const labelGeometry = new THREE.PlaneGeometry(0.11, 0.055);
  [1, -1].forEach((side) => {
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.set(side * (face + 0.0008), 0.125, 0);
    label.rotation.y = side * Math.PI / 2;
    plate.add(label);
  });

  plate.userData = { kind, thickness: spec.thickness, kg: spec.kg, materials: [rubberMaterial, hubMaterial, labelMaterial] };
  return plate;
}

/* Olympic barbell along X. Returns the group and the x where plates start on each sleeve. */
export function createBarbell(materials) {
  const bar = new THREE.Group();
  bar.name = 'barbell';
  const shaftR = 0.014;
  bar.add(barCylinder(shaftR, 1.31, 0, materials.chrome));
  // Knurled grip bands and the centre knurl sit just proud of the shaft.
  [[-0.415, 0.41], [0.415, 0.41], [0, 0.16]].forEach(([x, len]) => {
    bar.add(barCylinder(shaftR + 0.0006, len, x, materials.knurl));
  });
  [-1, 1].forEach((side) => {
    bar.add(barCylinder(0.035, 0.03, side * 0.67, materials.chrome, 48)); // collar
    bar.add(barCylinder(0.031, 0.006, side * 0.689, materials.steel, 48)); // collar lip
    bar.add(barCylinder(0.025, 0.415, side * 0.8925, materials.chrome, 48)); // sleeve
    bar.add(barCylinder(0.0265, 0.006, side * 1.103, materials.steel, 48)); // end cap
  });
  return { group: bar, plateStart: 0.694, sleeveEnd: 1.1 };
}

function hexagonShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + Math.PI / 6;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/* Hex dumbbell along X, about 0.3 m long. */
export function createDumbbell(materials) {
  const dumbbell = new THREE.Group();
  dumbbell.name = 'dumbbell';
  const headLength = 0.075;
  const headGeometry = new THREE.ExtrudeGeometry(hexagonShape(0.058), {
    depth: headLength - 0.01, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3, curveSegments: 1,
  });
  headGeometry.center();
  headGeometry.rotateY(Math.PI / 2);
  const capGeometry = new THREE.CylinderGeometry(0.024, 0.024, 0.004, 40);
  capGeometry.rotateZ(Math.PI / 2);

  dumbbell.add(barCylinder(0.0155, 0.125, 0, materials.knurl));
  [-1, 1].forEach((side) => {
    dumbbell.add(barCylinder(0.021, 0.012, side * 0.0685, materials.chrome));
    const head = new THREE.Mesh(headGeometry, materials.blackRubber);
    head.position.x = side * (0.0745 + headLength / 2);
    dumbbell.add(head);
    const cap = new THREE.Mesh(capGeometry, materials.chrome);
    cap.position.x = side * (0.0745 + headLength + 0.001);
    dumbbell.add(cap);
  });
  return dumbbell;
}

/* Competition-style kettlebell standing on its flat base, about 0.29 m tall. */
export function createKettlebell(materials) {
  const kettlebell = new THREE.Group();
  kettlebell.name = 'kettlebell';
  const R = 0.106;
  const cy = 0.106;
  const base = 0.03; // height of the flat base cut
  const startAngle = Math.asin((base - cy) / R);
  const profile = [new THREE.Vector2(0, base)];
  const steps = 28;
  for (let i = 0; i <= steps; i += 1) {
    const a = startAngle + ((Math.PI / 2 - startAngle) * i) / steps;
    profile.push(new THREE.Vector2(Math.cos(a) * R, cy + Math.sin(a) * R));
  }
  profile[profile.length - 1].x = 0;
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), materials.paint);
  body.position.y = -base;
  kettlebell.add(body);

  // Handle: two horns rise out of the shoulders and meet in a flat grip.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.058, 0.148, 0),
    new THREE.Vector3(-0.074, 0.205, 0),
    new THREE.Vector3(-0.068, 0.252, 0),
    new THREE.Vector3(-0.036, 0.276, 0),
    new THREE.Vector3(0.036, 0.276, 0),
    new THREE.Vector3(0.068, 0.252, 0),
    new THREE.Vector3(0.074, 0.205, 0),
    new THREE.Vector3(0.058, 0.148, 0),
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.0165, 20, false), materials.rawSteel);
  handle.position.y = -base;
  kettlebell.add(handle);
  return kettlebell;
}

/* Glowing orbit ring for the atom. toneMapped false lets bloom pick it up. */
export function createOrbitRing(radius, color, strength) {
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(strength),
    toneMapped: false,
    transparent: true,
    opacity: 1,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0032, 8, 180), material);
  ring.rotation.x = Math.PI / 2; // lie flat in the pivot's XZ plane
  return ring;
}

/* Drifting specks of light: blue, red and white "particles" around the scene. */
export function createParticles(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0x4f86ff), new THREE.Color(0xff3b4d), new THREE.Color(0xdfe6ff)];
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < count; i += 1) {
    const r = 1.6 + random() * 4.4;
    const theta = random() * TAU;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi) * 0.7;
    // Keep every speck well in front of the camera (which sits at z ≈ 3 to 5);
    // one too close renders as a big square.
    positions[i * 3 + 2] = Math.min(0.8, r * Math.sin(phi) * Math.sin(theta) - 1.5);
    const c = palette[i % 3];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // A soft round dot instead of the default square point.
  const dot = document.createElement('canvas');
  dot.width = 32;
  dot.height = 32;
  const ctx = dot.getContext('2d');
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.8)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);
  const material = new THREE.PointsMaterial({
    size: 0.03, map: new THREE.CanvasTexture(dot), vertexColors: true, transparent: true, opacity: 0.75,
    depthWrite: false, sizeAttenuation: true,
  });
  return new THREE.Points(geometry, material);
}
