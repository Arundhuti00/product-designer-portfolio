import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMaterials } from './materials.js';

// ---------- config: change these ----------
const NAME = 'ARUNDHUTI';
const SPLIT_WIDE = [9];              // one line on desktop
const SPLIT_NARROW = [4, 5];         // ARUN / DHUTI on phones
const LETTER_SIZE = 1.6;              // world units
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- renderer / scene ----------
const hero = document.getElementById('hero');
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
// key light from the top-right corner; it casts soft shadows down-left onto a backdrop
const key = new THREE.DirectionalLight(0xfff4e6, 2.8);
key.position.set(7, 7, 12);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -22, right: 22, top: 16, bottom: -16, near: 1, far: 60 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.03;
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.ShadowMaterial({ color: 0x1a1030, opacity: 0.26 }));
backdrop.position.z = -0.8;
backdrop.receiveShadow = true;
scene.add(backdrop);
const rim = new THREE.PointLight(0xff7ad9, 60, 30);
rim.position.set(6, -3, 5);
const fill = new THREE.PointLight(0x6fa8ff, 30, 30);
fill.position.set(-7, 2, 4);
scene.add(key, rim, fill);

// ---------- build letters ----------
const font = await new FontLoader().loadAsync('assets/fonts/helvetiker_bold.typeface.json');
const materials = buildMaterials();
const bodies = [];

const gaps = 0.14;
// jiggle strength per letter, in order A R U N D H U T I
const JIGGLE = [1, 0.15, 0.6, 0.9, 0.1, 0.55, 0, 0.45, 0.25];
const textOpts = {
  font, size: LETTER_SIZE, depth: 0.4, curveSegments: 24,
  bevelEnabled: true, bevelThickness: 0.42, bevelSize: 0.24, bevelSegments: 28,   // big bevel = soft, rounded corners
};
// row pitch = real glyph height (cap height + bevel), so rows sit snug without overlapping
const probe = new TextGeometry('H', textOpts);
probe.computeBoundingBox();
const rowHeight = probe.boundingBox.getSize(new THREE.Vector3()).y * 1.02;
probe.dispose();
let materialIndex = 0;

// build the nine letters once; where they sit is decided by layout()
[...NAME].forEach((char) => {
  const geo = new TextGeometry(char, textOpts);
  geo.center();
  const smooth = toCreasedNormals(geo, Math.PI / 2.2);
  geo.dispose();
  smooth.computeBoundingBox();
  const size = smooth.boundingBox.getSize(new THREE.Vector3());
  const material = materials[materialIndex++ % materials.length];
  const mesh = new THREE.Mesh(smooth, material);
  // fur is drawn as stacked shells (see materials.js) so it has real depth and soft edges
  if (material.userData.furShells) mesh.add(...material.userData.furShells.map((m) => new THREE.Mesh(smooth, m)));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  bodies.push({
    mesh, fur: material.userData.furShells ? material.userData : null,
    w: size.x, h: size.y, r: 0.5 * Math.max(size.x, size.y) * 0.8,
    homeX: 0, homeY: 0, homeRz: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    rz: 0, vrz: 0, ry: 0, vry: 0, rx: 0, vrx: 0,
    z: 0, scale: 1, phase: bodies.length * 1.7, index: bodies.length,
    jig: JIGGLE[bodies.length] ?? 0,            // how soft/jiggly this letter is (0 = rigid)
    ex: 0, vex: 0, ey: 0, vey: 0, pvx: 0, pvy: 0,   // jiggle springs + last velocity
    pop: 0, vpop: 0, fb: 0, vfb: 0, shake: 0, gravity: 0,
  });
});

// Arrange the letters into rows, e.g. [9] = one line, [4, 5] = ARUN / DHUTI.
let split = SPLIT_WIDE, contentW = 0, contentH = 0;
function layout(rowSizes) {
  split = rowSizes;
  let start = 0;
  rowSizes.forEach((count, row) => {
    const items = bodies.slice(start, start + count);
    let cursor = 0;
    items.forEach((it, i) => {
      if (i > 0) {
        const prev = items[i - 1];
        cursor += Math.max((prev.w + it.w) / 2 + gaps, prev.r + it.r);
      }
      it.homeX = cursor;
    });
    const rowWidth = cursor;
    const y = ((rowSizes.length - 1) / 2 - row) * rowHeight;
    items.forEach((it, i) => {
      const jitter = ((i * 7 + row * 3) % 5 - 2) / 2;       // deterministic, -1..1
      it.homeX += -rowWidth / 2 + (row % 2 ? 0.1 : -0.1);
      it.homeY = y + jitter * 0.04;
      it.homeRz = jitter * 0.09;
    });
    start += count;
  });
  contentW = 2 * Math.max(...bodies.map((b) => Math.abs(b.homeX) + b.w / 2));
  contentH = rowSizes.length * rowHeight + 0.6;
}
layout(SPLIT_WIDE);
const wideContentW = contentW;      // remembered: phones size the two-line name relative to the one-line width
bodies.forEach((b) => { b.x = b.homeX; b.y = b.homeY; b.rz = b.homeRz; });

// ---------- sizing ----------
let halfW = 100, halfH = 100, camY = 0;   // huge until the first resize(), so letters never get clamped into a clump on load
const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const reveal = document.getElementById('reveal');
const tagArc = document.getElementById('arc');
const tagBadge = document.getElementById('tag');

function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const narrow = w < 700;
  if (narrow !== (split === SPLIT_NARROW)) {                 // crossing the phone breakpoint: re-arrange the name
    layout(narrow ? SPLIT_NARROW : SPLIT_WIDE);
    bodies.forEach((b) => { b.x = b.homeX; b.y = b.homeY; b.vx = b.vy = 0; });
  }
  // phones: the two-line name is sized so its letters are 10% bigger than the old one-line version was
  const visibleW = narrow ? wideContentW * 1.65 / 1.1 : contentW * 1.75;
  const widthFit = visibleW / (2 * tanHalf * camera.aspect);
  const dist = narrow ? widthFit : Math.max((contentH * 4) / (2 * tanHalf), widthFit);   // phones: width only, so the hero can be any height
  halfH = tanHalf * dist;
  halfW = halfH * camera.aspect;
  // wide: look slightly below centre so the name sits higher. phones: pin the name 190px from the top, so the layout
  // doesn't depend on how tall the hero is (the hero is then sized to fit its content, see placeTags)
  camY = narrow ? halfH * (1 - (2 * 190) / h) : halfH * 0.2;
  camera.position.set(0, -camY, dist);
  camera.updateProjectionMatrix();
  placeTags();
}

// pin the little labels to the first letter of each row
function toScreen(x, y) {
  const v = new THREE.Vector3(x, y, 0).project(camera);
  return { x: (v.x * 0.5 + 0.5) * hero.clientWidth, y: (-v.y * 0.5 + 0.5) * hero.clientHeight };
}
function placeTags() {
    const first = bodies[0];
  // greeting: centred over the name, with a clear gap above the top row
  const top = Math.max(...bodies.slice(0, split[0]).map((b) => b.homeY + b.h / 2));
  const a = toScreen(0, top);
  // size labels from the on-screen width of the name, so they shrink with it on phones
  const left = toScreen(Math.min(...bodies.map((b) => b.homeX - b.w / 2)), 0).x;
  const right = toScreen(Math.max(...bodies.map((b) => b.homeX + b.w / 2)), 0).x;
  hero.style.setProperty('--name-w', `${right - left}px`);
  // floating tag: over the top-left corner of the name on wide screens; centred just below the name on phones
  const narrow = hero.clientWidth < 700;
  let tagExtra = 0;
  if (narrow) {
    const nameBottom = toScreen(0, Math.min(...bodies.map((b) => b.homeY - b.h / 2))).y;
    tagBadge.style.transform = `translate(${hero.clientWidth / 2}px, ${nameBottom + 10}px) translate(-50%, 0)`;
    tagExtra = tagBadge.offsetHeight + 4;
  } else {
    const p = toScreen(first.homeX - first.w * 0.5, first.homeY + first.h * 0.5);
    tagBadge.style.transform = `translate(${p.x}px, ${p.y}px) translate(-30%, -110%) translateY(4px)`;
  }
  // where the tagline docks (just under the name) after Reset
  const bottom = Math.min(...bodies.slice(-split[split.length - 1]).map((b) => b.homeY - b.h / 2));
  const dockY = toScreen(0, bottom).y + 40 + tagExtra;
  reveal.style.setProperty('--dock-y', `${dockY}px`);
  if (narrow) {                                            // phones: hero hugs its content, no big gap before the next section
    const want = Math.round(dockY + reveal.offsetHeight + 28);
    if (Math.abs(hero.clientHeight - want) > 1) hero.style.height = `${want}px`;
  } else if (hero.style.height) hero.style.height = '';
  tagArc.style.transform = `translate(${a.x}px, ${a.y - 26}px) translate(-50%, -100%)`;
}
new ResizeObserver(resize).observe(hero);
resize();

// ---------- interaction ----------
const ray = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const pointer = { ndc: new THREE.Vector2(), world: new THREE.Vector3(), down: false };
let hovered = null;

function updatePointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(pointer.ndc, camera);
  ray.ray.intersectPlane(plane, pointer.world);
}
function pick() {
  ray.setFromCamera(pointer.ndc, camera);
  const hit = ray.intersectObjects(bodies.map((b) => b.mesh), false)[0];
  return hit ? bodies.find((b) => b.mesh === hit.object) : null;
}

canvas.addEventListener('pointermove', (e) => {
  updatePointer(e);
  {
    hovered = pick();
    canvas.style.cursor = hovered ? 'pointer' : '';
  }
});
// tap a letter: each one does something different (see TAPS below). No dragging.
canvas.addEventListener('pointerdown', (e) => {
  updatePointer(e);
  const hit = pick();
  if (hit) TAPS[hit.index]?.(hit);
});
// On touch screens: only block page scroll when the finger lands on a letter
canvas.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  updatePointer(t);
  if (pick()) e.preventDefault();
}, { passive: false });

// ---------- what a tap does, per letter (A R U N D H U T I) ----------
const TAPS = [
  (b) => { b.vy += 7; b.vex -= 16; b.vey += 16; },                        // A  jelly: boing
  (b) => { b.vpop += 11; b.vy += 4; b.vrz += 3; },                        // R  silver fabric: inflates and floats up
  (b) => { b.shake = 1; b.vfb += 14; },                                   // U  fur: shivers and puffs up
  (b) => { b.vey -= 24; b.vex += 20; },                                   // N  sponge: squished, then slowly springs back
  (b) => { b.vry += 16; },                                                // D  pearl: spins around
  (b) => { b.vrz += 30; },                                                // H  felt: rolls a full turn
  (b) => { b.vrx += 16; },                                                // U  chrome: flips head over heels
  (b) => {                                                                // T  checker: shockwave that knocks the others away
    b.vex += 14; b.vey -= 14;
    for (const o of bodies) {
      if (o === b) continue;
      const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
      const push = 20 / (1 + d * 0.7);
      o.vx += (dx / d) * push; o.vy += (dy / d) * push; o.vex += (dx / d) * 4; o.vey += (dy / d) * 4;
    }
  },
  (b) => { b.gravity = 2.8; b.vy += 3; },                                 // I  marble: drops with gravity and bounces
];

// ---------- physics (2D, in the z = 0 plane) ----------
const damp = (v, k, dt) => v * Math.exp(-k * dt);

function step(dt, t) {
  if (dt < 1e-5) return;
  for (const b of bodies) {
    // letters glide back to their place in the name after a tap knocks them about
    if (b.gravity <= 0) {
      b.vx += ((b.homeX - b.x) * 14 - b.vx * 5) * dt;
      b.vy += ((b.homeY - b.y) * 14 - b.vy * 5) * dt;
    }
    if (b.gravity > 0) { b.vy -= 24 * dt; b.vx = damp(b.vx, 0.4, dt); b.gravity -= dt; }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // keep letters on screen
    const mx = halfW - b.w * 0.5, my = halfH - b.h * 0.5;
    if (Math.abs(b.x) > mx) { b.x = Math.sign(b.x) * mx; b.vx *= -0.55; b.vrz += b.vy * 0.1; }
    if (Math.abs(b.y + camY) > my) { b.y = Math.sign(b.y + camY) * my - camY; b.vy *= -0.55; b.vrz -= b.vx * 0.1; }

    // wobble: z-rotation springs to its resting tilt (plus a lean into the motion)
    const lean = 0;
    const rzRest = b.homeRz + Math.round((b.rz - b.homeRz) / (Math.PI * 2)) * Math.PI * 2;
    b.vrz += ((rzRest + lean - b.rz) * 18 - b.vrz * 2.6) * dt;
    b.rz += b.vrz * dt;

    // x/y spins spring to the nearest full turn so a tap does a clean flip
    const turn = Math.PI * 2;
    b.vry += ((Math.round(b.ry / turn) * turn - b.ry) * 30 - b.vry * 2.4) * dt;
    b.ry += b.vry * dt;
    b.vrx += ((Math.round(b.rx / turn) * turn - b.rx) * 30 - b.vrx * 2.4) * dt;
    b.rx += b.vrx * dt;

    // jiggle: springs on x/y stretch, kicked by acceleration (starts, stops, hits)
    if (b.jig) {
      const kick = 0.012 * b.jig;
      const ax = THREE.MathUtils.clamp((b.vx - b.pvx) / dt, -300, 300);
      const ay = THREE.MathUtils.clamp((b.vy - b.pvy) / dt, -300, 300);
      b.vex += (-b.ex * 150 - b.vex * 5.5) * dt + ax * kick * dt * 6;
      b.vey += (-b.ey * 150 - b.vey * 5.5) * dt + ay * kick * dt * 6;
      b.ex = THREE.MathUtils.clamp(b.ex + b.vex * dt, -0.45, 0.45);
      b.ey = THREE.MathUtils.clamp(b.ey + b.vey * dt, -0.45, 0.45);
    } else if (b.ex || b.ey) { b.ex = b.ey = b.vex = b.vey = 0; }
    b.pvx = b.vx; b.pvy = b.vy;

    // tap effects: inflate spring, fur puff spring, shiver
    b.vpop += (-b.pop * 90 - b.vpop * 5) * dt; b.pop += b.vpop * dt;
    b.vfb += (-b.fb * 70 - b.vfb * 5) * dt; b.fb += b.vfb * dt;
    if (b.fur) b.fur.furThickness.value = b.fur.baseThickness * (1 + Math.max(-0.5, b.fb));
    b.shake *= Math.exp(-3 * dt);

    b.z += (0 - b.z) * Math.min(1, dt * 12);
    const wantScale = b === hovered ? 1.05 : 1;
    b.scale += (wantScale - b.scale) * Math.min(1, dt * 12);
  }

  // circle-vs-circle collisions
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1e-4;
      const overlap = a.r + b.r - dist;
      if (overlap <= 0) continue;
      const nx = dx / dist, ny = dy / dist;
      const wa = 0.5;
      const wb = 1 - wa;
      a.x -= nx * overlap * wa; a.y -= ny * overlap * wa;
      b.x += nx * overlap * wb; b.y += ny * overlap * wb;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const j2 = -rel * 1.45;                     // restitution ~0.45
        const ia = 1, ib = 1;
        const total = ia + ib || 1;
        a.vx -= nx * j2 * (ia / total) * 2; a.vy -= ny * j2 * (ia / total) * 2;
        b.vx += nx * j2 * (ib / total) * 2; b.vy += ny * j2 * (ib / total) * 2;
        // knocks make the letters spin a little
        const tang = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
        a.vrz += tang * 0.15; b.vrz += tang * 0.15;
        if (Math.abs(rel) > 3) { a.vry += rel * 0.5; b.vry -= rel * 0.5; }
      }
    }
  }

  // apply to meshes
  for (const b of bodies) {
    const bob = reduceMotion ? 0 : Math.sin(t * 0.9 + b.phase) * 0.035;
    const sway = reduceMotion ? 0 : Math.sin(t * 0.7 + b.phase * 1.3) * 0.04;
    b.mesh.position.set(b.x, b.y + bob, b.z);
    const shiver = Math.sin(t * 80) * 0.09 * b.shake;
    b.mesh.rotation.set(b.rx + sway + (b.vy * -0.01), b.ry + sway * 1.4 + b.vx * 0.012, b.rz + shiver);
    const s = b.scale * (1 + b.pop * 0.5);
    b.mesh.scale.set(s * (1 + b.ex), s * (1 + b.ey), s * (1 - (b.ex + b.ey) * 0.5));
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (!visible) return;
  const t = clock.elapsedTime;
  // two sub-steps keep fast throws from tunnelling through other letters
  step(dt / 2, t); step(dt / 2, t);
  renderer.render(scene, camera);
});

hero.classList.add('ready');
