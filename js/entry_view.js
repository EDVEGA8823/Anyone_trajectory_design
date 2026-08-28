import { planet_radius, entry_interface_radius } from './trajectory.js';
import {
  makeLine,
  setLinePoints,
  makeHandle,
  scaleHandleToScreen,
  makeSquareResizer,
  attachHandleDrag,
  intersectPlane,
  makeRenderLoop,
} from './view3d.js';

// 大気圏突入の操作パネル用の小さな3Dビュー。
// 天体を中心に、V∞で落ちてくる双曲線軌道と、突入インターフェースに達する点、
// そこでの経路角γを描く。
//
// 【座標系】1単位 = 天体半径。周回軌道ビューと同じく軌道面は水平 (XZ平面) に
// 寝かせ、カメラは上から見下ろす。
//
// 【突入点を固定する】双曲線の形はγで変わるが、近点方向を画面に固定すると
// 突入点が動いてしまい、何を触っているのか分かりにくい。逆に「突入点を +X に
// 固定して、そこへ入ってくる向きがγで回る」ようにすると、γがそのまま
// 「地面に対する角度」として読める。
//   突入点   : (r_e, 0, 0)
//   地平方向 : (0, 0, -1)   ※進行方向側。上から見て反時計回りに進む
//   突入速度 : (sin γ, 0, -cos γ)   γ<0 なので内側(-X)へ潜っていく

export let renderer, scene, camera, controls;

let planetMesh, entryRing, planeGrid, hyperbolaLine, horizonLine, gammaArc;
let entryMarker, velocityArrow, gammaHandle, gammaGuide;

let activeHandle = null; // null | "gamma"
let drag = null;
let handlers = {}; // { onGamma(rad) }
let geom = null;
let lastViewKey;
let resizeToDisplaySize;

const CANVAS_MAX = 460;
const CANVAS_BORDER = 1;

// 画面に収める広さ (天体半径の何倍まで) と、軌道面グリッドの広さ・目の数。
// 双曲線は無限に伸びるので、どこまで描くかはこちらで決める。
const VIEW_EXTENT = 7;
const GRID_SPAN = 3;
const GRID_DIVISIONS = 24;
// γの補助線・ハンドルの長さ (天体半径単位)
const GAMMA_R = 2.4;

const COLOR_TRACK = 0x1a1c20; // 突入までの軌道
const COLOR_ENTRY = 0xd6543f; // 突入点・突入速度
const COLOR_HORIZON = 0x8a8f99; // 地平線 (γの基準)
const COLOR_GAMMA = 0xe0a03b; // 経路角γ

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initEntryView() {
  const canvas = document.getElementById("entry_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
  // 周回軌道ビューと同じ「水平な軌道面を上から見下ろす」向き
  camera.position.set(0, 1, 0.42).setLength(30);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sunLight.position.set(0.5, 1, 0.6);
  scene.add(sunLight);

  planeGrid = new THREE.LineSegments(
    planeGridGeometry(VIEW_EXTENT * GRID_SPAN, GRID_DIVISIONS),
    new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.16, depthWrite: false })
  );
  planeGrid.renderOrder = -1;
  scene.add(planeGrid);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 40),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.62, metalness: 0.0 })
  );
  scene.add(planetMesh);

  // 突入インターフェース。地球なら半径の2%足らずなので天体の輪郭にぴったり
  // 沿った線にしかならないが、それ自体が「大気は薄い」という情報になる。
  entryRing = makeLine([new THREE.Vector3()], COLOR_ENTRY, 0.5);
  entryRing.name = "entry_ring";
  scene.add(entryRing);

  hyperbolaLine = makeLine([new THREE.Vector3()], COLOR_TRACK, 1);
  hyperbolaLine.name = "entry_track";
  scene.add(hyperbolaLine);

  // γを測る基準になる地平線 (突入点での水平方向)
  horizonLine = makeLine([new THREE.Vector3()], COLOR_HORIZON, 0.8);
  scene.add(horizonLine);

  gammaArc = makeLine([new THREE.Vector3()], COLOR_GAMMA, 1);
  scene.add(gammaArc);

  entryMarker = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_ENTRY })
  );
  entryMarker.material.depthTest = false;
  entryMarker.renderOrder = 3;
  entryMarker.name = "entry_marker";
  scene.add(entryMarker);

  // 突入速度の向き。太さのあるメッシュで、このビューの主役として描く。
  velocityArrow = makeThickArrow(COLOR_ENTRY);
  velocityArrow.name = "entry_velocity";
  scene.add(velocityArrow);

  gammaGuide = makeLine([new THREE.Vector3()], COLOR_GAMMA, 0.4);
  scene.add(gammaGuide);
  gammaHandle = makeHandle(COLOR_GAMMA);
  gammaHandle.name = "gamma_handle";
  scene.add(gammaHandle);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 500;

  resizeToDisplaySize = makeSquareResizer(renderer, camera, CANVAS_MAX, CANVAS_BORDER);
  drag = attachHandleDrag({
    getRenderer: () => renderer,
    getCamera: () => camera,
    getControls: () => controls,
    getActiveHandle: () => (activeHandle === "gamma" ? { key: "gamma", mesh: gammaHandle } : null),
    onDrag: applyDrag,
  });

  controls.addEventListener("change", () => invalidateEntryView());
  window.addEventListener("resize", () => invalidateEntryView());
  invalidateEntryView();
}

/** 太さのある矢印 (周回軌道ビューのΔVと同じ作り)。既定の向きは +Y */
function makeThickArrow(color) {
  const g = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color });
  material.depthTest = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), material);
  const head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 20), material);
  g.add(shaft);
  g.add(head);
  g.renderOrder = 3;
  g.userData = { shaft, head };
  return g;
}

function setThickArrow(arrow, from, dir, len, radius) {
  const { shaft, head } = arrow.userData;
  const headLen = len * 0.35;
  const shaftLen = len - headLen;
  shaft.scale.set(radius, shaftLen, radius);
  shaft.position.set(0, shaftLen / 2, 0);
  head.scale.set(radius * 2.4, headLen, radius * 2.4);
  head.position.set(0, shaftLen + headLen / 2, 0);
  arrow.position.copy(from);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
}

/** 水平面(XZ)上の正方形グリッド */
function planeGridGeometry(half, divisions) {
  const pts = [];
  for (let k = 0; k <= divisions; k++) {
    const t = -half + (2 * half * k) / divisions;
    pts.push(new THREE.Vector3(t, 0, -half), new THREE.Vector3(t, 0, half));
    pts.push(new THREE.Vector3(-half, 0, t), new THREE.Vector3(half, 0, t));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/** ドラッグでγが変わったときに呼ぶコールバックを登録する */
export function setEntryViewHandlers(h) {
  handlers = h || {};
}

/** ハンドルを出すか。null で隠す */
export function setEntryActiveHandle(which) {
  const next = which === "gamma" ? "gamma" : null;
  if (next === activeHandle) return;
  activeHandle = next;
  if (drag && drag.dragging() !== activeHandle) drag.cancel();
  updateHandles();
  invalidateEntryView();
}

// 描画平面での角度θ (反時計回り) を位置に直す。周回軌道ビューと同じ流儀。
function atAngle(r, theta) {
  return new THREE.Vector3(r * Math.cos(theta), 0, -r * Math.sin(theta));
}

/**
 * 大気圏突入ビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 天体の番号
 * @param {string} [params.key]   表示対象の識別子。変わったときだけ画角を取り直す
 * @param {number} params.gamma   突入経路角 [rad] (水平から測り降下が負)
 * @param {number} [params.e]     突入までの双曲線の離心率
 * @param {number} [params.p]     同 セミラタス・レクタム [km]
 * @param {number} [params.nuEntry] 突入点の真近点角 [rad]
 */
export function updateEntryView({ planetNum, key, gamma, e, p, nuEntry }) {
  if (!scene) return;

  const R = planetNum != undefined && planetNum >= 0 ? planet_radius[planetNum] : undefined;
  const r_e = planetNum != undefined && planetNum >= 0 ? entry_interface_radius(planetNum) : undefined;
  const ready = R != undefined && r_e != undefined && e != undefined && p != undefined;
  setVisible(ready);
  if (!ready) {
    geom = null;
    updateHandles();
    invalidateEntryView();
    return;
  }

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);

  const re_n = r_e / R;
  const p_n = p / R;

  // 突入点は常に +X。近点はそこから真近点角ぶん戻った向きにある。
  const entry = new THREE.Vector3(re_n, 0, 0);
  const theta_p = -nuEntry; // 近点の描画角
  const horizon = new THREE.Vector3(0, 0, -1); // 進行方向側の地平方向
  const up = new THREE.Vector3(1, 0, 0); // 天頂方向 (突入点では +X)
  // 突入速度の向き: 地平から γ だけ下を向く
  const vDir = horizon
    .clone()
    .multiplyScalar(Math.cos(gamma))
    .addScaledVector(up, Math.sin(gamma))
    .normalize();

  // --- 突入までの軌道 ---
  // 突入点(ν=nuEntry)から、画面に収まる距離まで遡って描く
  const nu_far = nuFor(p_n, e, VIEW_EXTENT * 1.35, nuEntry);
  const pts = [];
  const N = 160;
  for (let k = 0; k <= N; k++) {
    const nu = nu_far + ((nuEntry - nu_far) * k) / N;
    const r = p_n / (1 + e * Math.cos(nu));
    pts.push(atAngle(r, theta_p + nu));
  }
  setLinePoints(hyperbolaLine, pts);

  // --- 突入インターフェースの輪 ---
  const ring = [];
  for (let k = 0; k <= 96; k++) ring.push(atAngle(re_n, (2 * Math.PI * k) / 96));
  setLinePoints(entryRing, ring);

  // --- 突入点まわり (地平線・速度・γの弧) ---
  entryMarker.position.copy(entry);
  entryMarker.scale.setScalar(VIEW_EXTENT * 0.022);

  const hl = GAMMA_R * 0.9;
  setLinePoints(horizonLine, [
    entry.clone().addScaledVector(horizon, -hl * 0.35),
    entry.clone().addScaledVector(horizon, hl),
  ]);

  setThickArrow(velocityArrow, entry, vDir, GAMMA_R * 0.85, VIEW_EXTENT * 0.016);

  // γの弧は、地平方向から速度方向まで
  const arcR = GAMMA_R * 0.55;
  const arc = [];
  for (let k = 0; k <= 48; k++) {
    const t = (gamma * k) / 48;
    arc.push(
      entry
        .clone()
        .addScaledVector(horizon, Math.cos(t) * arcR)
        .addScaledVector(up, Math.sin(t) * arcR)
    );
  }
  setLinePoints(gammaArc, arc);

  geom = { re_n, entry, horizon, up, gamma };
  updateHandles();

  // 画角は天体の大きさで決まるので、対象が変わったときだけ合わせれば足りる
  if (key !== lastViewKey) {
    lastViewKey = key;
    fitCamera();
  }
  invalidateEntryView();
}

// 半径 r_target に達する真近点角 (突入点より手前側=負の向き)
function nuFor(p_n, e, r_target, nuEntry) {
  const c = (p_n / r_target - 1) / e;
  if (!(c >= -1 && c <= 1)) {
    // その距離に届かない (双曲線が閉じている側) 場合は漸近線の手前まで
    const nu_inf = e > 1 ? Math.acos(-1 / e) - 1e-3 : Math.PI - 1e-3;
    return -nu_inf;
  }
  const nu = -Math.acos(c);
  // 突入点より外側に来るようにする
  return Math.min(nu, nuEntry - 1e-3);
}

function updateHandles() {
  if (!gammaHandle) return;
  const show = geom != null && activeHandle === "gamma";
  gammaHandle.visible = show;
  gammaGuide.visible = show;
  if (!show) return;

  // 掴む場所は「入ってくる向き」の側 (速度の反対)。ここを回すとγが変わる。
  const back = geom.horizon
    .clone()
    .multiplyScalar(-Math.cos(geom.gamma))
    .addScaledVector(geom.up, -Math.sin(geom.gamma))
    .normalize();
  gammaHandle.position.copy(geom.entry.clone().addScaledVector(back, GAMMA_R));

  // 動かせる向き = 突入点まわりの半円 (真上から地平の反対まで)
  const guide = [];
  for (let k = 0; k <= 64; k++) {
    const t = -Math.PI / 2 + (Math.PI * k) / 64;
    guide.push(
      geom.entry
        .clone()
        .addScaledVector(geom.horizon, -Math.cos(t) * GAMMA_R)
        .addScaledVector(geom.up, -Math.sin(t) * GAMMA_R)
    );
  }
  setLinePoints(gammaGuide, guide);

  scaleHandleToScreen(gammaHandle, camera, renderer);
}

// ハンドルをドラッグしている間の反映
function applyDrag(key, raycaster) {
  if (!geom) return;
  // 軌道面(y=0)との交点の、突入点から見た向きがそのまま「入ってくる向き」
  const hit = intersectPlane(raycaster, new THREE.Vector3(0, 1, 0));
  if (!hit) return;
  const d = hit.sub(geom.entry);
  if (d.lengthSq() < 1e-12) return;
  // back = (-cos γ)*horizon + (-sin γ)*up なので、成分から γ を戻す
  const along = d.dot(geom.horizon);
  const radial = d.dot(geom.up);
  const gamma = Math.atan2(-radial, -along);
  if (handlers.onGamma) handlers.onGamma(gamma);
}

function fitCamera() {
  const fitDist = (VIEW_EXTENT * 1.3) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  controls.minDistance = fitDist * 0.05;
  controls.maxDistance = fitDist * 20;
}

function setVisible(visible) {
  planetMesh.visible = visible;
  planeGrid.visible = visible;
  entryRing.visible = visible;
  hyperbolaLine.visible = visible;
  horizonLine.visible = visible;
  gammaArc.visible = visible;
  entryMarker.visible = visible;
  velocityArrow.visible = visible;
  if (!visible) {
    gammaHandle.visible = false;
    gammaGuide.visible = false;
  }
}

// 大気圏突入ビューも絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  if (!renderer.domElement.offsetParent) return;
  resizeToDisplaySize();
  if (controls) controls.update();
  scaleHandleToScreen(gammaHandle, camera, renderer);
  renderer.render(scene, camera);
});

/** 大気圏突入ビューを描き直す予約を入れる */
export function invalidateEntryView(frames) {
  loop.invalidate(frames);
}
