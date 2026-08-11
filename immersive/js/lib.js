/* ============================================================
   JAMES OBSERVATORY — IMMERSIVE / shared WebGL toolkit
   Reusable pieces: renderer setup, starfields, nebula dust,
   the portal, canvas-texture labels, and a custom cursor.
   ============================================================ */

import * as THREE from 'three';

/* ------------------------------------------------------------
   MATH HELPERS
   ------------------------------------------------------------ */
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => {
    const t = invLerp(a, b, v);
    return t * t * (3 - 2 * t);
};
/** Frame-rate independent damping. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const isMobile = () =>
    window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

export const reducedMotion = () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   CAPABILITY CHECK
   ------------------------------------------------------------ */
export function supportsWebGL() {
    try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
            (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
        return false;
    }
}

/* ------------------------------------------------------------
   RENDERER
   ------------------------------------------------------------ */
export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile(),
        powerPreference: 'high-performance',
        alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x05060f, 1);
    return renderer;
}

/* ------------------------------------------------------------
   SPRITE TEXTURES (generated — no external files)
   ------------------------------------------------------------ */
let _dotTex = null;
/** Soft radial dot used for every particle system. */
export function dotTexture() {
    if (_dotTex) return _dotTex;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0.00, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.50, 'rgba(255,255,255,0.22)');
    g.addColorStop(1.00, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    _dotTex = new THREE.CanvasTexture(c);
    _dotTex.colorSpace = THREE.SRGBColorSpace;
    return _dotTex;
}

/** Crisp label plate drawn to a canvas (title + subtitle). */
export function labelTexture(title, sub, opts = {}) {
    const W = 1024, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // accent tick
    ctx.fillStyle = opts.accent || '#2fd4d9';
    ctx.fillRect(0, 96, 54, 4);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 76px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(title, 0, 78);

    ctx.fillStyle = 'rgba(163,173,201,0.95)';
    ctx.font = '500 38px Inter, system-ui, sans-serif';
    ctx.fillText(sub, 0, 160);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

/* ------------------------------------------------------------
   GLSL SNIPPETS
   ------------------------------------------------------------ */
export const GLSL_NOISE = /* glsl */`
    float hash13(vec3 p){
        p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float vnoise(vec3 x){
        vec3 i = floor(x); vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
            mix(mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), f.x),
                mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
                mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
            f.z);
    }
    float fbm(vec3 p){
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return v;
    }
`;

/* ------------------------------------------------------------
   STARFIELD — twinkling points on a spherical shell
   ------------------------------------------------------------ */
export function makeStarfield({
    count = 6000,
    inner = 60,
    outer = 420,
    size = 2.4,
    tint = 0xbcd4ff
} = {}) {
    const n = Math.floor(isMobile() ? count * 0.45 : count);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const aSize = new Float32Array(n);
    const aPhase = new Float32Array(n);
    const aTint = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        // even-ish distribution on a shell
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const r = inner + Math.pow(Math.random(), 0.6) * (outer - inner);
        const s = Math.sqrt(1 - u * u);
        pos[i * 3 + 0] = r * s * Math.cos(th);
        pos[i * 3 + 1] = r * s * Math.sin(th) * 0.75;
        pos[i * 3 + 2] = r * u;

        aSize[i] = size * (0.35 + Math.pow(Math.random(), 2.2) * 1.9);
        aPhase[i] = Math.random() * Math.PI * 2;
        aTint[i] = Math.random();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(aTint, 1));

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
            uMap: { value: dotTexture() },
            uColA: { value: new THREE.Color(tint) },
            uColB: { value: new THREE.Color(0xffd9b0) },
            uOpacity: { value: 1 }
        },
        vertexShader: /* glsl */`
            attribute float aSize;
            attribute float aPhase;
            attribute float aTint;
            uniform float uTime;
            uniform float uPR;
            varying float vTw;
            varying float vTint;
            void main(){
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                vTw = 0.55 + 0.45 * sin(uTime * 1.4 + aPhase * 6.2831);
                vTint = aTint;
                gl_PointSize = aSize * uPR * (260.0 / max(-mv.z, 0.001));
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            uniform vec3 uColA;
            uniform vec3 uColB;
            uniform float uOpacity;
            varying float vTw;
            varying float vTint;
            void main(){
                vec4 t = texture2D(uMap, gl_PointCoord);
                if (t.a < 0.01) discard;
                // a few warm stars amongst the blue-white
                vec3 col = mix(uColA, uColB, smoothstep(0.86, 1.0, vTint));
                gl_FragColor = vec4(col * vTw, t.a * vTw * uOpacity);
            }
        `
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.mat = mat;
    return pts;
}

/* ------------------------------------------------------------
   NEBULA DUST — large soft coloured motes
   ------------------------------------------------------------ */
export function makeNebula({ count = 900, spread = 90, size = 26 } = {}) {
    const n = Math.floor(isMobile() ? count * 0.5 : count);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const aSize = new Float32Array(n);
    const aPhase = new Float32Array(n);
    const col = new Float32Array(n * 3);

    const teal = new THREE.Color(0x2fd4d9);
    const violet = new THREE.Color(0x7c5cff);
    const rose = new THREE.Color(0xff7a59);
    const tmp = new THREE.Color();

    for (let i = 0; i < n; i++) {
        pos[i * 3 + 0] = (Math.random() - 0.5) * spread * 2.2;
        pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.1;
        pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 2.4;
        aSize[i] = size * (0.4 + Math.random() * 1.5);
        aPhase[i] = Math.random() * Math.PI * 2;

        const r = Math.random();
        tmp.copy(r < 0.5 ? teal : r < 0.88 ? violet : rose);
        col[i * 3 + 0] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
            uMap: { value: dotTexture() },
            uOpacity: { value: 0.5 }
        },
        vertexShader: /* glsl */`
            attribute float aSize;
            attribute float aPhase;
            attribute vec3 aColor;
            uniform float uTime;
            uniform float uPR;
            varying vec3 vCol;
            varying float vFade;
            void main(){
                vec3 p = position;
                p.x += sin(uTime * 0.16 + aPhase) * 2.2;
                p.y += cos(uTime * 0.13 + aPhase * 1.7) * 1.8;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                vCol = aColor;
                vFade = 0.6 + 0.4 * sin(uTime * 0.5 + aPhase);
                gl_PointSize = aSize * uPR * (260.0 / max(-mv.z, 0.001));
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            uniform float uOpacity;
            varying vec3 vCol;
            varying float vFade;
            void main(){
                vec4 t = texture2D(uMap, gl_PointCoord);
                if (t.a < 0.01) discard;
                gl_FragColor = vec4(vCol * vFade, t.a * uOpacity * vFade * 0.55);
            }
        `
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.mat = mat;
    return pts;
}

/* ------------------------------------------------------------
   WARP TUNNEL — cylindrical shell of motes streaming past
   ------------------------------------------------------------ */
export function makeTunnel({ count = 2600, radius = 16, length = 150, size = 3.2 } = {}) {
    const n = Math.floor(isMobile() ? count * 0.5 : count);
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const aSize = new Float32Array(n);
    const aPhase = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = radius * (0.35 + Math.random() * 0.95);
        pos[i * 3 + 0] = Math.cos(a) * rr;
        pos[i * 3 + 1] = Math.sin(a) * rr * 0.8;
        pos[i * 3 + 2] = (Math.random() - 0.5) * length;
        aSize[i] = size * (0.4 + Math.random() * 1.6);
        aPhase[i] = Math.random() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
            uMap: { value: dotTexture() },
            uBoost: { value: 0 },
            uColA: { value: new THREE.Color(0x2fd4d9) },
            uColB: { value: new THREE.Color(0x7c5cff) }
        },
        vertexShader: /* glsl */`
            attribute float aSize;
            attribute float aPhase;
            uniform float uTime;
            uniform float uPR;
            uniform float uBoost;
            varying float vT;
            void main(){
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mv;
                vT = fract(aPhase * 0.159 + uTime * 0.05);
                // streak lengthens with warp boost
                gl_PointSize = aSize * uPR * (1.0 + uBoost * 2.4) * (240.0 / max(-mv.z, 0.001));
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            uniform float uBoost;
            uniform vec3 uColA;
            uniform vec3 uColB;
            varying float vT;
            void main(){
                vec4 t = texture2D(uMap, gl_PointCoord);
                if (t.a < 0.01) discard;
                vec3 col = mix(uColA, uColB, vT);
                gl_FragColor = vec4(col, t.a * (0.18 + uBoost * 0.75));
            }
        `
    });

    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.userData.mat = mat;
    return pts;
}

/* ------------------------------------------------------------
   THE PORTAL
   A glowing ring + a shader disc (swirling nebula) + orbiting motes.
   ------------------------------------------------------------ */
export function makePortal({ radius = 3.6, texture = null } = {}) {
    const group = new THREE.Group();

    /* --- swirling event-horizon disc --- */
    const discMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uTex: { value: texture },
            uHasTex: { value: texture ? 1 : 0 },
            uOpen: { value: 0.35 },
            uColA: { value: new THREE.Color(0x2fd4d9) },
            uColB: { value: new THREE.Color(0x7c5cff) },
            uColC: { value: new THREE.Color(0xff7a59) }
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
            uniform sampler2D uTex;
            uniform float uHasTex;
            uniform float uOpen;
            uniform vec3 uColA;
            uniform vec3 uColB;
            uniform vec3 uColC;
            varying vec2 vUv;

            ${GLSL_NOISE}

            void main(){
                vec2 c = vUv - 0.5;
                float r = length(c) * 2.0;          // 0 centre -> 1 rim
                if (r > 1.0) discard;
                float ang = atan(c.y, c.x);

                // swirl: inner rings rotate faster (accretion feel)
                float swirl = ang + uTime * 0.30 + (1.0 - r) * 3.4;
                vec2 pUv = vec2(swirl / 6.28318 + 0.5, clamp(r, 0.0, 1.0));

                // turbulent depth
                float n = fbm(vec3(pUv * 3.2, uTime * 0.13));
                float n2 = fbm(vec3(pUv * 7.0 + n, uTime * 0.09));

                // sample the cosmic plate through the distortion
                vec2 tUv = vec2(
                    0.5 + cos(swirl) * r * 0.5 + (n - 0.5) * 0.16,
                    0.5 + sin(swirl) * r * 0.5 + (n2 - 0.5) * 0.16
                );
                vec3 plate = texture2D(uTex, clamp(tUv, 0.001, 0.999)).rgb;
                plate = mix(vec3(n * 0.6), plate, uHasTex);

                // colour grade toward the brand gradient
                vec3 grad = mix(uColA, uColB, clamp(n2 * 1.25, 0.0, 1.0));
                grad = mix(grad, uColC, smoothstep(0.72, 1.0, n) * 0.35);
                vec3 col = mix(grad * (0.35 + n * 0.9), plate * 1.35, 0.55 * uHasTex + 0.1);

                // hot core + bright rim
                float core = smoothstep(0.55, 0.0, r);
                col += uColA * core * 0.55 * uOpen;
                float rim = smoothstep(0.80, 0.99, r);
                col += mix(uColA, uColB, 0.5) * rim * 1.4;

                // aperture: opens up as uOpen rises
                float aperture = smoothstep(0.02, 0.55, uOpen);
                float alpha = (0.30 + 0.70 * aperture) * (1.0 - smoothstep(0.90, 1.0, r));
                alpha *= 0.55 + 0.45 * n2;
                alpha += rim * 0.85;

                gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
            }
        `
    });

    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.985, 128), discMat);
    group.add(disc);

    /* --- the ring itself (blooms nicely) --- */
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8fe8ea,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 12, 220), ringMat);
    group.add(ring);

    const ringGlow = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.16, 12, 180),
        new THREE.MeshBasicMaterial({
            color: 0x7c5cff, transparent: true, opacity: 0.28,
            blending: THREE.AdditiveBlending, depthWrite: false
        })
    );
    group.add(ringGlow);

    /* --- motes orbiting the aperture --- */
    const ORB = isMobile() ? 500 : 1200;
    const oGeo = new THREE.BufferGeometry();
    const oPos = new Float32Array(ORB * 3);
    const oSize = new Float32Array(ORB);
    const oPhase = new Float32Array(ORB);
    const oRad = new Float32Array(ORB);
    for (let i = 0; i < ORB; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = radius * (0.94 + Math.random() * 0.22);
        oRad[i] = rr;
        oPhase[i] = a;
        oPos[i * 3 + 0] = Math.cos(a) * rr;
        oPos[i * 3 + 1] = Math.sin(a) * rr;
        oPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        oSize[i] = 1.2 + Math.random() * 3.4;
    }
    oGeo.setAttribute('position', new THREE.BufferAttribute(oPos, 3));
    oGeo.setAttribute('aSize', new THREE.BufferAttribute(oSize, 1));
    oGeo.setAttribute('aPhase', new THREE.BufferAttribute(oPhase, 1));
    oGeo.setAttribute('aRad', new THREE.BufferAttribute(oRad, 1));

    const orbMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
            uTime: { value: 0 },
            uPR: { value: Math.min(window.devicePixelRatio || 1, 2) },
            uMap: { value: dotTexture() },
            uColA: { value: new THREE.Color(0x2fd4d9) },
            uColB: { value: new THREE.Color(0x7c5cff) }
        },
        vertexShader: /* glsl */`
            attribute float aSize;
            attribute float aPhase;
            attribute float aRad;
            uniform float uTime;
            uniform float uPR;
            varying float vMix;
            void main(){
                float a = aPhase + uTime * (0.22 + aRad * 0.03);
                vec3 p = vec3(cos(a) * aRad, sin(a) * aRad, position.z + sin(uTime + aPhase) * 0.16);
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_Position = projectionMatrix * mv;
                vMix = 0.5 + 0.5 * sin(a * 2.0);
                gl_PointSize = aSize * uPR * (150.0 / max(-mv.z, 0.001));
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uMap;
            uniform vec3 uColA;
            uniform vec3 uColB;
            varying float vMix;
            void main(){
                vec4 t = texture2D(uMap, gl_PointCoord);
                if (t.a < 0.01) discard;
                gl_FragColor = vec4(mix(uColA, uColB, vMix), t.a * 0.9);
            }
        `
    });
    const orbits = new THREE.Points(oGeo, orbMat);
    orbits.frustumCulled = false;
    group.add(orbits);

    group.userData = { discMat, ringMat, ringGlow, orbMat, ring, disc };
    return group;
}

/* ------------------------------------------------------------
   COSMIC CARD — image plate with rounded corners + rim glow
   ------------------------------------------------------------ */
export const CARD_VERT = /* glsl */`
    varying vec2 vUv;
    void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const CARD_FRAG = /* glsl */`
    uniform sampler2D uTex;
    uniform float uImgAspect;
    uniform float uCardAspect;
    uniform float uHover;     // 0..1
    uniform float uReveal;    // 0..1 fade-in
    uniform float uTime;
    uniform vec3  uAccent;
    varying vec2 vUv;

    // signed distance to a rounded box
    float sdRoundBox(vec2 p, vec2 b, float r){
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
    }

    // "cover" fit so plates never distort
    vec2 coverUV(vec2 uv, float imgA, float cardA){
        vec2 s = vec2(1.0);
        if (imgA > cardA) s.x = cardA / imgA;
        else              s.y = imgA / cardA;
        return (uv - 0.5) * s + 0.5;
    }

    void main(){
        vec2 p = (vUv - 0.5) * vec2(uCardAspect, 1.0);
        vec2 halfBox = vec2(uCardAspect, 1.0) * 0.5;
        float d = sdRoundBox(p, halfBox - 0.004, 0.075);

        float inside = 1.0 - smoothstep(-0.004, 0.002, d);
        if (inside < 0.01) discard;

        // gentle parallax on hover
        vec2 uv = coverUV(vUv, uImgAspect, uCardAspect);
        uv += (vUv - 0.5) * uHover * 0.035;
        vec3 col = texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;

        // lift contrast + warm the highlights slightly on hover
        col = mix(col * 0.72, col * 1.18, uHover);

        // inner vignette so text/labels sit well
        float vig = smoothstep(0.95, 0.25, length((vUv - 0.5) * vec2(uCardAspect, 1.0)));
        col *= 0.62 + 0.38 * vig;

        // scanning sheen
        float sheen = smoothstep(0.0, 0.12, abs(fract(vUv.x * 0.6 - uTime * 0.07) - 0.5));
        col += uAccent * (1.0 - sheen) * 0.05 * uHover;

        // rim glow hugging the rounded edge
        float rim = smoothstep(-0.045, -0.002, d);
        col += uAccent * rim * (0.28 + uHover * 1.05);

        float alpha = inside * uReveal;
        gl_FragColor = vec4(col, alpha);
    }
`;

/**
 * Build a cosmic card mesh.
 * @returns {THREE.Mesh} plane with userData.mat (ShaderMaterial)
 */
export function makeCard(texture, { width = 4.4, height = 2.9 } = {}) {
    const imgA = texture.image ? (texture.image.width / texture.image.height) : 1.5;
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        uniforms: {
            uTex: { value: texture },
            uImgAspect: { value: imgA },
            uCardAspect: { value: width / height },
            uHover: { value: 0 },
            uReveal: { value: 0 },
            uTime: { value: 0 },
            uAccent: { value: new THREE.Color(0x2fd4d9) }
        },
        vertexShader: CARD_VERT,
        fragmentShader: CARD_FRAG
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height, 1, 1), mat);
    mesh.userData.mat = mat;
    return mesh;
}

/* ------------------------------------------------------------
   CUSTOM CURSOR
   ------------------------------------------------------------ */
export class Cursor {
    constructor() {
        this.dot = document.querySelector('.cur-dot');
        this.ring = document.querySelector('.cur-ring');
        this.x = window.innerWidth / 2;
        this.y = window.innerHeight / 2;
        this.rx = this.x;
        this.ry = this.y;
        this.enabled = !!(this.dot && this.ring) &&
            !window.matchMedia('(pointer: coarse)').matches;

        if (this.enabled) {
            window.addEventListener('pointermove', (e) => {
                this.x = e.clientX;
                this.y = e.clientY;
            }, { passive: true });
        }
    }
    hot(on) {
        if (this.enabled) this.ring.classList.toggle('hot', !!on);
    }
    update(dt) {
        if (!this.enabled) return;
        this.rx = damp(this.rx, this.x, 14, dt);
        this.ry = damp(this.ry, this.y, 14, dt);
        this.dot.style.transform = `translate(${this.x}px, ${this.y}px)`;
        this.ring.style.transform = `translate(${this.rx}px, ${this.ry}px)`;
    }
}

/* ------------------------------------------------------------
   POINTER (normalised -1..1, damped) — drives parallax + raycasts
   ------------------------------------------------------------ */
export class Pointer {
    constructor(el = window) {
        this.nx = 0; this.ny = 0;   // raw, -1..1
        this.sx = 0; this.sy = 0;   // smoothed
        this.down = false;
        el.addEventListener('pointermove', (e) => {
            this.nx = (e.clientX / window.innerWidth) * 2 - 1;
            this.ny = -((e.clientY / window.innerHeight) * 2 - 1);
        }, { passive: true });
        el.addEventListener('pointerdown', () => (this.down = true));
        el.addEventListener('pointerup', () => (this.down = false));
        el.addEventListener('pointerleave', () => { this.nx = 0; this.ny = 0; });
    }
    update(dt) {
        this.sx = damp(this.sx, this.nx, 6, dt);
        this.sy = damp(this.sy, this.ny, 6, dt);
    }
}

/* ------------------------------------------------------------
   LOADER UI
   ------------------------------------------------------------ */
export function bindLoader(manager) {
    const el = document.getElementById('loader');
    if (!el) return () => { };
    const bar = el.querySelector('.bar span');
    const pct = el.querySelector('.pct');
    let shown = 0;

    manager.onProgress = (_url, loaded, total) => {
        const v = total ? Math.round((loaded / total) * 100) : 0;
        shown = Math.max(shown, v);
        if (bar) bar.style.width = shown + '%';
        if (pct) pct.textContent = String(shown).padStart(3, '0') + '%';
    };

    return () => {
        if (bar) bar.style.width = '100%';
        if (pct) pct.textContent = '100%';
        setTimeout(() => el.classList.add('done'), 320);
    };
}

/* ------------------------------------------------------------
   RESIZE
   ------------------------------------------------------------ */
export function onResize(renderer, camera, composer) {
    const fit = () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
        if (composer) composer.setSize(w, h);
    };
    window.addEventListener('resize', fit);
    fit();
    return fit;
}
