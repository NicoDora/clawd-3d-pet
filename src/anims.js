// Clawd 3D — every animation is a pure function of time: fn(t, R) poses the
// freshly reset rig, so frames can be rendered in any order and loops close
// exactly (all periods divide the clip duration).
import { BASE_YAW } from "/src/rig.js";

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, u) => a + (b - a) * u;
const E = {
  lin: (u) => u,
  io: (u) => u * u * (3 - 2 * u),
  out: (u) => 1 - (1 - u) ** 3,
  in: (u) => u ** 3,
  back: (u) => 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2,
};
// kf(t, [[time, value, ease?], ...]) — ease shapes the segment that ends at that key
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
      return lerp(v0, v1, (e || E.io)(clamp((t - t0) / (t1 - t0))));
    }
  }
  return keys[keys.length - 1][1];
}
const wave = (t, period, phase = 0) => Math.sin(TAU * (t / period + phase));
const hump = (t, period, phase = 0) => 0.5 - 0.5 * Math.cos(TAU * (t / period + phase)); // 0→1→0
const frac = (x) => x - Math.floor(x);
const bell = (u, a, b, c, d) => clamp((u - a) / (b - a || 1e-6)) * clamp((d - u) / (d - c || 1e-6)); // fade in/out window
function blink(t, period, at = [0.3], len = 0.18) {
  const p = t % period;
  for (const a of at) { const d = p - a; if (d >= 0 && d < len) return 0.1 + 0.9 * Math.abs(1 - (2 * d) / len); }
  return 1;
}
function breathe(R, t, period = 3, amt = 0.03) {
  const u = hump(t, period);
  R.body.scale.set(1 + amt * 0.7 * u, 1 - amt * u, 1 + amt * 0.7 * u);
}
function fx(R, name, i, x, y, z, s = 1) {
  const o = R.show(name, i); o.position.set(x, y, z); o.scale.setScalar(s); R.faceCamera(o); return o;
}
function sparkles(R, t, period, spots) {
  spots.forEach(([x, y, z, delay, size = 1], i) => {
    const u = frac((t - delay) / period);
    if (u > 0.42) return;
    const s = Math.sin((u / 0.42) * Math.PI);
    const o = fx(R, "sparkle", i, x, y, z, s * size); o.rotateZ(u * 2.2);
  });
}
function zzz(R, t, period, ox, oy, oz, dir = -1, flip = false) {
  R.P.zz.forEach((z, i) => {
    const u = frac(t / period + i / 3);
    const o = fx(R, "zz", i, ox + dir * (1 + 5 * u) + Math.sin(u * TAU) * 0.7, oy + 9.5 * u, oz, 0.55 + 0.6 * u);
    o.rotateZ(-dir * 0.18 + Math.sin(u * TAU) * 0.15);
    if (flip) o.scale.x *= -1;
    o.material.opacity = bell(u, 0, 0.15, 0.7, 1);
  });
}
function held(R, name, which, out = 1.5) { const o = R.show(name); o.position.copy(R.handPoint(which, out)); return o; }

// Splooted pose shared by sleeping / collapse / wake / error. k: 0 standing → 1 flat.
function sploot(R, k, breathU = 0, h0 = 2, sy0 = 1, sx0 = 1) {
  const h = lerp(h0, 0, k);
  R.height(h);
  const sy = lerp(sy0, 0.58 - 0.035 * breathU, k), sx = lerp(sx0, 1.2 + 0.02 * breathU, k);
  R.body.scale.set(sx, sy, lerp(1, 1.12, k));
  const legX = [-5.0, -2.2, 2.2, 5.0], legZ = [-2.2, -3.1, -3.1, -2.2], legRz = [-0.9, 0, 0, 0.9];
  R.legs.forEach((l, i) => {
    l.position.set(lerp(R.LEG_X[i], legX[i], k), lerp(Math.max(h, 0.05), 0.62, k), lerp(R.LEG_Z[i], legZ[i], k));
    l.scale.y = lerp(Math.max(h, 0.05) / 2, 1, k);
    l.rotation.x = lerp(0, Math.PI / 2, k); l.rotation.z = lerp(0, legRz[i], k);
  });
  for (const a of [R.armL, R.armR]) a.position.y = lerp(3, 1.3, k);
}
// Mini-mode base pose: leaning out from the right screen edge, no ground.
function mini(R, t, { lean = 0.21, dx = 0, armLen = 2.0, armRaise = 0, breatheP = 4 } = {}) {
  R.ground.visible = false;
  R.yaw(-0.42);
  R.root.rotation.z = lean; R.root.position.x = dx;
  breathe(R, t, breatheP, 0.03);
  R.arm("L", armRaise, 0, armLen);
}

export const ANIMS = {};
const def = (name, dur, fps, fn, extra = {}) => { ANIMS[name] = { dur, fps, fn, ...extra }; };

// ---------------------------------------------------------------- idle family
// Cursor-tracking idle: rendered as stills (body / eyes / shadow) that an SVG
// composes, so the app can still move the eyes toward the pointer.
def("idle", 1, 1, () => {}, { layers: ["body", "eyes", "shadow"] });

def("idle-look", 6, 20, (t, R) => {
  breathe(R, t, 3);
  const yaw = kf(t, [[0, BASE_YAW], [0.5, BASE_YAW], [1.2, 0.55], [2.5, 0.55], [3.3, -0.95], [4.7, -0.95], [5.6, BASE_YAW], [6, BASE_YAW]]);
  R.yaw(yaw);
  R.look(kf(t, [[0, 0], [0.3, 0], [0.8, 0.8], [2.3, 0.6], [2.9, -0.7], [4.6, -0.5], [5.3, 0], [6, 0]]), kf(t, [[0, 0], [3.2, 0], [3.8, 0.35], [4.6, 0.35], [5.2, 0]]));
  R.blink(blink(t, 6, [1.0, 3.1, 5.4]));
  R.body.rotation.z = kf(t, [[0, 0], [1.2, -0.05], [2.5, -0.05], [3.3, 0.06], [4.7, 0.06], [5.6, 0]]);
  // scratch with the left arm while looking the other way
  const s = bell(t, 3.6, 3.9, 4.5, 4.8);
  R.arm("L", s * (1.0 + 0.25 * wave(t, 0.3)), s * 0.5, 1 + s * 0.25);
}, { loop: false });

def("idle-bubble", 4.5, 20, (t, R) => {
  R.yaw(0.25);
  breathe(R, t, 4.5, 0.015);
  const arm = bell(t, 0.1, 0.5, 3.9, 4.3);
  R.arm("R", arm * -0.1, arm * 1.2, 1 + arm * 0.2);
  R.arm("L", -0.25 * arm, 0, 1);
  const wand = R.show("wand");
  wand.position.set(4.0, 1.2 + arm * 1.3, R.TD / 2 + 2.4); wand.rotation.set(0, -0.5, 0.12); wand.scale.setScalar(arm);
  // two breaths: inhale (swell) → blow (squash) while a bubble grows on the wand
  const blows = [0.7, 2.3];
  let puff = 0, inhale = 0;
  blows.forEach((b) => { inhale += bell(t, b, b + 0.3, b + 0.3, b + 0.45); puff += bell(t, b + 0.4, b + 0.55, b + 0.9, b + 1.1); });
  R.body.scale.set(1 + 0.05 * inhale - 0.03 * puff, 1 + 0.05 * inhale - 0.06 * puff, 1 + 0.05 * inhale);
  R.eyes(puff > 0.3 ? "dash" : "rect");
  R.mouth.visible = puff > 0.05; R.mouth.scale.set(0.45 * puff + 0.01, 0.45 * puff + 0.01, 1); R.mouth.position.set(2.2, -1.75, 0);
  R.blink(blink(t, 4.5, [3.9]));
  const w = R.bodyPoint(4.0, 2.5, R.TD / 2 + 2.7);
  blows.forEach((b, i) => {
    const u = (t - (b + 0.4)) / 1.9; // life of this bubble
    if (u < 0 || u > 1) return;
    const grow = clamp(u / 0.3), fly = clamp((u - 0.3) / 0.7);
    const r = lerp(0.3, 1.7 + i * 0.4, E.out(grow));
    if (fly < 0.96) {
      const o = fx(R, "bubble", i, w.x + fly * (6.5 + i * 2) + Math.sin(fly * 6) * 0.5, w.y + fly * fly * (8 + i * 3) + fly * 2, w.z + fly * 1.5, r * (1 + 0.05 * wave(t, 0.5)));
      o.rotateZ(0);
    } else {
      const k = (fly - 0.96) / 0.04;
      fx(R, "pop", i, w.x + 6.5 + i * 2, w.y + 10 + i * 3, w.z + 1.5, 0.9 + k * 0.6);
    }
    if (u > 0.3) R.look(0.9, 0.5 * fly);
  });
});

def("idle-reading", 8, 12, (t, R) => {
  R.yaw(-0.22);
  breathe(R, t, 4, 0.025);
  R.show("glasses");
  const book = R.show("book");
  book.position.set(0, 0.5, R.TD / 2 + 2.9); book.rotation.set(-0.85, 0, 0);
  const { l, r, page } = book.userData;
  l.rotation.y = 0.28; r.rotation.y = -0.28;
  // page turn once per loop
  const flip = kf(t, [[0, 0], [5.6, 0], [6.4, 1], [8, 1]]);
  page.visible = flip > 0 && flip < 1; page.rotation.y = -0.28 - flip * (Math.PI - 0.56);
  R.arm("L", -0.75, 1.2, 1.3); R.arm("R", -0.75 + 0.5 * bell(t, 5.5, 5.8, 6.3, 6.6), 1.2, 1.3);
  // eyes scan lines left→right three times, then jump back
  const scan = frac(t / 2);
  R.look(lerp(-0.9, 0.9, E.io(clamp(scan / 0.85))) * (scan < 0.85 ? 1 : 1 - (scan - 0.85) / 0.15 * 2), -0.55);
  R.blink(blink(t, 8, [1.9, 5.2, 7.3]));
  R.body.rotation.x = 0.1 + 0.03 * wave(t, 4);
  R.P.bit.slice(0, 3).forEach((b, i) => {
    const u = frac(t / 4 + i / 3);
    const o = fx(R, "bit", i, -5 + i * 4.6 + Math.sin(u * TAU) * 0.6, 12 + u * 6, 2, 0.5 + 0.4 * (1 - u));
    o.material.opacity = bell(u, 0, 0.2, 0.6, 1) * 0.9;
  });
});

// ------------------------------------------------------------- sleep sequence
const dozePose = (R, u) => { R.height(1.3); R.body.scale.set(1.05 + 0.02 * u, 0.9 - 0.03 * u, 1.04); R.arm("L", -0.55); R.arm("R", -0.55); R.eyes("dash"); };

def("idle-yawn", 3.6, 20, (t, R) => {
  const open = bell(t, 0.5, 1.2, 2.3, 3.0);       // the yawn itself
  const settle = clamp((t - 2.6) / 1.0);
  R.height(lerp(lerp(2, 2.7, open), 1.3, E.io(settle)));
  R.body.scale.set(lerp(1 - 0.05 * open, 1.05, settle), lerp(1 + 0.1 * open, 0.9, E.io(settle)), lerp(1, 1.04, settle));
  R.body.rotation.x = -0.16 * open;
  const raise = kf(t, [[0, 0], [0.5, 0.2], [1.2, 1.25], [2.2, 1.25 + 0.08 * wave(t, 0.5)], [3.1, -0.55], [3.6, -0.55]]);
  R.arm("L", raise, 0, 1 + open * 0.35); R.arm("R", raise, 0, 1 + open * 0.35);
  R.eyes(t > 0.55 ? "dash" : "rect");
  if (t < 0.55) R.blink(kf(t, [[0, 1], [0.3, 1], [0.55, 0.2]]));
  R.mouth.visible = open > 0.03; R.mouth.scale.set(0.4 + 0.75 * open, 0.25 + 1.0 * open, 1); R.mouth.position.set(0, -2.0, 0);
  const tu = (t - 1.9) / 1.2;
  if (tu > 0 && tu < 1) {
    const p = R.bodyPoint(-4.2, 4.4 - tu * 2.5, R.TD / 2 + 0.5);
    const d = fx(R, "drop", 0, p.x, p.y, p.z, 0.9 * bell(tu, 0, 0.2, 0.8, 1));
    d.material.opacity = 0.95;
  }
}, { loop: false });

def("idle-doze", 4, 12, (t, R) => {
  const u = hump(t, 4);
  dozePose(R, u);
  R.body.rotation.x = 0.05 + 0.05 * u; R.body.rotation.z = 0.025 * wave(t, 4);
});

def("collapse-sleep", 1.4, 20, (t, R) => {
  const k = kf(t, [[0, 0], [0.75, 1.08, E.in], [0.95, 0.96], [1.15, 1.0], [1.4, 1.0]]);
  const c = clamp(k);
  sploot(R, c, 0, 1.3, 0.9, 1.05);
  const o = k - c;                                          // overshoot squish on landing
  R.body.scale.y *= 1 - o * 1.6; R.body.scale.x *= 1 + o;
  R.arm("L", lerp(-0.55, 0, c)); R.arm("R", lerp(-0.55, 0, c));
  R.eyes("dash");
}, { loop: false });

def("sleeping", 6, 12, (t, R) => {
  sploot(R, 1, hump(t, 3));
  R.eyes("dash");
  zzz(R, t, 6, 4.5, 6, 1, 1);
});

def("wake", 1.6, 20, (t, R) => {
  const k = kf(t, [[0, 1], [0.25, 1], [0.6, 0, E.out], [1.6, 0]]);
  sploot(R, k);
  const hop = bell(t, 0.42, 0.7, 0.75, 1.0);
  R.root.position.y = 3.2 * hop;
  const st = bell(t, 0.4, 0.62, 0.7, 0.95), land = bell(t, 0.98, 1.08, 1.1, 1.3);
  if (k === 0) R.body.scale.set(1 - 0.08 * st + 0.08 * land, 1 + 0.14 * st - 0.14 * land, 1);
  const raise = kf(t, [[0, 0], [0.4, 0], [0.7, 1.2], [1.0, 1.1], [1.4, 0], [1.6, 0]]);
  R.arm("L", raise); R.arm("R", raise);
  R.eyes(t < 0.22 ? "dash" : t < 1.0 ? "wide" : "rect");
  R.blink(blink(t, 1.6, [1.15], 0.14));
  R.body.rotation.z = 0.07 * wave(t, 0.22) * bell(t, 1.0, 1.1, 1.25, 1.45);
}, { loop: false });

// ------------------------------------------------------------------- working
def("working-thinking", 8, 15, (t, R) => {
  R.yaw(-0.5);
  breathe(R, t, 4, 0.025);
  R.body.rotation.z = 0.1 + 0.02 * wave(t, 4);
  R.arm("R", 0.75 + 0.06 * wave(t, 2), 1.25, 1.35);          // hand on chin
  R.arm("L", -0.35);
  R.leg(3, 0, 0, 0.55 * Math.max(0, wave(t, 0.5)) * bell(frac(t / 4), 0.1, 0.2, 0.5, 0.6)); // idle foot tap
  const life = bell(t, 0.2, 0.7, 7.3, 7.9);
  const idea = bell(t, 5.9, 6.2, 7.2, 7.5);
  R.look(-0.9 * (1 - idea), 0.55);
  R.eyes(idea > 0.5 ? "caret" : "rect");
  R.blink(blink(t, 8, [2.4, 4.8]));
  const th = R.show("thought");
  th.position.set(-9, 19.5 + 0.4 * wave(t, 4), 2); R.faceCamera(th);
  const { cloud, dots, tails, bulb } = th.userData;
  cloud.scale.setScalar(E.back(clamp(life)) * (1 + 0.08 * idea));
  tails.forEach((d, i) => d.scale.setScalar(clamp((t - 0.1 - (1 - i) * 0.12) / 0.3) * clamp((7.9 - t) / 0.3)));
  const step = Math.floor(frac(t / 2.4) * 4);
  dots.forEach((d, i) => { d.visible = life > 0.9 && idea < 0.2 && i < step; d.position.y = 0.05 + (i === step - 1 ? 0.25 * hump(t, 0.6) : 0); });
  bulb.visible = idea > 0.05; bulb.scale.setScalar(E.back(clamp(idea)) * (1 + 0.1 * wave(t, 0.4)));
});

def("working-typing", 3, 20, (t, R) => {
  R.yaw(-0.14);
  R.height(2 + 0.12 * hump(t, 0.5));
  R.body.rotation.x = 0.12;
  R.arm("L", -0.42 + 0.3 * Math.max(0, wave(t, 0.3)), 1.15, 1.2);
  R.arm("R", -0.42 + 0.3 * Math.max(0, wave(t, 0.25, 0.4)), 1.15, 1.2);
  R.look(0.8 * wave(t, 3), -0.35);
  R.blink(blink(t, 3, [1.4]));
  const kb = R.show("keyboard"); kb.position.set(-0.6, 0, 7.6); kb.rotation.set(0.1, -0.14, 0);
  kb.userData.keys.forEach((k, i) => {
    const on = frac(t / (0.5 + (i % 5) * 0.1) + i * 0.37) < 0.22 && (i * 7) % 4 === 0;
    k.material.color.set(on ? 0xffffff : 0x8d98a6); k.material.emissive.set(on ? 0x9fd8ff : 0x000000); k.position.y = on ? 0.88 : 1.0;
  });
  const sc = R.show("screen"); sc.position.set(-1.2, 17.6 + 0.25 * wave(t, 3), -2.5); sc.rotation.set(-0.08, -0.14, 0);
  sc.userData.lines.forEach((ln, i) => {
    if (!ln.userData.len) return;
    const start = 0.15 + (i - 1) * 0.42;
    ln.scale.x = Math.max(0.001, clamp((t - start) / 0.38)) * (t > 2.8 ? clamp((3 - t) / 0.2) : 1);
    ln.visible = t > start;
  });
  const cl = sc.userData.cursor;
  const row = clamp(Math.floor((t - 0.15) / 0.42), 0, 5), ln = sc.userData.lines[row + 1];
  cl.position.set(ln.position.x + ln.userData.len * ln.scale.x + 0.35, ln.position.y, 0.46); cl.visible = frac(t / 0.5) < 0.6;
  R.P.bit.slice(0, 4).forEach((b, i) => {
    const u = frac(t / 1.5 + i / 4);
    const o = fx(R, "bit", i, -6.5 + i * 3.6 + Math.sin(u * 5 + i) * 0.5, 21.5 + u * 5.5, -3.5, 0.5 + 0.35 * (1 - u));
    o.material.opacity = bell(u, 0, 0.2, 0.55, 1) * 0.9;
  });
});

def("headphones-groove", 1.6, 20, (t, R) => {
  R.yaw(-0.25 + 0.16 * wave(t, 1.6));
  const bounce = hump(t, 0.8);
  R.height(2 - 0.5 * bounce);
  R.body.scale.set(1 + 0.03 * bounce, 1 - 0.05 * bounce, 1 + 0.03 * bounce);
  R.body.rotation.z = 0.15 * wave(t, 1.6);
  R.arm("L", 0.35 + 0.65 * wave(t, 0.8), 0.3); R.arm("R", 0.35 - 0.65 * wave(t, 0.8), 0.3);
  R.leg(0, 0, 0, 0.5 * Math.max(0, wave(t, 1.6))); R.leg(3, 0, 0, 0.5 * Math.max(0, -wave(t, 1.6)));
  R.eyes("caret");
  const hp = R.show("headphones");
  hp.userData.cups.forEach((c, i) => c.scale.setScalar(1 + 0.07 * hump(t, 0.4)));
  R.P.note.forEach((n, i) => {
    const u = frac(t / 1.6 + i * 0.5), s = i ? 1 : -1;
    const o = fx(R, "note", i, s * (9.5 + 3 * u), 9 + 8 * u, 1, 1.1 * bell(u, 0, 0.15, 0.7, 1));
    o.rotateZ(s * (-0.3 + 0.5 * u));
  });
});

def("working-juggling", 1.2, 20, (t, R) => {
  R.yaw(-0.12);
  breathe(R, t, 1.2, 0.02);
  R.body.rotation.z = 0.05 * wave(t, 1.2);
  // right hand throws at phase 0, left hand half a beat later
  R.arm("R", 0.25 + 0.4 * hump(t, 0.4), 0.55, 1.15); R.arm("L", 0.25 + 0.4 * hump(t, 0.4, 0.5), 0.55, 1.15);
  R.look(0.5 * wave(t, 1.2), 0.75);
  R.P.ball.forEach((b, i) => {
    const u = frac(t / 1.2 + i / 3), half = u < 0.5, v = half ? u * 2 : (u - 0.5) * 2;
    const dir = half ? 1 : -1;
    b.visible = true;
    b.position.set(dir * lerp(7.2, -7.2, v), 6.6 + 13 * 4 * v * (1 - v) * (0.82 + 0.06 * i), R.TD / 2 + 0.2);
    b.rotation.set(t * 6, t * 4 + i, 0);
  });
});

def("working-building", 1.2, 20, (t, R) => {
  R.yaw(0.3);
  R.show("hardhat");
  const swing = kf(t, [[0, -1.8], [0.12, -1.55], [0.6, 0.7, E.out], [0.82, 0.8], [1.0, -1.8, E.in], [1.2, -1.8]]);
  const hit = bell(t, 1.0, 1.02, 1.05, 1.2) + bell(t, 0, 0, 0.04, 0.16);
  R.height(2 - 0.4 * hit);
  R.body.scale.set(1 + 0.04 * hit, 1 - 0.07 * hit, 1 + 0.04 * hit);
  R.body.rotation.z = -0.05 - 0.06 * hit + 0.05 * clamp((swing + 1.8) / 2.6);
  R.arm("R", 0.3 + (swing + 1.8) * 0.42, 0.25, 1.2);
  R.arm("L", -0.2 + 0.2 * hit);
  R.look(0.9, -0.2 - 0.3 * hit);
  R.blink(hit > 0.5 ? 0.2 : 1);
  const hm = held(R, "hammer", "R", 1.3); hm.rotation.set(0, 0.25, swing);
  const an = R.show("anvil"); an.position.set(13.4, 0, 2.2); an.rotation.y = 0.3;
  an.userData.hot.material.emissiveIntensity = 0.5 + 1.6 * hit;
  R.P.spark.forEach((s, i) => {
    const u = t / 0.45; if (u > 1) return;
    const a = -0.4 + i * 0.85;
    const o = fx(R, "spark", i, 13 + Math.cos(a) * (1 + 5 * u), 3.6 + Math.sin(a) * 5 * u + 3 * u - 6 * u * u, 2.6 + (i % 2 ? 1 : -1) * u * 1.5, 1 - u);
    o.rotateZ(u * 5 + i);
  });
});

def("working-sweeping", 4, 20, (t, R) => {
  R.yaw(-0.75);
  const work = bell(t, 0, 0.2, 2.9, 3.1);
  const s = wave(t, 1) * work;                              // broom stroke
  breathe(R, t, 4, 0.02);
  R.body.rotation.z = 0.1 * work + 0.04 * s;
  R.root.position.x = 0.5 * s;
  R.arm("L", -0.25 + 0.15 * s, 0.9, 1.2 + 0.1 * s);
  // wipe the brow during the pause
  const wipe = bell(t, 3.0, 3.25, 3.7, 3.95);
  R.arm("R", lerp(-0.2 - 0.12 * s, 1.15 + 0.12 * wave(t, 0.35), wipe), lerp(0.9, 1.2, wipe), 1.2);
  R.eyes(wipe > 0.5 ? "dash" : "rect");
  R.look(-0.6 * work, -0.4 * work);
  R.blink(blink(t, 4, [1.6]));
  const br = R.show("broom");
  br.position.set(-8.6 + 2.6 * s, 1.5, 4.6); br.rotation.set(0.1, 0, -0.25 + 0.3 * s);
  R.P.dust.forEach((d, i) => {
    const u = frac(t - 0.25 - i * 0.25);
    if (work < 0.9 || u > 0.7) return;
    const o = fx(R, "dust", i, -12.5 - 3.5 * u - i * 0.4, 0.8 + 2.4 * u, 4.6 + (i - 1.5) * 0.9, 0.45 + 0.8 * u);
    o.material.opacity = 0.75 * (1 - u / 0.7);
  });
  if (wipe > 0.1) {
    [0, 1].forEach((i) => {
      const u = frac((t - 3.05) / 0.9 + i * 0.4);
      const p = R.bodyPoint(5.6 + u * 3.2, 7.8 + u * 2.2 - u * u * 3.5, 2);
      fx(R, "drop", i, p.x, p.y, p.z, 0.9 * wipe * (1 - u));
    });
  }
});

def("working-carrying", 2.4, 20, (t, R) => {
  R.yaw(0.62);
  const st = wave(t, 0.4), bob = hump(t, 0.2);
  R.height(2 - 0.35 * bob);
  R.body.rotation.z = -0.07 + 0.03 * st;
  R.body.rotation.x = 0.06;
  [0, 1, 2, 3].forEach((i) => { const ph = i % 2 ? -st : st; R.leg(i, 0.5 * ph, 0, 0.55 * Math.max(0, ph)); });
  R.arm("L", 1.25 + 0.04 * st, 0.15, 1.5); R.arm("R", 1.25 - 0.04 * st, 0.15, 1.5);
  const box = R.show("parcel");
  box.position.set(0, R.TH + 2.75 + 0.28 * hump(t, 0.2, 0.3), 0); box.rotation.set(0, 0, 0.05 * wave(t, 0.4, 0.2));
  const strain = bell(frac(t / 2.4), 0.5, 0.56, 0.86, 0.92);
  R.eyes(strain > 0.5 ? "chev" : "rect");
  R.look(1.0, -0.1);
  R.blink(blink(t, 2.4, [0.5]));
  if (strain > 0.2) [0, 1].forEach((i) => {
    const u = frac((t - 1.2) / 0.6 + i * 0.5);
    const p = R.bodyPoint(-5.8 - u * 3.5, 6.2 + u * 3 - u * u * 4, 1 + i * 1.5);
    fx(R, "drop", i, p.x, p.y, p.z, 0.9 * strain * (1 - u));
  });
});

def("working-debugger", 6, 15, (t, R) => {
  // hunched detective sneak, sweeping the magnifier left ↔ right
  const sweep = wave(t, 6);
  R.yaw(-0.15 + 0.6 * sweep);
  R.height(1.35 + 0.15 * hump(t, 0.5));
  R.body.rotation.x = 0.2; R.body.rotation.z = 0.03 * wave(t, 1);
  R.root.position.x = 1.6 * sweep;
  [0, 1, 2, 3].forEach((i) => { const ph = wave(t, 1, i % 2 ? 0.5 : 0); R.leg(i, 0, 0.18 * ph, 0.5 * Math.max(0, ph)); });
  R.arm("R", 0.5, 1.35, 1.25); R.arm("L", -0.3 + 0.1 * wave(t, 1), 0.3);
  const mg = R.show("magnifier");
  mg.position.set(3.0, 4.1 + 0.15 * wave(t, 1.5), R.TD / 2 + 2.6); mg.rotation.set(0, 0, 0.1 * wave(t, 3));
  mg.userData.bigEye.scale.y = blink(t, 6, [2.2, 4.9]);
  R.eyeR.visible = false; R.eyes("dash", "rect"); R.eyeL.position.y = 0.1;
  R.look(0.5 * sweep, -0.3);
});

def("designing", 3, 20, (t, R) => {
  R.yaw(-0.1);
  breathe(R, t, 3, 0.025);
  R.body.rotation.z = 0.04 * wave(t, 3);
  R.arm("L", 0.15, 0.9, 1.2);
  const pal = R.show("palette"); pal.position.set(-8.6, 3.6 + 0.2 * wave(t, 3), R.TD / 2 + 1.6); pal.rotation.set(-0.35, 0.35, 0.2);
  // brush paints three strokes in the air
  R.arm("R", 0.85 + 0.12 * wave(t, 1, 0.25), 0.5, 1.3);
  const br = held(R, "brush", "R", 1.4);
  br.rotation.set(0.1, 0, -0.55 + 0.25 * wave(t, 1));
  R.look(0.8, 0.5);
  R.eyes(frac(t / 3) > 0.82 ? "caret" : "rect");
  R.P.dab.forEach((d, i) => {
    const u = frac(t / 3 - i * 0.25);
    const a = i * 1.7;
    const o = fx(R, "dab", i, 11.5 + Math.cos(a) * 3.2, 17.2 + Math.sin(a) * 2.2, 3, 0.9 * E.back(clamp(u / 0.15)));
    o.scale.z *= 0.4; o.material.opacity = clamp((1 - u) / 0.3);
  });
});

def("heart-eyes", 3, 20, (t, R) => {
  R.yaw(-0.2 + 0.08 * wave(t, 3));
  const beat = Math.max(0, wave(t, 0.75)) ** 2;
  R.height(2 + 0.25 * hump(t, 1.5));
  R.body.scale.set(1 + 0.02 * beat, 1 + 0.02 * beat, 1);
  R.body.rotation.z = 0.07 * wave(t, 1.5);
  R.arm("L", 0.55 + 0.1 * wave(t, 0.75), 0.9, 1.1); R.arm("R", 0.55 + 0.1 * wave(t, 0.75), 0.9, 1.1);
  R.eyes("heart");
  R.eyeL.scale.setScalar(1 + 0.22 * beat); R.eyeR.scale.setScalar(1 + 0.22 * beat);
  R.P.heartFx.forEach((h, i) => {
    const u = frac(t / 3 + i / 4), sx = [-7.5, 6.5, -3, 8.5][i];
    const o = fx(R, "heartFx", i, sx + Math.sin(u * TAU + i) * 1.1, 10.5 + u * 10, 2, (0.55 + 0.25 * (i % 2)) * bell(u, 0, 0.18, 0.6, 1));
    o.material.opacity = bell(u, 0, 0.15, 0.6, 1);
  });
});

// -------------------------------------------------------------- notifications
def("error", 3.2, 20, (t, R) => {
  R.yaw(-0.22);
  sploot(R, 1, hump(t, 1.6));
  R.eyes("x");
  R.arm("R", 0.9 + 0.5 * wave(t, 0.8), 0.6, 1.25);        // fanning itself
  R.arm("L", 0);
  const tx = R.show("errorText"); tx.position.set(0, 13.2 + 0.2 * wave(t, 1.6), 1.5); R.faceCamera(tx);
  tx.material.opacity = 0.35 + 0.65 * hump(t, 0.8); tx.material.emissiveIntensity = 0.25 + 0.6 * hump(t, 0.8);
  R.P.puff.slice(0, 4).forEach((p, i) => {
    const u = frac(t / 3.2 + i / 4);
    const o = fx(R, "puff", i, -1.5 + Math.sin(u * 5 + i * 2) * 1.4 + (i % 2 ? 1.6 : -1.2), 17 + u * 9, -2.5, 0.7 + 1.3 * u);
    o.material.opacity = 0.75 * bell(u, 0, 0.12, 0.45, 1);
  });
});

def("happy", 3, 20, (t, R) => {
  const j = frac(t);                                       // one jump per second
  const yy = kf(j, [[0, 0], [0.16, 0], [0.42, 1, E.out], [0.5, 1], [0.72, 0, E.in], [1, 0]]);
  const sq = bell(j, 0.04, 0.14, 0.16, 0.24) + bell(j, 0.72, 0.76, 0.8, 0.94);
  const stretch = bell(j, 0.16, 0.28, 0.3, 0.45);
  R.root.position.y = 9 * yy;
  R.body.scale.set(1 + 0.1 * sq - 0.05 * stretch, 1 - 0.17 * sq + 0.08 * stretch, 1 + 0.1 * sq - 0.05 * stretch);
  R.height(2 - 0.6 * sq);
  // the middle jump is a full spin
  const spin = t >= 1 && t < 2 ? E.io(clamp((j - 0.14) / 0.62)) * TAU : 0;
  R.yaw(-0.18 + spin);
  const w = wave(t, 0.3);
  R.arm("L", 0.95 + 0.4 * w, 0.2, 1.15); R.arm("R", 0.95 - 0.4 * w, 0.2, 1.15);
  R.legs.forEach((l, i) => { l.rotation.z = (i < 2 ? -1 : 1) * 0.3 * yy; });
  R.eyes(yy > 0.35 ? "caret" : "rect");
  R.blink(blink(t, 3, [0.05, 2.05], 0.12));
  sparkles(R, t, 1.5, [[-12, 18, 2, 0, 1], [11, 22, -1, 0.3, 0.85], [13, 9, 3, 0.6, 0.7], [-13, 7, 3, 0.9, 0.75], [0, 26, 0, 1.2, 0.9], [-8, 12, 4, 0.75, 0.6]]);
});

def("notification", 5, 20, (t, R) => {
  R.yaw(-0.12);
  const up = kf(t, [[0, 0], [0.15, 0], [0.7, 1, E.back], [4.2, 1], [4.8, 0], [5, 0]]);
  const lit = bell(t, 0.75, 0.95, 4.05, 4.3);
  breathe(R, t, 2.5, 0.02);
  R.height(2 + 0.3 * lit * hump(t, 0.625));
  R.body.rotation.z = -0.13 * up + 0.03 * lit * wave(t, 1.25);
  R.arm("R", 1.3 * up, 0.15, 1 + 0.45 * up);
  R.arm("L", -0.25 * up + 0.2 * lit * wave(t, 0.625));
  R.leg(0, 0, 0, 0.5 * up); R.leg(1, 0, 0, 0.25 * up);
  R.eyes(lit > 0.5 ? "caret" : "rect");
  R.look(0.9 * (up - lit), 0.7 * (up - lit));
  R.blink(blink(t, 5, [4.5]));
  if (up > 0.02) {
    const h = R.handPoint("R", 1.7);
    const b = R.show("bulb");
    b.position.set(h.x + 0.6, h.y + 3.6 * up + 0.35 * wave(t, 1.25) * lit, h.z + 1); b.scale.setScalar(E.back(clamp(up)));
    R.faceCamera(b); b.rotateZ(-0.2);
    b.userData.glass.material.emissiveIntensity = 0.15 + 1.25 * lit;
    b.userData.rays.visible = lit > 0.05; b.userData.rays.rotation.z = t * 0.9;
    b.userData.rays.scale.setScalar(lit * (1 + 0.12 * wave(t, 0.625)));
  }
});

def("dizzy", 3, 20, (t, R) => {
  const a = TAU * t / 3;
  R.yaw(-0.15 + 0.22 * Math.sin(a));
  R.body.rotation.z = 0.2 * Math.cos(a); R.body.rotation.x = 0.16 * Math.sin(a);
  R.root.position.x = 0.9 * Math.cos(a);
  R.height(2 - 0.25 * hump(t, 1.5));
  R.arm("L", -0.35 + 0.3 * wave(t, 1.5), 0.2); R.arm("R", -0.35 + 0.3 * wave(t, 1.5, 0.5), 0.2);
  R.legs.forEach((l, i) => { l.rotation.z = 0.15 * Math.cos(a + i); });
  R.eyes("spiral");
  R.eyeL.rotation.z = -TAU * t / 0.75; R.eyeR.rotation.z = TAU * t / 0.75;
  R.eyeL.scale.setScalar(1.25); R.eyeR.scale.setScalar(1.25);
  const c = R.bodyPoint(0, R.TH + 2.4, 0);
  R.P.star.forEach((s, i) => {
    const b = -a * 2 + i * TAU / 3;
    const o = fx(R, "star", i, c.x + Math.cos(b) * 6.6, c.y + 0.7 * Math.sin(b * 2 + i), c.z + Math.sin(b) * 4.2, 0.85);
    o.rotateZ(b * 1.5);
  });
  R.P.blueDot.forEach((d, i) => {
    const u = frac(t / 1.5 + i / 3); if (u > 0.5) return;
    fx(R, "blueDot", i, c.x + [-5, 4, 0.5][i], c.y + 2.2 + [0, 1.6, 3][i], c.z + 2, Math.sin(u * TAU));
  });
});

// ------------------------------------------------------------------ reactions
def("react-drag", 2.4, 20, (t, R) => {
  R.ground.material.opacity = 0.12;
  R.yaw(-0.2 + 0.25 * wave(t, 2.4));
  R.root.position.y = 2.6 + 0.4 * wave(t, 1.2);
  R.root.rotation.z = 0.2 * wave(t, 2.4);
  R.body.scale.set(0.97, 1.05, 0.97);
  R.arm("L", 0.7 + 0.6 * wave(t, 0.4), 0.2, 1.15); R.arm("R", 0.7 - 0.6 * wave(t, 0.4), 0.2, 1.15);
  R.legs.forEach((l, i) => { l.scale.y = 1.25; l.rotation.z = 0.35 * wave(t, 0.6, i * 0.25) - 0.2 * wave(t, 2.4); l.rotation.x = 0.25 * wave(t, 0.6, i * 0.25 + 0.3); });
  R.eyes("chev");
});

const reactLook = (dir) => (t, R) => {
  breathe(R, t, 2.5, 0.02);
  const k = kf(t, [[0, 0], [0.1, -0.15], [0.45, 1, E.back], [1.7, 1], [2.25, 0], [2.5, 0]]);
  R.yaw(BASE_YAW + (dir * 0.85 - BASE_YAW * 0.4) * k);
  R.body.rotation.z = -dir * 0.1 * k;
  R.look(dir * 0.6 * clamp(k), 0.2 * clamp(k));
  R.blink(blink(t, 2.5, [0.7, 1.9], 0.14));
  const hop = bell(t, 0.1, 0.22, 0.24, 0.4);
  R.root.position.y = 1.2 * hop;
  R.arm(dir < 0 ? "L" : "R", 0.5 * clamp(k), 0.3 * clamp(k));
  const q = bell(t, 0.35, 0.55, 1.6, 1.9);
  if (q > 0.02) { const o = fx(R, "question", null, dir * 9.5, 14.5 + 1.2 * E.out(clamp((t - 0.35) / 0.5)), 2, E.back(clamp(q)) * 1.0); o.rotateZ(dir * 0.2 + 0.1 * wave(t, 0.8)); o.material.opacity = clamp(q * 1.5); }
};
def("react-left", 2.5, 20, reactLook(-1), { loop: false });
def("react-right", 2.5, 20, reactLook(1), { loop: false });

def("react-annoyed", 3.5, 20, (t, R) => {
  breathe(R, t, 3.5, 0.02);
  const k = kf(t, [[0, 0], [0.3, 1, E.out], [2.7, 1], [3.3, 0], [3.5, 0]]);
  R.yaw(lerp(BASE_YAW, 0.05, k));
  R.body.rotation.x = 0.1 * k; R.body.rotation.z = 0.05 * k;
  R.eyes(k > 0.5 ? "dash" : "rect");
  R.eyeL.rotation.z = -0.28 * k; R.eyeR.rotation.z = 0.28 * k;        // angry slant
  R.arm("L", -0.45 * k, 0.5 * k); R.arm("R", -0.45 * k, 0.5 * k);
  const stomp = bell(t, 0.5, 0.6, 1.5, 1.6);
  R.leg(3, 0, 0, 0.8 * Math.max(0, wave(t, 0.33)) * stomp);
  R.height(2 - 0.15 * Math.max(0, -wave(t, 0.33)) * stomp);
  // huff
  [0, 1].forEach((i) => {
    const u = (t - 1.55 - i * 0.18) / 1.0; if (u < 0 || u > 1) return;
    const p = R.bodyPoint((i ? 1 : -1) * 5 + (i ? 1 : -1) * 3.5 * u, 6.6 + 2.5 * u, 2.5);
    const o = fx(R, "puff", i, p.x, p.y, p.z, 0.5 + 0.9 * u); o.material.opacity = 0.8 * (1 - u);
  });
  const sigh = bell(t, 1.5, 1.7, 2.0, 2.4);
  R.body.scale.set(1 + 0.04 * sigh, 1 - 0.06 * sigh, 1);
}, { loop: false });

def("react-double", 3.5, 20, (t, R) => {
  const k = bell(t, 0, 0.15, 2.7, 3.2);
  R.yaw(BASE_YAW + 0.12 * wave(t, 0.5) * k);
  const hop = bell(t, 0.05, 0.2, 0.22, 0.42);
  R.root.position.y = 2.4 * hop;
  R.root.position.x = 0.35 * wave(t, 0.1) * bell(t, 0.4, 0.5, 2.2, 2.7);       // shiver
  R.body.scale.set(1 - 0.04 * k, 1 + 0.06 * k, 1);
  R.eyes(k > 0.5 ? "dot" : "rect");
  R.look(1.2 * wave(t, 0.6) * k, 0.2 * k);
  R.arm("L", 0.9 * k + 0.1 * wave(t, 0.2) * k, 0.2); R.arm("R", 0.9 * k - 0.1 * wave(t, 0.2) * k, 0.2);
  R.blink(blink(t, 3.5, [3.25], 0.14));
  const q = bell(t, 0.1, 0.3, 2.3, 2.7);
  if (q > 0.02) { const o = fx(R, "bangBlue", null, 0.5, 17 + 0.5 * wave(t, 0.5), 1, E.back(clamp(q))); o.rotateZ(0.08 * wave(t, 0.25)); }
}, { loop: false });

def("react-double-jump", 3.5, 20, (t, R) => {
  const yy = kf(t, [[0, 0], [0.12, 0], [0.5, 1, E.out], [0.62, 1], [0.95, 0, E.in], [3.5, 0]]);
  const sq = bell(t, 0.02, 0.1, 0.12, 0.2) + bell(t, 0.95, 1.0, 1.05, 1.3);
  R.root.position.y = 10 * yy;
  R.body.scale.set(1 + 0.12 * sq, 1 - 0.2 * sq, 1 + 0.12 * sq);
  R.height(2 - 0.7 * sq);
  R.yaw(BASE_YAW + E.io(clamp((t - 0.12) / 0.8)) * TAU);
  const air = yy > 0.1;
  R.eyes(air ? "chev" : t > 0.95 && t < 2.3 ? "dot" : "rect");
  R.arm("L", air ? 1.2 : 0.6 * bell(t, 0.95, 1.1, 2.0, 2.5), 0.2, 1.1); R.arm("R", air ? 1.2 : 0.6 * bell(t, 0.95, 1.1, 2.0, 2.5), 0.2, 1.1);
  R.legs.forEach((l, i) => { l.rotation.z = (i < 2 ? -1 : 1) * 0.4 * yy; });
  R.look(0.8 * wave(t, 0.7) * bell(t, 1.2, 1.4, 2.2, 2.5), 0);
  R.body.rotation.z = 0.06 * wave(t, 0.2) * bell(t, 1.0, 1.1, 1.5, 1.8);
  R.blink(blink(t, 3.5, [2.6, 3.1], 0.14));
  const q = bell(t, 0.15, 0.3, 1.5, 1.9);
  if (q > 0.02) fx(R, "bangRed", null, 9.5, 19 + 2 * yy, 1, E.back(clamp(q))).rotateZ(-0.25);
}, { loop: false });

// ------------------------------------------------------------ walk (roam/mini)
def("crabwalk", 1, 20, (t, R) => {
  R.yaw(0.38);
  const bob = hump(t, 0.5);
  R.height(1.55 + 0.3 * bob);
  R.body.rotation.z = -0.09 + 0.03 * wave(t, 1);
  R.body.rotation.x = 0.05;
  R.root.position.x = 0.25 * wave(t, 0.5);
  [0, 1, 2, 3].forEach((i) => { const ph = wave(t, 0.5, i % 2 ? 0.5 : 0); R.leg(i, 0, -0.32 * ph, 0.65 * Math.max(0, ph)); });
  R.arm("L", 0.15 + 0.3 * wave(t, 0.5), 0.3); R.arm("R", 0.15 - 0.3 * wave(t, 0.5), 0.3);
  R.look(1.1, 0);
  R.blink(blink(t, 1, [0.6], 0.15));
});

// ---------------------------------------------------------------------- mini
def("mini-idle", 4, 12, (t, R) => {
  mini(R, t, { armRaise: 0.08 * wave(t, 4) });
  R.blink(blink(t, 4, [1.2]));
});

def("mini-peek", 3, 20, (t, R) => {
  mini(R, t, { breatheP: 3, dx: -1.2, lean: 0.25, armLen: 1.9, armRaise: 0.55 + 0.4 * wave(t, 0.6) });
  R.arm("L", 0.55 + 0.4 * wave(t, 0.6), 0.25, 1.9);
  R.eyes(frac(t / 3) > 0.7 ? "caret" : "rect");
  R.blink(blink(t, 3, [0.9]));
});

def("mini-alert", 4, 20, (t, R) => {
  const k = bell(frac(t / 4), 0.02, 0.1, 0.8, 0.95);
  mini(R, t, { armRaise: 0.9 * k + 0.25 * wave(t, 0.4) * k, lean: 0.21 + 0.03 * k });
  R.root.position.y = 0.8 * bell(frac(t / 4), 0.02, 0.1, 0.12, 0.25);
  R.eyes(frac(t / 4) < 0.3 ? "chev" : "wide");
  R.look(-0.8 * k, 0.3 * k);
  const f = 0.55 + 0.45 * hump(t, 0.5);
  const b = fx(R, "bangRed", null, -13.5, 12 + 0.6 * wave(t, 1), 2, k * (0.95 + 0.1 * hump(t, 0.5)));
  b.material.emissiveIntensity = f;
});

def("mini-happy", 3, 20, (t, R) => {
  mini(R, t, { breatheP: 3, armRaise: 0.75 + 0.45 * wave(t, 0.5) });
  R.arm("L", 0.75 + 0.45 * wave(t, 0.5), 0.2, 2.0);
  R.root.position.y = 0.7 * hump(t, 0.75);
  R.eyes("caret");
  sparkles(R, t, 1.5, [[-13, 16, 2, 0, 1], [-9.5, 9.5, 3, 0.75, 0.7]]);
});

const miniEnter = (asleep) => (t, R) => {
  const dx = kf(t, [[0, 26], [0.58, -3, E.out], [0.78, 1.4], [0.98, -0.6], [1.2, 0], [3.2, 0]]);
  const wv = asleep ? 0 : bell(t, 0.9, 1.2, 2.5, 2.9);
  mini(R, t, { dx, breatheP: 3.2, armRaise: asleep ? -0.25 * clamp((t - 1) / 1.5) : wv * (0.7 + 0.4 * wave(t, 0.5)) });
  R.root.rotation.z = 0.21 + 0.06 * clamp(dx / 26) - 0.03 * bell(t, 0.5, 0.6, 0.7, 1.0);
  if (asleep) R.eyes("dash"); else { R.blink(blink(t, 3.2, [1.4, 3.0], 0.15)); R.look(-0.8 * bell(t, 0.3, 0.6, 2.4, 2.9), 0); }
};
def("mini-enter", 3.2, 20, miniEnter(false), { loop: false });
def("mini-enter-sleep", 3.2, 20, miniEnter(true), { loop: false });

const miniSleep = (flip) => (t, R) => {
  mini(R, t, { breatheP: 6, armRaise: -0.25 + 0.05 * wave(t, 6) });
  const u = hump(t, 3);
  R.body.scale.set(1 + 0.025 * u, 1 - 0.04 * u, 1);
  R.eyes("dash");
  zzz(R, t, 6, -8.5, 10.5, 2, -1, flip);
};
def("mini-sleep", 6, 12, miniSleep(false));
def("mini-sleep-left", 6, 12, miniSleep(true));

def("mini-typing", 1.2, 20, (t, R) => {
  mini(R, t, { breatheP: 1.2, armLen: 1.25 });
  R.arm("L", -0.25 + 0.3 * Math.max(0, wave(t, 0.3)), 1.2, 1.25);
  R.arm("R", -0.25 + 0.3 * Math.max(0, wave(t, 0.4, 0.3)), 1.2, 1.25);
  const lp = R.show("laptop"); lp.position.set(-0.6, -2.6, R.TD / 2 + 3.4); lp.rotation.set(-0.16, 0, 0);
  lp.userData.logo.material.emissiveIntensity = 0.7 + 0.9 * hump(t, 1.2);
  R.look(0.5 * wave(t, 1.2), -0.5);
  R.blink(blink(t, 1.2, [0.7], 0.15));
  R.P.bit.slice(0, 4).forEach((b, i) => {
    const u = frac(t / 1.2 + i / 4);
    const o = fx(R, "bit", i, -11 - u * 3 + i * 1.2, 9 + u * 7 + i, 3, 0.45 + 0.3 * (1 - u));
    o.material.opacity = bell(u, 0, 0.2, 0.5, 1) * 0.9;
  });
});

// QA helpers (not exported to the theme)
def("rest", 1, 1, () => {}, { qa: true });
