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
| WASD / mouse | Walk and look (you can also steer a little in the air) |
| E (crosshair on the chair) | Sit in the chair; E, WASD or Space stands you up |
| Space | Jump. Orbs are solid: you can land on top of one and ride it as it orbits |
| Click on an orb | Grab it; click again to let go. It starts orbiting from where you left it. Swipe the mouse as you let go to throw it; orbs bounce off each other |
| Mouse wheel (while holding) | Pull the orb closer or push it away |
| Right click or G (near a rock) | Pick up any rock or pebble; right click or G again throws it at the crosshair. Hit an orb to knock it away, hit a panel to crack its screen. Rocks thrown off the island are gone until you reload |
| F, → or swipe right (while holding) | Bring the orb's panel to the middle of the screen to read it; F, ← or swipe left goes back |
| O | Options: field of view (60–110), mouse sensitivity, volume, music volume (the bass-line wind) and mute, pixel size, fullscreen, HUD on/off, screen shake on/off (saved in your browser). In fullscreen (from this menu), a tap of Esc frees the mouse without leaving fullscreen; hold Esc to leave it |
| R | Reset orbits: every orb glides back to its original, evenly spaced orbit (also a button in the options menu) |
| C | Toggle the overview camera |
| P | Save a 1600×1200 `automation-map.png` |
| Esc | Release the mouse |

You can walk off the edge: you fall through the void, then come back down onto the island from the sky. Throw every rock off and see what happens.

For the submission still: press **C**, then **P**.

## Editing the data

Everything comes from `data/log.json`. Top level: `owner`, `logDays`, and `summary` (the log's own summary: `screenTime`, `highFrequency`, `highDuration`; `screenTime` shows in the HUD totals and the photo). Each entry in `systems`:

| Field | Meaning | Drives |
| --- | --- | --- |
| `id` | short unique id | used by `feedsInto` |
| `name` | display name | panel header, HUD |
| `group` | the section of the log it was listed under | panel (GROUP) |
| `logo` | `outlook`, `messages`, `chrome-gemini`, `claude`, `youtube`, `spotify`, `pinterest`, `marketplace`, `steam`, `fotmob` (older ones still available: `netflix`, `instagram`, `google`, `keycap`, `uber`, `gmail`, `maps-pin`; anything else gets a plain faceted planet) | the 3D logo at the centre of the orb |
| `category` | `feed`, `recommendation`, `pricing` (store promos and listings), `moderation`, `autocomplete`, `search`, `notification`, `ai-tool`, `navigation`, `other` | orb colour, photo legend |
| `control` | `chosen-for-me`, `chosen-by-me`, `delegated` | orbit distance and speed |
| `timesPerDay` | how often it acted (a number; ranges use the midpoint) | orb size, totals |
| `minutesPerDay` | time it shaped (a number) | orb glow, totals |
| `usage` | `{ frequency, duration }` exactly as logged, e.g. `"2–3 sessions/week"` | panel, under the big numbers |
| `activity` | what I use it for, verbatim from the log | panel (WHAT FOR) |
| `decides` | what the system decides for me | panel (IT DECIDES) |
| `feedsInto` | ids of systems it feeds | connecting lines |
| `words` | words that orbit the orb | word rings |
| `notes` | one standout log moment (may be empty) | panel (LOG) |

Optional older fields still work if present: `whatFor` (instead of `activity`), `response` (`{ wentAlong, pushedBack, noticed }`, drawn as a bar when there is no `decides`), `keptForMyself` (shown instead of GROUP), and top-level `"placeholder": true` (flags the subtitle).
