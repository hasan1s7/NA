#!/usr/bin/env python3
"""Start Nabu locally. First run creates .venv and installs pinned dependencies.
Never exposes the service to the network or runs database reset commands.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import venv
import webbrowser

ROOT = Path(__file__).resolve().parent
ALLOWED = ('NABU_', 'DEEPL_', 'ELEVENLABS_', 'AWS_')


def load_local_env(path: Path):
    """Minimal literal dotenv reader: no shell evaluation or variable expansion."""
    values = {}
    if not path.exists():
        return values
    for number, raw in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            raise ValueError(f'{path.name}:{number}: expected NAME=value (value omitted from error).')
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*', key) or not (key.startswith(ALLOWED) or key == 'PORT'):
            raise ValueError(f'{path.name}:{number}: unsupported configuration name.')
        if value.startswith(('"', "'")):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError(f'{path.name}:{number}: unmatched quote (value omitted from error).')
            value = value[1:-1]
        values[key] = value
    return values


def bootstrap(argv):
    executable = ROOT / '.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    requirements = ROOT / 'requirements.txt'
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    marker = ROOT / '.venv' / '.nabu-requirements-sha256'
    if not executable.is_file():
        print('Creating the local Python environment...', flush=True)
        venv.EnvBuilder(with_pip=True).create(ROOT / '.venv')
    if not marker.exists() or marker.read_text().strip() != digest:
        print('Installing Nabu dependencies (internet is needed for this first setup)...', flush=True)
        subprocess.run([str(executable), '-m', 'pip', 'install', '--disable-pip-version-check', '-r', str(requirements)], check=True)
        marker.write_text(digest)
    return subprocess.call([str(executable), str(ROOT / 'start_local.py'), '--ready', *argv], cwd=ROOT)


def prepare_environment(port=None):
    config = ROOT / '.env.local'
    if not config.exists():
        # Exclusive creation; never replace a user's private configuration.
        fd = os.open(config, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write((ROOT / '.env.local.example').read_text(encoding='utf-8'))
    values = load_local_env(config)
    for key, value in values.items():
        os.environ.setdefault(key, value)
    actual_port = int(port if port is not None else os.environ.get('PORT', '8000'))
    if not 1024 <= actual_port <= 65535:
        raise ValueError('Use a port between 1024 and 65535.')
    # Keep every browser request same-origin and local, regardless of shell config.
    origin = f'http://127.0.0.1:{actual_port}'
    os.environ.update(NABU_HOST='127.0.0.1', NABU_ORIGIN=origin, PORT=str(actual_port))
    database = Path(os.environ.get('NABU_DB') or '.data/nabu.sqlite3').expanduser()
    if not database.is_absolute():
        database = ROOT / database
    os.environ['NABU_DB'] = str(database.resolve())
    return actual_port, origin, database.resolve()


def open_when_ready(origin):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(30):
        try:
            with opener.open(origin + '/api/health', timeout=1) as response:
                if response.status == 200:
                    webbrowser.open(origin + '/explore')
                    return
        except OSError:
            time.sleep(0.5)


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, help='Local port; defaults to 8000')
    parser.add_argument('--no-browser', action='store_true', help='Do not open the browser automatically')
    parser.add_argument('--check', action='store_true', help='Check configuration without opening the database or starting the app')
    parser.add_argument('--ready', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    if sys.version_info < (3, 11):
        parser.error('Python 3.11 or newer is required.')
    os.chdir(ROOT)
    if not args.ready:
        return bootstrap(argv)
    port, origin, database = prepare_environment(args.port)
    for module in ('fastapi', 'uvicorn', 'httpx'):
        if importlib.util.find_spec(module) is None:
            raise RuntimeError('Dependencies are missing. Run start_local.py without --ready.')
    print('\nNabu 1.18 - local application', flush=True)
    print(f'Open: {origin}/explore\nDatabase: {database}\nPrivate configuration: .env.local', flush=True)
    print('DeepL: ' + ('key configured (not validated)' if os.environ.get('DEEPL_API_KEY') else 'off; built-in bank works without a key'))
    print('Cloud speech: ' + ('key configured (not validated)' if os.environ.get('ELEVENLABS_API_KEY') else 'off; device voices can be selected in Settings'))
    if args.check:
        print('Configuration OK. No database was created or modified.')
        return 0
    # A bind-only preflight mistakes sockets in TIME_WAIT for active servers.
    # Probe for an actual listener; uvicorn remains responsible for the bind.
    try:
        probe = socket.create_connection(('127.0.0.1', port), timeout=0.4)
    except OSError:
        pass
    else:
        probe.close()
        raise RuntimeError(f'Port {port} is in use. Stop the other app or run with --port {port + 1}.')
    print('Keep this terminal open. Press Ctrl+C to stop.\n', flush=True)
    if not args.no_browser:
        threading.Thread(target=open_when_ready, args=(origin,), daemon=True).start()
    import uvicorn
    from server import app
    uvicorn.run(app, host='127.0.0.1', port=port, proxy_headers=False)
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(0)
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        # Do not dump configuration or provider credentials in diagnostics.
        print(f'Nabu could not start: {error}', file=sys.stderr)
        raise SystemExit(1)
