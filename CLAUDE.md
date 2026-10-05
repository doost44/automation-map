# Automation Map

A first-person 3D map of the automated systems in Charlie's daily life, for a design class. Built from a two-week field log of every time a system decided, suggested, sorted, priced, filtered or completed something.

## Stack (do not change)
- Plain JavaScript ES modules + Three.js 0.160.0 from jsDelivr via an import map in `index.html`. Assets: only `assets/audio/bassline.m4a`; everything else is generated in code.
- No bundler, no npm, no TypeScript, no frameworks. Runs from any static server and on GitHub Pages (relative paths only).
- `src/`: `main.js` (loop), `world.js`, `chair.js`, `orbs.js`, `panels.js`, `logos.js` (low-poly logo builders), `interaction.js`, `rocks.js`, `player.js` (walking, falling, respawn), `doom.js` (the all-rocks-gone event), `options.js`, `mouse.js` (filters bogus pointer-lock jumps), `sound.js` (all sound, synthesised with Web Audio, no files), `hud.js`, `capture.js`, `textures.js`. Data in `data/log.json`.

## Look
Early-2000s PC shooter (Half-Life 1 era), not realism.
- Low-poly geometry, flat shading. Textures painted on `<canvas>` at 64-256px with `NearestFilter`, no mipmaps.
- Renderer at half internal resolution, upscaled with `image-rendering: pixelated`, no antialiasing.
- One ambient + one directional light, Lambert/Basic materials, linear fog into a dusk gradient sky.
- HUD: blocky monospace, amber on translucent dark boxes, centre crosshair.

## Scene
- Player starts on a floating grass platform next to an old white metal folding chair with a red seat.
- Each system in the log is an orb: a spinning low-poly 3D version of its logo (picked by the `logo` field, built in `logos.js`: outlook, messages, chrome-gemini, claude, youtube, spotify, pinterest, marketplace, steam, fotmob, plus older unused ones; unknown names fall back to a category-coloured sphere), a small moon on a tilted orbit in the category colour, and rings of words. Logo size = times per day, glow = minutes per day, distance from the chair = how much control Charlie has (chosen-for-me orbs are far and fast). An invisible sphere (`orb.mesh`, at least 1.4 radius so tiny orbs stay clickable) is what aiming, grabbing and rock hits test against. Starting heights are nudged so no two orbs begin overlapping.
- Panels show: TIMES/DAY and MINUTES/DAY with the logged `usage` strings under them, CONTROL, WHAT FOR (`activity`), IT DECIDES (`decides`), GROUP, LOG (`notes`). Fields from the old schema (`whatFor`, `response`, `keptForMyself`) are still drawn if present. The HUD and photo show rounded totals plus `summary.screenTime`.
- Panels are 512x384 canvases with scanlines. In reading mode the same canvas is also shown as an HTML overlay exactly over the 3D panel, upscaled with `image-rendering: pixelated`: same chunky look, but not blurred by the half-res render and never covered by word rings.
- Each orb has a terminal-style panel with its usage. Lines connect systems listed in `feedsInto`.
- R (or RESET ORBITS in the options menu) releases anything held and sends every orb back to its original orbit (`resetOrbits` in orbs.js, using `orb.home` saved at load).
- Click grabs an orb, mouse wheel pulls it in or pushes it away, click again lets go. Orbs always orbit: on release (or when a loose orb slows down) a new orbit is taken from its current position (`settle` in orbs.js). Swiping while letting go throws it with its held velocity; loose orbs glide with drag, bounce off each other (collision spheres, heavier = bigger) and off soft walls. Rock hits use the same velocities. Reload restores the layout.
- While holding, F / right arrow / trackpad swipe right brings its panel to the middle of the view to read; F / left arrow / swipe left goes back.
- Right click or G picks up any rock or pebble on the platform (`rocks.js`) and throws it along the crosshair. Orbs get knocked back and flash; panels crack (cracks persist), shake and glitch. Rocks that leave the platform are gone until reload.
- Orbs are solid to the player (`player.js`): you can land on top of one and ride it (eye height follows its sphere top), walk off its edge, and walking or flying into one pushes you round it. Grabbing the orb you stand on drops you off it.
- E with the crosshair on the chair (within 3 units) sits you down: the camera eases onto the seat facing out; mouse look, grabbing, reading, rocks, C, P, R and O still work. E, WASD or Space stands you up in front of it. The chair is solid. The giant rock still knocks you off.
- Space jumps. Walking speed carries over when you step or jump off the edge, and WASD steers a little in the air (not while dropping back in, nor for 1.5 s after the giant rock knocks you).
- No edge clamp, no fades: walking or being knocked off the edge drops the player into the void; once fog hides everything they are moved the same distance above the island and keep falling, slowing to a soft landing with a knee dip (`player.js`). Panels ignore fog, so they fade out by distance instead.
- When every rock is gone (`doom.js`): sky goes black, a red aura grows overhead, a giant rock crashes onto the platform and knocks the player off. At the wrap (out of sight) rocks reset and the sky eases back to dusk during the descent.
- O (or the OPTIONS button on the start screen) opens `options.js`: FOV, mouse sensitivity, volume, mute, pixel ratio, fullscreen, HUD and screen shake. Fullscreen uses Keyboard Lock on Esc so a tap only frees the mouse (fallback: fullscreen is re-requested on the click back into the game).
- Sound (`sound.js`): starts on the click into the game. Effects are synthesised (oscillators + filtered noise): grass footsteps (rustle, crunch ticks, heel thump), jump scuff and whoosh, landing, chair creak, rock sounds, panel crack and static, giant-rock rumble/drone/whistle/boom. Orb sounds are a small two-oscillator synth with a shared echo, using only A-flat major pentatonic (Ab Bb C Eb F, the key of Charlie's ambient track). Each orb has its own voice (`VOICES` in sound.js: waveform, octave, note pattern, speed) used for aim, drop, collisions and chatter; grabbing swells a long ambient synth pad (chord, octave, brightness, detune and swell vary per orb) and a held orb drifts through slow overlapping pad notes. The falling wind is two wandering resonant noise bands (howl and whistle) over an airy rush, gusting via LFOs. The only audio file is `assets/audio/bassline.m4a` (Charlie's own bass line, cut from their track with ffmpeg), looped through a sweeping filter and an HRTF panner that circles the player as a musical wind. `updateSound` sets volume, moves the listener with the camera, drives the wind and plays faint orb chatter (busier for apps with more minutes per day).
- C = overview camera, P = export a 1600x1200 PNG.

## Data
Everything about specific systems comes from `data/log.json`; nothing is hard-coded in JS.

Keep modules short and readable for a student; comment only what is non-obvious.
