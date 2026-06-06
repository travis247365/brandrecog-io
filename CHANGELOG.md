# BrandRecog.io — Changelog

Versioning: semver-style `MAJOR.MINOR.PATCH`, bumped +0.0.1 per shipped change.
Single source: `shared/version.ts` (surfaced via `/healthz`, `/api/config`, and the UI footer).

## 1.2.07 — Real geo + site snapshots
- Real-data accounts get geo-located sites (EXIF GPS re-extracted from billboard images) and **site OOH snapshots** (bundled creative thumbnails).
- Map renders real ZM/SA pins for verified accounts; mock accounts keep synthetic Lusaka geo.
- `/api/sites` returns snapshot URLs; dashboard shows a per-site snapshot strip.

## 1.2.06 — In-app map
- Leaflet/OpenStreetMap **map view** in the dashboard (free, no key) plotting site points from `/api/sites`.
- **Google Maps** as a plug-and-pay upgrade: activates automatically when `GOOGLE_MAPS_API_KEY` is set, else falls back to OSM.
- `/api/config` exposes version + active map provider.

## 1.2.05 — Integrated site
- One site: Coming-Soon + waitlist (`/`), marketing (`/marketing`), email-gated sign-up (`/signup`), username/password login (`/login`), tier-aware dashboard (`/app`).
- Email gating: business email → real data; free email → mock (synthetic Lusaka) data.
- Persistent lead store (signups/waitlist/bookings) on a Fly volume; admin CSV export.
- Nomenclature: BrandRecog.io (product) · BrandCog.ai (platform) · Equanamity (company) · Travis Paul Holdings (2022). Real TPCL/TPHL logos.
- Competitive engine: SOV, Share of Space, Share of Spend, Market Sizing, Brand Health; dynamic brand→sector switcher; agency multi-sector + plug-and-pay enrichment.

## earlier
- 0.2.0 — first deployable MVP (typed Node/Express, mock-first, competitive dashboard).
