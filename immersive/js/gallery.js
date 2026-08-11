/* ============================================================
   JAMES OBSERVATORY — IMMERSIVE / "Orbit"
   The plate archive as a ring you can spin. Drag to rotate,
   wheel to zoom, hover to lift, click to inspect.
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
    clamp, lerp, smoothstep, damp, isMobile, reducedMotion, supportsWebGL,
    createRenderer, makeStarfield, makeNebula, makeCard, labelTexture,
    dotTexture, GLSL_NOISE, Cursor, Pointer, bindLoader, onResize
} from './lib.js';

/* ------------------------------------------------------------
   0 — GUARD
   ------------------------------------------------------------ */
if (!supportsWebGL()) {
    document.getElementById('nowebgl')?.classList.add('show');
    document.getElementById('loader')?.classList.add('done');
    throw new Error('WebGL unavailable');
}

/* ------------------------------------------------------------
   1 — THE ARCHIVE
   ------------------------------------------------------------ */
const PLATES = [
    {
        file: '../img/ocean-of-stars.webp', title: 'Ocean of Stars', sub: 'Wide-field survey',
        blurb: 'A long-exposure sweep across a dense star field — the kind of frame that makes the scale of a single galaxy uncomfortably obvious.',
        meta: { Instrument: 'Wide-Field Imager', Exposure: '46 × 300 s', Filter: 'L·R·G·B', Field: '1.4°' }
    },
    {
        file: '../img/eagle-nebula.webp', title: 'Eagle Nebula', sub: 'M16 · Serpens',
        blurb: 'Towers of cold hydrogen and dust being sculpted by radiation from young, massive stars nearby. New stars are still condensing inside them.',
        meta: { Instrument: 'Ritchey–Chrétien 1.2 m', Exposure: '38 × 420 s', Distance: '~7,000 ly', Filter: 'Hα · OIII · SII' }
    },
    {
        file: '../img/carina-nebula.webp', title: 'Carina Nebula', sub: 'NGC 3372 · Cosmic Cliffs',
        blurb: 'The edge of a vast stellar nursery. What reads as a mountain range is a wall of gas and dust being eroded by ultraviolet light from above.',
        meta: { Instrument: 'Ritchey–Chrétien 1.2 m', Exposure: '52 × 400 s', Distance: '~7,500 ly', Filter: 'Narrowband' }
    },
    {
        file: '../img/centaurus-a.webp', title: 'Centaurus A', sub: 'NGC 5128 · Peculiar galaxy',
        blurb: 'A giant elliptical galaxy wearing a dark lane of dust — the leftovers of a merger. Its core hosts a supermassive black hole driving enormous jets.',
        meta: { Instrument: 'Wide-Field Imager', Exposure: '61 × 360 s', Distance: '~13 Mly', Filter: 'L·R·G·B' }
    },
    {
        file: '../img/P1079966RubinLMC.webp', title: 'Large Magellanic Cloud', sub: 'Satellite galaxy',
        blurb: 'Our nearest large galactic neighbour, packed with star-forming regions. A favourite target on clear winter nights from the southern site.',
        meta: { Instrument: 'Survey Array', Exposure: '120 × 240 s', Distance: '~160,000 ly', Filter: 'Broadband' }
    },
    {
        file: '../img/potw1639a.jpg', title: 'The Dome at Nightfall', sub: 'James Observatory',
        blurb: 'Home. The main dome opens about forty minutes after sunset — and on a good night it stays open until the sky starts to grey again.',
        meta: { Location: 'CyberApolis', Elevation: '2,140 m', 'Clear nights': '198 / yr', Seeing: '0.8″ median' }
    }
];

/* ------------------------------------------------------------
   2 — SCENE
   ------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060f, 0.011);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 1.6, 17);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile() ? 0.6 : 0.8, 0.55, 0.6
));
composer.addPass(new OutputPass());

onResize(renderer, camera, composer);

const pointer = new Pointer();
const cursor = new Cursor();
const SLOW = reducedMotion() ? 0.25 : 1;

const stars = makeStarfield({ count: 6500, inner: 60, outer: 420, size: 2.5 });
scene.add(stars);
const nebula = makeNebula({ count: 800, spread: 80, size: 30 });
scene.add(nebula);

/* ------------------------------------------------------------
   3 — CENTRAL CORE (a small sun at the ring's heart)
   ------------------------------------------------------------ */
const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
        uTime: { value: 0 },
        uColA: { value: new THREE.Color(0x2fd4d9) },
        uColB: { value: new THREE.Color(0x7c5cff) }
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3 uColA;
        uniform vec3 uColB;
        varying vec2 vUv;
        ${GLSL_NOISE}
        void main(){
            vec2 c = vUv - 0.5;
            float r = length(c) * 2.0;
            if (r > 1.0) discard;
            float n = fbm(vec3(c * 4.5, uTime * 0.22));
            float core = smoothstep(1.0, 0.05, r);
            vec3 col = mix(uColA, uColB, n) * (0.7 + n * 1.1);
            float a = core * (0.30 + n * 0.55);
            a *= 0.75 + 0.25 * sin(uTime * 1.1);
            gl_FragColor = vec4(col, a);
        }
    `
});
const core = new THREE.Mesh(new THREE.CircleGeometry(2.6, 96), coreMat);
scene.add(core);

const coreRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.5, 0.018, 10, 200),
    new THREE.MeshBasicMaterial({
        color: 0x2fd4d9, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
    })
);
coreRing.rotation.x = Math.PI / 2;
scene.add(coreRing);

/* ------------------------------------------------------------
   4 — THE RING OF PLATES
   ------------------------------------------------------------ */
const manager = new THREE.LoadingManager();
const finishLoader = bindLoader(manager);
const texLoader = new THREE.TextureLoader(manager);

const RADIUS = isMobile() ? 8.4 : 9.6;
const STEP = (Math.PI * 2) / PLATES.length;
const CARD_W = isMobile() ? 4.2 : 5.4;
const CARD_H = CARD_W / 1.5;

const ring = new THREE.Group();
scene.add(ring);

const cards = PLATES.map((plate, i) => {
    const tex = texLoader.load(plate.file);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const holder = new THREE.Group();   // handles the orbital placement
    const mesh = makeCard(tex, { width: CARD_W, height: CARD_H });
    mesh.userData.index = i;
    mesh.position.y = 0.35;
    holder.add(mesh);

    const labTex = labelTexture(plate.title, plate.sub);
    const labMat = new THREE.MeshBasicMaterial({
        map: labTex, transparent: true, depthWrite: false, opacity: 0
    });
    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(CARD_W * 0.8, CARD_W * 0.8 / 4), labMat
    );
    label.position.set(0, 0.35 - CARD_H / 2 - 0.72, 0.01);
    holder.add(label);

    ring.add(holder);
    return { holder, mesh, label, labMat, tex, hover: 0, data: plate, index: i };
});

manager.onLoad = () => {
    cards.forEach((c) => {
        const img = c.tex.image;
        if (img && img.width) c.mesh.userData.mat.uniforms.uImgAspect.value = img.width / img.height;
    });
    finishLoader();
};
setTimeout(finishLoader, 9000);

/* ------------------------------------------------------------
   5 — SPIN CONTROLS (drag + inertia + snap)
   ------------------------------------------------------------ */
let angle = 0;         // current ring rotation
let angVel = 0;        // radians / second
let dragging = false;
let lastX = 0;
let idleTimer = 0;     // seconds since last interaction
let zoom = 0;          // -1 .. 1 (wheel)

const el = renderer.domElement;

el.addEventListener('pointerdown', (e) => {
    if (focusOpen) return;
    dragging = true;
    lastX = e.clientX;
    angVel = 0;
    idleTimer = 0;
    el.setPointerCapture?.(e.pointerId);
    document.body.classList.add('grabbing');
});

window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    const k = 0.0055;
    angle += dx * k;
    angVel = dx * k * 60;         // carry momentum
    idleTimer = 0;
});

function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('grabbing');
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);

window.addEventListener('wheel', (e) => {
    if (focusOpen) return;
    zoom = clamp(zoom + Math.sign(e.deltaY) * 0.12, -1, 1);
    idleTimer = 0;
}, { passive: true });

// keyboard: step between plates
window.addEventListener('keydown', (e) => {
    if (focusOpen) return;
    if (e.key === 'ArrowRight') { angle -= STEP; angVel = 0; idleTimer = 0; }
    if (e.key === 'ArrowLeft') { angle += STEP; angVel = 0; idleTimer = 0; }
});

/* dots */
const dotsWrap = document.getElementById('dots');
if (dotsWrap) {
    PLATES.forEach((_, i) => {
        const b = document.createElement('button');
        b.setAttribute('aria-label', 'Plate ' + (i + 1));
        b.addEventListener('click', () => {
            // rotate so plate i faces the camera
            const target = -i * STEP;
            const twoPi = Math.PI * 2;
            let delta = ((target - angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
            angle += delta;
            angVel = 0;
            idleTimer = 0;
        });
        dotsWrap.appendChild(b);
    });
}
const dotEls = dotsWrap ? [...dotsWrap.children] : [];

/* current plate readout */
const nowTitle = document.getElementById('now-title');
const nowSub = document.getElementById('now-sub');
let frontIndex = -1;

/* ------------------------------------------------------------
   6 — FOCUS PANEL
   ------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

const focusEl = document.getElementById('focus');
const focusImg = document.getElementById('focus-img');
const focusTitle = document.getElementById('focus-title');
const focusSub = document.getElementById('focus-sub');
const focusBlurb = document.getElementById('focus-blurb');
const focusMeta = document.getElementById('focus-meta');
let focusOpen = false;

function openFocus(d) {
    focusOpen = true;
    focusImg.src = d.file;
    focusImg.alt = d.title;
    focusTitle.textContent = d.title;
    focusSub.textContent = d.sub;
    focusBlurb.textContent = d.blurb;
    focusMeta.innerHTML = Object.entries(d.meta)
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    focusEl.classList.add('open');
    cursor.hot(false);
}
function closeFocus() { focusOpen = false; focusEl.classList.remove('open'); }
document.getElementById('focus-close')?.addEventListener('click', closeFocus);
focusEl?.addEventListener('click', (e) => { if (e.target === focusEl) closeFocus(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFocus(); });

// click (not drag) opens the plate
let downX = 0, downY = 0;
el.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
el.addEventListener('pointerup', (e) => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved < 6 && !focusOpen && hovered) openFocus(hovered.data);
});

/* ------------------------------------------------------------
   7 — LOOP
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let paused = false;
document.addEventListener('visibilitychange', () => { paused = document.hidden; });

const TWO_PI = Math.PI * 2;

function frame() {
    requestAnimationFrame(frame);
    if (paused) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime() * SLOW;

    pointer.update(dt);
    cursor.update(dt);
    idleTimer += dt;

    /* --- spin physics --- */
    if (!dragging) {
        angle += angVel * dt;
        angVel *= Math.pow(0.06, dt);        // friction

        // once it has settled, ease onto the nearest plate…
        if (Math.abs(angVel) < 0.25) {
            const nearest = Math.round(angle / STEP) * STEP;
            angle = damp(angle, nearest, 3.2, dt);
        }
        // …and drift gently when nobody is touching it
        if (idleTimer > 4 && !focusOpen) angle += 0.045 * dt * SLOW;
    }

    /* --- camera: zoom + pointer parallax --- */
    const dist = lerp(17, 23, (zoom + 1) / 2);
    const par = focusOpen ? 0 : 1;
    camera.position.x = damp(camera.position.x, pointer.sx * 2.2 * par, 4, dt);
    camera.position.y = damp(camera.position.y, 1.6 + pointer.sy * 1.6 * par, 4, dt);
    camera.position.z = damp(camera.position.z, dist, 4, dt);
    camera.lookAt(0, 0.4, 0);

    /* --- backdrop --- */
    stars.userData.mat.uniforms.uTime.value = t;
    stars.rotation.y = t * 0.005;
    nebula.userData.mat.uniforms.uTime.value = t;
    coreMat.uniforms.uTime.value = t;
    core.lookAt(camera.position);
    coreRing.rotation.z = t * 0.12;

    /* --- hover pick --- */
    if (!focusOpen && !dragging) {
        ndc.set(pointer.nx, pointer.ny);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(cards.map((c) => c.mesh), false);
        const next = hits.length ? cards[hits[0].object.userData.index] : null;
        if (next !== hovered) {
            hovered = next;
            cursor.hot(!!hovered);
        }
    } else if (dragging) {
        hovered = null;
        cursor.hot(false);
    }
    document.body.style.cursor = dragging ? 'grabbing' : (hovered ? 'pointer' : 'grab');

    /* --- place + light each plate --- */
    let bestDot = -Infinity, bestIdx = 0;

    cards.forEach((c, i) => {
        const a = i * STEP + angle;
        const x = Math.sin(a) * RADIUS;
        const z = Math.cos(a) * RADIUS;

        // "facing-ness": 1 when the plate is front-and-centre
        const facing = (Math.cos(a) + 1) / 2;
        if (Math.cos(a) > bestDot) { bestDot = Math.cos(a); bestIdx = i; }

        const m = c.mesh.userData.mat;
        m.uniforms.uTime.value = t;

        // hover response
        const want = c === hovered ? 1 : 0;
        c.hover = damp(c.hover, want, 9, dt);
        m.uniforms.uHover.value = c.hover;

        // back plates dim and shrink away
        const reveal = 0.18 + Math.pow(facing, 1.5) * 0.82;
        m.uniforms.uReveal.value = damp(m.uniforms.uReveal.value, reveal, 6, dt);
        c.labMat.opacity = Math.pow(facing, 3) * 0.95;

        const lift = c.hover * 0.55;
        const push = c.hover * 1.2;
        c.holder.position.set(
            x * (1 + push / RADIUS),
            Math.sin(t * 0.6 + i) * 0.14 + lift,
            z * (1 + push / RADIUS)
        );
        c.holder.rotation.y = a;

        // lean toward the cursor while hovered
        c.mesh.rotation.x = damp(c.mesh.rotation.x, -pointer.sy * 0.2 * c.hover, 8, dt);
        c.mesh.rotation.y = damp(c.mesh.rotation.y, pointer.sx * 0.22 * c.hover, 8, dt);

        const s = (0.86 + facing * 0.14) * (1 + c.hover * 0.08);
        c.mesh.scale.setScalar(s);
    });

    /* --- readout + dots --- */
    if (bestIdx !== frontIndex) {
        frontIndex = bestIdx;
        const d = PLATES[frontIndex];
        if (nowTitle) nowTitle.textContent = d.title;
        if (nowSub) nowSub.textContent = d.sub;
        dotEls.forEach((b, i) => b.classList.toggle('on', i === frontIndex));
    }

    composer.render();
}
frame();
