// Full-bleed hero on the Photo Quality page: while the hero is on screen the menu bar goes transparent with
// white text (it sits on the purple), then returns to its normal frosted-white look once you scroll past.
(function () {
  var hero = document.querySelector('.cs-hero-full');
  var nav = document.querySelector('.nav');
  if (!hero || !nav || !document.body.classList.contains('hero-full')) return;
  function update() { nav.classList.toggle('nav-on-dark', hero.getBoundingClientRect().bottom > 70); }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
