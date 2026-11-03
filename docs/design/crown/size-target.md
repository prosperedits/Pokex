# Hero crown size target

Measured 28 Oct 2026 from the live homepage (localhost:4173, `crown3d.js?v=47`, `crown-turn.mp4?v=6`) in headless Chrome at device pixel ratio 1, after the intro and after the web fonts load. Faisal approved this size ("the size is perfect"). A 3D crown will replace the video crown. It must land at exactly these numbers, with the card ring on its band.

All numbers are CSS pixels in page coordinates (0,0 is the top left of the window, with the page scrolled to the top). The crown leans with the camera. Every ellipse below has its long axis turned -8.60 degrees on screen (left side down, right side up) from a 0.15 rad camera roll.

## Crown box and band per screen

- **Drawn box:** everything the canvas paints (crown and cards), as a union over six moments 0.5 s apart. Its left and top edges move by up to about 30 px as the points come round.
- **Outline box:** the crown alone, as its silhouette over the whole turn. **This is the size to match.**
- **Band:** the black band's centre line, a circle of radius 1 band radius at band height 0, fitted as an ellipse.

| Screen | Drawn box (x0, y0, x1, y1) | Width x height | Outline box | Band centre | Band radii (long, short) |
|---|---|---|---|---|---|
| 2560x1440 | 562, 131, 2426, 1332 | 1864 x 1201 | 564, 132, 2423, 1330 | 1566.7, 981.7 | 810.9, 113.7 |
| 1920x1080 | 578, 127, 1855, 949 | 1277 x 822 | 579, 128, 1853, 948 | 1266.3, 709.6 | 555.6, 77.9 |
| 1440x900 | 408, 114, 1417, 764 | 1009 x 650 | 408, 114, 1416, 763 | 951.8, 574.4 | 439.3, 61.6 |
| 390x844 | 11, 149, 379, 386 | 368 x 237 | 12, 149, 378, 386 | 209.5, 317.0 | 159.9, 22.4 |

## Band and rims

Rows (y) at the front of the crown, which is the point of each ring nearest the viewer. The black band runs between the two gold rims, and the cards sit on the black.

| Screen | Front x | Top rim, top edge | Black band, top | Band centre line | Black band, bottom | Bottom rim, bottom edge | Black band height | Top rim height | Bottom rim height |
|---|---|---|---|---|---|---|---|---|---|
| 2560x1440 | 1583.7 | 900.5 | 993.8 | 1094.2 | 1193.6 | 1289.3 | 199.8 | 93.3 | 95.7 |
| 1920x1080 | 1277.9 | 654.0 | 717.8 | 786.6 | 854.7 | 920.2 | 136.9 | 63.8 | 65.5 |
| 1440x900 | 961.0 | 530.4 | 580.9 | 635.3 | 689.2 | 741.0 | 108.3 | 50.5 | 51.8 |
| 390x844 | 212.8 | 301.0 | 319.3 | 339.1 | 358.7 | 377.6 | 39.4 | 18.3 | 18.9 |

The same rings as fitted ellipses. Each cell is: centre x, centre y; long radius, short radius.

| Screen | Top rim, top edge | Black band, top | Black band, bottom | Bottom rim, bottom edge | Card ring (centre line) |
|---|---|---|---|---|---|
| 2560x1440 | 1543.2, 826.2; 861.5, 75.2 | 1554.7, 902.4; 814.0, 92.4 | 1578.6, 1060.3; 807.8, 134.8 | 1589.1, 1130.0; 849.0, 161.1 | 1566.3, 978.7; 837.5, 116.4 |
| 1920x1080 | 1250.2, 603.1; 590.3, 51.5 | 1258.1, 655.3; 557.7, 63.2 | 1274.4, 763.4; 553.5, 92.3 | 1281.6, 811.2; 581.7, 110.3 | 1266.0, 707.6; 573.8, 79.7 |
| 1440x900 | 939.0, 490.2; 466.8, 40.7 | 945.3, 531.5; 441.0, 50.0 | 958.2, 617.0; 437.7, 73.0 | 963.9, 654.7; 459.9, 87.2 | 951.5, 572.8; 453.7, 63.0 |
| 390x844 | 204.8, 286.3; 169.9, 14.8 | 207.1, 301.3; 160.6, 18.2 | 211.8, 332.5; 159.3, 26.6 | 213.9, 346.2; 167.4, 31.8 | 209.4, 316.4; 165.2, 22.9 |

In the crown's own units (1 is the black band's radius, 0 is the band's centre height). These come from fitting the camera to the band's three edges in the video, with a fit error under 0.15 px.

- **Black band:** radius 1, from height -0.096 to +0.096 (0.19 tall).
- **Top gold rim:** from +0.096 up to about +0.19, sticking out to about radius 1.05.
- **Bottom gold rim:** from -0.096 down to the crown's foot at about -0.176, about radius 1.05.
- **Crown points:** tips at about +0.76, flaring out to about radius 1.09.
- **Outline over the turn:** the `hull` list in the config below, as fractions of the video frame.

## How the scene makes this size

Copy this setup for the 3D crown.

**Camera (all screens).** It looks at the band's centre from 3.657 band radii away, 7.76 degrees above the band (position [0, 0.4936, 3.6235]). It then rolls 8.59 degrees about its view axis, so the crown and cards lean together. The ring stays level; only the camera leans.

**Size and placement.** These come from a lens shift, not a camera move, so the perspective is the same on every screen. In `crown3d.js`, the video branch of `resize()` takes every point of the picture: the crown outline plus every place a card can be. It then finds the largest scale that keeps all of it:

- under the header (`.topbar`), with 24 px clear
- beside, never over, the headline's letters and the Explore link, with 40 px clear
- above the ticker, with 24 px clear
- inside the window

It may move the crown sideways by up to 20% of the window width when that buys size. It takes the smallest move that gets within 1.5% of the biggest possible crown. The result per screen:

| Screen | Canvas box | Header bottom | Headline box | Explore box | Ticker top | Pixels per unit of view tangent | Where the view axis lands (x, y) | Equivalent vertical field of view |
|---|---|---|---|---|---|---|---|---|
| 2560x1440 | 0, -29, 2560, 1354 | 108 | 64, 1061, 679, 1273 | 64, 1311, 207, 1336 | 1394 | 2854.6 | 1562.1, 951.2 | 27.21 deg |
| 1920x1080 | 0, -22, 1920, 1015 | 103 | 64, 794, 613, 983 | 651, 958, 794, 983 | 1034 | 1955.9 | 1263.1, 688.7 | 29.70 deg |
| 1440x900 | 86, -36, 1526, 828 | 88 | 58, 678, 469, 819 | 501, 798, 621, 819 | 854 | 1546.6 | 949.3, 557.9 | 31.21 deg |
| 390x844 | 0, 59, 390, 449 | 86 | 20, 652, 240, 727 | 20, 743, 117, 760 | 798 | 563.0 | 208.6, 311.0 | 38.21 deg |

A 3D crown modelled at band radius 1, with its band centre at the origin, seen through this camera and lens, lands on the numbers above. If its proportions differ from the video crown (taller or shorter points), give `resize()` the 3D crown's own outline instead of the video `hull`. The framing rule will then size it into the same space.

The live config in index.html (the object passed to `CrownMark.mount`):

```js
video: { src: 'assets/crown/crown-turn.mp4?v=6', roll: 0.15, band: { u: 0.4974, v: 0.6580, r: 0.40825 }, eye: { dist: 3.657, elev: 0.1354 },
  hull: [[0.977, 0.068], [0.942, 0.778], [0.932, 0.821], [0.890, 0.871], [0.789, 0.922], [0.674, 0.951], [0.555, 0.964], [0.394, 0.960],
    [0.245, 0.935], [0.145, 0.897], [0.089, 0.854], [0.057, 0.800], [0.020, 0.112], [0.022, 0.063], [0.037, 0.042], [0.950, 0.034]] },
orbit: { r: 1.03, y: 0.006, h: 0.16, spacing: 1.03, crownTurn: 0 },
frame: { under: '.topbar', over: ['.headline', '.explore-btn'], floor: '.ticker', pad: 24, gap: 40, shift: 0.2 },
spin: 0.07,
```

The video plane is 2.4495 x 1.4319 band radii (frame width = 1 / band.r). It sits square to the view and is shifted so the frame point (u, v) lands on the band centre.

The size also depends on two changes to the hero CSS in index.html:

- `.tape-wrap` is now `height:96vh` (it was `min(96vh,1040px)`), so the canvas reaches from the header to the ticker on tall screens.
- The edge-fade mask on `.tape-wrap` is removed.

## Cards (keep these)

Faisal said the cards must not cover the crown and the gold rims must show. The cards now sit on the black band, between the rims:

- **Ring radius 1.03 band radii:** just off the black band, inside the rims' lip at 1.05.
- **Card height 0.16 band radii on a 0.19 black band:** both gold rims show in full above and below every card. A thin strip of black stays between card and rim: about 6 to 7 px of the 812 px video frame at the front, about 14 px on screen at 2560.
- **Raised 0.006 band radii (`orbit.y`):** the camera looks down from above, and this offset keeps the black margin the same above and below the front card.
- **Spacing 1.03 card widths:** 55 cards round the ring, nearly touching.
- **Direction:** the ring turns the same way as the crown (spin +0.07 rad/s, front moving left to right). Cards behind the crown are hidden by it.

## Files

- **Topaz 4K upscale of the turntable (finished, saved, not used):** `docs/design/crown/video/turn-minimax-4k.mp4`. 3840x2160, 243 frames at 24 fps, the same crown at a uniform 2.8125x scale with 30 px side pillars.
- **Live video (still in use until the 3D crown replaces it):** `assets/crown/crown-turn.mp4?v=6`. The 3.7 s constant-speed loop, 1218x712 at 30 fps.
