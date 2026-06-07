// server/domain/r2bl.ts
// R2BL lead-profiling engine — adapts the R2BL composite (Reputation · Risk · Bio ·
// Lifestyle) and the Verithica app-case methodology to inbound B2B prospect
// qualification ("a quick R2BL Profile of the possible Client").
//
// Mirrored from the R2BL platform's scoring engine (shared/scoring.ts):
//  • pure & deterministic — same lead → same profile, always (no LLM, no randomness)
//  • weighted factors per axis, normalised, then banded (show BANDS, not false-precision)
//  • every factor carries a source + provenance (measured/modelled/assumed) + a
//    discrimination-risk flag — the JvZ bias-governance discipline.
//
// Weight-set: "lead-v1.0" (versioned & governed). Note the deliberate deviation from
// the AML weight-set: for a PROSPECT a high score = high *opportunity*, so the priority
// composite uses (100 − Risk) — documented below.

import type { Lead } from "../ports/leadStore";
import { isFreeDomain } from "./emailGate";

export type Provenance = "measured" | "modelled" | "assumed";
export type DiscriminationRisk = "low" | "medium" | "high";
export type Axis = "reputation" | "risk" | "bio" | "lifestyle";
export type PriorityBand = "Hot" | "Warm" | "Nurture" | "Cold";

export interface Factor {
  label: string;
  weight: number;     // 0..1 within its axis (engine normalises)
  value: number;      // 0..100 signal strength
  source: string;
  provenance: Provenance;
  discriminationRisk: DiscriminationRisk;
}
export interface AxisResult { score: number; factors: Factor[]; }

export interface LeadProfile {
  lead: Lead;
  axes: Record<Axis, AxisResult>;
  priority: number;          // 0..100 prospect priority (lead weight-set)
  band: PriorityBand;
  sector: string;
  seniority: string;
  buyerType: string;
  narrative: string;
  recommendation: string;
  biasNote: string;
  weightSetVersion: string;
  computedAt: string;
}

const WEIGHT_SET = "lead-v1.0";

// ── R2BL math (mirrors shared/scoring.ts: normalise weights → weighted mean → clamp) ──
function scoreAxis(factors: Factor[]): number {
  if (!factors.length) return 0;
  const total = factors.reduce((s, f) => s + f.weight, 0);
  if (total === 0) return 0;
  const weighted = factors.reduce((s, f) => s + f.value * (f.weight / total), 0);
  return Math.round(Math.min(100, Math.max(0, weighted)));
}

// ── deterministic signal extraction (the "app case" build) ───────────────────
const SECTOR_KEYWORDS: [string, RegExp][] = [
  ["Telecom", /\b(mtn|airtel|zamtel|telecom|telco|mobile network|melon|vodacom|cell)\b/i],
  ["Mobile Money / Fintech", /\b(momo|mobile money|fintech|wallet|payments?|pay|bank|finance|financial|fnb|absa|stanbic|zanaco|capital|sacco|microfin|insur|hippo|lender)\b/i],
  ["Betting & Gaming", /\b(bet|bola|betlion|lion|sportybet|casino|gaming|wager|hollywood|gal sport|odds)\b/i],
  ["Media & Entertainment", /\b(gotv|dstv|multichoice|supersport|media|broadcast|\btv\b|radio|entertainment|streaming|publish)\b/i],
  ["Energy & Fuel", /\b(bp|fuel|energy|petro|oil|total|puma|engen|solar|gas)\b/i],
  ["FMCG", /\b(coca|cola|fmcg|beverage|brewery|breweries|trade kings|consumer goods|snack|dairy)\b/i],
  ["Retail / QSR", /\b(shoprite|spar|woolworths|pick n pay|retail|store|mall|nando|food|restaurant|\bqsr\b|chicken|pizza)\b/i],
  ["Agency", /\b(agency|advertis|marketing|ogilvy|dentsu|publicis|\bddb\b|media buy|creative)\b/i],
];

function inferSector(lead: Lead): string {
  const hay = [lead.company, lead.domain, lead.useCase, lead.type, lead.name].filter(Boolean).join(" ");
  for (const [sector, re] of SECTOR_KEYWORDS) if (re.test(hay)) return sector;
  return "General / unspecified";
}

function inferSeniority(role?: string): { label: string; value: number } {
  const r = (role ?? "").toLowerCase();
  if (!r) return { label: "Unknown", value: 30 };
  if (/\b(ceo|cmo|cfo|coo|chief|founder|owner|partner|managing director|\bmd\b|president)\b/.test(r)) return { label: "C-suite / Owner", value: 95 };
  if (/\b(director|head|vp|vice president|gm|general manager)\b/.test(r)) return { label: "Director / Head", value: 80 };
  if (/\b(manager|lead|principal|senior)\b/.test(r)) return { label: "Manager / Lead", value: 60 };
  if (/\b(analyst|exec|executive|officer|coordinator|specialist|associate)\b/.test(r)) return { label: "Individual contributor", value: 45 };
  return { label: "Other / unspecified", value: 35 };
}

function inferBuyerType(lead: Lead): { label: string; fit: number } {
  const t = (lead.type ?? "").toLowerCase();
  if (/agency/.test(t)) return { label: "Agency", fit: 85 };
  if (/media owner|owner/.test(t)) return { label: "Media owner", fit: 80 };
  if (/brand|advertiser/.test(t)) return { label: "Brand / advertiser", fit: 85 };
  if (/consult/.test(t)) return { label: "Consulting firm", fit: 75 };
  if (t) return { label: lead.type as string, fit: 50 };
  return { label: "Unspecified", fit: 45 };
}

const IN_FOOTPRINT = /\b(zambia|south africa|\bza\b|\bzm\b|pan.?african|africa|lusaka|johannesburg|joburg)\b/i;

export function profileLead(lead: Lead): LeadProfile {
  const free = isFreeDomain(lead.email);
  const hasCompany = Boolean(lead.company && lead.company.trim());
  const hasRole = Boolean(lead.role && lead.role.trim());
  const hasUseCase = Boolean(lead.useCase && lead.useCase.trim().length > 8);
  const hasMarket = Boolean(lead.market && lead.market.trim());
  const sector = inferSector(lead);
  const sectorIsActive = sector !== "General / unspecified";
  const seniority = inferSeniority(lead.role);
  const buyer = inferBuyerType(lead);
  const marketFit = IN_FOOTPRINT.test([lead.market, lead.domain, lead.company].filter(Boolean).join(" "));
  const intentValue = lead.kind === "booking" ? 90 : lead.kind === "signup" ? 60 : 45;

  const axes: Record<Axis, AxisResult> = {
    reputation: { score: 0, factors: [
      { label: "Corporate email domain", weight: 0.45, value: free ? 25 : 78, source: `domain: ${lead.domain || "—"}`, provenance: "measured", discriminationRisk: "low" },
      { label: "Named organisation", weight: 0.30, value: hasCompany ? 72 : 22, source: hasCompany ? lead.company! : "no company given", provenance: "measured", discriminationRisk: "low" },
      { label: "Recognised sector", weight: 0.25, value: sectorIsActive ? 80 : 48, source: `sector inferred: ${sector}`, provenance: "modelled", discriminationRisk: "low" },
    ]},
    risk: { score: 0, factors: [
      { label: "Free / personal email", weight: 0.30, value: free ? 80 : 22, source: free ? "consumer domain" : "business domain", provenance: "measured", discriminationRisk: "medium" },
      { label: "Missing company", weight: 0.25, value: hasCompany ? 25 : 70, source: hasCompany ? "company present" : "company absent", provenance: "measured", discriminationRisk: "low" },
      { label: "Intent / channel", weight: 0.25, value: lead.kind === "booking" ? 18 : lead.kind === "signup" ? 40 : 60, source: `via ${lead.kind}`, provenance: "measured", discriminationRisk: "low" },
      { label: "Vague / absent use-case", weight: 0.20, value: hasUseCase ? 25 : 55, source: hasUseCase ? "use-case given" : "no use-case", provenance: "measured", discriminationRisk: "low" },
    ]},
    bio: { score: 0, factors: [
      { label: "Name provided", weight: 0.25, value: lead.name?.trim() ? 70 : 15, source: lead.name?.trim() || "anonymous", provenance: "measured", discriminationRisk: "low" },
      { label: "Role seniority", weight: 0.35, value: seniority.value, source: `role: ${lead.role || "—"} → ${seniority.label}`, provenance: "assumed", discriminationRisk: "medium" },
      { label: "Market specified", weight: 0.15, value: hasMarket ? 65 : 30, source: lead.market || "unspecified", provenance: "measured", discriminationRisk: "low" },
      { label: "Company specified", weight: 0.25, value: hasCompany ? 60 : 20, source: hasCompany ? lead.company! : "—", provenance: "measured", discriminationRisk: "low" },
    ]},
    lifestyle: { score: 0, factors: [
      { label: "Sector fit (OOH-active)", weight: 0.30, value: sectorIsActive ? 85 : 38, source: sector, provenance: "modelled", discriminationRisk: "low" },
      { label: "Market in footprint (ZM/ZA)", weight: 0.25, value: marketFit ? 85 : 42, source: lead.market || lead.domain || "unknown", provenance: "modelled", discriminationRisk: "low" },
      { label: "Buyer-type fit", weight: 0.25, value: buyer.fit, source: buyer.label, provenance: "modelled", discriminationRisk: "low" },
      { label: "Engagement intent", weight: 0.20, value: intentValue, source: `via ${lead.kind}`, provenance: "measured", discriminationRisk: "low" },
    ]},
  };
  (Object.keys(axes) as Axis[]).forEach((a) => { axes[a].score = scoreAxis(axes[a].factors); });

  // Prospect priority (lead weight-set): Risk inverted — high = high opportunity.
  const priority = Math.round(Math.min(100, Math.max(0,
    0.32 * axes.reputation.score + 0.30 * (100 - axes.risk.score) + 0.15 * axes.bio.score + 0.23 * axes.lifestyle.score)));
  const band: PriorityBand = priority >= 70 ? "Hot" : priority >= 50 ? "Warm" : priority >= 30 ? "Nurture" : "Cold";

  const tierData = lead.tier === "business" ? "real (live) data" : "mock (demo) data";
  const narrative =
    `${lead.tier === "business" ? "Business-email" : "Free-email"} prospect` +
    `${hasCompany ? ` from ${lead.company}` : ""} — inferred ${sector} sector` +
    `${marketFit ? `, ${lead.market || "in-footprint"} market` : ""}. ` +
    `Contact: ${seniority.label}${buyer.label !== "Unspecified" ? `, ${buyer.label}` : ""}, arrived via ${lead.kind}. ` +
    `Email tier grants ${tierData}.`;

  const recommendation =
    band === "Hot"
      ? `Priority outreach within 24h. ${lead.tier === "business" ? "Route to sales for a live-data walkthrough" : "Strong intent despite free email — qualify the company manually"}. Lead with ${sector} competitive read (SOV / Share of Space).`
      : band === "Warm"
      ? `Follow up in 2–3 days. Qualify the use-case and confirm budget/market. Send the ${sector} one-pager.`
      : band === "Nurture"
      ? `Add to the nurture sequence — marketing content + case studies. Re-score if they book a demo.`
      : `Low priority / automated nurture. ${free ? "Free-email → demo tier; " : ""}revisit if engagement signals improve.`;

  const flagged = (Object.keys(axes) as Axis[])
    .flatMap((a) => axes[a].factors.filter((f) => f.discriminationRisk !== "low").map((f) => f.label));
  const biasNote = flagged.length
    ? `Bias watch: ${[...new Set(flagged)].join("; ")} are modelled/assumed proxies (e.g. email-domain → quality, title → seniority). Treat as signals, not facts — do not auto-disqualify; verify on contact.`
    : `No elevated bias-risk factors flagged.`;

  return { lead, axes, priority, band, sector, seniority: seniority.label, buyerType: buyer.label,
    narrative, recommendation, biasNote, weightSetVersion: WEIGHT_SET, computedAt: new Date().toISOString() };
}

// ── render: subject + branded HTML + plain text ──────────────────────────────
const BAND_COLOR: Record<PriorityBand, string> = { Hot: "#E53935", Warm: "#FFC107", Nurture: "#00BCD4", Cold: "#8a9099" };
const AXIS_LABEL: Record<Axis, string> = { reputation: "Reputation", risk: "Risk", bio: "Bio", lifestyle: "Lifestyle (fit)" };

export function alertSubject(p: LeadProfile): string {
  return `[BrandRecog Lead · ${p.band}] ${p.lead.name || p.lead.email} — ${p.sector} (priority ${p.priority})`;
}

function bar(axis: Axis, r: AxisResult): string {
  const color = axis === "risk" ? "#E53935" : "#00BCD4";
  return `<tr>
    <td style="padding:4px 10px 4px 0;font:600 12px Inter,Arial,sans-serif;color:#3A3A3A;white-space:nowrap">${AXIS_LABEL[axis]}</td>
    <td style="width:100%;padding:4px 0"><div style="background:#eceff1;border-radius:6px;height:14px;width:100%">
      <div style="background:${color};height:14px;border-radius:6px;width:${r.score}%"></div></div></td>
    <td style="padding:4px 0 4px 10px;font:700 12px Inter,Arial,sans-serif;color:#3A3A3A">${r.score}</td></tr>`;
}

function factorRows(p: LeadProfile): string {
  const rows: string[] = [];
  (Object.keys(p.axes) as Axis[]).forEach((a) => {
    p.axes[a].factors.forEach((f) => {
      const prov = f.provenance === "measured" ? "#2E7D32" : f.provenance === "modelled" ? "#0097A7" : "#B26A00";
      const flag = f.discriminationRisk !== "low" ? ` ⚠ ${f.discriminationRisk}` : "";
      rows.push(`<tr>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font:500 11px Inter,Arial;color:#3A3A3A">${AXIS_LABEL[a]}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font:500 11px Inter,Arial;color:#3A3A3A">${f.label}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font:700 11px Inter,Arial;color:#3A3A3A">${f.value}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font:600 10px Inter,Arial;color:${prov};text-transform:uppercase">${f.provenance}${flag}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font:400 10px Inter,Arial;color:#8a9099">${f.source}</td></tr>`);
    });
  });
  return rows.join("");
}

export function renderAlertHtml(p: LeadProfile): string {
  const l = p.lead;
  const row = (k: string, v?: string) => v ? `<tr><td style="padding:3px 12px 3px 0;font:600 12px Inter,Arial;color:#8a9099">${k}</td><td style="padding:3px 0;font:500 12px Inter,Arial;color:#23262A">${v}</td></tr>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f7f8;padding:0">
<div style="max-width:680px;margin:0 auto;background:#fff">
  <div style="background:#2C2C2C;border-top:6px solid #00BCD4;padding:22px 28px">
    <div style="font:800 22px Montserrat,Arial,sans-serif;color:#fff">BrandRecog<span style="color:#00BCD4">.io</span></div>
    <div style="font:600 11px Inter,Arial;color:#9aa0a7;letter-spacing:1px;margin-top:2px">NEW LEAD · R2BL PROSPECT PROFILE · ${l.kind.toUpperCase()}</div>
  </div>
  <div style="padding:24px 28px">
    <div style="display:inline-block;background:${BAND_COLOR[p.band]};color:#fff;font:800 13px Montserrat,Arial;padding:6px 14px;border-radius:6px">${p.band.toUpperCase()} · priority ${p.priority}/100</div>
    <h2 style="font:800 20px Montserrat,Arial;color:#2C2C2C;margin:16px 0 4px">${l.name || "(no name)"} <span style="font:500 14px Inter,Arial;color:#8a9099">&lt;${l.email}&gt;</span></h2>
    <p style="font:400 14px Inter,Arial;color:#3A3A3A;line-height:1.6;margin:8px 0 18px">${p.narrative}</p>

    <table style="border-collapse:collapse;margin-bottom:6px">${row("Tier", l.tier)}${row("Company", l.company)}${row("Role", l.role)}${row("Market", l.market)}${row("Buyer type", p.buyerType)}${row("Sector (inferred)", p.sector)}${row("Use case", l.useCase)}${row("Captured", l.createdAt)}</table>

    <h3 style="font:700 12px Inter,Arial;color:#8a9099;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e6e8eb;padding-bottom:6px;margin:22px 0 10px">R2BL axes (band, not false precision)</h3>
    <table style="width:100%;border-collapse:collapse">${(Object.keys(p.axes) as Axis[]).map((a) => bar(a, p.axes[a])).join("")}</table>

    <div style="background:#E7F7FA;border-left:4px solid #00BCD4;border-radius:6px;padding:12px 14px;margin:18px 0">
      <div style="font:700 11px Inter,Arial;color:#0097A7;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Recommended next action</div>
      <div style="font:500 13px Inter,Arial;color:#23262A;line-height:1.5">${p.recommendation}</div></div>

    <div style="background:#FFF6DD;border-left:4px solid #FFC107;border-radius:6px;padding:12px 14px;margin:0 0 18px">
      <div style="font:700 11px Inter,Arial;color:#B26A00;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Honesty &amp; bias note</div>
      <div style="font:400 12px Inter,Arial;color:#5b4a13;line-height:1.5">${p.biasNote}</div></div>

    <h3 style="font:700 12px Inter,Arial;color:#8a9099;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e6e8eb;padding-bottom:6px;margin:22px 0 8px">Factor provenance</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:4px 8px;font:700 10px Inter,Arial;color:#8a9099">AXIS</td><td style="padding:4px 8px;font:700 10px Inter,Arial;color:#8a9099">FACTOR</td><td style="padding:4px 8px;font:700 10px Inter,Arial;color:#8a9099">VAL</td><td style="padding:4px 8px;font:700 10px Inter,Arial;color:#8a9099">PROVENANCE</td><td style="padding:4px 8px;font:700 10px Inter,Arial;color:#8a9099">SOURCE</td></tr>
      ${factorRows(p)}
    </table>
  </div>
  <div style="background:#2C2C2C;padding:16px 28px;font:400 11px Inter,Arial;color:#9aa0a7">
    R2BL engine · weight-set ${p.weightSetVersion} · Verithica app-case methodology · computed ${p.computedAt}<br/>
    <b style="color:#cfd3d8">Equanamity</b> — the ethical Big Data company, powered by AI · brandcog-io.fly.dev
  </div>
</div></body></html>`;
}

export function renderAlertText(p: LeadProfile): string {
  const l = p.lead;
  const axes = (Object.keys(p.axes) as Axis[]).map((a) => `  ${AXIS_LABEL[a]}: ${p.axes[a].score}`).join("\n");
  return [
    `NEW BRANDRECOG LEAD — ${p.band} (priority ${p.priority}/100)`,
    `${l.name || "(no name)"} <${l.email}>  ·  ${l.kind} · ${l.tier} tier`,
    l.company ? `Company: ${l.company}` : "",
    `Sector (inferred): ${p.sector} · Buyer: ${p.buyerType} · Contact: ${p.seniority}`,
    l.market ? `Market: ${l.market}` : "",
    l.useCase ? `Use case: ${l.useCase}` : "",
    ``, `R2BL axes:`, axes,
    ``, `Narrative: ${p.narrative}`,
    ``, `Recommended action: ${p.recommendation}`,
    ``, `Bias note: ${p.biasNote}`,
    ``, `R2BL engine · weight-set ${p.weightSetVersion} · Verithica app-case methodology`,
    `Equanamity · brandcog-io.fly.dev`,
  ].filter((x) => x !== "").join("\n");
}
