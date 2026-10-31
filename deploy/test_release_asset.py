import hashlib
import io
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import textwrap
import unittest

import release_asset


class ReleaseAssetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.release = self.root / "release"
        self.release.mkdir()
        (self.release / "SOURCE_COMMIT").write_text("a" * 40 + "\n")
        (self.release / "frontend.tgz").write_bytes(b"tested-dist")
        self.sha = "a" * 40

    def create_asset(self):
        asset = self.root / f"frontend-{self.sha}.tar.gz"
        release_asset.create(self.release, asset, self.sha)
        return asset

    def test_archive_is_deterministic_and_round_trips(self):
        first = self.create_asset()
        digest = hashlib.sha256(first.read_bytes()).hexdigest()
        first.rename(self.root / "saved.tar.gz")
        second = self.create_asset()
        self.assertEqual(hashlib.sha256(second.read_bytes()).hexdigest(), digest)
        destination = self.root / "extracted"
        release_asset.extract(second, destination)
        self.assertEqual((destination / "release" / "frontend.tgz").read_bytes(), b"tested-dist")

    def malicious_archive(self, name, kind=None):
        archive_path = self.root / "malicious.tar.gz"
        with tarfile.open(archive_path, "w:gz") as archive:
            root = tarfile.TarInfo("release")
            root.type = tarfile.DIRTYPE
            archive.addfile(root)
            info = tarfile.TarInfo(name)
            content = b"bad"
            info.size = len(content)
            if kind is not None:
                info.type = kind
                info.linkname = "/tmp/escape"
                info.size = 0
                archive.addfile(info)
            else:
                archive.addfile(info, io.BytesIO(content))
        return archive_path

    def test_rejects_unsafe_paths_links_and_wrong_name(self):
        for index, name in enumerate(("/escape", "release/../escape", "release\\escape")):
            with self.subTest(name=name):
                with self.assertRaisesRegex(ValueError, "Unsafe"):
                    release_asset.extract(self.malicious_archive(name), self.root / f"out-{index}")
        with self.assertRaisesRegex(ValueError, "Links and special"):
            release_asset.extract(
                self.malicious_archive("release/link", tarfile.SYMTYPE), self.root / "link-out"
            )
        with self.assertRaisesRegex(ValueError, "must be named"):
            release_asset.create(self.release, self.root / "wrong.tar.gz", self.sha)

    def test_rejects_equivalent_duplicate_paths(self):
        archive_path = self.root / "duplicates.tar.gz"
        with tarfile.open(archive_path, "w:gz") as archive:
            root = tarfile.TarInfo("release")
            root.type = tarfile.DIRTYPE
            archive.addfile(root)
            for name in ("release/SOURCE_COMMIT", "release/./SOURCE_COMMIT"):
                content = self.sha.encode()
                info = tarfile.TarInfo(name)
                info.size = len(content)
                archive.addfile(info, io.BytesIO(content))
        destination = self.root / "duplicate-out"
        with self.assertRaisesRegex(ValueError, "Unsafe"):
            release_asset.extract(archive_path, destination)
        self.assertFalse((destination / "release" / "SOURCE_COMMIT").exists())

    def mock_gh(self, asset):
        mock_bin = self.root / "bin"
        mock_bin.mkdir()
        gh = mock_bin / "gh"
        gh.write_text(textwrap.dedent("""\
            #!/bin/sh
            case "$*" in
              *git/ref/tags/*)
                printf '{"object":{"type":"commit","sha":"%s"}}' "$MOCK_SHA"
                ;;
              *releases?per_page=100*)
                [ "${MOCK_NO_DRAFT:-0}" = 1 ] && { printf '[]'; exit 0; }
                target="$MOCK_SHA"
                [ "${MOCK_BAD_RELEASE:-0}" = 1 ] && target=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
                printf '[{"id":123,"tag_name":"frontend-ci-%s","target_commitish":"%s","draft":true}]' "$MOCK_SHA" "$target"
                ;;
              *releases/123/assets?per_page=100*)
                size=$(stat -c %s "$MOCK_ASSET")
                printf '[{"id":456,"name":"frontend-%s.tar.gz","size":%s}]' "$MOCK_SHA" "$size"
                ;;
              *releases/assets/456*)
                cat "$MOCK_ASSET"
                ;;
              *)
                echo "unexpected gh call: $*" >&2
                exit 2
                ;;
            esac
        """))
        gh.chmod(0o755)
        env = dict(os.environ)
        env.update({
            "PATH": f"{mock_bin}:{env['PATH']}",
            "GH_TOKEN": "test-token",
            "GITHUB_REPOSITORY": "example/frontend",
            "MOCK_SHA": self.sha,
            "MOCK_ASSET": str(asset),
        })
        return env

    @unittest.skipUnless(os.name == "posix", "Bash downloader integration")
    def test_downloader_validates_metadata_downloads_and_extracts(self):
        asset = self.create_asset()
        env = self.mock_gh(asset)
        archive_dir = self.root / "download"
        destination = self.root / "destination"
        repository = Path(__file__).resolve().parents[1]
        subprocess.run(
            ["bash", "deploy/download_release_asset.sh", self.sha, str(archive_dir), str(destination)],
            cwd=repository,
            env=env,
            check=True,
        )
        self.assertEqual((destination / "release" / "SOURCE_COMMIT").read_text().strip(), self.sha)

        bad_env = dict(env, MOCK_BAD_RELEASE="1")
        bad = subprocess.run(
                ["bash", "deploy/download_release_asset.sh", self.sha, str(self.root / "bad"), str(self.root / "bad-out")],
                cwd=repository,
                env=bad_env,
                capture_output=True,
                text=True,
            )
        self.assertNotEqual(bad.returncode, 0)
        self.assertIn("check failed", bad.stderr)
        self.assertNotIn("test-token", bad.stderr)

        hidden = subprocess.run(
            ["bash", "deploy/download_release_asset.sh", self.sha, str(self.root / "hidden"), str(self.root / "hidden-out")],
            cwd=repository,
            env=dict(env, MOCK_NO_DRAFT="1"),
            capture_output=True,
            text=True,
        )
        self.assertNotEqual(hidden.returncode, 0)
        self.assertIn("draft release", hidden.stderr)
        self.assertNotIn("test-token", hidden.stderr)


if __name__ == "__main__":
    unittest.main()
