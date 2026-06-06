// server/ports/enrichment.ts
// Plug-and-pay data-enrichment layer. Free/modelled providers are active now;
// paid providers (Google Places Popular Times, Google Roads/Distance Matrix, LSM
// datasets, footfall webhooks) register as "available" and activate when the
// relevant key/webhook env is set — no code change, just config.
//
// Honesty: until a real provider is keyed, foot-traffic / vehicle-traffic / LSM /
// segment are MODELLED (deterministic, stable) and tagged as such in the UI.

import type { DataSource } from "../../shared/types";

const INDUSTRY: Record<string, string> = {
  telecom: "Telecommunications", "mobile money": "Fintech / Mobile Money",
  media: "Media & Entertainment", gaming: "Betting & Gaming",
  finance: "Financial Services", energy: "Energy & Fuel",
  fmcg: "FMCG", retail: "Retail", food: "QSR / Food",
  mobility: "Mobility", other: "Other",
};

const SEGMENT: Record<string, string> = {
  telecom: "Mass market, all ages", "mobile money": "Banked & unbanked, urban",
  media: "Households / families", gaming: "Young adults, urban male skew",
  finance: "Affluent, banked professionals", energy: "Motorists / commuters",
  fmcg: "Mass-market shoppers", retail: "Household shoppers",
  food: "Youth & urban families", mobility: "Urban commuters", other: "General",
};

const LSM: Record<string, string> = {
  finance: "LSM 7–10 (affluent)", media: "LSM 5–9 (broad)",
  telecom: "LSM 3–8 (mass)", "mobile money": "LSM 3–7 (mass / unbanked)",
  gaming: "LSM 4–7 (mid)", energy: "LSM 5–9 (motorist)",
  fmcg: "LSM 3–7 (mass)", retail: "LSM 4–8 (household)", food: "LSM 4–8 (youth)",
  mobility: "LSM 5–9 (commuter)", other: "LSM 4–8",
};

// deterministic 45..95 index from a string (stable across runs)
function idx(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 45 + (h % 51);
}

export function industryFor(sector: string): string { return INDUSTRY[sector] ?? "Other"; }
export function segmentFor(sector: string): string { return SEGMENT[sector] ?? "General"; }
export function lsmFor(sector: string): string { return LSM[sector] ?? "LSM 4–8"; }
export function footTrafficIndex(sector: string, market: string): number { return idx("foot|" + sector + "|" + market); }
export function vehicleTrafficIndex(sector: string, market: string): number { return idx("veh|" + sector + "|" + market); }

// Provider registry — status derives from whether the key/webhook is configured.
export function dataSources(): DataSource[] {
  const has = (k: string) => Boolean(process.env[k]);
  const paid = (k: string): DataSource["status"] => (has(k) ? "active" : "available");
  return [
    { id: "recognition", dimension: "Brand & creative placement", tier: "core", status: "active",
      source: "CLIP image recognition (this build)", plug: "—" },
    { id: "geocode", dimension: "Street / site address", tier: "free",
      status: process.env.GOOGLE_MAPS_API_KEY ? "active" : "modelled",
      source: "OpenStreetMap Nominatim (free) — active once EXIF GPS is present", plug: "none / OSM" },
    { id: "industry_segment", dimension: "Industry & audience segment", tier: "free", status: "modelled",
      source: "Derived from sector taxonomy (modelled)", plug: "CRM / DMP webhook" },
    { id: "lsm", dimension: "LSM / SEM band", tier: "paid", status: paid("LSM_DATASET_URL"),
      source: "MAPS / census LSM dataset", plug: "LSM_DATASET_URL" },
    { id: "foot_traffic", dimension: "Foot traffic (Popular Times)", tier: "paid", status: paid("GOOGLE_MAPS_API_KEY"),
      source: "Google Places API — Popular Times", plug: "GOOGLE_MAPS_API_KEY" },
    { id: "vehicle_traffic", dimension: "Vehicle traffic", tier: "paid", status: paid("GOOGLE_MAPS_API_KEY"),
      source: "Google Roads / Distance Matrix", plug: "GOOGLE_MAPS_API_KEY" },
    { id: "footfall_sensor", dimension: "Footfall (sensor)", tier: "paid", status: paid("FOOTFALL_WEBHOOK_URL"),
      source: "Footfall sensor / DOOH SSP webhook", plug: "FOOTFALL_WEBHOOK_URL" },
  ];
}
