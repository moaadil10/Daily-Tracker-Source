/* ===== CORE LOGIC (pure, no DOM) ===== */
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const TYPES = {
  weekday: 'Weekday',
  workSat: 'Working Saturday',
  offSat: 'Off Saturday',
  sunday: 'Sunday'
};
const SECTIONS = [['prayers', 'Prayers'], ['sleep', 'Sleep'], ['brain', 'Morning brainstorm'], ['meals', 'Meals'], ['water', 'Water'],
  ['office', 'Office hours'], ['learn', 'Learning'], ['quran', 'Quran'], ['ent', 'Entertainment and outings'], ['bad', 'Bad habits'], ['note', 'Day note']];
const PRI_NAMES = { 3: 'Important', 2: 'Normal', 1: 'Less important' };
const CHECKS = [['practical', 'Practical learning'], ['recall', 'Blank-page answering'], ['qa', 'Q&A']];
const ENT_KINDS = ['Football', 'Movie', 'Series', 'Outing', 'Other'];

const DEFAULT_SETTINGS = {
  sleepH: 7,
  waterL: 3,
  satRef: '',
  theme: 'auto',
  enabled: { prayers: true, sleep: true, brain: true, meals: true, water: true, office: true, learn: true, quran: true, ent: true, bad: true, note: true },
  checks: { practical: true, recall: true, qa: true },
  habits: [],
  priority: { prayers: 3, sleep: 3, learn: 3, quran: 2, water: 2, brain: 2, practical: 2, recall: 2, qa: 2, bad: 2, office: 2, meals: 1, ent: 1, note: 1 },
  remind: { on: true, from: '20:00', every: 60 },
  motivator: '',
  byType: {
    weekday: { learn: 1.5, brain: 20, quran: 10 },
    workSat: { learn: 1.5, brain: 20, quran: 10 },
    offSat: { learn: 3, brain: 20, quran: 15 },
    sunday: { learn: 3, brain: 20, quran: 15 }
  }
};

function mergeSettings(saved) {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!saved || typeof saved !== 'object') return s;
  ['sleepH', 'waterL'].forEach(k => { if (typeof saved[k] === 'number' && saved[k] >= 0) s[k] = saved[k]; });
  if (typeof saved.satRef === 'string') s.satRef = saved.satRef;
  if (['auto', 'light', 'dark'].includes(saved.theme)) s.theme = saved.theme;
  ['enabled', 'checks'].forEach(g => {
    if (saved[g] && typeof saved[g] === 'object') Object.keys(s[g]).forEach(k => { if (typeof saved[g][k] === 'boolean') s[g][k] = saved[g][k]; });
  });
  if (saved.priority && typeof saved.priority === 'object') Object.keys(s.priority).forEach(k => { const v = +saved.priority[k]; if (v === 1 || v === 2 || v === 3) s.priority[k] = v; });
  if (saved.remind && typeof saved.remind === 'object') {
    if (typeof saved.remind.on === 'boolean') s.remind.on = saved.remind.on;
    if (typeof saved.remind.from === 'string' && /^\d{2}:\d{2}$/.test(saved.remind.from)) s.remind.from = saved.remind.from;
    if (+saved.remind.every >= 5 && +saved.remind.every <= 720) s.remind.every = Math.round(+saved.remind.every);
  }
  if (typeof saved.motivator === 'string') s.motivator = saved.motivator.slice(0, 140);
  s.habits = [];
  if (Array.isArray(saved.habits)) saved.habits.slice(0, 30).forEach(h => {
    if (!h || typeof h.id !== 'string' || typeof h.name !== 'string' || !h.name.trim() || !['tick', 'count', 'timer'].includes(h.type)) return;
    const id = h.id.replace(/[^a-z0-9_]/gi, '').slice(0, 24);
    if (!id || s.habits.some(x => x.id === id)) return;
    s.habits.push({ id, name: h.name.trim().slice(0, 40), type: h.type, unit: String(h.unit || '').slice(0, 12),
      target: Number.isFinite(+h.target) && +h.target >= 0 ? +h.target : 0, days: ['all', 'work', 'off'].includes(h.days) ? h.days : 'all',
      color: /^#[0-9a-f]{6}$/i.test(h.color) ? h.color : '#3f6fd0', pri: [1, 2, 3].includes(+h.pri) ? +h.pri : 2 });
  });
  if (saved.byType) {
    Object.keys(s.byType).forEach(t => {
      const src = saved.byType[t];
      if (!src) return;
      ['learn', 'brain', 'quran'].forEach(k => {
        if (typeof src[k] === 'number' && src[k] >= 0) s.byType[t][k] = src[k];
      });
    });
  }
  return s;
}

/* ---- time ---- */
const pad2 = n => String(n).padStart(2, '0');

function toMin(t) {
  const x = typeof t === 'string' ? /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t) : null;
  if (!x) return null;
  const h = +x[1], m = +x[2], sec = x[3] ? +x[3] : 0;
  if (h > 23 || m > 59 || sec > 59) return null;
  return h * 60 + m + sec / 60;
}

function fromMin(m) {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

/* minutes from start to end, wrapping past midnight; null if either is missing */
function span(s, e) {
  const a = toMin(s), b = toMin(e);
  if (a === null || b === null) return null;
  return Math.round((((b - a) % 1440) + 1440) % 1440 * 60) / 60;   /* exact to the second */
}

/* duration of one logged entry: start/end range wins, else a typed-in minutes value */
function entryMin(x) {
  if (!x) return 0;
  const r = span(x.s, x.e);
  if (r !== null && r > 0) return r;
  const m = Number(x.m);
  return Number.isFinite(m) && m > 0 ? m : 0;
}

function sumEntries(list) {
  return (list || []).reduce((a, x) => a + entryMin(x), 0);
}

function fmtDur(min) {
  if (min === null || min === undefined || !Number.isFinite(min)) return '\u2014';
  let t = Math.round(min * 60);
  if (t <= 0) return '0m';
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
  return [h ? h + 'h' : '', m ? m + 'm' : '', sec ? sec + 's' : ''].filter(Boolean).join(' ');
}

function fmtH(min, d = 1) {
  return (min / 60).toFixed(d).replace(/\.0+$/, '');
}

function fmtTime12(t) {
  const m = toMin(t);
  if (m === null) return '';
  const h = Math.floor(m / 60), mm = Math.floor(m % 60);
  return ((h + 11) % 12 + 1) + ':' + pad2(mm) + (h < 12 ? ' am' : ' pm');
}

/* session label from its start time */
function sessionTag(s) {
  const m = toMin(s);
  if (m === null) return '';
  if (m >= 240 && m < 720) return 'Morning';
  if (m >= 720 && m < 1200) return 'Day';
  return 'Night';
}

function isNightStart(s) {
  return sessionTag(s) === 'Night';
}

/* ---- dates (all 'YYYY-MM-DD' strings, UTC math so DST never shifts a day) ---- */
function ymdOf(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function todayStr() { return ymdOf(new Date()); }
function utc(s) {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
function strFromUtc(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}
function addDays(s, n) { return strFromUtc(utc(s) + n * 86400000); }
function dow(s) { return new Date(utc(s)).getUTCDay(); } /* 0 = Sunday */
function weekStartOf(s) { const w = dow(s); return addDays(s, -((w + 6) % 7)); } /* Monday */
function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / 86400000); }
function monthOf(s) { return s.slice(0, 7); }
function monthDates(ym) {
  const [y, m] = ym.split('-').map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => ym + '-' + pad2(i + 1));
}
function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return Math.floor(t / 12) + '-' + pad2((t % 12) + 1);
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function labelDate(s, withYear) {
  const [y, m, d] = s.split('-').map(Number);
  return DOW3[dow(s)] + ' ' + d + ' ' + MON[m - 1] + (withYear ? ' ' + y : '');
}
function labelMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return MONTH_FULL[m - 1] + ' ' + y;
}

/* ---- day type & alternate Saturdays ---- */
function isWorkingSaturday(s, satRef) {
  if (!satRef || dow(satRef) !== 6 || dow(s) !== 6) return false;
  const weeks = daysBetween(satRef, s) / 7;
  return Math.abs(weeks) % 2 === 0;
}

function autoType(s, S) {
  const w = dow(s);
  if (w === 0) return 'sunday';
  if (w === 6) return isWorkingSaturday(s, S.satRef) ? 'workSat' : 'offSat';
  return 'weekday';
}

function typeOf(s, S, day) {
  return day && day.type && TYPES[day.type] ? day.type : autoType(s, S);
}

function isWorkType(t) { return t === 'weekday' || t === 'workSat'; }

/* ---- empty day ---- */
function blankDay(date) {
  return {
    date,
    type: '',
    prayers: [false, false, false, false, false],
    sleep: { bed: '', wake: '' },
    brain: 0,
    meals: { b: { d: false, t: '' }, l: { d: false, t: '' }, d: { d: false, t: '' } },
    water: 0,
    office: { leave: '', in: '', out: '', home: '' },
    learn: [],
    practical: false,
    recall: false,
    qa: false,
    learned: '',
    quran: [],
    ent: [],
    bad: [],
    note: '',
    custom: {},
    cswrun: {}
  };
}

/* fill any missing fields so old or partial documents never break the UI */
function normalizeDay(raw, date) {
  const b = blankDay(date);
  const d = Object.assign(b, raw || {});
  d.date = date;
  d.prayers = PRAYERS.map((_, i) => !!(raw && raw.prayers && raw.prayers[i]));
  d.sleep = Object.assign({ bed: '', wake: '' }, raw && raw.sleep);
  d.office = Object.assign({ leave: '', in: '', out: '', home: '' }, raw && raw.office);
  d.meals = {
    b: Object.assign({ d: false, t: '' }, raw && raw.meals && raw.meals.b),
    l: Object.assign({ d: false, t: '' }, raw && raw.meals && raw.meals.l),
    d: Object.assign({ d: false, t: '' }, raw && raw.meals && raw.meals.d)
  };
  ['learn', 'quran', 'ent', 'bad'].forEach(k => { d[k] = Array.isArray(d[k]) ? d[k] : []; });
  d.custom = d.custom && typeof d.custom === 'object' ? d.custom : {};
  d.cswrun = d.cswrun && typeof d.cswrun === 'object' ? d.cswrun : {};
  d.brain = Number(d.brain) || 0;
  d.water = Number(d.water) || 0;
  return d;
}

/* ---- per-day statistics and score ---- */
function computeDay(day, S) {
  const date = day && day.date;
  const d = day ? day : blankDay(date);
  const type = date ? typeOf(date, S, d) : 'weekday';
  const T = S.byType[type];

  const sleepR = span(d.sleep && d.sleep.bed, d.sleep && d.sleep.wake);
  const sleepMin = sleepR === null ? 0 : sleepR;
  const learnMin = sumEntries(d.learn);
  const nightLearnMin = (d.learn || []).filter(x => isNightStart(x.s) && entryMin(x) > 0)
    .reduce((a, x) => a + entryMin(x), 0);
  const quranMin = sumEntries(d.quran);
  const entMin = sumEntries(d.ent);
  const badMin = sumEntries(d.bad);
  const brainMin = Number(d.brain) || 0;
  const bottles = Number(d.water) || 0;
  const prayers = (d.prayers || []).filter(Boolean).length;

  const o = d.office || {};
  const officeR = span(o.in, o.out);
  const awayR = span(o.leave, o.home);
  const workMin = officeR === null ? 0 : officeR;
  const awayMin = awayR === null ? 0 : awayR;
  const commuteMin = officeR !== null && awayR !== null ? Math.max(0, awayR - officeR) : 0;

  const meals = ['b', 'l', 'd'].filter(k => d.meals && d.meals[k] && (d.meals[k].d || d.meals[k].t)).length;

  const habApplies = h => h.days === 'all' || (h.days === 'work' ? isWorkType(type) : !isWorkType(type));
  const custom = {};
  (S.habits || []).forEach(h => {
    const raw = d.custom && d.custom[h.id];
    const v = h.type === 'tick' ? (raw ? 1 : 0) : (Number(raw) || 0);
    custom[h.id] = { v, applies: habApplies(h) };
  });
  const anyCustom = Object.keys(custom).some(k => custom[k].v > 0);
  const has = !!(anyCustom || prayers || sleepR !== null || learnMin || quranMin || entMin || badMin ||
    brainMin || bottles || officeR !== null || awayR !== null || meals ||
    d.practical || d.recall || d.qa || (d.learned && d.learned.trim()) || (d.note && d.note.trim()));

  /* goals: each is one point; a goal with target 0 is not required that day */
  const goals = [];
  const en = S.enabled, ck = S.checks, P = S.priority;
  PRAYERS.forEach((p, i) => goals.push({ k: 'p' + i, label: p, met: !!(d.prayers && d.prayers[i]), on: en.prayers, grp: 'prayer', pri: P.prayers, w: P.prayers / 5 }));
  const G = (k, label, met, on, pk) => goals.push({ k, label, met, on, pri: P[pk], w: P[pk] });
  G('sleep', 'Sleep', sleepMin >= S.sleepH * 60 && sleepR !== null, en.sleep && S.sleepH > 0, 'sleep');
  G('learn', 'Learning', learnMin >= T.learn * 60 && learnMin > 0, en.learn && T.learn > 0, 'learn');
  G('water', 'Water', bottles >= S.waterL && bottles > 0, en.water && S.waterL > 0, 'water');
  G('brain', 'Brainstorm', brainMin >= T.brain && brainMin > 0, en.brain && T.brain > 0, 'brain');
  G('practical', 'Practical', !!d.practical, en.learn && ck.practical, 'practical');
  G('recall', 'Blank page', !!d.recall, en.learn && ck.recall, 'recall');
  G('qa', 'Q&A', !!d.qa, en.learn && ck.qa, 'qa');
  G('quran', 'Quran', quranMin >= T.quran && quranMin > 0, en.quran && T.quran > 0, 'quran');
  G('clean', 'No bad habits', has && badMin === 0 && (d.bad || []).length === 0, en.bad, 'bad');
  (S.habits || []).forEach(h => {
    const c = custom[h.id];
    if (!c.applies) return;
    goals.push({ k: 'h_' + h.id, label: h.name, met: h.type === 'tick' ? c.v > 0 : (h.target > 0 ? c.v >= h.target : c.v > 0), on: true, custom: true, pri: h.pri, w: h.pri });
  });

  const active = goals.filter(g => g.on);
  const metN = active.filter(g => g.met).length;
  const wAll = active.reduce((x, g) => x + g.w, 0);
  const score = wAll ? Math.round(active.filter(g => g.met).reduce((x, g) => x + g.w, 0) / wAll * 100) : 0;

  return {
    date, type, T, has,
    sleepLogged: sleepR !== null, sleepMin, learnMin, nightLearnMin, quranMin, entMin, badMin, brainMin,
    bottles, waterL: bottles, prayers, workMin, awayMin, commuteMin, officeLogged: officeR !== null,
    meals, custom, goals, goalsMet: metN, goalsTotal: active.length, score,
    badCount: (d.bad || []).length
  };
}

/* ---- aggregation over a list of dates ---- */
function aggregate(dates, daysMap, S) {
  const rows = dates.map(date => {
    const day = daysMap.get(date);
    return { date, day, c: computeDay(day ? normalizeDay(day, date) : blankDay(date), S) };
  });
  const logged = rows.filter(r => r.c.has);
  const sum = k => rows.reduce((a, r) => a + (r.c[k] || 0), 0);
  const avgOver = (k, pred) => {
    const rs = rows.filter(pred);
    return rs.length ? rs.reduce((a, r) => a + (r.c[k] || 0), 0) / rs.length : 0;
  };
  const sleepRows = rows.filter(r => r.c.sleepLogged);
  const officeRows = rows.filter(r => r.c.officeLogged);
  const targetSleep = S.sleepH * 60;
  const sleepDebt = sleepRows.reduce((a, r) => a + Math.max(0, targetSleep - r.c.sleepMin), 0);
  const best = logged.length ? logged.reduce((a, r) => (r.c.score > a.c.score ? r : a)) : null;
  const worst = logged.length ? logged.reduce((a, r) => (r.c.score < a.c.score ? r : a)) : null;
  const hab = {};
  (S.habits || []).forEach(h => {
    const rs = rows.filter(r => r.c.custom[h.id] && r.c.custom[h.id].applies && r.c.has);
    hab[h.id] = { sum: rs.reduce((x, r) => x + r.c.custom[h.id].v, 0), days: rs.length,
      met: rs.filter(r => { const g = r.c.goals.find(g => g.k === 'h_' + h.id); return g && g.met; }).length };
  });
  return {
    hab, rows, logged, daysLogged: logged.length,
    sum: {
      sleep: sum('sleepMin'), learn: sum('learnMin'), night: sum('nightLearnMin'), work: sum('workMin'),
      away: sum('awayMin'), quran: sum('quranMin'), ent: sum('entMin'), bad: sum('badMin'),
      brain: sum('brainMin'), water: sum('bottles'), prayers: sum('prayers')
    },
    avg: {
      sleep: avgOver('sleepMin', r => r.c.sleepLogged),
      learn: avgOver('learnMin', r => r.c.has),
      work: avgOver('workMin', r => r.c.officeLogged),
      quran: avgOver('quranMin', r => r.c.has),
      ent: avgOver('entMin', r => r.c.has),
      brain: avgOver('brainMin', r => r.c.has),
      water: avgOver('bottles', r => r.c.has),
      prayers: avgOver('prayers', r => r.c.has),
      score: avgOver('score', r => r.c.has)
    },
    counts: {
      sleep: sleepRows.length, office: officeRows.length,
      prayersFull: rows.filter(r => r.c.prayers === 5).length,
      cleanDays: logged.filter(r => r.c.badMin === 0 && r.c.badCount === 0).length,
      badDays: logged.filter(r => r.c.badMin > 0 || r.c.badCount > 0).length,
      nightDays: rows.filter(r => r.c.nightLearnMin > 0).length,
      qaDays: rows.filter(r => r.day && r.day.qa).length,
      practicalDays: rows.filter(r => r.day && r.day.practical).length,
      recallDays: rows.filter(r => r.day && r.day.recall).length
    },
    sleepDebt, best, worst
  };
}

/* label breakdowns for bad habits / entertainment */
function breakdown(rows, listKey, keyFn) {
  const map = new Map();
  rows.forEach(r => {
    (r.day && r.day[listKey] ? r.day[listKey] : []).forEach(x => {
      const k = (keyFn(x) || 'Unnamed').trim() || 'Unnamed';
      const cur = map.get(k) || { min: 0, times: 0 };
      cur.min += entryMin(x);
      cur.times += 1;
      map.set(k, cur);
    });
  });
  return Array.from(map.entries()).map(([k, v]) => ({ k, ...v })).sort((a, b) => b.min - a.min || b.times - a.times);
}

/* consecutive days ending today (or yesterday if today isn't met yet) where pred(computed) holds */
function streak(daysMap, S, today, pred) {
  let d = today, n = 0;
  const cFor = s => computeDay(daysMap.has(s) ? normalizeDay(daysMap.get(s), s) : blankDay(s), S);
  if (!pred(cFor(d))) d = addDays(d, -1);
  while (n < 4000) {
    const c = cFor(d);
    if (!pred(c)) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/* ---- dial segments for the 24h ring ---- */
function dialSegments(date, daysMap, S) {
  const day = normalizeDay(daysMap.get(date), date);
  const segs = { a: [], b: [] }; /* a = outer ring (sleep, work); b = inner ring (activities) */
  const push = (ring, cat, s, e) => {
    const a = toMin(s), z = toMin(e);
    if (a === null || z === null || a === z) return;
    if (z > a) segs[ring].push({ cat, from: a, to: z });
    else { segs[ring].push({ cat, from: a, to: 1440 }); segs[ring].push({ cat, from: 0, to: z }); }
  };
  /* sleep on this date: the part after midnight up to waking */
  const bed = toMin(day.sleep.bed), wake = toMin(day.sleep.wake);
  if (bed !== null && wake !== null && bed !== wake) {
    if (bed > wake) segs.a.push({ cat: 'sleep', from: 0, to: wake });
    else segs.a.push({ cat: 'sleep', from: bed, to: wake });
  }
  /* sleep that starts tonight is logged on the next date: show its evening part */
  const next = daysMap.get(addDays(date, 1));
  if (next && next.sleep) {
    const nb = toMin(next.sleep.bed), nw = toMin(next.sleep.wake);
    if (nb !== null && nw !== null && nb > nw) segs.a.push({ cat: 'sleep', from: nb, to: 1440 });
  }
  push('a', 'work', day.office.in, day.office.out);
  day.learn.forEach(x => push('b', 'learn', x.s, x.e));
  day.quran.forEach(x => push('b', 'quran', x.s, x.e));
  day.ent.forEach(x => push('b', 'ent', x.s, x.e));
  day.bad.forEach(x => push('b', 'bad', x.s, x.e));
  return segs;
}

if (typeof module !== 'undefined') {
  module.exports = {
    span, toMin, fromMin, entryMin, fmtDur, fmtH, sessionTag, isWorkingSaturday, autoType, typeOf, blankDay,
    normalizeDay, computeDay, aggregate, breakdown, streak, dialSegments, weekStartOf, addDays, dow, mergeSettings,
    DEFAULT_SETTINGS, SECTIONS, fmtTime12, monthDates, addMonths, labelDate, daysBetween, fmtTime12
  };
}
