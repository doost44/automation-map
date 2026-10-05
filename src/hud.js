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

export function showError(msg) {
  const el = $('error');
  el.textContent = msg;
  el.classList.remove('hidden');
}
