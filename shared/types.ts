// shared/types.ts
// Single source of truth for the BrandCog MVP API contract.
// v2 audit fixes are encoded in the types themselves:
//   - "Estimated Reach" -> Modelled Gross Opportunity (mgo)
//   - point values -> ValueBand (low/point/high) from decay half-life uncertainty
//   - every headline figure carries a Provenance basis (measured/modelled/assumed)
//   - RecognitionEquity surfaces the CLIP local-brand bias (finding B2)

export type FigureBasis = "measured" | "modelled" | "assumed";
export type BrandOrigin = "multinational" | "local" | "unknown";

export interface ValueBand {
  low: number;
  point: number;
  high: number;
}

export interface DetectionRecord {
  file: string;
  brand: string;
  confidence: number;
  sector: string;
  origin: BrandOrigin;
  lat?: number;
  lon?: number;
  siteName?: string;
  suburb?: string;
  city?: string;
  firstSeen?: string; // ISO date
  daysLive: number;
  freshness: number;
  baseRate?: number;
  valueBand: ValueBand; // decayed effective value with half-life uncertainty
  dailyTraffic?: number; // map proxy — MODELLED, not measured
  mgo: number; // Modelled Gross Opportunity (formerly "Estimated Reach")
  creativeChange: boolean;
}

export interface BrandRollup {
  brand: string;
  sector: string;
  origin: BrandOrigin;
  detections: number;
  uniqueSites: number;
  valueBand: ValueBand;
  mgo: number;
  avgFreshness: number;
}

export interface SectorRollup {
  sector: string;
  detections: number;
  uniqueSites: number;
  valueBand: ValueBand;
  mgo: number;
}

export interface RecognitionEquity {
  totalDetections: number;
  localConfident: number;
  multinational: number;
  unknown: number;
  // share of detections that are confident local-brand matches (0..1)
  equityScore: number;
  note: string;
}

export interface Provenance {
  figure: string;
  basis: FigureBasis;
  note: string;
}

export interface CampaignMeta {
  market: string;
  totalDetections: number;
  uniqueSites: number;
  uniqueBrands: number;
  totalValueBand: ValueBand;
  totalMgo: number;
  asOf: string;
  sample: boolean; // true => synthetic/fictional demo data
}

export interface CampaignReport {
  meta: CampaignMeta;
  records: DetectionRecord[];
  byBrand: BrandRollup[];
  bySector: SectorRollup[];
  recognitionEquity: RecognitionEquity;
  provenance: Provenance[];
}

// ===========================================================================
// mvp1.2.05 — real recognition data + competitive brand-health metrics
// ===========================================================================

export interface RealRecord {
  file: string;
  brand: string;
  confidence: number | null;
  sector: string;
  market: string; // inferred per-brand (GPS absent in export)
  origin: BrandOrigin;
  distinct: boolean; // false for duplicate ("X 2.jpeg") of the same image
  dateTaken: string | null;
  // optional geo (present in the mock/synthetic set; pending GPS re-extraction for real)
  lat?: number;
  lon?: number;
  site?: string;
}

export interface SitePoint {
  site: string;
  lat: number;
  lon: number;
  brands: string[];
  detections: number;
}

/** Per-brand competitive metrics within a market scope. */
export interface BrandMetric {
  brand: string;
  sector: string;
  market: string;
  origin: BrandOrigin;
  logo: string | null; // /logos/<file> or null
  placements: number; // detections (creative placements)
  distinct: number; // distinct images (occupancy proxy)
  avgConfidence: number; // 0..1
  sov: number; // Share of Voice  — placement share of sector (0..1)
  shareOfSpace: number; // Share of Space — distinct-placement share of sector (0..1)
  shareOfSpend: number; // Share of Spend — modelled value share of sector (0..1)
  modelledSpend: number; // assumed (no rate card yet)
  brandHealth: number; // composite 0..100
  rankInSector: number;
}

export interface SectorSizing {
  sector: string;
  placements: number;
  distinct: number;
  brands: number;
  modelledSpend: number;
}

export interface CompetitiveView {
  scope: string; // market scope
  brand: BrandMetric;
  competitors: BrandMetric[]; // same sector, ranked, includes the brand
  sizing: SectorSizing;
  provenance: Provenance[];
}

export interface OverviewReport {
  scope: string;
  asOf: string;
  source: string;
  totals: { placements: number; distinct: number; brands: number; sectors: number; modelledSpend: number };
  sectors: SectorSizing[];
  topBrands: BrandMetric[];
  recognitionEquity: RecognitionEquity;
  markets: { market: string; placements: number }[];
  provenance: Provenance[];
}

// ---- agency multi-sector analysis + plug-and-pay enrichment -----------------
export interface DataSource {
  id: string;
  dimension: string;
  tier: "core" | "free" | "paid";
  status: "active" | "modelled" | "available"; // active=keyed/live, modelled=free derived, available=bring key
  source: string;
  plug: string; // env var / webhook that activates it
}

export interface EnrichedSector {
  sector: string;
  industry: string;
  placements: number;
  distinct: number;
  brands: number;
  modelledSpend: number;
  segment: string; // audience segment (modelled)
  lsmBand: string; // LSM / SEM band (modelled)
  footTrafficIndex: number; // 0..100 (modelled until a provider is plugged)
  vehicleTrafficIndex: number; // 0..100 (modelled)
}

export interface IndustryRollup {
  industry: string;
  sectors: string[];
  placements: number;
  modelledSpend: number;
}

export interface AgencyAnalysis {
  scope: string;
  sectors: EnrichedSector[];
  industries: IndustryRollup[];
  dataSources: DataSource[];
  provenance: Provenance[];
}

// ---- per-client login / customisable dashboards -----------------------------
export type ClientRole = "brand" | "agency";

export interface ClientConfig {
  key: string;
  name: string;
  role: ClientRole;
  brand: string | null; // null for agency (sees all)
  sector?: string;
  homeMarket: string; // default market scope
  metrics: string[]; // enabled metric cards: sov, space, spend, health, sizing
  benchmark: "sector" | "market";
  username: string; // mock credential
  password: string; // mock credential
  dataset?: "real" | "mock"; // which dataset this account sees (default real)
}
