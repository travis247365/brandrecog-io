// server/domain/sectors.ts
// Brand -> sector, brand -> origin, and sector decay half-lives.
// v2 change (audit A1): half-lives are no longer asserted point constants —
// each carries a confidence delta (+/- days) so downstream value is a BAND,
// not a false-precision point estimate.

import type { BrandOrigin } from "../../shared/types";

export interface HalfLife {
  days: number;
  deltaDays: number; // uncertainty band; value is computed at days +/- delta
}

// Seeded with Zambia's most-visible OOH advertisers. Keys match CLIP folder names.
const BRAND_SECTOR: Record<string, string> = {
  MTN: "telecom", Airtel: "telecom", Zamtel: "telecom",
  Stanbic: "finance", Zanaco: "finance", FNB: "finance",
  AbsaZambia: "finance", IndoZambia: "finance",
  Shoprite: "retail", "Pick n Pay": "retail", Game: "retail",
  "Trade Kings": "fmcg", Zambeef: "fmcg", MosiLager: "fmcg",
  CastleLite: "fmcg", CocaCola: "fmcg", Pepsi: "fmcg", ZambianBreweries: "fmcg",
  SunKing: "energy", ZESCO: "energy", TotalEnergies: "energy",
  Toyota: "automotive", Hyundai: "automotive",
  Betway: "gaming", Premierbet: "gaming",
};

// Origin drives the Recognition-Equity metric (audit B2): CLIP, pretrained on
// largely-Western web data, recognises multinational logos more reliably than
// local brands. Tracking origin makes that bias visible instead of hidden.
const BRAND_ORIGIN: Record<string, BrandOrigin> = {
  MTN: "multinational", Airtel: "multinational", Shoprite: "multinational",
  Stanbic: "multinational", FNB: "multinational", AbsaZambia: "multinational",
  SunKing: "multinational", TotalEnergies: "multinational", CocaCola: "multinational",
  Pepsi: "multinational", Toyota: "multinational", Hyundai: "multinational",
  Betway: "multinational", Premierbet: "multinational", "Pick n Pay": "multinational",
  Game: "multinational", CastleLite: "multinational",
  // Zambian / locally-rooted brands
  Zamtel: "local", Zanaco: "local", IndoZambia: "local",
  "Trade Kings": "local", Zambeef: "local", MosiLager: "local",
  ZambianBreweries: "local", ZESCO: "local",
};

// Faster-rotating categories decay quicker (creative fatigue / promo cycles).
// deltaDays widens where we have least empirical grounding for Zambia.
const SECTOR_HALF_LIFE: Record<string, HalfLife> = {
  fmcg: { days: 21, deltaDays: 7 },
  retail: { days: 21, deltaDays: 7 },
  gaming: { days: 21, deltaDays: 7 },
  telecom: { days: 35, deltaDays: 10 },
  finance: { days: 35, deltaDays: 10 },
  energy: { days: 35, deltaDays: 10 },
  automotive: { days: 45, deltaDays: 12 },
};
const DEFAULT_HALF_LIFE: HalfLife = { days: 30, deltaDays: 10 };

export function sectorForBrand(brand: string): string {
  return BRAND_SECTOR[brand] ?? "other";
}

export function originForBrand(brand: string): BrandOrigin {
  return BRAND_ORIGIN[brand] ?? "unknown";
}

export function halfLifeForSector(sector: string): HalfLife {
  return SECTOR_HALF_LIFE[sector] ?? DEFAULT_HALF_LIFE;
}
