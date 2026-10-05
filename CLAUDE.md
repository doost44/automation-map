# Automation Map

A first-person 3D map of the automated systems in Charlie's daily life, for a design class. Built from a two-week field log of every time a system decided, suggested, sorted, priced, filtered or completed something.

## Stack (do not change)
- Plain JavaScript ES modules + Three.js 0.160.0 from jsDelivr via an import map in `index.html`.
- No bundler, no npm, no TypeScript, no frameworks. Runs from any static server and on GitHub Pages (relative paths only).
- `src/`: `main.js` (loop), `world.js`, `chair.js`, `orbs.js`, `panels.js`, `interaction.js`, `hud.js`, `capture.js`, `textures.js`. Data in `data/log.json`.

## Look
Early-2000s PC shooter (Half-Life 1 era), not realism.
- Low-poly geometry, flat shading. Textures painted on `<canvas>` at 64-256px with `NearestFilter`, no mipmaps.
- Renderer at half internal resolution, upscaled with `image-rendering: pixelated`, no antialiasing.
- One ambient + one directional light, Lambert/Basic materials, linear fog into a dusk gradient sky.
- HUD: blocky monospace, amber on translucent dark boxes, centre crosshair.

## Scene
- Player starts on a floating grass platform next to an old white metal folding chair with a red seat.
- Each system in the log is an orb with rings of words. Orb size = times per day, glow = minutes per day, distance from the chair = how much control Charlie has (chosen-for-me orbs are far and fast).
- Each orb has a terminal-style panel with its usage. Lines connect systems listed in `feedsInto`.
- Click grabs an orb, mouse wheel pulls it in or pushes it away, click again releases.
- While holding, F / right arrow / trackpad swipe right brings its panel to the middle of the view to read; F / left arrow / swipe left goes back.
- C = overview camera, P = export a 1600x1200 PNG.

## Data
Everything about specific systems comes from `data/log.json`; nothing is hard-coded in JS.

Keep modules short and readable for a student; comment only what is non-obvious.
