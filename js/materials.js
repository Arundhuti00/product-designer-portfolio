// Procedural materials — one per letter. Everything is generated on <canvas>,
// so there are no image files to host or load.
import * as THREE from 'three';

// ---------- helpers ----------

function rng(seed) {
  // mulberry32: deterministic, so the letters look the same on every load
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw, { repeat = [1, 1], color = true, nearest = false } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (nearest) t.magFilter = THREE.NearestFilter;
  return t;
}

// Tileable value noise + fbm, for marble veins and wrinkles
function makeNoise(seed) {
  const r = rng(seed);
  const lattice = Array.from({ length: 64 * 64 }, r);
  const at = (x, y, p) => lattice[((y % p) + p) % p * 64 + (((x % p) + p) % p)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const value = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const u = smooth(x - xi), v = smooth(y - yi);
    const a = at(xi, yi, p), b = at(xi + 1, yi, p), c = at(xi, yi + 1, p), d = at(xi + 1, yi + 1, p);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x, y, base = 4, octaves = 4) => {
    let sum = 0, amp = 0.5, p = base, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * value(x * p, y * p, p);
      norm += amp; amp *= 0.5; p *= 2;
    }
    return sum / norm;
  };
}

function pixels(g, size, fn) {
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, gr, b] = fn(x / size, y / size);
      const i = (y * size + x) * 4;
      img.data[i] = r; img.data[i + 1] = gr; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------- the nine materials ----------

function jelly() {
  const bubbles = (g, size, light) => {
    const r = rng(2);
    g.fillStyle = light ? '#86d800' : '#808080';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const x = r() * size, y = r() * size, rad = 2 + r() * r() * 14;
      const grad = g.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad);
      if (light) { grad.addColorStop(0, 'rgba(255,255,220,0.95)'); grad.addColorStop(0.55, 'rgba(210,255,90,0.5)'); grad.addColorStop(1, 'rgba(120,200,0,0.0)'); }
      else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#808080'); }
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  };
  return new THREE.MeshPhysicalMaterial({
    map: canvasTexture(512, (g, s) => bubbles(g, s, true), { repeat: [1.3, 1.3] }),
    bumpMap: canvasTexture(512, (g, s) => bubbles(g, s, false), { repeat: [1.3, 1.3], color: false }),
    bumpScale: 3,
    color: 0x8bdc00, emissive: 0x2a6200, emissiveIntensity: 0.2,
    transmission: 0.6, thickness: 1.8, ior: 1.45,
    roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03,
    attenuationColor: 0x4fb000, attenuationDistance: 1.0,
    envMapIntensity: 1.5,
  });
}

// R: stretched silver lycra. Smooth satin with a few long, soft tension folds that fan out
// from the corners and edges of the glyph, like fabric pulled tight over a frame.
function silverFabric() {
  // texture covers glyph-space (the font's own coordinates) from -0.3 to 1.5
  const LO = -0.3, SPAN = 1.8;
  const tx = (v) => ((v - LO) / SPAN);
  const bump = canvasTexture(1024, (g, s) => {
    const r = rng(17);
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);

    // fine weave
    g.lineWidth = 1;
    for (let i = 0; i < s; i += 4) {
      g.strokeStyle = 'rgba(255,255,255,0.03)'; g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.03)'; g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke();
    }

    // tension folds: from anchors on the glyph's corners/edges toward its middle
    const anchors = [[-0.05, -0.05], [1.15, -0.05], [-0.05, 1.2], [0.95, 1.2], [0.55, -0.1], [-0.1, 0.6], [1.2, 0.35]];
    for (const [ax, ay] of anchors) {
      for (let k = 0; k < 2; k++) {
        const tX = 0.25 + r() * 0.7, tY = 0.2 + r() * 0.8;           // where this fold dies out
        const cX = (ax + tX) / 2 + (r() - 0.5) * 0.25, cY = (ay + tY) / 2 + (r() - 0.5) * 0.25;
        const w = (0.06 + r() * 0.08) * s / SPAN;
        for (const [shade, off, alpha] of [['255,255,255', 0, 0.12], ['0,0,0', w * 0.9, 0.1]]) {
          for (let pass = 0; pass < 5; pass++) {          // stacked strokes = soft, tapering edge
            g.strokeStyle = `rgba(${shade},${alpha})`;
            g.lineWidth = w * (1 - pass * 0.18);
            g.lineCap = 'round';
            g.beginPath();
            g.moveTo(tx(ax) * s + off, tx(ay) * s + off);
            g.quadraticCurveTo(tx(cX) * s + off, tx(cY) * s + off, tx(tX) * s + off, tx(tY) * s + off);
            g.stroke();
          }
        }
      }
    }
  }, { repeat: [1 / SPAN, 1 / SPAN], color: false });
  bump.offset.set(-LO / SPAN, -LO / SPAN);

  return new THREE.MeshPhysicalMaterial({
    color: 0x6a6e7c, metalness: 1, roughness: 0.3,
    bumpMap: bump, bumpScale: 0.45,
    sheen: 1, sheenColor: new THREE.Color(0xdfe6ff), sheenRoughness: 0.35,
    clearcoat: 0.3, clearcoatRoughness: 0.4,
    envMapIntensity: 1.6,
  });
}

// Real fur: the letter is drawn once as a dense pink undercoat, then again as ~28 thin
// "shells", each pushed a little further out along the surface normal and cut by a
// strand-pattern. Stacked up, you get individual hairs with soft, fuzzy silhouettes.
function pinkFur() {
  const SHELLS = 28, THICKNESS = 0.22;
  const furThickness = { value: THICKNESS };

  const strandMap = canvasTexture(256, (g, s) => {
    const r = rng(7);
    g.fillStyle = '#000'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const h = 90 + r() * 165;                       // grey level = how long this hair is
      g.fillStyle = `rgb(${h},${h},${h})`;
      g.beginPath(); g.arc(r() * s, r() * s, 0.9 + r() * 0.8, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [2.2, 2.2], color: false });

  const under = new THREE.MeshStandardMaterial({ color: 0xa83a62, roughness: 1 });
  const light = new THREE.Color(0xf0719c), dark = new THREE.Color(0x8e2a52);
  const shells = [];
  for (let i = 1; i <= SHELLS; i++) {
    const f = i / SHELLS;
    const m = new THREE.MeshStandardMaterial({
      color: dark.clone().lerp(light, Math.pow(f, 0.8)),   // darker at the roots, lighter at the tips
      roughness: 0.95, alphaMap: strandMap, alphaTest: 0.08 + f * 0.82,
    });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uFur = furThickness;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uFur;')
        .replace('#include <begin_vertex>',
          `#include <begin_vertex>
           // push out along the normal, with a tiny droop so the hairs hang naturally
           transformed += normal * uFur * ${f.toFixed(4)} - vec3(0.0, 0.25, 0.0) * uFur * ${(f * f).toFixed(4)};`);
    };
    shells.push(m);
  }
  under.userData.furShells = shells;
  under.userData.furThickness = furThickness;
  under.userData.baseThickness = THICKNESS;
  return under;
}

function orangeSponge() {
  const holes = (g, size, light) => {
    const r = rng(21);
    g.fillStyle = light ? '#de6c1c' : '#ffffff';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      const x = r() * size, y = r() * size, rad = 4 + r() * r() * 26;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      if (light) {
        grad.addColorStop(0, '#8d3a0c'); grad.addColorStop(0.7, '#d2651f'); grad.addColorStop(1, 'rgba(222,108,28,0)');
      } else {
        grad.addColorStop(0, '#000'); grad.addColorStop(0.75, '#444'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      }
      g.fillStyle = grad;
      g.beginPath(); g.ellipse(x, y, rad, rad * (0.7 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
    }
  };
  return new THREE.MeshStandardMaterial({
    map: canvasTexture(512, (g, s) => holes(g, s, true), { repeat: [1, 1] }),
    bumpMap: canvasTexture(512, (g, s) => holes(g, s, false), { repeat: [1, 1], color: false }),
    bumpScale: 16, roughness: 0.98,
  });
}

function ribbedPearl() {
  const ribs = canvasTexture(256, (g, s) => {
    const grad = g.createLinearGradient(0, 0, s, 0);
    for (let i = 0; i <= 8; i++) grad.addColorStop(i / 8, i % 2 ? '#fff' : '#222');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  }, { repeat: [3, 1], color: false });
  return new THREE.MeshPhysicalMaterial({
    color: 0xc9bfcb, roughness: 0.3, metalness: 0.1,
    bumpMap: ribs, bumpScale: 14,
    iridescence: 1, iridescenceIOR: 1.6,
    sheen: 1, sheenColor: new THREE.Color(0xffd6f0),
    clearcoat: 1, clearcoatRoughness: 0.15,
  });
}

function purpleFelt() {
  const noise = makeNoise(5);
  const wrinkles = canvasTexture(256, (g, s) => pixels(g, s, (u, v) => {
    const n = noise(u, v, 16, 3) * 255;
    return [n, n, n];
  }), { repeat: [3, 3], color: false });
  return new THREE.MeshPhysicalMaterial({
    color: 0x6234cc, roughness: 0.9, bumpMap: wrinkles, bumpScale: 9,
    sheen: 1, sheenColor: new THREE.Color(0xc2a8ff), sheenRoughness: 0.5,
  });
}

function liquidChrome() {
  return new THREE.MeshStandardMaterial({
    color: 0x8794c4, metalness: 1, roughness: 0.05, envMapIntensity: 2.2,
  });
}

function checkerFoam() {
  const noise = makeNoise(11);
  const map = canvasTexture(256, (g, s) => {
    const a = hex(0x0ea6d6), b = hex(0x6620b4);
    pixels(g, s, (u, v) => {
      const cell = (Math.floor(u * 4) + Math.floor(v * 4)) % 2 ? a : b;
      const n = 0.82 + noise(u, v, 16, 2) * 0.3;
      return cell.map((c) => Math.min(255, c * n));
    });
  }, { repeat: [1.2, 1.2], nearest: true });
  const bump = canvasTexture(256, (g, s) => pixels(g, s, (u, v) => {
    const n = noise(u, v, 16, 3) * 255;
    return [n, n, n];
  }), { repeat: [1.2, 1.2], color: false });
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 8, roughness: 0.95 });
}

function blueMarble() {
  const noise = makeNoise(3);
  const white = hex(0xdde1f4), blue = hex(0x1030cc), pink = hex(0xc4a0f4);
  const map = canvasTexture(512, (g, s) => pixels(g, s, (u, v) => {
    const warp = noise(u, v, 3, 5) * 2 - 1;
    const vein = Math.abs(Math.sin((u * 2 + v * 1 + warp * 0.9) * Math.PI * 2));
    const t = Math.pow(1 - vein, 3.5);
    const cloud = noise(u + 0.3, v + 0.7, 4, 4);
    let c = mix(white, pink, cloud * 0.5);
    c = mix(c, blue, Math.min(1, t * 1.1 + Math.max(0, cloud - 0.6) * 1.4));
    return c;
  }), { repeat: [0.75, 0.75] });
  return new THREE.MeshPhysicalMaterial({
    map, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05,
    transmission: 0.25, thickness: 1, ior: 1.4, envMapIntensity: 1.2,
  });
}

// Order matches the letters of A-R-U-N-D-H-U-T-I
export function buildMaterials() {
  return [
    jelly(), silverFabric(), pinkFur(), orangeSponge(), ribbedPearl(),
    purpleFelt(), liquidChrome(), checkerFoam(), blueMarble(),
  ];
}
