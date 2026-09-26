/* ===== APP WIRING ===== */
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o === undefined || o === null ? undefined : o[/^\d+$/.test(k) ? +k : k]), obj);
}
function setPath(obj, path, val) {
  const parts = path.split('.').map(k => (/^\d+$/.test(k) ? +k : k));
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.display = 'none'; }, 2600);
}

function applyTheme() {
  const t = S.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

function renderSync() {
  const local = S.mode === 'local';
  const txt = local ? 'This device only' : S.sync === 'saving' ? 'Saving\u2026' : S.sync === 'error' ? 'Not saved yet, retrying' : 'Synced';
  const cls = local ? (S.sync === 'error' ? 'error' : 'local') : S.sync;
  $$('[data-sync]').forEach(el => { el.className = 'sync ' + cls; el.innerHTML = '<i></i>' + txt; });
}

let retryTimer = null;
store.onSync = () => {
  renderSync();
  if (S.sync === 'error' && !retryTimer) {
    retryTimer = setTimeout(() => { retryTimer = null; flushAll(); }, 6000);
  }
};

function renderNav() {
  const items = [['day', 'Today'], ['week', 'Week'], ['month', 'Month'], ['settings', 'Settings']];
  $('#nav').innerHTML = '<div class="brand">Daily tracker</div>' + items.map(([k, l]) =>
    '<button type="button" data-nav="' + k + '"' + (S.view === k ? ' aria-current="page"' : '') + '>' + ICON[k === 'settings' ? 'settings' : k] + '<span>' + l + '</span></button>').join('');
}

function render(keepScroll) {
  const y = keepScroll ? window.scrollY : 0;
  renderNav();
  if (!S.ready) return;
  if (S.view === 'day') renderDay();
  else if (S.view === 'week') renderWeek();
  else if (S.view === 'month') renderMonth();
  else renderSettings();
  window.scrollTo(0, y);
}

function isTyping() {
  const a = document.activeElement;
  return !!(a && a !== document.body && $('#view').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}

store.onExternal = ids => {
  if (S.view === 'day') {
    if (!ids.includes(S.date)) return;
    if (isTyping()) { S.deferRender = true; return; }
    render(true);
  } else if (S.view === 'week' || S.view === 'month') render(true);
};
store.onSettingsExternal = () => { applyTheme(); render(true); };

function afterEdit() {
  touchDay(S.date);
  updateDerived();
}

function readVal(t) {
  if (t.type === 'number') return t.value === '' ? '' : Math.max(0, Number(t.value));
  return t.value;
}

function onInput(e) {
  const t = e.target;
  if (S.view === 'settings') {
    if (t.id === 'restore' && t.files && t.files[0]) { restoreBackup(t.files[0]); t.value = ''; return; }
    if (t.dataset && (t.dataset.set !== undefined || t.dataset.habId)) settingsInput(t);
    return;
  }
  if (S.view !== 'day' || !t.dataset) return;

  if (t.dataset.actDate !== undefined) {
    if (e.type === 'change' && /^\d{4}-\d{2}-\d{2}$/.test(t.value)) { S.date = t.value; S.showOffice = false; render(); }
    return;
  }
  if (t.dataset.hval) {
    getDay(S.date).custom[t.dataset.hval] = t.value === '' ? 0 : Math.max(0, Number(t.value));
    afterEdit();
    return;
  }
  if (t.dataset.bind) {
    const path = t.dataset.bind;
    const day = getDay(S.date);
    let v = t.value;
    if (t.dataset.type === 'num') v = v === '' ? 0 : Math.max(0, Number(v));
    setPath(day, path, v);
    const m = /^meals\.(b|l|d)\.t$/.exec(path);
    if (m && v) {
      day.meals[m[1]].d = true;
      const btn = $('[data-path="meals.' + m[1] + '.d"]');
      if (btn) btn.setAttribute('aria-pressed', 'true');
    }
    if (path === 'type') { touchDay(S.date); if (e.type === 'change') render(true); return; }
    afterEdit();
    return;
  }
  if (t.dataset.f) {
    const row = t.closest('[data-list]');
    if (!row) return;
    const day = getDay(S.date);
    const item = day[row.dataset.list][+row.dataset.idx];
    if (!item) return;
    item[t.dataset.f] = readVal(t);
    afterEdit();
  }
}

function settingsInput(t) {
  if (t.dataset.habId) {
    const h = S.settings.habits.find(x => x.id === t.dataset.habId), f = t.dataset.habF;
    if (!h) return;
    if (f === 'name') { if (!t.value.trim()) return; h.name = t.value.trim().slice(0, 40); }
    else if (f === 'unit') h.unit = t.value.trim().slice(0, 12);
    else if (f === 'target') { const v = Number(t.value); if (t.value === '' || !(v >= 0)) return; h.target = v; }
    else if (f === 'days' && ['all', 'work', 'off'].includes(t.value)) h.days = t.value;
    touchSettings();
    return;
  }
  const path = t.dataset.set;
  if (path === 'satRef') {
    const v = t.value;
    const msg = $('#satmsg');
    if (v && dow(v) !== 6) { msg.textContent = 'That date is a ' + DOW3[dow(v)] + '. Pick a Saturday.'; return; }
    msg.textContent = '';
    S.settings.satRef = v;
    $('#satprev').innerHTML = satPreview();
    touchSettings();
    return;
  }
  if (t.value === '') return;
  let v = Number(t.value);
  if (!Number.isFinite(v) || v < 0) return;
  if (path === 'waterL') v = Math.round(v);
  setPath(S.settings, path, v);
  touchSettings();
}

function newRow(listKey, withNow) {
  const base = { s: withNow ? nowHHMMSS() : '', e: '', m: '' };
  if (listKey === 'learn') base.t = '';
  if (listKey === 'ent') { base.k = 'Other'; base.n = ''; }
  if (listKey === 'bad') base.n = '';
  return base;
}

async function doExport(kind) {
  await flushAll();
  const csv = kind === 'csv';
  const name = (csv ? 'daily-tracker-' : 'daily-tracker-backup-') + todayStr() + (csv ? '.csv' : '.json');
  const data = csv ? buildCsv() : buildBackup();
  try {
    const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename: name, data }); toast('Export ready'); return; }
    const blob = new Blob([data], { type: csv ? 'text/csv' : 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
  } catch (err) {
    if (err && err.code === 'declined') return;
    toast('Could not export from here');
  }
}

function onClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav) { S.view = nav.dataset.nav; render(); return; }
  const open = e.target.closest('[data-open]');
  if (open) { S.view = 'day'; S.date = open.dataset.open; S.showOffice = false; render(); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;

  switch (act) {
    case 'day-prev': S.date = addDays(S.date, -1); S.showOffice = false; render(); return;
    case 'day-next': S.date = addDays(S.date, 1); S.showOffice = false; render(); return;
    case 'day-today': S.date = todayStr(); S.showOffice = false; render(); return;
    case 'wk-prev': S.weekStart = addDays(S.weekStart, -7); render(); return;
    case 'wk-next': S.weekStart = addDays(S.weekStart, 7); render(); return;
    case 'wk-today': S.weekStart = weekStartOf(todayStr()); render(); return;
    case 'mo-prev': S.month = addMonths(S.month, -1); render(); return;
    case 'mo-next': S.month = addMonths(S.month, 1); render(); return;
    case 'mo-today': S.month = monthOf(todayStr()); render(); return;
    case 'show-office': S.showOffice = true; render(true); return;
    case 'rota': {
      const ns = nextSaturdayFromToday();
      S.settings.satRef = b.dataset.v === 'work' ? ns : addDays(ns, 7);
      touchSettings(); render(true); toast('Saturday schedule saved');
      return;
    }
    case 'theme': S.settings.theme = b.dataset.v; applyTheme(); touchSettings(); render(true); return;
    case 'enable': S.settings.enabled[b.dataset.k] = !S.settings.enabled[b.dataset.k]; touchSettings(); render(true); return;
    case 'check': S.settings.checks[b.dataset.k] = !S.settings.checks[b.dataset.k]; touchSettings(); render(true); return;
    case 'goto-habits': S.view = 'settings'; render(); { const el = $('#habits-set'); if (el) el.scrollIntoView(); } return;
    case 'hab-add': addHabitFromForm(); return;
    case 'hab-preset': { const p = PRESETS[+b.dataset.p]; addHabit({ name: p[0], type: p[1], target: p[2], unit: p[3], days: 'all' }); return; }
    case 'hab-del': {
      const id = b.dataset.id;
      if (S.delArm !== id) { S.delArm = id; b.textContent = 'Tap again to delete'; setTimeout(() => { if (S.delArm === id) { S.delArm = null; if (b.isConnected) b.textContent = 'Delete'; } }, 4000); return; }
      S.settings.habits = S.settings.habits.filter(x => x.id !== id); S.delArm = null; touchSettings(); render(true); toast('Habit deleted'); return;
    }
    case 'signout': flushAll().then(() => sb.auth.signOut()); return;
    case 'export-csv': doExport('csv'); return;
    case 'export-json': doExport('json'); return;
  }

  if (S.view !== 'day') return;
  const day = getDay(S.date);

  if (act === 'toggle') {
    const path = b.dataset.path;
    const v = !getPath(day, path);
    setPath(day, path, v);
    b.setAttribute('aria-pressed', v ? 'true' : 'false');
    afterEdit();
  } else if (act === 'now') {
    const path = b.dataset.path;
    const val = nowHHMMSS();
    setPath(day, path, val);
    const inp = $('[data-bind="' + path + '"]');
    if (inp) inp.value = val;
    const m = /^meals\.(b|l|d)\.t$/.exec(path);
    if (m) { day.meals[m[1]].d = true; const btn = $('[data-path="meals.' + m[1] + '.d"]'); if (btn) btn.setAttribute('aria-pressed', 'true'); }
    afterEdit();
  } else if (act === 'add' || act === 'add-now') {
    const k = b.dataset.list;
    day[k].push(newRow(k, act === 'add-now'));
    $('#list-' + k).innerHTML = day[k].map((x, i) => rowHtml(k, i, x)).join('');
    const rows = $$('#list-' + k + ' .lrow');
    const last = rows[rows.length - 1];
    const first = last && $('input[type="text"], input[data-f="s"]', last);
    if (first && act === 'add') first.focus();
    afterEdit();
  } else if (act === 'del') {
    const row = b.closest('[data-list]');
    const k = row.dataset.list;
    day[k].splice(+row.dataset.idx, 1);
    $('#list-' + k).innerHTML = day[k].map((x, i) => rowHtml(k, i, x)).join('');
    afterEdit();
  } else if (act === 'stop-now') {
    const row = b.closest('[data-list]');
    const item = day[row.dataset.list][+row.dataset.idx];
    item.e = nowHHMMSS();
    $('[data-f="e"]', row).value = item.e;
    afterEdit();
  } else if (act === 'sw-toggle') {
    const k = b.dataset.list, i = runningIdx(day, k);
    if (i < 0) {
      if (S.date !== todayStr()) { toast('The stopwatch runs on today only'); return; }
      const row = newRow(k, true);
      row.sw = 1; row.t0 = Date.now();
      day[k].push(row);
    } else {
      const x = day[k][i];
      x.e = nowHHMMSS();
      delete x.sw; delete x.t0;
    }
    $('#list-' + k).innerHTML = day[k].map((x, n) => rowHtml(k, n, x)).join('');
    $('#sw-' + k).innerHTML = swInner(k, day);
    afterEdit();
  } else if (act === 'h-inc' || act === 'h-dec') {
    const id = b.dataset.id, hb = S.settings.habits.find(x => x.id === id);
    const step = hb && hb.target >= 1000 ? 500 : hb && hb.target >= 100 ? 10 : 1;
    day.custom[id] = Math.max(0, (Number(day.custom[id]) || 0) + (act === 'h-inc' ? step : -step));
    const inp = $('[data-hval="' + id + '"]'); if (inp) inp.value = day.custom[id] || '';
    afterEdit();
  } else if (act === 'h-sw') {
    const id = b.dataset.id;
    if (day.cswrun[id]) {
      day.custom[id] = Math.round(((Number(day.custom[id]) || 0) + (Date.now() - day.cswrun[id]) / 60000) * 60) / 60;
      delete day.cswrun[id];
    } else {
      if (S.date !== todayStr()) { toast('The stopwatch runs on today only'); return; }
      day.cswrun[id] = Date.now();
    }
    $('#habs').innerHTML = habsInner(day, computeDay(day, S.settings).type);
    afterEdit();
  } else if (act === 'water') {
    const i = +b.dataset.i;
    day.water = day.water === i + 1 ? i : i + 1;
    afterEdit();
  } else if (act === 'water-inc') {
    day.water = (day.water || 0) + 1;
    afterEdit();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const view = $('#view');
  view.addEventListener('input', onInput);
  view.addEventListener('change', onInput);
  view.addEventListener('focusout', () => {
    setTimeout(() => { if (S.deferRender && !isTyping()) { S.deferRender = false; render(true); } }, 50);
  });
  document.addEventListener('click', onClick);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { flushAll(); return; }
    const t = todayStr();
    if (S.lastToday && S.lastToday !== t) {
      if (S.date === S.lastToday) S.date = t;
      S.weekStart = weekStartOf(t); S.month = monthOf(t);
      render();
    }
    S.lastToday = t;
  });
  window.addEventListener('pagehide', () => { flushAll(); });
  setInterval(tickStopwatches, 1000);
  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
  init();
});

async function init() {
  renderNav();
  $('#view').innerHTML = '<p class="muted" style="padding:24px 0">Loading your tracker\u2026</p>';
  await connectStore();
  S.ready = true;
  S.lastToday = todayStr();
  applyTheme();
  render();
}

/* ---- habits: add, presets, restore ---- */
const PRESETS = [['Reading', 'timer', 20, 'min'], ['Exercise', 'timer', 30, 'min'], ['Meditation', 'timer', 10, 'min'], ['Steps', 'count', 8000, 'steps'],
  ['Pages read', 'count', 10, 'pages'], ['Journal', 'tick', 0, ''], ['No sugar', 'tick', 0, ''], ['Vitamins', 'tick', 0, '']];
const HAB_COLORS = ['#8a5cc2', '#c2703a', '#3a8f8f', '#b0508f', '#5c8a2e', '#3f6fd0', '#c24a3a', '#7a7a2e'];

function addHabit(o) {
  if (S.settings.habits.length >= 30) { toast('That is the limit of 30 habits'); return; }
  S.settings.habits.push({ id: 'h' + Date.now().toString(36) + Math.floor(Math.random() * 100), name: o.name.slice(0, 40), type: o.type, unit: o.unit || '',
    target: o.target || 0, days: o.days || 'all', color: HAB_COLORS[S.settings.habits.length % HAB_COLORS.length] });
  touchSettings(); render(true); toast('Added ' + o.name);
}

function addHabitFromForm() {
  const name = $('#nh-name').value.trim();
  if (!name) { toast('Give the habit a name'); return; }
  addHabit({ name, type: $('#nh-type').value, target: Math.max(0, Number($('#nh-target').value) || 0), unit: $('#nh-unit').value.trim(), days: $('#nh-days').value });
}

function restoreBackup(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const o = JSON.parse(fr.result);
      if (!o || o.app !== 'daily-tracker' || !o.days) throw new Error('not a backup');
      let n = 0;
      Object.keys(o.days).forEach(date => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const ex = S.days.get(date);
        if (ex && computeDay(ex, S.settings).has) return;   // never overwrite a day you already filled in
        S.days.set(date, normalizeDay(o.days[date], date));
        touchDay(date); n++;
      });
      if (o.settings) { S.settings = mergeSettings(o.settings); applyTheme(); touchSettings(); }
      toast('Restored ' + n + ' days');
      render(true);
    } catch (e) { toast('That file is not a valid backup'); }
  };
  fr.readAsText(file);
}
