// Options menu: O (or the OPTIONS button on the start screen) opens it.
// Settings are remembered in this browser via localStorage.

const KEY = 'automation-map-options';
const DEFAULTS = { fov: 70, sensitivity: 1, pixel: 0.5, hud: true, shake: true };

// Other modules read this (e.g. doom.js checks settings.shake).
export const settings = { ...DEFAULTS };

const PIXEL_SIZES = [
  [0.25, 'CHUNKY'],
  [0.5, 'RETRO (DEFAULT)'],
  [0.75, 'SOFT'],
  [1, 'SHARP'],
];

function load() {
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) ?? {});
  } catch { /* storage blocked or bad JSON: keep defaults */ }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function createOptions({ renderer, camera, controls, onOpen, onClose }) {
  const menu = document.getElementById('options');
  const $ = (id) => document.getElementById(id);
  const ui = {
    fov: $('opt-fov'), fovVal: $('opt-fov-val'),
    sens: $('opt-sens'), sensVal: $('opt-sens-val'),
    pixel: $('opt-pixel'),
    hud: $('opt-hud'), shake: $('opt-shake'),
    full: $('opt-full'),
  };
  for (const [v, name] of PIXEL_SIZES) ui.pixel.add(new Option(name, v));

  function apply() {
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    controls.pointerSpeed = settings.sensitivity;
    renderer.setPixelRatio(settings.pixel);
    renderer.setSize(innerWidth, innerHeight, false);
    document.body.classList.toggle('no-hud', !settings.hud);

    ui.fov.value = settings.fov;
    ui.fovVal.textContent = settings.fov;
    ui.sens.value = settings.sensitivity;
    ui.sensVal.textContent = Number(settings.sensitivity).toFixed(1);
    ui.pixel.value = settings.pixel;
    ui.hud.checked = settings.hud;
    ui.shake.checked = settings.shake;
    ui.full.textContent = document.fullscreenElement ? 'EXIT FULLSCREEN' : 'GO FULLSCREEN';
    save();
  }

  ui.fov.addEventListener('input', () => { settings.fov = Number(ui.fov.value); apply(); });
  ui.sens.addEventListener('input', () => { settings.sensitivity = Number(ui.sens.value); apply(); });
  ui.pixel.addEventListener('change', () => { settings.pixel = Number(ui.pixel.value); apply(); });
  ui.hud.addEventListener('change', () => { settings.hud = ui.hud.checked; apply(); });
  ui.shake.addEventListener('change', () => { settings.shake = ui.shake.checked; apply(); });
  $('opt-reset').addEventListener('click', () => { Object.assign(settings, DEFAULTS); apply(); });

  ui.full.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  document.addEventListener('fullscreenchange', apply);

  const options = {
    isOpen: false,
    open() {
      options.isOpen = true;
      menu.classList.remove('hidden');
      onOpen?.();
      controls.unlock();
    },
    close() {
      options.isOpen = false;
      menu.classList.add('hidden');
      onClose?.();
    },
  };
  $('opt-close').addEventListener('click', options.close);

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && options.isOpen) options.close();
    if (e.code !== 'KeyO') return;
    if (options.isOpen) options.close();
    else options.open();
  });

  load();
  apply();
  return options;
}
