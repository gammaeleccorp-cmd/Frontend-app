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
        self.assertEqual(json.loads((destination / 'release.json').read_text())['source_commit'], self.sha)
        with self.assertRaises(ValueError):
            release.stage(self.root, 'frontend', self.sha, archive, digest)

    def test_archive_escape_and_bad_digest_are_rejected(self):
        archive = self.archive({'../escape': 'bad'})
        with self.assertRaises(ValueError):
            release.extract(archive, self.root / 'extracted')
        with self.assertRaises(ValueError):
            release.stage(self.root, 'frontend', self.sha, archive, '0' * 64)
        self.assertFalse((self.root.parent / 'escape').exists())

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
