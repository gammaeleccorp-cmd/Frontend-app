"""Commit-addressed VPS releases. No activation occurs during stage.

Production paths must first be converted to symlinks during approved maintenance.
Database migrations are deliberately NOT automatic: pending migrations block activation.
"""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
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
    seen = set()
    total_size = 0
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            path = PurePosixPath(member.name)
            canonical = path.as_posix()
            if (not member.name or member.name.startswith(('/', '\\'))
                    or '\\' in member.name or ':' in member.name or path.is_absolute()
                    or '..' in path.parts or canonical in seen):
                raise ValueError('Unsafe archive path')
            if not (member.isfile() or member.isdir()):
                raise ValueError('Links and special archive entries are forbidden')
            seen.add(canonical)
            total_size += member.size
            if total_size >= 2 * 1024 * 1024 * 1024:
                raise ValueError('Expanded archive is too large')
        tar.extractall(target, filter='data')


def validate_release_layout(destination, component, sha):
    """Validate the immutable files that identify a staged release."""
    if destination.is_symlink() or not destination.is_dir():
        raise ValueError('Staged release directory is incomplete')

    for current, directories, files in os.walk(destination, followlinks=False):
        for name in directories + files:
            path = Path(current) / name
            if path.is_symlink() or not (path.is_dir() or path.is_file()):
                raise ValueError('Staged release contains an invalid entry')

    marker = destination / 'SOURCE_COMMIT'
    try:
        if marker.read_text().strip() != sha:
            raise ValueError('Staged release source marker mismatch')
    except OSError as exc:
        raise ValueError('Staged release source marker is missing') from exc

    if component == 'frontend':
        if not (destination / 'index.html').is_file():
            raise ValueError('Staged frontend entrypoint is missing')
        for current, directories, files in os.walk(destination, followlinks=False):
            for name in directories + files:
                if (Path(current) / name).stat().st_mode & 0o222:
                    raise ValueError('Staged frontend release must be read-only')
        return

    app = destination / 'gamma_backend'
    wheelhouse = destination / 'wheelhouse'
    if not (app / 'manage.py').is_file() or not wheelhouse.is_dir() or not any(wheelhouse.iterdir()):
        raise ValueError('Staged backend artifact is incomplete')


def content_digest(destination):
    """Hash extracted content independently of tar metadata and release.json."""
    digest = hashlib.sha256()
    for path in sorted(destination.rglob('*'), key=lambda item: item.relative_to(destination).as_posix()):
        relative = path.relative_to(destination).as_posix()
        if relative == 'release.json':
            continue
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Staged release contains an invalid entry')
        digest.update(('directory' if path.is_dir() else 'file').encode())
        digest.update(b'\0')
        digest.update(relative.encode())
        digest.update(b'\0')
        if path.is_file():
            with path.open('rb') as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b''):
                    digest.update(chunk)
    return digest.hexdigest()


def freeze_frontend(destination):
    """Prevent accidental mutation of a commit-addressed frontend release."""
    for path in destination.rglob('*'):
        path.chmod(0o555 if path.is_dir() else 0o444)
    destination.chmod(0o555)


def validate_staged_release(destination, component, sha, digest, expected_content_digest=None):
    """Validate an existing release before treating staging as idempotent."""
    metadata_path = destination / 'release.json'
    try:
        metadata = json.loads(metadata_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError('Existing release metadata is invalid') from exc

    expected = {
        'source_commit': sha,
        'component': component,
        'artifact_sha256': digest,
    }
    if component == 'frontend':
        expected['content_sha256'] = metadata.get('content_sha256')
    if metadata != expected:
        raise ValueError('Existing release metadata mismatch')
    if component == 'frontend':
        actual_content_digest = content_digest(destination)
        if metadata['content_sha256'] != actual_content_digest:
            raise ValueError('Existing release content checksum mismatch')
        if expected_content_digest is not None and actual_content_digest != expected_content_digest:
            raise ValueError('Existing release differs from the verified artifact')
    validate_release_layout(destination, component, sha)


def stage(root, component, sha, archive, digest):
    if component not in TARGETS:
        raise ValueError(f'Unsupported release component: {component}')
    valid_sha(sha)
    if not re.fullmatch(r'[0-9a-f]{64}', digest) or hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
        raise ValueError('Artifact checksum mismatch')
    destination = root / component / sha
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.staging-', dir=destination.parent) as temporary:
        work = Path(temporary)
        extract(archive, work)
        # TemporaryDirectory starts private; Nginx must traverse the published tree.
        work.chmod(0o755)
        app = work if component == 'frontend' else work / 'gamma_backend'
        if component == 'frontend':
            if (app / 'SOURCE_COMMIT').read_text().strip() != sha or not (app / 'index.html').is_file():
                raise ValueError('Frontend source marker or entrypoint missing')
        elif not (app / 'manage.py').is_file() or not (work / 'wheelhouse').is_dir() or not any((work / 'wheelhouse').iterdir()) or (work / 'SOURCE_COMMIT').read_text().strip() != sha:
            raise ValueError('Backend source or CI wheelhouse missing')
        extracted_digest = content_digest(work)
        if destination.exists() or destination.is_symlink():
            validate_staged_release(destination, component, sha, digest, extracted_digest)
            print(f'ALREADY STAGED {component} {sha} at {destination}; production untouched')
            return
        metadata = {
            'source_commit': sha,
            'component': component,
            'artifact_sha256': digest,
        }
        if component == 'frontend':
            metadata['content_sha256'] = extracted_digest
        (work / 'release.json').write_text(json.dumps(metadata, sort_keys=True))
        if component == 'frontend':
            freeze_frontend(work)
        validate_staged_release(work, component, sha, digest, extracted_digest)
        try:
            os.rename(work, destination)
        except FileExistsError:
            # Another stage operation won the immutable destination race.  It
            # is safe to accept only if the winner is the same verified artifact.
            validate_staged_release(destination, component, sha, digest, extracted_digest)
            print(f'ALREADY STAGED {component} {sha} at {destination}; production untouched')
            return
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
    validate_staged_release(release, component, sha, metadata.get('artifact_sha256', ''))
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
    parser.add_argument('action', choices=['stage', 'activate', 'rollback', 'validate-archive', 'safe-extract'])
    parser.add_argument('component', nargs='?', choices=list(TARGETS))
    parser.add_argument('--root', type=Path, default=Path('/home/gamma/releases/sprint10'))
    parser.add_argument('--sha')
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--digest')
    parser.add_argument('--backup', type=Path)
    parser.add_argument('--destination', type=Path)
    args = parser.parse_args()
    os.umask(0o022)
    if args.action in {'validate-archive', 'safe-extract'} and args.archive is None:
        parser.error('--archive is required')
    if args.action == 'validate-archive':
        with tempfile.TemporaryDirectory(prefix='archive-validation-') as temporary:
            extract(args.archive, Path(temporary))
        return
    if args.action == 'safe-extract':
        if args.destination is None:
            parser.error('--destination is required for safe-extract')
        args.destination.mkdir(parents=True, exist_ok=False)
        extract(args.archive, args.destination)
        return

    with lock(args.root):
        if args.action == 'stage':
            if args.component is None:
                parser.error('component is required for stage')
            stage(args.root, args.component, args.sha, args.archive, args.digest)
        elif args.action == 'activate':
            if args.component is None:
                parser.error('component is required for activate')
            activate(args.root, args.component, args.sha)
        else:
            if args.component is None:
                parser.error('component is required for rollback')
            rollback(args.root, args.component, args.backup)


if __name__ == '__main__':
    main()
