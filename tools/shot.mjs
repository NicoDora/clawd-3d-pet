import puppeteer from "puppeteer-core"; import { pathToFileURL } from "node:url"; import path from "node:path";
const [html, out, t = "1.3", w = "1240", scheme = "light"] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: Number(w), height: 900 });
await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }]);
p.on("pageerror", (e) => console.error("[pageerror]", e.message));
await p.goto(pathToFileURL(path.resolve(html)).href); await new Promise((r) => setTimeout(r, Number(t) * 1000));
await p.screenshot({ path: out, fullPage: true }); await b.close();
