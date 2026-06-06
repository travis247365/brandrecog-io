import puppeteer from "puppeteer-core";
const OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp";
const B = "http://localhost:4000";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
async function shot(file, path, cookies = [], full = true, wait = 1200) {
  const p = await b.newPage();
  await p.setViewport({ width: 1340, height: 1500, deviceScaleFactor: 1 });
  for (const c of cookies) await p.setCookie({ ...c, domain: "localhost", path: "/", httpOnly: true });
  await p.goto(B + path, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, wait));
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: full });
  console.log("shot", file); await p.close();
}
await shot("qa_v207_marketing.png", "/marketing");
await shot("qa_v207_app_real.png", "/app", [{ name: "bc_client", value: "agency" }, { name: "bc_data", value: "real" }], true, 3000); // map needs tiles
await b.close(); console.log("done");
