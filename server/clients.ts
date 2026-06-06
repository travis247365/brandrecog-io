// server/clients.ts
// Per-client login registry (mock-first), now with username/password combos.
// Brand & agency accounts see REAL data; self-service sign-ups get the demo
// workspace whose dataset is chosen by the email tier (see emailGate).
//
// Credentials are mock demo creds (username = key, password = `${key}2026`),
// safe to hand to prospects. A real IdP slots in behind authenticate().

import type { ClientConfig } from "../shared/types";

const ALL_METRICS = ["health", "sov", "space", "spend", "sizing"];
const pw = (key: string) => `${key}2026`;

function bc(key: string, name: string, brand: string, sector: string, homeMarket: string): ClientConfig {
  return {
    key, name, role: "brand", brand, sector, homeMarket,
    metrics: ALL_METRICS, benchmark: "sector",
    username: key, password: pw(key), dataset: "real",
  };
}

const LIST: ClientConfig[] = [
  { key: "agency", name: "BrandCog Agency (all brands)", role: "agency", brand: null,
    homeMarket: "All", metrics: ALL_METRICS, benchmark: "market",
    username: "agency", password: pw("agency"), dataset: "real" },
  // demo workspace granted to self-service sign-ups (dataset set per email tier)
  { key: "demo", name: "Demo workspace", role: "agency", brand: null,
    homeMarket: "All", metrics: ALL_METRICS, benchmark: "market",
    username: "demo", password: pw("demo"), dataset: "mock" },

  // ── Zambia (ZM) ──
  bc("mtn", "MTN", "MTN", "telecom", "Pan-African"),
  bc("airtel", "Airtel", "Airtel", "telecom", "Pan-African"),
  bc("zamtel", "Zamtel", "Zamtel", "telecom", "Zambia"),
  bc("momo", "MoMo from MTN", "MoMo from MTN", "mobile money", "Pan-African"),
  bc("bolabet", "BolaBet", "BolaBet", "gaming", "Zambia"),
  bc("betlion", "Betlion", "Betlion", "gaming", "Zambia"),
  bc("castlebet", "CastleBet", "CastleBet", "gaming", "Zambia"),
  bc("galsport", "Gal Sport Betting", "Gal Sport Betting", "gaming", "Zambia"),
  bc("betpawa", "BetPawa", "BetPawa", "gaming", "Zambia"),
  bc("gotv", "GOtv Zambia", "GOtv Zambia", "media", "Zambia"),
  bc("prefcap", "Preference Capital", "Preference Capital", "finance", "Zambia"),

  // ── South Africa (ZA) ──
  bc("fnb", "FNB", "FNB", "finance", "Pan-African"),
  bc("absa", "Absa", "Absa", "finance", "Pan-African"),
  bc("bpsa", "Bp South Africa", "Bp South Africa", "energy", "South Africa"),
  bc("woolworths", "Woolworths SA", "Woolworths SA", "retail", "South Africa"),
  bc("spar", "Spar", "Spar", "retail", "South Africa"),
  bc("hollywoodbets", "Hollywood Bets", "Hollywood Bets - SA", "gaming", "South Africa"),
  bc("hippo", "Hippo.co.za", "Hippo.co.za", "finance", "South Africa"),
  bc("melon", "Melon Mobile", "Melon Mobile", "telecom", "South Africa"),
  bc("supersport", "SuperSport", "SuperSport", "media", "South Africa"),
  bc("nandos", "Nando's", "Nandos", "food", "South Africa"),

  // ── Pan-African ──
  bc("multichoice", "MultiChoice Group", "MultiChoice Group", "media", "Pan-African"),
  bc("cocacola", "Coca-Cola", "Coca-Cola", "fmcg", "Pan-African"),
  bc("sportybet", "SportyBet", "SportyBet", "gaming", "Pan-African"),
  bc("betway", "Betway", "Betway", "gaming", "Pan-African"),
];

const CLIENTS: Record<string, ClientConfig> = Object.fromEntries(LIST.map((c) => [c.key, c]));
const BY_USERNAME: Record<string, ClientConfig> = Object.fromEntries(LIST.map((c) => [c.username.toLowerCase(), c]));

export function getClient(key: string | undefined): ClientConfig | undefined {
  return key ? CLIENTS[key] : undefined;
}

export function authenticate(username: string, password: string): ClientConfig | null {
  const c = BY_USERNAME[String(username || "").toLowerCase().trim()];
  if (!c || c.password !== String(password || "")) return null;
  return c;
}

/** Public list for the login page (no passwords; demo workspace hidden). */
export function listClients() {
  return Object.values(CLIENTS)
    .filter((c) => c.key !== "demo")
    .map((c) => ({
      key: c.key, name: c.name, role: c.role, brand: c.brand, sector: c.sector ?? null, username: c.username,
    }));
}

/** Credentials reference (for the operator) — demo creds only. */
export function credentials() {
  return Object.values(CLIENTS).map((c) => ({ name: c.name, username: c.username, password: c.password }));
}
