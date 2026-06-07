// scripts/smoke.mjs — boots the built server and asserts the integrated site.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = 3100;
const child = spawn("node", ["dist/index.js"], { env: { ...process.env, PORT: String(PORT), MOCK: "1", DATA_DIR: "/tmp/bc-smoke-data" }, stdio: "inherit" });
const base = `http://localhost:${PORT}`;
const assert = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("  ✓ " + m); };
const j = (r) => r.json();
const cookieOf = (r) => (r.headers.get("set-cookie") || "").split(",").map((s) => s.split(";")[0]).filter(Boolean).join("; ");

try {
  let healthy = false;
  for (let i = 0; i < 40; i++) { try { if ((await fetch(`${base}/healthz`)).ok) { healthy = true; break; } } catch {} await sleep(200); }
  if (!healthy) throw new Error("server did not become healthy");

  const h = await j(await fetch(`${base}/healthz`));
  assert(h.version === "2.2.1", `version ${h.version}`);
  assert(h.realRecords > 500 && h.mockRecords > 0, `datasets loaded (real ${h.realRecords}, mock ${h.mockRecords})`);
  // map + config + real geo
  const cfg = await j(await fetch(`${base}/api/config`));
  assert(cfg.version === "2.2.1" && (cfg.maps === "osm" || cfg.maps === "google"), `config (maps=${cfg.maps})`);
  const realSites = await j(await fetch(`${base}/api/sites?market=All`, { headers: { cookie: "bc_data=real" } }));
  assert(realSites.length > 50 && realSites.some((s) => s.snapshot), `real geo sites + snapshots (${realSites.length})`);
  assert(h.leads && typeof h.leads.total === "number", "lead store wired");

  // pages serve
  for (const p of ["/", "/marketing", "/signup", "/login", "/app"]) {
    const r = await fetch(`${base}${p}`); assert(r.ok, `page ${p} serves`);
  }

  // username/password auth
  const bad = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "agency", password: "nope" }) });
  assert(bad.status === 401, "wrong password rejected");
  const login = await fetch(`${base}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "agency", password: "agency2026" }) });
  assert(login.ok, "agency login (username/password)");
  const ac = cookieOf(login);
  const me = await j(await fetch(`${base}/api/me`, { headers: { cookie: ac } }));
  assert(me.role === "agency" && me.dataset === "real", "agency session = real data");

  // tier-aware overview
  const ovReal = await j(await fetch(`${base}/api/overview?market=All`, { headers: { cookie: ac } }));
  assert(ovReal.totals.brands >= 25, `real overview brands (${ovReal.totals.brands})`);
  const ovAnon = await j(await fetch(`${base}/api/overview?market=All`));
  assert(ovAnon.totals.brands <= 12, `anon/mock overview brands (${ovAnon.totals.brands})`);

  // dynamic brand switch + agency analysis + sites
  const betway = await j(await fetch(`${base}/api/brand?brand=Betway&market=All`, { headers: { cookie: ac } }));
  assert(betway.brand.sector === "gaming", "brand switch → gaming sector");
  const ag = await j(await fetch(`${base}/api/agency?market=All`, { headers: { cookie: ac } }));
  assert(ag.dataSources.some((d) => d.tier === "paid" && d.status === "available"), "plug-and-pay sources available");
  const sites = await j(await fetch(`${base}/api/sites?market=All`)); // anon=mock has geo
  assert(Array.isArray(sites) && sites.length > 0 && typeof sites[0].lat === "number", `mock site points for map (${sites.length})`);

  // sign-up email gating
  const free = await fetch(`${base}/api/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Free User", email: "demo@gmail.com" }) });
  const freeD = await j(free); const freeCookie = cookieOf(free);
  assert(freeD.tier === "demo" && freeD.dataset === "mock", "free email → demo/mock");
  const meFree = await j(await fetch(`${base}/api/me`, { headers: { cookie: freeCookie } }));
  assert(meFree.dataset === "mock", "free signup session = mock data");
  const biz = await j(await fetch(`${base}/api/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Biz User", email: "lead@acme.co", company: "Acme" }) }));
  assert(biz.tier === "business" && biz.dataset === "real", "business email → real data");

  // waitlist + booking + admin leads
  assert((await fetch(`${base}/api/waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "wait@acme.co" }) })).ok, "waitlist capture");
  assert((await fetch(`${base}/api/book`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "B", email: "book@acme.co" }) })).ok, "booking capture");
  const denied = await fetch(`${base}/api/leads`);
  assert(denied.status === 403, "leads export protected");
  const leads = await j(await fetch(`${base}/api/leads`, { headers: { cookie: ac } }));
  assert(leads.leads.length >= 3, `leads persisted & exportable (${leads.leads.length})`);

  console.log("\nSMOKE PASS");
} catch (e) {
  console.error("\nSMOKE FAIL:", e.message);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
}
