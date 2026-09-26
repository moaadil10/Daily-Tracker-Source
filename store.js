/* ===== STATE + PERSISTENCE ===== */
const LS_DAYS = 'habit:v1:days';
const LS_SET = 'habit:v1:settings';

const S = {
  view: 'day',            // day | week | month | settings
  date: todayStr(),
  weekStart: weekStartOf(todayStr()),
  month: monthOf(todayStr()),
  days: new Map(),        // date -> normalized day doc
  settings: mergeSettings(null),
  mode: 'loading',        // loading | cloud | local
  sync: 'saved',          // saved | saving | error
  ready: false
};

const store = {
  daysCol: null,
  profileRef: null,
  pending: new Set(),
  timers: new Map(),
  chains: new Map(),
  ownRevs: new Set(),
  setTimer: null,
  onExternal: () => {},   // set by the UI
  onSettingsExternal: () => {},
  onSync: () => {}
};

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

function newRev() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function setSync(v) { S.sync = v; store.onSync(); }

function cleanDoc(d) { return JSON.parse(JSON.stringify(d)); }

/* ---- connect: cloud if the page runtime offers it, otherwise this device only ---- */
async function connectStore() {
  let db = null, user = null, uid = null;
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (user) uid = await user.id();
    }
  } catch (e) { db = null; uid = null; }

  if (db && uid) {
    try {
      store.profileRef = db.doc('data/users/' + uid + '/profile');
      store.daysCol = store.profileRef.collection('days');
      S.mode = 'cloud';
      await new Promise((resolve) => {
        let firstDays = false, firstSet = false;
        const done = () => { if (firstDays && firstSet) resolve(); };
        setTimeout(resolve, 6000); // never hang the UI
        store.profileRef.onSnapshot(snap => {
          const data = snap.exists ? snap.data() : null;
          const incoming = mergeSettings(data && data.settings);
          const changed = JSON.stringify(incoming) !== JSON.stringify(S.settings);
          if (!firstSet) { S.settings = incoming; firstSet = true; done(); if (S.ready) store.onSettingsExternal(); }
          else if (changed && !store.setTimer) { S.settings = incoming; store.onSettingsExternal(); }
        }, () => { firstSet = true; done(); });
        store.daysCol.orderBy('date', 'desc').limit(600).onSnapshot(snap => {
          if (!firstDays) {
            const ids = [];
            snap.docs.forEach(d => { const x = d.data(); if (x && !store.pending.has(d.id)) { S.days.set(d.id, normalizeDay(x, d.id)); ids.push(d.id); } });
            firstDays = true; done();
            if (S.ready && ids.length) store.onExternal(ids);
            return;
          }
          const touched = [];
          snap.docChanges().forEach(ch => {
            const id = ch.doc.id;
            if (ch.type === 'removed') { if (!store.pending.has(id)) { S.days.delete(id); touched.push(id); } return; }
            const x = ch.doc.data();
            if (!x) return;
            if (store.pending.has(id)) return;                       // local edit in flight wins
            if (x.rev && store.ownRevs.has(x.rev)) return;           // echo of our own save
            S.days.set(id, normalizeDay(x, id));
            touched.push(id);
          });
          if (touched.length) store.onExternal(touched);
        }, () => { firstDays = true; done(); setSync('error'); });
      });
      return;
    } catch (e) { /* fall through to local */ }
  }

  try { if (await connectSupabase()) return; } catch (e) { S.mode = 'local'; }

  S.mode = 'local';
  const saved = lsGet(LS_DAYS) || {};
  Object.keys(saved).forEach(k => S.days.set(k, normalizeDay(saved[k], k)));
  S.settings = mergeSettings(lsGet(LS_SET));
}

/* ---- days ---- */
function getDay(date) {
  if (!S.days.has(date)) S.days.set(date, blankDay(date));
  return S.days.get(date);
}

function touchDay(date) {
  const d = getDay(date);
  d.rev = newRev();
  d.updated = Date.now();
  store.pending.add(date);
  clearTimeout(store.timers.get(date));
  store.timers.set(date, setTimeout(() => flushDay(date), 650));
  setSync('saving');
}

function flushDay(date) {
  clearTimeout(store.timers.get(date));
  const prev = store.chains.get(date) || Promise.resolve();
  const next = prev.then(() => writeDay(date)).catch(() => {});
  store.chains.set(date, next);
  return next;
}

async function writeDay(date) {
  if (!store.pending.has(date)) return;
  const d = S.days.get(date);
  if (!d) { store.pending.delete(date); return; }
  const doc = cleanDoc(d);
  const rev = doc.rev;
  store.pending.delete(date);
  try {
    if (S.mode === 'cloud') {
      store.ownRevs.add(rev);
      if (store.ownRevs.size > 40) store.ownRevs.delete(store.ownRevs.values().next().value);
      await store.daysCol.doc(date).set(doc);
    } else if (S.mode === 'supabase') {
      store.ownRevs.add(rev);
      if (store.ownRevs.size > 40) store.ownRevs.delete(store.ownRevs.values().next().value);
      await supaWriteDay(date, doc);
    } else {
      const all = {};
      S.days.forEach((v, k) => { all[k] = v; });
      if (!lsSet(LS_DAYS, all)) throw new Error('storage');
    }
    if (!store.pending.size) setSync('saved');
  } catch (e) {
    store.pending.add(date);   // keep it dirty so the next edit retries
    setSync('error');
  }
}

function flushAll() {
  return Promise.all(Array.from(store.pending).map(flushDay));
}

/* ---- settings ---- */
function touchSettings() {
  setSync('saving');
  clearTimeout(store.setTimer);
  store.setTimer = setTimeout(async () => {
    store.setTimer = null;
    try {
      if (S.mode === 'cloud') await store.profileRef.set({ settings: cleanDoc(S.settings), updated: Date.now() });
      else if (S.mode === 'supabase') await supaWriteSettings();
      else if (!lsSet(LS_SET, S.settings)) throw new Error('storage');
      if (!store.pending.size) setSync('saved');
    } catch (e) { setSync('error'); }
  }, 600);
}

/* ---- exports ---- */
function csvEscape(v) {
  const s = String(v === undefined || v === null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function buildCsv() {
  const head = ['date', 'day_type', 'score_pct', 'prayers_of_5', 'sleep_bed', 'sleep_wake', 'sleep_min', 'brainstorm_min',
    'breakfast', 'lunch', 'dinner', 'water_litres', 'left_home', 'reached_office', 'left_office', 'reached_home',
    'office_min', 'learning_min', 'night_learning_min', 'practical', 'blank_page', 'qa', 'what_learned',
    'quran_min', 'entertainment_min', 'entertainment_detail', 'bad_habit_min', 'bad_habit_detail', 'note'].concat((S.settings.habits || []).map(h => 'habit_' + h.name));
  const lines = [head.join(',')];
  Array.from(S.days.keys()).sort().forEach(date => {
    const d = normalizeDay(S.days.get(date), date);
    const c = computeDay(d, S.settings);
    const detail = (list, f) => list.map(x => f(x) + ' ' + (x.s && x.e ? x.s + '-' + x.e : (entryMin(x) + 'm'))).join(' | ');
    lines.push([
      date, TYPES[c.type], c.score, c.prayers, d.sleep.bed, d.sleep.wake, c.sleepMin, d.brain,
      d.meals.b.t || (d.meals.b.d ? 'yes' : ''), d.meals.l.t || (d.meals.l.d ? 'yes' : ''), d.meals.d.t || (d.meals.d.d ? 'yes' : ''),
      d.water, d.office.leave, d.office.in, d.office.out, d.office.home,
      c.workMin, c.learnMin, c.nightLearnMin, d.practical ? 'yes' : '', d.recall ? 'yes' : '', d.qa ? 'yes' : '', d.learned,
      c.quranMin, c.entMin, detail(d.ent, x => x.k || 'Other'), c.badMin, detail(d.bad, x => x.n || 'Unnamed'), d.note
    ].concat((S.settings.habits || []).map(h => { const v = d.custom && d.custom[h.id]; return h.type === 'tick' ? (v ? 'yes' : '') : (v || ''); })).map(csvEscape).join(','));
  });
  return lines.join('\n');
}

function buildBackup() {
  const days = {};
  S.days.forEach((v, k) => { days[k] = v; });
  return JSON.stringify({ app: 'daily-tracker', version: 1, exported: new Date().toISOString(), settings: S.settings, days }, null, 2);
}
