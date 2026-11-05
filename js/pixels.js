// The background grid as pixels that light up under the cursor.
// Each 14px cell remembers two "heats": a quick one (the bright core under the pointer)
// and a slow one (an afterglow that trails behind it, like a light-painting exposure).
// A tap or click sends a soft ripple through the grid.
// Colours come from the --pixel-core / --pixel-trail custom properties on the canvas, so every
// page (or hero) can set its own: the home page uses the accent pair, the Photo Quality page
// uses the colours of the Housing.com screens.

function initPixels(hero, canvas) {
  if (!hero || !canvas) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const CELL = 14;                       // must match background-size of .grid-bg
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // read the token colours once (works for hex, rgb(), named: the canvas normalises them)
  const probe = document.createElement('canvas').getContext('2d');
  const cs = getComputedStyle(canvas);
  const token = (name, fallback) => {
    probe.fillStyle = fallback;
    const v = cs.getPropertyValue(name).trim();
    if (v) probe.fillStyle = v;
    const hex = probe.fillStyle;
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const core = token('--pixel-core', '#e8610c');
  const trail = token('--pixel-trail', '#d93a7e');
  const hot = token('--pixel-hot', '#ffffff');       // the small bright centre of the brightest pixels
  const rgba = (c, a) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;

  let w = 0, h = 0, cols = 0, rows = 0, fast = new Float32Array(0), slow = new Float32Array(0);
  const rings = [];
  let pointer = null, last = null, running = false, bloom = 0;

  function resize() {
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL); rows = Math.ceil(h / CELL);
    fast = new Float32Array(cols * rows); slow = new Float32Array(cols * rows);
  }
  new ResizeObserver(resize).observe(hero);
  resize();

  function light(x, y, radiusCells, strength) {
    radiusCells *= 2;                                   // radii are written for the old 28px cell; the cells are half that now
    const cx = x / CELL, cy = y / CELL;
    const c0 = Math.max(0, Math.floor(cx - radiusCells)), c1 = Math.min(cols - 1, Math.ceil(cx + radiusCells));
    const r0 = Math.max(0, Math.floor(cy - radiusCells)), r1 = Math.min(rows - 1, Math.ceil(cy + radiusCells));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(c + 0.5 - cx, r + 0.5 - cy) / radiusCells;
        if (d >= 1) continue;
        const f = (1 - d) * (1 - d) * strength;              // soft falloff: bright centre, gentle edge
        const i = r * cols + c;
        if (f > fast[i]) fast[i] = f;
        slow[i] = Math.min(1, slow[i] + f * 0.35);
      }
    }
  }

  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }

  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const speed = last ? Math.hypot(x - last.x, y - last.y) : 0;
    // fill in between samples so a fast sweep leaves a continuous streak, not dots
    const steps = Math.max(1, Math.ceil(speed / (CELL * 1.2)));
    for (let s = 1; s <= steps; s++) {
      const px = last ? last.x + ((x - last.x) * s) / steps : x;
      const py = last ? last.y + ((y - last.y) * s) / steps : y;
      light(px, py, 3.2 + Math.min(speed / 40, 2.4), 0.95);
    }
    last = { x, y }; pointer = { x, y };
    bloom = Math.min(1, bloom + 0.25);
    wake();
  });
  hero.addEventListener('pointerleave', () => { last = null; pointer = null; });
  hero.addEventListener('pointerdown', (e) => {
    const rect = hero.getBoundingClientRect();
    rings.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, t: 0 });
    wake();
  });

  let prev = 0;
  function frame(now) {
    const dt = Math.min((now - (prev || now)) / 1000, 0.05); prev = now;
    const decayFast = Math.pow(0.0009, dt), decaySlow = Math.pow(0.12, dt);    // ~0.4s core, ~1.5s afterglow

    // ripples: a thin bright ring that widens and fades
    for (let k = rings.length - 1; k >= 0; k--) {
      const ring = rings[k];
      ring.t += dt;
      const radius = ring.t * 520, life = 1 - ring.t / 1.3;
      if (life <= 0) { rings.splice(k, 1); continue; }
      const c0 = Math.max(0, Math.floor((ring.x - radius - 30) / CELL)), c1 = Math.min(cols - 1, Math.ceil((ring.x + radius + 30) / CELL));
      const r0 = Math.max(0, Math.floor((ring.y - radius - 30) / CELL)), r1 = Math.min(rows - 1, Math.ceil((ring.y + radius + 30) / CELL));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const d = Math.abs(Math.hypot((c + 0.5) * CELL - ring.x, (r + 0.5) * CELL - ring.y) - radius);
          if (d > 26) continue;
          const f = (1 - d / 26) * life * 0.7, i = r * cols + c;
          if (f > fast[i]) fast[i] = f;
          slow[i] = Math.min(1, slow[i] + f * 0.15);
        }
      }
    }

    ctx.clearRect(0, 0, w, h);

    // a very soft bloom around the cursor, like light spilling past the pixels
    bloom *= Math.pow(0.05, dt);
    if (pointer && bloom > 0.02) {
      const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 150);
      g.addColorStop(0, rgba(core, 0.10 * bloom)); g.addColorStop(0.5, rgba(trail, 0.04 * bloom)); g.addColorStop(1, rgba(trail, 0));
      ctx.fillStyle = g; ctx.fillRect(pointer.x - 150, pointer.y - 150, 300, 300);
    }

    let alive = rings.length > 0 || bloom > 0.02;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        let f = fast[i], s = slow[i];
        if (f < 0.01 && s < 0.01) { fast[i] = 0; slow[i] = 0; continue; }
        alive = true;
        const x = c * CELL + 0.75, y = r * CELL + 0.75, size = CELL - 1.25;
        if (s > 0.01) { ctx.fillStyle = rgba(trail, s * 0.22); ctx.fillRect(x, y, size, size); }      // pink afterglow
        if (f > 0.01) {
          ctx.fillStyle = rgba(core, f * 0.62); ctx.fillRect(x, y, size, size);                        // orange core
          if (f > 0.55) { ctx.fillStyle = rgba(hot, (f - 0.55) * 0.9); ctx.fillRect(x + size * 0.3, y + size * 0.3, size * 0.4, size * 0.4); }   // hot centre
        }
        fast[i] = f * decayFast; slow[i] = s * decaySlow;
      }
    }

    if (alive) requestAnimationFrame(frame); else { running = false; prev = 0; }
  }
}

initPixels(document.getElementById('hero'), document.querySelector('#hero .grid-lit'));
initPixels(document.querySelector('.cs-hero-full'), document.querySelector('.cs-hero-full .grid-lit'));
