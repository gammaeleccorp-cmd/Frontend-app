# Flag 15 handoff

Frontend branch: feat/flag15-frontend-fixes, separate checkout /home/gamma/dev/flag15-frontend.
Backend branch: feat/flag15-polygon, separate checkout /home/gamma/dev/flag15-backend.

Implemented inbox stacking/internal scrolling/Escape and outside dismissal, centered platform-title row, four-click accordion polygon editor with validation and preserved draft, device-aware registration empty state and direct-route redirect, per-point Neshan links in the restored Routes recorded history, and current telemetry speed.

Speed polls only device latest telemetry every 10 seconds while visible, without overlapping requests. Freshness is 90 seconds from recorded_at (not received_at), updated each second. device_status=0 (ACC off) yields zero only while fresh. Request errors retain the last sample until expiration; older samples are rejected, including background bootstrap refreshes. Existing background bootstrap interval was removed; initial load and visibility refresh remain.

Polygon contract: GET geofence advertises supports_polygon=true. PUT accepts boundary_points=[[latitude,longitude], ...] with exactly four ordered distinct finite vertices. GET/PUT return stored points. Server validates area and crossings and evaluates telemetry against the polygon, including boundary as inside. Existing circular configurations retain their behavior. Migration 0002 adds a JSON field; no production migration or deployment was performed. Frontend save stays disabled on servers without the capability flag and verifies returned points before showing success.

Validation: frontend unit suite passes (11 test files), lint, type-check, and Vite production build pass. Backend geofence suite passes 30 tests using isolated in-memory SQLite settings, including polygon save/reload, invalid inputs and entry/exit. PostgreSQL was unavailable. Dependencies reused from the existing frontend node_modules; no network installation.

Browser suite attempted twice but preview cannot bind 127.0.0.1:5178 (EPERM). Thus 320/390/desktop rendering, inbox stacking above actual Leaflet controls, touch/pan behavior, browser speed transitions, and Neshan exact-point opening on mobile/desktop remain unverified. Updated onboarding browser test asserts a single RTL registration message without a disabled button and /add-device redirect. Updated dashboard browser test covers polygon clicks/undo/crossing and title/inbox checks; these changes have not executed here.

GitHub DNS is unavailable, so both worktrees were created from cached origin/main (frontend 5e1c927, backend 9e3287d). Remote freshness and pushing are unverified. No production services or data were changed.

## Recorded Points correction (2026-11-16)

Restored the original Routes history row layout, including each point's formatted Persian date/time and speed. The list filters invalid coordinates and timestamps, sorts by recordedAt descending, and displays at most 100 entries. Each row replaces its coordinate text with «مشاهده در نشان» targeting its own full-precision coordinates. Removed the standalone latest-location link and timestamp below the route map, and removed Neshan links from Home, Device Details, and VehicleLocation. The route map, trace, marker and geofence behavior remain intact.

Validation: unit suite (12 files), lint, type-check and production build pass. Added a rendered Routes markup test with two different precise coordinate pairs and timestamps, checking each row's own href, date/time, speed and new-tab attributes; history tests check ordering, invalid-point exclusion, 100-item limit and no input mutation. Added browser assertions that click both links and intercept Neshan navigation to verify each popup URL without contacting Neshan. Browser execution remains blocked: the preview listener fails with EPERM and a direct Chromium launch reports missing system libraries. Actual browser navigation is therefore unverified. No deployment or production changes performed.

## Dashboard registration correction (2026-11-16)

HomeRoute now renders the existing dashboard directly for accounts with devices, removing the disabled «افزودن دستگاه» button and adjacent registration message. Accounts with no devices see one explicit RTL welcome empty state containing «ثبت دستگاه فعلاً در دسترس نیست.» and no button. The /add-device redirect to /home remains unchanged.

Validation: all 12 unit test files, lint, type-check and production build pass. Updated the existing registration test for the exact message, one occurrence, RTL, absence of buttons, device-aware HomeRoute and route guard. Browser tests cover both account states at 320px and 1280px, checking absent dashboard registration controls/message, one no-device empty state, no horizontal overflow, and the /add-device guard. Browser execution was attempted again but cannot start the preview listener (EPERM on 127.0.0.1:5178); actual viewport rendering remains unverified. No deployment performed.

## Brand and Negahban device headers (2026-11-16)

Both app header variants now share BrandHeader: the existing Gamma vector mark with a static warm glow, bold white GAMMA wordmark, and smaller orange VEHICLE PLATFORM subtitle. The LTR brand occupies its own centered full-width grid row; notification and product controls keep their existing behavior below it.

The Negahban device page has one «دستگاه نگهبان» title with the back button aligned at the RTL leading edge, with no DEVICE eyebrow or generic subtitle. Its existing overview card uses a tracker icon, LTR public-code badge, wrapping freshness chip («داده تازه» / «داده تازه دریافت نشده»), and last received time when a valid received_at exists. Freshness continues to use the existing five-minute telemetry contract; missing telemetry shows the unavailable state. Other product device headers retain their content.

Validation: all 13 unit test files, lint, type-check, production build, and diff whitespace checks pass. Rendered tests cover both shared headers and device fresh/stale/missing telemetry, public-code direction, and received timestamp. Existing per-row exact Neshan URL and registration route-guard tests pass. Browser coverage now checks both headers at 320/390/1280px, brand centering, RTL back/title alignment, readable unclipped labels, keyboard focus outlines, and screenshots; it retains exact-point Neshan popup and registration-guard checks. Attempted npm run test:e2e, but preview cannot bind 127.0.0.1:5178 (EPERM). Browser rendering, focus appearance, and navigation remain unverified in this environment. Changes kept local; no push or deployment.

## Welcome placement and recorded-points disclosure (2026-11-16)

Continues from 2ae2a41. The unchanged personalized welcome now occupies a full-width header grid row immediately below the complete Gamma brand. Normal flow and wrapping keep its box below the logo, wordmark, and subtitle throughout the existing opacity-only four-second entrance/exit animation. The four-second removal timer and reduced-motion behavior remain intact.

Routes recorded points now use a single native details/summary disclosure, initially collapsed, with the existing capped point count and a rotating chevron. Native keyboard operation and focus styling apply; reduced motion disables the chevron transition. The existing newest-first, maximum-100 history, each row's date/time, and exact-coordinate Neshan link are preserved. Neither Leaflet map is inside the disclosure.

Validation: all 13 unit test files, type-check, lint, production build, JavaScript syntax check for the updated browser suite, and diff whitespace checks pass. Rendered history checks also assert the default-closed disclosure, count, and chevron. Browser coverage was extended for long RTL names at 320/390px across entrance/visible/exit frames, unchanged removal timing, reduced motion, Enter/Space disclosure toggling, route-map zoom without remounting, and geofence draft preservation across toggles. It retains two separate intercepted Neshan popup destinations and polygon edit/save coverage. Tile responses are stubbed locally so map interactions do not depend on the external tile service.

Browser verification remains unverified: npm run test:e2e stops because the preview listener cannot bind 127.0.0.1:5178 (EPERM). A separate direct Chromium launch reports missing host libraries (ATK, AT-SPI, Xdamage, ALSA). No browser assertions or screenshots could execute. Changes remain local; no push or deployment.
