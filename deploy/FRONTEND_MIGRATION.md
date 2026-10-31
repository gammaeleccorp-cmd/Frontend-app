# Frontend release-layout migration

This is a manual, one-time production change. CI may stage a release before
this migration, but it must not activate one. The current production layout is
`/var/www/gamma-pwa`; the release manager and reference Nginx configuration use
`/home/gamma/releases/sprint10/frontend/current`.

## Preconditions and blockers

- Attempt to recover the exact commit and artifact identity of the currently
  served build from deployment records. `/SOURCE_COMMIT` currently falls
  through to `index.html`, so if that identity cannot be proven, record it as
  unknown and capture a deterministic digest of the live files; never assign a
  guessed SHA. Keep `/var/www/gamma-pwa` untouched until a known-good new
  release is staged and independently checked. The preserved directory and
  saved Nginx configuration are the legacy rollback, even when its commit is
  unknown.
- Schedule an approved maintenance window with an operator allowed to edit
  Nginx configuration and ACLs and reload Nginx.
- Keep `ENABLE_PRODUCTION_DEPLOYMENT=false` and do not dispatch an activating
  workflow during the migration.
- Record the current enabled-site path, its checksum, `nginx -T` output, and
  the resolved `/var/www/gamma-pwa` path so the configuration can be restored.

## Prepare without affecting production

1. Run the release workflow with `activate=false` for an exact successful
   trusted `main` CI run. Confirm the staged directory is
   `/home/gamma/releases/sprint10/frontend/<sha>` and contains `index.html`,
   `SOURCE_COMMIT`, and `release.json`.
2. Confirm every staged frontend file is non-writable and that the SHA in
   `SOURCE_COMMIT` and both checksums in `release.json` match the workflow
   inputs/artifact.
3. Nginx runs as `www-data`, while `/home/gamma` is currently mode `0750`.
   Grant only traversal/read access to the release path with filesystem ACLs;
   do not broaden the home directory's mode or add Nginx to the `gamma` group:

       sudo setfacl -m u:www-data:--x /home/gamma
       sudo setfacl -m u:www-data:--x /home/gamma/releases /home/gamma/releases/sprint10
       sudo setfacl -m u:www-data:--x /home/gamma/releases/sprint10/frontend
       sudo setfacl -m d:u:www-data:r-X /home/gamma/releases/sprint10/frontend
       sudo setfacl -R -m u:www-data:r-X /home/gamma/releases/sprint10/frontend/<sha>

   Record the prior access and default ACLs with `getfacl` before applying
   them. The default ACL gives future staged release directories the same
   narrowly scoped Nginx read access.
4. Create `current.next` pointing to the staged SHA, verify it resolves within
   the frontend release directory, and atomically rename it to `current`.
   This does not affect live traffic while Nginx still uses `/var/www/gamma-pwa`.
5. From the repository reference file, prepare an Nginx candidate whose root is
   `/home/gamma/releases/sprint10/frontend/current` and whose exact
   `/SOURCE_COMMIT` location returns the file or 404, never `/index.html`.

## Maintenance-window cutover

1. Reconfirm `current` resolves to the reviewed staged SHA and that `www-data`
   can read `current/index.html` and `current/SOURCE_COMMIT`.
2. Install the reviewed Nginx candidate, run `sudo nginx -t`, and reload Nginx.
3. Verify `/SOURCE_COMMIT` is `text/plain`, equals the full expected SHA, and
   carries `Cache-Control: no-store`. Verify `/`, a client-side route, static
   assets, and API/CORS behavior. Do not remove `/var/www/gamma-pwa`.

## Reversible rollback

If validation fails, restore the saved Nginx enabled-site file, run
`sudo nginx -t`, reload Nginx, and verify traffic again uses
`/var/www/gamma-pwa`. This rollback does not depend on a source marker in the
legacy directory. After a successful cutover, normal release-manager rollback
atomically switches `current` to the prior commit-addressed release; its health
check is compatible because Nginx serves the exact `SOURCE_COMMIT` file.

Remove the legacy directory only in a later, separately approved change after
at least one proven activation and rollback cycle.
