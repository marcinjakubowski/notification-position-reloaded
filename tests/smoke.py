#!/usr/bin/env python3
"""Test notification cleanup in a private GNOME Shell 46 headless session.

Uses a temporary installation, session bus, and settings backend. The running
desktop and the user's extension installation/settings are never modified.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path(__file__).resolve().parents[1],
                        help='Extension source directory to test')
    args = parser.parse_args()
    root = Path(tempfile.mkdtemp(prefix='notification-banner-smoke-'))
    uuid = 'notification-banner-test@example.local'
    extension = root / 'share/gnome-shell/extensions' / uuid
    extension.mkdir(parents=True)
    for name in ('extension.js', 'utils.js'):
        shutil.copy2(args.source / name, extension / ('candidate.js' if name == 'extension.js' else name))
    shutil.copytree(args.source / 'schemas', extension / 'schemas')
    shutil.copy2(Path(__file__).with_name('smoke-extension.js'), extension / 'extension.js')
    metadata = json.loads((args.source / 'metadata.json').read_text())
    metadata.update(uuid=uuid, name='Notification cleanup test')
    (extension / 'metadata.json').write_text(json.dumps(metadata))
    subprocess.run(['glib-compile-schemas', '--strict', str(extension / 'schemas')], check=True)
    mode = root / 'share/gnome-shell/modes/banner-test.json'
    mode.parent.mkdir(parents=True)
    mode.write_text(json.dumps({'parentMode': 'user', 'enabledExtensions': [uuid],
                               'showWelcomeDialog': False, 'components': []}))
    (root / 'runtime').mkdir(mode=0o700)
    environment = dict(os.environ, XDG_CURRENT_DESKTOP='GNOME', XDG_RUNTIME_DIR=str(root / 'runtime'),
                       XDG_DATA_HOME=str(root / 'share'), XDG_CONFIG_HOME=str(root / 'config'),
                       XDG_CACHE_HOME=str(root / 'cache'), GSETTINGS_BACKEND='memory',
                       XDG_DATA_DIRS=f'{root}/share:/usr/local/share:/usr/share')
    print(f'Test artifacts: {root}', flush=True)
    with (root / 'runtime.log').open('w') as output:
        subprocess.run(['timeout', '--kill-after=5s', '25s', 'dbus-run-session', '--', 'gnome-shell', '--headless',
                        '--wayland', '--wayland-display=banner-test', '--no-x11',
                        '--mode=banner-test', '--virtual-monitor=1280x960'],
                       env=environment, stdout=output, stderr=subprocess.STDOUT, check=False)
    log = (root / 'runtime.log').read_text()
    print('\n'.join(line for line in log.splitlines() if '[Banner Test]' in line))
    return 0 if ('[Banner Test] PASS' in log and '[Banner Test] FAIL' not in log
                 and 'JS ERROR' not in log and 'Gjs-CRITICAL' not in log) else 1


if __name__ == '__main__':
    raise SystemExit(main())
