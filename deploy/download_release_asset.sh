#!/usr/bin/env bash
set -euo pipefail

die() {
  printf 'download-release-asset: %s\n' "$*" >&2
  exit 1
}

require() {
  if ! "$@"; then
    die "check failed: $*"
  fi
}

sha=${1:?source commit is required}
archive_dir=${2:?archive directory is required}
destination=${3:?extraction destination is required}
if ! [[ "$sha" =~ ^[0-9a-f]{40}$ ]]; then die "source commit must be a 40-character lowercase SHA"; fi
require test -n "${GITHUB_REPOSITORY:-}"
require test -n "${GH_TOKEN:-}"

tag="frontend-ci-$sha"
asset="frontend-$sha.tar.gz"
mkdir -p "$archive_dir"
archive="$archive_dir/$asset"
require test ! -e "$archive"

if ! ref=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$tag"); then
  die "tag lookup failed for $tag"
fi
object_type=$(jq -r '.object.type' <<<"$ref")
object_sha=$(jq -r '.object.sha' <<<"$ref")
while [[ "$object_type" == tag ]]; do
  if ! annotated=$(gh api "repos/$GITHUB_REPOSITORY/git/tags/$object_sha"); then
    die "annotated tag lookup failed for $tag"
  fi
  object_type=$(jq -r '.object.type' <<<"$annotated")
  object_sha=$(jq -r '.object.sha' <<<"$annotated")
done
require test "$object_type" = commit
require test "$object_sha" = "$sha"

if ! releases=$(gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100" | jq -s 'add'); then
  die "release list lookup failed for $tag"
fi
matches=$(jq --arg tag "$tag" '[.[] | select(.tag_name == $tag)]' <<<"$releases")
match_count=$(jq 'length' <<<"$matches")
if [[ "$match_count" -ne 1 ]]; then
  die "expected exactly one draft release for $tag, found $match_count; contents:read tokens cannot discover this private draft"
fi
release=$(jq '.[0]' <<<"$matches")
require jq -e --arg tag "$tag" '.tag_name == $tag' <<<"$release"
require jq -e --arg sha "$sha" '.target_commitish == $sha' <<<"$release"
require jq -e '.draft == true' <<<"$release"
release_id=$(jq -r '.id' <<<"$release")

if ! assets=$(gh api --paginate "repos/$GITHUB_REPOSITORY/releases/$release_id/assets?per_page=100" | jq -s 'add'); then
  die "asset list lookup failed for release $release_id"
fi
matching_assets=$(jq --arg asset "$asset" '[.[] | select(.name == $asset)]' <<<"$assets")
asset_count=$(jq 'length' <<<"$matching_assets")
require test "$asset_count" -eq 1
asset_id=$(jq -r '.[0].id' <<<"$matching_assets")
asset_size=$(jq -r '.[0].size' <<<"$matching_assets")
if ! [[ "$asset_size" =~ ^[0-9]+$ && "$asset_size" -gt 0 && "$asset_size" -lt 2147483648 ]]; then
  die "check failed: asset size is outside the allowed range"
fi

if ! gh api -H 'Accept: application/octet-stream' \
  "repos/$GITHUB_REPOSITORY/releases/assets/$asset_id" > "$archive"; then
  die "asset download failed for $asset"
fi
downloaded_size=$(stat -c %s "$archive")
require test "$downloaded_size" -eq "$asset_size"
python3 deploy/release_asset.py extract --archive "$archive" --destination "$destination"
