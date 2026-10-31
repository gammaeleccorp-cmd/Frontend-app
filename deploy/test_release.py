import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import release


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.sha = 'a' * 40

    def archive(self, entries):
        archive = self.root / 'frontend.tgz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name, value in entries.items():
                content = value.encode()
                info = tarfile.TarInfo(name)
                info.size = len(content)
                tar.addfile(info, io.BytesIO(content))
        return archive

    def test_stage_checks_identity_and_is_immutable(self):
        archive = self.archive({'index.html': '<html/>', 'SOURCE_COMMIT': self.sha})
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        release.stage(self.root, 'frontend', self.sha, archive, digest)
        destination = self.root / 'frontend' / self.sha
        metadata = json.loads((destination / 'release.json').read_text())
        self.assertEqual(metadata['source_commit'], self.sha)
        self.assertRegex(metadata['content_sha256'], r'^[0-9a-f]{64}$')
        self.assertEqual((destination / 'index.html').stat().st_mode & 0o222, 0)
        release.stage(self.root, 'frontend', self.sha, archive, digest)

    def test_restage_rejects_mismatched_or_incomplete_existing_release(self):
        archive = self.archive({'index.html': '<html/>', 'SOURCE_COMMIT': self.sha})
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        release.stage(self.root, 'frontend', self.sha, archive, digest)
        destination = self.root / 'frontend' / self.sha

        metadata = json.loads((destination / 'release.json').read_text())
        destination.chmod(0o755)
        (destination / 'release.json').chmod(0o644)
        metadata['artifact_sha256'] = '0' * 64
        (destination / 'release.json').write_text(json.dumps(metadata))
        sentinel = destination / 'do-not-overwrite.txt'
        sentinel.write_text('preserve')
        with self.assertRaisesRegex(ValueError, 'metadata mismatch'):
            release.stage(self.root, 'frontend', self.sha, archive, digest)
        self.assertEqual(sentinel.read_text(), 'preserve')
        sentinel.chmod(0o444)

        (destination / 'release.json').write_text(json.dumps({
            'source_commit': self.sha,
            'component': 'frontend',
            'artifact_sha256': digest,
            'content_sha256': metadata['content_sha256'],
        }))
        (destination / 'release.json').chmod(0o444)
        (destination / 'index.html').unlink()
        with self.assertRaisesRegex(ValueError, 'content checksum mismatch'):
            release.stage(self.root, 'frontend', self.sha, archive, digest)

    def test_restage_detects_changed_content_even_if_metadata_is_unchanged(self):
        archive = self.archive({'index.html': '<html/>', 'SOURCE_COMMIT': self.sha})
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        release.stage(self.root, 'frontend', self.sha, archive, digest)
        destination = self.root / 'frontend' / self.sha
        index = destination / 'index.html'
        index.chmod(0o644)
        index.write_text('<html>changed</html>')
        with self.assertRaisesRegex(ValueError, 'content checksum mismatch'):
            release.stage(self.root, 'frontend', self.sha, archive, digest)

    def test_archive_escape_and_bad_digest_are_rejected(self):
        archive = self.archive({'../escape': 'bad'})
        with self.assertRaises(ValueError):
            release.extract(archive, self.root / 'extracted')
        with self.assertRaises(ValueError):
            release.stage(self.root, 'frontend', self.sha, archive, '0' * 64)
        self.assertFalse((self.root.parent / 'escape').exists())

    def test_archive_rejects_equivalent_duplicate_paths(self):
        archive = self.root / 'duplicates.tgz'
        with tarfile.open(archive, 'w:gz') as tar:
            for name in ('index.html', './index.html'):
                content = name.encode()
                info = tarfile.TarInfo(name)
                info.size = len(content)
                tar.addfile(info, io.BytesIO(content))
        destination = self.root / 'duplicates'
        with self.assertRaisesRegex(ValueError, 'Unsafe archive path'):
            release.extract(archive, destination)
        self.assertFalse((destination / 'index.html').exists())

    def test_bad_commit_marker_is_rejected(self):
        archive = self.archive({'index.html': '<html/>', 'SOURCE_COMMIT': 'b' * 40})
        with self.assertRaises(ValueError):
            release.stage(self.root, 'frontend', self.sha, archive, hashlib.sha256(archive.read_bytes()).hexdigest())

    def test_backend_artifact_layout_is_accepted(self):
        archive = self.archive({
            'gamma_backend/manage.py': '# entrypoint',
            'wheelhouse/dependency.whl': 'wheel',
            'SOURCE_COMMIT': self.sha,
        })
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        release.stage(self.root, 'backend', self.sha, archive, digest)
        destination = self.root / 'backend' / self.sha
        self.assertTrue((destination / 'gamma_backend' / 'manage.py').is_file())
        self.assertEqual(json.loads((destination / 'release.json').read_text())['component'], 'backend')

    def test_backend_process_verification_rejects_wrong_working_directory(self):
        expected = self.root / 'expected'
        actual = self.root / 'actual'
        expected.mkdir()
        actual.mkdir()
        with patch.object(release.subprocess, 'check_output', return_value='123\n'), \
             patch.object(Path, 'resolve', autospec=True) as resolve:
            resolve.side_effect = lambda path, strict=True: expected if path == expected else actual
            with self.assertRaisesRegex(RuntimeError, 'runs from'):
                release.verify_backend_processes(expected)

    @unittest.skipUnless(__import__('os').name == 'posix', 'Linux flock integration')
    def test_concurrent_deployment_lock_is_rejected(self):
        with release.lock(self.root):
            with self.assertRaises(BlockingIOError):
                with release.lock(self.root):
                    self.fail('Second lock acquired')

    @unittest.skipUnless(__import__('os').name == 'posix', 'Linux symlink/lock integration')
    def test_failed_health_restores_previous_release_and_explicit_rollback(self):
        previous = self.root / 'old'
        previous.mkdir()
        (previous / 'SOURCE_COMMIT').write_text('b' * 40)
        target = self.root / 'live'
        target.symlink_to(previous, target_is_directory=True)
        archive = self.archive({'index.html': '<html/>', 'SOURCE_COMMIT': self.sha})
        release.stage(self.root, 'frontend', self.sha, archive, hashlib.sha256(archive.read_bytes()).hexdigest())
        with patch.dict(release.TARGETS, frontend=target), patch.object(release, 'health', side_effect=RuntimeError('unhealthy')):
            with self.assertRaises(RuntimeError):
                release.activate(self.root, 'frontend', self.sha)
        self.assertEqual(target.resolve(), previous)
        with patch.dict(release.TARGETS, frontend=target), patch.object(release, 'health'):
            release.activate(self.root, 'frontend', self.sha)
            backup = sorted((self.root / 'backups').iterdir())[-1]
            release.rollback(self.root, 'frontend', backup)
        self.assertEqual(target.resolve(), previous)


if __name__ == '__main__':
    unittest.main()
