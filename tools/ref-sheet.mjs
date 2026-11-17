// Contact sheets of the original 2D Clawd SVGs at several points in time.
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [svgDir, outDir, ...timesArg] = process.argv.slice(2);
const times = timesArg.length ? timesArg.map(Number) : [0.5, 1.6, 3.2];
const NAMES = [
  "idle-follow", "idle-look", "idle-bubble", "idle-reading", "idle-yawn", "idle-doze",
  "collapse-sleep", "sleeping", "wake", "working-thinking", "working-typing", "headphones-groove",
  "working-juggling", "working-building", "working-sweeping", "working-carrying", "working-debugger", "designing",
  "heart-eyes", "error", "happy", "notification", "dizzy", "react-drag",
  "react-left", "react-right", "react-annoyed", "react-double", "react-double-jump", "mini-idle",
  "mini-alert", "mini-happy", "mini-enter", "mini-peek", "mini-typing", "mini-crabwalk",
  "mini-enter-sleep", "mini-sleep",
];
fs.mkdirSync(outDir, { recursive: true });
const perSheet = 20;
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--allow-file-access-from-files"],
});
for (let s = 0; s * perSheet < NAMES.length; s++) {
  const names = NAMES.slice(s * perSheet, (s + 1) * perSheet);
  const cells = names.map((n) => {
    const url = pathToFileURL(path.join(svgDir, `clawd-${n}.svg`)).href;
    return `<figure><img src="${url}"><figcaption>${n}</figcaption></figure>`;
  }).join("");
  const html = `<!doctype html><style>
    body{margin:0;background:#8fa3b8;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:4px;font:12px system-ui}
    figure{margin:0;background:#dfe6ee;position:relative;aspect-ratio:1}
    img{width:100%;height:100%;display:block}
    figcaption{position:absolute;left:4px;top:2px;color:#123}
  </style>${cells}`;
  const file = path.join(outDir, `sheet${s}.html`);
  fs.writeFileSync(file, html);
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 884, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href);
  const t0 = Date.now();
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await page.screenshot({ path: path.join(outDir, `sheet${s}-t${t}.png`) });
  }
  await page.close();
}
await browser.close();
console.log("done");
