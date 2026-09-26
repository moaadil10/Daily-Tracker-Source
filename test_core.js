const c = require('./core.js');
const assert = require('assert');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok', name); };

t('span crosses midnight', () => {
  assert.strictEqual(c.span('23:30', '05:30'), 360);
  assert.strictEqual(c.span('22:00', '23:15'), 75);
  assert.strictEqual(c.span('00:30', '07:00'), 390);
  assert.strictEqual(c.span('', '07:00'), null);
  assert.strictEqual(c.span('25:00', '07:00'), null);
});
t('entryMin range wins, else minutes', () => {
  assert.strictEqual(c.entryMin({ s: '22:00', e: '22:45' }), 45);
  assert.strictEqual(c.entryMin({ m: 20 }), 20);
  assert.strictEqual(c.entryMin({ s: '22:00', e: '', m: 15 }), 15);
  assert.strictEqual(c.entryMin({}), 0);
});
t('fmtDur', () => {
  assert.strictEqual(c.fmtDur(450), '7h 30m');
  assert.strictEqual(c.fmtDur(60), '1h');
  assert.strictEqual(c.fmtDur(45), '45m');
  assert.strictEqual(c.fmtDur(null), '\u2014');
});
t('alternate saturdays', () => {
  const ref = '2026-09-19'; // a Saturday
  assert.strictEqual(c.dow(ref), 6);
  assert.ok(c.isWorkingSaturday('2026-09-19', ref));
  assert.ok(!c.isWorkingSaturday('2026-09-26', ref));
  assert.ok(c.isWorkingSaturday('2026-10-03', ref));
  assert.ok(c.isWorkingSaturday('2026-09-05', ref)); // before ref, same parity
  assert.ok(!c.isWorkingSaturday('2026-09-12', ref));
  assert.ok(!c.isWorkingSaturday('2026-09-18', ref)); // not a Saturday
  assert.ok(c.isWorkingSaturday('2027-01-02', ref) === (Math.abs(c.daysBetween(ref,'2027-01-02')/7)%2===0));
});
t('day types', () => {
  const S = c.mergeSettings({ satRef: '2026-09-19' });
  assert.strictEqual(c.autoType('2026-09-20', S), 'sunday');
  assert.strictEqual(c.autoType('2026-09-21', S), 'weekday');
  assert.strictEqual(c.autoType('2026-09-19', S), 'workSat');
  assert.strictEqual(c.autoType('2026-09-26', S), 'offSat');
  assert.strictEqual(c.typeOf('2026-09-26', S, { type: 'workSat' }), 'workSat');
  const S2 = c.mergeSettings({});
  assert.strictEqual(c.autoType('2026-09-19', S2), 'offSat');
});
t('week start is Monday', () => {
  assert.strictEqual(c.weekStartOf('2026-09-20'), '2026-09-14'); // Sunday -> Monday before
  assert.strictEqual(c.weekStartOf('2026-09-14'), '2026-09-14');
  assert.strictEqual(c.weekStartOf('2026-09-19'), '2026-09-14');
});
t('computeDay full day scoring', () => {
  const S = c.mergeSettings({ satRef: '2026-09-19' });
  const d = c.normalizeDay({
    prayers: [true, true, true, true, false],
    sleep: { bed: '23:30', wake: '05:30' },
    brain: 25, water: 3,
    office: { leave: '08:15', in: '09:00', out: '19:00', home: '19:45' },
    learn: [{ s: '22:00', e: '23:30', t: 'ASP.NET' }],
    practical: true, recall: true, qa: false,
    quran: [{ m: 12 }],
    ent: [{ s: '20:00', e: '21:00', k: 'Football' }],
    bad: []
  }, '2026-09-22');
  const r = c.computeDay(d, S);
  assert.strictEqual(r.type, 'weekday');
  assert.strictEqual(r.sleepMin, 360);
  assert.strictEqual(r.workMin, 600);
  assert.strictEqual(r.awayMin, 690);
  assert.strictEqual(r.commuteMin, 90);
  assert.strictEqual(r.learnMin, 90);
  assert.strictEqual(r.nightLearnMin, 90);
  assert.strictEqual(r.entMin, 60);
  assert.strictEqual(r.prayers, 4);
  // goals: 4 prayers + sleep(6h<7h no) + learn(1.5>=1.5 yes) + water yes + brain yes + practical + recall + qa no + quran(12>=10 yes) + clean yes = 4+1+1+1+1+1+1+1 = 11? count
  const met = r.goals.filter(g => g.on && g.met).map(g => g.k);
  assert.deepStrictEqual(met, ['p0','p1','p2','p3','learn','water','brain','practical','recall','quran','clean']);
  assert.strictEqual(r.goalsTotal, 14);
  const wt = (g0) => g0.reduce((a, g) => a + g.w, 0);
  assert.strictEqual(r.score, Math.round(wt(r.goals.filter(g => g.on && g.met)) / wt(r.goals.filter(g => g.on)) * 100));
});
t('empty day: has=false, clean not met', () => {
  const S = c.mergeSettings({});
  const r = c.computeDay(c.blankDay('2026-09-22'), S);
  assert.strictEqual(r.has, false);
  assert.strictEqual(r.score, 0);
});
t('bad habit breaks clean', () => {
  const S = c.mergeSettings({});
  const d = c.normalizeDay({ prayers: [true,false,false,false,false], bad: [{ n: 'x', m: 0 }] }, '2026-09-22');
  const r = c.computeDay(d, S);
  assert.ok(!r.goals.find(g => g.k === 'clean').met);
});
t('zero target not required', () => {
  const S = c.mergeSettings({ byType: { weekday: { learn: 0, brain: 0, quran: 0 } } });
  const r = c.computeDay(c.normalizeDay({ prayers:[true,true,true,true,true] }, '2026-09-22'), S);
  assert.strictEqual(r.goalsTotal, 11);
});
t('aggregate week', () => {
  const S = c.mergeSettings({ satRef: '2026-09-19' });
  const m = new Map();
  m.set('2026-09-21', { prayers:[true,true,true,true,true], sleep:{bed:'23:00',wake:'06:00'}, water:3, learn:[{s:'21:00',e:'22:30'}] });
  m.set('2026-09-22', { prayers:[true,true,false,false,false], sleep:{bed:'01:00',wake:'06:00'}, water:2, bad:[{n:'scroll', s:'20:00', e:'20:30'}] });
  const dates = Array.from({length:7},(_,i)=>c.addDays('2026-09-21', i));
  const a = c.aggregate(dates, m, S);
  assert.strictEqual(a.daysLogged, 2);
  assert.strictEqual(a.sum.sleep, 420 + 300);
  assert.strictEqual(a.avg.sleep, 360);
  assert.strictEqual(a.sum.water, 5);
  assert.strictEqual(a.sum.prayers, 7);
  assert.strictEqual(a.counts.prayersFull, 1);
  assert.strictEqual(a.sleepDebt, 0 + 120);
  assert.strictEqual(a.sum.bad, 30);
  assert.strictEqual(a.counts.badDays, 1);
  const bd = c.breakdown(a.rows, 'bad', x => x.n);
  assert.deepStrictEqual(bd, [{ k: 'scroll', min: 30, times: 1 }]);
});
t('streak', () => {
  const S = c.mergeSettings({});
  const m = new Map();
  ['2026-09-17','2026-09-18','2026-09-19'].forEach(d => m.set(d, { prayers:[true,true,true,true,true] }));
  assert.strictEqual(c.streak(m, S, '2026-09-19', x => x.prayers === 5), 3);
  assert.strictEqual(c.streak(m, S, '2026-09-20', x => x.prayers === 5), 3); // today not yet done -> counts from yesterday
});
t('dial segments cross midnight', () => {
  const S = c.mergeSettings({});
  const m = new Map();
  m.set('2026-09-21', { sleep: { bed: '23:30', wake: '05:30' } });
  m.set('2026-09-20', {});
  const s = c.dialSegments('2026-09-21', m, S);
  assert.deepStrictEqual(s.a, [{ cat: 'sleep', from: 0, to: 330 }]);
  m.set('2026-09-22', { sleep: { bed: '23:00', wake: '06:00' } });
  const s2 = c.dialSegments('2026-09-21', m, S);
  assert.ok(s2.a.some(x => x.from === 1380 && x.to === 1440));
});
t('normalize old partial doc', () => {
  const d = c.normalizeDay({ prayers: [true] , learn: null }, '2026-09-22');
  assert.strictEqual(d.prayers.length, 5);
  assert.ok(Array.isArray(d.learn));
  assert.strictEqual(d.meals.b.t, '');
});
t('mergeSettings ignores bad values', () => {
  const s = c.mergeSettings({ sleepH: 'x', waterL: -1, theme: 'neon', byType: { weekday: { learn: 'a' } } });
  assert.strictEqual(s.sleepH, 7); assert.strictEqual(s.waterL, 3); assert.strictEqual(s.theme, 'auto');
  assert.strictEqual(s.byType.weekday.learn, 1.5);
});
t('switching habits off removes them from the score', () => {
  const S = c.mergeSettings({ enabled: { prayers: false, bad: false }, checks: { qa: false } });
  const r = c.computeDay(c.normalizeDay({ practical: true }, '2026-09-22'), S);
  assert.strictEqual(r.goalsTotal, 14 - 5 - 1 - 1);
  assert.ok(!r.goals.find(g => g.k === 'p0').on);
  const S2 = c.mergeSettings({ enabled: { learn: false } });
  assert.strictEqual(c.computeDay(c.blankDay('2026-09-22'), S2).goalsTotal, 14 - 4);
});
t('sub-minute stopwatch session still counts via minutes', () => {
  assert.strictEqual(c.entryMin({ s: '22:00', e: '22:00', m: 1 }), 1);
  assert.strictEqual(c.entryMin({ s: '22:00', e: '22:10', m: 1 }), 10);
});
t('custom habits: tick, count and timer feed the score', () => {
  const S = c.mergeSettings({ enabled: { prayers: false, sleep: false, brain: false, meals: false, water: false, office: false, learn: false, quran: false, ent: false, bad: false, note: false },
    habits: [{ id: 'read', name: 'Reading', type: 'timer', target: 20, days: 'all' }, { id: 'gym', name: 'Gym', type: 'tick', days: 'work' },
      { id: 'pages', name: 'Pages', type: 'count', target: 10, unit: 'pages', days: 'off' }, { name: 'bad' }, { id: 'x', name: '', type: 'tick' }] });
  assert.strictEqual(S.habits.length, 3);
  const d = c.normalizeDay({ custom: { read: 25, gym: true, pages: 3 } }, '2026-09-22'); // Tuesday = work day
  const r = c.computeDay(d, S);
  assert.strictEqual(r.goalsTotal, 2);                    // pages only applies on off days
  assert.strictEqual(r.goalsMet, 2);
  assert.ok(r.has);
  const sun = c.computeDay(c.normalizeDay({ custom: { pages: 3 } }, '2026-09-20'), S);
  assert.strictEqual(sun.goalsTotal, 2); assert.strictEqual(sun.goalsMet, 0); // reading + pages; both unmet
  const m = new Map([['2026-09-22', { custom: { read: 25 } }], ['2026-09-21', { custom: { read: 10 } }]]);
  const a = c.aggregate(['2026-09-21', '2026-09-22'], m, S);
  assert.deepStrictEqual(a.hab.read, { sum: 35, days: 2, met: 1 });
});
t('seconds count: 22:00:05 to 22:31:40 is 31m 35s', () => {
  assert.strictEqual(c.span('22:00:05', '22:31:40'), (31 * 60 + 35) / 60);
  assert.strictEqual(c.fmtDur(c.span('22:00:05', '22:31:40')), '31m 35s');
  assert.strictEqual(c.fmtDur(0.75), '45s');
  assert.strictEqual(c.fmtDur(61.5), '1h 1m 30s');
  assert.strictEqual(c.fmtDur(450), '7h 30m');
  assert.strictEqual(c.span('23:59:30', '00:00:10'), 40 / 60);
  assert.strictEqual(c.entryMin({ s: '10:00:00', e: '10:00:20' }), 20 / 60);
  assert.strictEqual(c.fmtTime12('22:31:40'), '10:31 pm');
});
t('priority weights the score and prayers share one weight', () => {
  const mk = pr => c.mergeSettings({ enabled: { sleep: false, brain: false, meals: false, water: false, office: false, learn: false, quran: false, ent: false, bad: false, note: false },
    priority: { prayers: pr }, habits: [{ id: 'a', name: 'A', type: 'tick', pri: 1 }] });
  const day = c.normalizeDay({ prayers: [true, true, true, true, true] }, '2026-09-22');
  assert.strictEqual(c.computeDay(day, mk(3)).score, 75);   // prayers weight 3, habit weight 1
  assert.strictEqual(c.computeDay(day, mk(1)).score, 50);
  assert.strictEqual(c.computeDay(day, mk(3)).goalsTotal, 6); // counts still show 5 prayers + 1 habit
  assert.strictEqual(c.mergeSettings({ priority: { water: 9 } }).priority.water, 2);
});
console.log(n + ' tests passed');
