// Stat numbers count up from 0 to their final value when they scroll into view.
// "#1", "20x", "11.9M", "Only 5%": the first number in the text is animated; the words and symbols around it stay put.
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function init() {
    const items = [...document.querySelectorAll('.cs-stat strong')].map((el) => {
      const text = el.textContent.trim();
      const m = text.match(/(\d+(?:\.\d+)?)/);
      if (!m) return null;
      const decimals = (m[1].split('.')[1] || '').length;
      return { el, text, prefix: text.slice(0, m.index), suffix: text.slice(m.index + m[1].length), target: parseFloat(m[1]), decimals };
    }).filter(Boolean);
    if (!items.length) return;

    const show = (it, v) => { it.el.textContent = it.prefix + v.toFixed(it.decimals) + it.suffix; };
    items.forEach((it) => {
      it.el.setAttribute('aria-label', it.text);       // screen readers get the final value, not the counting
      it.el.style.fontVariantNumeric = 'tabular-nums';  // digits keep their width, so nothing jitters while counting
      show(it, 0);
    });

    const run = (it, delay) => {
      const dur = 1700;
      let start = null;
      const tick = (now) => {
        if (start === null) start = now + delay;
        const t = Math.min(Math.max((now - start) / dur, 0), 1);
        const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);       // fast at first, then settles on the number
        show(it, it.target * eased);
        if (t < 1) requestAnimationFrame(tick); else it.el.textContent = it.text;   // finish on the exact original text
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver((entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e, i) => {
        io.unobserve(e.target);
        run(items.find((it) => it.el === e.target), i * 140);     // stagger the numbers in the same row
      });
    }, { threshold: 0.6 });
    items.forEach((it) => io.observe(it.el));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
