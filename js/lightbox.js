// Click any content image to open it in a lightbox. The image fills the full width of the screen;
// if it is taller than the screen, scroll inside the lightbox. Close with a click, Esc or the button.
// Opt an image out with data-no-lightbox. Images inside a link are left alone.
(function () {
  var imgs = [].slice.call(document.querySelectorAll('main img')).filter(function (i) {
    return !i.hasAttribute('data-no-lightbox') && !i.closest('a') && !i.classList.contains('card-logo');
  });
  if (!imgs.length) return;
  imgs.forEach(function (i) { i.setAttribute('data-lightbox', ''); i.tabIndex = 0; i.setAttribute('role', 'button'); i.setAttribute('aria-label', (i.alt || 'Image') + ' (open full width)'); });

  var box = document.createElement('div');
  box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.hidden = true;
  box.innerHTML = '<button class="lightbox-close" type="button" aria-label="Close image">&times;</button><img class="lightbox-img" alt="">';
  document.body.appendChild(box);
  var big = box.querySelector('.lightbox-img'), close = box.querySelector('.lightbox-close'), last = null;

  function open(src, alt, from) {
    last = from; big.src = src; big.alt = alt || '';
    box.hidden = false; box.scrollTop = 0;
    requestAnimationFrame(function () { box.classList.add('is-open'); });
    document.documentElement.style.overflow = 'hidden';
    close.focus({ preventScroll: true });
  }
  function shut() {
    box.classList.remove('is-open');
    document.documentElement.style.overflow = '';
    setTimeout(function () { box.hidden = true; big.removeAttribute('src'); }, 220);
    if (last) last.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('img[data-lightbox]');
    if (t && !box.contains(t)) open(t.currentSrc || t.src, t.alt, t);
  });
  document.addEventListener('keydown', function (e) {
    if (box.hidden) { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('img[data-lightbox]')) { e.preventDefault(); e.target.click(); } return; }
    if (e.key === 'Escape') shut();
  });
  box.addEventListener('click', shut);
})();
