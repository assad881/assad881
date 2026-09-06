#!/usr/bin/env python3
"""يدمج التطبيق كاملًا في ملف HTML واحد — للنشر كرابط أو للمشاركة كملف."""
import re, pathlib, sys

ROOT = pathlib.Path(__file__).parent
OUT  = ROOT / 'dist' / 'kassara-app.html'

html = (ROOT / 'index.html').read_text(encoding='utf-8')
css  = (ROOT / 'assets/css/app.css').read_text(encoding='utf-8')

# ترتيب التحميل يُقرأ من index.html نفسه حتى لا ينفصل الاثنان
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
title   = re.search(r'<title>(.*?)</title>', html, re.S).group(1)

parts = [
    f'<title>{title}</title>',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
    'family=Tajawal:wght@400;500;700;800&display=swap">',
    '<style>', css, '</style>',
]
parts.append('<div id="app"><div style="padding:60px;text-align:center;'
             'font-family:system-ui;color:#7a8a9b">جارٍ التحميل…</div></div>')
parts.append('<noscript><div style="padding:24px;text-align:center;font-family:system-ui">'
             'هذه المنصة تحتاج إلى تفعيل JavaScript في المتصفح.</div></noscript>')

for s in scripts:
    src = ROOT / s
    if not src.exists():
        sys.exit(f'ملف مفقود: {s}')
    parts.append(f'<!-- {s} -->')
    parts.append('<script>')
    parts.append(src.read_text(encoding='utf-8'))
    parts.append('</script>')

# لا عامل خدمة في النسخة أحادية الملف — لا يوجد sw.js بجانبها
parts.append('<script>KX.config.features.pwa = false;</script>')

OUT.parent.mkdir(exist_ok=True)
OUT.write_text('\n'.join(parts), encoding='utf-8')
print(f'{OUT}  —  {OUT.stat().st_size/1024:.0f} KB  —  {len(scripts)} ملف سكربت')
