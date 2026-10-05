# Automation Map

A first-person 3D map of the automated systems in Charlie's daily life, for a design class. Built from a two-week field log of every time a system decided, suggested, sorted, priced, filtered or completed something.

## Stack (do not change)
- Plain JavaScript ES modules + Three.js 0.160.0 from jsDelivr via an import map in `index.html`.
- No bundler, no npm, no TypeScript, no frameworks. Runs from any static server and on GitHub Pages (relative paths only).
- `src/`: `main.js` (loop), `world.js`, `chair.js`, `orbs.js`, `panels.js`, `logos.js` (low-poly logo builders), `interaction.js`, `rocks.js`, `player.js` (walking, falling, respawn), `doom.js` (the all-rocks-gone event), `options.js`, `hud.js`, `capture.js`, `textures.js`. Data in `data/log.json`.

## Look
Early-2000s PC shooter (Half-Life 1 era), not realism.
- Low-poly geometry, flat shading. Textures painted on `<canvas>` at 64-256px with `NearestFilter`, no mipmaps.
- Renderer at half internal resolution, upscaled with `image-rendering: pixelated`, no antialiasing.
- One ambient + one directional light, Lambert/Basic materials, linear fog into a dusk gradient sky.
- HUD: blocky monospace, amber on translucent dark boxes, centre crosshair.

## Scene
- Player starts on a floating grass platform next to an old white metal folding chair with a red seat.
- Each system in the log is an orb: a spinning low-poly 3D version of its logo (picked by the `logo` field, built in `logos.js`), a small moon on a tilted orbit in the category colour, and rings of words. Logo size = times per day, glow = minutes per day, distance from the chair = how much control Charlie has (chosen-for-me orbs are far and fast). An invisible sphere (`orb.mesh`) is what aiming, grabbing and rock hits test against.
- Panels are 512x384 canvases with scanlines. In reading mode the same canvas is also shown as an HTML overlay exactly over the 3D panel, upscaled with `image-rendering: pixelated`: same chunky look, but not blurred by the half-res render and never covered by word rings.
- Each orb has a terminal-style panel with its usage. Lines connect systems listed in `feedsInto`.
- Click grabs an orb, mouse wheel pulls it in or pushes it away, click again lets go. Orbs always orbit: on release (or when a loose orb slows down) a new orbit is taken from its current position (`settle` in orbs.js). Swiping while letting go throws it with its held velocity; loose orbs glide with drag, bounce off each other (collision spheres, heavier = bigger) and off soft walls. Rock hits use the same velocities. Reload restores the layout.
- While holding, F / right arrow / trackpad swipe right brings its panel to the middle of the view to read; F / left arrow / swipe left goes back.
- Right click or G picks up any rock or pebble on the platform (`rocks.js`) and throws it along the crosshair. Orbs get knocked back and flash; panels crack (cracks persist), shake and glitch. Rocks that leave the platform are gone until reload.
- No edge clamp, no fades: walking or being knocked off the edge drops the player into the void; once fog hides everything they are moved the same distance above the island and keep falling, slowing to a soft landing with a knee dip (`player.js`). Panels ignore fog, so they fade out by distance instead.
- When every rock is gone (`doom.js`): sky goes black, a red aura grows overhead, a giant rock crashes onto the platform and knocks the player off. At the wrap (out of sight) rocks reset and the sky eases back to dusk during the descent.
- O (or the OPTIONS button on the start screen) opens `options.js`: FOV, mouse sensitivity, pixel ratio, fullscreen, HUD and screen shake. Saved to localStorage; other modules read the exported `settings`.
- C = overview camera, P = export a 1600x1200 PNG.

## Data
Everything about specific systems comes from `data/log.json`; nothing is hard-coded in JS.

Keep modules short and readable for a student; comment only what is non-obvious.
