// Spinning crown logo — driven by rAF, not a CSS animation.
// CSS animation timelines are unreliable on the target machine (see the note in
// app.html: they can freeze while the rAF physics loop never does), so the header
// crown steps through its 36-frame sprite strip here instead. Works on every page
// that has a `.crown-spin` (homepage) or `.lockup-crown` (app) element.
(function () {
  var els = document.querySelectorAll('.crown-spin, .lockup-crown');
  if (!els.length) return;
  var FRAMES = 90, DUR = 3200, lastF = -1;              // 90 frames (4° steps) for a smooth turntable
  function tick(now) {
    var f = (now / DUR % 1 * FRAMES) | 0;               // 0..89 over a 3.2s loop
    if (f !== lastF) {
      lastF = f;
      // each sprite frame is square, drawn at `auto 100%`, so its display width == the element's height
      for (var i = 0; i < els.length; i++) { var h = els[i].offsetHeight || 48; els[i].style.backgroundPositionX = -(f * h) + 'px'; }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
