// server/domain/agencyAnalysis.ts
// Multi-sector intelligence for Agency clients (brand/activation/research/consulting).
// Cross-sector view enriched with industry, segment, LSM and traffic dimensions,
// plus the plug-and-pay data-source registry.

import type { RealRecord, AgencyAnalysis, EnrichedSector, IndustryRollup, Provenance } from "../../shared/types";
import { overview } from "./brandhealth";
import {
  industryFor, segmentFor, lsmFor, footTrafficIndex, vehicleTrafficIndex, dataSources,
} from "../ports/enrichment";

export function agencyAnalysis(records: RealRecord[], market: string, asOf: string, source: string): AgencyAnalysis {
  const ov = overview(records, market, asOf, source);

  const sectors: EnrichedSector[] = ov.sectors.map((s) => ({
    sector: s.sector,
    industry: industryFor(s.sector),
    placements: s.placements,
    distinct: s.distinct,
    brands: s.brands,
    modelledSpend: s.modelledSpend,
    segment: segmentFor(s.sector),
    lsmBand: lsmFor(s.sector),
    footTrafficIndex: footTrafficIndex(s.sector, market),
    vehicleTrafficIndex: vehicleTrafficIndex(s.sector, market),
  }));

  // roll sectors up to industries
  const indMap = new Map<string, IndustryRollup>();
  for (const s of sectors) {
    const r = indMap.get(s.industry) ?? { industry: s.industry, sectors: [], placements: 0, modelledSpend: 0 };
    r.sectors.push(s.sector);
    r.placements += s.placements;
    r.modelledSpend += s.modelledSpend;
    indMap.set(s.industry, r);
  }
  const industries = [...indMap.values()].sort((a, b) => b.modelledSpend - a.modelledSpend);

  const provenance: Provenance[] = [
    { figure: "Placements, sector, spend", basis: "measured", note: "From real CLIP recognition (modelled spend uses a notional rate)." },
    { figure: "Industry & audience segment", basis: "modelled", note: "Derived from the sector taxonomy — plug a CRM/DMP webhook to make it measured." },
    { figure: "LSM / SEM band", basis: "assumed", note: "Indicative per-sector skew — plug an LSM/census dataset for measured bands." },
    { figure: "Foot & vehicle traffic", basis: "modelled", note: "Deterministic index placeholder — plug Google Places (Popular Times) / Roads with a key to make it measured per location." },
  ];

  return { scope: market || "All", sectors, industries, dataSources: dataSources(), provenance };
}
