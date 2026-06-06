# BrandCog.Base-ai — MVP

A real, deployable demo of BrandCog: AI-driven out-of-home (OOH) brand-recognition
intelligence. Typed Node server + a live engine + an editorial dashboard, running
**mock-first** on synthetic Lusaka data. Built to the Billy-Zimba production posture
(see `CLAUDE.md`), deploy pattern mirrored from Verithica.

## What it does
- Serves `/api/campaign` — the engine **re-derives** brand/sector rollups, value
  bands and recognition equity live from detections (not hardcoded JSON).
- Dashboard at `/` with KPIs, a measured/modelled/assumed **provenance legend**,
  sector value **bands**, a **Recognition-Equity** tile, brand ledger and site list.
- v2 audit fixes baked in: "Estimated Reach" → **MGO**, value as a band, half-lives
  flagged *assumed*, CLIP local-brand bias surfaced.

## Run locally
```bash
npm install
npm run dev          # http://localhost:3000
# or production-style:
npm run build && npm start
npm run smoke        # boots dist + asserts the API is green
```

## Deploy (Fly.io)
```bash
fly deploy           # app: brandcog-demo, region jnb
```
`/healthz` is the health check. Boots with `MOCK=1`, no secrets.

## Structure
- `server/` — express app, domain engine (`decay`, `sectors`, `metrics`), `ports/` (DataPort + MockDataAdapter)
- `shared/types.ts` — the API contract
- `public/index.html` — the dashboard
- `Dockerfile`, `fly.toml` — deploy
- `CLAUDE.md` — the Billy-Zimba skills map / build standard
