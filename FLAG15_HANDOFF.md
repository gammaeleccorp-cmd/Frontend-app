# Flag 15 handoff

Frontend branch: feat/flag15-frontend-fixes, separate checkout /home/gamma/dev/flag15-frontend.
Backend branch: feat/flag15-polygon, separate checkout /home/gamma/dev/flag15-backend.

Implemented inbox stacking/internal scrolling/Escape and outside dismissal, centered platform-title row, four-click accordion polygon editor with validation and preserved draft, disabled onboarding and direct-route redirect, latest recorded position Neshan links, and current telemetry speed.

Speed polls only device latest telemetry every 10 seconds while visible, without overlapping requests. Freshness is 90 seconds from recorded_at (not received_at), updated each second. device_status=0 (ACC off) yields zero only while fresh. Request errors retain the last sample until expiration; older samples are rejected, including background bootstrap refreshes. Existing background bootstrap interval was removed; initial load and visibility refresh remain.

Polygon contract: GET geofence advertises supports_polygon=true. PUT accepts boundary_points=[[latitude,longitude], ...] with exactly four ordered distinct finite vertices. GET/PUT return stored points. Server validates area and crossings and evaluates telemetry against the polygon, including boundary as inside. Existing circular configurations retain their behavior. Migration 0002 adds a JSON field; no production migration or deployment was performed. Frontend save stays disabled on servers without the capability flag and verifies returned points before showing success.

Validation: frontend unit suite passes (11 test files), lint, type-check, and Vite production build pass. Backend geofence suite passes 30 tests using isolated in-memory SQLite settings, including polygon save/reload, invalid inputs and entry/exit. PostgreSQL was unavailable. Dependencies reused from the existing frontend node_modules; no network installation.

Browser suite attempted twice but preview cannot bind 127.0.0.1:5178 (EPERM). Thus 320/390/desktop rendering, inbox stacking above actual Leaflet controls, touch/pan behavior, browser speed transitions, and Neshan exact-point opening on mobile/desktop remain unverified. Updated onboarding browser test asserts disabled Start Tracking and /add-device redirect. Updated dashboard browser test covers polygon clicks/undo/crossing and title/inbox checks; these changes have not executed here.

GitHub DNS is unavailable, so both worktrees were created from cached origin/main (frontend 5e1c927, backend 9e3287d). Remote freshness and pushing are unverified. No production services or data were changed.
