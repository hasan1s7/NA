"""Build the public bundle and mirror its static entry files for branch Pages.

GitHub Pages publishes main / (root). Editable application modules remain in
public/. Only allowlisted generated files are copied; existing user files and
private configuration are never read, removed or copied by this script.
"""
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
subprocess.run([sys.executable, str(ROOT / 'tools/build_standalone.py')], check=True)
for name in ('index.html', 'nabu-sw.js', 'nabu-repair.html', 'nabu.webmanifest',
             'nabu-icon.svg', 'nabu-scribe.svg', 'about.html', 'about.css',
             'patrick.html', 'patrick.js', 'patrick-profile.json',
             'capture-demo.html', 'capture-reels-demo.mp4'):
    shutil.copy2(ROOT / 'public' / name, ROOT / name)
for path in (ROOT / 'public/icons').iterdir():
    if path.is_file():
        (ROOT / 'icons').mkdir(exist_ok=True)
        shutil.copy2(path, ROOT / 'icons' / path.name)
(ROOT / '.nojekyll').write_text('')
print('Branch Pages entry files copied to repository root; public/ remains the source.')
