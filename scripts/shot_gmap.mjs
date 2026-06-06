import puppeteer from "puppeteer-core";
const OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
const errs = [];
p.on("console", (m) => { const t = m.text(); if (/google|maps|Referer|ApiNotActivated|InvalidKey|BillingNotEnabled/i.test(t)) errs.push(m.type().toUpperCase() + ": " + t); });
p.on("pageerror", (e) => errs.push("PAGEERROR: " + e.message));
await p.setViewport({ width: 1340, height: 1400 });
await p.setCookie({ name: "bc_client", value: "agency", domain: "localhost", path: "/", httpOnly: true });
await p.setCookie({ name: "bc_data", value: "real", domain: "localhost", path: "/", httpOnly: true });
await p.goto("http://localhost:4000/app", { waitUntil: "networkidle0", timeout: 30000 });
await new Promise((r) => setTimeout(r, 4000));
// scroll to map
await p.evaluate(() => document.getElementById("bcmap")?.scrollIntoView());
await new Promise((r) => setTimeout(r, 1500));
await p.screenshot({ path: `${OUT}/qa_gmap.png`, fullPage: false });
console.log("MAP CONSOLE MESSAGES:", errs.length ? errs.join(" | ") : "(none — clean)");
await b.close();
