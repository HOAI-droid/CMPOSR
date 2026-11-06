#!/usr/bin/env python3
"""Build the single-file preview page (prototype/field.html) from the web app in app/.

The artifact viewer only allows inline CSS/JS, so this inlines app/field.css and app/field.js
into one HTML fragment. Run after changing anything in app/:  python3 tools/build_artifact.py
"""
from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
html = (root / 'app' / 'index.html').read_text()
css = (root / 'app' / 'field.css').read_text()
js = (root / 'app' / 'voice.js').read_text() + '\n' + (root / 'app' / 'field.js').read_text()

head = re.search(r'<!-- HEAD START -->(.*?)<!-- HEAD END -->', html, re.S).group(1).strip()
body = re.search(r'<!-- BODY START -->(.*?)<!-- BODY END -->', html, re.S).group(1).strip()
title, rest = head.split('\n', 1)

out = f"""{title}
<meta name="claude:viewport-fit-sides" content="cover">
{rest}
<style>
{css}
</style>

{body}

<script>
{js}
</script>
"""
(root / 'prototype' / 'field.html').write_text(out)
print('wrote prototype/field.html', len(out), 'bytes')
