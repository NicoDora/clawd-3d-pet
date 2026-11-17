// Assembles the Clawd 3D theme folder from the rendered assets.
//   node build-theme.mjs <rendered-dir> <theme-dir>
import fs from "node:fs";
import path from "node:path";

const [SRC, DEST] = process.argv.slice(2).map((p) => path.resolve(p));
const ASSETS = path.join(DEST, "assets");
fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(ASSETS, { recursive: true });
for (const f of fs.readdirSync(SRC)) if (/^clawd3d-.*\.(apng|png)$/.test(f)) fs.copyFileSync(path.join(SRC, f), path.join(ASSETS, f));

const f = (name) => `clawd3d-${name}.apng`;
const IDLE = "clawd3d-idle-follow.svg";

// Cursor-tracking idle: three 3D renders (shadow / body / eyes) composed in an
// SVG so the app can move #eyes-js, #body-js and #shadow-js toward the pointer.
// Breathing and blinking are CSS (transform only, compositor friendly).
const vector = JSON.parse(fs.readFileSync(path.join(SRC, "idle-vector.json"), "utf8"));
const flat = (group) => vector.filter((v) => v.group === group)
  .map((v) => `<polygon points="${v.pts}" fill="${v.fill}" stroke="${v.fill}" stroke-width="0.5" stroke-linejoin="round"/>`).join("\n      ");
const layer = (name) => `<image href="clawd3d-idle-${name}.png" x="-15" y="-25" width="45" height="45"/>`;
fs.writeFileSync(path.join(ASSETS, IDLE), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-15 -25 45 45" width="500" height="500">
  <defs>
    <style>
      .breathe-anim {
        transform-origin: 7.5px 15.4px;
        animation: breathe 3.2s infinite ease-in-out;
      }
      .eyes-blink {
        transform-origin: 6.85px 9.65px;
        animation: eye-blink 4s infinite ease-in-out;
      }
      #eyes-js, #body-js, #shadow-js {
        transition: transform 0.2s ease-out;
      }
      #shadow-js {
        transform-origin: 7.5px 15px;
      }
      @keyframes breathe {
        0%, 100% { transform: scale(1, 1); }
        50% { transform: scale(1.018, 0.972); }
      }
      @keyframes eye-blink {
        0%, 10%, 100% { transform: scaleY(1); }
        5% { transform: scaleY(0.1); }
      }
    </style>
  </defs>

  <!-- Ground shadow (the app shifts and stretches it toward the pointer) -->
  <g id="shadow-js">
    ${layer("shadow")}
  </g>

  <!-- 3D body (the app leans it toward the pointer) + CSS breathing -->
  <g id="body-js">
    <g id="torso" class="breathe-anim">
      <!-- Flat vector stand-in, covered by the raster below wherever rasters can load -->
      ${flat("body")}
      ${layer("body")}
      <!-- Eyes: pointer-tracking wrapper + CSS blink -->
      <g id="eyes-js">
        <g class="eyes-blink">
          ${flat("eyes")}
          ${layer("eyes")}
        </g>
      </g>
    </g>
  </g>
</svg>
`);

const theme = {
  schemaVersion: 1,
  name: "Clawd 3D",
  author: "Custom theme (built with Claude Code)",
  version: "1.0.0",
  description: "Clawd, remodelled in 3D — every state, reaction and mini-mode animation re-rendered from a 3D rig.",
  preview: "clawd3d-idle-preview.png",
  rendering: {
    objectChannelFiles: [IDLE],
    discreteSampling: { [IDLE]: 24 },
  },
  customization: { petTint: false },
  viewBox: { x: -15, y: -25, width: 45, height: 45 },
  layout: {
    contentBox: { x: -4, y: -3, width: 23, height: 20 },
    marginBox: { x: -8, y: -7, width: 30, height: 24 },
    centerX: 7.5,
    baselineY: 17,
    visibleHeightRatio: 0.58,
    baselineBottomRatio: 0.05,
  },
  eyeTracking: {
    enabled: true,
    states: ["idle"],
    eyeRatioX: 0.485,
    eyeRatioY: 0.77,
    maxOffset: 1.6,
    bodyScale: 0.33,
    shadowStretch: 0.1,
    shadowShift: 0.3,
    ids: { eyes: "eyes-js", body: "body-js", shadow: "shadow-js" },
    shadowOrigin: "7.5px 15px",
  },
  states: {
    idle: [IDLE],
    roam: [f("crabwalk")],
    yawning: [f("idle-yawn")],
    dozing: [f("idle-doze")],
    collapsing: [f("collapse-sleep")],
    thinking: [f("working-thinking")],
    working: [f("working-typing")],
    juggling: [f("headphones-groove")],
    sweeping: [f("working-sweeping")],
    error: [f("error")],
    attention: [f("happy")],
    notification: [f("notification")],
    carrying: [f("working-carrying")],
    sleeping: [f("sleeping")],
    waking: [f("wake")],
    dizzy: [f("dizzy")],
  },
  workingTiers: [
    { minSessions: 3, file: f("working-building") },
    { minSessions: 2, file: f("headphones-groove") },
    { minSessions: 1, file: f("working-typing") },
  ],
  jugglingTiers: [
    { minSessions: 2, file: f("working-juggling") },
    { minSessions: 1, file: f("headphones-groove") },
  ],
  idleAnimations: [
    { file: f("idle-look"), duration: 6000 },
    { file: f("idle-bubble"), duration: 13500, mirrorOnRightSide: true },
    { file: f("idle-reading"), duration: 16000 },
  ],
  displayHintMap: {
    "claude-design": f("designing"),
    "clawd-working-building.svg": f("working-building"),
    "clawd-working-typing.svg": f("working-typing"),
    "clawd-headphones-groove.svg": f("headphones-groove"),
    "clawd-working-juggling.svg": f("working-juggling"),
    "clawd-working-conducting.svg": f("working-juggling"),
    "clawd-idle-reading.svg": f("idle-reading"),
    "clawd-idle-bubble.svg": f("idle-bubble"),
    "clawd-working-debugger.svg": f("working-debugger"),
    "clawd-working-thinking.svg": f("working-thinking"),
  },
  completionVisualMap: { "claude-design": f("heart-eyes") },
  updateVisuals: { checking: f("working-debugger") },
  timings: {
    minDisplay: { attention: 4000, error: 5000, sweeping: 5500, notification: 5000, carrying: 3000, working: 1000, thinking: 1000 },
    autoReturn: { attention: 4000, error: 5000, sweeping: 300000, notification: 5000, carrying: 3000, dizzy: 6000 },
    yawnDuration: 3600,
    collapseDuration: 1400,
    wakeDuration: 1600,
    deepSleepTimeout: 600000,
    mouseIdleTimeout: 20000,
    mouseSleepTimeout: 60000,
  },
  hitBoxes: {
    default: { x: -1, y: 5, w: 17, h: 12 },
    sleeping: { x: -2, y: 9, w: 19, h: 7 },
    wide: { x: -3, y: 3, w: 21, h: 14 },
  },
  fileHitBoxes: {
    [f("working-typing")]: { x: -2, y: -7, w: 20, h: 25 },
    [f("working-building")]: { x: -1, y: 0, w: 24, h: 17 },
    [f("working-carrying")]: { x: -1, y: 0, w: 17, h: 17 },
  },
  wideHitboxFiles: [f("error"), f("notification")],
  sleepingHitboxFiles: [f("sleeping"), f("collapse-sleep")],
  reactions: {
    drag: { file: f("react-drag") },
    clickLeft: { file: f("react-left"), duration: 2500 },
    clickRight: { file: f("react-right"), duration: 2500 },
    annoyed: { file: f("react-annoyed"), duration: 3500 },
    double: { files: [f("react-double"), f("react-double-jump")], duration: 3500 },
  },
  miniMode: {
    supported: true,
    offsetRatio: 0.486,
    states: {
      "mini-idle": [f("mini-idle")],
      "mini-alert": [f("mini-alert")],
      "mini-happy": [f("mini-happy")],
      "mini-enter": [f("mini-enter")],
      "mini-peek": [f("mini-peek")],
      "mini-working": [f("mini-typing")],
      "mini-crabwalk": [f("crabwalk")],
      "mini-enter-sleep": [f("mini-enter-sleep")],
      "mini-sleep": [f("mini-sleep")],
    },
    timings: {
      minDisplay: { "mini-alert": 4000, "mini-happy": 4000 },
      autoReturn: { "mini-alert": 4000, "mini-happy": 4000 },
    },
  },
  // Mini visuals are mirrored against the left screen edge; this variant keeps the "Z" glyphs readable.
  mirroredFiles: { [f("mini-sleep")]: f("mini-sleep-left") },
  objectScale: { widthRatio: 1.9, heightRatio: 1.3, offsetX: -0.45, offsetY: -0.25 },
};
fs.writeFileSync(path.join(DEST, "theme.json"), JSON.stringify(theme, null, 2) + "\n");

const used = new Set(JSON.stringify(theme).match(/clawd3d-[a-z0-9-]+\.(?:apng|svg|png)/g));
["shadow", "body", "eyes", "preview"].forEach((l) => used.add(`clawd3d-idle-${l}.png`));
const have = new Set(fs.readdirSync(ASSETS));
const missing = [...used].filter((x) => !have.has(x)), extra = [...have].filter((x) => !used.has(x));
console.log(`theme: ${DEST}\nassets: ${have.size} files, ${(fs.readdirSync(ASSETS).reduce((s, x) => s + fs.statSync(path.join(ASSETS, x)).size, 0) / 1048576).toFixed(1)} MB`);
if (missing.length) { console.error("MISSING:", missing); process.exitCode = 1; }
if (extra.length) console.log("unreferenced:", extra);
