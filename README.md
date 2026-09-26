# Personalized Daily Tracker — Source

Source code for a personal habit tracker: sleep, prayers, learning (with stopwatch), water,
office hours, entertainment, bad habits, custom habits, and week/month analysis.
Alternate-Saturday work schedule aware. Any habit can be switched on or off in Settings.

**Live site:** https://habbit-tracker-advanced.vercel.app
(Sign in required — your data syncs across devices via Supabase, with row-level security so
each account only ever sees its own entries.)

## How it's built

This is a small hand-rolled app — no framework, no bundler. `build.py` concatenates the
files below into one self-contained `index.html`, which is what actually gets deployed.

- `core.js` — pure logic: time math (including past-midnight spans), the alternate-Saturday
  rule, scoring, and week/month aggregation. Covered by `test_core.js`.
- `store.js` — persistence layer, talks to either the Claude-hosted database or Supabase.
- `store_supabase.js` — Supabase auth (sign in/up/reset) and realtime sync.
- `views_day.js` — the "Today" screen: the 24-hour dial, goals panel, and every logging
  section (prayers, sleep, learning, water, etc.), plus the stopwatch.
- `views_analysis.js` — Week/Month screens: charts, ledgers, streaks, and the Settings screen
  (habit toggles, custom habits, alternate-Saturday setup).
- `app.js` — event wiring: binds all the click/input handlers to the state in `core.js`.
- `style.css` — light/dark theme, responsive layout.
- `build.py` — joins everything above into `index.html`.
- `test_core.js` — unit tests for `core.js`. Run with `node test_core.js`.

## Running the tests

```
node test_core.js
```

## Deploying your own copy

The actual deployment repo (`Daily-Tracker-Advanced`) contains the built `index.html` plus
a small `build-config.js` that injects Supabase credentials from Vercel Environment
Variables at build time — so no secrets ever live in source control.

---
© Mohammed Aadil
