# BrandRecog.io — MVP (mvp1.2.07)

Photo-verified out-of-home (OOH) brand intelligence. The first channel of the
**BrandCog.ai** 360° Brand Health platform. Company: **Equanamity** (a Travis Paul
Holdings company). Typed Node/Express, **mock-first**, deploy pattern per `CLAUDE.md`.

Versioning: single source `shared/version.ts` (+0.0.1 per change) · history in `CHANGELOG.md`.

## Integrated site
- `/` Coming-Soon + waitlist · `/marketing` (learn more, pricing, book-a-demo) ·
  `/signup` (email-gated) · `/login` (username/password) · `/app` (dashboard) · `/upload`.
- **Email gating:** business/work email → **real data**; free email → **mock** (synthetic Lusaka). `server/domain/emailGate.ts`.
- **Auth (mock):** username = client key, password = `<key>2026` (e.g. `agency`/`agency2026`). `server/clients.ts`.
- **Leads DB:** waitlist/signup/booking persist to a Fly volume (`/data`); admin CSV at `/api/leads?key=$ADMIN_KEY&format=csv`.

## Maps — free now, Google ready for paying clients
- **Default: OpenStreetMap (Leaflet)** — free, no key, no billing. Active out of the box.
- **Google Maps: plug-and-pay.** Set `GOOGLE_MAPS_API_KEY` and the app switches to Google
  automatically (no code change). Includes a `gm_authFailure` fallback to OSM if the key
  is misconfigured. `/api/config` reports the active provider.
- **To enable Google for a client:** (1) enable **billing** on the GCP project (free $200/mo
  credit) — without it Google renders a "development only" watermark; (2) enable **Maps
  JavaScript API**; (3) restrict the key → *Websites* referrers (`*.fly.dev/*`, `localhost`)
  + *API restriction* = Maps JavaScript API; (4) cap spend with a daily **quota** + **budget
  alert**; (5) `fly secrets set GOOGLE_MAPS_API_KEY=… -a <app>`. (Currently app-wide; per-tenant
  keying is a future step.)
- Geo/street labels currently use coordinates; **Geocoding API** is the upgrade for street names.

## Run locally
```bash
npm install
npm run build && npm run smoke   # 25 assertions
PORT=4000 node dist/index.js     # http://localhost:4000   (add GOOGLE_MAPS_API_KEY=… to test Google)
```

## Deploy (Fly.io) — on sign-off
```bash
fly deploy --remote-only --ha=false      # apps: brandcog-io (canonical) + brandcog-demo (bookmark sync)
```
Free OSM map by default — do **not** set the Google secret unless a paying client opts in.

## Data
- `server/data/campaign.real.json` — real recognition (876 detections, 264 geo-located via EXIF GPS, 219 snapshots).
- `server/data/campaign.mock.json` — synthetic Lusaka (geo) for free-tier demo.
- Rebuild: `scripts/etl_real_geo.py` (real + snapshots), `scripts/etl_mock_data.py` (mock).
