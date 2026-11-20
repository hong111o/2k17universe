#!/usr/bin/env python3
"""Build one self-contained HTML file from index.html + css/ + js/.

Used for the versions/ backups (each must open on its own) and for the
claude.ai preview copy. Usage: python3 tools/bundle.py [out.html] [--no-pwa]
--no-pwa drops the installable-app block (the preview can't be installed).
--inline-logos embeds the 30 NBA logos (assets/logos) as data URIs, for the preview copy;
otherwise the copy loads them from ../assets/logos/, which is right for versions/ backups.
"""
import re, sys, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
args = [a for a in sys.argv[1:] if not a.startswith('--')]
out = pathlib.Path(args[0]) if args else root / 'bundle.html'
html = (root / 'index.html').read_text()
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
              lambda m: '<style>\n' + (root / m.group(1)).read_text() + '</style>', html)
html = re.sub(r'<script src="(js/[^"]+)"></script>',
              lambda m: '<script>\n' + (root / m.group(1)).read_text().replace('</script', '<\\/script') + '</script>', html)
import base64, json
if '--inline-logos' in sys.argv:
    data = {p.stem: 'data:image/png;base64,' + base64.b64encode(p.read_bytes()).decode() for p in sorted((root / 'assets/logos').glob('*.png'))}
    logo_js = 'window.LOGO_DATA=' + json.dumps(data) + ';'
else:
    logo_js = "window.LOGO_BASE='../assets/logos/';"
html = html.replace('<script>', '<script>' + logo_js + '</script>\n<script>', 1)
if '--no-pwa' in sys.argv:
    html = re.sub(r'<!-- PWA:.*?<!-- /PWA -->\n?', '', html, flags=re.S)
out.write_text(html)
print('wrote', out, len(html), 'bytes')
