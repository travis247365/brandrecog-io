// server/ports/leadStore.ts
// Persistent lead store for sign-ups and demo bookings — used by marketing /
// telesales teams. File-backed JSON on a mounted volume now; the same interface
// graduates to Postgres/SQLite later with no caller change (ports pattern).
//
// On Fly a volume is mounted at /data (DATA_DIR=/data) so records survive
// restarts and scale-to-zero. Locally it writes to ./data.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

export type LeadKind = "signup" | "booking" | "waitlist";
export type LeadTier = "business" | "demo";

export interface Lead {
  id: string;
  kind: LeadKind;
  name: string;
  email: string;
  domain: string;
  tier: LeadTier;
  company?: string;
  role?: string;
  market?: string;
  type?: string;
  useCase?: string;
  createdAt: string;
}

const DATA_DIR = process.env.DATA_DIR ?? resolve(process.cwd(), "data");
const FILE = resolve(DATA_DIR, "leads.json");

function load(): Lead[] {
  try { return JSON.parse(readFileSync(FILE, "utf8")) as Lead[]; }
  catch { return []; }
}
function save(rows: Lead[]): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(rows, null, 1));
}

export function addLead(input: Omit<Lead, "id" | "createdAt">): Lead {
  const rows = load();
  const lead: Lead = {
    ...input,
    id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: new Date().toISOString(),
  };
  rows.push(lead);
  save(rows);
  return lead;
}

export function listLeads(): Lead[] {
  return load().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Remove a lead by id. Returns true if a row was deleted. */
export function deleteLead(id: string): boolean {
  const rows = load();
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return false;
  save(next);
  return true;
}

export function leadStats() {
  const rows = load();
  return {
    total: rows.length,
    signups: rows.filter((r) => r.kind === "signup").length,
    bookings: rows.filter((r) => r.kind === "booking").length,
    business: rows.filter((r) => r.tier === "business").length,
    demo: rows.filter((r) => r.tier === "demo").length,
    storage: FILE,
  };
}

export function leadsCsv(): string {
  const rows = listLeads();
  const cols: (keyof Lead)[] = ["createdAt", "kind", "tier", "name", "email", "domain", "company", "role", "market", "type", "useCase"];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
