# BrandCog MVP — Build Posture & Skills Map (Billy Zimba)

> **Build lead posture: Billy Zimba — production engineer.** Ship fast, but
> mock-first, typed, and secure by default. This file is the standard the MVP was
> built to, and the standard any future change must hold.

This is the *skills map* — the competencies the build embodies — mirrored from the
Verithica / Ethica build (`r2bl_mvp2`) so the two converge.

## The skills map

| # | Skill / posture | How this MVP honours it |
|---|-----------------|--------------------------|
| 1 | **Mock-first** | Boots with `MOCK=1` and **zero secrets**. `MockDataAdapter` serves the synthetic Lusaka sample. The demo is real (a running engine) without any external dependency. |
| 2 | **Ports & adapters** | Everything external sits behind an interface. `DataPort` is the only seam; `MockDataAdapter` implements it now, a `PipelineDataAdapter` (CLIP v3) or `PostgresDataAdapter` drops in later with **zero change** to the server or domain. |
| 3 | **Typed end-to-end** | `shared/types.ts` is the single source of truth for the API contract. `tsconfig` is `strict` + `noUncheckedIndexedAccess`. `npm run typecheck` is clean. |
| 4 | **Secure by default** | No `x-powered-by`; CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` set on every response. No inline secrets. |
| 5 | **Vertical slices, each green** | `scripts/smoke.mjs` boots the built server and asserts `/healthz` + `/api/campaign` shape. A slice isn't done until smoke passes. |
| 6 | **Honesty as a feature** | The audit (v2) is wired into the product, not just the doc: figures tagged measured / modelled / assumed; "Estimated Reach" renamed **MGO**; value shown as a **band**; a **Recognition-Equity** metric surfaces CLIP's local-brand bias (finding B2). |
| 7 | **Deployable on day one** | Two-stage `Dockerfile` (esbuild → dependency-free runtime), `fly.toml` (region `jnb`, `/healthz` check), one command to ship. |
| 8 | **Synthetic data only** | No real personal data, ever. The sample is labelled fictional in the UI. |

## Architecture (one breath)

```
public/index.html ──fetch──▶ /api/campaign
                                  │
                          server/index.ts (express, /healthz, secure headers)
                                  │
                          domain/metrics.buildReport()  ◀── the engine (live, not echoed)
                            ├─ domain/decay.ts      (value BANDS from half-life uncertainty)
                            └─ domain/sectors.ts    (brand→sector, brand→origin, half-lives)
                                  │
                          ports/DataPort  ◀── MockDataAdapter (server/data/campaign.sample.json)
```

## Definition of done
`npm run build` clean · `npm run typecheck` clean · `npm run smoke` PASS ·
`docker build` succeeds · `fly deploy` healthy at `/healthz` · dashboard renders the
KPI strip, provenance legend, sector value bands, recognition equity, brand ledger
and site list — all from the live API, all on labelled synthetic data.

## Run

```bash
npm install
npm run dev            # http://localhost:3000  (tsx watch, MOCK=1)
npm run build && npm run smoke
fly deploy             # ship to brandcog-demo.fly.dev
```
