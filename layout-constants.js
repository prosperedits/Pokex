/* ============================================================================
   POKEX CARD — IMMUTABLE PHYSICAL RATIO
   ----------------------------------------------------------------------------
   Physical TCG card:   2.5 in  x  3.5 in   =   63 mm  x  88 mm
   Texture / art size:  734 px  x 1024 px   (portrait)
   Aspect ratio:        734 / 1024  =  0.7168 : 1   (width : height)
   Used verbatim on:    .card (wheel) · .tilt-card (inspect) · .family-card img
   Corner radius:       --card-radius = 4.5% / 3.2%  (matches real TCG corner)
   ----------------------------------------------------------------------------
   ON-SCREEN SIZE @ 1536 x 864 viewport  (read these to brief an image generator)
   ----------------------------------------------------------------------------
   WHEEL focused card:
     wheel height      = 60vh                = 0.60 * 864      = 518.40 px
     card height (70%) = 518.40 * 0.70       = 362.88 px
     card width        = 362.88 * 734/1024   = 260.13 px       (at rest)
     focus scale 1.18  -> height 362.88*1.18 = 428.20 px
                          width  260.13*1.18 = 306.96 px       (centered card)
     => the FLIP source rect captured by getBoundingClientRect() is the
        ~307 x 428 px painted box (scale already baked in — do NOT re-multiply).

   INSPECT featured card (.tilt-card):
     height = min(58vh, 60vw) = min(0.58*864, 0.60*1536)
            = min(501.12, 921.60)            = 501.12 px       (height wins)
     width  = 501.12 * 734/1024              = 359.16 px
     => destination rect ~ 359 x 501 px.

   MORPH MAGNITUDE @ this viewport:
     scale s = src.width / dst.width = 306.96 / 359.16 ~ 0.855
     (card grows ~1.17x from wheel-focused to inspect; translate carries the
      center from the wheel slot to the stage.)
   ----------------------------------------------------------------------------
   IMAGE ASSET TARGETS (for the AI image generator)
   ----------------------------------------------------------------------------
   Card scans / generated card art : 734 x 1024 px, portrait, transparent or
                                      bleed, corner radius applied in CSS (ship
                                      square-cornered art).
   Sealed product renders          : transparent PNG, any size, object-fit
                                      contain inside the 0.7168 card frame.
   ============================================================================

   This file is the single, hardcoded source of truth for every card/panel
   dimension and inspect-transition timing. It runs BEFORE app.js: it writes the
   geometry into CSS custom properties (so style.css reads them) and exposes
   window.LAYOUT (so app.js reads the same numbers). Nothing about the layout or
   the morph can drift when the server restarts or a config changes — it is
   pinned here. Edit a value here and BOTH the CSS and JS pick it up.
   ========================================================================== */
'use strict';

window.LAYOUT = Object.freeze({
  // --- physical card ------------------------------------------------------
  CARD_AR_W: 734,                 // width units  (2.5in / 63mm)
  CARD_AR_H: 1024,                // height units (3.5in / 88mm)
  CARD_ASPECT: '734 / 1024',      // CSS aspect-ratio (= 0.7168)
  CARD_ASPECT_RATIO: 734 / 1024,  // numeric, for JS geometry
  CARD_RADIUS: '4.5% / 3.2%',     // physical TCG corner

  // --- wheel (browse) -----------------------------------------------------
  WHEEL_CARD_HEIGHT_FACTOR: 0.70, // wheel card height = wheel.clientHeight * this  (JS render geometry)
  WHEEL_CARD_HEIGHT_CSS: '70%',   // matching CSS .card height
  WHEEL_FOCUS_SCALE: 1.18,        // peak scale of the centered card

  // --- inspect featured card ----------------------------------------------
  TILT_CARD_HEIGHT: 'min(58vh, 60vw)',
  TILT_CARD_NARROW_WIDTH: 'min(78vw, 46vh)', // < 1024px (height:auto)

  // --- inspect data panel -------------------------------------------------
  PANEL_BASIS: '440px',
  PANEL_MIN_WIDTH: '290px',
  PANEL_MAX_WIDTH: '500px',
  PANEL_MAX_HEIGHT: '78vh',
  PANEL_GAP: 'clamp(12px, 2vh, 22px)',
  STAGE_GAP: 'clamp(22px, 4vw, 70px)',

  // --- the shared-element morph (TASK 1, aristidebenoist mimic) -----------
  OPEN_DURATION: 520,             // ms — card flies+grows from wheel slot to featured
  CLOSE_DURATION: 380,            // ms — reverse fly-back into the wheel slot
  EASE_PREMIUM: 'cubic-bezier(0.16, 1, 0.3, 1)', // ultra-smooth ease-out (= --ease-snap)
  BACKDROP_FADE_DURATION: 440,    // ms — ONLY the backdrop fades; the card never does
  STAGGER_BASE_DELAY: 260,        // ms ~ OPEN_DURATION * 0.5 — data settles in after the card lands
  STAGGER_STEP: 45,               // ms per panel child
  STAGGER_CHILD_DURATION: 360,    // ms — each data block's slide+fade
  STAGGER_TRANSLATE_Y: 12,        // px — data blocks rise from this offset
  CLOSE_INSURANCE_TIMEOUT: 650,   // ms — > CLOSE_DURATION; force-close if WAAPI freezes
});

/* Pin the geometry into CSS custom properties so style.css reads exactly these
   numbers (immutable — change them here, the stylesheet follows). */
(() => {
  const L = window.LAYOUT;
  const R = document.documentElement.style;
  R.setProperty('--card-aspect', L.CARD_ASPECT);
  R.setProperty('--card-radius', L.CARD_RADIUS);
  R.setProperty('--wheel-card-h', L.WHEEL_CARD_HEIGHT_CSS);
  R.setProperty('--tilt-card-h', L.TILT_CARD_HEIGHT);
  R.setProperty('--tilt-card-w-narrow', L.TILT_CARD_NARROW_WIDTH);
  R.setProperty('--panel-basis', L.PANEL_BASIS);
  R.setProperty('--panel-min', L.PANEL_MIN_WIDTH);
  R.setProperty('--panel-max', L.PANEL_MAX_WIDTH);
  R.setProperty('--panel-max-h', L.PANEL_MAX_HEIGHT);
  R.setProperty('--panel-gap', L.PANEL_GAP);
  R.setProperty('--stage-gap', L.STAGE_GAP);
})();
