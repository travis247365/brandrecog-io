// server/domain/emailGate.ts
// Email-domain gating. Softened rules: free/consumer domains are allowed to sign
// up but are limited to the DEMO tier (mock data). Corporate/business/org domains
// qualify for the BUSINESS tier (real data) — flagged for the sales team.

export type Tier = "business" | "demo";

const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "yahoo.co.uk",
  "outlook.com", "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com",
  "proton.me", "protonmail.com", "aol.com", "gmx.com", "mail.com", "zoho.com",
  "yandex.com", "tutanota.com", "fastmail.com", "hey.com",
]);

export function domainOf(email: string): string {
  return (email.split("@")[1] || "").toLowerCase().trim();
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

export function isFreeDomain(email: string): boolean {
  return FREE_DOMAINS.has(domainOf(email));
}

/** business = real-data access; demo = mock-data only. */
export function tierFor(email: string): Tier {
  const d = domainOf(email);
  return d && !FREE_DOMAINS.has(d) ? "business" : "demo";
}

/** dataset key the tier maps to */
export function datasetForTier(tier: Tier): "real" | "mock" {
  return tier === "business" ? "real" : "mock";
}
