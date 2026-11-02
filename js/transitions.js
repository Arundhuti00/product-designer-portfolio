// Page transitions, in the style of tanvigerawork.online:
//  - entering: content rises ~18px and un-blurs from 4px, 0.8s, ease cubic-bezier(.22, 1, .36, 1), staggered ~80ms
//  - below the fold: the same reveal, triggered as each block scrolls into view
//  - leaving: content drifts ~36px down, blurs and fades (0.65s, staggered), then the next page loads
// The nav stays put on every page, so the page appears to swap underneath it.
// Only `translate`, `opacity` and `filter` are animated (never `transform`), so hover effects keep working.
// Loaded as a plain <script> in <head> so the hidden starting state is in place before first paint.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const root = document.documentElement;
  root.classList.add('lf-js');

  const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const style = document.createElement('style');
  style.textContent = `
    /* hold everything back until the starting states are set (a failsafe timer below reveals it anyway) */
    html.lf-js:not(.lf-ready) main, html.lf-js:not(.lf-ready) .footer { visibility: hidden; }

    .lf-pre { opacity: 0 !important; translate: 0 18px; filter: blur(4px); }
    .lf-pre.lf-nf { filter: none; }

    .lf-in { animation: lfIn 0.8s ${EASE} var(--lf-d, 0ms) backwards; }
    .lf-in.lf-nf { animation-name: lfInNF; }
    @keyframes lfIn   { from { opacity: 0; translate: 0 18px; filter: blur(4px); } }
    @keyframes lfInNF { from { opacity: 0; translate: 0 18px; } }

    html.lf-leaving .lf { animation: lfOut 0.65s ${EASE} var(--lf-od, 0ms) both; pointer-events: none; }
    html.lf-leaving .lf.lf-nf { animation-name: lfOutNF; }
    @keyframes lfOut   { to { opacity: 0; translate: 0 36px; filter: blur(4px); } }
    @keyframes lfOutNF { to { opacity: 0; translate: 0 36px; } }
  `;
  document.head.appendChild(style);

  // what moves: the hero pieces on the home page, or the blocks of each section on the other pages
  const HOME = [
    '.greeting', '#reveal .body-copy', '#reveal .phrases', '#reveal .actions', '.tag', '#stage',
    '.intro-section > *',
    '.work .section-title', '.work .card',
    '.about .section-title', '.about .lede', '.about .quote', '.about .fact',
    '.contact > *', '.footer',
  ].join(',');
  const INNER = 'main > section > *, .footer';

  let els = [];

  function init() {
    const sel = document.getElementById('hero') ? HOME : INNER;
    els = [...document.querySelectorAll(sel)];
    els.forEach((el) => {
      el.classList.add('lf', 'lf-pre');
      if (getComputedStyle(el).filter !== 'none') el.classList.add('lf-nf');   // has its own filter (e.g. a drop-shadow): don't blur it
    });
    root.classList.add('lf-ready');

    const vh = innerHeight;
    let order = 0;
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        reveal(en.target, 0);
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });

    els.forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.95) reveal(el, Math.min(order++, 8) * 80);   // on screen now: staggered entrance
      else io.observe(el);                                                                      // further down: when scrolled to
    });
  }

  function reveal(el, delay) {
    el.style.setProperty('--lf-d', `${delay}ms`);
    el.classList.remove('lf-pre');
    el.classList.add('lf-in');
    el.addEventListener('animationend', (e) => {
      if (e.target === el && /^lfIn/.test(e.animationName)) el.classList.remove('lf-in');
    });
  }

  // ---- leaving ----
  let leaving = false;
  function leave(href) {
    if (leaving) return;
    leaving = true;
    const vh = innerHeight;
    let i = 0;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const onScreen = r.bottom > 0 && r.top < vh;
      el.style.setProperty('--lf-od', onScreen ? `${Math.min(i++, 6) * 70}ms` : '0ms');
    });
    root.classList.add('lf-leaving');
    setTimeout(() => { location.href = href; }, 650 + Math.min(i, 6) * 70);
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;                                   // external, mailto:, etc.
    if (url.pathname === location.pathname && url.search === location.search) return;   // same page / #anchor
    e.preventDefault();
    leave(url.href);
  });

  // back/forward from the browser cache: undo the exit and play the entrance again
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    root.classList.remove('lf-leaving');
    let order = 0;
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) { el.classList.remove('lf-in'); void el.offsetWidth; reveal(el, Math.min(order++, 8) * 80); }
    });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  setTimeout(() => root.classList.add('lf-ready'), 2000);   // failsafe
})();
