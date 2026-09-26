/* ===== HELPERS ===== */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowHHMM = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
const nowHHMMSS = () => { const d = new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()); };
const ICON = {
  day: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></svg>',
  week: '<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
  month: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><path d="M4 7h9M18 7h2M4 17h3M12 17h8"/><circle cx="15.5" cy="7" r="2.3"/><circle cx="9.5" cy="17" r="2.3"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>'
};
const CAT = {
  sleep: { name: 'Sleep', c: 'var(--sleep)' },
  work: { name: 'Office', c: 'var(--work)' },
  learn: { name: 'Learning', c: 'var(--learn)' },
  quran: { name: 'Quran', c: 'var(--quran)' },
  ent: { name: 'Entertainment', c: 'var(--ent)' },
  bad: { name: 'Bad habits', c: 'var(--bad)' }
};

function dayOrBlank(date) { return S.days.get(date) || blankDay(date); }

/* ===== 24-HOUR DIAL ===== */
function arcPath(cx, cy, r, m1, m2) {
  if (m2 <= m1) return '';
  if (m2 - m1 >= 1440) m2 = m1 + 1439.9;
  const a1 = (m1 / 1440) * 2 * Math.PI - Math.PI / 2;
  const a2 = (m2 / 1440) * 2 * Math.PI - Math.PI / 2;
  const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2), y2 = cy + r * Math.sin(a2);
  return 'M' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + ((m2 - m1) > 720 ? 1 : 0) + ' 1 ' + x2.toFixed(2) + ' ' + y2.toFixed(2);
}

function dialHtml(date, c) {
  const cx = 170, cy = 170, R1 = 132, R2 = 104;
  const segs = dialSegments(date, S.days, S.settings);
  const en = S.settings.enabled, catOn = { sleep: en.sleep, work: en.office, learn: en.learn, quran: en.quran, ent: en.ent, bad: en.bad };
  let svg = '<svg class="dial" viewBox="0 0 340 340" role="img" aria-label="' + esc('24-hour view of ' + labelDate(date) + ': ' +
    ['sleep', 'work', 'learn', 'quran', 'ent', 'bad'].map(k => CAT[k].name + ' ' + fmtDur({ sleep: c.sleepMin, work: c.workMin, learn: c.learnMin, quran: c.quranMin, ent: c.entMin, bad: c.badMin }[k])).join(', ')) + '">';
  svg += '<circle class="track" cx="' + cx + '" cy="' + cy + '" r="' + R1 + '" stroke-width="20"/>';
  svg += '<circle class="track" cx="' + cx + '" cy="' + cy + '" r="' + R2 + '" stroke-width="16"/>';
  for (let h = 0; h < 24; h += 3) {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
    const r1 = R1 + 12, r2 = R1 + 17;
    svg += '<line class="tick" x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (cx + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r2 * Math.sin(a)).toFixed(1) + '"/>';
  }
  [['12a', 0], ['6a', 6], ['12p', 12], ['6p', 18]].forEach(([t, h]) => {
    const a = (h / 24) * 2 * Math.PI - Math.PI / 2, r = R1 + 26;
    svg += '<text x="' + (cx + r * Math.cos(a)).toFixed(1) + '" y="' + (cy + r * Math.sin(a) + 3.5).toFixed(1) + '" text-anchor="middle">' + t + '</text>';
  });
  const drawRing = (list, r, w) => list.filter(s => catOn[s.cat]).forEach(s => {
    const d = arcPath(cx, cy, r, s.from, s.to);
    if (d) svg += '<path d="' + d + '" fill="none" stroke="' + CAT[s.cat].c + '" stroke-width="' + w + '"><title>' + esc(CAT[s.cat].name + ' ' + fromMin(s.from) + '\u2013' + fromMin(s.to % 1440)) + '</title></path>';
  });
  drawRing(segs.a, R1, 20);
  drawRing(segs.b, R2, 16);
  svg += '<text class="mid1" x="' + cx + '" y="' + (cy - 30) + '" text-anchor="middle">' + esc(TYPES[c.type]) + '</text>';
  svg += '<text class="mid2" x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle">' + c.score + '%</text>';
  svg += '<text class="mid3" x="' + cx + '" y="' + (cy + 38) + '" text-anchor="middle">' + c.goalsMet + ' of ' + c.goalsTotal + ' goals</text>';
  svg += '</svg>';

  const items = [['sleep', c.sleepLogged ? c.sleepMin : null], ['work', c.officeLogged ? c.workMin : null], ['learn', c.learnMin], ['quran', c.quranMin], ['ent', c.entMin], ['bad', c.badMin]];
  const legend = '<div class="legend">' + items.filter(([k]) => catOn[k]).map(([k, v]) => '<div><i style="background:' + CAT[k].c + '"></i>' + CAT[k].name + '<b>' + (v === null ? '\u2014' : fmtDur(v)) + '</b></div>').join('') + '</div>';
  return svg + legend;
}

/* ===== GOALS PANEL ===== */
function goalsHtml(c) {
  const T = c.T, S_ = S.settings, en = S_.enabled, ck = S_.checks;
  const rows = [];
  const gm = k => c.goals.find(g => g.k === k).met;
  const add = (label, pct, val, met) => rows.push('<div class="goal' + (met ? ' met' : '') + '"><span>' + esc(label) + '</span><span class="meter"><b style="width:' + Math.max(0, Math.min(100, pct)) + '%"></b></span><span class="val">' + esc(val) + '</span></div>');
  if (en.prayers) add('Prayers', c.prayers / 5 * 100, c.prayers + ' / 5', c.prayers === 5);
  if (en.sleep && S_.sleepH > 0) add('Sleep', c.sleepMin / (S_.sleepH * 60) * 100, (c.sleepLogged ? fmtDur(c.sleepMin) : 'not logged') + ' / ' + S_.sleepH + 'h', gm('sleep'));
  if (en.learn && T.learn > 0) add('Learning', c.learnMin / (T.learn * 60) * 100, fmtDur(c.learnMin) + ' / ' + T.learn + 'h', gm('learn'));
  if (en.water && S_.waterL > 0) add('Water', c.bottles / S_.waterL * 100, c.bottles + ' / ' + S_.waterL + ' L', gm('water'));
  if (en.brain && T.brain > 0) add('Brainstorm', c.brainMin / T.brain * 100, c.brainMin + ' / ' + T.brain + ' min', gm('brain'));
  if (en.quran && T.quran > 0) add('Quran', c.quranMin / T.quran * 100, c.quranMin + ' / ' + T.quran + ' min', gm('quran'));
  if (en.learn) [['practical', 'Practical'], ['recall', 'Blank page'], ['qa', 'Q&A']].forEach(([k, l]) => {
    if (!ck[k]) return;
    add(l, gm(k) ? 100 : 0, gm(k) ? 'Done' : 'Not yet', gm(k));
  });
  if (en.bad) { const clean = gm('clean'); add('Bad habits', clean ? 100 : 0, clean ? 'None' : (c.has ? c.badCount + ' logged, ' + fmtDur(c.badMin) : 'nothing logged yet'), clean); }
  S_.habits.forEach(hb => {
    const cc = c.custom[hb.id];
    if (!cc || !cc.applies) return;
    const g = c.goals.find(x => x.k === 'h_' + hb.id), tg = hb.type === 'tick' ? 1 : (hb.target || 1);
    add(hb.name, cc.v / tg * 100, hb.type === 'tick' ? (cc.v ? 'Done' : 'Not yet') : +cc.v.toFixed(1) + (hb.target ? ' / ' + hb.target : '') + ' ' + habUnit(hb), g.met);
  });
  const extras = [];
  if (en.office) extras.push('Office ' + (c.officeLogged ? fmtDur(c.workMin) : '\u2014'));
  if (en.meals) extras.push('Meals ' + c.meals + '/3');
  if (en.ent) extras.push('Entertainment ' + fmtDur(c.entMin));
  return '<h2>Goals for ' + esc(TYPES[c.type]) + '</h2><p class="sub">' + esc(extras.join('  \u00b7  ')) + '</p>' + (rows.join('') || '<p class="muted">Nothing is switched on. Choose what to track in Settings.</p>');
}

/* ===== FORM PIECES ===== */
function timeFld(label, path, val) {
  return '<label class="fld"><span>' + esc(label) + '</span><span class="inl"><input type="time" step="1" data-bind="' + path + '" value="' + esc(val) + '"><button type="button" class="now" data-act="now" data-path="' + path + '">Now</button></span></label>';
}

function toggleBtn(label, path, on, color) {
  return '<button type="button" class="tog" data-act="toggle" data-path="' + path + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + (color ? ' style="--c:' + color + '"' : '') + '>' + esc(label) + '</button>';
}

function rowHtml(listKey, i, x) {
  let name = '';
  if (listKey === 'learn') {
    name = '<div class="name"><input type="text" data-f="t" placeholder="What did you study?" aria-label="Topic" value="' + esc(x.t) + '"></div>';
  } else if (listKey === 'ent') {
    name = '<div class="name two"><select data-f="k" aria-label="Type">' + ENT_KINDS.map(k => '<option' + ((x.k || 'Other') === k ? ' selected' : '') + '>' + k + '</option>').join('') + '</select>' +
      '<input type="text" data-f="n" placeholder="Match, film or place (optional)" aria-label="Details" value="' + esc(x.n) + '"></div>';
  } else if (listKey === 'bad') {
    name = '<div class="name"><input type="text" data-f="n" list="badlabels" placeholder="What was it?" aria-label="Habit" value="' + esc(x.n) + '"></div>';
  }
  const tag = listKey === 'learn' && x.s ? '<span class="tag">' + sessionTag(x.s) + '</span>' : '';
  const stop = x.s && !x.e && !x.sw ? '<button type="button" class="now" data-act="stop-now">Stop now</button>' : '';
  return '<div class="lrow" data-list="' + listKey + '" data-idx="' + i + '">' + name +
    '<label class="fld"><span>Start</span><input type="time" step="1" data-f="s" value="' + esc(x.s) + '"></label>' +
    '<label class="fld"><span>End</span><input type="time" step="1" data-f="e" value="' + esc(x.e) + '"></label>' +
    '<label class="fld"><span>or min</span><input type="number" min="0" inputmode="numeric" data-f="m" value="' + esc(x.m) + '"></label>' +
    '<div class="end"><span>Time</span><b data-rowdur>' + fmtDur(entryMin(x)) + '</b>' + tag + stop + '<button type="button" class="del" data-act="del">Remove</button></div></div>';
}

const SW_COLOR = { learn: 'var(--learn)', quran: 'var(--quran)', ent: 'var(--ent)', bad: 'var(--bad)' };
const SW_LEN = 2 * Math.PI * 44;
function runningIdx(day, k) { return (day[k] || []).findIndex(x => x.sw && x.s && !x.e); }
function fmtClock(sec) { sec = Math.max(0, Math.floor(sec)); return pad2(Math.floor(sec / 3600)) + ':' + pad2(Math.floor(sec / 60) % 60) + ':' + pad2(sec % 60); }

function swInner(k, day) {
  const i = runningIdx(day, k), run = i >= 0, x = run ? day[k][i] : null;
  const sec = run && x.t0 ? (Date.now() - x.t0) / 1000 : 0;
  const off = SW_LEN * (1 - (sec % 60) / 60);
  return '<div class="swring' + (run ? ' run' : '') + '"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" cx="50" cy="50" r="44" stroke-dasharray="' + SW_LEN.toFixed(2) + '" stroke-dashoffset="' + (run ? off.toFixed(2) : SW_LEN.toFixed(2)) + '" transform="rotate(-90 50 50)"/></svg><span class="pulse"></span></div>' +
    '<div class="swtxt"><div class="swdig" data-sw="' + k + '" role="timer">' + fmtClock(sec) + '</div><div class="swlbl">' + (run ? 'Running since ' + esc(fmtTime12(x.s)) : 'Stopwatch') + '</div></div>' +
    '<button type="button" class="swbtn' + (run ? ' stop' : '') + '" data-act="sw-toggle" data-list="' + k + '">' + (run ? 'Stop' : 'Start') + '</button>';
}

function listHtml(listKey, day, addLabel) {
  const rows = (day[listKey] || []).map((x, i) => rowHtml(listKey, i, x)).join('');
  return '<div class="sw" id="sw-' + listKey + '" style="--c:' + SW_COLOR[listKey] + '">' + swInner(listKey, day) + '</div>' +
    '<div class="rows" id="list-' + listKey + '">' + rows + '</div>' +
    '<div class="toggles"><button type="button" class="add" data-act="add" data-list="' + listKey + '">+ ' + esc(addLabel) + ' by hand</button></div>';
}

/* live clock for a running stopwatch, called every second */
function tickStopwatches() {
  if (S.view !== 'day') return;
  const day = dayOrBlank(S.date);
  let any = false;
  $$('[data-hsw]').forEach(el => { const t0 = day.cswrun && day.cswrun[el.dataset.hsw]; if (t0) { el.textContent = fmtClock((Date.now() - t0) / 1000); any = true; } });
  $$('[data-sw]').forEach(el => {
    const k = el.dataset.sw, i = runningIdx(day, k);
    if (i < 0) return;
    const x = day[k][i];
    if (!x.t0) return;
    any = true;
    const sec = (Date.now() - x.t0) / 1000;
    el.textContent = fmtClock(sec);
    const fg = $('#sw-' + k + ' .fg');
    if (fg) fg.setAttribute('stroke-dashoffset', (SW_LEN * (1 - (sec % 60) / 60)).toFixed(2));
    const out = $('[data-out="' + k + '"]');
    if (out) out.textContent = fmtDur(sumEntries(day[k]) + sec / 60 - entryMin(x));
  });
  if (any && Date.now() % 5000 < 1000) updateDerived(true);
}

function bottlesHtml(water) {
  const n = Math.max(Math.ceil(S.settings.waterL), water, 1);
  let h = '';
  for (let i = 0; i < n; i++) {
    h += '<button type="button" class="bottle' + (i < water ? ' on' : '') + '" data-act="water" data-i="' + i + '" aria-label="Bottle ' + (i + 1) + ', 1 litre" aria-pressed="' + (i < water ? 'true' : 'false') + '">' +
      '<svg viewBox="0 0 44 84" aria-hidden="true"><rect class="cap" x="15" y="0" width="14" height="8" rx="2"/><rect class="glass" x="6" y="9" width="32" height="73" rx="10"/><rect class="lvl" x="9" y="12" width="26" height="67" rx="7" style="opacity:' + (i < water ? 0.92 : 0) + '"/></svg></button>';
  }
  return h + '<button type="button" class="add" data-act="water-inc" aria-label="Add an extra bottle" style="align-self:center;padding:8px 12px">+ 1</button>';
}

function paceText(date) {
  if (date !== todayStr()) return '';
  const now = new Date(), m = now.getHours() * 60 + now.getMinutes();
  const f = Math.max(0, Math.min(1, (m - 360) / 960));
  const want = S.settings.waterL * f;
  return 'Pace: about ' + (Math.round(want * 2) / 2).toFixed(1).replace(/\.0$/, '') + ' L by now, spread from 6 am to 10 pm';
}

/* ===== CUSTOM HABITS (Today) ===== */
function habApplies(h, type) { return h.days === 'all' || (h.days === 'work' ? isWorkType(type) : !isWorkType(type)); }
function habUnit(h) { return h.unit || (h.type === 'timer' ? 'min' : ''); }
function habRow(h, day) {
  const raw = day.custom && day.custom[h.id];
  const v = h.type === 'tick' ? !!raw : (Number(raw) || 0);
  const run = day.cswrun && day.cswrun[h.id];
  const tgt = h.type !== 'tick' && h.target ? ' / ' + h.target + ' ' + habUnit(h) : '';
  let ctl;
  if (h.type === 'tick') ctl = toggleBtn('Done', 'custom.' + h.id, v, h.color);
  else if (h.type === 'count') ctl = '<div class="stepper"><button type="button" data-act="h-dec" data-id="' + h.id + '" aria-label="One less">\u2212</button><input type="number" min="0" inputmode="numeric" data-hval="' + h.id + '" value="' + (v || '') + '" aria-label="' + esc(h.name) + '" style="width:88px"><button type="button" data-act="h-inc" data-id="' + h.id + '" aria-label="One more">+</button></div>';
  else ctl = '<div class="stepper"><input type="number" min="0" inputmode="decimal" data-hval="' + h.id + '" value="' + (v ? +v.toFixed(1) : '') + '" aria-label="' + esc(h.name) + ' minutes" style="width:76px"><span class="muted small">min</span>' +
    '<button type="button" class="btn small" data-act="h-sw" data-id="' + h.id + '">' + (run ? 'Stop' : 'Start') + '</button><b class="small" data-hsw="' + h.id + '">' + (run ? fmtClock((Date.now() - run) / 1000) : '') + '</b></div>';
  return '<div class="hab" style="--c:' + h.color + '"><div class="hname"><i></i><b>' + esc(h.name) + '</b><span class="muted small">' + esc(tgt) + '</span></div>' + ctl + '</div>';
}
function habsInner(day, type) { return S.settings.habits.filter(h => habApplies(h, type)).map(h => habRow(h, day)).join(''); }

/* ===== TODAY SCREEN ===== */
function nextSaturdayFromToday() {
  const t = todayStr();
  return addDays(t, (6 - dow(t) + 7) % 7);
}

function renderDay() {
  const date = S.date;
  const day = dayOrBlank(date);
  const c = computeDay(day, S.settings);
  const auto = autoType(date, S.settings);
  const isToday = date === todayStr();
  const work = isWorkType(c.type);
  const en = S.settings.enabled, ck = S.settings.checks;
  const officeData = day.office.leave || day.office.in || day.office.out || day.office.home;
  const showOffice = work || officeData || S.showOffice;

  /* previously used habit labels for suggestions */
  const labels = new Set();
  S.days.forEach(d => (d.bad || []).forEach(x => { if (x.n && x.n.trim()) labels.add(x.n.trim()); }));

  let h = '';
  h += '<div class="topbar"><h1>' + (isToday ? 'Today' : esc(labelDate(date, true))) + '</h1><span class="sync" data-sync></span><span class="spacer"></span>' +
    '<div class="datewrap"><button type="button" class="iconbtn" data-act="day-prev" aria-label="Previous day">' + ICON.prev + '</button>' +
    '<input class="datepick" type="date" data-act-date value="' + date + '" aria-label="Go to date">' +
    '<button type="button" class="iconbtn" data-act="day-next" aria-label="Next day">' + ICON.next + '</button>' +
    (isToday ? '' : '<button type="button" class="btn small" data-act="day-today">Today</button>') + '</div></div>';

  h += '<div class="topbar" style="margin-top:-4px"><span class="chip ' + (work ? 'work' : 'off') + '"><i></i>' + esc(TYPES[c.type]) + '</span>' +
    '<label class="small muted" for="typesel">Day type</label><select id="typesel" data-bind="type" style="width:auto">' +
    '<option value=""' + (!day.type ? ' selected' : '') + '>Automatic (' + esc(TYPES[auto]) + ')</option>' +
    Object.keys(TYPES).map(k => '<option value="' + k + '"' + (day.type === k ? ' selected' : '') + '>' + TYPES[k] + '</option>').join('') + '</select></div>';

  if (!S.settings.satRef) {
    const ns = nextSaturdayFromToday();
    h += '<div class="banner"><p><b>Set your alternate-Saturday schedule.</b></p><p class="small">Until this is set, every Saturday is treated as an off day.</p><div class="actions">' +
      '<button type="button" class="btn small primary" data-act="rota" data-v="work">' + esc(labelDate(ns)) + ' is a working Saturday</button>' +
      '<button type="button" class="btn small" data-act="rota" data-v="off">' + esc(labelDate(ns)) + ' is off</button></div></div>';
  }

  h += '<div class="overview"><div class="dialwrap" id="dialbox">' + dialHtml(date, c) + '</div><div class="goals" id="goalbox">' + goalsHtml(c) + '</div></div>';

  h += '<div class="sections">';

  /* prayers */
  if (en.prayers) {
  h += '<section class="sec" style="--c:var(--prayer)"><header><h3>Prayers</h3><span class="out" data-out="prayers">' + c.prayers + ' / 5</span></header><div class="toggles">' +
    PRAYERS.map((p, i) => toggleBtn(p, 'prayers.' + i, day.prayers[i], 'var(--prayer)')).join('') + '</div></section>';
  }

  /* sleep */
  if (en.sleep) {
  h += '<section class="sec" style="--c:var(--sleep)"><header><h3>Sleep</h3><span class="out" data-out="sleep">' + (c.sleepLogged ? fmtDur(c.sleepMin) : '\u2014') + '</span></header>' +
    '<p class="hint">Log it on the morning you woke up. Bed time is last night.</p><div class="fields">' +
    timeFld('Went to bed', 'sleep.bed', day.sleep.bed) + timeFld('Woke up', 'sleep.wake', day.sleep.wake) + '</div>' +
    '<p class="pacing" data-out="sleepvs" style="margin-top:8px"></p></section>';
  }

  /* brainstorm */
  if (en.brain) {
  h += '<section class="sec" style="--c:var(--note)"><header><h3>Morning brainstorm</h3><span class="out" data-out="brain">' + (c.brainMin ? c.brainMin + ' min' : '\u2014') + '</span></header>' +
    '<label class="fld" style="max-width:200px"><span>Minutes</span><input type="number" min="0" inputmode="numeric" data-bind="brain" data-type="num" value="' + (day.brain || '') + '"></label></section>';
  }

  /* meals */
  if (en.meals) {
  h += '<section class="sec" style="--c:var(--meal)"><header><h3>Meals</h3><span class="out" data-out="meals">' + c.meals + ' / 3</span></header>' +
    [['b', 'Breakfast'], ['l', 'Lunch'], ['d', 'Dinner']].map(([k, l]) =>
      '<div class="mealrow">' + toggleBtn(l, 'meals.' + k + '.d', day.meals[k].d, 'var(--meal)') +
      '<input type="time" step="1" data-bind="meals.' + k + '.t" value="' + esc(day.meals[k].t) + '" aria-label="' + l + ' time"></div>').join('') + '</section>';
  }

  /* water */
  if (en.water) {
  h += '<section class="sec" style="--c:var(--water)"><header><h3>Water</h3><span class="out" data-out="water">' + c.bottles + ' / ' + S.settings.waterL + ' L</span></header>' +
    '<p class="hint">One bottle is one litre. Tap a bottle each time you finish one.</p><div class="bottles" id="bottles">' + bottlesHtml(c.bottles) + '</div>' +
    '<p class="pacing" data-out="pace">' + esc(paceText(date)) + '</p></section>';
  }

  /* office */
  if (en.office) {
  if (showOffice) {
    h += '<section class="sec" style="--c:var(--work)"><header><h3>Office</h3><span class="out" data-out="office">' + (c.officeLogged ? fmtDur(c.workMin) : '\u2014') + '</span></header>' +
      (work ? '' : '<p class="hint">This is an off day. Fill this in only if you went to the office.</p>') +
      '<div class="fields">' + timeFld('Left home', 'office.leave', day.office.leave) + timeFld('Reached office', 'office.in', day.office.in) +
      timeFld('Left office', 'office.out', day.office.out) + timeFld('Reached home', 'office.home', day.office.home) + '</div>' +
      '<div class="stats"><div><b data-out="office2">' + (c.officeLogged ? fmtDur(c.workMin) : '\u2014') + '</b>at office</div><div><b data-out="commute">' + (c.commuteMin ? fmtDur(c.commuteMin) : '\u2014') + '</b>travelling</div><div><b data-out="away">' + (c.awayMin ? fmtDur(c.awayMin) : '\u2014') + '</b>away from home</div></div></section>';
  } else {
    h += '<section class="sec" style="--c:var(--line)"><header><h3>Office</h3></header><p class="hint">Off day, so this is hidden.</p><button type="button" class="add" data-act="show-office">Log office hours anyway</button></section>';
  }
  }

  /* learning */
  if (en.learn) {
  h += '<section class="sec" style="--c:var(--learn)"><header><h3>Learning</h3><span class="out" data-out="learn">' + fmtDur(c.learnMin) + '</span></header>' +
    '<p class="hint">Start the stopwatch when you begin. Sessions starting after 8 pm count as night learning.</p>' + listHtml('learn', day, 'Add session') +
    '<div class="stats"><div><b data-out="night">' + fmtDur(c.nightLearnMin) + '</b>at night</div><div><b data-out="sessions">' + day.learn.length + '</b>sessions</div><div><b data-out="learnvs">' + (c.T.learn ? fmtH(c.T.learn * 60, 2) + 'h' : '\u2014') + '</b>goal today</div></div>' +
    ((ck.practical || ck.recall || ck.qa) ? '<div class="checks">' + (ck.practical ? toggleBtn('Practical learning done', 'practical', day.practical, 'var(--learn)') : '') + (ck.recall ? toggleBtn('Blank-page answering done', 'recall', day.recall, 'var(--learn)') : '') + (ck.qa ? toggleBtn('Q&A done', 'qa', day.qa, 'var(--learn)') : '') + '</div>' : '') +
    (ck.recall ? '<label class="fld"><span>What I learned (blank-page answer)</span><textarea data-bind="learned" placeholder="Write what you remember without looking.">' + esc(day.learned) + '</textarea></label>' : '') + '</section>';
  }

  /* quran */
  if (en.quran) {
  h += '<section class="sec" style="--c:var(--quran)"><header><h3>Quran</h3><span class="out" data-out="quran">' + fmtDur(c.quranMin) + '</span></header>' +
    '<p class="hint">Enter start and end, or just the minutes.</p>' + listHtml('quran', day, 'Add reading') + '</section>';
  }

  /* entertainment */
  if (en.ent) {
  h += '<section class="sec" style="--c:var(--ent)"><header><h3>Entertainment and outings</h3><span class="out" data-out="ent">' + fmtDur(c.entMin) + '</span></header>' + listHtml('ent', day, 'Add entry') + '</section>';
  }

  /* bad habits */
  if (en.bad) {
  h += '<section class="sec" style="--c:var(--bad)"><header><h3>Bad habits</h3><span class="out" data-out="bad">' + (c.badCount ? fmtDur(c.badMin) : 'None') + '</span></header>' +
    '<p class="hint">Log each slip with when it started and ended. Leave empty on a clean day.</p>' + listHtml('bad', day, 'Add slip') +
    '<datalist id="badlabels">' + Array.from(labels).map(l => '<option value="' + esc(l) + '">').join('') + '</datalist></section>';
  }

  const myHabs = S.settings.habits.filter(x => habApplies(x, c.type));
  if (myHabs.length) {
    const hm = c.goals.filter(g => g.custom);
    h += '<section class="sec" style="--c:var(--ink)"><header><h3>My habits</h3><span class="out" data-out="habs">' + hm.filter(g => g.met).length + ' / ' + hm.length + '</span></header><div id="habs">' + habsInner(day, c.type) + '</div></section>';
  }

  /* note */
  if (en.note) {
  h += '<section class="sec" style="--c:var(--note)"><header><h3>Day note</h3></header>' +
    '<label class="fld"><span class="sr">Note</span><textarea data-bind="note" placeholder="Anything worth remembering about today.">' + esc(day.note) + '</textarea></label></section>';
  }

  h += '</div>';
  h += '<div style="margin:0 0 8px"><button type="button" class="btn" data-act="goto-habits">+ Add or remove habits</button></div>';
  $('#view').innerHTML = h;
  renderSync();
  updateDerived();
}

/* refresh everything computed, without touching the inputs the person is typing in */
function updateDerived(fromTick) {
  if (S.view !== 'day') return;
  const date = S.date;
  const day = dayOrBlank(date);
  const c = computeDay(day, S.settings);
  const set = (k, v) => $$('[data-out="' + k + '"]').forEach(el => { el.textContent = v; });
  set('prayers', c.prayers + ' / 5');
  set('sleep', c.sleepLogged ? fmtDur(c.sleepMin) : '\u2014');
  if (c.sleepLogged) {
    const diff = c.sleepMin - S.settings.sleepH * 60;
    set('sleepvs', diff >= 0 ? 'Goal of ' + S.settings.sleepH + 'h met' + (diff > 0 ? ', ' + fmtDur(diff) + ' over' : '') : fmtDur(-diff) + ' short of your ' + S.settings.sleepH + 'h goal');
  } else set('sleepvs', '');
  set('brain', c.brainMin ? c.brainMin + ' min' : '\u2014');
  set('meals', c.meals + ' / 3');
  set('water', c.bottles + ' / ' + S.settings.waterL + ' L');
  set('pace', paceText(date));
  set('office', c.officeLogged ? fmtDur(c.workMin) : '\u2014');
  set('office2', c.officeLogged ? fmtDur(c.workMin) : '\u2014');
  set('commute', c.commuteMin ? fmtDur(c.commuteMin) : '\u2014');
  set('away', c.awayMin ? fmtDur(c.awayMin) : '\u2014');
  set('learn', fmtDur(c.learnMin));
  set('night', fmtDur(c.nightLearnMin));
  set('sessions', String(day.learn.length));
  set('quran', fmtDur(c.quranMin));
  set('ent', fmtDur(c.entMin));
  set('bad', c.badCount ? fmtDur(c.badMin) : 'None');
  { const hm = c.goals.filter(g => g.custom); set('habs', hm.filter(g => g.met).length + ' / ' + hm.length); }

  $$('.lrow').forEach(row => {
    const x = (day[row.dataset.list] || [])[+row.dataset.idx];
    if (!x) return;
    $('[data-rowdur]', row).textContent = fmtDur(entryMin(x));
    const tag = $('.tag', row);
    if (row.dataset.list === 'learn') {
      const end = $('.end', row);
      if (x.s && !tag) end.insertBefore(Object.assign(document.createElement('span'), { className: 'tag', textContent: sessionTag(x.s) }), $('.del', row));
      else if (tag) { if (x.s) tag.textContent = sessionTag(x.s); else tag.remove(); }
    }
    const stop = $('[data-act="stop-now"]', row);
    if (x.s && !x.e && !x.sw && !stop) {
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'now', textContent: 'Stop now' });
      b.dataset.act = 'stop-now';
      $('.end', row).insertBefore(b, $('.del', row));
    } else if (stop && (!x.s || x.e)) stop.remove();
  });

  const bt = $('#bottles');
  if (bt) {
    const want = Math.max(Math.ceil(S.settings.waterL), c.bottles, 1);
    if ($$('.bottle', bt).length !== want) bt.innerHTML = bottlesHtml(c.bottles);
    else $$('.bottle', bt).forEach((b, i) => {
      b.classList.toggle('on', i < c.bottles);
      b.setAttribute('aria-pressed', i < c.bottles ? 'true' : 'false');
      $('.lvl', b).style.opacity = i < c.bottles ? 0.92 : 0;
    });
  }
  const dial = $('#dialbox'); if (dial) dial.innerHTML = dialHtml(date, c);
  const goals = $('#goalbox'); if (goals) goals.innerHTML = goalsHtml(c);
  const chip = $('.chip'); if (chip) { chip.className = 'chip ' + (isWorkType(c.type) ? 'work' : 'off'); chip.innerHTML = '<i></i>' + esc(TYPES[c.type]); }
}
