// server/domain/brandhealth.ts
// Competitive brand-health engine for mvp1.2.05. Works on real recognition
// records and derives the share metrics a brand/agency wants to see:
//   SOV (Share of Voice)   = placement share of sector
//   Share of Space         = distinct-placement (occupancy) share of sector
//   Share of Spend (SOS)   = modelled value share of sector
//   Market Sizing          = sector placements + modelled spend
//   Brand Health Score     = composite 0..100
//
// Honesty: spend is MODELLED (no rate card yet) and market is inferred per-brand
// (GPS absent in the export). Both are flagged in provenance.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  RealRecord, BrandMetric, SectorSizing, CompetitiveView, OverviewReport,
  Provenance, RecognitionEquity,
} from "../../shared/types";

// Logo manifest is read at runtime (public/ is present in the runtime image) so
// esbuild doesn't need the file in the build stage.
function loadLogoManifest(): Record<string, string> {
  try {
    const p = process.env.LOGO_MANIFEST ?? resolve(process.cwd(), "public/logos/manifest.json");
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

// Notional per-sector placement value (ZMW), clearly assumed, used only for
// Share of Spend and market sizing until a real rate card is supplied.
const BASE_PLACEMENT_VALUE = 8000;
const SECTOR_RATE: Record<string, number> = {
  media: 1.0, finance: 1.1, telecom: 0.9, energy: 0.8, gaming: 0.7,
  retail: 0.65, fmcg: 0.6, food: 0.6, mobility: 0.7, other: 0.6,
};
const logos = loadLogoManifest();

const CONF_FLOOR = 0.0; // recognition export is already thresholded upstream

export function scopeRecords(records: RealRecord[], market: string): RealRecord[] {
  if (!market || market === "All") return records;
  return records.filter((r) => r.market === market);
}

interface BrandAgg {
  brand: string; sector: string; market: string; origin: RealRecord["origin"];
  placements: number; distinct: number; confSum: number;
}

function aggregate(records: RealRecord[]) {
  const brands = new Map<string, BrandAgg>();
  const sectorPlace = new Map<string, number>();
  const sectorDistinct = new Map<string, number>();
  const sectorSpend = new Map<string, number>();

  for (const r of records) {
    if (r.confidence != null && r.confidence < CONF_FLOOR) continue;
    const a = brands.get(r.brand) ?? {
      brand: r.brand, sector: r.sector, market: r.market, origin: r.origin,
      placements: 0, distinct: 0, confSum: 0,
    };
    a.placements += 1;
    if (r.distinct) a.distinct += 1;
    a.confSum += r.confidence ?? 0;
    brands.set(r.brand, a);

    const rate = SECTOR_RATE[r.sector] ?? 0.6;
    sectorPlace.set(r.sector, (sectorPlace.get(r.sector) ?? 0) + 1);
    if (r.distinct) sectorDistinct.set(r.sector, (sectorDistinct.get(r.sector) ?? 0) + 1);
    sectorSpend.set(r.sector, (sectorSpend.get(r.sector) ?? 0) + BASE_PLACEMENT_VALUE * rate);
  }
  return { brands, sectorPlace, sectorDistinct, sectorSpend };
}

function metricFor(a: BrandAgg, agg: ReturnType<typeof aggregate>, maxPlacements: number): BrandMetric {
  const sp = agg.sectorPlace.get(a.sector) || 1;
  const sd = agg.sectorDistinct.get(a.sector) || 1;
  const ss = agg.sectorSpend.get(a.sector) || 1;
  const rate = SECTOR_RATE[a.sector] ?? 0.6;
  const spend = Math.round(a.placements * BASE_PLACEMENT_VALUE * rate);
  const sov = a.placements / sp;
  const shareOfSpace = a.distinct / sd;
  const avgConf = a.placements ? a.confSum / a.placements : 0;
  // absolute market prominence dampens "100% share of a tiny sector" inflation
  const prominence = a.placements / (maxPlacements || 1);
  const health = Math.round(100 * (0.35 * sov + 0.25 * shareOfSpace + 0.15 * avgConf + 0.25 * prominence));
  return {
    brand: a.brand, sector: a.sector, market: a.market, origin: a.origin,
    logo: logos[a.brand] ? `/logos/${logos[a.brand]}` : null,
    placements: a.placements, distinct: a.distinct,
    avgConfidence: Math.round(avgConf * 1000) / 1000,
    sov: Math.round(sov * 1000) / 1000,
    shareOfSpace: Math.round(shareOfSpace * 1000) / 1000,
    shareOfSpend: Math.round((spend / ss) * 1000) / 1000,
    modelledSpend: spend,
    brandHealth: health,
    rankInSector: 0,
  };
}

function allMetrics(records: RealRecord[]): BrandMetric[] {
  const agg = aggregate(records);
  const maxPlacements = Math.max(1, ...[...agg.brands.values()].map((a) => a.placements));
  const metrics = [...agg.brands.values()].map((a) => metricFor(a, agg, maxPlacements));
  // rank within sector by brand health
  const bySector = new Map<string, BrandMetric[]>();
  for (const m of metrics) {
    const arr = bySector.get(m.sector) ?? [];
    arr.push(m); bySector.set(m.sector, arr);
  }
  for (const arr of bySector.values()) {
    arr.sort((x, y) => y.brandHealth - x.brandHealth || y.sov - x.sov);
    arr.forEach((m, i) => (m.rankInSector = i + 1));
  }
  return metrics;
}

function provenance(): Provenance[] {
  return [
    { figure: "Detected brand & placement", basis: "measured", note: "CLIP recognition on captured OOH images (876 detections)." },
    { figure: "Share of Voice / Space", basis: "measured", note: "Computed from real placement and distinct-image counts per sector." },
    { figure: "Share of Spend / Market sizing", basis: "modelled", note: "Notional per-sector placement value (no rate card yet); proportions are indicative." },
    { figure: "Brand Health Score", basis: "modelled", note: "Composite: 0.35*SOV + 0.25*Share-of-Space + 0.15*confidence + 0.25*market prominence, scaled to 100." },
    { figure: "Market (ZM / SA)", basis: "assumed", note: "Inferred per-brand — GPS was absent in this export; re-extract from image EXIF to make it measured." },
  ];
}

function recognitionEquity(records: RealRecord[]): RecognitionEquity {
  const local = records.filter((r) => r.origin === "local").length;
  const multi = records.filter((r) => r.origin === "multinational").length;
  const unknown = records.length - local - multi;
  return {
    totalDetections: records.length, localConfident: local, multinational: multi, unknown,
    equityScore: records.length ? Math.round((local / records.length) * 1000) / 1000 : 0,
    note: "Share of detections that are locally-rooted brands. CLIP (web-pretrained) tends to under-recognise local logos — read as a flag, not a fact.",
  };
}

export function overview(records: RealRecord[], market: string, asOf: string, source: string): OverviewReport {
  const scoped = scopeRecords(records, market);
  const metrics = allMetrics(scoped);
  const agg = aggregate(scoped);
  const sectors: SectorSizing[] = [...agg.sectorPlace.keys()].map((s) => ({
    sector: s,
    placements: agg.sectorPlace.get(s) || 0,
    distinct: agg.sectorDistinct.get(s) || 0,
    brands: metrics.filter((m) => m.sector === s).length,
    modelledSpend: Math.round(agg.sectorSpend.get(s) || 0),
  })).sort((a, b) => b.modelledSpend - a.modelledSpend);
  const markets = [...new Set(records.map((r) => r.market))].map((m) => ({
    market: m, placements: records.filter((r) => r.market === m).length,
  })).sort((a, b) => b.placements - a.placements);

  return {
    scope: market || "All", asOf, source,
    totals: {
      placements: scoped.length,
      distinct: scoped.filter((r) => r.distinct).length,
      brands: agg.brands.size,
      sectors: sectors.length,
      modelledSpend: sectors.reduce((s, x) => s + x.modelledSpend, 0),
    },
    sectors,
    topBrands: [...metrics].sort((a, b) => b.brandHealth - a.brandHealth).slice(0, 12),
    recognitionEquity: recognitionEquity(scoped),
    markets,
    provenance: provenance(),
  };
}

/** Geo site points for the map (records that carry lat/lon). */
export function sitePoints(records: RealRecord[], market: string) {
  const scoped = scopeRecords(records, market);
  const map = new Map<string, { site: string; lat: number; lon: number; brands: Set<string>; detections: number; snapshot: string | null }>();
  for (const r of scoped) {
    if (typeof r.lat !== "number" || typeof r.lon !== "number") continue;
    const key = r.site ?? `${r.lat},${r.lon}`;
    const s = map.get(key) ?? { site: key, lat: r.lat, lon: r.lon, brands: new Set<string>(), detections: 0, snapshot: null };
    s.brands.add(r.brand);
    s.detections += 1;
    const snap = (r as RealRecord & { snapshot?: string }).snapshot;
    if (!s.snapshot && snap) s.snapshot = snap;
    map.set(key, s);
  }
  return [...map.values()].map((s) => ({
    site: s.site, lat: s.lat, lon: s.lon, brands: [...s.brands], detections: s.detections, snapshot: s.snapshot,
  }));
}

/** Recent creative snapshots (records with a bundled image), optionally by brand. */
export function snapshots(records: RealRecord[], market: string, brand?: string) {
  const withSnap = scopeRecords(records, market).filter((r) => {
    const snap = (r as RealRecord & { snapshot?: string }).snapshot;
    return Boolean(snap) && (!brand || r.brand === brand);
  });
  return withSnap.slice(0, 24).map((r) => ({
    brand: r.brand, sector: r.sector, market: r.market, site: r.site ?? null,
    snapshot: (r as RealRecord & { snapshot?: string }).snapshot,
  }));
}

/** Brands available in scope, for the dynamic brand switcher. */
export function brandList(records: RealRecord[], market: string) {
  const scoped = scopeRecords(records, market);
  const agg = aggregate(scoped);
  return [...agg.brands.values()]
    .map((a) => ({ brand: a.brand, sector: a.sector, market: a.market, placements: a.placements }))
    .sort((x, y) => x.sector.localeCompare(y.sector) || y.placements - x.placements);
}

export function competitive(records: RealRecord[], market: string, brand: string): CompetitiveView | null {
  const scoped = scopeRecords(records, market);
  const metrics = allMetrics(scoped);
  const me = metrics.find((m) => m.brand === brand);
  if (!me) return null;
  const agg = aggregate(scoped);
  const competitors = metrics.filter((m) => m.sector === me.sector)
    .sort((a, b) => b.brandHealth - a.brandHealth);
  const sizing: SectorSizing = {
    sector: me.sector,
    placements: agg.sectorPlace.get(me.sector) || 0,
    distinct: agg.sectorDistinct.get(me.sector) || 0,
    brands: competitors.length,
    modelledSpend: Math.round(agg.sectorSpend.get(me.sector) || 0),
  };
  return { scope: market || "All", brand: me, competitors, sizing, provenance: provenance() };
}
