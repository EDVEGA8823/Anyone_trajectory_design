import { launch_frame } from './trajectory.js';
import {
  squareGridGeometry,
  makeLine,
  setLinePoints,
  makeArrow,
  setArrow,
  makeHandle,
  scaleHandleToScreen,
  makeSquareResizer,
  attachHandleDrag,
  closestOnAxis,
  intersectPlane,
  makeRenderLoop,
} from './view3d.js';

// 打上げ操作パネル用の小さな3Dビュー。
// 出発天体を中心に、脱出速度ベクトル V∞ と、それを決める2つの角度
// (方位角 α・仰角 δ) を描く。スイングバイのB面ビュー(bplane.js)と同じ流儀で、
// 右の欄を選ぶとその欄のハンドルが出てマウスで動かせる。
//
// 【座標系】1単位 = 1 km/s。グリッドの一目が 1 km/s なので、ビュー全体が
// そのまま速度の物差しになる (天体の大きさは表示上の飾りで、縮尺は持たない)。
// 打上げの角度を測る基準系 launch_frame (x_hat=公転方向, z_hat=軌道面の法線,
// y_hat=z×x) を、次の向きで描画する。
//   x_hat (公転方向)        -> 画面右 (+X)
//   z_hat (軌道面の法線≒北) -> 画面上 (+Y)
//   y_hat                   -> 画面奥 (-Z)   ※右手系になる向き
// したがって物理ベクトル w は (w·x_hat, w·z_hat, -(w·y_hat)) に置く。

export let renderer, scene, camera, controls;

let planetMesh, orbitPlane, orbitArrow, sunLight;
let vinfArrow, shadowLine, riseLine, alphaArc, deltaArc, alphaRefLine;
let vinfHandle, alphaHandle, deltaHandle, vinfGuide, alphaGuide, deltaGuide;

let activeHandle = null; // null | "vinf" | "alpha" | "delta"
let drag = null;
let handlers = {}; // { onVinf(km/s), onAlpha(rad), onDelta(rad) }
let geom = null; // 直近の描画状態 (ハンドルの配置とドラッグの換算に使う)
let lastViewKey; // いま表示しているノード。切り替わったときだけ画角を取り直す
let resizeToDisplaySize;

const CANVAS_MAX = 460;
const CANVAS_BORDER = 1;

// 軌道面のグリッド。B面ビューと同じく、目の粗さも広さも変えない
// (縮尺が動くと、掴んで動かしている最中に大きさの感覚が崩れるため)。
const CELL = 1; // 一目 = 1 km/s
const CELLS = 10;
const PLANET_R = 0.55; // 天体の見た目の半径 [km/s単位]。物理的な意味は無い

// 角度のハンドルは |V∞| によらず決まった位置に出す。伸び縮み(V∞)のハンドルと
// 重ならないよう、半径を変えてある。
const ALPHA_R = 3.2;
const DELTA_R = 2.2;

const COLOR_VINF = 0xff8c1a;
const COLOR_ALPHA = 0x3b6fe0;
const COLOR_DELTA = 0xe0a03b;
const COLOR_PLANET_ORBIT = 0x4caf82;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initLaunchView() {
  const canvas = document.getElementById("launch_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
  // 公転方向(+X)が画面右、北(+Y)が画面上に来るよう、+Z側の斜め上から見る。
  // 軌道面を斜めから見下ろす角度にしないと、仰角δの傾きが読み取れない。
  camera.position.set(0.3, 0.8, 1).setLength(14);
  camera.lookAt(0, 0, 0);

  // 太陽が天体の向こう側にあることも多いので、環境光はB面ビューより強めにして
  // 影の側でも天体が黒い塊にならないようにする
  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  sunLight = new THREE.DirectionalLight(0xfff4e0, 1.5);
  sunLight.position.set(0, 1, 0);
  scene.add(sunLight);
  scene.add(sunLight.target);

  // 天体の軌道面 (= 方位角αを測る面)。グリッドはXY平面で作られるので寝かせる。
  orbitPlane = new THREE.LineSegments(
    squareGridGeometry((CELL * CELLS) / 2, CELLS),
    new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.22, depthWrite: false })
  );
  orbitPlane.rotation.x = -Math.PI / 2;
  orbitPlane.renderOrder = -1;
  scene.add(orbitPlane);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R, 40, 40),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.62, metalness: 0.0 })
  );
  scene.add(planetMesh);

  // 天体の公転方向 = 方位角 α の基準(0°)
  orbitArrow = makeArrow(COLOR_PLANET_ORBIT, 0.85);
  scene.add(orbitArrow);
  alphaRefLine = makeLine([new THREE.Vector3()], COLOR_PLANET_ORBIT, 0.5);
  scene.add(alphaRefLine);

  vinfArrow = makeArrow(COLOR_VINF, 1);
  vinfArrow.name = "vinf_arrow";
  scene.add(vinfArrow);

  // V∞を軌道面に落とした影と、そこから持ち上げる線。
  // この2本があると仰角δがどこの角度なのか読み取れる。
  shadowLine = makeLine([new THREE.Vector3()], COLOR_VINF, 0.35);
  scene.add(shadowLine);
  riseLine = makeLine([new THREE.Vector3()], COLOR_VINF, 0.35);
  scene.add(riseLine);

  alphaArc = makeLine([new THREE.Vector3()], COLOR_ALPHA, 1);
  scene.add(alphaArc);
  deltaArc = makeLine([new THREE.Vector3()], COLOR_DELTA, 1);
  scene.add(deltaArc);

  vinfGuide = makeLine([new THREE.Vector3()], COLOR_VINF, 0.35);
  scene.add(vinfGuide);
  vinfHandle = makeHandle(COLOR_VINF);
  vinfHandle.name = "vinf_handle";
  scene.add(vinfHandle);

  alphaGuide = makeLine([new THREE.Vector3()], COLOR_ALPHA, 0.45);
  scene.add(alphaGuide);
  alphaHandle = makeHandle(COLOR_ALPHA);
  alphaHandle.name = "alpha_handle";
  scene.add(alphaHandle);

  deltaGuide = makeLine([new THREE.Vector3()], COLOR_DELTA, 0.45);
  scene.add(deltaGuide);
  deltaHandle = makeHandle(COLOR_DELTA);
  deltaHandle.name = "delta_handle";
  scene.add(deltaHandle);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 200;

  resizeToDisplaySize = makeSquareResizer(renderer, camera, CANVAS_MAX, CANVAS_BORDER);
  drag = attachHandleDrag({
    getRenderer: () => renderer,
    getCamera: () => camera,
    getControls: () => controls,
    getActiveHandle: () => {
      const mesh = activeHandleMesh();
      return mesh ? { key: activeHandle, mesh } : null;
    },
    onDrag: applyDrag,
  });

  controls.addEventListener("change", () => invalidateLaunchView());
  window.addEventListener("resize", () => invalidateLaunchView());
  invalidateLaunchView();
}

/** ドラッグでV∞・α・δが変わったときに呼ぶコールバックを登録する */
export function setLaunchViewHandlers(h) {
  handlers = h || {};
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setLaunchActiveHandle(which) {
  const next = which === "vinf" || which === "alpha" || which === "delta" ? which : null;
  if (next === activeHandle) return;
  activeHandle = next;
  if (drag && drag.dragging() !== activeHandle) drag.cancel();
  updateHandles();
}

function activeHandleMesh() {
  if (activeHandle === "vinf") return vinfHandle;
  if (activeHandle === "alpha") return alphaHandle;
  if (activeHandle === "delta") return deltaHandle;
  return null;
}

// 軌道面内で方位角 α の向き (描画座標)
function inPlaneDir(alpha) {
  return new THREE.Vector3(Math.cos(alpha), 0, -Math.sin(alpha));
}

// V∞ の単位ベクトル (描画座標)
function vinfDir(alpha, delta) {
  const c = Math.cos(delta);
  return new THREE.Vector3(c * Math.cos(alpha), Math.sin(delta), -c * Math.sin(alpha));
}

/**
 * 打上げビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 出発天体の番号
 * @param {string} [params.key]   表示対象の識別子。変わったときだけ画角を取り直す
 * @param {number} params.vinf    |V∞| [km/s]
 * @param {number} params.alpha   方位角 [rad] (公転方向が0)
 * @param {number} params.delta   仰角 [rad] (軌道面から北向きが正)
 * @param {number[]} [params.planetPos] 天体の太陽中心位置 [km] (陰影の向きに使う)
 * @param {number[]} [params.planetVel] 天体の太陽中心速度 [km/s]
 */
export function updateLaunchView({ planetNum, key, vinf, alpha = 0, delta = 0, planetPos, planetVel }) {
  if (!scene) return;

  const ready = planetNum != undefined && planetNum != -1 && vinf != undefined && vinf > 0;
  setVisible(ready);
  if (!ready) {
    geom = null;
    updateHandles();
    return;
  }

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);

  const dir = vinfDir(alpha, delta);
  const flat = inPlaneDir(alpha);
  const tip = dir.clone().multiplyScalar(vinf);
  const shadow = flat.clone().multiplyScalar(vinf * Math.cos(delta));

  // ビューの広さ。矢印が短くてもグリッドの広さは変わらないので、
  // 矢じるしなどの見た目の大きさはグリッドを基準に決める。
  const extent = Math.max((CELL * CELLS) / 2, vinf * 1.2);
  const head = Math.min(Math.max(vinf * 0.16, 0.25), 0.8);

  setArrow(vinfArrow, new THREE.Vector3(), tip, head, 0.2, 0.5);

  setLinePoints(shadowLine, [new THREE.Vector3(), shadow]);
  setLinePoints(riseLine, [shadow, tip]);
  // 仰角がほぼ0のときは影と本体が重なるだけなので描かない
  const tilted = Math.abs(delta) > 1e-3;
  shadowLine.visible = tilted;
  riseLine.visible = tilted;

  // 公転方向 (=α の基準) は天体を貫いて前後に伸ばす
  const L = (CELL * CELLS) / 2;
  setArrow(
    orbitArrow,
    new THREE.Vector3(-L, 0, 0),
    new THREE.Vector3(L, 0, 0),
    0.45,
    0.1,
    0.45
  );
  setLinePoints(alphaRefLine, [new THREE.Vector3(), new THREE.Vector3(L, 0, 0)]);

  // 方位角の円弧 (軌道面内、公転方向から反時計回りに α)
  const arcA = Math.min(ALPHA_R * 0.55, Math.max(vinf * 0.45, 0.8));
  setLinePoints(alphaArc, arcPoints((t) => inPlaneDir(t).multiplyScalar(arcA), 0, alpha));

  // 仰角の円弧 (α の向きを含む鉛直面内で、軌道面から δ)
  const arcD = arcA * 0.8;
  const up = new THREE.Vector3(0, 1, 0);
  setLinePoints(
    deltaArc,
    arcPoints(
      (t) => flat.clone().multiplyScalar(Math.cos(t) * arcD).addScaledVector(up, Math.sin(t) * arcD),
      0,
      delta
    )
  );
  deltaArc.visible = tilted;

  // --- 陰影 (太陽方向) ---
  // 太陽は天体から見て -r_pla の向き。矢印では描かず、平行光の向きに反映する。
  const frame = planetPos && planetVel ? launch_frame(planetPos, planetVel) : undefined;
  if (frame && planetPos) {
    const rn = Math.hypot(planetPos[0], planetPos[1], planetPos[2]);
    if (rn > 1e-12) {
      const s = [-planetPos[0] / rn, -planetPos[1] / rn, -planetPos[2] / rn];
      const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      sunLight.position.set(d(s, frame.x_hat), d(s, frame.z_hat), -d(s, frame.y_hat)).setLength(50);
      sunLight.target.position.set(0, 0, 0);
    }
  }

  geom = { vinf, alpha, delta, dir, flat, tip, extent };
  updateHandles();

  // 画角を取り直すのは表示するノードが変わったときだけ。
  // V∞や角度を変えるたびにカメラが動くと操作しづらいので動かさない。
  if (key !== lastViewKey) {
    lastViewKey = key;
    fitCamera(extent);
  }
}

// f(t) を [t0, t1] で刻んだ折れ線
function arcPoints(f, t0, t1, n = 48) {
  const pts = [];
  for (let k = 0; k <= n; k++) pts.push(f(t0 + ((t1 - t0) * k) / n));
  return pts;
}

// ハンドルの位置と、動かせる向きを示す補助線を引き直す
function updateHandles() {
  if (!vinfHandle) return;

  const ready = geom != null;
  const show = {
    vinf: ready && activeHandle === "vinf",
    alpha: ready && activeHandle === "alpha",
    delta: ready && activeHandle === "delta",
  };
  vinfHandle.visible = show.vinf;
  vinfGuide.visible = show.vinf;
  alphaHandle.visible = show.alpha;
  alphaGuide.visible = show.alpha;
  deltaHandle.visible = show.delta;
  deltaGuide.visible = show.delta;
  if (!ready) return;

  if (show.vinf) {
    // 伸び縮みする向き = V∞ の向きそのもの
    vinfHandle.position.copy(geom.tip);
    setLinePoints(vinfGuide, [
      new THREE.Vector3(),
      geom.dir.clone().multiplyScalar(Math.max(geom.vinf * 1.6, (CELL * CELLS) / 2)),
    ]);
  }

  if (show.alpha) {
    // 回る向き = 軌道面内の円
    alphaHandle.position.copy(geom.flat.clone().multiplyScalar(ALPHA_R));
    setLinePoints(alphaGuide, arcPoints((t) => inPlaneDir(t).multiplyScalar(ALPHA_R), 0, 2 * Math.PI, 72));
  }

  if (show.delta) {
    // 回る向き = α の向きを含む鉛直面内の半円 (δ は ±90°まで)
    const up = new THREE.Vector3(0, 1, 0);
    deltaHandle.position.copy(
      geom.flat.clone().multiplyScalar(Math.cos(geom.delta) * DELTA_R).addScaledVector(up, Math.sin(geom.delta) * DELTA_R)
    );
    setLinePoints(
      deltaGuide,
      arcPoints(
        (t) => geom.flat.clone().multiplyScalar(Math.cos(t) * DELTA_R).addScaledVector(up, Math.sin(t) * DELTA_R),
        -Math.PI / 2,
        Math.PI / 2
      )
    );
  }

  // 表示に切り替わった最初のフレームで大きすぎる状態が見えないようにする
  scaleHandleToScreen(vinfHandle, camera, renderer);
  scaleHandleToScreen(alphaHandle, camera, renderer);
  scaleHandleToScreen(deltaHandle, camera, renderer);
}

// ハンドルをドラッグしている間の反映
function applyDrag(key, raycaster) {
  if (!geom) return;

  if (key === "vinf") {
    // V∞の向きを軸に、マウスに最も近い点までの長さをそのまま大きさにする
    const t = closestOnAxis(raycaster, geom.dir);
    if (t == undefined) return;
    if (handlers.onVinf) handlers.onVinf(Math.max(0, t));
    return;
  }

  if (key === "alpha") {
    // 軌道面との交点の向きが方位角になる
    const p = intersectPlane(raycaster, new THREE.Vector3(0, 1, 0));
    if (!p || p.lengthSq() < 1e-12) return;
    if (handlers.onAlpha) handlers.onAlpha(Math.atan2(-p.z, p.x));
    return;
  }

  // 仰角は、いまの方位角を含む鉛直面(法線 = flat × up)の中で測る
  const n = new THREE.Vector3(Math.sin(geom.alpha), 0, Math.cos(geom.alpha));
  const p = intersectPlane(raycaster, n);
  if (!p || p.lengthSq() < 1e-12) return;
  const along = p.dot(geom.flat);
  const delta = Math.atan2(p.y, along);
  // 背面に回り込んだ(方位角が反対向きになる)場合は±90度で止める
  const lim = Math.PI / 2;
  if (handlers.onDelta) handlers.onDelta(Math.max(-lim, Math.min(lim, delta)));
}

// 全体が画角に収まる距離にカメラを置き直す
function fitCamera(extent) {
  const fitDist = (extent * 1.15) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  controls.minDistance = fitDist * 0.15;
  controls.maxDistance = fitDist * 6;
}

function setVisible(visible) {
  planetMesh.visible = visible;
  orbitPlane.visible = visible;
  orbitArrow.visible = visible;
  alphaRefLine.visible = visible;
  vinfArrow.visible = visible;
  shadowLine.visible = visible;
  riseLine.visible = visible;
  alphaArc.visible = visible;
  deltaArc.visible = visible;
}

// 打上げビューは絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)。
// 打上げ以外を選んでいる間は非表示なので、描画予約が入っても何もしない。
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  if (!renderer.domElement.offsetParent) return;
  resizeToDisplaySize();
  if (controls) controls.update();
  scaleHandleToScreen(vinfHandle, camera, renderer);
  scaleHandleToScreen(alphaHandle, camera, renderer);
  scaleHandleToScreen(deltaHandle, camera, renderer);
  renderer.render(scene, camera);
});

/** 打上げビューを描き直す予約を入れる */
export function invalidateLaunchView(frames) {
  loop.invalidate(frames);
}
