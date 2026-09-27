# Gamma PWA — Unified Frontend

This is the single frontend baseline for UI + backend integration.

## 1) Development mode

Copy `.env.example` to `.env.local`.

For UI-only testing:

```env
VITE_USE_MOCK_API=true
VITE_API_BASE_URL=http://127.0.0.1:8000
```

For Django/DRF testing:

```env
VITE_USE_MOCK_API=false
VITE_API_BASE_URL=http://127.0.0.1:8000
```

Then:

```powershell
npm install
npm run dev
```

## 2) Backend route contract

All frontend route assumptions are in:

`src/config/endpoints.js`

Current assumed endpoints:

- `POST /api/v1/auth/otp/request/`
- `POST /api/v1/auth/otp/verify/`
- `GET /api/auth/me/`
- `GET /api/v1/vehicles/`
- `GET /api/v1/telemetry/vehicles/:id/latest/`
- `GET /api/v1/vehicles/:id/location/`
- `GET /api/vehicles/:id/dtcs/`
- `GET /api/vehicles/:id/routes/`
- `GET /api/vehicles/:id/mpu-events/`
- `POST /api/devices/:id/ota/check/`

If Django uses different routes, change only `src/config/endpoints.js`.

### Latest vehicle location

The existing `/vehicle` screen fetches the last complete GPS sample through the
authenticated API client. Enable `VITE_USE_MOCK_API=false` to use device data;
mock mode deliberately displays the no-location state rather than a fake position.

`GET /api/v1/vehicles/<uuid>/location/` accepts the existing Bearer access token.
The vehicle owner and existing device managers (`ROOT` / `DEVELOPER`) are allowed;
`is_staff` alone does not grant access. Responses:

- `200`: `{ "latitude": 35.7, "longitude": 51.4, "recorded_at": "2026-09-19T08:00:00Z", "speed": 42.0, "device_serial": "NGH-..." }`
- `204`: no complete valid location recorded yet (empty body).
- `401`: authentication required; `403`: permission denied; `404`: unknown vehicle.

Speed can be null. The latest sample is ordered by device `recorded_at`, then
receipt time and ID; newer non-GPS telemetry does not hide an older GPS sample.
MQTT accepts optional numeric `data.latitude` (-90..90) and `data.longitude`
(-180..180), inclusive. Missing/null/partial GPS is stored but is not a location.
Non-numeric, non-finite, or out-of-range coordinates reject the telemetry batch
using the existing validation behavior.

The map uses a client-only dynamic Leaflet import, OpenStreetMap tiles and an
orange vehicle marker. It fetches on page entry and manual refresh; no history,
WebSockets, or playback was added. Leaflet setup and attribution follow the
[official guide](https://leafletjs.com/examples/quick-start/).

Startup still requires the authorized vehicle list, but missing optional profile,
diagnostics, routes, MPU, or telemetry resources no longer block the vehicle page.
Their existing endpoint placeholders above are not newly implemented backend APIs.

Run `npm run lint`, `npm run type-check`, and `npm run build`.
This is a JavaScript/Vite project, not Next.js. TypeScript checks the new location
component via `@ts-check`; legacy JavaScript is not yet fully type-checked.
Apply backend migration `telemetry.0003_telemetry_location` before using the API
or restarting the MQTT worker.

## 3) Expected OTP verify response

The frontend accepts any of these token shapes:

```json
{"access": "...", "refresh": "..."}
```

or

```json
{"access_token": "...", "refresh_token": "..."}
```

or

```json
{"tokens": {"access": "...", "refresh": "..."}}
```

The access token is stored in `localStorage` and is sent as:

`Authorization: Bearer <token>`

## 4) Django CORS during local testing

The browser frontend normally runs on `http://localhost:5173`.

Django must allow this origin during local development. If `django-cors-headers` is used, allow at least:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
```

## 5) API smoke test

Open **Profile → Backend connection → Test connection**.

- Mock Mode: reports mock API.
- API Mode: reports whether the browser can reach the Django base URL.

## 6) Production

Build:

```powershell
npm run build
```

Deploy the generated `dist/` directory behind Nginx.
