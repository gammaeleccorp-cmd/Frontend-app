# Sprint 10 release procedure

**NOT approved for production activation.** Backend runtime provenance is established,
but the Sprint source differs from the running revision, published frontend assets have
direct patches, and frontend provenance must still be reconciled.
The release workflow is manual and activation additionally requires
`ENABLE_PRODUCTION_DEPLOYMENT=true` and approval in the `production` environment.
Do not set that variable until the gates below have passed. This sprint did not deploy.

## Repositories and CI

Backend: `PouryaDadlouie98/gamma_backend`, application in `gamma_backend/`.
Frontend: `gammaeleccorp-cmd/Frontend-app`, application at repository root.
Each repository has its own CI and manual release workflow. PRs and pushes to main
run checks; manual CI runs are also possible. PR artifacts are never deployment inputs.
Backend CI uses Python 3.12 (VPS runtime), PostgreSQL 16 disposable service and
`ci_settings`; Channels and caches are in-memory. Unexpected network calls fail
the suite. No production credentials, databases, SMS or MQTT connections are used.
The existing requirements file is used (no backend lock existed); source and the
Linux wheelhouse travel together. Frontend uses Node 22 and `npm ci` from the lock.
Browser checks use intercepted API responses, never real OTPs or device commands.

Artifacts: `backend-<40-char-SHA>` contains `source.tar`, `SOURCE_COMMIT`,
`SHA256SUMS`; `frontend-<SHA>` contains `frontend.tgz` and the same sidecars.
The build that passed tests is uploaded, then downloaded by run ID without rebuilding.
Only successful main-branch push/manual runs of `.github/workflows/ci.yml` qualify.
Checksums and source markers are verified. Retain the run URL and artifact ID/digest
with each approval. Local builds do not count as a remote CI pass.

### Current audit status (2026-10-09)

The VPS backend checkout remains `/home/gamma/apps/gamma_backend` with origin
`git@github.com:PouryaDadlouie98/gamma_backend.git`, branch `main`, and clean commit
`c87a42861f457fdd14b2802e7dea1f82ce054680` at capture time. A read-only `/proc` and
systemd audit confirms the Daphne API, command consumer and telemetry MQTT consumer
all execute Python 3.12 from `/home/gamma/apps/gamma_backend/gamma_backend`. The API
started after every captured Python-file change. The telemetry consumer started before
only `telemetry/urls.py` and `telemetry/views.py`, which are outside its ingestion path.
The command consumer started on October 5, before 20 Python files (including models
loaded by `django.setup()`) were updated on October 6-7. Its in-memory generation cannot
therefore be certified as the current clean commit without a controlled restart; do not
infer the running revision from HEAD alone. The frontend checkout is dirty and
`/var/www/gamma-pwa` is a separate directly patched bundle.

Backend remote CI is **PENDING**. The VPS authenticates to GitHub as
`PouryaDadlouie98` and can read the retained backend origin; `gammaeleccorp-cmd`
does not have repository access. Do not change the origin, infer a remote CI pass
from local checks, or dispatch a release until the required account access exists.
Frontend remote CI is also **PENDING** until reviewed changes are pushed and its
default-branch workflow succeeds.

## Configuration (names only; no values in Git)

Create environments `release-staging` and `production` in both repositories.
Configure required reviewers for production, prevent self-review and admin bypass,
and restrict deployment to main. Environment protection is external GitHub state;
the YAML does not create reviewer rules. Verify your repository plan supports them.
Leave repository variable `ENABLE_PRODUCTION_DEPLOYMENT` unset/false until ready.

Environment secret names: `VPS_HOST`, `VPS_PORT`, `VPS_USER`,
`VPS_SSH_PRIVATE_KEY`, `VPS_KNOWN_HOSTS`. Use a restricted deploy key, a verified
known-host entry, and no production secrets in PR jobs. Do not use ssh-keyscan as
a replacement for out-of-band host-key verification. Existing Django/SMS/MQTT
environment values stay server-side. No activation SMS changes are included.

## Required one-time server layout approval

Audit observed ordinary directories at the existing backend and published frontend
paths. Activation refuses these until an approved maintenance conversion is complete.
Preserve Nginx roots and systemd paths; configure this layout without changing them:

```
/var/www/gamma-pwa -> /home/gamma/releases/sprint10/frontend/current
/home/gamma/apps/gamma_backend/gamma_backend -> /home/gamma/releases/sprint10/backend/current
/home/gamma/releases/sprint10/frontend/current -> <retained initial frontend directory>
/home/gamma/releases/sprint10/backend/current -> <retained initial backend directory>
```

During an approved window, stop the three Gamma services, back up the database and
both directories, relocate (do not delete) the originals to named initial-release
directories, and create these symlinks. Use root only for the initial `/var/www`
conversion; subsequent `current` links are owned by gamma. Ensure Nginx can traverse
the release directories. Preserve initial directory permissions and validate all
three units plus HTTP readiness before ending maintenance. Preserve the original
frontend exactly; its `SOURCE_COMMIT` may be `legacy-unresolved` until provenance is
resolved, never label it c87a428. Retain its HTML/asset hashes separately.

Provision `/home/gamma/shared/backend.env` from the existing environment with mode
0600, and `/home/gamma/shared/media` preserving existing media and permissions.
New backend releases link to these paths. Existing units keep their EnvironmentFile,
WorkingDirectory and ExecStart paths, resolved through the current symlink. Verify
actual unit definitions and Nginx static/media aliases before approving this layout.
Require Python 3.12 + venv, PostgreSQL client tools compatible with the DB server,
and narrowly scoped noninteractive sudo permission to restart the three existing
Gamma units. Do not alter Mosquitto, its identities, or its service configuration.

## Stage, approve, activate

1. Reconcile production source/bundle drift; verify published UI and product behavior.
2. Merge reviewed changes and require successful backend and frontend main CI runs.
3. Dispatch `Approved release` with CI run ID, exact source SHA and `activate=false`.
   This uploads verified artifacts and creates an immutable release under
   `/home/gamma/releases/sprint10/<component>/<SHA>`; it never switches live paths.
4. Review the staged artifact, source manifest and pending migration plan. Rehearse
   backup restore and rollback in an isolated environment. Obtain production approval.
5. After layout/secrets/gates are verified, enable the activation variable. To activate
   an already staged release, use the explicit server command below after approval
   (a repeat workflow stage rejects an already-existing immutable SHA). For a fresh
   release, dispatch with `activate=true`; stage completes before the production job
   waits for its protected-environment reviewer.

```sh
python3 /home/gamma/releases/sprint10/inbox/frontend-<SHA>/release.py activate frontend --sha <SHA>
python3 /home/gamma/releases/sprint10/inbox/backend-<SHA>/release.py activate backend --sha <SHA>
```

Both repositories share one VPS `flock`; concurrent stage/activate/rollback attempts
fail rather than overlap. Activation saves an application archive and previous-link
record in `backups/<component>-<timestamp>`. Backend additionally creates a custom
PostgreSQL dump and verifies that pg_restore can list it. A listing is NOT a completed
restore rehearsal. New backend venv dependencies are installed offline from CI's
wheelhouse. Django checks, migration check and collectstatic must pass before switching.
Frontend switches atomically using `os.replace` on the current symlink. Health checks
require its exact source marker; backend requires all three units active and API
readiness `status=healthy`. Health failure restores the previous pointer and restarts
the backend units, while retaining the original failure exit status.

## Migration compatibility and rollback

**No automatic migrations or reverse migrations.** `migrate --check` blocks activation
when unapplied migrations exist. The snapshot has `commands/0003`, `commands/0004`
and `users/0004` not present in the observed production migration list. Review their
SQL and old-code compatibility against a restored disposable database before any
separately approved expand-only migration. Nullable/additive changes do not justify
assuming every earlier application revision will work. Any destructive migration
needs its own recovery plan. Keep code rollback and database recovery separate.

Explicit rollback, using the backup path printed by activation:

```sh
python3 /home/gamma/releases/sprint10/inbox/<component>-<SHA>/release.py rollback <component> --backup /home/gamma/releases/sprint10/backups/<component>-<timestamp>
```

Rollback checks the previous backend against the current database, switches the
pointer, restarts existing units and checks health. It does NOT restore the database.
Database restore requires an approved maintenance window, stopped writers, a verified
dump and a restore rehearsal; never overwrite live data as a side effect of code rollback.

## Field acceptance (PENDING)

Use an existing authenticated account or a designated test account on a physical
phone. Do not send OTPs to make CI pass. Record phone/browser, release SHA, UTC time
and evidence for Home, Routes, Vehicle and Profile: navigation, narrow layout, loading,
empty, offline and error states. Verify that NG-0001 without a vehicle opens its
dashboard and history. Browser emulation with mocked APIs is regression evidence only.

On a powered NG-0001, using the existing authenticated session:

1. Record server UTC time and GET `/api/v1/telemetry/devices/NG-0001/latest/` and
   `/api/v1/telemetry/devices/NG-0001/history/`. Empty latest is 204; empty history is [].
2. Power the device and wait for ingestion. Repeat latest/history and verify new record
   identity and advancing `received_at`. Internal serial remains the MQTT identity;
   public NG/RH/LM four-digit codes remain API/UI identifiers.
3. Compare `recorded_at` (device measurement time) and `received_at` (server insertion
   time). A newly delivered historical position is not a fresh GPS fix. Verify valid
   location and ordered route display, not merely a green connection indicator.
4. Power off, wait more than the configured 300 seconds plus one UI refresh interval,
   and verify offline status without discarding the retained location/history.
5. Disable network/refresh and ensure a previously online snapshot expires; restore
   network and confirm recovery. Do not actuate relays merely for release acceptance.

Sprint remains open until provenance, both remote CI runs, staging/rollback rehearsal,
authenticated physical-mobile checks and live freshness/offline checks all pass.
