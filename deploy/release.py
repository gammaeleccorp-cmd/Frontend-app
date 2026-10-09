"""Commit-addressed VPS releases. No activation occurs during stage.

Production paths must first be converted to symlinks during approved maintenance.
Database migrations are deliberately NOT automatic: pending migrations block activation.
"""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile
import time
import urllib.request

TARGETS = {'frontend': Path('/home/gamma/releases/sprint10/frontend/current'),
           'backend': Path('/home/gamma/releases/sprint10/backend/current')}
UNITS = ['gamma-backend.service', 'gamma-command-consumer.service', 'gamma-mqtt-consumer.service']
SHARED_ENV = Path('/home/gamma/shared/backend.env')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


@contextlib.contextmanager
def lock(root):
    import fcntl
    root.mkdir(parents=True, exist_ok=True)
    with (root / '.deploy.lock').open('a') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def valid_sha(sha):
    if not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Expected full lowercase source commit SHA')
    return sha


def extract(archive, target):
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            parts = Path(member.name).parts
            if member.name.startswith(('/', '\\')) or '..' in parts or '\\' in member.name or ':' in member.name:
                raise ValueError('Unsafe archive path')
            if not (member.isfile() or member.isdir()):
                raise ValueError('Links and special archive entries are forbidden')
        tar.extractall(target, filter='data')


def stage(root, component, sha, archive, digest):
    valid_sha(sha)
    if not re.fullmatch(r'[0-9a-f]{64}', digest) or hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
        raise ValueError('Artifact checksum mismatch')
    destination = root / component / sha
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise ValueError('Immutable release already exists; use a new commit')
    with tempfile.TemporaryDirectory(prefix='.staging-', dir=destination.parent) as temporary:
        work = Path(temporary)
        extract(archive, work)
        # TemporaryDirectory starts private; Nginx must traverse the published tree.
        work.chmod(0o755)
        app = work if component == 'frontend' else work / 'gamma_backend'
        if component == 'frontend':
            if (app / 'SOURCE_COMMIT').read_text().strip() != sha or not (app / 'index.html').is_file():
                raise ValueError('Frontend source marker or entrypoint missing')
        elif not (app / 'manage.py').is_file() or not (work / 'wheelhouse').is_dir() or (work / 'SOURCE_COMMIT').read_text().strip() != sha:
            raise ValueError('Backend source or CI wheelhouse missing')
        (work / 'release.json').write_text(json.dumps({'source_commit': sha, 'component': component, 'artifact_sha256': digest}))
        os.rename(work, destination)
    print(f'STAGED {component} {sha} at {destination}; production untouched')


def backend_command(app, arguments):
    # Existing trusted server-only env file; never included in artifacts or logs.
    return run(['bash', '-c', 'set -a; . "$1"; shift; set +a; exec "$@"',
                'gamma-release', str(SHARED_ENV), str(app / 'venv/bin/python'), *arguments], cwd=app)


def prepare_backend(release):
    app = release / 'gamma_backend'
    if not SHARED_ENV.is_file():
        raise ValueError('Shared backend environment has not been provisioned')
    if not (app / 'venv').exists():
        run(['/usr/bin/python3.12', '-m', 'venv', str(app / 'venv')])
    run([str(app / 'venv/bin/pip'), 'install', '--no-index', '--find-links', str(release / 'wheelhouse'), '-r', str(app / 'requirements.txt')])
    for name, shared in [('media', Path('/home/gamma/shared/media'))]:
        if not shared.is_dir():
            raise ValueError(f'Shared directory must be provisioned: {shared}')
        if not (app / name).exists():
            (app / name).symlink_to(shared, target_is_directory=True)
    if not (app / '.env').exists():
        (app / '.env').symlink_to(SHARED_ENV)
    backend_command(app, ['manage.py', 'check'])
    backend_command(app, ['manage.py', 'migrate', '--check'])
    backend_command(app, ['manage.py', 'collectstatic', '--noinput'])
    return app


def switch(target, destination):
    if not target.is_symlink():
        raise ValueError(f'{target} is not a symlink; approved one-time layout migration required')
    next_link = target.with_name(target.name + '.next')
    if next_link.exists() or next_link.is_symlink():
        raise ValueError(f'Unexpected pending link: {next_link}')
    next_link.symlink_to(destination, target_is_directory=True)
    os.replace(next_link, target)


def health(component, sha):
    url = 'https://app.gamma-tech.ir/SOURCE_COMMIT' if component == 'frontend' else 'https://api.gamma-tech.ir/api/v1/health/ready/'
    for attempt in range(12):
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                body = response.read().decode()
                valid = body.strip() == sha if component == 'frontend' else json.loads(body).get('status') == 'healthy'
                if response.status == 200 and valid:
                    return
        except (OSError, ValueError):
            pass
        time.sleep(5)
    raise RuntimeError('Release health check failed')


def restart(component):
    if component == 'backend':
        run(['sudo', '-n', 'systemctl', 'restart', *UNITS])
        run(['systemctl', 'is-active', '--quiet', *UNITS])


def verify_backend_processes(expected):
    """Prove each restarted service is executing from the selected release."""
    expected = expected.resolve(strict=True)
    for unit in UNITS:
        pid = subprocess.check_output(
            ['systemctl', 'show', unit, '--property=MainPID', '--value'], text=True
        ).strip()
        if not pid.isdigit() or pid == '0':
            raise RuntimeError(f'{unit} has no running process')
        actual = Path(f'/proc/{pid}/cwd').resolve(strict=True)
        if actual != expected:
            raise RuntimeError(f'{unit} runs from {actual}, expected {expected}')


def backup(root, component, target):
    folder = root / 'backups' / f'{component}-{time.time_ns()}'
    folder.mkdir(parents=True, mode=0o700)
    previous = target.resolve(strict=True)
    (folder / 'previous.json').write_text(json.dumps({'component': component, 'path': str(previous)}))
    with tarfile.open(folder / 'application.tgz', 'w:gz') as tar:
        def allowed(member):
            return None if any(part in {'venv', '.env', 'media', 'logs', '__pycache__', '.git', 'node_modules'} for part in Path(member.name).parts) else member
        tar.add(previous, arcname='application', filter=allowed)
    if component == 'backend':
        backend_command(previous, [str(Path(__file__).with_name('backup_db.py')), str(folder / 'database.dump')])
        run(['pg_restore', '--list', str(folder / 'database.dump')], stdout=subprocess.DEVNULL)
    return folder, previous


def activate(root, component, sha):
    valid_sha(sha)
    release = root / component / sha
    metadata = json.loads((release / 'release.json').read_text())
    if metadata['source_commit'] != sha or metadata['component'] != component:
        raise ValueError('Staged release identity mismatch')
    target = TARGETS[component]
    if not target.is_symlink():
        raise ValueError('Live path must already be an approved symlink layout')
    folder, previous = backup(root, component, target)
    app = prepare_backend(release) if component == 'backend' else release
    (folder / 'new.json').write_text(json.dumps({'source_commit': sha, 'path': str(app)}))
    switch(target, app)
    try:
        restart(component)
        if component == 'backend':
            verify_backend_processes(app)
        health(component, sha)
    except Exception:
        switch(target, previous)
        restart(component)
        raise
    print(f'ACTIVATED {sha}; rollback: python3 {__file__} rollback {component} --root {root} --backup {folder}')


def rollback(root, component, folder):
    folder = folder.resolve(strict=True)
    if not folder.is_relative_to((root / 'backups').resolve()):
        raise ValueError('Backup must belong to this release root')
    data = json.loads((folder / 'previous.json').read_text())
    if data['component'] != component:
        raise ValueError('Backup component mismatch')
    previous = Path(data['path']).resolve(strict=True)
    if component == 'backend':
        backend_command(previous, ['manage.py', 'check'])
        backend_command(previous, ['manage.py', 'migrate', '--check'])
    switch(TARGETS[component], previous)
    restart(component)
    if component == 'backend':
        verify_backend_processes(previous)
    sha = (previous / 'SOURCE_COMMIT').read_text().strip() if component == 'frontend' else ''
    health(component, sha)
    print('ROLLED BACK application; database was NOT restored or reverse-migrated')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['stage', 'activate', 'rollback'])
    parser.add_argument('component', choices=list(TARGETS))
    parser.add_argument('--root', type=Path, default=Path('/home/gamma/releases/sprint10'))
    parser.add_argument('--sha')
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--digest')
    parser.add_argument('--backup', type=Path)
    args = parser.parse_args()
    os.umask(0o022)
    with lock(args.root):
        if args.action == 'stage':
            stage(args.root, args.component, args.sha, args.archive, args.digest)
        elif args.action == 'activate':
            activate(args.root, args.component, args.sha)
        else:
            rollback(args.root, args.component, args.backup)


if __name__ == '__main__':
    main()
