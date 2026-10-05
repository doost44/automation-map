# Automation Map

A first-person 3D map of the automated systems in my daily life (feeds, recommendations, pricing, autocomplete, AI tools), built from a two-week field log. Early-2000s PC shooter look, plain JavaScript + Three.js, no build step.

**Live:** https://doost44.github.io/automation-map/

## Run locally

Any static server works:

```
python3 -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` directly from disk won't load `data/log.json`.)

## Controls

| Key | Action |
| --- | --- |
| Click | Enter (locks the mouse) |
| WASD / mouse | Walk and look |
| Click on an orb | Grab it; click again to let go. It starts orbiting from where you left it. Swipe the mouse as you let go to throw it; orbs bounce off each other |
| Mouse wheel (while holding) | Pull the orb closer or push it away |
| Right click or G (near a rock) | Pick up any rock or pebble; right click or G again throws it at the crosshair. Hit an orb to knock it away, hit a panel to crack its screen. Rocks thrown off the island are gone until you reload |
| F, → or swipe right (while holding) | Bring the orb's panel to the middle of the screen to read it; F, ← or swipe left goes back |
| O | Options: field of view (60–110), mouse sensitivity, pixel size, fullscreen, HUD on/off, screen shake on/off (saved in your browser) |
| C | Toggle the overview camera |
| P | Save a 1600×1200 `automation-map.png` |
| Esc | Release the mouse |

You can walk off the edge: you fall through the void, then come back down onto the island from the sky. Throw every rock off and see what happens.

For the submission still: press **C**, then **P**.

## Editing the data

Everything comes from `data/log.json`. Each entry in `systems`:

| Field | Meaning | Drives |
| --- | --- | --- |
| `id` | short unique id | used by `feedsInto` |
| `name` | display name | panel header, HUD |
| `logo` | `youtube`, `netflix`, `spotify`, `instagram`, `google`, `keycap`, `uber`, `gmail`, `maps-pin`, `ai-spark` (anything else gets a plain faceted planet) | the 3D logo at the centre of the orb |
| `category` | `feed`, `recommendation`, `pricing`, `moderation`, `autocomplete`, `ai-tool`, `navigation`, `other` | orb colour |
| `control` | `chosen-for-me`, `chosen-by-me`, `delegated` | orbit distance and speed |
| `timesPerDay` | how often it acted | orb size |
| `minutesPerDay` | time it shaped | orb glow |
| `whatFor` | what I used it for | panel |
| `response` | `{ wentAlong, pushedBack, noticed }` counts over the log | panel bar |
| `keptForMyself` | what I still decide myself | panel |
| `feedsInto` | ids of systems it feeds | connecting lines |
| `words` | words that orbit the orb | word rings |
| `notes` | one standout log moment | panel |

Remove `"placeholder": true` once the real log is in.
