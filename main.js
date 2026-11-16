/* =====================================================================
   NEUROTECH v5 – scrolling 3D site (Three.js r128)
   ===================================================================== */

/* ---------- Renderer, scene, camera ---------- */
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05070f, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05070f, 0.01);
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(0, 2, 34);

// Wheel does not zoom (so the page scrolls); zoom uses the buttons in the top bar.
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.enableZoom = false;
controls.rotateSpeed = 0.6;

scene.add(new THREE.AmbientLight(0x7090ff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
keyLight.position.set(10, 20, 15);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x27d3ff, 2.0, 300);
cyanLight.position.set(15, 15, 25);
scene.add(cyanLight);
const pinkLight = new THREE.PointLight(0xff5c8a, 1.4, 300);
pinkLight.position.set(-20, -10, -10);
scene.add(pinkLight);

/* ---------- Helpers ---------- */
const glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.2, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function makeGlow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false
  }));
  s.scale.set(size, size, 1);
  return s;
}
function labelSprite(text, scale = 3.4, color = "#e8edff") {
  const c = document.createElement("canvas");
  const g = c.getContext("2d");
  const font = "600 56px Inter, system-ui, sans-serif";
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 40;
  c.width = w; c.height = 96;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = 12;
  g.fillText(text, w / 2, 50);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }));
  const sizeY = scale * 0.3;
  s.scale.set(sizeY * w / 96, sizeY, 1);
  s.renderOrder = 10;
  return s;
}

// Simple 3D value noise, used to make the brain's folds
function hash3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0,0,0), c(1,0,0), u), L(c(0,1,0), c(1,1,0), u), v),
           L(L(c(0,0,1), c(1,0,1), u), L(c(0,1,1), c(1,1,1), u), v), w);
}

/* Groups */
const bgGroup = new THREE.Group();      scene.add(bgGroup);
const heroGroup = new THREE.Group();    scene.add(heroGroup);
const bioGroup = new THREE.Group();     bioGroup.visible = false; scene.add(bioGroup);
const annGroup = new THREE.Group();     annGroup.visible = false; scene.add(annGroup);
const brainGroup = new THREE.Group();   brainGroup.visible = false; scene.add(brainGroup);
const compNetGroup = new THREE.Group(); compNetGroup.visible = false; scene.add(compNetGroup);

function makePulseSet(group, edges, color, count, size) {
  const items = [];
  for (let k = 0; k < count; k++) {
    const s = makeGlow(color, size);
    group.add(s);
    items.push({ s, e: Math.floor(Math.random() * edges.length), t: Math.random(), v: 0.25 + Math.random() * 0.5 });
  }
  return { edges, items };
}
function updatePulseSet(set, dt) {
  if (!set.edges.length) return;
  set.items.forEach(p => {
    p.t += dt * p.v;
    if (p.t > 1) { p.t = 0; p.e = Math.floor(Math.random() * set.edges.length); }
    const ed = set.edges[p.e];
    p.s.position.lerpVectors(ed.a, ed.b, p.t);
  });
}

/* Stars */
(function buildStars() {
  const N = 900, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 180;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 120;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 140 - 30;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  bgGroup.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x7fb8ff, size: 0.2, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false
  })));
})();

/* ---------- Home: glowing neural sphere ---------- */
const heroPts = [];
const HERO_N = 170, HERO_R = 11, GOLDEN = Math.PI * (3 - Math.sqrt(5));
for (let i = 0; i < HERO_N; i++) {
  const y = 1 - (i / (HERO_N - 1)) * 2;
  const r = Math.sqrt(1 - y * y);
  const th = GOLDEN * i;
  heroPts.push(new THREE.Vector3(Math.cos(th) * r * HERO_R, y * HERO_R, Math.sin(th) * r * HERO_R));
}
const heroEdgeObjs = [];
for (let i = 0; i < HERO_N; i++)
  for (let j = i + 1; j < HERO_N; j++)
    if (heroPts[i].distanceTo(heroPts[j]) < 4.3) heroEdgeObjs.push({ a: heroPts[i], b: heroPts[j] });
const heroPos = new Float32Array(heroEdgeObjs.length * 6);
heroEdgeObjs.forEach((ed, k) => heroPos.set([ed.a.x, ed.a.y, ed.a.z, ed.b.x, ed.b.y, ed.b.z], k * 6));
const heroEdgeGeo = new THREE.BufferGeometry();
heroEdgeGeo.setAttribute("position", new THREE.BufferAttribute(heroPos, 3));
heroGroup.add(new THREE.LineSegments(heroEdgeGeo, new THREE.LineBasicMaterial({ color: 0x27d3ff, transparent: true, opacity: 0.16 })));
const heroNodeGeo = new THREE.SphereGeometry(0.12, 10, 10);
const heroNodeMat = new THREE.MeshBasicMaterial({ color: 0x9be9ff });
heroPts.forEach(p => { const m = new THREE.Mesh(heroNodeGeo, heroNodeMat); m.position.copy(p); heroGroup.add(m); });
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(5.2, 2),
  new THREE.MeshBasicMaterial({ color: 0x27d3ff, wireframe: true, transparent: true, opacity: 0.12 }));
heroGroup.add(shell);
heroGroup.add(makeGlow(0x27d3ff, 14));
const heroPulseSet = makePulseSet(heroGroup, heroEdgeObjs, 0xffd166, 80, 0.9);

/* ---------- Biology: 3D neuron ---------- */
const bioPick = [];
function addPart(mesh, part) { mesh.userData.part = part; bioGroup.add(mesh); bioPick.push(mesh); return mesh; }
function tubeMesh(points, radius, material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 48, radius, 12, false), material);
}
const M = {
  soma:    new THREE.MeshStandardMaterial({ color: 0x2d5bff, emissive: 0x12308a, roughness: 0.25, metalness: 0.3 }),
  nucleus: new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0x7a1f4f, roughness: 0.3 }),
  dend:    new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x0b3a5c, roughness: 0.35 }),
  axon:    new THREE.MeshStandardMaterial({ color: 0xc7d2fe, emissive: 0x1e1b4b, roughness: 0.4 }),
  myelin:  new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0x4a3500, roughness: 0.5 }),
  term:    new THREE.MeshStandardMaterial({ color: 0xf9a8d4, emissive: 0x5a1538, roughness: 0.4 }),
  next:    new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: 0x0a1020, roughness: 0.6 })
};
addPart(new THREE.Mesh(new THREE.SphereGeometry(2.2, 48, 48), M.soma), "soma");
const nucleus = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), M.nucleus);
nucleus.position.set(0.3, 0.2, 0.4);
addPart(nucleus, "soma");
bioGroup.add(makeGlow(0x2d5bff, 11));
const DIRS = [[-1,0.7,0.4],[-1,-0.6,0.5],[-1,0.2,-0.7],[-1,-0.3,-0.2],[-0.8,1,0],[-0.8,-1,0.1],[-0.9,0.1,0.9]];
DIRS.forEach((d, i) => {
  const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
  const off = new THREE.Vector3(0, 0.6 * Math.sin(i * 1.7), 0.6 * Math.cos(i * 1.7));
  const p1 = dir.clone().multiplyScalar(5).add(off);
  addPart(tubeMesh([dir.clone().multiplyScalar(2.1), p1,
    dir.clone().multiplyScalar(7.6).add(off.clone().multiplyScalar(1.4)), dir.clone().multiplyScalar(9.8)], 0.22, M.dend), "dendrites");
  addPart(tubeMesh([p1.clone(),
    p1.clone().add(new THREE.Vector3(-1.4, 1.2 * Math.sin(i), 0.7)),
    p1.clone().add(new THREE.Vector3(-2.6, 1.8 * Math.sin(i), 1.2))], 0.12, M.dend), "dendrites");
});
const axonCurve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(2.2,0,0), new THREE.Vector3(6,0.4,0), new THREE.Vector3(10,-0.3,0.4),
  new THREE.Vector3(14,0.2,-0.2), new THREE.Vector3(18,0,0), new THREE.Vector3(20.5,0,0)]);
addPart(new THREE.Mesh(new THREE.TubeGeometry(axonCurve, 160, 0.14, 12, false), M.axon), "axon");
[[0.08,0.22],[0.28,0.42],[0.48,0.62],[0.68,0.82]].forEach(([u0,u1]) => {
  const p0 = axonCurve.getPointAt(u0), p1 = axonCurve.getPointAt(u1);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, p0.distanceTo(p1) * 0.9, 28), M.myelin);
  cyl.position.copy(p0).add(p1).multiplyScalar(0.5);
  cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), p1.clone().sub(p0).normalize());
  addPart(cyl, "myelin");
});
const axonEnd = axonCurve.getPointAt(1);
[[2.6,1.8,1.3],[3.0,0,-0.4],[2.5,-1.6,1.4],[2.2,-2.4,-1.2]].forEach(o => {
  const end = axonEnd.clone().add(new THREE.Vector3(o[0], o[1], o[2]));
  addPart(tubeMesh([axonEnd.clone(), axonEnd.clone().lerp(end, 0.5).add(new THREE.Vector3(0,0.3,0)), end], 0.1, M.axon), "terminals");
  const bulb = addPart(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), M.term), "terminals");
  bulb.position.copy(end);
});
const synRing = addPart(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 16, 48), M.term), "synapse");
synRing.position.set(axonEnd.x + 3.2, 0, 0); synRing.rotation.y = Math.PI / 2;
const nextCell = addPart(new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), M.next), "synapse");
nextCell.position.set(axonEnd.x + 6.4, 0, 0);
const impulse = makeGlow(0xffd166, 2.6);
impulse.visible = false;
bioGroup.add(impulse);
let impulseT = -1;

/* ---------- Network 3-3-1 ---------- */
const annNodes = {}, annPick = [];
function makeNeuron(key, x, y, label) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x27d3ff, emissive: 0x000000, roughness: 0.3, metalness: 0.2 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 32, 32), mat);
  mesh.position.set(x, y, 0);
  mesh.userData.key = key;
  annGroup.add(mesh); annPick.push(mesh);
  const halo = makeGlow(0x27d3ff, 4.2);
  halo.position.set(x, y, 0);
  annGroup.add(halo);
  const tag = labelSprite(label, 2.6);
  tag.position.set(x, y - 1.9, 0);
  annGroup.add(tag);
  annNodes[key] = { mat, halo };
}
const IN_Y = [4, 0, -4], HID_Y = [4.5, 0, -4.5];
IN_Y.forEach((y, i) => makeNeuron("in" + (i + 1), -8, y, "x" + (i + 1)));
HID_Y.forEach((y, j) => makeNeuron("h" + (j + 1), 0, y, "h" + (j + 1)));
makeNeuron("out", 8, 0, "y");
function makeEdge(a, b) {
  const mat = new THREE.LineBasicMaterial({ color: 0x27d3ff, transparent: true, opacity: 0.3 });
  annGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
  return { mat, a, b };
}
const wEdges = [], vEdges = [], flatEdges = [];
for (let j = 0; j < 3; j++) {
  wEdges[j] = [];
  for (let i = 0; i < 3; i++) {
    const e = makeEdge(new THREE.Vector3(-8, IN_Y[i], 0), new THREE.Vector3(0, HID_Y[j], 0));
    wEdges[j][i] = e; flatEdges.push(e);
  }
}
for (let j = 0; j < 3; j++) { vEdges[j] = makeEdge(new THREE.Vector3(0, HID_Y[j], 0), new THREE.Vector3(8, 0, 0)); flatEdges.push(vEdges[j]); }
const annPulses = flatEdges.map(() => { const s = makeGlow(0xffd166, 1.6); annGroup.add(s); return s; });

/* ---------- Brain (compare section) ---------- */
const brainModel = new THREE.Group();
brainModel.scale.setScalar(2.0);
brainGroup.add(brainModel);

function buildCortexGeometry() {
  const geo = new THREE.SphereGeometry(1, 180, 140);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const sulcus = new THREE.Color(0x6e3a52), gyrus = new THREE.Color(0xf0b2c4), tmp = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let X = v.x * 1.5, Y = v.y * 0.95, Z = v.z * 1.2;
    // Groove between the two hemispheres
    if (Y > 0) Y -= 0.38 * Math.exp(-X * X * 6) * Y;
    // Temporal lobes hang lower at the sides
    if (Y < 0 && Math.abs(X) > 0.6) Y -= 0.2 * (Math.abs(X) - 0.6) * (-Y);
    // Flatter underside
    if (Y < -0.45) Y = -0.45 + (Y + 0.45) * 0.35;
    // Narrower at the back
    if (Z < -0.3) X *= 0.88;
    // Folds (gyri = raised ridges, sulci = darker grooves)
    const len = Math.sqrt(X * X + Y * Y + Z * Z) || 1;
    const nx = X / len, ny = Y / len, nz = Z / len;
    const n1 = vnoise(X * 2.2 + 3, Y * 2.2, Z * 2.2) * 2 - 1;
    const n2 = vnoise(X * 5.5, Y * 5.5 + 7, Z * 5.5) * 2 - 1;
    const f = 0.65 * n1 + 0.35 * n2;
    const d = 0.13 * f;
    X += nx * d; Y += ny * d; Z += nz * d;
    p.setXYZ(i, X, Y, Z);
    tmp.copy(sulcus).lerp(gyrus, Math.min(1, Math.max(0, 0.55 + f * 1.1)));
    colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
const cortex = new THREE.Mesh(buildCortexGeometry(), new THREE.MeshStandardMaterial({
  vertexColors: true, roughness: 0.75, metalness: 0.0, emissive: 0x1a0712, emissiveIntensity: 0.5
}));
brainModel.add(cortex);

// Cerebellum: small, striped, sits behind and below the cortex
const cerebGeo = new THREE.SphereGeometry(0.5, 64, 48);
const cerebCount = cerebGeo.attributes.position.count;
const cerebColors = new Float32Array(cerebCount * 3);
for (let i = 0; i < cerebCount; i++) {
  const s = 0.5 + 0.5 * Math.sin(cerebGeo.attributes.position.getY(i) * 40);
  cerebColors.set([0.9 * (0.6 + 0.4 * s), 0.5 * (0.6 + 0.4 * s), 0.62 * (0.6 + 0.4 * s)], i * 3);
}
cerebGeo.setAttribute("color", new THREE.BufferAttribute(cerebColors, 3));
const cerebellum = new THREE.Mesh(cerebGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
cerebellum.position.set(0, -0.62, -0.92);
cerebellum.scale.set(1.25, 0.6, 0.85);
brainModel.add(cerebellum);

// Brainstem: attached to the underside of the cortex
const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.95, 24),
  new THREE.MeshStandardMaterial({ color: 0xd98aa3, roughness: 0.6 }));
stem.position.set(0, -0.95, -0.2);
stem.rotation.x = -0.2;
brainModel.add(stem);

// Linked neurons inside the brain
const innerPts = [];
let guard = 0;
while (innerPts.length < 110 && guard++ < 30000) {
  const x = (Math.random() * 2 - 1) * 1.2, y = (Math.random() * 2 - 1) * 0.7, z = (Math.random() * 2 - 1) * 0.95;
  if ((x / 1.2) ** 2 + (y / 0.7) ** 2 + (z / 0.95) ** 2 < 0.8) innerPts.push(new THREE.Vector3(x, y, z));
}
const innerEdges = [];
for (let i = 0; i < innerPts.length; i++)
  for (let j = i + 1; j < innerPts.length; j++)
    if (innerPts[i].distanceTo(innerPts[j]) < 0.5) innerEdges.push({ a: innerPts[i], b: innerPts[j] });
const innerPos = new Float32Array(innerEdges.length * 6);
innerEdges.forEach((ed, k) => innerPos.set([ed.a.x, ed.a.y, ed.a.z, ed.b.x, ed.b.y, ed.b.z], k * 6));
const innerGeo = new THREE.BufferGeometry();
innerGeo.setAttribute("position", new THREE.BufferAttribute(innerPos, 3));
brainModel.add(new THREE.LineSegments(innerGeo, new THREE.LineBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.35 })));
brainModel.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(innerPts), new THREE.PointsMaterial({
  color: 0xffe9a8, size: 0.06, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false
})));
// Only a few signals, so they are easy to see
const brainPulses = makePulseSet(brainModel, innerEdges, 0xffd166, 12, 0.22);

// Part labels, placed beside each part of the brain
[
  ["Frontal lobe", 0.6, 1.5, 3.4], ["Parietal lobe", 0, 2.9, -0.4], ["Temporal lobe", 3.9, -1.2, 0.4],
  ["Occipital lobe", 0.9, 0.3, -3.5], ["Cerebellum", 2.4, -1.9, -2.2], ["Brainstem", 1.3, -3.0, -0.2]
].forEach(([t, x, y, z]) => {
  const s = labelSprite(t, 3.0, "#ffd166");
  s.position.set(x, y, z);
  brainGroup.add(s);
});

/* ---------- Computer neural network (compare section) ---------- */
const chip = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.3, 3.0),
  new THREE.MeshStandardMaterial({ color: 0x101a33, roughness: 0.35, metalness: 0.7 }));
chip.position.set(0, 6.2, 0);
compNetGroup.add(chip);
const chipEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.0, 0.3, 3.0)),
  new THREE.LineBasicMaterial({ color: 0x27d3ff }));
chip.add(chipEdges);
compNetGroup.add(labelSprite("Processor (CPU / GPU)", 4.2, "#27d3ff").translateY(0).translateY(8.4));

const NET_LAYERS = [
  { x: -6, ys: [-2.4, 0, 2.4], name: "Input layer" },
  { x: 0, ys: [-3.6, -1.2, 1.2, 3.6], name: "Hidden layer" },
  { x: 6, ys: [-1.2, 1.2], name: "Output layer" }
];
const netNodePos = NET_LAYERS.map(L => L.ys.map(y => new THREE.Vector3(L.x, y, 0)));
const compNetEdges = [];
for (let l = 0; l < NET_LAYERS.length - 1; l++)
  netNodePos[l].forEach(a => netNodePos[l + 1].forEach(b => {
    const mat = new THREE.LineBasicMaterial({ color: 0x27d3ff, transparent: true, opacity: 0.4 });
    compNetGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), mat));
    compNetEdges.push({ a, b });
  }));
netNodePos.forEach(layer => layer.forEach(p => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 28, 28),
    new THREE.MeshStandardMaterial({ color: 0x27d3ff, emissive: 0x0b4a66, roughness: 0.3 }));
  m.position.copy(p);
  compNetGroup.add(m);
  compNetGroup.add(makeGlow(0x27d3ff, 2.6).translateX(p.x).translateY(p.y));
}));
NET_LAYERS.forEach(L => {
  const t = labelSprite(L.name, 3.2);
  t.position.set(L.x, -5.6, 0);
  compNetGroup.add(t);
});
const compNetPulses = makePulseSet(compNetGroup, compNetEdges, 0xffd166, 12, 0.9);

/* ---------- Selection marker ---------- */
const selHalo = makeGlow(0xff5c8a, 6);
selHalo.visible = false;
scene.add(selHalo);

/* ---------- Camera views (one per section) ---------- */
const VIEWS = {
  home:     { pos: [0, 2, 34], look: [0, 0, 0],  shift: 0.2 },
  neuron:   { pos: [5, 3, 34], look: [5, 0, 0],  shift: 0.22 },
  network:  { pos: [0, 0, 26], look: [0, 0, 0],  shift: 0.24 },
  sim:      { pos: [0, 0, 26], look: [0, 0, 0],  shift: 0.26 },
  brain:    { pos: [0, 0, 26], look: [0, 0, 0],  shift: 0.24 },
  compnet:  { pos: [0, 1, 26], look: [0, 1, 0],  shift: 0.24 },
  features: { pos: [0, 0, 50], look: [0, 0, 0],  shift: 0 }
};
const goalPos = new THREE.Vector3(), goalLook = new THREE.Vector3();
let goalShift = 0, shift = 0, transition = 0, currentView = null, flowing = false, phase = 0;

function setView(key) {
  currentView = key;
  const v = VIEWS[key];
  goalPos.set(...v.pos);
  goalLook.set(...v.look);
  goalShift = v.shift;
  transition = 120;
  heroGroup.visible = key === "home" || key === "features";
  bioGroup.visible = key === "neuron";
  annGroup.visible = key === "network" || key === "sim";
  brainGroup.visible = key === "brain";
  compNetGroup.visible = key === "compnet";
  selHalo.visible = false;
  impulseT = -1;
  // The network animation runs automatically when you open the network or simulation section
  flowing = key === "network" || key === "sim";
  phase = 0;
}
function setActiveNav(group) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.group === group));
}
document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  const sec = document.querySelector(`.sec[data-group="${btn.dataset.group}"]`);
  if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
}));

const sections = Array.from(document.querySelectorAll(".sec"));
function sectionInCentre() {
  const mid = window.innerHeight / 2;
  let best = null, bestDist = Infinity;
  sections.forEach(s => {
    const r = s.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const d = Math.abs((r.top + r.bottom) / 2 - mid);
    if (d < bestDist) { bestDist = d; best = s; }
  });
  return best;
}
let scrollQueued = false;
window.addEventListener("scroll", () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false;
    const sec = sectionInCentre();
    if (sec && sec.dataset.view !== currentView) {
      setView(sec.dataset.view);
      setActiveNav(sec.dataset.group);
    }
  });
}, { passive: true });

function zoomBy(factor) {
  const dir = camera.position.clone().sub(controls.target);
  dir.setLength(Math.max(6, Math.min(70, dir.length() * factor)));
  camera.position.copy(controls.target.clone().add(dir));
  transition = 0;
}
document.getElementById("zoom-in").addEventListener("click", () => zoomBy(0.8));
document.getElementById("zoom-out").addEventListener("click", () => zoomBy(1.25));
document.getElementById("zoom-reset").addEventListener("click", () => { if (currentView) setView(currentView); });

/* ---------- Info text ---------- */
const BIO = {
  dendrites: { title: "Dendrites", text: "Branching extensions that receive messages from other neurons. Receptors on them open ion channels when a neurotransmitter lands. One neuron can have thousands of branches, so it can collect input from many sources at once." },
  soma: { title: "Cell body (soma)", text: "The control centre. It holds the nucleus (the DNA) and adds up all incoming signals. If the voltage reaches the threshold of about −55 mV, it triggers an action potential." },
  axon: { title: "Axon", text: "A long, thin cable that carries the impulse away from the cell body. Some axons are around a metre long. The impulse is regenerated along the way, so it does not fade." },
  myelin: { title: "Myelin sheath", text: "A fatty layer made by support cells that wraps the axon in segments. It insulates the axon, so the impulse jumps between the gaps. This makes conduction many times faster than in a bare axon." },
  terminals: { title: "Axon terminals", text: "The branched endings of the axon. They contain vesicles filled with neurotransmitter. When the impulse arrives, calcium enters and the vesicles release their contents into the gap." },
  synapse: { title: "Synapse", text: "The junction between two cells, with a gap of about 20 nanometres. The chemical message crosses the gap and binds receptors on the next cell, pushing it toward firing (excitatory) or away from firing (inhibitory)." }
};
const ANN = {
  in1: { title: "Input neuron x1", text: "Receives the first number from the outside world, such as a pixel brightness. It does not calculate. It passes its value on, multiplied by each weight that leaves it." },
  in2: { title: "Input neuron x2", text: "Receives the second number. Its effect on the hidden neurons depends on the three weights that start from it." },
  in3: { title: "Input neuron x3", text: "Receives the third number. It sends its value along three weighted connections, one to each hidden neuron." },
  h1: { title: "Hidden neuron h1", text: "Multiplies each input by its own weight, adds its bias, and passes the total through the sigmoid. The result between 0 and 1 says how strongly this neuron's pattern is present." },
  h2: { title: "Hidden neuron h2", text: "Works like h1 with a different set of weights, so it responds to a different combination of inputs. Hidden neurons are where the network finds useful patterns." },
  h3: { title: "Hidden neuron h3", text: "The third pattern detector. Its weights decide which inputs matter to it." },
  out: { title: "Output neuron y", text: "Combines h1, h2 and h3 using the output weights, adds a bias, and applies the sigmoid. The final value between 0 and 1 is the network's answer, which is compared with the target." }
};
function showInfo(kind, key) {
  const info = (kind === "bio" ? BIO : ANN)[key];
  if (!info) return;
  document.getElementById(kind === "bio" ? "bio-info" : "ann-info").innerHTML = `<h4>${info.title}</h4><p>${info.text}</p>`;
}
document.querySelectorAll("[data-bio]").forEach(b => b.addEventListener("click", () => showInfo("bio", b.dataset.bio)));
document.querySelectorAll("[data-ann]").forEach(b => b.addEventListener("click", () => showInfo("ann", b.dataset.ann)));

/* ---------- 3D picking ---------- */
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2();
let downAt = null;
function pickAt(e) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  let list = [];
  if (bioGroup.visible) list = bioPick;
  else if (annGroup.visible) list = annPick;
  if (!list.length) return null;
  const hits = raycaster.intersectObjects(list, false);
  return hits.length ? hits[0].object : null;
}
window.addEventListener("pointermove", e => {
  if (e.target !== canvas) { document.body.style.cursor = ""; return; }
  document.body.style.cursor = pickAt(e) ? "pointer" : "";
});
window.addEventListener("pointerdown", e => { downAt = { x: e.clientX, y: e.clientY }; });
window.addEventListener("pointerup", e => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 6 || e.target !== canvas) return;
  const obj = pickAt(e);
  if (obj) select(obj);
});
function select(obj) {
  const isBio = bioGroup.visible;
  showInfo(isBio ? "bio" : "ann", obj.userData.part || obj.userData.key);
  obj.geometry.computeBoundingSphere();
  const centre = obj.geometry.boundingSphere.center.clone().applyMatrix4(obj.matrixWorld);
  goalLook.copy(centre);
  transition = 60;
  selHalo.position.copy(centre);
  selHalo.visible = true;
}
document.getElementById("fire-btn").addEventListener("click", () => { impulseT = 0; });

/* ---------- Neural network maths ---------- */
const LR = 0.5;
const DEFAULTS = () => ({
  x: [1, 0, 1], target: 1,
  W: [[0.8, -0.5, 0.3], [-0.6, 0.9, 0.2], [0.4, 0.7, -0.8]],
  b1: [0, 0, 0], v: [0.7, -0.4, 0.9], b2: 0
});
let state = DEFAULTS();
let acts = {};
const sigmoid = z => 1 / (1 + Math.exp(-z));
const clamp = v => Math.max(-3, Math.min(3, v));
const fmt = n => (n < 0 ? `(${n.toFixed(2)})` : n.toFixed(2));
function forward() {
  const { x, W, b1, v, b2 } = state;
  const zh = W.map((row, j) => row.reduce((s, w, i) => s + w * x[i], 0) + b1[j]);
  const h = zh.map(sigmoid);
  const z2 = h.reduce((s, hj, j) => s + hj * v[j], 0) + b2;
  acts = { zh, h, z2, y: sigmoid(z2) };
  return acts;
}
function trainStep() {
  forward();
  const { x } = state, { h, y } = acts;
  const d2 = 2 * (y - state.target) * y * (1 - y);
  const vOld = state.v.slice();
  for (let j = 0; j < 3; j++) {
    state.v[j] = clamp(state.v[j] - LR * d2 * h[j]);
    const d1 = d2 * vOld[j] * h[j] * (1 - h[j]);
    for (let i = 0; i < 3; i++) state.W[j][i] = clamp(state.W[j][i] - LR * d1 * x[i]);
    state.b1[j] = clamp(state.b1[j] - LR * d1);
  }
  state.b2 = clamp(state.b2 - LR * d2);
}
function currentError() { forward(); return (acts.y - state.target) ** 2; }
function learn(steps) {
  flowing = true;
  const before = currentError();
  for (let s = 0; s < steps; s++) trainStep();
  const after = currentError();
  buildAdvanced();
  update();
  document.getElementById("train-log").textContent =
    `Learning done: error went from ${before.toFixed(3)} down to ${after.toFixed(3)}. Smaller is better, and the output moves toward the target.`;
}

function paintNode(key, val) {
  const n = annNodes[key];
  n.mat.color.setHSL(0.55, 0.9, 0.18 + val * 0.55);
  n.mat.emissive.setHSL(0.55, 1, val * 0.35);
  n.halo.material.opacity = 0.2 + val * 0.8;
}
function paintEdge(e, w) {
  e.mat.color.set(w >= 0 ? 0x27d3ff : 0xff5c8a);
  e.mat.opacity = Math.min(0.12 + Math.abs(w) * 0.28, 0.95);
}
function paintNetwork() {
  state.x.forEach((val, i) => paintNode("in" + (i + 1), val));
  acts.h.forEach((val, j) => paintNode("h" + (j + 1), val));
  paintNode("out", acts.y);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) paintEdge(wEdges[j][i], state.W[j][i]);
  for (let j = 0; j < 3; j++) paintEdge(vEdges[j], state.v[j]);
}

/* Simple, plain-language output */
function word(v) { return v > 0.66 ? "strongly active" : v < 0.34 ? "weakly active" : "medium"; }
function renderSimple() {
  const { y } = acts, t = state.target, gap = Math.abs(y - t);
  document.getElementById("bigOut").textContent = y.toFixed(2);
  document.getElementById("outBar").style.width = (y * 100).toFixed(1) + "%";
  document.getElementById("outTarget").textContent = `Target (the answer we want): ${t.toFixed(2)}`;
  document.getElementById("outVerdict").textContent =
    gap < 0.05 ? "✅ Very close to the target" : gap < 0.2 ? "🟡 Getting closer. Press Learn." : "🔴 Far from the target. Press Learn.";
  document.getElementById("hidden-cards").innerHTML = acts.h.map((hv, j) =>
    `<div class="hcard"><b>h${j + 1}</b><span class="hv">${hv.toFixed(2)}</span><small>${word(hv)}</small></div>`).join("");
}
function renderSteps() {
  const { x, W, b1, v, b2 } = state, { zh, h, z2, y } = acts;
  let rows = `<tr><th>Neuron</th><th>Weights × inputs + bias</th><th>z</th><th>a = σ(z)</th></tr>`;
  for (let j = 0; j < 3; j++) {
    const eq = W[j].map((w, i) => `${fmt(w)}×${fmt(x[i])}`).join(" + ") + ` + ${fmt(b1[j])}`;
    rows += `<tr><td>h${j + 1}</td><td class="eq">${eq}</td><td>${zh[j].toFixed(3)}</td><td><b>${h[j].toFixed(3)}</b></td></tr>`;
  }
  const outEq = v.map((w, j) => `${fmt(w)}×${h[j].toFixed(2)}`).join(" + ") + ` + ${fmt(b2)}`;
  rows += `<tr><td>y</td><td class="eq">${outEq}</td><td>${z2.toFixed(3)}</td><td><b>${y.toFixed(4)}</b></td></tr>`;
  document.getElementById("steps").innerHTML = rows;
}
function update() {
  forward();
  paintNetwork();
  renderSimple();
  renderSteps();
}

/* Controls */
function ctlHTML(label, param, min, max, step, value) {
  return `<div class="ctl"><div class="ctl-head"><span>${label}</span><output>${Number(value).toFixed(2)}</output></div>` +
    `<input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-param="${param}"></div>`;
}
function buildInputs() {
  let html = "";
  state.x.forEach((val, i) => html += ctlHTML(`Input x${i + 1} (0 = off, 1 = on)`, `x:${i}`, 0, 1, 0.01, val));
  html += ctlHTML("Target (the answer we want)", "t", 0, 1, 0.01, state.target);
  document.getElementById("controls-inputs").innerHTML = html;
}
function buildAdvanced() {
  const { W, b1, v, b2 } = state;
  let html = "";
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
    html += ctlHTML(`weight x${i + 1} → h${j + 1}`, `w:${j},${i}`, -3, 3, 0.05, W[j][i]);
  for (let j = 0; j < 3; j++) html += ctlHTML(`bias of h${j + 1}`, `b1:${j}`, -3, 3, 0.05, b1[j]);
  for (let j = 0; j < 3; j++) html += ctlHTML(`weight h${j + 1} → y`, `v:${j}`, -3, 3, 0.05, v[j]);
  html += ctlHTML("bias of y", "b2", -3, 3, 0.05, b2);
  document.getElementById("controls-adv").innerHTML = html;
}
function setParam(key, idx, val) {
  if (key === "x") state.x[+idx] = val;
  else if (key === "w") { const [j, i] = idx.split(",").map(Number); state.W[j][i] = val; }
  else if (key === "b1") state.b1[+idx] = val;
  else if (key === "v") state.v[+idx] = val;
  else if (key === "b2") state.b2 = val;
  else if (key === "t") state.target = val;
}
document.getElementById("sim").addEventListener("input", e => {
  const el = e.target;
  if (!el.dataset || !el.dataset.param) return;
  const [key, idx] = el.dataset.param.split(":");
  const val = parseFloat(el.value);
  setParam(key, idx, val);
  el.closest(".ctl").querySelector("output").textContent = val.toFixed(2);
  update();
});

function setStatusText() {
  const running = flowing;
  const text = running
    ? `● RUNNING — ${phase < 1 ? "Step 1 of 2: signals move from the inputs to the hidden neurons" : "Step 2 of 2: signals move from the hidden neurons to the output"}`
    : "❚❚ PAUSED — press Start to see the signals move";
  const cls = running ? "on" : "off";
  const simStatus = document.getElementById("sim-status");
  simStatus.textContent = text;
  simStatus.className = "status " + cls;
  const badge = document.getElementById("runBadge");
  badge.textContent = text;
  badge.className = "runbadge " + cls;
}

document.getElementById("start-btn").addEventListener("click", () => { flowing = true; });
document.getElementById("pause-btn").addEventListener("click", () => { flowing = false; });
document.getElementById("reset-btn").addEventListener("click", () => {
  flowing = true; phase = 0; state = DEFAULTS();
  buildInputs(); buildAdvanced(); update();
  document.getElementById("train-log").textContent = "";
});
document.getElementById("learn-1-btn").addEventListener("click", () => learn(1));
document.getElementById("learn-100-btn").addEventListener("click", () => learn(100));

/* ---------- Animation loop ---------- */
const clock = new THREE.Clock();
let lastBadge = "";
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  heroGroup.rotation.y += dt * 0.05;
  heroGroup.rotation.x = Math.sin(time * 0.2) * 0.05;
  shell.rotation.y -= dt * 0.1;
  updatePulseSet(heroPulseSet, dt);
  bgGroup.rotation.y += dt * 0.01;

  if (brainGroup.visible) {
    brainModel.rotation.y = Math.sin(time * 0.3) * 0.5;
    updatePulseSet(brainPulses, dt);
  }
  if (compNetGroup.visible) {
    chip.rotation.y += dt * 0.5;
    updatePulseSet(compNetPulses, dt);
  }

  if (impulseT >= 0) {
    impulseT += dt * 0.4;
    if (impulseT > 1) { impulseT = -1; impulse.visible = false; }
    else { impulse.visible = true; impulse.position.copy(axonCurve.getPointAt(impulseT)); }
  }

  if (flowing) phase = (phase + dt * 0.5) % 2;
  annPulses.forEach(s => (s.visible = false));
  if (annGroup.visible && flowing) {
    if (phase < 1) {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (state.x[i] > 0.05) {
        const s = annPulses[j * 3 + i];
        s.visible = true;
        s.position.lerpVectors(wEdges[j][i].a, wEdges[j][i].b, phase);
      }
    } else {
      for (let j = 0; j < 3; j++) if (acts.h[j] > 0.05) {
        const s = annPulses[9 + j];
        s.visible = true;
        s.position.lerpVectors(vEdges[j].a, vEdges[j].b, phase - 1);
      }
    }
  }

  // Show the running status only in network and simulation sections
  const showBadge = annGroup.visible;
  const badge = document.getElementById("runBadge");
  if (showBadge) {
    const txt = flowing ? (phase < 1 ? "1" : "2") : "p";
    if (txt !== lastBadge) { setStatusText(); lastBadge = txt; }
    badge.style.display = "block";
  } else {
    badge.style.display = "none";
  }

  if (transition > 0) {
    camera.position.lerp(goalPos, 0.04);
    controls.target.lerp(goalLook, 0.06);
    transition--;
  }
  shift += (goalShift - shift) * 0.06;
  if (window.innerWidth >= 900)
    camera.setViewOffset(window.innerWidth, window.innerHeight, -shift * window.innerWidth, 0, window.innerWidth, window.innerHeight);
  else camera.clearViewOffset();

  controls.update();
  renderer.render(scene, camera);
}
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- Start ---------- */
setView("home");
setActiveNav("home");
buildInputs();
buildAdvanced();
update();
animate();
