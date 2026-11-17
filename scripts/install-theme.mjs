// Copies theme/clawd-3d into Clawd on Desk's user themes folder.
//   node scripts/install-theme.mjs [theme-dir]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.resolve(process.argv[2] || path.join(ROOT, "theme", "clawd-3d"));
const userData = {
  darwin: path.join(os.homedir(), "Library", "Application Support", "clawd-on-desk"),
  win32: path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "clawd-on-desk"),
}[process.platform] || path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config"), "clawd-on-desk");
const DEST = path.join(userData, "themes", path.basename(SRC));

if (!fs.existsSync(path.join(SRC, "theme.json"))) { console.error(`theme.json not found in ${SRC}`); process.exit(1); }
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(path.dirname(DEST), { recursive: true });
fs.cpSync(SRC, DEST, { recursive: true });
console.log(`installed: ${DEST}\nOpen Clawd on Desk → Settings → Theme and pick "Clawd 3D" (restart the app if it is not listed yet).`);
