#!/usr/bin/env python3
"""Build the anonymous Nabu research-prototype PDF with the official ICML style.

Run from any directory: python tools/build_paper.py
No network requests, production writes, or automatic paper submission.
"""
from pathlib import Path
import os
import argparse
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PAPER = ROOT / "paper"
BUILD = PAPER / ".build"
BUILD.mkdir(exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--paper", default="nabu-evidence",
                    help="LaTeX stem in paper/ (for the current release: nabu-learner)")
args = parser.parse_args()
if not re.fullmatch(r"[A-Za-z0-9_-]+", args.paper) or not (PAPER / (args.paper + ".tex")).is_file():
    raise SystemExit("Choose an existing LaTeX source stem in paper/.")
stem = args.paper

for binary in ("pdflatex", "bibtex"):
    if not shutil.which(binary):
        raise SystemExit(f"Required local command is missing: {binary}")

env = os.environ.copy()
env["TEXINPUTS"] = str(PAPER / "vendor") + os.pathsep + env.get("TEXINPUTS", "")
env["BSTINPUTS"] = str(PAPER / "vendor") + os.pathsep + env.get("BSTINPUTS", "")
env["BIBINPUTS"] = str(PAPER) + os.pathsep + env.get("BIBINPUTS", "")
# Some minimal containers include TeX packages and engines but no format/map
# cache. Build a local cache without modifying the system installation.
format_lookup = subprocess.run(["kpsewhich", "pdflatex.fmt"], capture_output=True,
                               text=True, env=env)
if not format_lookup.stdout.strip():
    distribution = Path("/usr/share/texlive/texmf-dist")
    if not distribution.is_dir():
        raise SystemExit("Initialize the installed TeX distribution's pdflatex format first.")
    roots = [str(distribution)]
    if Path("/usr/share/texmf").is_dir():
        roots.append("/usr/share/texmf")
    env["TEXMF"] = "{" + ",".join(roots) + "}"
    env["TEXFORMATS"] = str(BUILD) + os.pathsep
    env["TEXFONTMAPS"] = str(BUILD) + os.pathsep
    if not (BUILD / "pdflatex.fmt").exists():
        initialized = subprocess.run(
            ["pdftex", "-ini", "-interaction=nonstopmode", "-halt-on-error",
             "-jobname=pdflatex", "-progname=pdflatex", "*pdflatex.ini"],
            cwd=BUILD, env=env, capture_output=True, text=True)
        if initialized.returncode:
            print(initialized.stdout[-10000:])
            raise SystemExit(initialized.returncode)
    map_files = [distribution / "fonts/map/dvips/tetex/ps2pk35.map"]
    map_files.extend((distribution / "fonts/map/dvips/amsfonts").glob("*.map"))
    (BUILD / "pdftex.map").write_text("\n".join(path.read_text() for path in map_files))
latex = ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error",
         "-output-directory=" + str(BUILD), stem + ".tex"]
for command, cwd in [(latex, PAPER), (["bibtex", stem], BUILD),
                     (latex, PAPER), (latex, PAPER)]:
    run = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True)
    if run.returncode:
        print(run.stdout[-20000:])
        print(run.stderr[-5000:])
        raise SystemExit(run.returncode)
shutil.copy2(BUILD / (stem + ".pdf"), PAPER / (stem + ".pdf"))
print("Built paper/" + stem + ".pdf; inspect paper/.build/" + stem + ".log for warnings.")
