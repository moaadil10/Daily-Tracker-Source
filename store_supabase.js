/* ===== SUPABASE MODE (own login, own database) ===== */
let sb = null, sbUser = null;

function authScreen() {
  return new Promise(resolve => {
    document.body.classList.add('auth');
    $('#view').innerHTML = '<div class="authbox"><h1>Daily tracker</h1><p class="muted">Sign in to sync across all your devices.</p>' +
      '<label class="fld"><span>Email</span><input id="au-email" type="email" autocomplete="email" inputmode="email"></label>' +
      '<label class="fld" style="margin-top:10px"><span>Password</span><input id="au-pass" type="password" autocomplete="current-password"></label>' +
      '<p id="au-msg" class="small" role="alert" style="min-height:1.4em;margin:10px 0"></p>' +
      '<div class="toggles"><button type="button" class="btn primary" id="au-in">Sign in</button><button type="button" class="btn" id="au-up">Create account</button><button type="button" class="btn" id="au-reset">Forgot password</button></div></div>';
    const msg = (t, ok) => { const m = $('#au-msg'); m.textContent = t; m.style.color = ok ? 'var(--ok)' : 'var(--bad)'; };
    const creds = () => ({ email: $('#au-email').value.trim(), password: $('#au-pass').value });
    const done = session => { document.body.classList.remove('auth'); resolve(session); };
    const busy = v => $$('.authbox button').forEach(b => { b.disabled = v; });
    $('#au-in').onclick = async () => {
      const c = creds();
      if (!c.email || !c.password) return msg('Enter your email and password.');
      busy(true);
      const { data, error } = await sb.auth.signInWithPassword(c);
      busy(false);
      if (error) return msg(error.message);
      done(data.session);
    };
    $('#au-up').onclick = async () => {
      const c = creds();
      if (!c.email || c.password.length < 6) return msg('Use a valid email and a password of at least 6 characters.');
      busy(true);
      const { data, error } = await sb.auth.signUp(c);
      busy(false);
      if (error) return msg(error.message);
      if (data.session) done(data.session);
      else msg('Account created. Check your email to confirm it, then sign in.', true);
    };
    $('#au-reset').onclick = async () => {
      const email = $('#au-email').value.trim();
      if (!email) return msg('Type your email first.');
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      if (error) msg(error.message); else msg('Password reset email sent.', true);
    };
    $('#au-pass').addEventListener('keydown', e => { if (e.key === 'Enter') $('#au-in').click(); });
  });
}

function applyRemoteDay(row) {
  if (!row || !row.data || !row.day) return;
  const id = row.day, x = row.data;
  if (store.pending.has(id) || (x.rev && store.ownRevs.has(x.rev))) return;
  if (JSON.stringify(S.days.get(id)) === JSON.stringify(normalizeDay(x, id))) return;
  S.days.set(id, normalizeDay(x, id));
  store.onExternal([id]);
}

async function loadFromSupabase(first) {
  const [d, st] = await Promise.all([
    sb.from('tracker_days').select('day,data').order('day', { ascending: false }).limit(800),
    sb.from('tracker_settings').select('settings').maybeSingle()
  ]);
  if (d.error) throw d.error;
  if (first) (d.data || []).forEach(r => { if (r.data) S.days.set(r.day, normalizeDay(r.data, r.day)); });
  else (d.data || []).forEach(applyRemoteDay);
  if (st.data && st.data.settings) {
    const inc = mergeSettings(st.data.settings);
    if (first) S.settings = inc;
    else if (!store.setTimer && JSON.stringify(inc) !== JSON.stringify(S.settings)) { S.settings = inc; store.onSettingsExternal(); }
  }
}

async function connectSupabase() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || !(window.supabase && window.supabase.createClient)) return false;
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  sb.auth.onAuthStateChange(ev => {
    if (ev === 'SIGNED_OUT') location.reload();
    if (ev === 'PASSWORD_RECOVERY') {
      const p = window.prompt('Choose a new password (at least 6 characters)');
      if (p && p.length >= 6) sb.auth.updateUser({ password: p }).then(r => alert(r.error ? r.error.message : 'Password updated.'));
    }
  });
  let { data: { session } } = await sb.auth.getSession();
  if (!session) session = await authScreen();
  sbUser = session.user;
  S.mode = 'supabase';
  S.email = sbUser.email;
  $('#view').innerHTML = '<p class="muted" style="padding:24px 0">Loading your tracker\u2026</p>';
  await loadFromSupabase(true);
  const f = 'user_id=eq.' + sbUser.id;
  sb.channel('tracker-' + sbUser.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_days', filter: f }, p => applyRemoteDay(p.new))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tracker_settings', filter: f }, () => loadFromSupabase(false).catch(() => {}))
    .subscribe();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadFromSupabase(false).catch(() => {}); });
  return true;
}

async function supaWriteDay(date, doc) {
  const { error } = await sb.from('tracker_days').upsert({ user_id: sbUser.id, day: date, data: doc, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
  if (error) throw error;
}
async function supaWriteSettings() {
  const { error } = await sb.from('tracker_settings').upsert({ user_id: sbUser.id, settings: cleanDoc(S.settings), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
