import puppeteer from "puppeteer-core";
const OUT = "/Users/tpmulenga/Desktop/BrandCog.ai (BrandRecog.io)/mvp";
const B = "https://brandcog-io.fly.dev";
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
async function shot(file, path, cookies = []) {
  const p = await b.newPage();
  await p.setViewport({ width: 1340, height: 1500, deviceScaleFactor: 1 });
  for (const c of cookies) await p.setCookie({ ...c, domain: "brandcog-io.fly.dev", path: "/", httpOnly: true });
  await p.goto(B + path, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  await p.screenshot({ path: `${OUT}/${file}`, fullPage: file.includes("app") });
  console.log("shot", file); await p.close();
}
await shot("qa_live_coming.png", "/");
await shot("qa_live_app.png", "/app", [{ name: "bc_client", value: "agency" }, { name: "bc_data", value: "real" }]);
await b.close(); console.log("done");
