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
| Click on an orb | Grab it; click again to release |
| Mouse wheel (while holding) | Pull the orb closer or push it away |
| F, → or swipe right (while holding) | Bring the orb's panel to the middle of the screen to read it; F, ← or swipe left goes back |
| C | Toggle the overview camera |
| P | Save a 1600×1200 `automation-map.png` |
| Esc | Release the mouse |

For the submission still: press **C**, then **P**.

## Editing the data

Everything comes from `data/log.json`. Each entry in `systems`:

| Field | Meaning | Drives |
| --- | --- | --- |
| `id` | short unique id | used by `feedsInto` |
| `name` | display name | panel header, HUD |
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
