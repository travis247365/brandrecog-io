// scripts/shots.mjs — QA screenshots via the installed Chrome (puppeteer-core).
import puppeteer from "puppeteer-core";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = process.env.PORT || 3009;
const base = `http://localhost:${PORT}`;
const OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function page(client) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1320, height: 1500, deviceScaleFactor: 1 });
  if (client) await p.setCookie({ name: "bc_client", value: client, domain: "localhost", path: "/", httpOnly: true });
  return p;
}
async function snap(p, file) { await wait(700); await p.screenshot({ path: `${OUT}/${file}`, fullPage: true }); console.log("shot", file); }

// login + agency
let p = await page(null); await p.goto(base + "/login", { waitUntil: "networkidle0" }); await snap(p, "qa_login.png"); await p.close();
p = await page("agency"); await p.goto(base + "/", { waitUntil: "networkidle0" }); await snap(p, "qa_agency.png"); await p.close();

// one session, switch brand via the selector — MTN(telecom) -> MoMo(mobile money) -> Betway(gaming)
p = await page("mtn");
await p.goto(base + "/", { waitUntil: "networkidle0" });
await snap(p, "qa_switch_mtn.png");
await p.select("#brandsel", "MoMo from MTN"); await snap(p, "qa_switch_momo.png");
await p.select("#brandsel", "Betway"); await snap(p, "qa_switch_betway.png");
await p.close();

await browser.close();
console.log("done");
