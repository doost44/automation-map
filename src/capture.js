import { CATEGORY_COLORS } from './orbs.js';
import { totals, screenTime } from './hud.js';

export const PHOTO_W = 1600, PHOTO_H = 1200;

// Render one 4:3 frame at half resolution, upscale it to 1600x1200 with
// nearest-neighbour (same chunky look), draw the title and legend, download.
export function capturePNG({ renderer, scene, camera, data, beforeRender }) {
  const prevPR = renderer.getPixelRatio();
  const prevW = renderer.domElement.clientWidth;
  const prevH = renderer.domElement.clientHeight;
  const prevAspect = camera.aspect;

  renderer.setPixelRatio(1);
  renderer.setSize(PHOTO_W / 2, PHOTO_H / 2, false);
  camera.aspect = PHOTO_W / PHOTO_H;
  camera.updateProjectionMatrix();
  beforeRender?.();
  renderer.render(scene, camera);

  const out = document.createElement('canvas');
  out.width = PHOTO_W;
  out.height = PHOTO_H;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(renderer.domElement, 0, 0, PHOTO_W, PHOTO_H);
  drawOverlay(g, data);

  renderer.setPixelRatio(prevPR);
  renderer.setSize(prevW, prevH, false);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();

  out.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'automation-map.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
  return out;
}

const AMBER = '#ffb43c', WHITE = '#f2ecd8';

function box(g, x, y, w, h) {
  g.fillStyle = 'rgba(10,10,8,0.68)';
  g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,180,60,0.45)';
  g.lineWidth = 3;
  g.strokeRect(x, y, w, h);
}

function text(g, s, x, y, size, color = AMBER) {
  g.font = `bold ${size}px "Courier New", monospace`;
  g.fillStyle = '#000';
  g.fillText(s, x + 3, y + 3);
  g.fillStyle = color;
  g.fillText(s, x, y);
}

function drawOverlay(g, data) {
  const t = totals(data.systems);
  const logged = screenTime(data);

  // Title block.
  box(g, 40, 40, 620, logged ? 182 : 150);
  text(g, 'AUTOMATION MAP', 64, 104, 54);
  text(g, `${data.owner.toUpperCase()} · ${data.logDays}-DAY FIELD LOG · ${data.systems.length} APPS`, 66, 142, 22, WHITE);
  text(g, `${t.decisions} DECISIONS/DAY · ${t.minutes} MIN/DAY`, 66, 172, 22, WHITE);
  if (logged) text(g, `${logged.toUpperCase()} SCREEN TIME LOGGED`, 66, 204, 22, WHITE);

  // Legend.
  const cats = [...new Set(data.systems.map((s) => s.category))];
  const lx = PHOTO_W - 520, ly = PHOTO_H - 80 - 34 * (cats.length + 4) - 40;
  box(g, lx, ly, 480, PHOTO_H - 40 - ly);
  let y = ly + 44;
  text(g, 'LEGEND', lx + 22, y, 26);
  y += 38;
  for (const c of cats) {
    g.fillStyle = '#' + (CATEGORY_COLORS[c] ?? CATEGORY_COLORS.other).toString(16).padStart(6, '0');
    g.fillRect(lx + 24, y - 18, 22, 22);
    text(g, c.toUpperCase(), lx + 60, y, 20, WHITE);
    y += 34;
  }
  for (const line of [
    'ORB SIZE = TIMES PER DAY',
    'GLOW = MINUTES PER DAY',
    'DISTANCE FROM CHAIR = LESS CONTROL',
    'LINES = WHAT FEEDS INTO WHAT',
  ]) {
    text(g, line, lx + 24, y, 18, WHITE);
    y += 34;
  }
}
