// server/domain/decay.ts
// Exponential freshness decay + value bands.
//   freshness(t) = 0.5 ^ (days_since_first_seen / half_life)
// v2 change (audit A1): value is reported as a BAND. A shorter half-life decays
// faster (lower value); a longer one decays slower (higher value). We evaluate
// at half_life-delta / half_life / half_life+delta to get low/point/high.

import type { ValueBand } from "../../shared/types";
import { halfLifeForSector } from "./sectors";

export function freshnessAt(daysLive: number, halfLifeDays: number): number {
  const d = Math.max(daysLive, 0);
  return Math.round(0.5 ** (d / halfLifeDays) * 10000) / 10000;
}

export function freshness(daysLive: number, sector: string): number {
  return freshnessAt(daysLive, halfLifeForSector(sector).days);
}

export function decayedValueBand(
  baseRate: number | undefined,
  daysLive: number,
  sector: string
): ValueBand {
  if (baseRate == null) return { low: 0, point: 0, high: 0 };
  const hl = halfLifeForSector(sector);
  const fast = Math.max(hl.days - hl.deltaDays, 1); // faster decay -> lower value
  const slow = hl.days + hl.deltaDays; // slower decay -> higher value
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    low: round(baseRate * freshnessAt(daysLive, fast)),
    point: round(baseRate * freshnessAt(daysLive, hl.days)),
    high: round(baseRate * freshnessAt(daysLive, slow)),
  };
}

export function addBands(a: ValueBand, b: ValueBand): ValueBand {
  return { low: a.low + b.low, point: a.point + b.point, high: a.high + b.high };
}

export function roundBand(b: ValueBand): ValueBand {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { low: r(b.low), point: r(b.point), high: r(b.high) };
}
