#!/usr/bin/env python3
"""Explicit, optional CPU transcription setup. No paid API or implicit download.
Run with the same Python interpreter as Nabu's .venv. A network download occurs
ONLY when --download is supplied. Existing .env.local is never modified.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import sys
ROOT=Path(__file__).resolve().parents[1]

def main(argv=None):
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--model',choices=['tiny','base','small'],default='base')
 parser.add_argument('--directory',type=Path,help='Existing or desired model folder outside public/')
 parser.add_argument('--download',action='store_true',help='Explicitly download free model weights from Hugging Face')
 parser.add_argument('--check',action='store_true',help='Load weights on CPU to verify local compatibility (no download)')
 args=parser.parse_args(argv)
 destination=(args.directory or ROOT/'.data/models'/('faster-whisper-'+args.model)).expanduser().resolve()
 if destination.is_relative_to(ROOT/'public'):
  parser.error('Keep model files outside public/.')
 if not importlib.util.find_spec('faster_whisper'):
  print('Install requirements-speech.txt using this interpreter:\n  '+sys.executable+' -m pip install -r requirements-speech.txt',file=sys.stderr);return 2
 if not shutil.which('ffmpeg'):
  print('Install the FFmpeg command-line program, ensure ffmpeg is on PATH, then retry. See MEDIA_SETUP.md.',file=sys.stderr);return 2
 if args.download:
  from huggingface_hub import snapshot_download
  destination.mkdir(parents=True,exist_ok=True)
  print('Downloading Systran/faster-whisper-'+args.model+' to '+str(destination),flush=True)
  try:snapshot_download(repo_id='Systran/faster-whisper-'+args.model,local_dir=str(destination),allow_patterns=['*.json','*.bin','*.txt','README.md','LICENSE*'])
  except Exception as error:
   print('Model download failed ('+type(error).__name__+'). Check internet access and retry; Nabu data was not changed.',file=sys.stderr);return 3
 missing=[name for name in ['model.bin','tokenizer.json','config.json'] if not (destination/name).is_file()]
 if missing:
  print('Missing local files: '+', '.join(missing)+'. Run again with --download, or choose an existing model folder.',file=sys.stderr);return 2
 if args.check:
  from faster_whisper import WhisperModel
  try:WhisperModel(str(destination),device='cpu',compute_type='int8',cpu_threads=2,local_files_only=True)
  except Exception as error:
   print('The model did not load ('+type(error).__name__+'). Verify the model files and CPU package compatibility.',file=sys.stderr);return 3
  print('Local CPU model loaded. This is not an accuracy test.')
 print('Set this in private .env.local, then restart Nabu:')
 print('NABU_WHISPER_MODEL_DIR='+str(destination))
 print('Sign in, record a short excerpt, transcribe, and verify the words yourself.')
 return 0
if __name__=='__main__':raise SystemExit(main())
