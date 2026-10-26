"""Create and safely extract deterministic frontend release transport archives."""

import argparse
import gzip
from pathlib import Path, PurePosixPath
import re
import tarfile


MAX_ASSET_SIZE = 2 * 1024 * 1024 * 1024


def valid_sha(value):
    if not re.fullmatch(r"[0-9a-f]{40}", value):
        raise ValueError("Expected full lowercase source commit SHA")
    return value


def _archive_name(path):
    return PurePosixPath("release", *path.parts).as_posix()


def create(source, destination, sha):
    """Archive the exact release directory with stable ordering and metadata."""
    valid_sha(sha)
    source = source.resolve(strict=True)
    if source.name != "release" or not source.is_dir():
        raise ValueError("Source must be a release directory")
    expected = f"frontend-{sha}.tar.gz"
    if destination.name != expected:
        raise ValueError(f"Release asset must be named {expected}")

    entries = [source, *sorted(source.rglob("*"), key=lambda item: item.relative_to(source).as_posix())]
    for path in entries:
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError(f"Unsupported release entry: {path}")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("xb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.USTAR_FORMAT) as archive:
                for path in entries:
                    relative = path.relative_to(source)
                    info = archive.gettarinfo(str(path), arcname=_archive_name(relative))
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    info.mtime = 0
                    if path.is_dir():
                        archive.addfile(info)
                    else:
                        with path.open("rb") as handle:
                            archive.addfile(info, handle)


def _validated_members(archive):
    seen = set()
    total_size = 0
    members = archive.getmembers()
    for member in members:
        name = member.name
        path = PurePosixPath(name)
        if (
            not name
            or name.startswith(("/", "\\"))
            or "\\" in name
            or ":" in name
            or path.is_absolute()
            or ".." in path.parts
            or path.parts[0] != "release"
            or name in seen
        ):
            raise ValueError(f"Unsafe release asset path: {name}")
        if not (member.isfile() or member.isdir()):
            raise ValueError(f"Links and special archive entries are forbidden: {name}")
        seen.add(name)
        total_size += member.size
        if total_size >= MAX_ASSET_SIZE:
            raise ValueError("Expanded release asset is too large")
    if "release" not in seen or not archive.getmember("release").isdir():
        raise ValueError("Release asset must contain a release directory")
    return members


def extract(source, destination):
    """Extract only regular release/ files after validating the whole archive."""
    if source.stat().st_size >= MAX_ASSET_SIZE:
        raise ValueError("Release asset is too large")
    destination.mkdir(parents=True, exist_ok=True)
    release = destination / "release"
    if release.exists() or release.is_symlink():
        raise ValueError("Destination release directory already exists")
    with tarfile.open(source, mode="r:gz") as archive:
        members = _validated_members(archive)
        archive.extractall(destination, members=members, filter="data")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="action", required=True)
    create_parser = subparsers.add_parser("create")
    create_parser.add_argument("--source", type=Path, required=True)
    create_parser.add_argument("--output", type=Path, required=True)
    create_parser.add_argument("--sha", required=True)
    extract_parser = subparsers.add_parser("extract")
    extract_parser.add_argument("--archive", type=Path, required=True)
    extract_parser.add_argument("--destination", type=Path, required=True)
    args = parser.parse_args()
    if args.action == "create":
        create(args.source, args.output, args.sha)
    else:
        extract(args.archive, args.destination)


if __name__ == "__main__":
    main()
