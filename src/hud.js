const $ = (id) => document.getElementById(id);

export function setSubtitle(data) {
  $('subtitle').textContent = `${data.owner} · ${data.logDays}-day field log${data.placeholder ? ' · placeholder data' : ''}`;
}

export function totals(systems) {
  return {
    decisions: systems.reduce((s, x) => s + (x.timesPerDay || 0), 0),
    minutes: systems.reduce((s, x) => s + (x.minutesPerDay || 0), 0),
  };
}

export function showTotals(systems) {
  const t = totals(systems);
  $('totals').innerHTML =
    `<b>${t.decisions}</b> automated decisions / day<br>` +
    `<b>${t.minutes}</b> minutes / day shaped by automation`;
}

export function showTarget(orb, held) {
  const el = $('target');
  if (!orb) return el.classList.add('hidden');
  el.classList.remove('hidden');
  el.textContent = held ? `HOLDING: ${orb.system.name} · WHEEL TO PULL · CLICK TO RELEASE` : orb.system.name;
}

export function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
