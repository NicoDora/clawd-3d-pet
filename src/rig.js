// Clawd 3D — model, materials, rig and props.
// World units are the original sprite's pixel units: the feet rest at the
// origin, +x is screen right, +y is up, +z points at the viewer.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

export const VIEWBOX = { x: -15, y: -25, w: 45, h: 45 };
export const BASE_YAW = -0.22;
const CAM_PITCH = 0.25;
const CAM_FOV = 15;

const C = {
  body: 0xde886d, eye: 0x17110f, white: 0xffffff,
  blue: 0x3f86c9, blueDark: 0x2c5f94, navy: 0x1f2a3c, steel: 0x8c98a6, steelDark: 0x5a6572,
  gold: 0xffc93c, yellow: 0xffd84a, orange: 0xf59a23, red: 0xe5483f, green: 0x4caf50,
  wood: 0x8a5a3b, paper: 0xf6f1e4, pink: 0xf7a8b8, sky: 0x8fd3ff, zz: 0x9aa7b8,
};

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
}
function glow(color, intensity = 1.2, o = {}) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.5, ...o });
}
function rbox(w, h, d, r, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mesh(geo, mat, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadow; m.receiveShadow = shadow;
  return m;
}
function grp(...kids) { const g = new THREE.Group(); kids.forEach((k) => g.add(k)); return g; }
function at(o, x = 0, y = 0, z = 0) { o.position.set(x, y, z); return o; }
function rot(o, x = 0, y = 0, z = 0) { o.rotation.set(x, y, z); return o; }

function shapeGeo(shape, depth, bevel = 0.08) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10,
  });
  g.center();
  return g;
}
function starShape(points, outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
function heartShape(k = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(-1.5 * k, 0.1 * k, -1.0 * k, 1.1 * k, 0, 0.45 * k);
  s.bezierCurveTo(1.0 * k, 1.1 * k, 1.5 * k, 0.1 * k, 0, -0.9 * k);
  return s;
}

export async function createStudio(canvas, px, fontUrl) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(px, px, false);
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // Camera: long lens looking slightly down. Framed so the canvas is exactly
  // the sprite viewBox and the origin lands on the sprite's ground line.
  const camera = new THREE.PerspectiveCamera(CAM_FOV, 1, 10, 600);
  const dist = (VIEWBOX.h / 2) / Math.tan(THREE.MathUtils.degToRad(CAM_FOV / 2));
  const groundSvgY = 15.0; // sprite feet line (bottom of the feet / shadow bar)
  const centerDrop = groundSvgY - (VIEWBOX.y + VIEWBOX.h / 2); // origin below view centre
  const targetY = centerDrop / Math.cos(CAM_PITCH);
  camera.position.set(0, targetY + dist * Math.sin(CAM_PITCH), dist * Math.cos(CAM_PITCH));
  camera.lookAt(0, targetY, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9a48e, 0.95));
  const key = new THREE.DirectionalLight(0xfff4e8, 1.6);
  key.position.set(-9, 30, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -24, right: 24, top: 30, bottom: -14, near: 1, far: 90 });
  key.shadow.radius = 5; key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 0.7);
  rim.position.set(14, 10, -14);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const font = new FontLoader().parse(await (await fetch(fontUrl)).json());
  function text(str, size, depth, mat) {
    const g = new TextGeometry(str, { font, size, depth, curveSegments: 6, bevelEnabled: true, bevelSize: size * 0.035, bevelThickness: size * 0.04, bevelSegments: 2 });
    g.center();
    return mesh(g, mat, false);
  }

  // ------------------------------------------------------------------ rig
  const M = {
    body: std(C.body, { roughness: 0.66 }),
    eye: std(C.eye, { roughness: 0.22 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    heart: std(C.red, { roughness: 0.35 }),
  };
  const TW = 11, TH = 7, TD = 6.6;
  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);          // pivot: torso bottom centre
  const torso = at(rbox(TW, TH, TD, 0.8, M.body), 0, TH / 2, 0);
  body.add(torso);

  function makeArm(sign) {
    const pivot = at(new THREE.Group(), sign * (TW / 2 - 0.1), 3, 0);
    const m = at(rbox(2.2, 2.0, 2.2, 0.5, M.body), sign * 1.0, 0, 0);
    pivot.add(m); pivot.userData.mesh = m; body.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1), armR = makeArm(1);

  const LEG_X = [-4, -2, 2, 4], LEG_Z = [1.5, -1.3, -1.3, 1.5];
  const legs = LEG_X.map((x, i) => {
    const pivot = at(new THREE.Group(), x, 2, LEG_Z[i]);
    const m = at(rbox(1.1, 3.4, 1.3, 0.32, M.body), 0, -0.3, 0); // 2 below the hip + 1.4 hidden in the torso
    pivot.add(m); pivot.userData.mesh = m; root.add(pivot);
    return pivot;
  });

  // face
  const face = at(new THREE.Group(), 0, 4, TD / 2); body.add(face);
  const mouth = at(rbox(1.8, 1.8, 0.5, 0.45, M.eye), 0, -2.2, -0.05); face.add(mouth);
  function makeEye(sign) {
    const g = at(new THREE.Group(), sign * 3, 0, 0);
    const v = {};
    v.rect = grp(at(rbox(1.05, 2.05, 0.6, 0.3, M.eye), 0, 0, 0.05), at(mesh(new THREE.SphereGeometry(0.2, 10, 8), M.hi, false), -0.17, 0.52, 0.34));
    v.dot = grp(at(rbox(1.05, 1.05, 0.6, 0.3, M.eye), 0, 0, 0.05));
    v.wide = grp(at(rbox(1.3, 2.5, 0.6, 0.35, M.eye), 0, 0, 0.05), at(mesh(new THREE.SphereGeometry(0.26, 10, 8), M.hi, false), -0.2, 0.62, 0.34));
    v.dash = grp(at(rbox(1.9, 0.42, 0.5, 0.2, M.eye), 0, -0.25, 0.05));
    const bar = () => rbox(1.5, 0.42, 0.5, 0.2, M.eye);
    v.caret = grp(rot(at(bar(), -0.48, 0, 0.05), 0, 0, 0.75), rot(at(bar(), 0.48, 0, 0.05), 0, 0, -0.75));
    v.chev = grp(rot(at(bar(), 0, 0.42, 0.05), 0, 0, sign * 0.6), rot(at(bar(), 0, -0.42, 0.05), 0, 0, -sign * 0.6));
    v.x = grp(rot(at(rbox(2.0, 0.44, 0.5, 0.2, M.eye), 0, 0, 0.05), 0, 0, 0.785), rot(at(rbox(2.0, 0.44, 0.5, 0.2, M.eye), 0, 0, 0.05), 0, 0, -0.785));
    v.heart = grp(at(mesh(shapeGeo(heartShape(1.0), 0.35, 0.12), M.heart), 0, 0, 0.15));
    const pts = [];
    for (let i = 0; i <= 60; i++) { const a = (i / 60) * Math.PI * 4.4; const r = 0.12 + 0.2 * a / 2.6; pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); }
    v.spiral = grp(at(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.16, 6), M.eye), 0, 0, 0.2));
    Object.values(v).forEach((o) => { o.visible = false; g.add(o); });
    g.userData.v = v; face.add(g);
    return g;
  }
  const eyeL = makeEye(-1), eyeR = makeEye(1);

  // ---------------------------------------------------------------- props
  const P = {};
  const add = (name, obj, parent = scene) => { P[name] = obj; parent.add(obj); return obj; };
  const pool = (name, n, make, parent = scene) => { P[name] = Array.from({ length: n }, (_, i) => { const o = make(i); parent.add(o); return o; }); };

  // glyphs & particles
  const mGold = glow(C.gold, 0.55, { roughness: 0.35 });
  pool("sparkle", 6, (i) => mesh(shapeGeo(starShape(4, 1.5, 0.48), 0.4), glow([C.gold, C.orange, 0xfff3a6][i % 3], 0.6), false));
  pool("star", 3, () => mesh(shapeGeo(starShape(5, 1.25, 0.55), 0.45), mGold, false));
  pool("heartFx", 4, () => mesh(shapeGeo(heartShape(1.1), 0.45, 0.14), glow(C.red, 0.35, { roughness: 0.35, transparent: true }), false));
  pool("zz", 3, (i) => text("Z", 2.2 + i * 0.5, 0.5, std(C.zz, { transparent: true })));
  P.zz.forEach((z) => { z.castShadow = false; });
  add("bangBlue", text("!", 5, 0.9, glow(0x2f8cff, 0.45)));
  add("bangRed", text("!", 5.4, 0.9, glow(0xff3b1f, 0.5)));
  add("question", text("?", 4.4, 0.8, glow(0x5c6f86, 0.2, { transparent: true })));
  add("errorText", text("ERROR", 2.7, 0.55, glow(0xf06a6a, 0.5, { transparent: true })));
  const mDrop = std(C.sky, { roughness: 0.15, transparent: true, opacity: 0.95 });
  const dropGeo = new THREE.LatheGeometry([[0, -0.5], [0.34, -0.36], [0.42, -0.1], [0.3, 0.25], [0.1, 0.62], [0, 0.78]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
  pool("drop", 3, () => mesh(dropGeo, mDrop, false));
  pool("puff", 5, () => mesh(new THREE.IcosahedronGeometry(1, 2), std(0xd9dde3, { transparent: true, opacity: 0.8, roughness: 1 }), false));
  pool("dust", 4, () => mesh(new THREE.IcosahedronGeometry(1, 1), std(0xcdbfae, { transparent: true, opacity: 0.8, roughness: 1 }), false));
  pool("spark", 5, () => mesh(new THREE.OctahedronGeometry(0.42), glow(0xffd65a, 1.6), false));
  pool("bit", 6, (i) => rbox(0.8, 0.8, 0.3, 0.12, glow([0x7fd4ff, 0xb8e6ff][i % 2], 0.8, { transparent: true })));
  P.bit.forEach((b) => { b.castShadow = false; });
  const noteMat = glow(0xffe08a, 0.4);
  pool("note", 2, () => {
    const g = grp(rot(at(mesh(new THREE.SphereGeometry(0.62, 12, 10), noteMat, false), 0, 0, 0), 0, 0, 0.3), at(rbox(0.26, 2.2, 0.26, 0.1, noteMat), 0.5, 1.05, 0), rot(at(rbox(1.2, 0.5, 0.26, 0.1, noteMat), 0.98, 1.95, 0), 0, 0, -0.35));
    g.children[0].scale.set(1, 0.78, 0.8);
    g.traverse((o) => { o.castShadow = false; });
    return g;
  });
  const bubbleMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe9ff, roughness: 0.05, transparent: true, opacity: 0.34, clearcoat: 1, depthWrite: false });
  pool("bubble", 3, () => grp(mesh(new THREE.SphereGeometry(1, 24, 18), bubbleMat, false), at(mesh(new THREE.SphereGeometry(0.2, 8, 6), M.hi, false), -0.42, 0.48, 0.74)));
  pool("pop", 2, () => grp(...[0, 1, 2, 3, 4, 5].map((k) => rot(at(rbox(0.9, 0.24, 0.24, 0.1, glow(0xd8f3ff, 0.9)), Math.cos(k * 1.047) * 1.5, Math.sin(k * 1.047) * 1.5, 0), 0, 0, k * 1.047))));
  P.pop.forEach((g) => g.traverse((o) => { o.castShadow = false; }));

  // thought bubble
  {
    const cloudMat = std(0xfbfdff, { roughness: 0.9 });
    const blobs = [[0, 0, 0, 2.3], [-2.1, -0.2, 0, 1.7], [2.1, -0.15, 0, 1.75], [-1.0, 1.05, 0, 1.7], [1.1, 1.1, 0, 1.6], [0, -0.9, 0.2, 1.8]];
    const cloud = grp(...blobs.map(([x, y, z, r]) => { const m = at(mesh(new THREE.SphereGeometry(r, 20, 14), cloudMat, false), x, y, z); m.scale.z = 0.55; return m; }));
    const dots = [-1.5, 0, 1.5].map((x) => at(mesh(new THREE.SphereGeometry(0.42, 12, 10), std(0x3d7ea6, { roughness: 0.4 }), false), x, 0.05, 1.35));
    const t1 = at(mesh(new THREE.SphereGeometry(0.72, 12, 10), cloudMat, false), 2.4, -3.0, 0);
    const t2 = at(mesh(new THREE.SphereGeometry(0.42, 12, 10), cloudMat, false), 3.3, -4.2, 0);
    const bulbIdea = at(mesh(new THREE.SphereGeometry(0.9, 14, 12), glow(C.yellow, 1.0), false), 0, 0.1, 1.3);
    const g = add("thought", grp(cloud, ...dots, t1, t2, bulbIdea));
    g.userData = { cloud, dots, tails: [t1, t2], bulb: bulbIdea };
  }

  // typing: floating screen + keyboard
  {
    const screen = grp(rbox(9.6, 7.4, 0.7, 0.35, std(0x232733, { roughness: 0.45 })), at(rbox(8.8, 6.6, 0.2, 0.2, std(0x12151d, { roughness: 0.25 })), 0, 0, 0.32));
    const lineSpec = [[0xff6b6b, 0.5, 2.6, 0], [0x4cd97b, 0.5, 1.9, 3.4], [0x4cd97b, 1.3, 0.9, 5.2], [0x5ab0ff, 1.3, 0.2, 2.2], [0xffd166, 0.5, -0.5, 4.2], [0x4cd97b, 1.3, -1.2, 3.0], [0x5ab0ff, 0.5, -1.9, 5.6]];
    const lines = lineSpec.map(([col, indent, y, len]) => {
      const pivot = at(new THREE.Group(), -4.0 + indent, y, 0.46);
      if (len === 0) { // traffic-light dots in the title bar
        [0xff5f57, 0xfebc2e, 0x28c840].forEach((c, k) => pivot.add(at(mesh(new THREE.SphereGeometry(0.2, 8, 6), glow(c, 0.9), false), k * 0.62 - 0.1, 0.25, 0)));
      } else {
        pivot.add(at(rbox(len, 0.36, 0.1, 0.05, glow(col, 0.9)), len / 2, 0, 0));
      }
      pivot.userData.len = len; screen.add(pivot);
      return pivot;
    });
    const cursor = at(rbox(0.34, 0.5, 0.1, 0.05, glow(0xffffff, 1.2)), 0, 0, 0.46); screen.add(cursor);
    screen.traverse((o) => { if (o.isMesh && o.material.emissiveIntensity > 0.5) o.castShadow = false; });
    add("screen", screen).userData = { lines, cursor };

    const kb = grp(at(rbox(13.4, 0.9, 4.6, 0.35, std(0x59626f, { roughness: 0.5 })), 0, 0.45, 0));
    const keyMat = std(0x8d98a6, { roughness: 0.5 });
    const keys = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 10; c++) {
      const k = at(rbox(1.0, 0.36, 1.0, 0.12, keyMat.clone()), -5.55 + c * 1.233, 1.0, -1.35 + r * 1.3);
      k.castShadow = false; kb.add(k); keys.push(k);
    }
    add("keyboard", kb).userData = { keys };
  }

  // mini laptop (seen from behind the lid)
  {
    const lid = at(rbox(8.4, 5.6, 0.5, 0.35, std(0x75869a, { roughness: 0.4, metalness: 0.25 })), 0, 2.8, 0);
    const logo = at(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.2, 20), glow(0x58c7ff, 1.3), false), 0, 2.9, 0.26); logo.rotation.x = Math.PI / 2;
    const base = at(rbox(8.4, 0.5, 4.6, 0.22, std(0x5f6e80, { roughness: 0.45, metalness: 0.25 })), 0, 0.1, -2.2);
    add("laptop", grp(lid, logo, base), body).userData = { logo };
  }

  // headphones (worn on the body)
  {
    const mBand = std(C.blueDark, { roughness: 0.4 }), mCup = std(C.blue, { roughness: 0.35 }), mPad = std(0x24384f, { roughness: 0.8 });
    const band = mesh(new THREE.TorusGeometry(6.35, 0.5, 10, 36, Math.PI), mBand); band.scale.set(1, 0.62, 1); band.position.y = 4.4;
    const cup = (s) => {
      const g = at(new THREE.Group(), s * 6.15, 4.3, 0);
      const c = mesh(new THREE.CylinderGeometry(2.0, 2.0, 1.2, 28), mCup); c.rotation.z = Math.PI / 2;
      const pad = at(mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.5, 28), mPad), -s * 0.7, 0, 0); pad.rotation.z = Math.PI / 2;
      const cap = at(mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.3, 24), std(0x7db6e8, { roughness: 0.3 })), s * 0.68, 0, 0); cap.rotation.z = Math.PI / 2;
      g.add(c, pad, cap); return g;
    };
    const cl = cup(-1), cr = cup(1);
    add("headphones", grp(band, cl, cr), body).userData = { cups: [cl, cr] };
  }

  // juggling balls
  pool("ball", 3, (i) => mesh(new THREE.SphereGeometry(1.0, 24, 18), std([C.red, C.gold, C.green][i], { roughness: 0.3 })));

  // builder: hard hat, hammer, anvil
  {
    const mHat = std(C.orange, { roughness: 0.4 });
    const dome = mesh(new THREE.SphereGeometry(4.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mHat); dome.scale.set(1, 0.72, 0.84);
    const brim = at(mesh(new THREE.CylinderGeometry(5.6, 5.6, 0.45, 36), std(0xe8850f, { roughness: 0.45 })), 0, 0.2, 0.5); brim.scale.z = 0.88;
    const ridge = at(rbox(1.3, 0.8, 7.4, 0.35, std(0xffb648, { roughness: 0.4 })), 0, 3.05, 0); ridge.scale.y = 1;
    const ridgeArc = mesh(new THREE.TorusGeometry(3.45, 0.55, 8, 24, Math.PI), std(0xffb648, { roughness: 0.4 })); ridgeArc.rotation.y = Math.PI / 2; ridgeArc.scale.set(1, 0.95, 1);
    ridge.visible = false;
    add("hardhat", at(grp(dome, brim, ridgeArc), 0, TH - 0.05, 0), body).userData = { fixedScale: 0.9 };

    const handle = at(mesh(new THREE.CylinderGeometry(0.34, 0.38, 6.4, 12), std(C.wood)), 0, 3.2, 0);
    const head = at(rbox(3.4, 1.9, 1.9, 0.3, std(0x8a94a0, { roughness: 0.35, metalness: 0.5 })), 0.2, 6.1, 0);
    add("hammer", grp(handle, head));
    const block = at(rbox(4.4, 1.5, 3.2, 0.25, std(0x66717e, { roughness: 0.45, metalness: 0.4 })), 0, 2.15, 0);
    const neck = at(rbox(2.4, 0.9, 2.0, 0.2, std(0x525c68, { metalness: 0.4, roughness: 0.5 })), 0, 1.0, 0);
    const foot = at(rbox(4.0, 0.7, 3.0, 0.2, std(0x5a6572, { metalness: 0.4, roughness: 0.5 })), 0, 0.35, 0);
    const hot = at(rbox(2.4, 0.5, 1.5, 0.15, glow(0xffb13b, 1.0)), 0, 3.1, 0); hot.castShadow = false;
    add("anvil", grp(block, neck, foot, hot)).userData = { hot };
  }

  // broom
  {
    const handle = at(mesh(new THREE.CylinderGeometry(0.3, 0.3, 9.5, 10), std(C.wood)), 0, 5.6, 0);
    const collar = at(rbox(3.4, 0.7, 1.5, 0.2, std(0xb5462f)), 0, 0.95, 0);
    const bristle = mesh(new THREE.CylinderGeometry(1.5, 2.2, 2.4, 14, 1), std(0xf2b632, { roughness: 0.9 })); bristle.scale.z = 0.45; bristle.position.y = -0.45;
    add("broom", grp(handle, collar, bristle));
  }

  // courier parcel
  {
    const box = rbox(5.6, 5.0, 4.4, 0.3, std(0xc99a64, { roughness: 0.85 }));
    const tape = at(rbox(1.2, 5.06, 4.46, 0.2, std(0xe9d7b0, { roughness: 0.7 })), 0, 0, 0);
    const label = at(rbox(2.0, 1.4, 0.1, 0.05, std(0x3f86c9)), 1.6, -0.9, 2.22);
    add("parcel", grp(box, tape, label), body);
  }

  // magnifying glass
  {
    const ring = mesh(new THREE.TorusGeometry(2.3, 0.42, 12, 32), std(0x4a5563, { roughness: 0.35, metalness: 0.5 }));
    const lens = mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.16, 32), new THREE.MeshPhysicalMaterial({ color: 0xcfeaff, roughness: 0.05, transparent: true, opacity: 0.42, clearcoat: 1, depthWrite: false }), false); lens.rotation.x = Math.PI / 2;
    const glint = rot(at(rbox(1.2, 0.3, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })), -0.8, 0.9, 0.12), 0, 0, 0.7); glint.castShadow = false;
    const handle = rot(at(mesh(new THREE.CylinderGeometry(0.42, 0.42, 3.4, 12), std(C.wood)), 2.75, -2.75, 0), 0, 0, Math.PI / 4);
    const bigEye = at(rbox(1.5, 2.9, 0.3, 0.5, M.eye), 0, 0, -0.5);
    const backing = at(mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 32), std(0xf2a58d, { roughness: 0.7 }), false), 0, 0, -0.75); backing.rotation.x = Math.PI / 2;
    add("magnifier", grp(ring, backing, bigEye, lens, glint, handle), body).userData = { bigEye };
  }

  // reading: glasses + book
  {
    const mFrame = std(0x5b3a29, { roughness: 0.4 });
    const ring = (x) => at(mesh(new THREE.TorusGeometry(1.55, 0.2, 8, 28), mFrame), x, 0, 0);
    add("glasses", at(grp(ring(-3), ring(3), at(rbox(3.0, 0.3, 0.3, 0.1, mFrame), 0, 0.2, 0)), 0, 4.3, TD / 2 + 0.5), body);
    const cover = (s) => { const pv = new THREE.Group(); pv.add(at(rbox(3.6, 5.0, 0.4, 0.15, std(0x2f6f8f, { roughness: 0.6 })), s * 1.8, 0, 0)); pv.add(at(rbox(3.3, 4.6, 0.5, 0.1, std(C.paper, { roughness: 0.9 })), s * 1.75, 0, 0.28)); return pv; };
    const l = cover(-1), r = cover(1);
    const page = new THREE.Group(); page.add(at(rbox(3.2, 4.5, 0.08, 0.03, std(0xfffdf5, { roughness: 0.9, side: THREE.DoubleSide })), 1.65, 0, 0));
    page.position.z = 0.56;
    add("book", grp(l, r, page), body).userData = { l, r, page };
  }

  // bubble wand
  add("wand", grp(mesh(new THREE.TorusGeometry(1.15, 0.24, 8, 24), std(0x3b2f2f, { roughness: 0.4 })), at(mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.0, 8), std(0x3b2f2f)), 0, -2.6, 0)), body);

  // designer: palette + brush
  {
    const s = new THREE.Shape(); s.absellipse(0, 0, 3.6, 3.0, 0, Math.PI * 2);
    const hole = new THREE.Path(); hole.absellipse(1.5, -1.2, 0.75, 0.65, 0, Math.PI * 2); s.holes.push(hole);
    const board = mesh(shapeGeo(s, 0.5, 0.12), std(0xe8c9a0, { roughness: 0.7 }));
    const blobs = [[0xe5483f, -2.2, 0.6], [0xffc93c, -1.0, 1.8], [0x4caf50, 0.7, 1.9], [0x3f86c9, 2.2, 0.9], [0x9b59d0, -1.7, -1.2], [0xffffff, -0.1, -0.2]]
      .map(([c, x, y]) => { const m = at(mesh(new THREE.SphereGeometry(0.62, 12, 8), std(c, { roughness: 0.3 })), x, y, 0.36); m.scale.z = 0.5; return m; });
    add("palette", grp(board, ...blobs), body);
    const handle = at(mesh(new THREE.CylinderGeometry(0.28, 0.36, 5.6, 10), std(0xe84a8a, { roughness: 0.4 })), 0, 2.8, 0);
    const ferrule = at(mesh(new THREE.CylinderGeometry(0.4, 0.34, 1.0, 10), std(0xc9ced6, { metalness: 0.6, roughness: 0.3 })), 0, 6.0, 0);
    const tip = at(mesh(new THREE.ConeGeometry(0.52, 1.6, 12), std(0xff8a3c, { roughness: 0.5 })), 0, 7.2, 0);
    add("brush", grp(handle, ferrule, tip)).userData = { tip };
    pool("dab", 4, (i) => { const m = mesh(new THREE.SphereGeometry(0.7, 12, 8), std([0xe5483f, 0xffc93c, 0x3f86c9, 0x4caf50][i], { roughness: 0.3, transparent: true }), false); return m; });
  }

  // lightbulb
  {
    const glass = mesh(new THREE.SphereGeometry(2.1, 24, 18), glow(0xffd400, 1.0, { roughness: 0.25 }), false); glass.scale.y = 1.08;
    const neck = at(mesh(new THREE.CylinderGeometry(1.0, 1.25, 1.0, 16), glow(0xffb000, 0.5), false), 0, -2.0, 0);
    const baseM = at(mesh(new THREE.CylinderGeometry(0.9, 0.75, 1.3, 14), std(0x9aa3ad, { metalness: 0.6, roughness: 0.35 }), false), 0, -3.0, 0);
    const rays = grp(...Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return rot(at(rbox(1.5, 0.32, 0.32, 0.12, glow(0xfff1a8, 1.2)), Math.cos(a) * 3.7, Math.sin(a) * 3.7 + 0.1, 0), 0, 0, a); }));
    rays.traverse((o) => { o.castShadow = false; });
    add("bulb", grp(glass, neck, baseM, rays)).userData = { rays, glass };
  }
  pool("blueDot", 3, () => mesh(new THREE.SphereGeometry(0.34, 10, 8), glow(0x58a8ff, 1.0), false));

  // ------------------------------------------------------------ controls
  const R = {
    root, body, torso, armL, armR, legs, face, eyeL, eyeR, mouth, P, scene, camera, key, ground,
    TW, TH, TD, LEG_X, LEG_Z,
    reset() {
      root.position.set(0, 0, 0); root.rotation.set(0, BASE_YAW, 0); root.scale.set(1, 1, 1);
      body.position.set(0, 2, 0); body.rotation.set(0, 0, 0); body.scale.set(1, 1, 1);
      torso.scale.set(1, 1, 1); torso.position.set(0, TH / 2, 0);
      for (const a of [armL, armR]) { a.rotation.set(0, 0, 0); a.scale.set(1, 1, 1); a.position.y = 3; a.position.z = 0; a.userData.mesh.scale.set(1, 1, 1); a.userData.mesh.position.x = Math.sign(a.position.x) * 1.0; }
      legs.forEach((l, i) => { l.position.set(LEG_X[i], 2, LEG_Z[i]); l.rotation.set(0, 0, 0); l.scale.set(1, 1, 1); l.visible = true; });
      face.position.set(0, 4.3, TD / 2); face.rotation.set(0, 0, 0); face.scale.set(1, 1, 1);
      for (const e of [eyeL, eyeR]) { e.visible = true; e.scale.set(1, 1, 1); e.rotation.set(0, 0, 0); e.position.y = 0; e.position.z = 0; }
      eyeL.position.x = -3; eyeR.position.x = 3;
      R.eyes("rect");
      mouth.visible = false; mouth.scale.set(1, 1, 1); mouth.position.set(0, -2.2, -0.05);
      for (const v of Object.values(P)) for (const o of Array.isArray(v) ? v : [v]) {
        o.visible = false; o.scale.setScalar(o.userData.fixedScale || 1); o.rotation.set(0, 0, 0);
      }
      ground.material.opacity = 0.3; ground.visible = true;
    },
    // h = height of the torso bottom above the ground; legs follow.
    height(h) {
      body.position.y = h;
      legs.forEach((l) => { l.position.y = Math.max(h, 0.05); l.scale.y = Math.max(h, 0.05) / 2; });
    },
    yaw(a) { root.rotation.y = a; },
    squash(sy, k = 0.5) { const s = 1 + (1 - sy) * k; body.scale.set(s, sy, s); },
    arm(which, raise = 0, fwd = 0, len = 1) {
      const a = which === "L" ? armL : armR, s = which === "L" ? -1 : 1;
      a.rotation.z = s * raise; a.rotation.y = -s * fwd; a.userData.mesh.scale.x = len; a.userData.mesh.position.x = s * (0.1 + 0.9 * len + (len - 1) * 0.2);
    },
    leg(i, swing = 0, side = 0, lift = 0) {
      const l = legs[i]; l.rotation.x = swing; l.rotation.z = side; l.position.y += lift;
    },
    eyes(l, r = l) {
      for (const [e, mode] of [[eyeL, l], [eyeR, r]]) for (const [k, o] of Object.entries(e.userData.v)) o.visible = k === mode;
    },
    blink(s) { eyeL.scale.y = s; eyeR.scale.y = s; },
    look(dx = 0, dy = 0) { face.position.x = dx; face.position.y = 4.3 + dy; },
    show(name, i) { const o = i == null ? P[name] : P[name][i]; o.visible = true; return o; },
    // world position of a point given in body-local coordinates
    bodyPoint(x, y, z) { root.updateMatrixWorld(true); return body.localToWorld(new THREE.Vector3(x, y, z)); },
    handPoint(which, out = 1.6) { root.updateMatrixWorld(true); const a = which === "L" ? armL : armR; return a.localToWorld(new THREE.Vector3((which === "L" ? -1 : 1) * out * a.userData.mesh.scale.x, 0, 0)); },
    faceCamera(o) { o.quaternion.copy(camera.quaternion); },
  };

  // Layer control for the cursor-tracking idle SVG (rendered as separate rasters).
  function setLayer(mode) {
    const eyeSet = new Set(); [eyeL, eyeR].forEach((e) => e.traverse((o) => eyeSet.add(o)));
    root.traverse((o) => {
      if (!o.isMesh) return;
      const isEye = eyeSet.has(o);
      o.material = o.userData.baseMat || (o.userData.baseMat = o.material);
      if (o.userData.baseCast == null) o.userData.baseCast = o.castShadow;
      o.castShadow = o.userData.baseCast && !(isEye && (mode === "body" || mode === "shadow"));
      if (mode === "eyes" && !isEye) o.material = o.userData.hideMat || (o.userData.hideMat = new THREE.MeshBasicMaterial({ colorWrite: false }));
      if ((mode === "body" || mode === "shadow") && isEye) o.material = o.userData.hideMat || (o.userData.hideMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      if (mode === "shadow" && !isEye) o.material = o.userData.castOnly || (o.userData.castOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    });
    if (mode === "body" || mode === "eyes") ground.visible = false;
  }

  R.reset();
  return { renderer, scene, camera, R, setLayer, render: () => renderer.render(scene, camera), THREE };
}
