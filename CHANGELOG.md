# BrandRecog.io — Changelog

Versioning: semver-style `MAJOR.MINOR.PATCH`, bumped +0.0.1 per shipped change.
Single source: `shared/version.ts` (surfaced via `/healthz`, `/api/config`, and the UI footer).

## 2.2.2 — Admin lead delete (cleanup)
- `DELETE /api/leads/:id` (admin: agency session or `ADMIN_KEY`) to remove a lead by id — `deleteLead()` in the lead store. Used to purge test records from the live store. Smoke covers protected/200/404 paths.

## 2.2.1 — Original marketing tagline (IP risk fix)
- Reworded the `/marketing` hero + page title away from "Are you getting the out-of-home exposure you paid for?" — a near-verbatim match to a competitor (Media Measure) tagline, an avoidable passing-off/copyright risk.
- New original hero (TP Mulenga): **"Measurable outcomes for your media."** + sub **"We deliver beyond proof of flighting"** — positions above basic flighting-verification (what competitors sell) into measured outcomes. Title now "Measurable outcomes for your media".
- Minor body edits to remove residual "paid for" phrasing (generic, non-infringing, hardened anyway).

## 2.2.0 — Waitlist confirmation email
- **Customer-facing confirmation** sent to the lead on waitlist signup ("You're on the BrandRecog.io waitlist") — branded HTML, CTAs to the live demo + marketing page (`server/domain/waitlistConfirm.ts`).
- Email port now supports per-message `from`/`to` overrides (`server/ports/email.ts`), so the confirmation sends from a customer sender to the lead, independent of the internal alert.
- Sender configurable via `RESEND_CONFIRM_FROM_EMAIL` (supports `"Name <addr>"`). Intended `hello@brandrecog.io` once that domain is registered+verified; until then set to a verified address (e.g. `BrandRecog.io <hello@travispaulconsulting.co>`). `PUBLIC_SITE_URL` sets the links.
- Both fire-and-forget — never block or break waitlist capture.

## 2.1.0 — R2BL lead-alert email
- **Email alert on every new lead** (waitlist / signup / booking) to the sales inbox (`RESEND_TO_EMAIL`, default `travis.mulenga@gmail.com`).
- **R2BL prospect profile** per lead — Reputation · Risk · Bio · Lifestyle, deterministic weighted scoring (`server/domain/r2bl.ts`, mirrors the R2BL engine), banded (not false-precision), with factor **provenance** (measured/modelled/assumed) + **discrimination-risk** flags, a narrative, a recommended next action, and a Prospect Priority band (Hot/Warm/Nurture/Cold). Built on the Verithica app-case methodology.
- **Email port** (`server/ports/email.ts`): mock-first, sends via the Resend REST API (no npm dep — uses `fetch`, stays bundle-clean). Gated on `RESEND_API_KEY` presence (not `MOCK`), so the live app still alerts. Fire-and-forget — never blocks/breaks lead capture.
- Engine check: `npx tsx scripts/r2bl.check.ts` (12 assertions + writes a sample alert).

## 2.0.0 — One app, public-ready
- **Single-app consolidation:** `brandcog-io` is now the one canonical app. The old `brandcog-demo` (v0.2.0, "BrandCog.Base-ai") is retired behind a 301 redirect to `brandcog-io`; its deployed build is archived privately.
- **Security hardening for public source:** `ADMIN_KEY` (gates the leads/PII export) is now a required Fly secret — the source default is local-dev only and no longer works in production. `.env.example` documents production secrets. Client login remains an intentional public demo (scheme shown on the login page; demo data only, no PII).
- **Public release:** the v1.2.x codebase is published as a public repo at this version; v0.2.0 retained in a separate private archive.
- Functionally identical to 1.2.07 (no engine/feature changes) — this is the milestone/version-line bump.

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
