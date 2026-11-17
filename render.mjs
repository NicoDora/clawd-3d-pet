// Renders Clawd 3D animations with headless Chrome and encodes them as APNG.
//   node render.mjs --out <dir> [--only a,b] [--still name@t,...] [--px 960] [--size 480]
import puppeteer from "puppeteer-core";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).join(" ").split("--").filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(" "); return [k, v.join(" ") || true]; }));
const OUT = path.resolve(args.out || path.join(HERE, "out"));
const PX = Number(args.px || 960), SIZE = Number(args.size || 480);
const TMP = path.join(HERE, ".frames");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png" };

const server = http.createServer((req, res) => {
  const p = path.join(HERE, decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(p).pipe(res);
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;

let browser = null;
async function launch() {
  if (browser) await browser.close().catch(() => {});
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl"],
  });
  page = null;
}
let page = null;
let clips = 0;
async function freshPage() { // headless Chrome dies after ~30 s of readbacks: restart it every few clips
  if (!browser || clips++ % 6 === 0) await launch();
  if (page) await page.close();
  page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));
  await page.setViewport({ width: 600, height: 600 });
  await page.goto(`${base}/index.html?px=${PX}`);
  await page.waitForFunction("window.studioReady === true", { timeout: 30000 });
}
await freshPage();
const info = await page.evaluate("window.ANIM_INFO");
fs.mkdirSync(OUT, { recursive: true });

const grab = async (name, t, layer = "all") => Buffer.from((await page.evaluate((n, tt, l) => window.renderFrame(n, tt, l), name, t, layer)).split(",")[1], "base64");

if (args.still) {
  for (const spec of String(args.still).split(",")) {
    const [nameLayer, t] = spec.split("@");
    const [name, layer] = nameLayer.split(":");
    fs.writeFileSync(path.join(OUT, `${name}${layer ? "-" + layer : ""}@${t}.png`), await grab(name, Number(t), layer || "all"));
  }
} else {
  const names = args.only ? String(args.only).split(",") : Object.keys(info).filter((k) => !info[k].qa);
  for (const name of names) {
    const a = info[name];
    if (!a) { console.error("unknown animation", name); continue; }
    const t0 = Date.now();
    await freshPage();
    if (a.layer) { // static layered stills (cursor-tracking idle)
      for (const layer of a.layer) {
        const raw = path.join(TMP, `${name}-${layer}.png`);
        fs.mkdirSync(TMP, { recursive: true });
        fs.writeFileSync(raw, await grab(name, 0, layer));
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-vf", `scale=${SIZE}:${SIZE}:flags=lanczos`, path.join(OUT, `clawd3d-${name}-${layer}.png`)]);
      }
      const still = path.join(TMP, `${name}-all.png`);
      fs.writeFileSync(still, await grab(name, 0, "all"));
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", still, "-vf", `scale=${SIZE}:${SIZE}:flags=lanczos`, path.join(OUT, `clawd3d-${name}-preview.png`)]);
      fs.writeFileSync(path.join(OUT, `${name}-vector.json`), JSON.stringify(await page.evaluate((n) => window.exportVector(n), name)));
      console.log(`${name}: layers ${a.layer.join("+")}`);
      continue;
    }
    const dir = path.join(TMP, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(a.dur * a.fps);
    for (let i = 0; i < n; i++) fs.writeFileSync(path.join(dir, `${String(i).padStart(4, "0")}.png`), await grab(name, i / a.fps));
    const file = path.join(OUT, `clawd3d-${name}.apng`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(a.fps), "-i", path.join(dir, "%04d.png"),
      "-vf", `scale=${SIZE}:${SIZE}:flags=lanczos`, "-plays", a.loop ? "0" : "1", "-f", "apng", file]);
    console.log(`${name}: ${n}f @${a.fps}fps ${(fs.statSync(file).size / 1024).toFixed(0)}KB ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
await browser.close();
server.close();
