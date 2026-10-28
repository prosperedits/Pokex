// The Crowns mark in 3D: trading cards standing as the points of a crown, stepping up
// to a tall centre card, set into a satin-black band with one foil edge. Card faces
// are gold refractor foil: gold metal with a rainbow that spirals out from the centre
// and shifts with the viewing angle, over fine etched rings, so it flashes as it turns
// the way a foil card does when you tilt it. Built from primitives (no model file).
// Direction: docs/design/culture/study.md ("Foil, not bullion", "crown as a set
// symbol") and docs/design/crown/concept-11.png.
//
//   const crown = CrownMark.mount(canvas, { sway: true });   // needs THREE r147 (+ RoomEnvironment)
//   crown.render(nowMs, mouseX, mouseY);                      // from your rAF loop; mouse in -1..1
//   crown.resize();                                           // after the canvas changes size
(function () {
  'use strict';
  if (!window.THREE) return;
  const T = window.THREE;

  // fine etched rings around the card's centre (white = raised); also drives the foil
  function etchTexture(size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, size, size);
    const cx = size * 0.5, cy = size * 0.44;
    g.lineWidth = size / 520;
    g.strokeStyle = 'rgba(255,255,255,.42)';
    g.filter = 'blur(1px)';
    for (let r = 3; r < size * 1.1; r += size / 110) {
      g.beginPath();
      const a0 = (r * 2.399) % (Math.PI * 2);
      for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.015) {
        const aa = a + a0, w = r + Math.sin(aa * 22 + r * 0.02) * size * 0.0016;   // a guilloché wobble
        const x = cx + Math.cos(aa) * w, y = cy + Math.sin(aa) * w * 1.4;
        a ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }

  // a physical card outline (63 x 88 mm with 3 mm corners), bottom-centred
  function cardShape(w, h, r) {
    const s = new T.Shape(), x = -w / 2;
    s.moveTo(x + r, 0);
    s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r);
    s.lineTo(x + w, h - r); s.quadraticCurveTo(x + w, h, x + w - r, h);
    s.lineTo(x + r, h); s.quadraticCurveTo(x, h, x, h - r);
    s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0);
    return s;
  }

  // gold metal + a view-dependent rainbow spiral = refractor foil
  function foilMaterial(etch, uniforms) {
    const m = new T.MeshPhysicalMaterial({
      color: 0xf7c63e, metalness: 1, roughness: 0.3, clearcoat: 0.12, clearcoatRoughness: 0.3,
      bumpMap: etch, bumpScale: 0.006,
    });
    m.defines = { USE_UV: '' };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uHolo = uniforms.uHolo;
      sh.fragmentShader = 'uniform float uTime;\nuniform float uHolo;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `
        #include <dithering_fragment>
        {
          vec3 V = normalize(vViewPosition);
          float facing = clamp(abs(dot(normalize(normal), V)), 0.0, 1.0);
          vec2 c = (vUv - vec2(0.5, 0.44)) * vec2(1.0, 1.4);
          float ang = atan(c.y, c.x), rad = length(c);
          float hue = fract(ang * 0.159 + rad * 1.35 + facing * 1.6 + uTime * 0.025);
          vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (hue + vec3(0.0, 0.33, 0.67)));
          float lines = texture2D(bumpMap, vUv).r;
          float sweep = fract(vUv.x * 0.55 + vUv.y * 0.35 + (1.0 - facing) * 1.4 - uTime * 0.07);
          float glint = smoothstep(0.0, 0.18, sweep) * (1.0 - smoothstep(0.18, 0.42, sweep));
          float film = uHolo * (0.55 + 0.45 * lines) * (0.42 + 0.5 * glint) * (1.0 - 0.5 * smoothstep(0.8, 1.0, max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b))));
          vec3 gold = gl_FragColor.rgb;
          gl_FragColor.rgb = mix(gold, gold * (0.45 + 1.0 * rainbow) + rainbow * 0.1 * glint, film);
        }`);
    };
    return m;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    const renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: !!opts.capture });
    renderer.setPixelRatio(opts.pixelRatio || Math.min(2, window.devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = opts.exposure || 1.22;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(opts.fov || 24, 1, 0.1, 50);
    camera.position.set(0, 0.62, 3.05);
    camera.lookAt(0, 0.4, 0);

    {
      const studio = new T.Scene();
      studio.background = new T.Color(0x020306);
      const box = (w, h, x, y, z, c, k) => {
        const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(c).multiplyScalar(k), side: T.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
      };
      box(6, 1.4, 0, 5, -0.5, 0xfff3dd, 1.2);    // overhead softbox, behind the crown so the faces don't blow out
      box(0.6, 5, -4.5, 1, 2.5, 0xcfe6ff, 0.75);  // cool strip, left
      box(0.6, 5, 4.5, 1, 2.5, 0xffe2b0, 0.85);   // warm strip, right
      box(4, 1.2, 0, -2.5, 4, 0x8a6a40, 0.9);    // low bounce card
      box(9, 5, 0, 1.2, 6.5, 0xe8c890, 0.62);    // warm panel behind the camera: frontal cards read gold, not black
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(studio, 0.02).texture;
    }
    const key = new T.DirectionalLight(0xfff0d0, 0.7); key.position.set(2.6, 4.2, 1.2); scene.add(key);
    const rim = new T.DirectionalLight(0x9fdcff, 1.4); rim.position.set(-3.0, 1.8, -2.0); scene.add(rim);
    // no frontal fill: on a flat mirror card a light from the camera's side blooms the whole face white
    // Arcade light (Faisal, 27 Oct: "arcade-like... as opposed to ultra-real"; the old light was "atrocious"):
    // a warm sky over a deep blue floor shades the gold in clean, saturated bands, one warm key from the
    // front-right, one cool rim behind. Exposure drops so the gold stays deep instead of washing out pale.
    if (opts.light === 'june' && T.RoomEnvironment) {
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
      renderer.physicallyCorrectLights = true;
      key.color.set(0xfff4e0); key.intensity = 3.2; key.position.set(2.4, 3.2, 3.0);
      rim.color.set(0xffffff); rim.intensity = 2.4; rim.position.set(-1.2, 2.2, -3.4);
      const fill = new T.DirectionalLight(0xbfd4ff, 1.1); fill.position.set(-3.0, 0.6, 1.4); scene.add(fill);
      scene.add(new T.AmbientLight(0xffffff, 0.18));
    }
    if (opts.light === 'arcade') {
      scene.add(new T.HemisphereLight(0xfff1d6, 0x1b2a6b, opts.sky != null ? opts.sky : 0.85));
      key.intensity = opts.keyI != null ? opts.keyI : 1.2; key.position.set(2.2, 3.4, 2.8);
      rim.intensity = opts.rimI != null ? opts.rimI : 1.0;
    }

    const uniforms = { uTime: { value: 0 }, uHolo: { value: opts.holo != null ? opts.holo : 1 } };
    const etch = etchTexture(1024);
    const foil = foilMaterial(etch, uniforms);
    const edge = new T.MeshPhysicalMaterial({ color: 0xf3dc9a, metalness: 1, roughness: 0.16, clearcoat: 1 });
    const satin = new T.MeshPhysicalMaterial({ color: 0x030304, metalness: 0.3, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.55 });

    const crown = new T.Group();
    scene.add(crown);

    // five cards on the front arc, centre tallest (the silhouette also reads as a rising chart)
    const R = 0.56, W = 0.27, H = W * 1.95, CR = W * 0.07;
    // crown rhythm: tall, short, tallest, short, tall, outer cards splayed outward so the tops read as points
    const cards = [{ a: -62, s: 0.62, z: 0.12 }, { a: -31, s: 0.82, z: 0.06 }, { a: 0, s: 1.0, z: 0 }, { a: 31, s: 0.82, z: -0.06 }, { a: 62, s: 0.62, z: -0.12 }];
    for (const c of cards) {
      const h = H * c.s;
      const geo = new T.ExtrudeGeometry(cardShape(W, h, CR), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 12 });
      geo.computeBoundingBox();
      const bb = geo.boundingBox, pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let k = 0; k < pos.count; k++) uv.setXY(k, (pos.getX(k) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(k) - bb.min.y) / (bb.max.y - bb.min.y));
      uv.needsUpdate = true;
      const face = new T.Mesh(geo, [foil, edge]);          // group 0 = caps (foil), 1 = sides (foil edge)
      const backFace = new T.Mesh(new T.ShapeGeometry(cardShape(W * 0.99, h * 0.99, CR)), satin);
      backFace.rotation.y = Math.PI; backFace.position.z = -0.0015;   // the inside of the crown is satin black
      const card = new T.Group(); card.add(face); card.add(backFace);
      const a = c.a * Math.PI / 180;
      card.rotation.order = 'YXZ';
      card.rotation.y = a; card.rotation.x = -0.1; card.rotation.z = c.z;   // tangent to the ring, flared outward, splayed
      card.position.set(Math.sin(a) * R, 0.06, Math.cos(a) * R);
      crown.add(card);
    }
    // the band: satin black, a foil lip on top, a hairline at the foot
    // the band clears the cards' corners (a flat card's corners sit outside the ring's arc)
    const BR = Math.hypot(R + 0.02, W / 2) + 0.02;
    const band = new T.Mesh(new T.CylinderGeometry(BR, BR, 0.15, 128, 1, true), satin);
    band.material.side = T.DoubleSide; band.position.y = 0.075; crown.add(band);
    const lip = new T.Mesh(new T.TorusGeometry(BR, 0.009, 12, 200), edge);
    lip.rotation.x = Math.PI / 2; lip.position.y = 0.15; crown.add(lip);
    const foot = new T.Mesh(new T.TorusGeometry(BR, 0.005, 10, 200), edge);
    foot.rotation.x = Math.PI / 2; foot.position.y = 0.0; crown.add(foot);

    // the model: Meshy 7.1 from the approved concept (docs/design/crown/concept-11.png),
    // slimmed in Blender (scripts/crown-web.py). It replaces the coded fallback once loaded.
    if (opts.model && T.GLTFLoader) {
      new T.GLTFLoader().load(opts.model, (g) => {
        const m = g.scene;
        const box = new T.Box3().setFromObject(m), size = new T.Vector3(), mid = new T.Vector3();
        box.getSize(size); box.getCenter(mid);
        const k = 1.75 / Math.max(size.x, size.z);          // same footprint as the coded crown
        m.scale.setScalar(k);
        m.position.set(-mid.x * k, -box.min.y * k, -mid.z * k);
        m.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          o.material.envMapIntensity = opts.envI != null ? opts.envI : 1.35;
          if (opts.light === 'june' && o.material.metalness > 0.5) { o.material.metalness = 1; o.material.roughness = Math.min(o.material.roughness, 0.28); }
          const col = o.material.color;
          if (opts.gems && col && o.material.metalness < 0.5 && col.b > col.r * 1.6 && col.b > col.g * 1.2) {   // the blue stones
            o.material = new T.MeshPhysicalMaterial({
              color: 0x2a5cff, metalness: 0, roughness: 0.02, transmission: 0.82, thickness: 0.5, ior: 1.77,   // sapphire
              attenuationColor: new T.Color(0x0b2fb0), attenuationDistance: 0.4, clearcoat: 1, clearcoatRoughness: 0.02,
              specularIntensity: 1, envMapIntensity: 2.8, emissive: new T.Color(0x0c2a96), emissiveIntensity: 0.35, flatShading: true,
            });
            return;
          }
          if (opts.glassTint) o.material.onBeforeCompile = (sh) => {   // pale, unsaturated texels are the window glass: pull them toward sapphire foil
            sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
              { vec3 q = diffuseColor.rgb; float mx = max(q.r, max(q.g, q.b)), mn = min(q.r, min(q.g, q.b));
                float glass = smoothstep(0.32, 0.55, mx) * (1.0 - smoothstep(0.22, 0.42, (mx - mn) / max(mx, 0.001)));
                diffuseColor.rgb = mix(q, q * vec3(${opts.glassTint.join(', ')}), glass); }`);
          };
          o.material.needsUpdate = true;
        });
        crown.clear(); crown.add(m);
        camera.position.set(0, 0.78, 5.2); camera.lookAt(0, 0.46, 0);
        if (opts.camera) { camera.position.fromArray(opts.camera[0]); camera.lookAt(new T.Vector3().fromArray(opts.camera[1])); }
        camBase = { pos: camera.position.clone(), at: opts.camera ? new T.Vector3().fromArray(opts.camera[1]) : new T.Vector3(0, 0.46, 0) };
        resize();
        if (opts.cards && opts.cards.length) {
          if (opts.orbit) setOrbit(opts.cards, size.y * k); else if (opts.slots) setSlots(opts.cards, opts.slots); else setCards(opts.cards, size.y * k);
        }
        if (opts.onload) opts.onload();
      });
    }

    // A video crown (Faisal, 28 Oct: "have Higgsfield make a video... transparent... the cards over the video... actual 3D").
    // opts.video = { src, width, y }: a green-screen turntable played on a plane at the ring's centre. The shader keys the
    // green out and writes depth where the crown is solid, so cards passing behind it are hidden by the crown itself.
    if (opts.video) {
      crown.clear();
      const vid = document.createElement('video');
      Object.assign(vid, { src: opts.video.src, muted: true, loop: true, playsInline: true, autoplay: true, crossOrigin: 'anonymous', preload: 'auto' });
      vid.setAttribute('playsinline', ''); vid.setAttribute('muted', '');
      const vtex = new T.VideoTexture(vid);   // sampled as-is: the video is already display colour
      const keyMat = new T.ShaderMaterial({
        transparent: true, depthWrite: true, toneMapped: false,
        uniforms: { map: { value: vtex } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform sampler2D map; varying vec2 vUv;\n' +
          'void main(){ vec4 c = texture2D(map, vUv);\n' +
          '  float d = c.g - max(c.r, c.b);\n' +                       // how green this pixel is
          '  float a = 1.0 - smoothstep(0.06, 0.2, d);\n' +
          '  if (a < 0.5) discard;\n' +                                 // keyed out: no colour, no depth
          '  c.g = min(c.g, max(c.r, c.b) + 0.02);\n' +                 // spill: no green fringe on the gold
          '  gl_FragColor = vec4(c.rgb, 1.0);\n' +
          '}',
      });
      const go = () => {
        const w = opts.video.width || 2.2, h = w * (vid.videoHeight / vid.videoWidth || 9 / 16);
        const plane = new T.Mesh(new T.PlaneGeometry(w, h), keyMat);
        plane.position.y = opts.video.y != null ? opts.video.y : h / 2;
        if (opts.camera) { camera.position.fromArray(opts.camera[0]); camera.lookAt(new T.Vector3().fromArray(opts.camera[1])); }
        plane.lookAt(camera.position);                   // faces the camera: the video is never squashed
        plane.rotateZ(opts.video.roll || 0);             // and leans with the card ring (P: same angle as the cards)
        scene.add(plane); vplane = plane;
        camBase = { pos: camera.position.clone(), at: opts.camera ? new T.Vector3().fromArray(opts.camera[1]) : new T.Vector3(0, 0.5, 0) };
        resize();
        if (opts.cards && opts.cards.length && opts.orbit) setOrbit(opts.cards, 1);
        vid.play().catch(() => {});
        if (opts.onload) opts.onload();
      };
      if (vid.readyState >= 1) go(); else vid.addEventListener('loadedmetadata', go, { once: true });
    }
    let vplane = null;

    // The carousel IS the crown (Faisal, 27 Oct): real cards set into the band, all the
    // way around, framed in gold, turning with the crown. Band geometry is a fraction of the
    // model's height (opts.band: { count, y, h, r }), tuned to the model's card windows.
    const faces = [];
    const loader = new T.TextureLoader();
    const frameMat = new T.MeshPhysicalMaterial({ color: 0xe9b949, metalness: 1, roughness: 0.25, clearcoat: 0.4 });
    function setCards(list, height) {
      const b = Object.assign({ count: 14, y: 0.33, h: 0.3, r: 1.0 }, opts.band || {});
      const R = 0.875 * b.r, ch = height * b.h, cw = ch * 0.716, yc = height * b.y;
      for (let i = 0; i < b.count; i++) {
        const card = list[i % list.length];
        const a = (i / b.count) * Math.PI * 2;
        const g = new T.Group();
        const frame = new T.Mesh(new T.BoxGeometry(cw * 1.1, ch * 1.07, 0.014), frameMat);
        const tex = loader.load(card.src);
        tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
        const face = new T.Mesh(new T.PlaneGeometry(cw, ch), new T.MeshStandardMaterial({ map: tex, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.6 }));
        face.position.z = 0.0085; face.userData.index = i % list.length;
        g.add(frame); g.add(face);
        g.position.set(Math.sin(a) * R, yc, Math.cos(a) * R);
        g.rotation.y = a;
        crown.add(g); faces.push(face);
      }
    }
    // A model with measured windows (scripts/crown-slots.py → { a, y, h, w, r } per window): each real
    // card sits whole inside its window, its own true colours (unlit, not tone-mapped: the card art is
    // the product), shaded only by how far it has turned from the viewer.
    const shade = new T.Vector3(), view = new T.Vector3(), toKey = new T.Vector3(), refl = new T.Vector3();
    // each card shows its back through the crown's open top (the far windows otherwise read as blank glass),
    // and catches a soft diagonal glint as it turns past the key light (the art itself stays its true colour)
    const backMat = opts.cardBack ? new T.MeshBasicMaterial({ map: (() => { const t = loader.load(opts.cardBack); t.encoding = T.sRGBEncoding; return t; })(), toneMapped: false, color: 0xb8b8b8 }) : null;
    const glintTex = (() => {
      const g = document.createElement('canvas'); g.width = 64; g.height = 128; const x = g.getContext('2d');
      const gr = x.createLinearGradient(0, 0, 64, 128);
      gr.addColorStop(0.28, 'rgba(255,255,255,0)'); gr.addColorStop(0.46, 'rgba(255,248,230,.9)'); gr.addColorStop(0.54, 'rgba(255,248,230,.9)'); gr.addColorStop(0.72, 'rgba(255,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 128); return new T.CanvasTexture(g);
    })();
    function setSlots(list, slots) {
      slots.forEach((s, i) => {
        const card = list[i % list.length];
        // windows run taller than a card: fit the card to the window's width, centred in the part
        // of the window below the prong that overlaps its top (adjust: { dy, ws } from tuning renders)
        const adj = Object.assign({ dy: 0, ws: 1 }, opts.slotAdjust || {});
        let cw = Math.min(s.w, adj.wMax || 9) * adj.ws, ch = cw / 0.716;   // wMax: one card size for every window (a few measure wide)
        if (ch > s.h * 0.98) { ch = s.h * 0.98; cw = ch * 0.716; }
        const tex = loader.load(card.src);
        tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
        const face = new T.Mesh(new T.PlaneGeometry(cw, ch), new T.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: !!opts.cardAlpha, opacity: opts.cardAlpha || 1 }));
        face.userData.index = i % list.length;
        const g = new T.Group(); g.add(face);
        const glint = new T.Mesh(face.geometry, new T.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
        glint.position.z = 0.001; face.add(glint); face.userData.glint = glint;
        if (backMat) { const back = new T.Mesh(face.geometry, backMat); back.rotation.y = Math.PI; back.position.z = -(opts.backInset || 0.034); g.add(back); }
        const r = s.r + (opts.lift || 0.014);
        g.position.set(Math.sin(s.a) * r, s.y + adj.dy, Math.cos(s.a) * r);
        g.rotation.y = s.a;
        crown.add(g); faces.push(face);
      });
    }
    // Cards that hover round the crown instead of sitting on it (Faisal, 27 Oct: "just make them hover around it.
    // Don't actually make them part of the crown"). A tilted ring of real cards, their backs facing in, turning
    // faster than the crown; the crown hides the far side of the ring. opts.orbit: { count, r, y, h, tilt, crownTurn }
    const ringTilt = new T.Group(), ring = new T.Group();
    ringTilt.add(ring); scene.add(ringTilt);
    const orbit = Object.assign({ count: 12, r: 1.25, y: 0.34, h: 0.42, tilt: 0.2, roll: 0, crownTurn: 0.35 }, opts.orbit || {});
    const glowTex = (() => {
      const g = document.createElement('canvas'); g.width = 128; g.height = 160; const x = g.getContext('2d');
      x.filter = 'blur(10px)'; x.fillStyle = '#fff'; x.beginPath(); x.roundRect ? x.roundRect(18, 18, 92, 124, 10) : x.rect(18, 18, 92, 124); x.fill();
      return new T.CanvasTexture(g);
    })();
    function setOrbit(list, height) {
      const ch = orbit.h, cw = ch * 0.716, geo = new T.PlaneGeometry(cw, ch);
      // spacing: neighbours sit this many card-widths apart round the ring (P: tight, the way the first carousel was)
      const count = orbit.spacing ? Math.max(8, Math.round((2 * Math.PI * orbit.r) / (cw * orbit.spacing))) : orbit.count;
      ringTilt.position.y = height * orbit.y;
      ringTilt.add(crown); crown.position.y = -ringTilt.position.y;   // the crown leans with the ring (P: tilted with the cards)
      for (let i = 0; i < count; i++) {
        const card = list[i % list.length], a = (i / count) * Math.PI * 2;
        const tex = loader.load(card.src);
        tex.encoding = T.sRGBEncoding; tex.anisotropy = 8;
        const face = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
        face.userData.index = i % list.length;
        const glint = new T.Mesh(geo, new T.MeshBasicMaterial({ map: glintTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
        glint.position.z = 0.001; face.add(glint); face.userData.glint = glint;
        const halo = new T.Mesh(geo, new T.MeshBasicMaterial({ map: glowTex, color: 0xfff1cf, transparent: true, opacity: 0.2, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false }));
        halo.scale.set(1.36, 1.3, 1); halo.position.z = -0.004; face.userData.halo = halo;
        const g = new T.Group(); g.add(halo); g.add(face);
        if (backMat) { const back = new T.Mesh(geo, backMat); back.rotation.y = Math.PI; back.position.z = -0.006; g.add(back); }
        g.position.set(Math.sin(a) * orbit.r, 0, Math.cos(a) * orbit.r);
        g.rotation.y = a; g.userData.a = a; g.userData.turn = 0;
        ring.add(g); faces.push(face);
      }
    }
    function shadeCards() {
      for (const f of faces) {
        if (!f.material.isMeshBasicMaterial) continue;
        f.getWorldPosition(shade); view.copy(camera.position).sub(shade).normalize();
        const n = new T.Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new T.Quaternion()));
        const d = Math.max(0, n.dot(view));
        f.material.color.setScalar(0.55 + 0.45 * Math.pow(d, 0.8));
        if (f.userData.glint) {   // mirror the view about the card's normal; the closer that lands on the key light, the brighter the glint
          toKey.copy(key.position).normalize(); refl.copy(view).reflect(n).negate();
          f.userData.glint.material.opacity = 0.04 + 0.42 * Math.pow(Math.max(0, refl.dot(toKey)), 6) * d;
        }
      }
    }
    const corner = new T.Vector3(), toCam = new T.Vector3(), nrm = new T.Vector3(), fq = new T.Quaternion();
    function front() {
      let best = null, bd = 0.55;
      for (const f of faces) {
        f.getWorldPosition(corner); toCam.copy(camera.position).sub(corner).normalize();
        nrm.set(0, 0, 1).applyQuaternion(f.getWorldQuaternion(fq));
        const d = nrm.dot(toCam); if (d > bd) { bd = d; best = f; }
      }
      if (!best) return null;
      const p = best.geometry.parameters, w = canvas.clientWidth, h = canvas.clientHeight;
      // the card's own corners on screen: the brackets follow its tilt instead of an upright box
      const pts = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => {
        corner.set(sx * p.width / 2, sy * p.height / 2, 0); best.localToWorld(corner); corner.project(camera);
        return [(corner.x + 1) / 2 * w, (1 - corner.y) / 2 * h];
      });
      const [tl, tr, br, bl] = pts, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const top = mid(tl, tr), bot = mid(bl, br), lft = mid(tl, bl), rgt = mid(tr, br);
      return { cx: (tl[0] + tr[0] + br[0] + bl[0]) / 4, cy: (tl[1] + tr[1] + br[1] + bl[1]) / 4,
        w: Math.hypot(rgt[0] - lft[0], rgt[1] - lft[1]), h: Math.hypot(bot[0] - top[0], bot[1] - top[1]),
        angle: Math.atan2(rgt[1] - lft[1], rgt[0] - lft[0]), index: best.userData.index };
    }
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    function pick(clientX, clientY) {            // which card is under the pointer (front side only)
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(faces, false)[0];
      if (!hit) return -1;
      const n = new T.Vector3(0, 0, 1).applyQuaternion(hit.object.getWorldQuaternion(new T.Quaternion()));
      return n.dot(ray.ray.direction) < 0 ? hit.object.userData.index : -1;
    }
    let spinAngle = 0, spinVel = opts.spin || 0, lastNow = 0, hoverFace = null;
    function nudge(rad) { spinAngle += rad; }
    let hoverIndex = -1;
    const GOLDGLOW = new T.Color(0xffc94a), WARMGLOW = new T.Color(0xfff1cf);
    function hover(index) {
      hoverIndex = index;
      // a seated card (opts.slots) lifts out of its window toward the viewer before it grows, so it never cuts through the frame
      const lift = opts.slots || opts.orbit;   // seated or hovering cards come forward before they grow
      faces.forEach((f) => { const on = f.userData.index === index; f.parent.scale.setScalar(on ? (opts.slots ? 1.05 : opts.orbit ? 1.04 : 1.1) : 1); if (lift) f.position.z = on ? (opts.orbit ? 0.02 : 0.07) : 0; });
    }

    let mx = 0, my = 0;
    let camBase = null;
    function resize() {
      const w = canvas.clientWidth || canvas.width || 300, h = canvas.clientHeight || canvas.height || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      // narrow canvases (phones) back the camera off so the whole crown stays in frame
      if (camBase) {
        const f = Math.max(1, 1.45 / camera.aspect);
        camera.position.copy(camBase.at).addScaledVector(camBase.pos.clone().sub(camBase.at), f);
        camera.lookAt(camBase.at);
      }
    }
    // yaw: a slow sway that shows the arc from both sides (the crown has a front), plus the mouse
    function poseAt(now) {
      const t = now / 1000;
      return opts.yaw != null ? opts.yaw : (opts.sway === false ? 0 : Math.sin(t * 0.55) * 0.42);
    }
    function render(now, mouseX, mouseY) {
      mx += ((mouseX || 0) - mx) * 0.06; my += ((mouseY || 0) - my) * 0.06;
      uniforms.uTime.value = now / 1000;
      const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0; lastNow = now;
      if (spinVel) spinAngle += spinVel * dt;
      if (opts.orbit) {   // the ring carries the cards round; the crown turns slower inside it; neither follows the mouse (P)
        ring.rotation.y = spinAngle;
        ringTilt.rotation.set(orbit.tilt, 0, orbit.roll);
        crown.rotation.y = opts.cards ? spinAngle * orbit.crownTurn : poseAt(now);
        crown.rotation.x = 0;
        for (const f of faces) {   // the hovered card's glow warms up; nothing turns, nothing stops
          const h = f.userData.halo; if (!h) continue;
          const on = f.userData.index === hoverIndex;
          h.material.opacity += ((on ? 0.62 : 0.2) - h.material.opacity) * Math.min(1, dt * 10);
          h.material.color.lerp(on ? GOLDGLOW : WARMGLOW, Math.min(1, dt * 10));
        }
      } else {
        crown.rotation.y = (spinVel || opts.cards ? spinAngle : poseAt(now)) + mx * 0.35;
        crown.rotation.x = -my * 0.06;
      }
      if (faces.length) { scene.updateMatrixWorld(); shadeCards(); }
      renderer.render(scene, camera);
    }
    resize();
    return { render, resize, renderer, scene, camera, crown, uniforms, pick, nudge, hover, front, setSpin: (v) => { spinVel = v; }, get spinAngle() { return spinAngle; } };
  }

  window.CrownMark = { mount };
})();
