// Fixes for sudden view jolts under pointer lock.
//
// Browsers (Chrome on Windows especially) sometimes report one huge, bogus mouse
// movement, often right after the mouse locks. PointerLockControls turns the
// camera by whatever it is given, so the view snaps somewhere else.

const SETTLE_MS = 100; // ignore movement for this long after locking
const MAX_STEP = 250; // pixels in one event; real flicks stay well under this

export function steadyMouse(controls) {
  // 1. Ask for raw mouse input where supported: no OS acceleration, and it avoids
  //    the browser bug. Fall back to a normal lock where it isn't supported.
  controls.lock = () => {
    const el = controls.domElement;
    const request = el.requestPointerLock({ unadjustedMovement: true });
    request?.catch?.(() => el.requestPointerLock()?.catch?.(() => {})); // PointerLockControls reports failures itself
  };

  // 2. Drop impossible jumps before PointerLockControls sees them (capture phase
  //    on window runs before its listener on the document).
  let lockedAt = 0;
  document.addEventListener('pointerlockchange', () => { lockedAt = performance.now(); });
  addEventListener('mousemove', (e) => {
    if (!document.pointerLockElement) return;
    const tooSoon = performance.now() - lockedAt < SETTLE_MS;
    const tooBig = Math.abs(e.movementX) > MAX_STEP || Math.abs(e.movementY) > MAX_STEP;
    if (tooSoon || tooBig) e.stopImmediatePropagation();
  }, { capture: true });
}
