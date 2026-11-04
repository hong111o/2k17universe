#!/usr/bin/env python3
# Publish copy: the artifact host adds doctype/html/head/body itself
import sys, re
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
for pat in [r'<!DOCTYPE html>\s*', r'<html[^>]*>\s*', r'</html>\s*', r'<head>\s*', r'</head>\s*', r'<body>\s*', r'</body>\s*',
            r'<meta charset="UTF-8">\s*', r'<meta name="viewport"[^>]*>\s*']:
    s, n = re.subn(pat, '', s, count=1, flags=re.I)
    assert n == 1, pat
s, n = re.subn(r'<!-- PWA:.*?<!-- /PWA -->\s*', '', s, count=1, flags=re.S)
assert n == 1, 'PWA block'
assert s.lstrip().startswith('<title>')
open(dst, 'w').write(s)
print("ok", len(s))
