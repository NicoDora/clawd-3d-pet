// Side-by-side strips: original SVG | 3D asset | 50% overlay, for several pairs, sampled at a given time.
import puppeteer from "puppeteer-core"; import { pathToFileURL } from "node:url"; import path from "node:path"; import fs from "node:fs";
const [svgDir, assetDir, out, t, ...pairs] = process.argv.slice(2);
const u = (p) => pathToFileURL(path.resolve(p)).href;
const rows = pairs.map((pr) => { const [a, b] = pr.split("="); const A = u(`${svgDir}/clawd-${a}.svg`), B = u(`${assetDir}/clawd3d-${b}`);
  return `<div class=r><div><img src="${A}"></div><div><img src="${B}"></div><div><img src="${B}"><img src="${A}" style="opacity:.5"></div><div class=mini><img src="${B}"></div></div>`; }).join("");
// 4th cell: what mini mode shows — the window (dashed) sits half off the right screen edge
fs.writeFileSync(".cmp2.html", `<style>body{margin:0;background:#dfe6ee}.r{display:flex}.r>div{position:relative;width:300px;height:300px;overflow:hidden;outline:1px solid #8fa3b8}
img{position:absolute;width:130.5%;left:-15.25%;bottom:-3.7%}.mini{background:linear-gradient(90deg,#dfe6ee 51.4%,#556 51.4%)}</style>${rows}`);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 300 * pairs.length });
await p.goto(u(".cmp2.html")); await new Promise((r) => setTimeout(r, Number(t) * 1000));
await p.screenshot({ path: out }); await b.close();
