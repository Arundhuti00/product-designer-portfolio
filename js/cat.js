// A flat black cat that peeks up from the bottom-right edge.
// Its eyes follow the cursor, and it pops up speech bubbles: encouragement over the
// projects, jokes elsewhere. Add data-cat="..." to any element to give it a line.

const LINES = {
  idle: [
    'I was told there would be treats.',
    'Psst. Try tapping the letters in her name.',
    'I pushed a pixel off the table. Sorry.',
    'Nap time in 3… 2… actually, now.',
    'Do you also stare at nothing at 3am?',
  ],
  pet: ['Purrrr…', 'Careful. I bite pixels.', 'Again. Again. Okay, stop.', 'You may continue.'],
};

const cat = document.createElement('div');
cat.className = 'cat';
cat.innerHTML = `
  <div class="cat-bubble" role="status" aria-live="polite"></div>
  <svg class="cat-art" viewBox="0 0 220 180" aria-hidden="true">
    <defs>
      <radialGradient id="cat-iris" cx="50%" cy="50%" r="50%">
        <stop offset="0.3" style="stop-color: var(--cat-eye-inner)"/>
        <stop offset="1" style="stop-color: var(--cat-eye-outer)"/>
      </radialGradient>
    </defs>
    <path class="cat-fill" d="M40 104 C34 70 36 38 46 2 Q52 -11 60 1 C70 14 84 36 95 58 L102 100Z M180 104 C186 70 184 38 174 2 Q168 -11 160 1 C150 14 136 36 125 58 L118 100Z" />
    <path class="cat-fill" d="M24 180 C24 84 54 52 110 52 C166 52 196 84 196 180Z" />
    <g class="cat-whiskers"><path d="M44 126 L8 118 M44 134 L8 138 M176 126 L212 118 M176 134 L212 138"/></g>
    <g class="cat-eye" data-eye><ellipse class="cat-sclera" cx="76" cy="102" rx="24" ry="25"/><g class="cat-pupil"><ellipse cx="76" cy="102" rx="18" ry="19"/><circle class="cat-glint" cx="84" cy="94" r="5.5"/></g></g>
    <g class="cat-eye" data-eye><ellipse class="cat-sclera" cx="144" cy="102" rx="24" ry="25"/><g class="cat-pupil"><ellipse cx="144" cy="102" rx="18" ry="19"/><circle class="cat-glint" cx="152" cy="94" r="5.5"/></g></g>
    <path class="cat-nose" d="M106.5 128 L113.5 128 L110 132.5Z" />
    <path class="cat-mouth" d="M110 132.5 C110 138 103 140 99 136.5 M110 132.5 C110 138 117 140 121 136.5" />
    <ellipse class="cat-fill" cx="74" cy="174" rx="22" ry="13"/>
    <ellipse class="cat-fill" cx="146" cy="174" rx="22" ry="13"/>
    <path class="cat-toes" d="M68 168 L68 176 M78 168 L78 176 M140 168 L140 176 M150 168 L150 176" />
  </svg>`;
document.body.appendChild(cat);

const bubble = cat.querySelector('.cat-bubble');
const art = cat.querySelector('.cat-art');
const eyes = [...cat.querySelectorAll('[data-eye]')];

// ---- eyes follow the cursor ----
let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
let raf = 0;
addEventListener('pointermove', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  if (!raf) raf = requestAnimationFrame(look);
});
function look() {
  raf = 0;
  for (const eye of eyes) {
    const r = eye.querySelector('.cat-sclera').getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = pointer.x - cx, dy = pointer.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, dist / 220) * 5;           // SVG units the pupil may travel
    const k = art.getBoundingClientRect().width / 220;   // screen px per SVG unit (for scale)
    eye.querySelector('.cat-pupil').style.transform = `translate(${(dx / dist) * reach}px, ${(dy / dist) * reach}px)`;
  }
}
look();

// ---- speech bubble ----
let hideTimer, hoverEl = null, lastActivity = Date.now();
let up = false, token = 0;
function show(text, ms) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => bubble.classList.remove('show'), ms);
  lastActivity = Date.now();
}
// the cat stays hidden until the first cue; then it rises and speaks
function say(text, ms = 2200) {
  if (up) return show(text, ms);
  up = true;
  cat.classList.add('up');
  const mine = token;
  setTimeout(() => { if (mine === token) show(text, ms); }, 700);
}
const hush = () => { token++; clearTimeout(hideTimer); bubble.classList.remove('show'); };   // hide right away

// hover cues (mouse only; touch screens get the section cues and the tap-the-cat line)
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-cat]');
  if (!el || el === hoverEl) return;
  hoverEl = el;
  say(el.dataset.cat, 2600);
});
document.addEventListener('mouseout', (e) => {
  if (!hoverEl) return;
  const to = e.relatedTarget && e.relatedTarget.closest ? e.relatedTarget.closest('[data-cat]') : null;
  if (to === hoverEl) return;
  hoverEl = null;
  hush();
});

// section cues as you scroll (once each; helps on phones, which have no hover)
const seen = new Set();
const noHover = matchMedia('(hover: none)').matches;
const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting || seen.has(en.target)) continue;
    if (!up && !noHover) continue;      // on desktop the cat waits for the first hover
    seen.add(en.target);
    if (!hoverEl) say(en.target.dataset.catSection, 2400);
  }
}, { threshold: 0.5 });
document.querySelectorAll('[data-cat-section]').forEach((s) => io.observe(s));

// tap the cat
let petCount = 0;
cat.addEventListener('click', () => {
  cat.classList.remove('wiggle'); void cat.offsetWidth; cat.classList.add('wiggle');
  say(LINES.pet[petCount++ % LINES.pet.length], 1800);
});

// idle chatter
setInterval(() => {
  if (up && !hoverEl && Date.now() - lastActivity > 22000 && !bubble.classList.contains('show')) {
    say(LINES.idle[Math.floor(Math.random() * LINES.idle.length)], 2400);
  }
}, 6000);
