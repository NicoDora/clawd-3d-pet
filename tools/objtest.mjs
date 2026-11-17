// Loads the idle SVG through <object> (the app's eye-tracking channel) and applies
// the same transforms the app sets, to check raster compositing + tracking.
import puppeteer from "puppeteer-core"; import { pathToFileURL } from "node:url"; import path from "node:path"; import fs from "node:fs";
const [svg, out] = process.argv.slice(2);
const u = pathToFileURL(path.resolve(svg)).href;
const cases = [[0, 0], [-1.5, -1], [1.5, 1], [0, 0, "novec"], [0, 0, "blink"]];
fs.writeFileSync(".obj.html", `<style>body{margin:0;background:#dfe6ee;display:flex}div{position:relative;width:360px;height:300px;overflow:hidden;outline:1px solid #8fa3b8}
object{position:absolute;width:261%;height:261%;left:-80%;top:-150%}</style>${cases.map(() => `<div><object type="image/svg+xml" data="${u}"></object></div>`).join("")}`);
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: 360 * cases.length, height: 300 });
await p.goto(pathToFileURL(path.resolve(".obj.html")).href); await new Promise((r) => setTimeout(r, 800));
const info = await p.evaluate((cases) => [...document.querySelectorAll("object")].map((o, i) => {
  const d = o.contentDocument; if (!d) return "no contentDocument";
  const [dx, dy, flag] = cases[i];
  d.getElementById("eyes-js").setAttribute("transform", `translate(${dx}, ${dy})`);
  const bdx = Math.round(dx * 0.33 * 2) / 2, bdy = Math.round(dy * 0.33 * 2) / 2;
  d.getElementById("body-js").setAttribute("transform", `translate(${bdx}, ${bdy})`);
  d.getElementById("shadow-js").setAttribute("transform", `translate(${Math.round(bdx * 0.3 * 2) / 2}, 0) scale(${1 + Math.abs(bdx) * 0.1}, 1)`);
  if (flag === "novec") d.querySelectorAll("polygon").forEach((x) => x.remove());
  if (flag === "blink") d.querySelector(".eyes-blink").style.cssText = "animation:none;transform:scaleY(0.1)";
  return [...d.querySelectorAll("image")].map((im) => im.getBBox().width).join("/");
}), cases);
console.log(info.join(" | ")); await new Promise((r) => setTimeout(r, 500));
await p.screenshot({ path: out }); await b.close();
