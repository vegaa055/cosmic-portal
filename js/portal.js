/* ============================================================
   JAMES OBSERVATORY — IMMERSIVE / "The Aperture"
   A scroll-driven journey: approach the portal, pass through it,
   drift past the plate archive, and arrive at the far aperture.
   ============================================================ */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {
    clamp, lerp, invLerp, smoothstep, damp, isMobile, reducedMotion,
    supportsWebGL, createRenderer, makeStarfield, makeNebula, makeTunnel,
    makePortal, makeCard, labelTexture, Cursor, Pointer, bindLoader, onResize
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
   1 — THE ARCHIVE (plates shown as cards)
   ------------------------------------------------------------ */
const PLATES = [
    {
        file: 'img/ocean-of-stars.webp',
        title: 'Ocean of Stars',
        sub: 'Wide-field survey',
        blurb: 'A long-exposure sweep across a dense star field — the kind of frame that makes the scale of a single galaxy uncomfortably obvious.',
        meta: { Instrument: 'Wide-Field Imager', Exposure: '46 × 300 s', Filter: 'L·R·G·B', Field: '1.4°' }
    },
    {
        file: 'img/eagle-nebula.webp',
        title: 'Eagle Nebula',
        sub: 'M16 · Serpens',
        blurb: 'Towers of cold hydrogen and dust being sculpted by radiation from young, massive stars nearby. New stars are still condensing inside them.',
        meta: { Instrument: 'Ritchey–Chrétien 1.2 m', Exposure: '38 × 420 s', Distance: '~7,000 ly', Filter: 'Hα · OIII · SII' }
    },
    {
        file: 'img/carina-nebula.webp',
        title: 'Carina Nebula',
        sub: 'NGC 3372 · Cosmic Cliffs',
        blurb: 'The edge of a vast stellar nursery. What reads as a mountain range is a wall of gas and dust being eroded by ultraviolet light from above.',
        meta: { Instrument: 'Ritchey–Chrétien 1.2 m', Exposure: '52 × 400 s', Distance: '~7,500 ly', Filter: 'Narrowband' }
    },
    {
        file: 'img/centaurus-a.webp',
        title: 'Centaurus A',
        sub: 'NGC 5128 · Peculiar galaxy',
        blurb: 'A giant elliptical galaxy wearing a dark lane of dust — the leftovers of a merger. Its core hosts a supermassive black hole driving enormous jets.',
        meta: { Instrument: 'Wide-Field Imager', Exposure: '61 × 360 s', Distance: '~13 Mly', Filter: 'L·R·G·B' }
    },
    {
        file: 'img/P1079966RubinLMC.webp',
        title: 'Large Magellanic Cloud',
        sub: 'Satellite galaxy',
        blurb: 'Our nearest large galactic neighbour, packed with star-forming regions. A favourite target on clear winter nights from the southern site.',
        meta: { Instrument: 'Survey Array', Exposure: '120 × 240 s', Distance: '~160,000 ly', Filter: 'Broadband' }
    },
    {
        file: 'img/potw1639a.jpg',
        title: 'The Dome at Nightfall',
        sub: 'James Observatory',
        blurb: 'Home. The main dome opens about forty minutes after sunset — and on a good night it stays open until the sky starts to grey again.',
        meta: { Location: 'CyberApolis', Elevation: '2,140 m', 'Clear nights': '198 / yr', Seeing: '0.8″ median' }
    }
];

/* ------------------------------------------------------------
   2 — SCENE PLUMBING
   ------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060f, 0.0075);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(0, 0, 17);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isMobile() ? 0.62 : 0.85,  // strength
    0.55,                      // radius
    0.55                       // threshold
);
composer.addPass(bloom);
composer.addPass(new OutputPass());

onResize(renderer, camera, composer);

const pointer = new Pointer();
const cursor = new Cursor();
const SLOW = reducedMotion() ? 0.25 : 1;

/* ------------------------------------------------------------
   3 — BACKDROP LAYERS
   ------------------------------------------------------------ */
const stars = makeStarfield({ count: 7000, inner: 70, outer: 460, size: 2.6 });
scene.add(stars);

const nebula = makeNebula({ count: 950, spread: 95, size: 30 });
nebula.position.z = -20;
scene.add(nebula);

const tunnel = makeTunnel({ count: 2800, radius: 17, length: 170, size: 3.4 });
tunnel.position.z = -25;
scene.add(tunnel);

/* ------------------------------------------------------------
   4 — LOAD TEXTURES, THEN BUILD
   ------------------------------------------------------------ */
const manager = new THREE.LoadingManager();
const finishLoader = bindLoader(manager);
const texLoader = new THREE.TextureLoader(manager);

const textures = PLATES.map((p) => {
    const t = texLoader.load(p.file);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
});

/* --- the two apertures --- */
const portalNear = makePortal({ radius: 3.7, texture: textures[0] });
portalNear.position.set(0, 0, 0);
scene.add(portalNear);

const portalFar = makePortal({ radius: 4.4, texture: textures[2] });
portalFar.position.set(0, 0, -64);
scene.add(portalFar);

/* --- the plate archive corridor --- */
const cardGroup = new THREE.Group();
scene.add(cardGroup);

const CARD_W = isMobile() ? 3.4 : 4.6;
const CARD_H = CARD_W / 1.55;
const cards = [];

PLATES.forEach((plate, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const z = -15 - i * 6.2;

    const mesh = makeCard(textures[i], { width: CARD_W, height: CARD_H });
    mesh.position.set(side * (isMobile() ? 3.2 : 4.7), (i % 3 - 1) * 0.85, z);
    mesh.rotation.y = -side * 0.42;
    mesh.rotation.z = side * 0.02;
    mesh.userData.index = i;
    cardGroup.add(mesh);

    // label plate beneath
    const labTex = labelTexture(plate.title, plate.sub);
    const labMat = new THREE.MeshBasicMaterial({
        map: labTex, transparent: true, depthWrite: false, opacity: 0
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W * 0.86, CARD_W * 0.86 / 4), labMat);
    label.position.set(
        mesh.position.x - side * 0.0,
        mesh.position.y - CARD_H / 2 - 0.62,
        mesh.position.z + 0.02
    );
    label.rotation.copy(mesh.rotation);
    cardGroup.add(label);

    cards.push({
        mesh, label, labMat,
        base: mesh.position.clone(),
        baseRot: mesh.rotation.clone(),
        hover: 0,
        data: plate
    });
});

manager.onLoad = () => {
    // aspect ratios are only known once the images decode
    cards.forEach((c, i) => {
        const img = textures[i].image;
        if (img && img.width) c.mesh.userData.mat.uniforms.uImgAspect.value = img.width / img.height;
    });
    finishLoader();
    document.body.classList.add('ready');
};
// safety net: never leave the loader up forever
setTimeout(() => { finishLoader(); document.body.classList.add('ready'); }, 9000);

/* ------------------------------------------------------------
   5 — CAMERA PATH
   ------------------------------------------------------------ */
const CAM = [
    { p: 0.00, pos: [0, 0.0, 17], look: [0, 0, 0] },
    { p: 0.17, pos: [0, 0.0, 9.5], look: [0, 0, 0] },
    { p: 0.31, pos: [0, 0.0, 2.6], look: [0, 0, -7] },
    { p: 0.42, pos: [0, 0.1, -4.5], look: [0, 0, -15] },
    { p: 0.56, pos: [0, 0.5, -15], look: [0, 0, -25] },
    { p: 0.71, pos: [0, 0.0, -27], look: [0, 0, -37] },
    { p: 0.86, pos: [0, 0.4, -41], look: [0, 0, -52] },
    { p: 1.00, pos: [0, 0.0, -54], look: [0, 0, -64] }
];

const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

function samplePath(p) {
    let a = CAM[0], b = CAM[CAM.length - 1];
    for (let i = 0; i < CAM.length - 1; i++) {
        if (p >= CAM[i].p && p <= CAM[i + 1].p) { a = CAM[i]; b = CAM[i + 1]; break; }
    }
    const t = smoothstep(a.p, b.p, p);
    _pos.set(
        lerp(a.pos[0], b.pos[0], t),
        lerp(a.pos[1], b.pos[1], t),
        lerp(a.pos[2], b.pos[2], t)
    );
    _look.set(
        lerp(a.look[0], b.look[0], t),
        lerp(a.look[1], b.look[1], t),
        lerp(a.look[2], b.look[2], t)
    );
}

/* ------------------------------------------------------------
   6 — SCROLL + ACT OVERLAYS
   ------------------------------------------------------------ */
let scrollTarget = 0;
let scrollSmooth = 0;

function readScroll() {
    const max = document.body.scrollHeight - window.innerHeight;
    scrollTarget = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
window.addEventListener('resize', readScroll);
readScroll();

const acts = [...document.querySelectorAll('.act')].map((el) => ({
    el,
    from: parseFloat(el.dataset.from),
    to: parseFloat(el.dataset.to)
}));

const progressBar = document.querySelector('.progress span');

function updateActs(p) {
    acts.forEach((a) => {
        // the first act is already on screen at p=0, the last stays lit at p=1
        const fadeIn = a.from <= 0 ? 1 : smoothstep(a.from, a.from + 0.055, p);
        const fadeOut = a.to >= 1 ? 1 : 1 - smoothstep(a.to - 0.055, a.to, p);
        const o = Math.min(fadeIn, fadeOut);
        a.el.style.opacity = o.toFixed(3);
        a.el.style.transform = `translateY(${((1 - o) * 26).toFixed(2)}px)`;
        a.el.style.pointerEvents = o > 0.62 ? 'auto' : 'none';
        a.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    });
    if (progressBar) progressBar.style.transform = `scaleX(${p.toFixed(4)})`;
}

/* ------------------------------------------------------------
   7 — HOVER / FOCUS INTERACTION
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

function openFocus(data) {
    focusOpen = true;
    focusImg.src = data.file;
    focusImg.alt = data.title;
    focusTitle.textContent = data.title;
    focusSub.textContent = data.sub;
    focusBlurb.textContent = data.blurb;
    focusMeta.innerHTML = Object.entries(data.meta)
        .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    focusEl.classList.add('open');
    cursor.hot(false);
}
function closeFocus() {
    focusOpen = false;
    focusEl.classList.remove('open');
}
document.getElementById('focus-close')?.addEventListener('click', closeFocus);
focusEl?.addEventListener('click', (e) => { if (e.target === focusEl) closeFocus(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFocus(); });

window.addEventListener('pointerdown', () => {
    if (!focusOpen && hovered) openFocus(hovered.data);
});

/* ------------------------------------------------------------
   8 — LOOP
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let paused = false;
document.addEventListener('visibilitychange', () => { paused = document.hidden; });

function frame() {
    requestAnimationFrame(frame);
    if (paused) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime() * SLOW;

    pointer.update(dt);
    cursor.update(dt);

    /* --- scroll easing --- */
    scrollSmooth = damp(scrollSmooth, scrollTarget, 4.2, dt);
    const p = scrollSmooth;
    updateActs(p);

    /* --- camera along the path + pointer parallax --- */
    samplePath(p);
    const par = focusOpen ? 0 : 1;
    camera.position.set(
        _pos.x + pointer.sx * 1.5 * par,
        _pos.y + pointer.sy * 1.0 * par,
        _pos.z
    );
    _look.x += pointer.sx * 0.9 * par;
    _look.y += pointer.sy * 0.55 * par;
    camera.lookAt(_look);
    camera.rotation.z = pointer.sx * 0.028 * par;

    /* --- warp boost while passing through the near aperture --- */
    const transit = smoothstep(0.24, 0.44, p) * (1 - smoothstep(0.46, 0.62, p));
    tunnel.userData.mat.uniforms.uTime.value = t;
    tunnel.userData.mat.uniforms.uBoost.value = transit;

    /* --- backdrops --- */
    stars.userData.mat.uniforms.uTime.value = t;
    stars.rotation.y = t * 0.006;
    nebula.userData.mat.uniforms.uTime.value = t;
    nebula.rotation.z = t * 0.008;

    /* --- portals --- */
    const pn = portalNear.userData;
    pn.discMat.uniforms.uTime.value = t;
    pn.orbMat.uniforms.uTime.value = t;
    pn.discMat.uniforms.uOpen.value = 0.25 + smoothstep(0.05, 0.36, p) * 0.95;
    portalNear.rotation.z = t * 0.05;
    // tilt the aperture toward the cursor before we pass through
    const preTransit = 1 - smoothstep(0.18, 0.34, p);
    portalNear.rotation.y = pointer.sx * 0.16 * preTransit;
    portalNear.rotation.x = -pointer.sy * 0.12 * preTransit;
    pn.ringMat.opacity = 0.55 + 0.45 * Math.sin(t * 1.6) * 0.35 + 0.3;

    const pf = portalFar.userData;
    pf.discMat.uniforms.uTime.value = t * 0.85;
    pf.orbMat.uniforms.uTime.value = t * 0.9;
    pf.discMat.uniforms.uOpen.value = 0.2 + smoothstep(0.72, 0.99, p) * 1.0;
    portalFar.rotation.z = -t * 0.04;

    /* --- cards: reveal by proximity, tilt + lift on hover --- */
    if (!focusOpen) {
        ndc.set(pointer.nx, pointer.ny);
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(cards.map((c) => c.mesh), false);
        const next = hits.length ? cards[hits[0].object.userData.index] : null;
        if (next !== hovered) {
            hovered = next;
            cursor.hot(!!hovered);
            document.body.style.cursor = hovered ? 'pointer' : '';
        }
    }

    cards.forEach((c) => {
        const m = c.mesh.userData.mat;
        m.uniforms.uTime.value = t;

        // fade in when the camera is near this plate
        const dz = Math.abs(camera.position.z - c.base.z);
        const reveal = 1 - smoothstep(16, 34, dz);
        m.uniforms.uReveal.value = damp(m.uniforms.uReveal.value, reveal, 5, dt);
        c.labMat.opacity = m.uniforms.uReveal.value * 0.92;

        // hover response
        const want = c === hovered ? 1 : 0;
        c.hover = damp(c.hover, want, 9, dt);
        m.uniforms.uHover.value = c.hover;

        const s = 1 + c.hover * 0.09;
        c.mesh.scale.setScalar(s);

        // lean toward the cursor, plus a slow idle drift
        const idleY = Math.sin(t * 0.5 + c.base.z) * 0.035;
        const idleF = Math.sin(t * 0.7 + c.base.x) * 0.09;
        c.mesh.rotation.x = c.baseRot.x + idleY + (-pointer.sy * 0.22 * c.hover);
        c.mesh.rotation.y = c.baseRot.y + (pointer.sx * 0.26 * c.hover);
        c.mesh.position.y = c.base.y + idleF + c.hover * 0.28;
        c.mesh.position.z = c.base.z + c.hover * 1.15;

        c.label.rotation.x = c.mesh.rotation.x;
        c.label.rotation.y = c.mesh.rotation.y;
        c.label.position.y = c.base.y - CARD_H / 2 - 0.62 + idleF + c.hover * 0.28;
    });

    composer.render();
}
frame();

/* ------------------------------------------------------------
   9 — SMALL NICETIES
   ------------------------------------------------------------ */
// let the "begin" button drive the scroll
document.querySelectorAll('[data-scroll-to]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const target = parseFloat(btn.dataset.scrollTo);
        const max = document.body.scrollHeight - window.innerHeight;
        window.scrollTo({ top: max * target, behavior: 'smooth' });
    });
});
