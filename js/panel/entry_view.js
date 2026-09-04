import { planet_radius, entry_interface_radius } from '../core/trajectory.js';
import {
  squareGridGeometry,
  makeLine,
  makeDashedLine,
  setLinePoints,
  makeArrow,
  setArrow,
  makeHandle,
  scaleHandleToScreen,
  makeSquareResizer,
  attachHandleDrag,
  closestOnAxis,
  makeRenderLoop,
} from './view3d.js';

// 大気圏突入の操作パネル用の小さな3Dビュー。
// 天体を中心に、V∞で落ちてくる軌道と、突入インターフェースに達する点、
// そこでの経路角γを描く。
//
// 【向き】スイングバイのB面ビューと同じ流儀で、実際の向きに合わせて描く。
//   天の北極方向        -> 画面上 (+Y)
//   天体の公転方向      -> 画面右 (+X)
// 太陽方向は矢印では描かず、平行光の向きとして陰影に反映する。
// 中身をまとめた root を回すことで向きを合わせる (カメラは固定)。
//
// 【座標系】1単位 = 天体半径。root内の描画フレームは、入射V∞を基準にした
// 物理フレーム (i_hat=入射V∞方向, j_hat, k_hat) を toDrawing で移したもので、
//   i_hat -> (0,0,-1),  j_hat -> (-1,0,0),  k_hat -> (0,1,0)
// となる。軌道はB面のβ=0に相当する面 (i_hatとj_hatが張る面 = XZ平面) に描く。
//
// 【V∞の向きを固定する】入射方向はミッション側で決まっていてγでは変わらない。
// そこで軌道は「入射漸近線の向きを固定し、狙いの深さ(=衝突パラメータb)を
// 変えると軌道が横にずれる」形で描く。近点を画面に固定すると、γを触るたびに
// 軌道全体が回って見えて誤解を招く。

export let renderer, scene, camera, controls;

let root, sunLight;
let planetMesh, entryRing, eclipticPlane, trackLine, horizonLine, gammaArc, orbitArrow;
let entryMarker, velocityArrow, aimHandle, aimGuide;

let activeHandle = null; // null | "gamma"
let drag = null;
let handlers = {}; // { onGamma(rad) }
let geom = null;
let lastViewKey;
let resizeToDisplaySize;

const CANVAS_MAX = 460;
const CANVAS_BORDER = 1;

// 画面に収める広さの下限 (天体半径の何倍まで)。狙いの線が遠いときだけ広げる。
const MIN_EXTENT = 7;
const MAX_EXTENT = 40;
// 黄道面グリッド (B面ビューと同じく、大きさは固定)
const ECLIPTIC_CELL = 1.5;
const ECLIPTIC_CELLS = 16;
// γの補助線・矢印の長さ (天体半径単位)
const GAMMA_R = 2.2;

const COLOR_TRACK = 0x1a1c20; // 突入までの軌道
const COLOR_ENTRY = 0xd6543f; // 突入点・突入速度
const COLOR_HORIZON = 0x8a8f99; // 地平線 (γの基準)
const COLOR_GAMMA = 0xe0a03b; // 経路角γ・狙いのハンドル
const COLOR_PLANET_ORBIT = 0x4caf82; // 天体の公転方向 (B面ビューと同じ色)

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initEntryView() {
  const canvas = document.getElementById("entry_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  root = new THREE.Group();
  scene.add(root);

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
  // B面ビューと同じ置き方。公転方向(+X)が手前左下から奥右上に抜けて見える
  camera.position.set(-0.6, -0.35, 0.8).setLength(30);
  camera.lookAt(0, 0, 0);

  // 太陽方向を陰影で示すが、帰還は夜側から入ることも多い。B面ビューほど
  // 環境光を落とすと天体が真っ黒になって突入点が読めないので、打上げビュー寄りの
  // 明るさにして、影の側でも形が分かるようにする。
  scene.add(new THREE.AmbientLight(0xffffff, 0.32));
  sunLight = new THREE.DirectionalLight(0xfff4e0, 1.8);
  sunLight.position.set(0, 1, 0);
  root.add(sunLight);
  root.add(sunLight.target);

  // 黄道面 (太陽系全体の基準面)。向きだけ毎回northHatに合わせる
  eclipticPlane = new THREE.LineSegments(
    squareGridGeometry((ECLIPTIC_CELL * ECLIPTIC_CELLS) / 2, ECLIPTIC_CELLS),
    new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.16, depthWrite: false })
  );
  eclipticPlane.name = "ecliptic";
  eclipticPlane.renderOrder = -1;
  root.add(eclipticPlane);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 44, 44),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.62, metalness: 0.0 })
  );
  root.add(planetMesh);

  // 突入インターフェース。地球なら半径の2%足らずなので天体の輪郭にぴったり
  // 沿った線にしかならないが、それ自体が「大気は薄い」という情報になる。
  entryRing = makeLine([new THREE.Vector3()], COLOR_ENTRY, 0.5);
  entryRing.name = "entry_ring";
  root.add(entryRing);

  trackLine = makeLine([new THREE.Vector3()], COLOR_TRACK, 1);
  trackLine.name = "entry_track";
  root.add(trackLine);

  horizonLine = makeLine([new THREE.Vector3()], COLOR_HORIZON, 0.8);
  root.add(horizonLine);

  gammaArc = makeLine([new THREE.Vector3()], COLOR_GAMMA, 1);
  root.add(gammaArc);

  // 天体の進行方向 (公転方向)
  orbitArrow = makeArrow(COLOR_PLANET_ORBIT, 0.85);
  root.add(orbitArrow);

  entryMarker = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_ENTRY })
  );
  entryMarker.material.depthTest = false;
  entryMarker.renderOrder = 3;
  entryMarker.name = "entry_marker";
  root.add(entryMarker);

  velocityArrow = makeThickArrow(COLOR_ENTRY);
  velocityArrow.name = "entry_velocity";
  root.add(velocityArrow);

  // 狙いの深さ (衝突パラメータ) を掴むハンドルと、入射漸近線
  aimGuide = makeDashedLine([new THREE.Vector3()], COLOR_GAMMA, 0.5);
  root.add(aimGuide);
  aimHandle = makeHandle(COLOR_GAMMA);
  aimHandle.name = "aim_handle";
  root.add(aimHandle);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 2000;

  resizeToDisplaySize = makeSquareResizer(renderer, camera, CANVAS_MAX, CANVAS_BORDER);
  drag = attachHandleDrag({
    getRenderer: () => renderer,
    getCamera: () => camera,
    getControls: () => controls,
    getActiveHandle: () => (activeHandle === "gamma" ? { key: "gamma", mesh: aimHandle } : null),
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

/**
 * 物理フレームのベクトルを描画フレームに移す (B面ビューと同じ規約)。
 *   i_hat -> (0,0,-1),  j_hat -> (-1,0,0),  k_hat -> (0,1,0)
 */
function toDrawing(w, i_hat, j_hat, k_hat) {
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new THREE.Vector3(-d(w, j_hat), d(w, k_hat), -d(w, i_hat));
}

// 軌道面 (描画フレームのXZ平面) 上の点。上から見て角度θが増える向きに進む。
function atAngle(r, theta) {
  return new THREE.Vector3(r * Math.cos(theta), 0, -r * Math.sin(theta));
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

/**
 * 大気圏突入ビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 天体の番号
 * @param {string} [params.key]  表示対象の識別子。変わったときだけ画角を取り直す
 * @param {number} params.gamma  突入経路角 [rad] (水平から測り降下が負)
 * @param {number} params.vinf   V∞ [km/s]
 * @param {number} params.vEntry 突入速度 [km/s]
 * @param {number} params.e      軌道の離心率
 * @param {number} params.p      セミラタス・レクタム [km]
 * @param {number} params.nuEntry 突入点の真近点角 [rad]
 * @param {number[]} [params.planetVel] 天体の太陽中心速度 [km/s]
 * @param {number[]} [params.planetPos] 天体の太陽中心位置 [km]
 * @param {number[]} [params.iHat] 入射V∞方向を基準にした物理フレーム
 */
export function updateEntryView({
  planetNum,
  key,
  gamma,
  vinf,
  vEntry,
  e,
  p,
  nuEntry,
  planetVel,
  planetPos,
  iHat,
  jHat,
  kHat,
}) {
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

  // --- 軌道 ---
  // まず近点を角度0に置いた形で作り、そのあと「入射漸近線の向きが画面で
  // 常に -Z (= i_hat の向き)」になるよう面内で回す。これでγを変えても
  // 入ってくる向きは動かず、狙いの深さだけが変わって見える。
  const nu_inf = e > 1 ? Math.acos(-1 / e) : Math.PI;
  const rAt = (nu) => p_n / (1 + e * Math.cos(nu));

  // 近点を角度0に置いたとき、無限遠での入射速度の向きは
  //   v̂ = (1/e)・近点方向 + sin(ν∞)・(近点での進行方向)
  // で、この向きの描画角はちょうど π−ν∞ になる。i_hat は描画フレームで
  // (0,0,-1) = 描画角 π/2 なので、面内で次の分だけ回せば入射方向が揃う。
  // 遠方の点から数値的に取ると有限距離ぶんずれるので、閉じた式を使う。
  const theta_p = Math.PI / 2 - (Math.PI - nu_inf);
  const uHat = new THREE.Vector3(0, 0, -1); // 入射の進行方向 (常に固定)

  // 入射漸近線が天体中心から離れている量 = 衝突パラメータ b。
  //   b = p/√(e²−1)  (= √(μp)/V∞ と同値)
  // 漸近線は近点と同じ側にずれるので、向きは近点方向のX成分の符号で決まる。
  const b_n = e > 1 ? p_n / Math.sqrt(e * e - 1) : Infinity;
  const wHat = new THREE.Vector3(Math.cos(theta_p) >= 0 ? 1 : -1, 0, 0);

  // 画面の広さ。狙いの線が遠いときだけ広げる (低V∞では b が大きくなる)
  const extent = Math.min(Math.max(MIN_EXTENT, b_n * 1.35), MAX_EXTENT);

  // 描くのは画面に収まる範囲まで
  const N = 200;
  const nu_draw = nuFor(p_n, e, extent * 1.4, nuEntry, nu_inf);
  const drawn = [];
  for (let k = 0; k <= N; k++) {
    const nu = nu_draw + ((nuEntry - nu_draw) * k) / N;
    drawn.push(atAngle(rAt(nu), theta_p + nu));
  }
  setLinePoints(trackLine, drawn);

  // --- 突入インターフェースの輪 ---
  const ring = [];
  for (let k = 0; k <= 96; k++) ring.push(atAngle(re_n, (2 * Math.PI * k) / 96));
  setLinePoints(entryRing, ring);

  // --- 突入点まわり (地平線・速度・γの弧) ---
  const entry = atAngle(re_n, theta_p + nuEntry);
  const up = entry.clone().normalize(); // 突入点での天頂方向
  // 進行方向側の地平方向 (上から見て角度が増える向き)。
  // atAngle(r,θ)をθで微分した向き (r・(-sinθ,0,-cosθ)) と一致させる必要が
  // あり、up=(cosθ,0,-sinθ)から作るなら (up.z, 0, -up.x) が正しい。
  // (-up.z, 0, -up.x) はupと直交しない(=地平方向になっていない)ため、
  // θによっては突入速度や地平線が大きく逆を向いてしまっていた。
  const horizon = new THREE.Vector3(up.z, 0, -up.x).normalize();
  const vDir = horizon
    .clone()
    .multiplyScalar(Math.cos(gamma))
    .addScaledVector(up, Math.sin(gamma))
    .normalize();

  entryMarker.position.copy(entry);
  entryMarker.scale.setScalar(extent * 0.022);

  const hl = GAMMA_R * 0.9;
  setLinePoints(horizonLine, [
    entry.clone().addScaledVector(horizon, -hl * 0.3),
    entry.clone().addScaledVector(horizon, hl),
  ]);

  setThickArrow(velocityArrow, entry, vDir, GAMMA_R * 0.85, extent * 0.016);

  const arcR = GAMMA_R * 0.5;
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

  // --- 向きを実際の姿に合わせる (公転方向・北・太陽) ---
  let vHat, sHat, northHat;
  const haveFrame = iHat != undefined && jHat != undefined && kHat != undefined;
  if (haveFrame && planetVel != undefined) {
    const vn = Math.hypot(planetVel[0], planetVel[1], planetVel[2]);
    if (vn > 1e-12) {
      vHat = toDrawing([planetVel[0] / vn, planetVel[1] / vn, planetVel[2] / vn], iHat, jHat, kHat);
    }
  }
  if (haveFrame && planetPos != undefined) {
    const rn = Math.hypot(planetPos[0], planetPos[1], planetPos[2]);
    // 太陽は天体から見て -r_pla の向き
    if (rn > 1e-12) sHat = toDrawing([-planetPos[0] / rn, -planetPos[1] / rn, -planetPos[2] / rn], iHat, jHat, kHat);
  }
  if (haveFrame) {
    northHat = toDrawing([0, 0, 1], iHat, jHat, kHat);
    eclipticPlane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), northHat);
    eclipticPlane.visible = true;
  } else {
    eclipticPlane.visible = false;
  }

  if (vHat) {
    const L = extent * 0.9;
    setArrow(orbitArrow, vHat.clone().multiplyScalar(-L), vHat.clone().multiplyScalar(L), extent * 0.06, 0.1, 0.45);
    orbitArrow.visible = true;
  } else {
    orbitArrow.visible = false;
  }
  applyOrientation(vHat, sHat, northHat);

  geom = { re_n, entry, horizon, up, gamma, uHat, wHat, b_n, extent, R, vinf, vEntry, r_e };
  updateHandles();

  if (key !== lastViewKey) {
    lastViewKey = key;
    fitCamera(extent);
  }
  invalidateEntryView();
}

/**
 * 中身をまとめて回転させ、表示の基準を天の北極方向と天体の公転方向に合わせる。
 * (B面ビューの applyOrientation と同じ)
 */
function applyOrientation(vHat, sHat, northHat) {
  if (!vHat || !northHat) return;
  const y = northHat.clone().normalize();
  const x = vHat.clone().addScaledVector(y, -vHat.dot(y));
  if (x.lengthSq() < 1e-12) return; // 公転方向が北極とほぼ平行 (縮退)
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  root.setRotationFromMatrix(
    new THREE.Matrix4().set(x.x, x.y, x.z, 0, y.x, y.y, y.z, 0, z.x, z.y, z.z, 0, 0, 0, 0, 1)
  );
  if (sHat) {
    sunLight.position.copy(sHat).setLength(50);
    sunLight.target.position.set(0, 0, 0);
  }
}

// 半径 r_target に達する真近点角 (突入点より手前側)
function nuFor(p_n, e, r_target, nuEntry, nu_inf) {
  const c = (p_n / r_target - 1) / e;
  if (!(c >= -1 && c <= 1)) return -(nu_inf - 1e-3);
  return Math.min(-Math.acos(c), nuEntry - 1e-3);
}

function updateHandles() {
  if (!aimHandle) return;
  const show = geom != null && activeHandle === "gamma" && geom.b_n > 1e-6;
  aimHandle.visible = show;
  aimGuide.visible = show;
  if (!show) return;

  // 掴むのは「狙いの深さ」= 入射漸近線が天体中心から離れている量。
  // 横にずらすと浅く/深くなる、という実際の狙い方そのものの操作になる。
  aimHandle.position.copy(geom.wHat.clone().multiplyScalar(geom.b_n));

  // 入射漸近線そのものを破線で見せる
  const c = geom.wHat.clone().multiplyScalar(geom.b_n);
  const L = geom.extent * 1.5;
  setLinePoints(aimGuide, [c.clone().addScaledVector(geom.uHat, -L), c.clone().addScaledVector(geom.uHat, L * 0.4)]);

  scaleHandleToScreen(aimHandle, camera, renderer);
}

// ハンドルをドラッグしている間の反映。
// 衝突パラメータ b から経路角へは
//   b = h/V∞,  h = r_e・v_e・cos γ   ->   cos γ = b・V∞/(r_e・v_e)
// と一意に決まる (bが小さいほど深く突っ込む)。
function applyDrag(key, raycaster) {
  if (!geom || !(geom.vinf > 0) || !(geom.vEntry > 0)) return;
  // 軸は root の中の向きなので、実際の姿に回してから当てる
  const axis = geom.wHat.clone().applyQuaternion(root.quaternion);
  const t = closestOnAxis(raycaster, axis);
  if (t == undefined) return;
  const b = Math.max(0, t) * geom.R; // [km]
  const cos_g = Math.max(0, Math.min(1, (b * geom.vinf) / (geom.r_e * geom.vEntry)));
  if (handlers.onGamma) handlers.onGamma(-Math.acos(cos_g));
}

function fitCamera(extent) {
  const fitDist = (extent * 1.25) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  controls.minDistance = fitDist * 0.05;
  controls.maxDistance = fitDist * 20;
  // 描く範囲も場面の規模に合わせる (固定のままだと、引いた先で遠くのものが
  // far の外に出て消える)
  camera.near = Math.max(fitDist * 1e-3, 1e-4);
  camera.far = fitDist * 100;
  camera.updateProjectionMatrix();
}

function setVisible(visible) {
  planetMesh.visible = visible;
  entryRing.visible = visible;
  trackLine.visible = visible;
  horizonLine.visible = visible;
  gammaArc.visible = visible;
  entryMarker.visible = visible;
  velocityArrow.visible = visible;
  if (!visible) {
    eclipticPlane.visible = false;
    orbitArrow.visible = false;
    aimHandle.visible = false;
    aimGuide.visible = false;
  }
}

// 大気圏突入ビューも絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  if (!renderer.domElement.offsetParent) return;
  resizeToDisplaySize();
  if (controls) controls.update();
  scaleHandleToScreen(aimHandle, camera, renderer);
  renderer.render(scene, camera);
});

/** 大気圏突入ビューを描き直す予約を入れる */
export function invalidateEntryView(frames) {
  loop.invalidate(frames);
}
