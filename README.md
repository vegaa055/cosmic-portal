# James Observatory — Immersive

A WebGL/Three.js companion to the standard James Observatory site. Same brand,
same plates, same copy — rendered as a live 3D scene instead of a page.

The standard site at `../index.html` is untouched and remains the primary
experience. Everything in this folder is additive.

---

## The two experiences

| Page | What it is |
|---|---|
| `index.html` — **The Aperture** | A scroll-driven journey. You approach a shader-driven portal, pass through it, drift past the plate archive, and arrive at a second aperture. Four narrative "acts" fade in and out along the way. |
| `gallery.html` — **Orbit** | The plate archive as a ring you spin. Drag to rotate, wheel to zoom, hover to lift a plate, click to inspect. Snaps to the nearest plate when you let go. |

Both link back to the standard site from the HUD.

---

## Running it

**These pages must be served over HTTP.** They use ES modules and an import
map, which browsers refuse to load from `file://`. Opening the HTML by
double-clicking will show a blank screen.

From the `james-observatory` folder:

```bash
python -m http.server 8123
```

Then open <http://localhost:8123/immersive/index.html>.

Any static server works equally well — `npx serve`, `php -S`, Live Server, etc.

An internet connection is required on first load: Three.js is pulled from
jsDelivr via the import map, and the fonts from Google Fonts. To go fully
offline, vendor `three.module.js` + `examples/jsm/postprocessing/*` locally and
repoint the import map in both HTML files.

---

## What's actually being rendered

Everything is generated in-shader — no 3D models, no texture files beyond the
observatory's own plates.

- **The portal** — a `CircleGeometry` running a custom fragment shader: polar
  swirl, 5-octave fBm value noise, and one of the real plates sampled through
  the distortion. An additive torus rim and ~1,200 orbiting motes sit on top.
  It blooms, tilts toward the cursor, and opens up as you scroll toward it.
- **Starfield** — ~7,000 GPU points on a spherical shell, each with its own
  size, phase and twinkle; a small fraction are warm-tinted.
- **Nebula dust** — ~950 large additive motes drifting on sine offsets, tinted
  across the brand teal → violet → coral.
- **Warp tunnel** — a cylindrical shell of ~2,800 motes whose point size and
  opacity spike while you transit the portal.
- **Plate cards** — planes with a rounded-box SDF for the corners, a `cover`
  UV fit so images never distort, a rim glow that intensifies on hover, and a
  parallax shift under the cursor.
- **Post** — `UnrealBloom` at a 0.55 threshold, then `OutputPass` for ACES tone
  mapping and sRGB.

---

## Structure

```
immersive/
├── index.html        The Aperture (scroll journey)
├── gallery.html      Orbit (spinnable ring)
├── css/
│   └── immersive.css Shared chrome: HUD, loader, cursor, focus panel
└── js/
    ├── lib.js        Shared toolkit — renderer, particle systems, portal,
    │                 cards, cursor, pointer, loader, resize, GLSL noise
    ├── portal.js     The Aperture scene + camera path + act sequencing
    └── gallery.js    Orbit scene + spin physics + snapping
```

The plate list (image, title, blurb, metadata) lives at the top of `portal.js`
and `gallery.js` as a `PLATES` array. Edit that to change what's on show.

---

## Interaction

| | Aperture | Orbit |
|---|---|---|
| Move through | Scroll | Drag horizontally |
| Inspect a plate | Click it | Click it |
| Close the inspector | `Esc` / click outside | `Esc` / click outside |
| Step between plates | — | `←` `→` or the dots |
| Zoom | — | Mouse wheel |

---

## Performance & accessibility

- Pixel ratio capped at 2 (1.5 on mobile); particle counts drop ~50% on small
  or coarse-pointer devices; antialiasing off on mobile.
- The render loop pauses on `visibilitychange`, so a backgrounded tab costs
  nothing.
- `prefers-reduced-motion` slows all scene animation to 25%.
- The custom cursor and keyboard hints hide on touch devices.
- If WebGL is unavailable the scene is skipped entirely and a fallback panel
  points at the standard site.
- A 9-second failsafe dismisses the loading screen even if an image stalls.

---

## Known notes

- **Exposure metadata is illustrative.** Instrument names, exposure counts and
  filters in the plate inspector are plausible placeholders written to match
  the fictional CyberApolis observatory. The object names and distances
  (Eagle ~7,000 ly, Carina ~7,500 ly, Centaurus A ~13 Mly, LMC ~160,000 ly)
  are real. Swap in genuine capture data before any public use.
- Three.js is pinned to `0.169.0` in both import maps. Bump both together.
