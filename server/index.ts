// server/index.ts
// BrandCog.io integrated site: Coming-Soon landing + waitlist, marketing site,
// email-gated sign-up (business=real data / free=mock data), and the live demo
// dashboard. Typed, mock-first, secure-by-default. Leads persist to a volume.

import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { resolve } from "node:path";
import { makeDataPort } from "./ports";
import { buildReport, CONFIDENCE_FLOOR } from "./domain/metrics";
import { loadDataset, type DatasetKind } from "./ports/RealData";
import { overview, competitive, brandList, sitePoints, snapshots } from "./domain/brandhealth";
import { agencyAnalysis } from "./domain/agencyAnalysis";
import { getClient, authenticate, listClients } from "./clients";
import { tierFor, datasetForTier, isValidEmail, domainOf, isFreeDomain } from "./domain/emailGate";
import { addLead, listLeads, leadStats, leadsCsv } from "./ports/leadStore";
import { VERSION } from "../shared/version";
import type { CampaignReport } from "../shared/types";

const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC_DIR = process.env.PUBLIC_DIR ?? resolve(process.cwd(), "public");
const ADMIN_KEY = process.env.ADMIN_KEY ?? "brandcog-admin";
const data = makeDataPort();

// ---- in-memory demo ingest queue --------------------------------------------
interface IngestItem { name: string; size: number; type: string; at: string }
const ingestQueue: IngestItem[] = [];
const MAX_QUEUE = 200;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("image/")),
});

// ---- legacy synthetic report (kept for /api/campaign) ------------------------
let cache: { at: number; report: CampaignReport } | null = null;
async function getReport(): Promise<CampaignReport> {
  if (cache && Date.now() - cache.at < 60_000) return cache.report;
  const report = buildReport(await data.getDetections(), data.market(), data.asOf());
  cache = { at: Date.now(), report };
  return report;
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// ---- cookies / auth ---------------------------------------------------------
const C_ID = "bc_client";   // identity (client key)
const C_DATA = "bc_data";   // dataset tier: real | mock
const secure = process.env.NODE_ENV === "production";

function parseCookies(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setCookie(res: Response, name: string, value: string, maxAge = 86400) {
  const prev = (res.getHeader("Set-Cookie") as string[] | string | undefined);
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  res.setHeader("Set-Cookie", prev ? ([] as string[]).concat(prev, cookie) : cookie);
}
function currentClient(req: Request) { return getClient(parseCookies(req)[C_ID]); }
function datasetKindFor(req: Request): DatasetKind {
  return parseCookies(req)[C_DATA] === "real" ? "real" : "mock";
}
function ds(req: Request) { return loadDataset(datasetKindFor(req)); }

// ---- secure headers (CSP allows fonts + Leaflet/OSM map) ---------------------
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "microphone=(), camera=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob: https:; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "script-src 'self' 'unsafe-inline' https://unpkg.com https://maps.googleapis.com; " +
      "connect-src 'self' https://*.tile.openstreetmap.org https://maps.googleapis.com"
  );
  next();
});

// ---- health -----------------------------------------------------------------
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({
    status: "ok", service: "brandcog-mvp", version: VERSION,
    mock: process.env.MOCK !== "0", confidenceFloor: CONFIDENCE_FLOOR,
    ingestQueued: ingestQueue.length,
    realRecords: loadDataset("real").records.length,
    mockRecords: loadDataset("mock").records.length,
    leads: leadStats(),
    ts: new Date().toISOString(),
  });
});

// ---- public config (version + active map provider) --------------------------
app.get("/api/config", (_req: Request, res: Response) => {
  res.json({
    version: VERSION,
    maps: GOOGLE_MAPS_KEY ? "google" : "osm",
    googleKey: GOOGLE_MAPS_KEY, // restricted browser key; empty => OSM/Leaflet
  });
});

// ---- auth (username/password, mock-first) -----------------------------------
app.get("/api/clients", (_req: Request, res: Response) => res.json(listClients()));

app.post("/api/login", (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  const c = authenticate(String(username ?? ""), String(password ?? ""));
  if (!c) return res.status(401).json({ error: "invalid_login", detail: "Wrong username or password." });
  setCookie(res, C_ID, c.key);
  setCookie(res, C_DATA, c.dataset ?? "real");
  res.json(c);
});

app.post("/api/logout", (_req: Request, res: Response) => {
  setCookie(res, C_ID, "", 0); setCookie(res, C_DATA, "", 0);
  res.json({ ok: true });
});

app.get("/api/me", (req: Request, res: Response) => {
  const c = currentClient(req);
  if (!c) return res.status(401).json({ error: "not_logged_in" });
  const { password, ...safe } = c; void password;
  res.json({ ...safe, dataset: datasetKindFor(req) });
});

// ---- sign-up & waitlist & booking (persisted) -------------------------------
app.post("/api/signup", (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const email = String(b.email ?? "").trim();
  if (!b.name || !isValidEmail(email)) return res.status(400).json({ error: "bad_input", detail: "Name and a valid email are required." });
  const tier = tierFor(email);
  const dataset = datasetForTier(tier);
  addLead({ kind: "signup", name: b.name, email, domain: domainOf(email), tier, company: b.company, role: b.role, market: b.market, type: b.type, useCase: b.useCase });
  setCookie(res, C_ID, "demo");
  setCookie(res, C_DATA, dataset);
  res.json({
    tier, dataset,
    note: tier === "business"
      ? `Welcome — your work email qualifies for live data. Exploring real recognition data now.`
      : `Welcome — free-email accounts get the demo with mock data. Sign up with a work email for live data.`,
  });
});

app.post("/api/waitlist", (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const email = String(b.email ?? "").trim();
  if (!isValidEmail(email)) return res.status(400).json({ error: "bad_email", detail: "Enter a valid email." });
  addLead({ kind: "waitlist", name: b.name ?? "", email, domain: domainOf(email), tier: tierFor(email), company: b.company });
  res.json({ ok: true, note: "You're on the waitlist — we'll be in touch before launch." });
});

app.post("/api/book", (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const email = String(b.email ?? "").trim();
  if (!b.name || !isValidEmail(email)) return res.status(400).json({ error: "bad_input", detail: "Name and a valid email are required." });
  addLead({ kind: "booking", name: b.name, email, domain: domainOf(email), tier: tierFor(email), company: b.company, role: b.role, market: b.market, type: b.type, useCase: b.useCase });
  res.json({ ok: true, note: "Request received — we'll reach out to schedule your walkthrough." });
});

// admin lead export (telesales/marketing). agency session OR x-admin-key.
app.get("/api/leads", (req: Request, res: Response) => {
  const ok = currentClient(req)?.role === "agency" || req.headers["x-admin-key"] === ADMIN_KEY || req.query.key === ADMIN_KEY;
  if (!ok) return res.status(403).json({ error: "forbidden" });
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=brandcog_leads.csv");
    return res.send(leadsCsv());
  }
  res.json({ stats: leadStats(), leads: listLeads() });
});

// ---- competitive analytics (tier-aware dataset) -----------------------------
app.get("/api/overview", (req: Request, res: Response) => {
  const d = ds(req);
  res.json(overview(d.records, String(req.query.market ?? "All"), d.asOf, d.source));
});
app.get("/api/brands", (req: Request, res: Response) => {
  const d = ds(req);
  res.json(brandList(d.records, String(req.query.market ?? "All")));
});
app.get("/api/sites", (req: Request, res: Response) => {
  const d = ds(req);
  res.json(sitePoints(d.records, String(req.query.market ?? "All")));
});
app.get("/api/snapshots", (req: Request, res: Response) => {
  const d = ds(req);
  const brand = req.query.brand ? String(req.query.brand) : undefined;
  res.json(snapshots(d.records, String(req.query.market ?? "All"), brand));
});
app.get("/api/agency", (req: Request, res: Response) => {
  if (currentClient(req)?.role !== "agency") return res.status(403).json({ error: "agency_only" });
  const d = ds(req);
  res.json(agencyAnalysis(d.records, String(req.query.market ?? "All"), d.asOf, d.source));
});
app.get("/api/brand", (req: Request, res: Response) => {
  const d = ds(req);
  const brand = String(req.query.brand ?? currentClient(req)?.brand ?? "");
  if (!brand) return res.status(400).json({ error: "no_brand" });
  const view = competitive(d.records, String(req.query.market ?? "All"), brand);
  if (!view) return res.status(404).json({ error: "brand_not_found", brand });
  res.json(view);
});

// ---- legacy synthetic endpoints ---------------------------------------------
app.get("/api/campaign", async (_req: Request, res: Response) => {
  try { res.json(await getReport()); } catch (err) { res.status(500).json({ error: "report_failed", detail: String(err) }); }
});

// ---- manual image ingest ----------------------------------------------------
app.post("/api/ingest", upload.array("images", 50), (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const accepted: IngestItem[] = files.map((f) => ({ name: f.originalname, size: f.size, type: f.mimetype, at: new Date().toISOString() }));
  for (const a of accepted) { ingestQueue.push(a); if (ingestQueue.length > MAX_QUEUE) ingestQueue.shift(); }
  res.json({ accepted: accepted.length, totalBytes: accepted.reduce((s, a) => s + a.size, 0), queued: ingestQueue.length, batch: accepted,
    note: "Ingested to the demo queue (in-memory). Recognition runs in the offline CLIP pipeline." });
});
app.get("/api/ingest/status", (_req: Request, res: Response) => res.json({ queued: ingestQueue.length, recent: ingestQueue.slice(-20).reverse() }));

// ---- pages ------------------------------------------------------------------
const page = (file: string) => (_req: Request, res: Response) => res.sendFile(resolve(PUBLIC_DIR, file));
app.get("/", page("index.html"));        // Coming-Soon landing + waitlist
app.get("/marketing", page("marketing.html"));
app.get("/learn", page("marketing.html"));
app.get("/signup", page("signup.html"));
app.get("/login", page("login.html"));
app.get("/app", page("app.html"));        // the live demo dashboard
app.get("/upload", page("upload.html"));

app.use(express.static(PUBLIC_DIR, { maxAge: "1h", index: "index.html" }));
app.get(/^\/(?!api|healthz).*/, page("index.html"));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: "request_error", detail: err instanceof Error ? err.message : String(err) });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`BrandCog.io listening on :${PORT} (v${VERSION})`);
});
