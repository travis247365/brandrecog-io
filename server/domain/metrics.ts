// server/domain/metrics.ts
// The engine. Takes raw detections and RE-DERIVES the campaign report so the
// demo genuinely runs the model (audit honesty: "show your working"), rather
// than echoing precomputed JSON.

import type {
  DetectionRecord, BrandRollup, SectorRollup, RecognitionEquity,
  CampaignReport, CampaignMeta, ValueBand, Provenance,
} from "../../shared/types";
import { addBands, roundBand } from "./decay";

const CONFIDENCE_FLOOR = 0.55; // audit: reject low-confidence "forced" matches

function emptyBand(): ValueBand { return { low: 0, point: 0, high: 0 }; }

export function buildReport(records: DetectionRecord[], market: string, asOf: string): CampaignReport {
  const kept = records.filter((r) => r.confidence >= CONFIDENCE_FLOOR);

  // ---- Brand rollup ----
  const brandMap = new Map<string, {
    sector: string; origin: string; detections: number; sites: Set<string>;
    band: ValueBand; mgo: number; freshSum: number;
  }>();
  const sectorMap = new Map<string, {
    detections: number; sites: Set<string>; band: ValueBand; mgo: number;
  }>();

  for (const r of kept) {
    const b = brandMap.get(r.brand) ?? {
      sector: r.sector, origin: r.origin, detections: 0, sites: new Set<string>(),
      band: emptyBand(), mgo: 0, freshSum: 0,
    };
    b.detections += 1;
    if (r.siteName) b.sites.add(r.siteName);
    b.band = addBands(b.band, r.valueBand);
    b.mgo += r.mgo;
    b.freshSum += r.freshness;
    brandMap.set(r.brand, b);

    const s = sectorMap.get(r.sector) ?? {
      detections: 0, sites: new Set<string>(), band: emptyBand(), mgo: 0,
    };
    s.detections += 1;
    if (r.siteName) s.sites.add(r.siteName);
    s.band = addBands(s.band, r.valueBand);
    s.mgo += r.mgo;
    sectorMap.set(r.sector, s);
  }

  const byBrand: BrandRollup[] = [...brandMap.entries()].map(([brand, v]) => ({
    brand, sector: v.sector, origin: v.origin as BrandRollup["origin"],
    detections: v.detections, uniqueSites: v.sites.size,
    valueBand: roundBand(v.band), mgo: Math.round(v.mgo),
    avgFreshness: v.detections ? Math.round((v.freshSum / v.detections) * 1000) / 1000 : 0,
  })).sort((a, b) => b.valueBand.point - a.valueBand.point);

  const bySector: SectorRollup[] = [...sectorMap.entries()].map(([sector, v]) => ({
    sector, detections: v.detections, uniqueSites: v.sites.size,
    valueBand: roundBand(v.band), mgo: Math.round(v.mgo),
  })).sort((a, b) => b.valueBand.point - a.valueBand.point);

  // ---- Recognition equity (audit B2) ----
  const localConfident = kept.filter((r) => r.origin === "local").length;
  const multinational = kept.filter((r) => r.origin === "multinational").length;
  const unknown = kept.filter((r) => r.origin === "unknown").length;
  const equityScore = kept.length ? Math.round((localConfident / kept.length) * 1000) / 1000 : 0;
  const recognitionEquity: RecognitionEquity = {
    totalDetections: kept.length, localConfident, multinational, unknown, equityScore,
    note: "Share of confident detections that are locally-rooted brands. Low values may " +
      "reflect a real market skew OR CLIP under-recognising local logos — treat as a flag, not a fact.",
  };

  // ---- Meta ----
  const totalBand = roundBand([...sectorMap.values()].reduce((acc, v) => addBands(acc, v.band), emptyBand()));
  const totalMgo = Math.round([...sectorMap.values()].reduce((a, v) => a + v.mgo, 0));
  const sites = new Set(kept.map((r) => r.siteName).filter(Boolean));
  const meta: CampaignMeta = {
    market,
    totalDetections: kept.length,
    uniqueSites: sites.size,
    uniqueBrands: brandMap.size,
    totalValueBand: totalBand,
    totalMgo,
    asOf,
    sample: true,
  };

  // ---- Provenance ledger (audit A2 / rubric behaviour #7) ----
  const provenance: Provenance[] = [
    { figure: "Detected brand & creative", basis: "measured", note: "CLIP recognition on the captured image (>= confidence floor)." },
    { figure: "Site / street / suburb", basis: "measured", note: "EXIF GPS reverse-geocoded (OpenStreetMap)." },
    { figure: "Freshness & decayed value", basis: "modelled", note: "Exponential decay on a sector half-life; reported as a low-high band, not a point." },
    { figure: "Daily traffic", basis: "modelled", note: "Map-traffic proxy — an audience approximation, not a measured impression count." },
    { figure: "Modelled Gross Opportunity (MGO)", basis: "modelled", note: "traffic x days-live x freshness. NOT measured reach. Renamed from 'Estimated Reach' per audit." },
    { figure: "Sector half-lives", basis: "assumed", note: "Imported from OOH-recall literature, not yet Zambia-calibrated. The source of the value band's width." },
  ];

  return { meta, records: kept, byBrand, bySector, recognitionEquity, provenance };
}

export { CONFIDENCE_FLOOR };
