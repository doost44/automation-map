const $ = (id) => document.getElementById(id);

export function setSubtitle(data) {
  const extra = data.placeholder ? 'placeholder data' : `${data.systems.length} apps`;
  $('subtitle').textContent = `${data.owner} · ${data.logDays}-day field log · ${extra}`;
}

export function totals(systems) {
  return {
    decisions: Math.round(systems.reduce((s, x) => s + (x.timesPerDay || 0), 0)),
    minutes: Math.round(systems.reduce((s, x) => s + (x.minutesPerDay || 0), 0)),
  };
}

// The logged screen time without its explanation in brackets, e.g. '~10.5–13 h/day'.
export const screenTime = (data) => data.summary?.screenTime?.replace(/\s*\(.*\)\s*$/, '') ?? null;

export function showTotals(data) {
  const t = totals(data.systems);
  const logged = screenTime(data);
  $('totals').innerHTML =
    `<b>${t.decisions}</b> automated decisions / day<br>` +
    `<b>${t.minutes}</b> minutes / day shaped by automation` +
    (logged ? `<br><b>${logged}</b> logged` : '');
}

export function showTarget(orb, held) {
  const el = $('target');
  if (!orb) {
    document.body.classList.remove('reading');
    return el.classList.add('hidden');
  }
  el.classList.remove('hidden');
  document.body.classList.toggle('reading', !!orb.reading);
  if (orb.reading) el.textContent = `READING: ${orb.system.name} · F / SWIPE LEFT FOR ORB · CLICK TO RELEASE`;
  else if (held) el.textContent = `HOLDING: ${orb.system.name} · WHEEL TO PULL · F / SWIPE RIGHT TO READ · CLICK TO RELEASE`;
  else el.textContent = orb.system.name;
}

// The panel being read, as a sharp 2D copy over the 3D view (null hides it).
export function showReader(panelCanvas) {
  const el = $('reader');
  if (panelCanvas && el.firstChild !== panelCanvas) el.replaceChildren(panelCanvas);
  el.classList.toggle('on', !!panelCanvas);
}

// Small prompt in the lower right. Several things can ask for it (rocks, the chair),
// so each has its own slot and the first one with something to say wins.
const hints = {};
export function showHint(text, slot = 'rock') {
  hints[slot] = text;
  const shown = Object.values(hints).find(Boolean);
  const el = $('hint');
  el.classList.toggle('hidden', !shown);
  if (shown) el.textContent = shown;
}

export function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
