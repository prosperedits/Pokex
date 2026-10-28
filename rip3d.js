// rip3d.js — the Rip Lab hero: a real-time three.js booster pack you tear open.
//  · Pack fronts are the official wrapper renders from the TCGplayer catalogue (assets/packs/, sources.json).
//  · The wrapper is procedural: a pillow surface with crimped ends, foil crinkle normals, clearcoat,
//    and a top strip that peels along the tear line as the pointer drags across it.
//  · The pull is one draw from rip.html's pull-rate model (window.RIPLAB): real card images, real market prices.
//  · Renders on demand (only while something moves); card textures are disposed after every rip.
//  · Motion: the OS reduced-motion flag is ignored on this site (the machine reports it from a Windows tweak);
//    ?motion=reduced is the opt-in, same as app.js.
(() => {
  'use strict';
  const THREE = window.THREE, gsap = window.gsap, LAB = window.RIPLAB;
  const $ = (id) => document.getElementById(id);
  const REDUCED = new URLSearchParams(location.search).get('motion') === 'reduced';

  // ------------------------------------------------------------------ the Rip Lab's ground
  // Its own surface, not the homepage's contour map: a dark cloth play mat under one soft overhead light where the
  // pack sits, falling off to near black at the edges. Painted once (and on resize); nothing on it moves.
  (function paintGround() {
    const cv = $('topo'); if (!THREE || !cv) return;
    let r;
    try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: false }); } catch (e) { return; }
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uni = { uRes: { value: new THREE.Vector2() }, uPx: { value: 1 } };
    sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `precision highp float; varying vec2 vUv; uniform vec2 uRes; uniform float uPx;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
        void main(){
          vec2 p = vUv - vec2(0.5, 0.54); p.x *= uRes.x / max(uRes.y, 1.0);
          float d = length(p * vec2(0.78, 1.0));
          float pool = exp(-d * d * 3.2);                                   // the overhead light on the mat
          vec3 col = mix(vec3(0.016, 0.02, 0.04), vec3(0.15, 0.165, 0.235), pool);
          col += vec3(0.03, 0.02, 0.004) * pool * pool;                     // a touch of warmth at its centre
          vec2 q = gl_FragCoord.xy / uPx;                                   // cloth: fine fibres and a faint weave, by screen pixel
          float fib = noise(q * vec2(0.9, 0.35)) * 0.55 + noise(q * 0.22 + 7.0) * 0.45;
          float weave = 0.5 + 0.5 * sin(q.x * 1.6) * sin(q.y * 1.6);
          col *= 0.84 + 0.22 * fib + 0.06 * weave;
          col *= mix(1.0, 0.5, smoothstep(0.42, 1.25, d));                  // the room falls away at the edges
          gl_FragColor = vec4(col, 1.0);
        }` })));
    let t = 0;
    const paint = () => { r.setSize(innerWidth, innerHeight, false); uni.uRes.value.set(innerWidth, innerHeight); uni.uPx.value = r.getPixelRatio(); r.render(sc, cam); };
    paint();
    addEventListener('resize', () => { clearTimeout(t); t = setTimeout(paint, 160); });
  })();

  const canvas = $('ripCanvas'), wrap = $('ripStageWrap');
  if (!LAB || !canvas) return;
  const btn = $('ripBtn'), allBtn = $('ripAll'), hint = $('ripHint'), receipt = $('receipt'), liveEl = $('ripLive');
  const fmt = LAB.fmt, esc = LAB.esc;

  let renderer = null;
  if (THREE && gsap) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
  }

  // ================================================================== constants (world units)
  const PW = 1.8, PH = PW / 0.56;            // pack: the wrapper renders are 560 x 1000
  const T_MAX = 0.15;                        // pillow depth per face
  const CRIMP = 0.046;                       // crimped seal height, as a share of the pack (matches the baked art)
  const SHOULDER = 0.15;                     // how far the pillow takes to puff up from the crimp
  const V_CUT = 0.912, JAG = 0.0075;         // the tear line, just under the top crimp
  const Y_CUT = (V_CUT - 0.5) * PH;
  const CW = 1.5, CH = CW / 0.717;           // a card: 63 x 88
  const EXPO = 'expo.out', INOUT = 'power2.inOut';
  const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  // ================================================================== small procedural helpers
  function hash2(x, y) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function vnoise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y) => 0.55 * vnoise(x, y) + 0.28 * vnoise(x * 2.03 + 11.3, y * 2.03 + 7.7) + 0.14 * vnoise(x * 4.1 + 3.1, y * 4.1 + 9.2);
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // foil crinkle + crimp ridges, baked once into a normal map laid over the whole wrapper
  function makeCrinkle() {
    const W = 512, H = 914, h = new Float32Array(W * H);
    for (let py = 0; py < H; py++) {
      const v = 1 - py / (H - 1);
      for (let px = 0; px < W; px++) {
        const u = px / (W - 1);
        let z;
        if (v > 1 - CRIMP || v < CRIMP) {
          const e = v > 1 - CRIMP ? (v - (1 - CRIMP)) / CRIMP : (CRIMP - v) / CRIMP;
          z = 0.05 * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 58)) * Math.min(1, e / 0.2);   // heat-crimp ridges
        } else {
          const ridge = 1 - Math.abs(vnoise(u * 5 + 3, v * 9 + 1) * 2 - 1);
          z = 0.45 * vnoise(u * 7, v * 13) + 0.2 * vnoise(u * 19 + 5, v * 31 + 2) + 0.07 * vnoise(u * 46 + 9, v * 80 + 7) + 0.3 * Math.pow(ridge, 5);
          const fold = Math.exp(-((1 - CRIMP) - v) / 0.04) + Math.exp(-(v - CRIMP) / 0.04);         // stress folds by the seals
          z += 0.26 * fold * (0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 11 + vnoise(u * 3, v * 6) * 4));
        }
        h[py * W + px] = z;
      }
    }
    const c = canvasOf(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H), d = img.data, S = 24;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const l = h[py * W + Math.max(0, px - 1)], r = h[py * W + Math.min(W - 1, px + 1)];
      const t = h[Math.max(0, py - 1) * W + px], b = h[Math.min(H - 1, py + 1) * W + px];
      let nx = -(r - l) * S, ny = -(t - b) * S, nz = 1; const k = 1 / Math.hypot(nx, ny, nz);
      const o = (py * W + px) * 4;
      d[o] = (nx * k * 0.5 + 0.5) * 255; d[o + 1] = (ny * k * 0.5 + 0.5) * 255; d[o + 2] = (nz * k * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    return tex;
  }

  function softShadowTex(w, h, pad, blur) {
    const c = canvasOf(w, h), ctx = c.getContext('2d');
    ctx.filter = `blur(${blur}px)`; ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(pad, pad, w - 2 * pad, h - 2 * pad, pad * 0.4) : ctx.rect(pad, pad, w - 2 * pad, h - 2 * pad); ctx.fill();
    return new THREE.CanvasTexture(c);
  }

  if (!renderer) {
    $('ripFallback').hidden = false; canvas.hidden = true; btn.hidden = true; allBtn.hidden = true;
    hint.textContent = 'The 3D pack needs WebGL, which this browser has turned off. The odds and prices below still work.';
    return;
  }

  // ================================================================== renderer, scene, light
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;            // keeps the wrapper's colour rich where ACES greyed it
  renderer.toneMappingExposure = 0.7;    // lit and rich (27 Oct: ACES 0.96 read blown out, ACES 0.62 read dull)
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const keyLight = new THREE.DirectionalLight(0xffeccc, 1.3); keyLight.position.set(-2.4, 3.2, 5); scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xa9c6ff, 0.55); fillLight.position.set(4, -1.5, 2.5); scene.add(fillLight);
  const ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const crinkle = makeCrinkle();
  const cardShadowTex = softShadowTex(160, 210, 34, 14);
  const packShadowTex = softShadowTex(180, 300, 40, 22);

  // ================================================================== the wrapper surface
  const endF = (v) => Math.min(sm((v - CRIMP) / SHOULDER), sm((1 - CRIMP - v) / SHOULDER));
  const sideF = (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 2.6)), 0.45);
  function surf(u, v, side, o) {
    const e = endF(v);
    o.x = (u - 0.5) * PW * (1 - 0.06 * e);                   // the sides draw in where the pillow is full
    o.y = (v - 0.5) * PH;
    o.z = side * (0.003 + T_MAX * sideF(u) * e * (1 - 0.18 * Math.pow(2 * v - 1, 2)));
    return o;
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _du = new THREE.Vector3(), _dv = new THREE.Vector3();
  function normalAt(u, v, side, n) {
    const e = 1e-3;
    surf(Math.min(1, u + e), v, side, _a); surf(Math.max(0, u - e), v, side, _b); _du.subVectors(_a, _b);
    surf(u, Math.min(1, v + e), side, _a); surf(u, Math.max(0, v - e), side, _b); _dv.subVectors(_a, _b);
    n.crossVectors(_du, _dv).normalize(); if (side < 0) n.negate();
    return n;
  }
  function gridGeo(v0, v1, side, nu, nv) {
    const n = (nu + 1) * (nv + 1), pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), g = new Float32Array(n * 2);
    const P = new THREE.Vector3(), N = new THREE.Vector3();
    let k = 0;
    for (let j = 0; j <= nv; j++) {
      const v = v0 + (v1 - v0) * j / nv;
      for (let i = 0; i <= nu; i++, k++) {
        const u = i / nu;
        surf(u, v, side, P); normalAt(u, v, side, N);
        pos.set([P.x, P.y, P.z], k * 3); nor.set([N.x, N.y, N.z], k * 3);
        uv.set([side > 0 ? u : 1 - u, v], k * 2); g.set([u, v], k * 2);
      }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (side > 0) idx.push(a, b, d, a, d, c); else idx.push(a, d, b, a, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aG', new THREE.BufferAttribute(g, 2));
    return geo;
  }

  // shared uniforms: the tear front (0..1 from the side the drag started), guide line, hover
  const U = {
    uTear: { value: 0 }, uDir: { value: 1 }, uGuide: { value: 0 }, uGuideDraw: { value: 0 },
    uHover: { value: 0 }, uVCut: { value: V_CUT }, uJag: { value: JAG },
  };
  function foilMaterial({ map, strip, back }) {
    const m = new THREE.MeshPhysicalMaterial({
      map: map || null, color: back ? 0x9aa3b8 : 0xffffff,
      // soft foil (Faisal, 27 Oct: the first pass was "a little bit too harsh"): broad sheen, no hot glints
      metalness: back ? 0.8 : 0.3, roughness: back ? 0.42 : 0.44,
      normalMap: crinkle, normalScale: new THREE.Vector2(0.1, 0.1),
      clearcoat: 0.3, clearcoatRoughness: 0.14, clearcoatNormalMap: crinkle, clearcoatNormalScale: new THREE.Vector2(0.1, 0.1),
      side: THREE.DoubleSide, envMapIntensity: back ? 0.4 : 0.12,
    });
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      if (strip) sh.defines = Object.assign(sh.defines || {}, { IS_STRIP: '' });
      if (back) sh.defines = Object.assign(sh.defines || {}, { IS_BACK: '' });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aG;\nvarying vec2 vG;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvG = aG;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vG; uniform float uTear, uDir, uGuide, uGuideDraw, uHover, uVCut, uJag;
          float jagV(float u){ return uVCut + uJag * (0.55*sin(u*97.0) + 0.3*sin(u*241.0+1.3) + 0.15*sin(u*523.0+4.1)); }`)
        .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
          float tooth = 0.0068 * abs(fract(vG.x * 62.0) - 0.5) * 2.0;     // the heat crimp's serrated edge
          if (vG.y > 1.0 - tooth || vG.y < tooth) discard;
          float jv = jagV(vG.x);
          float torn = uDir > 0.0 ? step(vG.x, uTear) : step(1.0 - uTear, vG.x);
          float seamEps = (1.0 - torn) * 0.0016;
          #ifdef IS_STRIP
            if (vG.y < jv - seamEps) discard;
          #else
            if (vG.y > jv + seamEps) discard;
          #endif
          float rimF = torn * (1.0 - smoothstep(0.0011, 0.0042, abs(vG.y - jv)));
          float guideF = 0.0, guideShade = 0.0;
          #if !defined(IS_STRIP) && !defined(IS_BACK)
            float gd = abs(vG.y - (uVCut - 0.017));
            float gl = 1.0 - smoothstep(0.0022, 0.0036, gd);
            float dash = step(0.36, fract(vG.x * 28.0));
            float gOn = uGuide * (1.0 - torn) * step(vG.x, uGuideDraw) * (gl_FrontFacing ? 1.0 : 0.0);
            guideF = gOn * gl * dash * mix(0.75, 1.0, uHover);
            guideShade = gOn * (1.0 - smoothstep(0.004, 0.0085, gd));      // a soft dark bed so the dashes read on bright foil
          #endif`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.74, 0.76, 0.8);        // inside of the wrapper: bare foil
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.95, 0.92), rimF); // torn edge: white paper fibre
          diffuseColor.rgb *= 1.0 - 0.55 * guideShade;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.82, 0.29), guideF);`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
          if (!gl_FrontFacing) metalnessFactor = 0.92;
          metalnessFactor = mix(metalnessFactor, 0.0, max(rimF, guideF));
          metalnessFactor *= 1.0 - 0.6 * guideShade;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.9, max(rimF, guideShade));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(1.0, 0.78, 0.22) * guideF * 0.9;`);
    };
    m.customProgramCacheKey = () => (strip ? 's' : 'b') + (back ? 'k' : 'f');
    return m;
  }

  const matBodyF = foilMaterial({}), matBodyB = foilMaterial({ back: true });
  const matStripF = foilMaterial({ strip: true }), matStripB = foilMaterial({ strip: true, back: true });

  const REST_Y = -0.14, REST_X = -0.07;      // resting three-quarter pose: the pillow and the open mouth read in depth
  const packRoot = new THREE.Group(), tilt = new THREE.Group(), pack = new THREE.Group();
  tilt.rotation.set(REST_X, REST_Y, 0);
  packRoot.add(tilt); tilt.add(pack); scene.add(packRoot);
  const bodyF = new THREE.Mesh(gridGeo(0, V_CUT + JAG * 1.6, 1, 72, 116), matBodyF);
  const bodyB = new THREE.Mesh(gridGeo(0, V_CUT + JAG * 1.6, -1, 72, 116), matBodyB);
  const stripGeoF = gridGeo(V_CUT - JAG * 1.6, 1, 1, 128, 10), stripGeoB = gridGeo(V_CUT - JAG * 1.6, 1, -1, 128, 10);
  const stripF = new THREE.Mesh(stripGeoF, matStripF), stripB = new THREE.Mesh(stripGeoB, matStripB);
  for (const m of [stripF, stripB]) {
    m.userData.base = Float32Array.from(m.geometry.attributes.position.array);
    m.userData.baseN = Float32Array.from(m.geometry.attributes.normal.array);
    m.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    m.geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  }
  const stripGroup = new THREE.Group(); stripGroup.add(stripF, stripB);
  const stripPivot = new THREE.Group(); stripPivot.add(stripGroup);
  pack.add(bodyF, bodyB, stripPivot);
  const packShadow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.5, PH * 1.32),
    new THREE.MeshBasicMaterial({ map: packShadowTex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, color: 0x000000 }));
  packShadow.position.set(0.12, -0.16, -0.7);
  packRoot.add(packShadow);

  // ================================================================== render on demand
  const live = new Set();
  const T = (t) => { live.add(t); return t; };
  const to = (o, v) => T(gsap.to(o, v));
  let liveUntil = 0, visible = true, dirty = true;
  const kick = (ms = 120) => { liveUntil = Math.max(liveUntil, performance.now() + ms); };
  const tiltCur = new THREE.Vector2(), tiltTgt = new THREE.Vector2();
  function updateTilt() {
    const dx = tiltTgt.x - tiltCur.x, dy = tiltTgt.y - tiltCur.y;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return false;
    tiltCur.x += dx * 0.075; tiltCur.y += dy * 0.075;
    tilt.rotation.y = REST_Y + tiltCur.x * 0.2; tilt.rotation.x = REST_X - tiltCur.y * 0.12;
    carGroup.rotation.y = tiltCur.x * 0.09; carGroup.rotation.x = tiltCur.y * 0.05;   // the pulled cards' arc leans toward the cursor
    keyLight.position.x = -2.4 + tiltCur.x * 2.2; keyLight.position.y = 3.2 - tiltCur.y * 1.4;   // the highlight travels with the tilt
    return true;
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    let busy = dragging || now < liveUntil;
    for (const t of live) { if (t.isActive()) busy = true; else if (!t.parent) live.delete(t); }
    if (updateTilt()) busy = true;
    if (!busy && !dirty) return;
    dirty = false;
    if (stripDirty) deformStrip();
    placeOverlays();
    for (const c of S.cards) c.fu.uShift.value = c.sheen + c.pivot.rotation.y * 0.35 - c.tiltRoot.rotation.y * 2.6 + c.tiltRoot.rotation.x * 1.2;
    renderer.render(scene, camera);
  }

  // ================================================================== overlays placed over the 3D
  const _v = new THREE.Vector3();
  function toScreen(v) {                 // world point -> px inside the stage canvas
    _v.copy(v).project(camera);
    return { x: (_v.x + 1) / 2 * wrap.clientWidth, y: (1 - _v.y) / 2 * wrap.clientHeight };
  }
  function placeOverlays() {
    if (!wrap.clientWidth) return;
    if (!tearBtn.hidden) {
      // just right of the pack's top-right corner, level with the tear line; above the pack if the side has no room
      pack.updateWorldMatrix(true, false);
      const sR = toScreen(pack.localToWorld(new THREE.Vector3(PW / 2, Y_CUT + 0.02, 0.05)));
      const sL = toScreen(pack.localToWorld(new THREE.Vector3(-PW / 2, Y_CUT + 0.02, 0.05)));
      const sTop = toScreen(pack.localToWorld(new THREE.Vector3(0, PH / 2, 0.05)));
      const bw = tearBtn.offsetWidth, bh = tearBtn.offsetHeight;
      let x, y;
      if (wrap.clientWidth - sR.x > bw + 28) { x = sR.x + 16; y = sR.y - bh / 2; }
      else { x = (sL.x + sR.x) / 2 - bw / 2; y = Math.max(4, sTop.y - bh - 12); }
      tearBtn.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    if (!pillBtn.hidden && S.waiting != null) {
      const c = S.cards[S.waiting]; c.root.updateWorldMatrix(true, true);
      const b = toScreen(c.front.localToWorld(new THREE.Vector3(0, -CH / 2, 0.02)));
      pillBtn.style.transform = `translate(${Math.round(b.x - pillBtn.offsetWidth / 2)}px, ${Math.round(b.y - pillBtn.offsetHeight / 2)}px)`;
    }
    if (!carName.hidden && S.view >= 0 && S.cards[S.view]) {
      const m = carMetrics(), top = toScreen(new THREE.Vector3(0, m.y + CH * m.b * 1.54 / 2, 0.2));
      carName.style.transform = `translate(${Math.round(top.x - carName.offsetWidth / 2)}px, ${Math.round(top.y - carName.offsetHeight - 10)}px)`;
    }
  }

  // ================================================================== layout (world units visible at z = 0)
  const L = { visW: 1, visH: 1, slots: [], big: new THREE.Vector3(), bigScale: 1, trayScale: 0.3 };
  function layout() {
    const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const tanH = Math.tan(camera.fov * Math.PI / 360);
    const dist = Math.max(PH / (0.74 * 2 * tanH), PW / (0.6 * 2 * tanH * camera.aspect));
    camera.position.set(0, 0, dist); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
    L.visH = 2 * dist * tanH; L.visW = L.visH * camera.aspect;
    const portrait = camera.aspect < 1.1;           // narrow stages file the cards in two rows of 5 + 4
    L.cols = portrait ? 5 : 10; L.rows = portrait ? 2 : 1;
    const gx = L.visW * (portrait ? 0.022 : 0.012), gy = gx * 1.3;
    let tw = (L.visW * 0.96 - gx * (L.cols - 1)) / L.cols, th = tw / 0.717;
    const maxTh = L.visH * (portrait ? 0.15 : 0.2);
    if (th > maxTh) { th = maxTh; tw = th * 0.717; }
    L.trayScale = tw / CW;
    const bottom = -L.visH / 2 + L.visH * 0.025, block = L.rows * th + (L.rows - 1) * gy;
    L.slots = [];
    for (let i = 0; i < 10; i++) {
      const r = Math.floor(i / L.cols), c = i % L.cols, inRow = Math.min(L.cols, 10 - r * L.cols), rowW = inRow * tw + (inRow - 1) * gx;
      L.slots.push(new THREE.Vector3(-rowW / 2 + tw / 2 + c * (tw + gx), bottom + block - th / 2 - r * (th + gy), 0));
    }
    const top = L.visH / 2 - L.visH * 0.045, floor = bottom + block + L.visH * 0.035;
    let bh = Math.min(top - floor, L.visH * 0.64);
    if (bh * 0.717 > L.visW * 0.84) bh = L.visW * 0.84 / 0.717;
    L.bigScale = bh / CH; L.big.set(0, (top + floor) / 2, 0.2);
    relayoutCards();
    dirty = true; kick();
  }

  // ================================================================== state
  const S = { phase: 'loading', A: null, pull: null, cards: [], k: 0, hold: null, fast: false, bigCard: null, view: -1, best: -1,
              tear: 0, tearTgt: 0, session: { packs: 0, cost: 0, pulled: 0 }, setToken: 0, tl: null };
  let stripDirty = false, dragging = false;
  const packTex = {};

  // what just turned over, said under the stage: rarity, name, and the value first for a hit
  const nowEl = $('ripNow');
  let nowTween = null;
  function showNow(e, browsing) {
    if (nowTween) { nowTween.kill(); nowTween = null; }
    if (!e) { nowEl.hidden = true; hint.hidden = false; return; }
    const hit = e.slot === 'hit', foil = foilOf(e), i = S.pull ? S.pull.entries.indexOf(e) : -1;
    nowEl.className = 'now' + (hit ? ' hit' : '');
    nowEl.innerHTML = `<span class="now-l"><span class="now-r"><i style="background:${rarityCol(e)}"></i>${foil && e.slot !== 'reverse' ? foilWord(foil) + ' · ' : ''}${esc(slotWord(e))}</span>${browsing ? '' : `<b>${esc(e.card.name)}</b>`}</span><span class="now-p num">${priceTxt(e)}</span>`;
    void i;
    nowEl.hidden = false; hint.hidden = true;
    if (hit && e.priced && !REDUCED && !S.fast && !browsing) {
      const pEl = nowEl.querySelector('.now-p'), o = { v: 0 };
      nowTween = gsap.to(o, { v: e.price, duration: 0.9, ease: EXPO, onUpdate: () => { pEl.textContent = fmt(o.v); } });
    }
  }
  const prevBtn = $('ripPrev'), nextBtn = $('ripNext');
  const tearBtn = $('tearBtn'), pillBtn = $('nextBtn'), carName = $('carName');
  function setPhase(p) {
    S.phase = p;
    tearBtn.hidden = p !== 'idle';
    pillBtn.hidden = true; carName.hidden = p !== 'done';
    dirty = true; kick();
    if (p !== 'reveal') showNow(null);
    wrap.classList.remove('grab', 'grabbing', 'tap');
    if (p === 'reveal' || p === 'done') wrap.classList.add('tap');
    wrap.classList.toggle('cards', p === 'opening' || p === 'reveal' || p === 'done');   // no coloured glow behind the cards
    wrap.classList.toggle('carousel', p === 'done');                                      // the arc fades out at the stage's sides
    prevBtn.hidden = nextBtn.hidden = p !== 'done';
    if (p === 'idle') { btn.hidden = true; allBtn.hidden = true; hint.innerHTML = 'Drag across the top seal to tear it open'; canvas.setAttribute('aria-label', `Sealed ${S.A ? S.A.S.set.name : ''} booster pack. Press Enter to tear it open.`); }
    if (p === 'tearing') { hint.innerHTML = 'Keep going: past two-thirds of the way it tears off'; }
    if (p === 'opening') { btn.hidden = true; allBtn.hidden = true; hint.innerHTML = 'Opening&hellip;'; }
    if (p === 'reveal') { btn.hidden = true; allBtn.hidden = false; hint.innerHTML = 'Tap the card or press Next'; canvas.setAttribute('aria-label', 'Your pull. Press Enter for the next card.'); }
    if (p === 'done') { btn.hidden = false; btn.textContent = 'Rip another'; allBtn.hidden = true; hint.innerHTML = 'Or pick another pack on the left'; canvas.setAttribute('aria-label', 'Your pull. Use the left and right arrow keys to step through the cards.'); }
  }

  // ================================================================== tear: strip deformation
  function deformStrip() {
    stripDirty = false;
    const dir = U.uDir.value, tear = S.tear, stripH = PH / 2 - Y_CUT;
    for (const m of [stripF, stripB]) {
      const base = m.userData.base, baseN = m.userData.baseN, g = m.geometry.attributes.aG.array;
      const pos = m.geometry.attributes.position.array, nor = m.geometry.attributes.normal.array;
      for (let i = 0, n = g.length / 2; i < n; i++) {
        const u = g[i * 2], along = dir > 0 ? u : 1 - u;
        const s = sm((tear - along) / 0.2);
        const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
        if (s <= 0) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; nor[i * 3] = baseN[i * 3]; nor[i * 3 + 1] = baseN[i * 3 + 1]; nor[i * 3 + 2] = baseN[i * 3 + 2]; continue; }
        const f = Math.max(0, (y - Y_CUT) / stripH);
        // the torn flap lifts off the cut, bends toward you and trails the finger; kept under ~70 degrees so
        // its printed face stays in view instead of turning edge-on
        const th = s * (0.5 + 0.7 * f) + Math.max(0, tear - 1) * 1.6 * f;
        const c = Math.cos(th), sn = Math.sin(th), dy = y - Y_CUT + s * (0.07 + 0.05 * f);
        pos[i * 3] = x + dir * s * (0.05 + 0.1 * f);
        pos[i * 3 + 1] = Y_CUT + dy * c - z * sn;
        pos[i * 3 + 2] = dy * sn + z * c;
        const ny = baseN[i * 3 + 1], nz = baseN[i * 3 + 2];
        nor[i * 3] = baseN[i * 3]; nor[i * 3 + 1] = ny * c - nz * sn; nor[i * 3 + 2] = ny * sn + nz * c;
      }
      m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.normal.needsUpdate = true;
      m.geometry.computeBoundingSphere();
    }
  }
  function setTear(v) { S.tear = v; U.uTear.value = Math.min(1, v); stripDirty = true; dirty = true; }
  function resetStrip() {
    for (const m of [matStripF, matStripB]) { if (m.transparent) { m.transparent = false; m.opacity = 1; m.needsUpdate = true; } }
    gsap.killTweensOf([stripPivot.position, stripPivot.rotation, S, U.uGuide, U.uGuideDraw, packRoot.position, pack.rotation]);
    stripPivot.position.set(0, 0, 0); stripPivot.rotation.set(0, 0, 0); stripGroup.position.set(0, 0, 0);
    stripPivot.visible = true;
    setTear(0); S.tearTgt = 0; U.uDir.value = 1; deformStrip();
  }

  // ================================================================== pull: one draw from the page's model
  function rankOf(e) {
    if (e.slot === 'common') return 0; if (e.slot === 'uncommon') return 1; if (e.slot === 'reverse') return 2;
    const i = LAB.LADDER_ORDER.indexOf(e.card.rarity); return i < 0 ? 3 : 3 + (LAB.LADDER_ORDER.length - i);
  }
  function simulatePull(A) {
    const C = A.byR['Common'] || [], Un = A.byR['Uncommon'] || [], R = A.byR['Rare'] || [];
    const revPool = [...C, ...Un, ...R];
    const used = new Set(), usedRev = new Set();
    const take = (arr, set) => {
      if (!arr || !arr.length) return null;
      for (let k = 0; k < 24; k++) { const c = arr[(Math.random() * arr.length) | 0]; if (!set.has(c.id)) { set.add(c.id); return c; } }
      return arr[(Math.random() * arr.length) | 0];
    };
    const out = [];
    const push = (card, slot, label, price) => { if (card) out.push({ card, slot, label, price: price || 0, priced: (price || 0) > 0 }); };
    for (let i = 0; i < 4; i++) { const c = take(C, used); push(c, 'common', 'Common', c && c.priceUsd); }
    for (let i = 0; i < 3; i++) { const c = take(Un, used); push(c, 'uncommon', 'Uncommon', c && c.priceUsd); }
    let c = take(revPool, usedRev); push(c, 'reverse', 'Reverse Holo', c && LAB.revPrice(c));
    // reverse-holo slot: may upgrade to an art rare (same slot logic as rip.html)
    let x = Math.random(), acc = 0, hit = null;
    for (const r of A.revHits) { acc += A.rates[r] || 0; if (x < acc) { hit = r; break; } }
    if (hit) { c = take(A.byR[hit], used); push(c, 'hit', LAB.titleRarity(hit), c && c.priceUsd); }
    else { c = take(revPool, usedRev); push(c, 'reverse', 'Reverse Holo', c && LAB.revPrice(c)); }
    // rare slot
    x = Math.random(); acc = 0; hit = 'Rare';
    for (const r of A.rareHits) { acc += A.rates[r] || 0; if (x < acc) { hit = r; break; } }
    c = take(A.byR[hit] || R, used); push(c, hit === 'Rare' ? 'rare' : 'hit', LAB.titleRarity(hit === 'Rare' ? 'Rare' : hit), c && c.priceUsd);
    out.forEach(e => { e.rank = rankOf(e); });
    out.sort((a, b) => a.rank - b.rank || a.price - b.price);              // rarest last
    return out;
  }
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  // tcgdex's CDN sends a doubled CORS header on a small, shifting set of files (any format; about 1 in 100 on
  // 27 Oct 2026), which WebGL refuses. Each card tries the next variant, then the honest name plate.
  const VARIANTS = ['/high.webp', '/high.png', '/high.jpg', '/low.webp', '/low.png'];
  const goodVariant = {};                                    // card id -> the variant that loaded, for repeat pulls
  function preload(entries) {
    for (const e of entries) {
      const first = goodVariant[e.card.id];
      const urls = (first ? [first, ...VARIANTS.filter((v) => v !== first)] : VARIANTS).map((x) => e.card.image + x);
      e.ready = new Promise((res) => {
        let retried = false;
        const all = urls.slice();
        const tryNext = () => {
          let url = urls.shift();
          // the image CDN sometimes answers 502 for a moment: go round the variants once more before giving up
          if (!url && !retried) { retried = true; urls.push(...all); setTimeout(tryNext, 1200); return; }
          if (!url) { e.tex = fallbackFace(e); if (e.mat) { e.mat.map = e.tex; e.mat.color.set(0xffffff); e.mat.needsUpdate = true; kick(); } res(e.tex); return; }
          loader.load(url, (t) => {
            if (e.dead) { t.dispose(); res(null); return; }
            goodVariant[e.card.id] = url.slice(e.card.image.length);
            t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO; e.tex = t;
            if (e.mat) { e.mat.map = t; e.mat.color.set(0xffffff); e.mat.needsUpdate = true; kick(); }
            res(t);
          }, undefined, tryNext);
        };
        tryNext();
      });
    }
  }
  function fallbackFace(e) {             // image failed to load: an honest name plate, never invented art
    const c = canvasOf(360, 502), ctx = c.getContext('2d');
    ctx.fillStyle = '#0b1838'; ctx.fillRect(0, 0, 360, 502);
    ctx.fillStyle = '#eaf2ff'; ctx.font = '600 26px DM Sans, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(e.card.name.slice(0, 22), 180, 230); ctx.fillStyle = '#90a6cc'; ctx.font = '20px DM Sans, sans-serif';
    ctx.fillText(e.label, 180, 266); ctx.fillText('image unavailable', 180, 300);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function newPull(entries) {
    disposePull(S.pull);
    S.pull = { entries: entries || simulatePull(S.A), A: S.A };
    preload(S.pull.entries);
    for (const e of S.pull.entries) { e.thumb = new Image(); e.thumb.src = e.card.image + '/low.webp'; }   // panel thumbnails, warmed while you tear
  }
  // card textures go back to the GPU pool when their cards leave the stage (clearCards), or here if the pack
  // was never opened; disposing a texture that is still drawn would just re-upload it and leak
  function disposeEntry(e) { if (e.tex) e.tex.dispose(); if (e.mat) e.mat.dispose(); e.tex = null; e.mat = null; e.dead = true; }
  function disposePull(p) {
    if (!p) return;
    for (const e of p.entries) if (!e.onStage) disposeEntry(e);
  }

  // ================================================================== cards
  const cardGeo = (() => {
    const w = CW, h = CH, r = CW * 0.045, x = -w / 2, y = -h / 2, s = new THREE.Shape();
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ShapeGeometry(s, 6), p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
    return g;
  })();
  // cards only ever show their faces; the reverse side is a plain dark sheet (it is never turned toward you)
  const backMat = new THREE.MeshBasicMaterial({ color: 0x070b18, toneMapped: false });
  // a soft contact shadow just under each card, no dark box around it
  const cardShadowGeo = new THREE.PlaneGeometry(CW * 1.12, CH * 1.08);
  const SHADOW = 0.2;
  // Holo foil, placed where the real card carries it (Scarlet & Violet / Mega Evolution printing):
  //   1 holo rare and ACE SPEC: the art window only     2 reverse holo: everything except the art window
  //   3 ex, full art, illustration and shiny rares: the whole card, etched texture   4 gold rares: whole card, gold etch
  // The light band's position comes from how the card is turned, so the foil moves only when the card moves.
  const FOIL = { none: 0, art: 1, reverse: 2, full: 3, gold: 4 };
  const FULL_FOIL = ['Double rare', 'Ultra Rare', 'Illustration rare', 'Special illustration rare', 'Shiny rare', 'Shiny Ultra Rare', 'Black White Rare'];
  const foilOf = (e) => e.slot === 'reverse' ? FOIL.reverse
    : (e.card.rarity === 'Hyper rare' || e.card.rarity === 'Mega Hyper Rare') ? FOIL.gold
    : FULL_FOIL.includes(e.card.rarity) ? FOIL.full
    : (e.card.rarity === 'Rare' || e.card.rarity === 'ACE SPEC Rare') ? FOIL.art : FOIL.none;
  const foilWord = (m) => ['', 'Holo', 'Reverse holo', 'Textured foil', 'Gold foil'][m];
  // art window in uv (x0, x1, v0, v1), measured on tcgdex scans: Pokémon vs Trainer / Energy frames
  const artRect = (e) => e.card.category === 'Pokemon' ? new THREE.Vector4(0.073, 0.927, 0.52, 0.905) : new THREE.Vector4(0.073, 0.927, 0.47, 0.865);
  const FOIL_GLSL = `
    uniform float uMode, uShift, uAmt; uniform vec4 uArt;
    float fBox(vec2 p, vec4 r){ vec2 a = smoothstep(vec2(r.x, r.z), vec2(r.x, r.z) + 0.004, p) * (1.0 - smoothstep(vec2(r.y, r.w) - 0.004, vec2(r.y, r.w), p)); return a.x * a.y; }
    float fHash(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }`;
  const FOIL_APPLY = `
    #ifdef USE_MAP
    if (uMode > 0.5 && uAmt > 0.001) {
      vec2 p = vUv;
      float art = fBox(p, uArt);
      float mask = uMode < 1.5 ? art : (uMode < 2.5 ? 1.0 - art : 1.0);
      float sCoord = p.x * 0.8 + p.y * 0.6;
      float band = exp(-pow((sCoord - uShift) * (uMode < 2.5 ? 1.7 : 2.4), 2.0));   // flat foil catches a broader light
      vec3 rainbow = 0.5 + 0.5 * cos(6.2832 * (sCoord * 1.25 - uShift * 0.8 + vec3(0.0, 0.33, 0.67)));
      float pat;
      if (uMode < 2.5) {
        // plain holo / reverse foil: a fine diagonal grain under a narrow, bright reflection
        float g = (p.x + p.y) * 150.0, aa = clamp(1.0 - fwidth(g) * 1.5, 0.0, 1.0);
        float fleck = step(0.93, fHash(floor(p * vec2(120.0, 168.0)))) * band;
        pat = 0.72 + 0.28 * aa * sin(g) + fleck * 0.9 * aa;
      } else {
        float ex = p.x * 190.0, ey = p.y * 260.0, aa = clamp(1.0 - max(fwidth(ex), fwidth(ey)) * 1.5, 0.0, 1.0);
        float etch = 0.5 + 0.5 * sin(ex) * sin(ey);
        float glint = step(0.986, fHash(floor(p * vec2(70.0, 98.0)))) * band;
        pat = mix(0.78, 0.55 + 0.45 * etch, aa) + glint * 1.6 * aa;
      }
      vec3 foil = uMode > 3.5 ? mix(vec3(1.0, 0.74, 0.32), vec3(1.0, 0.95, 0.78), rainbow.g) : rainbow;
      float strength = uMode < 1.5 ? 1.0 : (uMode < 2.5 ? 0.9 : (uMode < 3.5 ? 0.5 : 0.55));
      float lift = uMode < 2.5 ? 0.2 : 0.24;
      float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float k = clamp(uAmt * mask * (lift + (1.0 - lift) * band) * pat * (0.35 + 0.65 * lum) * strength, 0.0, 1.0);
      // foil shifts the printed colour toward the reflected hue (light areas show it most), plus a little lift
      vec3 tinted = diffuseColor.rgb * (0.5 + 1.0 * foil) + foil * 0.1;
      diffuseColor.rgb = mix(diffuseColor.rgb, min(tinted, vec3(1.0)), k);
    }
    #endif`;
  function makeCard(e) {
    const root = new THREE.Group(), tiltRoot = new THREE.Group(), pivot = new THREE.Group();
    e.mat = new THREE.MeshBasicMaterial({ map: e.tex || null, color: e.tex ? 0xffffff : 0x03060f, toneMapped: false });
    const fu = { uMode: { value: foilOf(e) }, uShift: { value: 0.5 }, uAmt: { value: 1 }, uArt: { value: artRect(e) } };
    e.mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, fu);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>' + FOIL_GLSL)
        .replace('#include <map_fragment>', '#include <map_fragment>' + FOIL_APPLY);
    };
    e.mat.customProgramCacheKey = () => 'card-foil';
    e.onStage = true;
    const front = new THREE.Mesh(cardGeo, e.mat); front.position.z = 0.003;
    const back = new THREE.Mesh(cardGeo, backMat); back.rotation.y = Math.PI; back.position.z = -0.003;
    const shMat = new THREE.MeshBasicMaterial({ map: cardShadowTex, color: 0x000000, transparent: true, opacity: SHADOW, depthWrite: false, toneMapped: false });
    const shadow = new THREE.Mesh(cardShadowGeo, shMat); shadow.position.set(0.02, -0.05, -0.05);
    pivot.add(front, back); tiltRoot.add(pivot); root.add(shadow, tiltRoot);
    const card = { e, root, tiltRoot, pivot, front, shadow, shMat, fu, sheen: 0.55 };
    return card;
  }
  function clearCards(instant) {
    const old = S.cards; S.cards = []; S.bigCard = null; S.waiting = null; S.view = -1;
    CAR.on = false; if (CAR.tw) { CAR.tw.kill(); CAR.tw = null; } tiltTgt.set(0, 0);
    if (S.tl) { S.tl.kill(); S.tl = null; }
    clearTimeout(S.hold); S.hold = null;
    for (const c of old) { gsap.killTweensOf([c.root.position, c.root.scale, c.root.rotation, c.pivot.rotation]); if (c.root.parent !== scene) scene.attach(c.root); c.root.visible = true; }
    const done = () => { for (const c of old) { c.root.parent && c.root.parent.remove(c.root); c.shMat.dispose(); c.e.onStage = false; disposeEntry(c.e); } kick(); };
    if (instant || REDUCED || !old.length) { done(); return Promise.resolve(); }
    return new Promise((res) => {
      old.forEach((c, i) => {
        to(c.root.position, { y: -L.visH * 0.9, duration: 0.42, delay: i * 0.025, ease: 'power2.in' });
        to(c.root.rotation, { z: (Math.random() - 0.5) * 0.6, duration: 0.42, delay: i * 0.025, ease: 'power2.in' });
      });
      setTimeout(() => { done(); res(); }, 420 + old.length * 25 + 40);
    });
  }
  function relayoutCards() {
    if (!S.cards.length || S.phase === 'opening') return;
    if (CAR.on) { carPlace(); return; }
    const n = S.cards.length;
    S.cards.forEach((c, k) => {
      if (c.inTray) { c.root.position.copy(L.slots[k]); c.root.scale.setScalar(L.trayScale); return; }
      c.root.position.set(L.big.x, L.big.y, S.phase === 'done' ? L.big.z + 0.25 : L.big.z + (n - 1 - k) * 0.014);
      c.root.scale.setScalar(L.bigScale);
    });
  }

  // ================================================================== the pull panel (DOM)
  // Grammar: Collectr's value summary (docs/design/hunt/trending-strip/collectr-site.jpg): a small label, one big
  // value, a delta chip with its arrow and unit, then the items behind the number as real thumbnails.
  // Order here: the hit first, then the pulled total as the verdict against the pack price, then the rest of the pack.
  const rarityCol = (e) => LAB.RARITY_COLOR[e.card.rarity] || '#9a96a8';
  const slotWord = (e) => (e.slot === 'reverse' ? 'Reverse Holo · ' + LAB.titleRarity(e.card.rarity) : e.label);
  const priceTxt = (e) => (e.priced ? fmt(e.price) : 'no sales yet');
  function renderSlots() {
    const A = S.A; if (!A) return;
    const pHit = 1 - (1 - Math.min(1, A.sumRare || 0)) * (1 - Math.min(1, A.sumRev || 0));
    // a "big hit" leaves out the everyday hits (regular ex Double Rares, ACE SPECs, baby shinies)
    const bigRare = A.rates['Ultra Rare'] || 0;
    const bigRev = A.revHits.filter((r) => r !== 'ACE SPEC Rare' && r !== 'Shiny rare').reduce((t, r) => t + (A.rates[r] || 0), 0);
    const pBig = 1 - (1 - bigRare) * (1 - bigRev);
    const groups = [[4, 'Commons', ''], [3, 'Uncommons', ''], [1, 'Reverse holo', ''],
      [1, 'Reverse-holo slot', A.revHits.length ? `upgrades ${LAB.oneIn(A.sumRev)} packs` : ''],
      [1, 'Rare slot', A.rareHits.length ? `Double Rare or better ${LAB.oneIn(A.sumRare)} packs` : '']];
    receipt.innerHTML = `
      <div class="rc-top"><h2>In this pack</h2></div>
      <div class="rc-big">
        <span class="odds2"><span><span class="rc-k">Chance of a hit</span><b class="num">${LAB.pct(pHit)}</b></span><span><span class="rc-k">A big hit</span><b class="num big2">${LAB.pct(pBig)}</b></span></span>
        <span class="rc-sub">A hit is any Double Rare or better (regular ex count). A big hit is an Ultra Rare, Illustration Rare or better. Both are per pack, from the published pull rates below.</span></div>
      <ol class="anatomy">${groups.map(([n, label, odds], g) => `
        <li class="${g >= 3 ? 'hit' : ''}"><span class="backs" aria-hidden="true">${'<i></i>'.repeat(n)}</span>
          <span class="an-n">${n}</span><span class="an-l"><b>${label}</b>${odds ? `<small>${odds}</small>` : ''}</span></li>`).join('')}</ol>
      <p class="rc-note">Prices are TCGplayer market. Odds per pack from: ${LAB.oddsLinks(A)}</p>`;
  }
  function renderPullRows() {
    const n = S.pull.entries.length, cost = LAB.packPrice(S.pull.A).perPack;
    receipt.innerHTML = `
      <div class="hitbox">
        <button class="hit-card" id="rcHitBtn" type="button" disabled aria-label="Show the best pull"><img id="rcHitImg" alt="" hidden></button>
        <span class="hit-info"><span class="rc-k" id="rcHitK">Best pull</span><b id="rcHitName">Coming up</b>
          <span class="hit-r" id="rcHitR">the rarest card comes out last</span><span class="hit-p num" id="rcHitP"></span></span>
      </div>
      <p class="also" id="rcAlso" hidden></p>
      <div class="vbox">
        <span class="v-row"><b class="num" id="rcTotal">$0.00</b><span class="vdelta" id="rcChip" hidden></span></span>
        <span class="meter" aria-hidden="true"><i id="rcFill"></i><span class="mk" id="rcMark"></span></span>
        <span class="meter-l" id="rcMeterL"><span>$0</span><span>pack ${fmt(cost)}</span></span>
      </div>
      <div class="rest">
        <ol class="mini" id="rcGrid">${S.pull.entries.map((e, i) => `<li class="wait" data-i="${i}"><button class="mc" type="button" disabled><img alt="" hidden></button><span class="mp num"></span><span class="ms"></span></li>`).join('')}</ol>
      </div>
      <p class="rc-foot" id="rcFoot" hidden></p>`;
    S.total = 0; S.meterMax = cost * 1.6; S.best = -1;
    placeMeter();
    receipt.querySelectorAll('#rcGrid .mc').forEach((b) => b.addEventListener('click', () => setView(+b.closest('li').dataset.i)));
    $('rcHitBtn').addEventListener('click', () => { if (S.best >= 0) setView(S.best); });
  }
  function placeMeter() {
    const cost = LAB.packPrice(S.pull.A).perPack, max = Math.max(S.meterMax, S.total * 1.08, cost * 1.15);
    const fill = $('rcFill'), mark = $('rcMark'), lbl = $('rcMeterL'); if (!fill || !mark) return;
    const at = cost / max * 100;
    mark.style.left = at + '%';
    if (lbl) {
      // the pack-price label sits at its mark; "$0" steps aside when the mark is close to it
      const t = lbl.lastElementChild; t.style.left = at + '%'; t.style.transform = `translateX(${at > 72 ? -100 : at < 22 ? 0 : -50}%)`;
      lbl.firstElementChild.style.visibility = at < 22 ? 'hidden' : '';
    }
    fill.style.width = Math.min(100, S.total / max * 100) + '%';
    fill.classList.toggle('over', S.total >= cost);
  }
  // the thumbnail's foil: a still sheen placed where that card type carries its foil
  function setFoil(holder, e) {
    let f = holder.querySelector('.foil');
    const m = e ? foilOf(e) : 0;
    if (!m) { if (f) f.remove(); return; }
    if (!f) { f = document.createElement('span'); holder.appendChild(f); }
    f.className = `foil f${m} ${e.card.category === 'Pokemon' ? 'on-pkmn' : 'on-trainer'}`;
  }
  // a thumbnail arrives face up: it fades in once its image has decoded (no card back, no broken frame)
  function showThumb(img, e, holder) {
    const src = e.card.image + '/low.webp', pre = new Image(); pre.src = src;
    const show = () => {
      img.src = src; img.alt = e.card.name; img.hidden = false; setFoil(holder, e);
      if (!REDUCED) gsap.fromTo(holder, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.32, ease: EXPO });
    };
    const fail = () => { img.title = 'image unavailable'; };
    (pre.decode ? pre.decode() : Promise.resolve()).then(show, () => {
      setTimeout(() => { const again = new Image(); again.src = src + '?r=1'; (again.decode ? again.decode() : Promise.resolve()).then(() => { img.src = again.src; show(); }, fail); }, 1200);
    });
  }
  function putInGrid(i, e) {
    const li = receipt.querySelector(`#rcGrid li[data-i="${i}"]`); if (!li) return;
    li.className = e.slot === 'reverse' ? 'rev' : e.slot === 'hit' ? 'hit' : '';
    const b = li.querySelector('.mc');
    b.disabled = false; b.setAttribute('aria-label', `${e.card.name}, ${slotWord(e)}, ${priceTxt(e)}`); b.title = `${e.card.name} · ${slotWord(e)} · ${priceTxt(e)}`;
    showThumb(b.querySelector('img'), e, b);
    li.querySelector('.mp').innerHTML = `<i style="background:${rarityCol(e)}"></i>${!e.priced ? 'n/a' : e.price >= 100 ? '$' + Math.round(e.price).toLocaleString('en-US') : fmt(e.price)}`;
    li.querySelector('.ms').textContent = foilWord(foilOf(e));
  }
  function putInHit(i) {
    const e = S.pull.entries[i], img = $('rcHitImg'); if (!img) return;
    S.best = i;
    showThumb(img, e, img.parentElement);
    $('rcHitBtn').disabled = false;
    $('rcHitName').textContent = e.card.name;
    const fw = foilOf(e);
    $('rcHitR').innerHTML = `<i style="background:${rarityCol(e)}"></i>${esc(slotWord(e))}${fw && e.slot !== 'reverse' ? ' · ' + foilWord(fw) : ''}`;
    $('rcHitP').textContent = priceTxt(e);
    receipt.querySelectorAll('#rcGrid li').forEach((li) => li.classList.toggle('best', +li.dataset.i === i));
  }
  function fillRow(i) {
    const e = S.pull.entries[i], n = S.pull.entries.length;
    if (e.filled) return; e.filled = true;
    putInGrid(i, e);
    const b = S.best >= 0 ? S.pull.entries[S.best] : null;
    if (!b || e.price > b.price || (e.price === b.price && e.rank > b.rank)) putInHit(i);
    else receipt.querySelector(`#rcGrid li[data-i="${S.best}"]`)?.classList.add('best');
    const before = S.total; S.total += e.price;
    const tot = $('rcTotal');
    if (tot) {
      if (REDUCED) tot.textContent = fmt(S.total);
      else { const o = { v: before }; gsap.to(o, { v: S.total, duration: 0.5, ease: EXPO, onUpdate: () => { tot.textContent = fmt(o.v); } }); }
    }
    placeMeter();
    liveEl.textContent = `Card ${i + 1} of ${n}: ${e.card.name}, ${e.slot === 'reverse' ? 'reverse holo' : e.label}, ${priceTxt(e)}. Running total ${fmt(S.total)}.`;
  }
  function renderResult() {
    const entries = S.pull.entries, n = entries.length, A = S.pull.A, cost = LAB.packPrice(A).perPack, total = S.total, d = total - cost;
    const bi = S.best;
    // any other hit is named right under the best one, value first
    const others = entries.filter((e, i) => i !== bi && e.slot === 'hit');
    const also = $('rcAlso');
    if (also && others.length) {
      also.hidden = false;
      also.innerHTML = '<span class="also-k">Also pulled</span>' + others.map((e) => `<span class="also-i"><b>${esc(e.card.name)}</b><span class="num">${priceTxt(e)}</span><span class="dim">${esc(e.label)}</span></span>`).join('');
    }
    const resale = entries.reduce((sum, e) => sum + LAB.net(e.price), 0);
    S.session.pulled += total;
    const chip = $('rcChip');
    if (chip) {
      chip.hidden = false; chip.className = 'vdelta ' + (d >= 0 ? 'up' : 'down');
      chip.textContent = `${d >= 0 ? '▲' : '▼'} ${fmt(Math.abs(d))} ${d >= 0 ? 'over' : 'under'} the pack`;
      if (!REDUCED) gsap.fromTo(chip, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO });
    }
    const foot = $('rcFoot');
    if (foot) {
      foot.hidden = false;
      // this pack vs the average pack, said plainly so the two resale numbers never read as one
      foot.innerHTML = `Resold as singles, this pack would net you <b>${fmt(resale)}</b> after about 20% in fees (cards under $2 count as $0). An average ${esc(A.S.set.name)} pack nets <b>${fmt(A.packEV)}</b>.` +
        (S.session.packs > 1 ? ` This session: ${S.session.packs} packs, ${fmt(S.session.cost)} paid, ${fmt(S.session.pulled)} pulled.` : '');
    }
    liveEl.textContent = `All ${n} cards are out. Best pull ${entries[bi].card.name}, ${priceTxt(entries[bi])}. Pulled ${fmt(total)} against a ${fmt(cost)} pack, ${d >= 0 ? 'up' : 'down'} ${fmt(Math.abs(d))}. Use the arrow keys to step through the cards.`;
  }

  // ================================================================== sound: recorded SFX listed in assets/sfx/rip/sources.json
  // Nothing plays, and the toggle stays hidden, until that file lists real recordings. The AudioContext is only
  // created on the first user gesture; the on/off choice is remembered in this browser.
  const SND = { ctx: null, out: null, raw: {}, buf: {}, on: true, plays: {} };
  try { SND.on = localStorage.getItem('crowns-rip-sound') !== 'off'; } catch (e) { /* storage blocked: default on */ }
  const sndBtn = $('ripSound');
  const syncSnd = () => { sndBtn.textContent = SND.on ? 'Sound on' : 'Sound off'; sndBtn.setAttribute('aria-pressed', SND.on ? 'true' : 'false'); };
  fetch('assets/sfx/rip/sources.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then(async (j) => {
    const list = j && j.sounds ? Object.entries(j.sounds).filter(([, v]) => v && v.file) : [];
    await Promise.all(list.map(async ([k, v]) => {
      try { const r = await fetch('assets/sfx/rip/' + v.file); if (r.ok) SND.raw[k] = { data: await r.arrayBuffer(), vol: v.volume == null ? 1 : v.volume }; } catch (e) { /* skip that sound */ }
    }));
    if (!Object.keys(SND.raw).length) return;
    // decode ahead on an offline context (no autoplay rules apply), so the first sound after a click is instant
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OAC) { const dec = new OAC(1, 1, 44100); for (const [k, v] of Object.entries(SND.raw)) dec.decodeAudioData(v.data.slice(0)).then((buf) => { SND.buf[k] = { b: buf, vol: v.vol }; }).catch(() => {}); }
    sndBtn.hidden = false; syncSnd();
  }).catch(() => {});
  function unlockAudio() {
    if (SND.ctx || !Object.keys(SND.raw).length) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    SND.ctx = new AC(); SND.out = SND.ctx.createGain(); SND.out.gain.value = 0.85; SND.out.connect(SND.ctx.destination);
    for (const [k, v] of Object.entries(SND.raw)) if (!SND.buf[k]) SND.ctx.decodeAudioData(v.data.slice(0)).then((buf) => { SND.buf[k] = { b: buf, vol: v.vol }; }).catch(() => {});
  }
  addEventListener('pointerdown', unlockAudio, { passive: true });
  addEventListener('keydown', unlockAudio);
  function sfx(name, { rate = 1, vol = 1, delay = 0 } = {}) {
    if (!SND.on || !SND.ctx) return null;
    const snd = SND.buf[name]; if (!snd) return null;
    if (SND.ctx.state === 'suspended') SND.ctx.resume();
    const src = SND.ctx.createBufferSource(), g = SND.ctx.createGain();
    src.buffer = snd.b; src.playbackRate.value = rate; g.gain.value = snd.vol * vol;
    src.connect(g); g.connect(SND.out); src.start(SND.ctx.currentTime + Math.max(0, delay));
    SND.plays[name] = (SND.plays[name] || 0) + 1;
    return { src, g };
  }
  function fadeOut(h, t = 0.15) {
    if (!h || !SND.ctx) return;
    const now = SND.ctx.currentTime; h.g.gain.setTargetAtTime(0, now, t / 3);
    try { h.src.stop(now + t); } catch (e) { /* already stopped */ }
  }
  sndBtn.addEventListener('click', () => {
    SND.on = !SND.on;
    try { localStorage.setItem('crowns-rip-sound', SND.on ? 'on' : 'off'); } catch (e) { /* not remembered */ }
    syncSnd(); unlockAudio();
  });

  // ================================================================== the pack on stage
  function loadPackTex(id) {
    if (packTex[id]) return packTex[id];
    packTex[id] = new Promise((res) => loader.load(`assets/packs/${id}.webp`, (t) => {
      t.encoding = THREE.sRGBEncoding; t.anisotropy = ANISO; res(t);
    }, undefined, () => res(null)));
    return packTex[id];
  }
  function applyPackTex(t) {
    const old = matBodyF.map;
    matBodyF.map = t; matStripF.map = t; matBodyF.needsUpdate = true; matStripF.needsUpdate = true;
    if (old && old !== t) { old.dispose(); for (const k in packTex) packTex[k].then((x) => { if (x === old) delete packTex[k]; }); }
  }
  function packEnter() {
    packRoot.visible = true; pack.visible = true;
    pack.position.set(0, 0, 0); pack.rotation.set(0, 0, 0); pack.scale.setScalar(1);
    U.uGuide.value = 1;
    // first load: the pack is already there, at rest (nothing plays by itself); the entrance only answers a click
    if (REDUCED || !S.entered) {
      S.entered = true; packRoot.position.set(0, 0, 0); U.uGuideDraw.value = 1; setPhase('idle'); kick(); return; }
    packRoot.position.set(0, -L.visH * 0.16, 0); pack.rotation.y = -0.85; U.uGuideDraw.value = 0;
    setPhase('idle');
    const tl = T(gsap.timeline());
    tl.to(packRoot.position, { y: 0, duration: 1.1, ease: EXPO }, 0)
      .to(pack.rotation, { y: 0, duration: 1.4, ease: EXPO }, 0)
      .to(U.uGuideDraw, { value: 1, duration: 0.9, ease: INOUT }, 0.75);
  }
  async function showSet(A) {
    const token = ++S.setToken;
    S.A = A;
    renderSlots();                                            // the new set's odds show at once, not after the pack swap
    const wasShown = packRoot.visible && S.phase !== 'loading';
    clearCards(S.phase === 'loading');
    if (wasShown && S.phase === 'idle' && !REDUCED) {
      await new Promise((res) => to(packRoot.position, { y: -L.visH * 0.9, duration: 0.38, ease: 'power2.in', onComplete: res }));
    }
    const tex = await loadPackTex(A.id);
    if (token !== S.setToken) return;
    if (tex) applyPackTex(tex);
    resetStrip();
    newPull(); renderSlots();
    packEnter();
  }

  // ================================================================== tearing
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hitP = new THREE.Vector3();
  function pointerNdc(ev) { const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); return r; }
  function sealHit(ev) {
    pointerNdc(ev); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([bodyF, stripF], false);
    return hits.length && hits[0].uv && hits[0].uv.y > V_CUT - 0.085 ? hits[0] : null;
  }
  function packLocalX(ev) {
    pointerNdc(ev); ray.setFromCamera(ndc, camera);
    pack.updateWorldMatrix(true, false);
    const n = new THREE.Vector3(0, 0, 1).transformDirection(pack.matrixWorld), o = new THREE.Vector3().setFromMatrixPosition(pack.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(n, o);
    if (!ray.ray.intersectPlane(plane, hitP)) return null;
    return pack.worldToLocal(hitP).x;
  }
  let dragStartX = 0, dragId = null;
  canvas.addEventListener('pointermove', (ev) => {
    if (S.phase === 'idle' && !dragging && ev.pointerType === 'mouse') {
      const on = !!sealHit(ev);
      wrap.classList.toggle('grab', on);
      if ((U.uHover.value > 0.5) !== on) { to(U.uHover, { value: on ? 1 : 0, duration: 0.18 }); }
    }
    if (swipe.id === ev.pointerId) swipeMove(ev);
    if (dragging && ev.pointerId === dragId) {
      const x = packLocalX(ev); if (x == null) return;
      if (U.uDir.value === 0) { if (Math.abs(x - dragStartX) < 0.04) return; U.uDir.value = x > dragStartX ? 1 : -1; }
      if (!S.tearSnd && Math.abs(x - dragStartX) > 0.03) S.tearSnd = sfx('tear');
      const along = U.uDir.value > 0 ? x / PW + 0.5 : 0.5 - x / PW;
      S.tearTgt = Math.max(S.tearTgt, Math.min(1, along + 0.06));
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!dragging) wrap.classList.remove('grab'); });
  canvas.addEventListener('pointerdown', (ev) => {
    if (S.phase === 'idle' && sealHit(ev)) {
      const x = packLocalX(ev); if (x == null) return;
      dragging = true; dragId = ev.pointerId; dragStartX = x;
      // a drag that starts near an edge tears from that edge; from the middle, the first move decides
      U.uDir.value = x < -PW * 0.22 ? 1 : x > PW * 0.22 ? -1 : 0;
      S.tearTgt = 0;
      canvas.setPointerCapture(ev.pointerId);
      wrap.classList.add('grabbing'); setPhase('tearing');
      to(U.uGuide, { value: 0, duration: 0.25 });
      ev.preventDefault();
      return;
    }
    if (S.phase === 'reveal' || S.phase === 'done') { swipeDown(ev); try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* pointer already gone */ } }
  });
  function endDrag(ev) {
    if (!dragging || ev.pointerId !== dragId) return;
    dragging = false; dragId = null; wrap.classList.remove('grabbing');
    if (U.uDir.value === 0) U.uDir.value = 1;
    if (S.tearTgt >= 0.62) completeTear();
    else {                                                     // not far enough: the strip settles back
      fadeOut(S.tearSnd); S.tearSnd = null;
      S.tearTgt = 0;
      to(S, { tear: 0, duration: 0.5, ease: EXPO, onUpdate: () => setTear(S.tear) });
      to(U.uGuide, { value: 1, duration: 0.3, delay: 0.3 });
      tiltTgt.set(0, 0); setPhase('idle');
    }
  }
  canvas.addEventListener('pointerup', (ev) => { endDrag(ev); swipeUp(ev); });
  canvas.addEventListener('pointercancel', (ev) => { endDrag(ev); if (swipe.id === ev.pointerId) { swipe.id = null; swipeUp(ev); } });

  // the eased tear front follows the pointer target while dragging
  gsap.ticker.add(() => {
    if (!dragging) return;
    const d = S.tearTgt - S.tear;
    if (Math.abs(d) > 1e-4) setTear(S.tear + d * 0.32);
  });

  function autoTear() {
    if (S.phase !== 'idle') return;
    setPhase('tearing'); U.uDir.value = 1;
    S.tearSnd = sfx('tear');
    to(U.uGuide, { value: 0, duration: 0.2 });
    if (REDUCED) { setTear(1.3); completeTear(); return; }
    tiltTgt.set(0.25, -0.15);
    to(S, { tear: 0.7, duration: 0.75, ease: INOUT, onUpdate: () => setTear(S.tear), onComplete: completeTear });
  }
  function completeTear() {
    setPhase('opening'); S.tearSnd = null; S.fast = false;
    S.session.packs++; S.session.cost += LAB.packPrice(S.pull.A).perPack;
    const finish = () => { flingStrip(); openPack(); };
    if (REDUCED) { setTear(1.3); finish(); return; }
    to(S, { tear: 1.3, duration: 0.32 * Math.max(0.3, 1.3 - S.tear), ease: 'power1.out', onUpdate: () => setTear(S.tear), onComplete: finish });
  }
  function flingStrip() {
    tiltTgt.set(0, 0);
    if (REDUCED) { stripPivot.visible = false; kick(); return; }
    // pivot around the strip's own centre so it tumbles, not swings about the pack
    stripGroup.updateWorldMatrix(true, true); stripF.geometry.computeBoundingBox();
    const box = new THREE.Box3().setFromObject(stripF), c = box.getCenter(new THREE.Vector3());
    pack.worldToLocal(c);
    stripPivot.position.copy(c); stripGroup.position.set(-c.x, -c.y, -c.z);
    const dir = U.uDir.value || 1;
    const tl = T(gsap.timeline({ onComplete: () => { stripPivot.visible = false; } }));
    // tossed up and away, then it tumbles end over end as it drops out of frame
    for (const m of [matStripF, matStripB]) { m.transparent = true; m.opacity = 1; m.needsUpdate = true; }
    const room = Math.max(0.2, L.visW / 2 - PW * 0.75);        // never travels past the stage's own edge
    tl.to(stripPivot.position, { x: c.x + dir * Math.min(0.45, room * 0.5), y: c.y + 0.45, z: c.z + 0.4, duration: 0.4, ease: 'power2.out' }, 0)
      .to(stripPivot.position, { y: -L.visH * 0.7, duration: 0.95, ease: 'power2.in' }, 0.4)
      .to(stripPivot.position, { x: c.x + dir * Math.min(0.85, room * 0.8), z: c.z + 0.55, duration: 0.95, ease: 'none' }, 0.4)
      .to(stripPivot.rotation, { x: 3.4, z: -dir * 0.9, y: dir * 0.5, duration: 1.35, ease: 'power1.in' }, 0)
      .to([matStripF, matStripB], { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.8);
  }

  // ================================================================== opening: cards slide up out of the pack
  function openPack() {
    const entries = S.pull.entries, n = entries.length;
    // on a narrow screen the stage and its caption come fully into view for the reveal
    if (innerWidth <= 980) {
      const st = $('ripStage'), r = st.getBoundingClientRect();
      if (r.bottom > innerHeight || r.top < 0) st.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'end' });
    }
    S.cards = entries.map((e) => makeCard(e));
    S.k = 0; S.bigCard = null;
    renderPullRows();
    // inside the wrapper, face up: card 0 (dealt first) at the front, the rarest card at the back
    S.cards.forEach((c, k) => {
      c.root.position.set(0, -0.22, 0.012 - k * 0.0028);
      c.root.scale.setScalar(1);
      c.shMat.opacity = 0;                       // shadows fade in once the cards are out, never pop
      pack.add(c.root);
    });
    if (REDUCED) {
      S.cards.forEach((c, k) => { pack.remove(c.root); scene.add(c.root); c.shMat.opacity = SHADOW; placeInStack(c, k); });
      packRoot.visible = false; startReveal(); return;
    }
    const tl = S.tl = T(gsap.timeline({ paused: true }));
    // the faces are normally loaded while you tear; if not, the cards wait (up to 2.5 s) rather than rise blank
    Promise.race([Promise.all(entries.slice(0, 2).map((e) => e.ready)), new Promise((r) => setTimeout(r, 2500))]).then(() => { if (S.tl === tl) tl.play(); });
    const rise = Y_CUT + CH * 0.5 - 0.42;
    sfx('slide', { delay: 0.2 });
    // the pack sinks while the stack rises out of the mouth as one block: only the front card's face is ever seen
    tl.to(packRoot.position, { y: -L.visH * 0.26, duration: 1.2, ease: EXPO }, 0.15);
    tl.to(S.cards.map((c) => c.root.position), { y: rise, duration: 0.95, ease: EXPO }, 0.25);
    const handoff = 0.25 + 0.95 + 0.1;                         // the stack is fully out before it leaves the wrapper
    tl.add(() => {
      // hand the cards to the stage, then let the empty wrapper drop away
      S.cards.forEach((c) => { gsap.killTweensOf(c.root.position); scene.attach(c.root); to(c.shMat, { opacity: SHADOW, duration: 0.6, ease: 'power1.out' }); });
      to(packRoot.position, { y: -L.visH * 1.05, duration: 0.65, ease: 'power2.in', onComplete: () => { packRoot.visible = false; } });
      S.cards.forEach((c, k) => {
        const z = L.big.z + (n - 1 - k) * 0.014;
        // one shared timing for the whole stack, so the front card stays in front (a stagger let back cards flash forward)
        to(c.root.position, { x: L.big.x + (Math.random() - 0.5) * 0.04, y: L.big.y, z, duration: 0.85, delay: 0.05, ease: INOUT });
        to(c.root.scale, { x: L.bigScale, y: L.bigScale, z: L.bigScale, duration: 0.85, delay: 0.05, ease: INOUT });
        to(c.root.rotation, { x: 0, y: 0, z: (Math.random() - 0.5) * 0.04, duration: 0.85, delay: 0.05, ease: INOUT });
      });
    }, handoff);
    tl.add(startReveal, handoff + 0.95);
  }
  function placeInStack(c, k) {
    const n = S.cards.length;
    c.root.position.set(L.big.x, L.big.y, L.big.z + (n - 1 - k) * 0.014);
    c.root.scale.setScalar(L.bigScale); c.root.rotation.set(0, 0, 0);
  }

  // ================================================================== reveal: the cards come out face up; the top card is dealt to the
  // tray, which uncovers the next one. Rarest last, so the hit is the card the pack ends on.
  function startReveal() { setPhase('reveal'); present(); }
  async function present() {
    if (S.phase !== 'reveal') return;
    const k = S.k, c = S.cards[k], n = S.cards.length; if (!c) return;
    const last = k === n - 1, event = c.e.slot === 'hit';
    await Promise.race([c.e.ready, new Promise((r) => setTimeout(r, 4000))]);
    if (S.cards[k] !== c) return;
    const zTop = L.big.z + (n - 1 - k) * 0.014, holo = foilOf(c.e) > 0;
    if (REDUCED) { sfx(event ? 'reveal' : 'flip', { vol: 0.8 }); showNow(c.e); kick(); dealt(k); return; }
    const tl = S.tl = T(gsap.timeline({ onComplete: () => dealt(k) }));
    if (S.fast) tl.timeScale(3);
    sfx(event ? 'reveal' : 'flip', { rate: event ? 1 : 0.94 + Math.random() * 0.12, vol: event ? 1 : 0.7, delay: event && !S.fast ? 0.3 : 0 });
    if (event && !S.fast) {
      // the hit gets its own moment: a beat, a lift toward you, the value counts up, the card leans so its foil catches the light
      tl.to({}, { duration: 0.3 })
        .add(() => { showNow(c.e); fillRow(k); })            // the panel names the hit the moment it shows
        .to(c.root.position, { z: zTop + 1.1, duration: 0.7, ease: EXPO })
        .to(c.tiltRoot.rotation, { keyframes: [{ y: 0.2, x: -0.05, duration: 0.7, ease: INOUT }, { y: -0.06, x: 0.02, duration: 0.7, ease: INOUT }, { y: 0, x: 0, duration: 0.6, ease: INOUT }] }, '<0.1')
        .to(c.root.position, { z: zTop + 0.32, duration: 0.8, ease: EXPO }, '>-1.1');
    } else {
      tl.add(() => showNow(c.e))
        .to(c.root.position, { z: zTop + (last ? 0.32 : 0.18), duration: 0.28, ease: EXPO });
      if (holo) tl.to(c.tiltRoot.rotation, { keyframes: [{ y: 0.12, duration: 0.35, ease: INOUT }, { y: 0, duration: 0.45, ease: INOUT }] }, 0);
    }
  }
  function dealt(k) {
    if (S.phase !== 'reveal') return;
    fillRow(k);                                               // no-op if the hit's moment already filled it
    const c = S.cards[k], last = k === S.cards.length - 1;
    // the next card comes only when the visitor asks (tap, click, swipe, arrow key, Next, or Reveal all);
    // the last card waits too: the carousel opens only when it is clicked (Faisal, 27 Oct)
    S.waiting = k;
    if (last) { S.view = k; renderResult(); }
    else if (S.fast) S.hold = setTimeout(() => fileCard(k), 120);
    pillBtn.hidden = false; placeOverlays();
  }
  // a card leaves the stack for its own place in the row below
  function toSlot(c, k, sp, lift) {
    const slot = L.slots[k];
    c.inTray = true;
    if (REDUCED || sp === 0) { c.root.position.copy(slot); c.root.scale.setScalar(L.trayScale); c.root.rotation.set(0, 0, 0); c.tiltRoot.rotation.set(0, 0, 0); kick(); return; }
    to(c.root.position, { x: slot.x, y: slot.y, duration: sp, ease: INOUT });
    // it lifts clear of whatever it sits over first, then settles into the row
    to(c.root.position, { keyframes: [{ z: c.root.position.z + lift, duration: sp * 0.45, ease: 'power2.out' }, { z: slot.z, duration: sp * 0.55, ease: 'power2.in' }] });
    to(c.root.scale, { x: L.trayScale, y: L.trayScale, z: L.trayScale, duration: sp, ease: INOUT });
    to(c.root.rotation, { z: 0, duration: sp, ease: INOUT });
    to(c.tiltRoot.rotation, { x: 0, y: 0, duration: sp * 0.6, ease: INOUT });
  }
  function fileCard(k) {
    if (S.waiting !== k || S.phase !== 'reveal') return;
    S.waiting = null; clearTimeout(S.hold); pillBtn.hidden = true;
    if (k === S.cards.length - 1) { finishReveal(); return; }
    toSlot(S.cards[k], k, S.fast ? 0.38 : 0.6, 0.7);
    S.k = k + 1;
    setTimeout(present, REDUCED ? 0 : S.fast ? 90 : 160);
  }
  pillBtn.addEventListener('click', () => advance());
  tearBtn.addEventListener('click', () => autoTear());
  function advance() {
    if (S.phase !== 'reveal') return;
    if (S.waiting != null) { fileCard(S.waiting); return; }
    if (S.tl && S.tl.isActive()) S.tl.timeScale(3);
  }
  function revealAll() {
    if (S.phase === 'opening') { S.fast = true; return; }   // asked for early: the reveal runs fast once the cards are out
    if (S.phase !== 'reveal') return;
    S.fast = true;
    if (S.tl && S.tl.isActive()) S.tl.timeScale(3);
    if (S.waiting != null) fileCard(S.waiting);
  }
  function finishReveal() {
    setPhase('done');
    enterCarousel();
  }

  // ================================================================== after the reveal: the pull as a small carousel
  // Like the set carousel: the cards stand in a shallow arc, the one in front large. Drag or swipe to spin it (it
  // settles on a card), click a card to bring it forward, or use the arrows. The arc leans a little toward the cursor.
  const carGroup = new THREE.Group(); scene.add(carGroup);
  const CAR = { on: false, pos: 0, tw: null };
  function carMetrics() {
    // base unit b: a side card's width; the front card is 1.54 b (app.js: scale 0.98 + 0.56 at the focus)
    // on a narrow (portrait) stage the front card takes more of the width; the far cards fade at the sides
    const b = Math.min(L.visH * 0.56 / (1.54 * CH), L.visW / ((L.visW / L.visH < 1 ? 3.3 : 4.9) * CW));
    return { b, w: CW * b, y: -L.visH * 0.035 };
  }
  // where card i stands when the carousel's front is at pos (the curve from app.js render())
  function carPose(i, pos, o) {
    const m = carMetrics(), d = i - pos, ad = Math.abs(d);
    const pocket = Math.exp(-(d * d) / 1.1);
    const xu = d * 0.40 + Math.sign(d) * Math.min(ad, 1) * 0.62;   // a full card's air around the front card, then tight slices
    o.x = xu * m.w;
    o.y = m.y + (1 - pocket) * m.w * 0.012;
    o.z = 0.2 - Math.pow(1 - pocket, 1.6) * m.w * 0.93;            // neighbours stay near, the far ones dive back
    o.ry = -(Math.max(-42, Math.min(42, d * 38)) * (1 - pocket * 0.55)) * Math.PI / 180;
    o.s = m.b * (0.98 + 0.56 * Math.exp(-(d * d)));
    o.bright = 0.66 + 0.34 * pocket;
    o.s *= Math.max(0, Math.min(1, 4.6 - ad));                     // beyond about four cards out they leave the arc
    return o;
  }
  const _pose = {};
  function carPlace() {
    if (!CAR.on) return;
    S.cards.forEach((c, i) => {
      carPose(i, CAR.pos, _pose);
      c.root.position.set(_pose.x, _pose.y, _pose.z); c.root.rotation.set(0, _pose.ry, 0); c.root.scale.setScalar(Math.max(0.0001, _pose.s));
      c.root.visible = _pose.s > 0.001;
      if (c.e.mat) c.e.mat.color.setScalar(_pose.bright);           // side cards sit a little in shadow, like the set page
    });
    dirty = true; kick(60);
  }
  function enterCarousel() {
    const n = S.cards.length, start = n - 1;
    S.view = start; CAR.pos = start;
    S.cards.forEach((c) => { carGroup.attach(c.root); c.inTray = false; });
    if (REDUCED) { CAR.on = true; carPlace(); afterFocus(start); return; }
    // every card glides from the row into the arc, the hit staying in front
    S.cards.forEach((c, i) => {
      carPose(i, start, _pose);
      gsap.killTweensOf([c.root.position, c.root.scale, c.root.rotation, c.tiltRoot.rotation]);
      to(c.root.position, { x: _pose.x, y: _pose.y, z: _pose.z, duration: 0.8, delay: Math.abs(i - start) * 0.02, ease: INOUT });
      to(c.root.rotation, { x: 0, y: _pose.ry, z: 0, duration: 0.8, delay: Math.abs(i - start) * 0.02, ease: INOUT });
      to(c.root.scale, { x: _pose.s, y: _pose.s, z: _pose.s, duration: 0.8, delay: Math.abs(i - start) * 0.02, ease: INOUT });
      to(c.tiltRoot.rotation, { x: 0, y: 0, duration: 0.5, ease: INOUT });
      if (c.e.mat) to(c.e.mat.color, { r: _pose.bright, g: _pose.bright, b: _pose.bright, duration: 0.8, ease: INOUT });
    });
    setTimeout(() => { if (S.phase === 'done') { CAR.on = true; carPlace(); } }, 1000);
    afterFocus(start);
  }
  function afterFocus(j) {
    S.view = j;
    showNow(S.cards[j].e, true);
    const fe = S.cards[j].e;
    carName.textContent = fe.card.name; carName.classList.toggle('hit', fe.slot === 'hit'); carName.hidden = false; placeOverlays();
    receipt.querySelectorAll('#rcGrid li').forEach((li) => li.classList.toggle('on', +li.dataset.i === j));
    const n = S.cards.length;
    prevBtn.disabled = j === 0; nextBtn.disabled = j === n - 1;
    liveEl.textContent = `Card ${j + 1} of ${n}: ${S.cards[j].e.card.name}, ${slotWord(S.cards[j].e)}, ${priceTxt(S.cards[j].e)}.`;
  }
  function carTo(target, dur) {
    const n = S.cards.length; target = Math.max(0, Math.min(n - 1, Math.round(target)));
    if (CAR.tw) CAR.tw.kill();
    if (!CAR.on) { CAR.on = true; S.cards.forEach((c) => gsap.killTweensOf([c.root.position, c.root.scale, c.root.rotation])); }
    if (REDUCED) { CAR.pos = target; carPlace(); }
    else CAR.tw = to(CAR, { pos: target, duration: dur == null ? 0.5 : dur, ease: EXPO, onUpdate: carPlace });
    if (target !== S.view) afterFocus(target);
    // a foil card leans as it arrives in front, so its holo catches the light once
    const c = S.cards[target];
    if (!REDUCED && foilOf(c.e)) to(c.tiltRoot.rotation, { keyframes: [{ y: -0.12, duration: 0.25, ease: INOUT }, { y: 0, duration: 0.45, ease: INOUT }] });
  }
  function setView(j) { if (S.phase === 'done') carTo(j); }
  const step = (d) => setView(S.view + d);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  // which card is under the pointer (front faces only)
  function cardAt(ev) {
    pointerNdc(ev); ray.setFromCamera(ndc, camera);
    const fronts = S.cards.filter((c) => c.root.visible).map((c) => c.front);
    const h = ray.intersectObjects(fronts, false)[0];
    return h ? S.cards.findIndex((c) => c.front === h.object) : -1;
  }
  const swipe = { id: null, x0: 0, y0: 0, t0: 0, pos0: 0, lastX: 0, lastT: 0, v: 0 };
  function swipeDown(ev) {
    Object.assign(swipe, { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, t0: performance.now(), pos0: CAR.pos, lastX: ev.clientX, lastT: performance.now(), v: 0 });
    if (S.phase === 'done' && CAR.tw) { CAR.tw.kill(); CAR.tw = null; swipe.pos0 = CAR.pos; }
  }
  function swipeMove(ev) {
    if (swipe.id !== ev.pointerId || S.phase !== 'done' || !CAR.on) return;
    const dx = ev.clientX - swipe.x0; if (Math.abs(dx) < 4) return;
    // the arc turns with the drag, one card per card-width dragged
    const r = canvas.getBoundingClientRect(), step = carMetrics().w * 0.8 / L.visW * r.width;
    const n = S.cards.length;
    let pos = swipe.pos0 - dx / step;
    if (pos < 0) pos *= 0.35; if (pos > n - 1) pos = n - 1 + (pos - n + 1) * 0.35;   // a soft edge at either end
    CAR.pos = pos; carPlace();
    const now = performance.now(); swipe.v = (ev.clientX - swipe.lastX) / Math.max(1, now - swipe.lastT) / step * 1000; swipe.lastX = ev.clientX; swipe.lastT = now;
  }
  function swipeUp(ev) {
    if (swipe.id !== ev.pointerId) return;
    swipe.id = null;
    const dx = ev.clientX - swipe.x0, dy = ev.clientY - swipe.y0;
    if (S.phase === 'reveal') { if (Math.abs(dx) < 10 || dx < -40) advance(); return; }
    if (S.phase !== 'done') return;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {                 // a tap: bring that card forward (the front card: the next one)
      const i = cardAt(ev);
      if (i === S.view) step(1); else if (i >= 0) setView(i);
      return;
    }
    // a flick carries on a little, then the arc settles on the nearest card
    carTo(CAR.pos - swipe.v * 0.12, 0.55);
  }
  // the arc leans a little toward the cursor while you look through your cards
  canvas.addEventListener('pointermove', (ev) => {
    if (S.phase !== 'done' || swipe.id != null || ev.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    tiltTgt.set(((ev.clientX - r.left) / r.width) * 2 - 1, ((ev.clientY - r.top) / r.height) * 2 - 1);
  });
  canvas.addEventListener('pointerleave', () => { if (S.phase === 'done') tiltTgt.set(0, 0); });

  async function ripAnother() {
    if (S.phase !== 'done') return;
    S.phase = 'loading';
    await clearCards(false);
    resetStrip();
    newPull(); renderSlots();
    packEnter();
  }

  // ================================================================== controls
  function primary() {
    if (S.phase === 'idle') autoTear();
    else if (S.phase === 'reveal') advance();
    else if (S.phase === 'done') ripAnother();
  }
  btn.addEventListener('click', primary);
  allBtn.addEventListener('click', revealAll);
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); primary(); }
  });
  // arrow keys anywhere in the Rip Lab hero: the next card while dealing, step through the cards afterwards
  $('ripHero').addEventListener('keydown', (ev) => {
    if (ev.target.closest('input, select, textarea')) return;
    if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
    if (S.phase === 'reveal' && ev.key === 'ArrowRight') { ev.preventDefault(); advance(); }
    else if (S.phase === 'done') { ev.preventDefault(); step(ev.key === 'ArrowRight' ? 1 : -1); }
  });

  new ResizeObserver(() => layout()).observe(wrap);
  new IntersectionObserver((ents) => { visible = ents[0].isIntersecting; if (visible) { dirty = true; kick(); } }).observe(wrap);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { dirty = true; kick(); } });

  layout();
  requestAnimationFrame(loop);
  LAB.ready.then(() => {
    LAB.onSelect((A, why) => {
      if (why === 'rates') { S.A = A; if (S.phase === 'idle') { newPull(); renderSlots(); } return; }
      showSet(A);
    });
    const A = LAB.current(); if (A) showSet(A);
  });

  // debug + shot hooks (design review captures the torn and revealed states with these)
  window.__rip = {
    _U: U,
    _tune: (o) => { for (const [k, m] of Object.entries({ f: matBodyF, s: matStripF, b: matBodyB, k: matStripB })) if (o[k]) { Object.assign(m, o[k]); if (o[k].ns != null) { m.normalScale.setScalar(o[k].ns); } if (o[k].cns != null) m.clearcoatNormalScale.setScalar(o[k].cns); m.needsUpdate = true; }
      if (o.tm != null) { renderer.toneMapping = o.tm; for (const m of [matBodyF, matStripF, matBodyB, matStripB]) m.needsUpdate = true; }
      if (o.exp != null) renderer.toneMappingExposure = o.exp; if (o.key != null) keyLight.intensity = o.key; if (o.fill != null) fillLight.intensity = o.fill; dirty = true; kick(); },
    _L: () => ({ visH: L.visH, visW: L.visW, big: L.big.toArray(), bigScale: L.bigScale, cam: camera.position.z, cards: S.cards.map(c => [c.root.position.y.toFixed(2), c.root.position.z.toFixed(2), c.root.scale.y.toFixed(2)]) }),
    // shots only: redraw the waiting pack (real draws from the model) until it holds a hit of the given rarity
    rigFor: (rarity) => {
      if (S.phase !== 'idle') return false;
      for (let i = 0; i < 5000; i++) {
        const ent = simulatePull(S.A);
        if (ent.some((e) => e.slot === 'hit' && (!rarity || e.card.rarity === rarity))) { newPull(ent); return true; }
      }
      return false;
    },
    simStats: (n = 10000) => {
      const A = S.A, count = {}; let hits = 0, bigs = 0;
      const everyday = ['Double rare', 'ACE SPEC Rare', 'Shiny rare'];
      for (let i = 0; i < n; i++) {
        const pk = simulatePull(A); let hit = false, big = false;
        for (const e of pk) { if (e.slot === 'hit') { count[e.card.rarity] = (count[e.card.rarity] || 0) + 1; hit = true; if (!everyday.includes(e.card.rarity)) big = true; } }
        if (hit) hits++; if (big) bigs++;
      }
      const pHit = 1 - (1 - Math.min(1, A.sumRare || 0)) * (1 - Math.min(1, A.sumRev || 0));
      const bigRev = A.revHits.filter((r) => r !== 'ACE SPEC Rare' && r !== 'Shiny rare').reduce((t, r) => t + (A.rates[r] || 0), 0);
      const pBig = 1 - (1 - (A.rates['Ultra Rare'] || 0)) * (1 - bigRev);
      return { id: A.id, n, rates: A.rates, simulated: Object.fromEntries(Object.entries(count).map(([k, v]) => [k, v / n])), hitShare: hits / n, bigShare: bigs / n, shown: pHit, shownBig: pBig, src: A.src, links: (A.links || []).map((l) => l.label + (l.url ? ' <' + l.url + '>' : '')) };
    },
    snd: () => ({ on: SND.on, unlocked: !!SND.ctx, available: Object.keys(SND.raw), decoded: Object.keys(SND.buf), plays: { ...SND.plays } }),
    view: (j) => setView(j), viewing: () => S.view, step,
    // which card's face is nearest the camera at the stage centre (test hook)
    frontCard: () => {
      if (!S.cards.length) return null;
      ndc.set(0, 0.1); ray.setFromCamera(ndc, camera);
      const h = ray.intersectObjects(S.cards.map((c) => c.front), false)[0];
      return h ? S.cards.findIndex((c) => c.front === h.object) : null;
    },
    tear: autoTear, revealAll, another: ripAnother, phase: () => S.phase, gpu: () => ({ ...renderer.info.memory, programs: renderer.info.programs.length }),
    pull: () => S.pull && S.pull.entries.map((e) => ({ name: e.card.name, slot: e.slot, label: e.label, price: e.price, tex: !!e.tex })),
    fps: (ms = 2000) => new Promise((res) => { let f = 0; const t0 = performance.now(); const tick = () => { f++; if (performance.now() - t0 < ms) { kick(50); requestAnimationFrame(tick); } else res(f * 1000 / (performance.now() - t0)); }; requestAnimationFrame(tick); }),
  };

})();
