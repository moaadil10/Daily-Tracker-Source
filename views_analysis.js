/* ===== CHARTS (hand-drawn SVG, no libraries) ===== */
function niceCeil(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return steps.find(x => x >= n - 1e-9) * p;
}

/* series: [{name, color, vals}] stacked; labels: x labels; titles: tooltip per bar */
function barChart(opt) {
  const W = 340, H = opt.h || 150, L = 30, B = 20, T = 8, R = 4;
  const n = opt.labels.length;
  const totals = opt.labels.map((_, i) => opt.series.reduce((a, s) => a + (s.vals[i] || 0), 0));
  const raw = Math.max(opt.max || 0, opt.target || 0, ...totals);
  const top = opt.max && raw <= opt.max ? opt.max : niceCeil(raw * 1.02);
  const iw = W - L - R, ih = H - B - T;
  const step = iw / n, bw = Math.min(26, step * 0.66);
  const y = v => T + ih - (v / top) * ih;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.title) + '">';
  [0, 0.5, 1].forEach(f => {
    const v = top * f;
    s += '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>';
    s += '<text x="' + (L - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + (opt.axisFmt ? opt.axisFmt(v) : +v.toFixed(1)) + '</text>';
  });
  for (let i = 0; i < n; i++) {
    const cx = L + step * i + step / 2;
    let acc = 0;
    opt.series.forEach(se => {
      const v = se.vals[i] || 0;
      if (v > 0) {
        s += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + y(acc + v).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, (v / top) * ih).toFixed(1) + '" rx="2" fill="' + se.color + '"><title>' +
          esc(opt.labels[i] + ': ' + (opt.tipFmt ? opt.tipFmt(v, se) : v)) + '</title></rect>';
      }
      acc += v;
    });
    if (opt.showLabel(i)) s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle">' + esc(opt.tickLabels[i]) + '</text>';
  }
  if (opt.target) s += '<line class="tgt" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(opt.target).toFixed(1) + '" y2="' + y(opt.target).toFixed(1) + '"><title>Goal</title></line>';
  return s + '</svg>';
}

function chartBlock(title, cap, opt) {
  return '<div class="chart"><h3>' + esc(title) + '</h3><p class="cap">' + esc(cap) + '</p>' + barChart(Object.assign({ title }, opt)) + '</div>';
}

/* build the chart set for a list of dates */
function chartsFor(dates, a, month) {
  const rowsByDate = new Map(a.rows.map(r => [r.date, r]));
  const cOf = d => (rowsByDate.get(d) ? rowsByDate.get(d).c : computeDay(blankDay(d), S.settings));
  const labels = dates.map(d => labelDate(d));
  const tickLabels = dates.map(d => month ? String(+d.slice(8)) : DOW3[dow(d)]);
  const showLabel = month ? (i => i === 0 || (i + 1) % 5 === 0) : (() => true);
  const base = { labels, tickLabels, showLabel };
  const hours = k => dates.map(d => +(cOf(d)[k] / 60).toFixed(2));
  const t = S.settings;
  const avgLearnTarget = dates.reduce((s, d) => s + t.byType[typeOf(d, t, S.days.get(d))].learn, 0) / dates.length;
  const fh = (v) => fmtDur(v * 60);
  const en = t.enabled, cs = [];
  if (en.sleep) cs.push(chartBlock('Sleep', 'Hours per night. Dashed line is your goal.', Object.assign({ series: [{ name: 'Sleep', color: 'var(--sleep)', vals: hours('sleepMin') }], target: t.sleepH, axisFmt: v => +v.toFixed(1), tipFmt: fh }, base)));
  if (en.learn) cs.push(chartBlock('Learning', 'Hours per day. Dashed line is the average goal.', Object.assign({ series: [{ name: 'Learning', color: 'var(--learn)', vals: hours('learnMin') }], target: +avgLearnTarget.toFixed(2), tipFmt: fh }, base)));
  if (en.water) cs.push(chartBlock('Water', 'Litres per day.', Object.assign({ series: [{ name: 'Water', color: 'var(--water)', vals: dates.map(d => cOf(d).bottles) }], target: t.waterL, tipFmt: v => v + ' L' }, base)));
  if (en.office) cs.push(chartBlock('Office hours', 'Hours at the office.', Object.assign({ series: [{ name: 'Office', color: 'var(--work)', vals: hours('workMin') }], tipFmt: fh }, base)));
  if (en.prayers) cs.push(chartBlock('Prayers', 'Out of five each day.', Object.assign({ series: [{ name: 'Prayers', color: 'var(--prayer)', vals: dates.map(d => cOf(d).prayers) }], target: 5, max: 5, tipFmt: v => v + ' of 5' }, base)));
  cs.push(chartBlock('Daily score', 'Percentage of goals met.', Object.assign({ series: [{ name: 'Score', color: 'var(--ok)', vals: dates.map(d => cOf(d).score) }], max: 100, tipFmt: v => v + '%' }, base)));
  const fun = [];
  if (en.ent) fun.push({ name: 'Entertainment', color: 'var(--ent)', vals: dates.map(d => cOf(d).entMin) });
  if (en.bad) fun.push({ name: 'Bad habits', color: 'var(--bad)', vals: dates.map(d => cOf(d).badMin) });
  if (fun.length) cs.push(chartBlock('Entertainment and bad habits', 'Minutes per day.', Object.assign({ series: fun, tipFmt: (v, se) => se.name + ' ' + fmtDur(v) }, base)));
  const mins = [];
  if (en.quran) mins.push({ name: 'Quran', color: 'var(--quran)', vals: dates.map(d => cOf(d).quranMin) });
  if (en.brain) mins.push({ name: 'Brainstorm', color: 'var(--note)', vals: dates.map(d => cOf(d).brainMin) });
  if (mins.length) cs.push(chartBlock('Quran and brainstorm', 'Minutes per day.', Object.assign({ series: mins, tipFmt: (v, se) => se.name + ' ' + fmtDur(v) }, base)));
  t.habits.slice(0, 6).forEach(hb => {
    const vals = dates.map(d => { const cc = cOf(d).custom[hb.id]; return cc && cc.applies ? +cc.v.toFixed(1) : 0; });
    cs.push(chartBlock(hb.name, hb.type === 'tick' ? 'Done (1) or not (0).' : 'Per day, in ' + habUnit(hb) + '.', Object.assign({ series: [{ name: hb.name, color: hb.color, vals }], target: hb.type === 'tick' ? 0 : hb.target, max: hb.type === 'tick' ? 1 : 0, tipFmt: v => v + ' ' + habUnit(hb) }, base)));
  });
  return '<div class="charts">' + cs.join('') + '</div>';
}

/* ===== LEDGER (summary table used by week and month) ===== */
function targetSum(dates, key) {
  return dates.reduce((s, d) => s + S.settings.byType[typeOf(d, S.settings, S.days.get(d))][key], 0);
}

function ledgerHtml(a, elapsed) {
  const t = S.settings, n = elapsed.length;
  const rows = [];
  const row = (cat, name, total, avg, target, ok, okText) => rows.push('<tr><td><i class="dot" style="background:' + cat + '"></i>' + esc(name) + '</td><td>' + esc(total) + '</td><td>' + esc(avg) + '</td><td>' + esc(target) + '</td><td class="' + (ok === true ? 'good' : ok === false ? 'bad' : '') + '">' + esc(ok === null ? '\u2014' : okText || (ok ? 'Met' : 'Short')) + '</td></tr>');
  const learnT = targetSum(elapsed, 'learn'), brainT = targetSum(elapsed, 'brain'), quranT = targetSum(elapsed, 'quran');
  const en = t.enabled, ck = t.checks;
  const everyDay = k => (a.daysLogged ? a.counts[k] === a.daysLogged : null);
  if (en.sleep) row('var(--sleep)', 'Sleep', fmtDur(a.sum.sleep), a.counts.sleep ? fmtDur(a.avg.sleep) + ' a night' : '\u2014', t.sleepH + 'h a night', a.counts.sleep ? a.avg.sleep >= t.sleepH * 60 : null);
  if (en.learn) {
    row('var(--learn)', 'Learning', fmtDur(a.sum.learn), fmtDur(a.avg.learn) + ' a day', fmtDur(learnT * 60), a.daysLogged ? a.sum.learn >= learnT * 60 : null);
    row('var(--learn)', 'Night learning', fmtDur(a.sum.night), a.counts.nightDays + ' nights', '\u2014', null);
    if (ck.practical) row('var(--learn)', 'Practical learning', a.counts.practicalDays + ' days', '\u2014', 'Every day', everyDay('practicalDays'));
    if (ck.recall) row('var(--learn)', 'Blank-page answering', a.counts.recallDays + ' days', '\u2014', 'Every day', everyDay('recallDays'));
    if (ck.qa) row('var(--learn)', 'Q&A', a.counts.qaDays + ' days', '\u2014', 'Every day', everyDay('qaDays'));
  }
  if (en.office) row('var(--work)', 'Office', fmtDur(a.sum.work), a.counts.office ? fmtDur(a.avg.work) + ' a day' : '\u2014', '\u2014', null);
  if (en.water) row('var(--water)', 'Water', a.sum.water + ' L', a.avg.water.toFixed(1) + ' L a day', t.waterL + ' L a day', a.daysLogged ? a.avg.water >= t.waterL : null);
  if (en.prayers) row('var(--prayer)', 'Prayers', a.sum.prayers + ' of ' + (5 * a.daysLogged), a.avg.prayers.toFixed(1) + ' a day', 'All 5 daily', a.daysLogged ? a.counts.prayersFull === a.daysLogged : null, a.counts.prayersFull + ' full days');
  if (en.brain) row('var(--note)', 'Brainstorm', a.sum.brain + ' min', Math.round(a.avg.brain) + ' min a day', brainT + ' min', a.daysLogged ? a.sum.brain >= brainT : null);
  if (en.quran) row('var(--quran)', 'Quran', fmtDur(a.sum.quran), fmtDur(a.avg.quran) + ' a day', fmtDur(quranT), a.daysLogged ? a.sum.quran >= quranT : null);
  if (en.ent) row('var(--ent)', 'Entertainment', fmtDur(a.sum.ent), fmtDur(a.avg.ent) + ' a day', '\u2014', null);
  if (en.bad) row('var(--bad)', 'Bad habits', fmtDur(a.sum.bad), a.counts.badDays + ' days', 'None', a.daysLogged ? a.counts.badDays === 0 : null, a.counts.badDays ? a.counts.badDays + ' days' : 'Clean');
  t.habits.forEach(hb => {
    const x = a.hab[hb.id];
    if (!x) return;
    const unit = habUnit(hb), avgv = x.days ? x.sum / x.days : 0;
    if (hb.type === 'tick') row(hb.color, hb.name, x.met + ' of ' + x.days + ' days', x.days ? Math.round(x.met / x.days * 100) + '% of days' : '\u2014', 'Every day', x.days ? x.met === x.days : null, '');
    else row(hb.color, hb.name, (hb.type === 'timer' ? fmtDur(x.sum) : +x.sum.toFixed(1) + ' ' + unit), x.days ? (hb.type === 'timer' ? fmtDur(avgv) : +avgv.toFixed(1) + ' ' + unit) + ' a day' : '\u2014', hb.target ? hb.target + ' ' + unit : '\u2014', hb.target && x.days ? avgv >= hb.target : null);
  });
  row('var(--ok)', 'Average score', a.daysLogged ? Math.round(a.avg.score) + '%' : '\u2014', a.daysLogged + ' days logged', '\u2014', null);
  return '<div class="scroll-x"><table class="ledger"><thead><tr><th>Measure</th><th>Total</th><th>Average</th><th>Goal</th><th>Result</th></tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}

function insightsHtml(a, n) {
  const t = S.settings, out = [];
  const add = (txt, cls) => out.push('<li class="' + (cls || '') + '">' + esc(txt) + '</li>');
  if (!a.daysLogged) return '<p class="muted">Nothing logged in this period yet.</p>';
  const sc = Math.round(a.avg.score);
  add(a.daysLogged + ' of ' + n + ' days logged with an average score of ' + sc + '%.', sc >= 70 ? 'g' : sc >= 50 ? 'w' : 'r');
  if (a.best) add('Best day was ' + labelDate(a.best.date) + ' at ' + a.best.c.score + '%' + (a.worst && a.worst.date !== a.best.date ? ', hardest was ' + labelDate(a.worst.date) + ' at ' + a.worst.c.score + '%.' : '.'));
  const en = t.enabled, ck = t.checks;
  if (en.sleep && a.counts.sleep) add('Sleep averaged ' + fmtDur(a.avg.sleep) + ' against a ' + t.sleepH + 'h goal' + (a.sleepDebt > 0 ? ', a shortfall of ' + fmtDur(a.sleepDebt) + ' across ' + a.counts.sleep + ' nights.' : ', with no shortfall.'), a.avg.sleep >= t.sleepH * 60 ? 'g' : 'w');
  if (en.prayers) add('All five prayers on ' + a.counts.prayersFull + ' of ' + a.daysLogged + ' logged days.', a.counts.prayersFull === a.daysLogged ? 'g' : 'w');
  if (en.learn && a.counts.nightDays) add('Night learning on ' + a.counts.nightDays + ' nights, ' + fmtDur(a.sum.night) + ' in total.');
  if (en.learn && (ck.practical || ck.recall || ck.qa)) add([ck.practical ? 'Practical learning on ' + a.counts.practicalDays + ' days' : '', ck.recall ? 'blank-page answering on ' + a.counts.recallDays : '', ck.qa ? 'Q&A on ' + a.counts.qaDays : ''].filter(Boolean).join(', ') + '.');
  if (en.water) add('Water averaged ' + a.avg.water.toFixed(1) + ' L a day against a ' + t.waterL + ' L goal.', a.avg.water >= t.waterL ? 'g' : 'w');
  if (en.office && a.counts.office) add('Office time averaged ' + fmtDur(a.avg.work) + ' on ' + a.counts.office + ' days.');
  if (en.ent && a.sum.ent) add('Entertainment and outings took ' + fmtDur(a.sum.ent) + ', about ' + fmtDur(a.avg.ent) + ' a day.');
  if (en.bad) { if (a.counts.badDays) add('Bad habits on ' + a.counts.badDays + ' days, ' + fmtDur(a.sum.bad) + ' in total.', 'r'); else add('No bad habits logged.', 'g'); }
  return '<div class="insights"><ul>' + out.join('') + '</ul></div>';
}

function breakdownHtml(title, list, color) {
  if (!list.length) return '';
  const max = Math.max(...list.map(x => x.min), 1);
  return '<div class="block"><h2>' + esc(title) + '</h2><div class="scroll-x"><table class="ledger"><thead><tr><th>Type</th><th>Times</th><th>Total time</th><th></th></tr></thead><tbody>' +
    list.slice(0, 10).map(x => '<tr><td>' + esc(x.k) + '</td><td>' + x.times + '</td><td>' + fmtDur(x.min) + '</td><td style="width:38%"><span class="meter" style="display:block"><b style="width:' + (x.min / max * 100).toFixed(0) + '%;background:' + color + '"></b></span></td></tr>').join('') +
    '</tbody></table></div></div>';
}

function dayTableHtml(rows) {
  const en = S.settings.enabled, dash = '\u2014';
  const cols = [
    [true, 'Type', c => TYPES[c.type]], [true, 'Score', c => (c.has ? c.score + '%' : dash)],
    [en.prayers, 'Prayers', c => (c.has ? c.prayers + '/5' : dash)], [en.sleep, 'Sleep', c => (c.sleepLogged ? fmtDur(c.sleepMin) : dash)],
    [en.learn, 'Learning', c => (c.learnMin ? fmtDur(c.learnMin) : dash)], [en.water, 'Water', c => (c.bottles ? c.bottles + ' L' : dash)],
    [en.office, 'Office', c => (c.officeLogged ? fmtDur(c.workMin) : dash)], [en.ent, 'Fun', c => (c.entMin ? fmtDur(c.entMin) : dash)],
    [en.bad, 'Bad', c => (c.badMin || c.badCount ? fmtDur(c.badMin) : dash), c => (c.badMin || c.badCount ? 'bad' : '')]
  ].filter(x => x[0]);
  return '<div class="scroll-x"><table class="ledger wide"><thead><tr><th>Day</th>' + cols.map(x => '<th>' + x[1] + '</th>').join('') + '</tr></thead><tbody>' +
    rows.map(r => '<tr' + (r.date > todayStr() ? ' style="opacity:.5"' : '') + '><td><button type="button" class="link" data-open="' + r.date + '">' + esc(labelDate(r.date)) + '</button></td>' +
      cols.map(x => '<td class="' + (x[3] ? x[3](r.c) : '') + '">' + esc(x[2](r.c)) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
}

/* ===== WEEK ===== */
function renderWeek() {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(S.weekStart, i));
  const today = todayStr();
  const elapsed = dates.filter(d => d <= today);
  const a = aggregate(elapsed, S.days, S.settings);
  const full = aggregate(dates, S.days, S.settings);
  const isThis = S.weekStart === weekStartOf(today);
  let h = '<div class="topbar"><h1>Week</h1><span class="sync" data-sync></span><span class="spacer"></span><div class="datewrap">' +
    '<button type="button" class="iconbtn" data-act="wk-prev" aria-label="Previous week">' + ICON.prev + '</button>' +
    '<span style="min-width:150px;text-align:center;font-weight:600">' + esc(labelDate(dates[0]) + ' \u2013 ' + labelDate(dates[6])) + '</span>' +
    '<button type="button" class="iconbtn" data-act="wk-next" aria-label="Next week">' + ICON.next + '</button>' +
    (isThis ? '' : '<button type="button" class="btn small" data-act="wk-today">This week</button>') + '</div></div>';
  h += '<div class="block"><h2>Summary</h2>' + ledgerHtml(a, elapsed) + '</div>';
  h += '<div class="block"><h2>What stands out</h2>' + insightsHtml(a, elapsed.length) + '</div>';
  h += '<div class="block"><h2>Trends</h2>' + chartsFor(dates, full, false) + '</div>';
  h += '<div class="block"><h2>Day by day</h2>' + dayTableHtml(full.rows) + '</div>';
  const bad = breakdown(full.rows, 'bad', x => x.n), ent = breakdown(full.rows, 'ent', x => x.k || 'Other');
  if (S.settings.enabled.bad) h += breakdownHtml('Bad habits this week', bad, 'var(--bad)');
  if (S.settings.enabled.ent) h += breakdownHtml('Entertainment this week', ent, 'var(--ent)');
  $('#view').innerHTML = h;
  renderSync();
}

/* ===== MONTH ===== */
function renderMonth() {
  const dates = monthDates(S.month);
  const today = todayStr();
  const elapsed = dates.filter(d => d <= today);
  const a = aggregate(elapsed, S.days, S.settings);
  const full = aggregate(dates, S.days, S.settings);
  const isThis = S.month === monthOf(today);
  let h = '<div class="topbar"><h1>Month</h1><span class="sync" data-sync></span><span class="spacer"></span><div class="datewrap">' +
    '<button type="button" class="iconbtn" data-act="mo-prev" aria-label="Previous month">' + ICON.prev + '</button>' +
    '<span style="min-width:140px;text-align:center;font-weight:600">' + esc(labelMonth(S.month)) + '</span>' +
    '<button type="button" class="iconbtn" data-act="mo-next" aria-label="Next month">' + ICON.next + '</button>' +
    (isThis ? '' : '<button type="button" class="btn small" data-act="mo-today">This month</button>') + '</div></div>';

  /* heat calendar */
  const offset = (dow(dates[0]) + 6) % 7;
  let cal = '<div class="heat">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<div class="h">' + d + '</div>').join('');
  for (let i = 0; i < offset; i++) cal += '<div class="cell blank"></div>';
  full.rows.forEach(r => {
    const c = r.c, future = r.date > today;
    cal += '<button type="button" class="cell' + (r.date === today ? ' today' : '') + (c.type === 'workSat' ? ' sat-work' : '') + '" data-open="' + r.date + '" style="' + (future ? 'opacity:.45' : '') + '" aria-label="' + esc(labelDate(r.date) + (c.has ? ', score ' + c.score + ' percent' : ', nothing logged')) + '">' +
      '<span class="fill" style="opacity:' + (c.has ? (0.12 + c.score / 100 * 0.78).toFixed(2) : 0) + '"></span><span class="n">' + (+r.date.slice(8)) + '</span><span class="p">' + (c.has ? c.score : '') + '</span></button>';
  });
  cal += '</div><div class="keyrow"><span><i style="opacity:.2"></i>Low score</span><span><i></i>High score</span><span><i style="background:var(--work);border-radius:50%"></i>Working Saturday</span></div>';
  h += '<div class="block"><h2>Calendar</h2>' + cal + '</div>';

  h += '<div class="block"><h2>Summary</h2>' + ledgerHtml(a, elapsed) + '</div>';
  h += '<div class="block"><h2>What stands out</h2>' + insightsHtml(a, elapsed.length) + '</div>';

  /* streaks (as of today, across all logged history) */
  const st = (pred) => streak(S.days, S.settings, today, pred);
  const en = S.settings.enabled, gmet = k => (c => c.goals.find(g => g.k === k).met);
  const streaks = [[en.prayers, 'All five prayers', c => c.prayers === 5], [en.learn, 'Learning goal met', gmet('learn')], [en.water, 'Water goal met', gmet('water')],
    [en.sleep, 'Sleep goal met', gmet('sleep')], [en.bad, 'No bad habits', gmet('clean')], [true, 'Score of 70% or more', c => c.score >= 70]].concat(S.settings.habits.map(hb => [true, hb.name, c => { const g = c.goals.find(x => x.k === 'h_' + hb.id); return !!(g && g.met); }])).filter(x => x[0]);
  h += '<div class="block"><h2>Current streaks</h2><div class="scroll-x"><table class="ledger"><tbody>' + streaks.map(x => '<tr><td>' + x[1] + '</td><td>' + st(x[2]) + ' days</td></tr>').join('') + '</tbody></table></div></div>';

  h += '<div class="block"><h2>Trends</h2>' + chartsFor(dates, full, true) + '</div>';

  /* by week */
  const weeks = [];
  dates.forEach(d => { const ws = weekStartOf(d); if (!weeks.length || weeks[weeks.length - 1].ws !== ws) weeks.push({ ws, dates: [] }); weeks[weeks.length - 1].dates.push(d); });
  h += '<div class="block"><h2>Week by week</h2><div class="scroll-x"><table class="ledger wide"><thead><tr><th>Week</th><th>Score</th><th>Sleep</th><th>Learning a day</th><th>Water a day</th><th>Office a day</th><th>Full prayer days</th></tr></thead><tbody>' +
    weeks.map(w => {
      const ds = w.dates.filter(d => d <= today), ag = aggregate(ds, S.days, S.settings);
      return '<tr><td>' + esc(labelDate(w.dates[0]) + ' \u2013 ' + labelDate(w.dates[w.dates.length - 1])) + '</td><td>' + (ag.daysLogged ? Math.round(ag.avg.score) + '%' : '\u2014') + '</td><td>' + (ag.counts.sleep ? fmtDur(ag.avg.sleep) : '\u2014') + '</td><td>' + (ag.daysLogged ? fmtDur(ag.avg.learn) : '\u2014') + '</td><td>' + (ag.daysLogged ? ag.avg.water.toFixed(1) + ' L' : '\u2014') + '</td><td>' + (ag.counts.office ? fmtDur(ag.avg.work) : '\u2014') + '</td><td>' + ag.counts.prayersFull + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';

  /* by day type */
  const types = Object.keys(TYPES).map(k => {
    const ds = elapsed.filter(d => typeOf(d, S.settings, S.days.get(d)) === k);
    return { k, ag: aggregate(ds, S.days, S.settings), n: ds.length };
  }).filter(x => x.n);
  if (types.length) {
    h += '<div class="block"><h2>By day type</h2><div class="scroll-x"><table class="ledger wide"><thead><tr><th>Type</th><th>Days logged</th><th>Score</th><th>Sleep</th><th>Learning</th><th>Office</th><th>Entertainment</th></tr></thead><tbody>' +
      types.map(x => '<tr><td>' + esc(TYPES[x.k]) + '</td><td>' + x.ag.daysLogged + ' of ' + x.n + '</td><td>' + (x.ag.daysLogged ? Math.round(x.ag.avg.score) + '%' : '\u2014') + '</td><td>' + (x.ag.counts.sleep ? fmtDur(x.ag.avg.sleep) : '\u2014') + '</td><td>' + (x.ag.daysLogged ? fmtDur(x.ag.avg.learn) : '\u2014') + '</td><td>' + (x.ag.counts.office ? fmtDur(x.ag.avg.work) : '\u2014') + '</td><td>' + (x.ag.daysLogged ? fmtDur(x.ag.avg.ent) : '\u2014') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }

  if (S.settings.enabled.bad) h += breakdownHtml('Bad habits this month', breakdown(full.rows, 'bad', x => x.n), 'var(--bad)');
  if (S.settings.enabled.ent) h += breakdownHtml('Entertainment this month', breakdown(full.rows, 'ent', x => x.k || 'Other'), 'var(--ent)');
  $('#view').innerHTML = h;
  renderSync();
}

function habitsSettingsHtml() {
  const s = S.settings;
  const dayOpt = v => ['all', 'work', 'off'].map(k => '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + ({ all: 'Every day', work: 'Work days', off: 'Off days' })[k] + '</option>').join('');
  const typeName = { tick: 'Done or not', count: 'Count', timer: 'Timer (minutes)' };
  const rows = s.habits.map(h => '<div class="habset" style="--c:' + h.color + '"><div class="hs-top"><i></i><input type="text" data-hab-id="' + h.id + '" data-hab-f="name" value="' + esc(h.name) + '" aria-label="Habit name">' +
    '<button type="button" class="btn small danger" data-act="hab-del" data-id="' + h.id + '">Delete</button></div>' +
    '<p class="muted small" style="margin-top:8px">' + typeName[h.type] + '</p><div class="hs-grid">' +
    (h.type === 'tick' ? '' : '<label class="fld"><span>Daily goal</span><input type="number" min="0" step="any" data-hab-id="' + h.id + '" data-hab-f="target" value="' + h.target + '"></label>') +
    (h.type === 'count' ? '<label class="fld"><span>Unit</span><input type="text" maxlength="12" data-hab-id="' + h.id + '" data-hab-f="unit" value="' + esc(h.unit) + '"></label>' : '') +
    '<label class="fld"><span>Applies on</span><select data-hab-id="' + h.id + '" data-hab-f="days">' + dayOpt(h.days) + '</select></label></div></div>').join('');
  return '<div class="block" id="habits-set"><h2>Your habits</h2><p class="small muted" style="margin-bottom:10px">Add anything you want to track. Each one gets its own goal, score, chart and streak.</p>' +
    (rows || '<p class="muted small" style="margin-bottom:10px">No habits of your own yet.</p>') +
    '<p class="small muted" style="margin:14px 0 8px">Quick add</p><div class="toggles">' + PRESETS.map((p, i) => '<button type="button" class="add" data-act="hab-preset" data-p="' + i + '">+ ' + esc(p[0]) + '</button>').join('') + '</div>' +
    '<p class="small muted" style="margin:16px 0 8px">Or create your own</p><div class="form-grid" style="max-width:560px">' +
    '<label class="fld" style="grid-column:1/-1"><span>Name</span><input type="text" id="nh-name" maxlength="40" placeholder="For example: Walk after dinner"></label>' +
    '<label class="fld"><span>Type</span><select id="nh-type"><option value="tick">Done or not</option><option value="count">Count (pages, steps, glasses)</option><option value="timer">Timer (minutes, with stopwatch)</option></select></label>' +
    '<label class="fld"><span>Daily goal (0 for none)</span><input type="number" id="nh-target" min="0" step="any" value="0"></label>' +
    '<label class="fld"><span>Unit (counts only)</span><input type="text" id="nh-unit" maxlength="12" placeholder="pages"></label>' +
    '<label class="fld"><span>Applies on</span><select id="nh-days">' + dayOpt('all') + '</select></label></div>' +
    '<div style="margin-top:12px"><button type="button" class="btn primary" data-act="hab-add">Add habit</button></div></div>';
}

/* ===== SETTINGS ===== */
function satPreview() {
  const ref = S.settings.satRef;
  if (!ref) return '<p class="small muted">Choose a Saturday you work and the rest follows.</p>';
  const first = nextSaturdayFromToday();
  let out = '<div class="sat-preview">';
  for (let i = 0; i < 6; i++) {
    const d = addDays(first, i * 7), w = isWorkingSaturday(d, ref);
    out += '<span class="' + (w ? 'w' : '') + '">' + esc(labelDate(d)) + ': ' + (w ? 'Work' : 'Off') + '</span>';
  }
  return out + '</div>';
}

function renderSettings() {
  const s = S.settings;
  const inputRow = (label, key, step) => '<tr><th scope="row" style="color:var(--ink)">' + label + '</th>' +
    Object.keys(TYPES).map(t => '<td><input type="number" min="0" step="' + step + '" data-set="byType.' + t + '.' + key + '" value="' + s.byType[t][key] + '" aria-label="' + label + ' on ' + TYPES[t] + '"></td>').join('') + '</tr>';
  let h = '<div class="topbar"><h1>Settings</h1><span class="sync" data-sync></span></div>';

  h += habitsSettingsHtml();

  h += '<div class="block"><h2>What to track</h2><p class="small muted" style="margin-bottom:10px">These are the built-in habits. Switch off any you do not need. It disappears from Today, the score and the analysis. Your past entries are kept.</p><div class="toggles">' +
    SECTIONS.map(([k, l]) => '<button type="button" class="tog" data-act="enable" data-k="' + k + '" aria-pressed="' + (s.enabled[k] ? 'true' : 'false') + '">' + esc(l) + '</button>').join('') + '</div>' +
    (s.enabled.learn ? '<p class="small muted" style="margin:14px 0 8px">Learning checks</p><div class="toggles">' + CHECKS.map(([k, l]) => '<button type="button" class="tog" data-act="check" data-k="' + k + '" aria-pressed="' + (s.checks[k] ? 'true' : 'false') + '">' + esc(l) + '</button>').join('') + '</div>' : '') + '</div>';

  h += '<div class="block"><h2>Daily goals</h2><div class="form-grid">' +
    '<label class="fld"><span>Sleep goal (hours a night)</span><input type="number" min="0" step="0.25" data-set="sleepH" value="' + s.sleepH + '"></label>' +
    '<label class="fld"><span>Water goal (litres a day)</span><input type="number" min="0" step="1" data-set="waterL" value="' + s.waterL + '"></label></div>' +
    '<p class="small muted" style="margin-top:8px">One bottle is one litre, so the water goal is a whole number of bottles.</p></div>';

  h += '<div class="block"><h2>Goals by day type</h2><div class="scroll-x"><table class="tt"><thead><tr><th></th>' + Object.keys(TYPES).map(t => '<th>' + TYPES[t] + '</th>').join('') + '</tr></thead><tbody>' +
    inputRow('Learning (hours)', 'learn', 0.25) + inputRow('Brainstorm (min)', 'brain', 5) + inputRow('Quran (min)', 'quran', 5) + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:8px">Set a goal to 0 and it no longer counts towards that day\u2019s score.</p></div>';

  h += '<div class="block"><h2>Alternate Saturdays</h2><label class="fld" style="max-width:260px"><span>A Saturday you work</span><input type="date" data-set="satRef" value="' + esc(s.satRef) + '"></label>' +
    '<p class="small" id="satmsg" style="color:var(--bad);margin-top:6px"></p><div id="satprev">' + satPreview() + '</div>' +
    '<p class="small muted" style="margin-top:8px">Every second Saturday from that date is a working Saturday. You can override any single day from its Day type menu.</p></div>';

  h += '<div class="block"><h2>Appearance</h2><div class="seg" role="group" aria-label="Theme">' +
    ['auto', 'light', 'dark'].map(t => '<button type="button" data-act="theme" data-v="' + t + '" aria-pressed="' + (s.theme === t ? 'true' : 'false') + '">' + t[0].toUpperCase() + t.slice(1) + '</button>').join('') + '</div></div>';

  h += '<div class="block"><h2>Your data</h2><p class="small muted" style="margin-bottom:10px">' +
    (S.mode === 'supabase' ? 'Signed in as ' + esc(S.email) + '. Your entries sync between all your devices.' : S.mode === 'cloud' ? 'Your entries sync between your phone and PC and are private to your account.' : 'Sync is not available in this view, so entries are kept on this device only.') + '</p>' +
    '<div class="toggles"><button type="button" class="btn" data-act="export-csv">Export as spreadsheet (CSV)</button><button type="button" class="btn" data-act="export-json">Export full backup (JSON)</button>' + '<label class="btn" style="cursor:pointer">Restore from backup<input type="file" id="restore" accept=".json,application/json" class="sr"></label>' + (S.mode === 'supabase' ? '<button type="button" class="btn" data-act="signout">Sign out</button>' : '') + '</div><p class="small muted" style="margin-top:8px">Restore adds days from a JSON backup and never overwrites a day you have already filled in.</p>' +
    '<p class="small muted" style="margin-top:10px">' + S.days.size + ' days stored.</p></div>';
  $('#view').innerHTML = h;
  renderSync();
}
