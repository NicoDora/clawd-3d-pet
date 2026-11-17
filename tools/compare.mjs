// Overlay an original 2D SVG and a 3D still to check framing.
import puppeteer from "puppeteer-core"; import { pathToFileURL } from "node:url"; import path from "node:path"; import fs from "node:fs";
const [svg, still, out, mode = "overlay"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: mode === "overlay" ? 540 : 1080, height: 540 });
const html = mode === "overlay"
  ? `<body style="margin:0;background:#dfe6ee"><img src="${pathToFileURL(path.resolve(still)).href}" style="position:absolute;width:540px"><img src="${pathToFileURL(path.resolve(svg)).href}" style="position:absolute;width:540px;opacity:.55">`
  : `<body style="margin:0;background:#dfe6ee;display:flex"><img src="${pathToFileURL(path.resolve(svg)).href}" style="width:540px"><img src="${pathToFileURL(path.resolve(still)).href}" style="width:540px">`;
fs.writeFileSync(".cmp.html", html); await p.goto(pathToFileURL(path.resolve(".cmp.html")).href); await new Promise(r => setTimeout(r, 300));
await p.screenshot({ path: out, clip: { x: 0, y: 220, width: mode === "overlay" ? 540 : 1080, height: 300 } }); await b.close();
