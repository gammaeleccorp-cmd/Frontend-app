#!/usr/bin/env bash
set -euo pipefail

sha=${1:?source commit is required}
archive_dir=${2:?archive directory is required}
destination=${3:?extraction destination is required}
[[ "$sha" =~ ^[0-9a-f]{40}$ ]]
[[ -n "${GITHUB_REPOSITORY:-}" && -n "${GH_TOKEN:-}" ]]

tag="frontend-ci-$sha"
asset="frontend-$sha.tar.gz"
mkdir -p "$archive_dir"
archive="$archive_dir/$asset"
[[ ! -e "$archive" ]]

ref=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/tags/$tag")
object_type=$(jq -r '.object.type' <<<"$ref")
object_sha=$(jq -r '.object.sha' <<<"$ref")
while [[ "$object_type" == tag ]]; do
  annotated=$(gh api "repos/$GITHUB_REPOSITORY/git/tags/$object_sha")
  object_type=$(jq -r '.object.type' <<<"$annotated")
  object_sha=$(jq -r '.object.sha' <<<"$annotated")
done
[[ "$object_type" == commit && "$object_sha" == "$sha" ]]

releases=$(gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100" | jq -s 'add')
matches=$(jq --arg tag "$tag" '[.[] | select(.tag_name == $tag)]' <<<"$releases")
[[ "$(jq 'length' <<<"$matches")" -eq 1 ]]
release=$(jq '.[0]' <<<"$matches")
jq -e --arg tag "$tag" --arg sha "$sha" \
  '.tag_name == $tag and .target_commitish == $sha and .draft == true' <<<"$release"
release_id=$(jq -r '.id' <<<"$release")

assets=$(gh api --paginate "repos/$GITHUB_REPOSITORY/releases/$release_id/assets?per_page=100" | jq -s 'add')
matching_assets=$(jq --arg asset "$asset" '[.[] | select(.name == $asset)]' <<<"$assets")
[[ "$(jq 'length' <<<"$matching_assets")" -eq 1 ]]
asset_id=$(jq -r '.[0].id' <<<"$matching_assets")
asset_size=$(jq -r '.[0].size' <<<"$matching_assets")
[[ "$asset_size" -gt 0 && "$asset_size" -lt 2147483648 ]]

gh api -H 'Accept: application/octet-stream' \
  "repos/$GITHUB_REPOSITORY/releases/assets/$asset_id" > "$archive"
[[ "$(stat -c %s "$archive")" -eq "$asset_size" ]]
python3 deploy/release_asset.py extract --archive "$archive" --destination "$destination"
