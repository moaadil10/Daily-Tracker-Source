import re
rd = lambda f: open(f).read()
css = rd('style.css')
js = '\n'.join(rd(f) for f in ['core.js','store.js','store_supabase.js','views_day.js','views_analysis.js','app.js'])

def page(deploy):
    extra_head = ''
    extra_scripts = ''
    if deploy:
        extra_head = '''<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon.svg" type="image/svg+xml">
<meta name="theme-color" content="#17303a">
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="apple-touch-icon" href="icon.svg">
'''
        extra_scripts = '<script src="config.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>\n'
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Daily tracker</title>
{extra_head}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
{css}
</style>
</head>
<body>
<div id="app">
  <nav id="nav" aria-label="Main"></nav>
  <div id="main">
    <main id="view"></main>
    <footer id="foot">&copy; <span id="year">2026</span> Mohammed Aadil. All rights reserved.</footer>
  </div>
</div>
<div id="toast" role="status" aria-live="polite"></div>
{extra_scripts}<script>
{js}
</script>
</body>
</html>
'''
open('/mnt/user-data/outputs/daily-tracker.html','w').write(page(False))
open('/mnt/user-data/outputs/deploy/index.html','w').write(page(True))
print('built')
