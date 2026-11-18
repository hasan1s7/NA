#!/usr/bin/env python3
"""Fail-closed, branch-only integration of the preflight module into Nabu 1.18.

Run from a manual feature branch after extracting this bundle into the checkout.
No remote writes, database changes, login, deployment, or build are performed.
"""
from __future__ import annotations
import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_exact(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one anchor, found {count}; checkout may have changed')
    return text.replace(old, new, 1)


def changes():
    required = ['public/nabu-media-profile.js', 'tests/media-profile.test.mjs',
                'public/nabu-app.js', 'public/nabu-explore-ui.js',
                'public/nabu-explore.css', 'tools/build_standalone.py',
                'public/nabu-core.js', 'public/nabu-ux-whitepaper.html',
                'tools/build_pages.py']
    for name in required:
        if not (ROOT / name).is_file():
            raise RuntimeError(f'Missing {name}; extract the full bundle into the Nabu checkout first')
    result = {}
    app_path = 'public/nabu-app.js'
    app = (ROOT / app_path).read_text(encoding='utf-8')
    app = replace_exact(app,
        "import * as U from './nabu-reading-ui.js';",
        "import * as U from './nabu-reading-ui.js';\nimport * as MediaProfile from './nabu-media-profile.js';",
        'app import')
    app = replace_exact(app,
        "</button></div>${readerMediaMarkup()}<div class=\"reader-body\">",
        "</button></div>${MediaProfile.renderPreflight(MediaProfile.analyzeText(r.text,state.translation.sourceLang,{title:r.title}),E)}${readerMediaMarkup()}<div class=\"reader-body\">",
        'own-text reader entry')
    result[app_path] = app

    explore_path = 'public/nabu-explore-ui.js'
    explore = (ROOT / explore_path).read_text(encoding='utf-8')
    explore = replace_exact(explore,
        "import * as P from './nabu-content-store.js';",
        "import * as P from './nabu-content-store.js';\nimport * as MediaProfile from './nabu-media-profile.js';",
        'Explore import')
    explore = replace_exact(explore,
        'const p=progress(item),support=X.nextSupport(item,store.getEvents()),recommended=X.recommendNext(item,store.getEvents());',
        'const p=progress(item),support=X.nextSupport(item,store.getEvents()),recommended=X.recommendNext(item,store.getEvents());\n  const preflight=MediaProfile.renderPreflight(MediaProfile.analyzeMedia(item),E,{description:item.preview});',
        'curated preflight computation')
    explore = replace_exact(explore,
        '</button></div><div class="reader-body"><div id="reader-text"',
        '</button></div>${preflight}<div class="reader-body"><div id="reader-text"',
        'curated preflight position')
    explore = replace_exact(explore,
        '<footer class="explore-note"><p>',
        '<footer class="explore-note"><p class="nabu-ux-paper-link"><a href="./nabu-ux-whitepaper.html">How the Nabu learner experience works</a> <span>/ Product white paper</span></p><p>',
        'Explore white-paper link')
    result[explore_path] = explore

    build_path = 'tools/build_standalone.py'
    build = (ROOT / build_path).read_text(encoding='utf-8')
    build = replace_exact(build,
        "core=module(read('nabu-core.js'))",
        "core=module(read('nabu-core.js'))\nmedia_profile=module(read('nabu-media-profile.js'),'const {isLanguage}=C;\\n')",
        'standalone module assembly')
    build = replace_exact(build,
        "\\nconst C='+core+';\\nconst Local='+store+",
        "\\nconst C='+core+';\\nconst MediaProfile='+media_profile+';\\nconst Local='+store+",
        'standalone runtime dependency')
    result[build_path] = build

    pages_path = 'tools/build_pages.py'
    pages = (ROOT / pages_path).read_text(encoding='utf-8')
    pages = replace_exact(pages,
        "for name in ('index.html', 'nabu-sw.js',",
        "for name in ('index.html', 'nabu-ux-whitepaper.html', 'nabu-sw.js',",
        'Pages copy allowlist')
    result[pages_path] = pages

    css_path = 'public/nabu-explore.css'
    css = (ROOT / css_path).read_text(encoding='utf-8')
    new_css = '''
/* Optional, read-only source preflight, shared by own-text and curated readers. */
.media-preflight{margin:8px 26px 20px;padding:0 18px;border:1px solid #d7ddd1;border-radius:13px;background:#f7faf4;color:#294235}
.media-preflight summary{display:flex;justify-content:space-between;gap:14px;align-items:center;cursor:pointer;min-height:44px;padding:12px 0;font-size:14px;font-weight:650}
.media-preflight summary span{font-size:11px;font-weight:400;color:#526256}
.media-preflight-body{border-top:1px solid #e0e6dc;padding:12px 0 16px;line-height:1.7;font-size:14px;overflow-wrap:anywhere}
.media-preflight-body p{margin:6px 0 12px}.media-preflight-body .small-print{font-size:12px;color:#526256}
.media-preflight-body bdi{font-weight:600}
@media(max-width:600px){.media-preflight{margin-inline:14px;padding-inline:14px}.media-preflight summary{align-items:flex-start;flex-direction:column;gap:2px}}
'''
    if '.media-preflight{' not in css:
        css = css.rstrip() + '\n' + new_css
    if '.nabu-ux-paper-link a{' not in css:
        css += '\n.nabu-ux-paper-link{margin:12px 0 15px;font-size:14px;line-height:1.7}.nabu-ux-paper-link a{font-weight:700;color:#26563f;text-decoration:underline;text-underline-offset:3px}.nabu-ux-paper-link span{color:#728777;font-size:12px}\n'
    result[css_path] = css
    return result


def git_branch():
    result = subprocess.run(['git','branch','--show-current'],cwd=ROOT,text=True,capture_output=True)
    if result.returncode:
        raise RuntimeError('This must be run from a git checkout, not on an extracted standalone folder')
    name = result.stdout.strip()
    if not name or name in {'main','master'}:
        raise RuntimeError('Refusing to change main/master or detached HEAD. Manually create/switch to an isolated feature branch.')
    return name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--check',action='store_true',help='Validate integration anchors without modifying files (default)')
    group.add_argument('--apply',action='store_true',help='Apply additive source edits on an existing feature branch')
    args = parser.parse_args()
    try:
        changed = changes()  # Validate every anchor before writing anything.
        print('Preflight integration anchors verified:', ', '.join(changed))
        if not args.apply:
            print('Read-only check passed; no source files changed.')
            return
        print('Target feature branch:', git_branch())
        for name, content in changed.items():
            path = ROOT/name
            if path.read_text(encoding='utf-8') == content:
                print('Already integrated:', name)
                continue
            path.write_text(content,encoding='utf-8')
            print('Updated:', name)
        print('Source integration complete. No generated bundles, deployed site, or user data changed.')
    except (RuntimeError,OSError) as error:
        print('FAILED CLOSED:',error,file=sys.stderr)
        raise SystemExit(1)


if __name__=='__main__':
    main()
