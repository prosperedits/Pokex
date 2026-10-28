// The crown logo: the regal crown Faisal picked, turning on its own (no cards), as an animated WebP the browser plays
// itself: 360 frames, 30 fps, one 12 s turn. It replaced a 72-frame sprite stepped by rAF that ran at about
// 5 frames a second and read as laggy (Faisal, 27 Oct). Works on every element with `.crown-spin`
// (homepage, data page) or `.lockup-crown` (app): the script sizes each one to the crown's aspect from
// its CSS height, so pages only set a height.
// Re-render: docs/design/crown/logo.html (frames) + scripts/make-crown-logo.py.
(function () {
  var SRC = 'assets/crown/crown-turn.webp?v=5';
  var ASPECT = 1.3393;                               // 150 x 112, the crop that holds every frame of the turn
  function fit() {
    var els = document.querySelectorAll('.crown-spin, .lockup-crown');
    for (var i = 0; i < els.length; i++) {
      var h = els[i].offsetHeight || 48;
      els[i].style.width = h * ASPECT + 'px';
      els[i].style.backgroundImage = 'url(' + SRC + ')';
      els[i].style.backgroundRepeat = 'no-repeat';
      els[i].style.backgroundSize = 'contain';
      els[i].style.backgroundPosition = 'center';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fit); else fit();
  addEventListener('resize', fit);
})();
