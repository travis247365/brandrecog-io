// scripts/r2bl.check.ts — deterministic checks for the R2BL lead-profiling engine.
// Run: npx tsx scripts/r2bl.check.ts   (also writes a sample alert preview to /tmp)
import { writeFileSync } from "node:fs";
import type { Lead } from "../server/ports/leadStore";
import { profileLead, alertSubject, renderAlertHtml, renderAlertText } from "../server/domain/r2bl";

let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.error("  ✗", m); } };

const mk = (o: Partial<Lead>): Lead => ({
  id: "T", kind: "signup", name: "", email: "", domain: "", tier: "demo", createdAt: new Date().toISOString(), ...o,
});

// 1) Hot: senior business contact, OOH-active sector, in-footprint, booking
const hot = profileLead(mk({
  kind: "booking", name: "Joseph Mugera", email: "joseph@mtn.co.zm", domain: "mtn.co.zm", tier: "business",
  company: "MTN Zambia", role: "Head of Brand", market: "Zambia", type: "Brand / advertiser",
  useCase: "Track our SOV vs Airtel and Zamtel on the Lusaka corridors",
}));
// 2) Cold: anonymous free-email waitlist, nothing else
const cold = profileLead(mk({ kind: "waitlist", email: "someone@gmail.com", domain: "gmail.com", tier: "demo" }));
// 3) Mid: business email, agency, some detail, signup
const mid = profileLead(mk({
  kind: "signup", name: "Tina Banda", email: "tina@creativeagency.co.za", domain: "creativeagency.co.za",
  tier: "business", company: "Creative Agency", role: "Account Manager", market: "South Africa", type: "Agency",
}));

console.log("R2BL engine checks:");
ok(hot.band === "Hot", `senior MTN booking → Hot (got ${hot.band}/${hot.priority})`);
ok(cold.band === "Cold" || cold.band === "Nurture", `anon free-email waitlist → low (got ${cold.band}/${cold.priority})`);
ok(hot.priority > mid.priority && mid.priority > cold.priority, `priority ordering hot>mid>cold (${hot.priority}>${mid.priority}>${cold.priority})`);
ok(hot.sector === "Telecom", `MTN → Telecom sector (got ${hot.sector})`);
ok(mid.sector === "Agency", `agency → Agency sector (got ${mid.sector})`);
ok(hot.seniority === "Director / Head", `"Head of Brand" → Director/Head (got ${hot.seniority})`);

const allAxes = [hot, cold, mid].flatMap((p) => Object.values(p.axes).map((a) => a.score));
ok(allAxes.every((s) => s >= 0 && s <= 100), "all axis scores within 0..100");
ok(cold.axes.risk.score > hot.axes.risk.score, `free-email lead has higher Risk axis (${cold.axes.risk.score} > ${hot.axes.risk.score})`);

const html = renderAlertHtml(hot);
ok(html.includes("BrandRecog") && html.includes("R2BL") && html.includes(hot.band.toUpperCase()), "HTML has brand + R2BL + band");
ok(html.includes("Recommended next action") && html.includes("bias"), "HTML has recommendation + bias note");
ok(alertSubject(hot).startsWith("[BrandRecog Lead · Hot]"), `subject format (${alertSubject(hot)})`);
ok(renderAlertText(cold).includes("R2BL axes:"), "text version renders");

writeFileSync("/tmp/r2bl_sample_alert.html", html);
writeFileSync("/tmp/r2bl_sample_alert.txt", renderAlertText(hot));
console.log(`\nSample alert written: /tmp/r2bl_sample_alert.html  (subject: "${alertSubject(hot)}")`);
console.log(`\n${fail === 0 ? "R2BL CHECK PASS" : "R2BL CHECK FAIL"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
