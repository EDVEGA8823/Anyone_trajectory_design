import { planet_radius, planet_mu, min_flyby_rp } from './trajectory.js';
import {
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

// 周回軌道投入 / 軌道脱出の操作パネル用の小さな3Dビュー。
// 天体を中心に、V∞で入ってくる(出ていく)双曲線と、近点を共有する周回軌道の
// 楕円を重ねて描き、近点でのΔVを矢印で示す。
//
// 【座標系】1単位 = 天体半径。軌道面をXY平面、近点方向を +X、進行方向を
// 反時計回り(近点での速度が +Y)に取る。
//   ・楕円と双曲線は近点を共有し、+X軸について対称なので、この置き方だと
//     2つの軌道の関係がそのまま読み取れる。
//   ・軌道面の「実際の向き」は描いていない。近点接線噴射のΔVは軌道の向きに
//     依らないので (trajectory.js の説明を参照)、向きは自由に選べる=決められない。
//     もっともらしい向きを描くとかえって誤解を招くため、代表的な姿で描く。
//
// 【中心のずらし】天体は楕円の焦点にあるので、天体を画面中央に置くと離心率の
// 大きい軌道では画面の半分が空いてしまう。中身をまとめた root を楕円の中心が
// 原点に来るようずらして、カメラは原点まわりで回す (他のビューと同じ流儀)。

export let renderer, scene, camera, controls;

let root;
let planetMesh, keepOutSphere, orbitLine, hyperbolaLine, planeGrid;
let rpLine, raLine, periapsisMarker, apoapsisMarker, dvArrow, travelArrowhead;
let rpHandle, raHandle, rpGuide, raGuide;

let activeHandle = null; // null | "rp" | "ra"
let drag = null;
let handlers = {}; // { onRp(rp[km]), onRa(ra[km]) }
let geom = null; // 直近の描画状態 (ハンドルの配置とドラッグの換算に使う)
let lastViewKey;
let lastFitExtent = 0;
let resizeToDisplaySize;

const CANVAS_MAX = 460;
const CANVAS_BORDER = 1;

const COLOR_ORBIT = 0x3b6fe0; // 周回軌道 (楕円)
const COLOR_HYPERBOLA = 0x1a1c20; // 双曲線 (B面ビューの軌道と同じ色)
const COLOR_RP = 0xd6543f;
const COLOR_RA = 0xe0a03b;
const COLOR_DV = 0x9b4fd8;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

// 遠点を大きく動かすと軌道の規模が桁で変わるので、そのときだけ画角を取り直す。
// 少し動かすたびにカメラが動くと大きさの感覚が崩れるため、閾値を広めに取る。
const REFIT_RATIO = 2.5;

export function initOrbitView() {
  const canvas = document.getElementById("orbit_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  root = new THREE.Group();
  scene.add(root);

  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100000);
  // 軌道面をほぼ正面から見つつ、平面であることが分かる程度に傾ける
  camera.position.set(0.18, 0.34, 1).setLength(30);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sunLight.position.set(0.6, 0.8, 1);
  scene.add(sunLight);

  // 軌道面。大きさは軌道に合わせて毎回張り直す (規模が桁で変わるため)
  planeGrid = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.16, depthWrite: false })
  );
  planeGrid.renderOrder = -1;
  scene.add(planeGrid);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 40),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.62, metalness: 0.0 })
  );
  root.add(planetMesh);

  // 近点をこれより下げられない範囲 (大気・放射線帯)
  keepOutSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 24),
    new THREE.MeshBasicMaterial({ color: COLOR_RP, transparent: true, opacity: 0.12, wireframe: true })
  );
  root.add(keepOutSphere);

  // 双曲線は「これから通る/通ってきた」経路なので破線、周回軌道は実線にして、
  // 噴射の前後がひと目で分かるようにする
  hyperbolaLine = makeDashedLine([new THREE.Vector3()], COLOR_HYPERBOLA, 0.9);
  hyperbolaLine.name = "hyperbola";
  root.add(hyperbolaLine);

  orbitLine = makeLine([new THREE.Vector3()], COLOR_ORBIT, 1);
  orbitLine.name = "parking_orbit";
  root.add(orbitLine);

  travelArrowhead = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 16),
    new THREE.MeshBasicMaterial({ color: 0x5b6472 })
  );
  travelArrowhead.material.depthTest = false;
  travelArrowhead.renderOrder = 2;
  root.add(travelArrowhead);

  rpLine = makeLine([new THREE.Vector3()], COLOR_RP, 1);
  root.add(rpLine);
  raLine = makeLine([new THREE.Vector3()], COLOR_RA, 1);
  root.add(raLine);

  periapsisMarker = marker(COLOR_RP);
  root.add(periapsisMarker);
  apoapsisMarker = marker(COLOR_RA);
  root.add(apoapsisMarker);

  // 近点ΔV。天体のすぐ外側になるので、他の線と同様に手前に描く
  dvArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, COLOR_DV, 0.25, 0.14);
  dvArrow.name = "dv_arrow";
  dvArrow.line.material.depthTest = false;
  dvArrow.cone.material.depthTest = false;
  dvArrow.renderOrder = 3;
  root.add(dvArrow);

  rpGuide = makeLine([new THREE.Vector3()], COLOR_RP, 0.35);
  root.add(rpGuide);
  rpHandle = makeHandle(COLOR_RP);
  rpHandle.name = "orbit_rp_handle";
  root.add(rpHandle);

  raGuide = makeLine([new THREE.Vector3()], COLOR_RA, 0.35);
  root.add(raGuide);
  raHandle = makeHandle(COLOR_RA);
  raHandle.name = "orbit_ra_handle";
  root.add(raHandle);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 1e6;

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

  controls.addEventListener("change", () => invalidateOrbitView());
  window.addEventListener("resize", () => invalidateOrbitView());
  invalidateOrbitView();
}

function marker(color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 16), new THREE.MeshBasicMaterial({ color }));
  m.material.depthTest = false;
  m.renderOrder = 2;
  return m;
}

/** ドラッグで rp / ra が変わったときに呼ぶコールバックを登録する */
export function setOrbitViewHandlers(h) {
  handlers = h || {};
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setOrbitActiveHandle(which) {
  const next = which === "rp" || which === "ra" ? which : null;
  if (next === activeHandle) return;
  activeHandle = next;
  if (drag && drag.dragging() !== activeHandle) drag.cancel();
  updateHandles();
  invalidateOrbitView();
}

function activeHandleMesh() {
  if (activeHandle === "rp") return rpHandle;
  if (activeHandle === "ra") return raHandle;
  return null;
}

// 円錐曲線 r = p / (1 + e cos ν) 上の点。近点が +X、進行が反時計回り。
function conicPoint(p, e, nu) {
  const r = p / (1 + e * Math.cos(nu));
  return new THREE.Vector3(r * Math.cos(nu), r * Math.sin(nu), 0);
}

function conicPoints(p, e, nu0, nu1, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) pts.push(conicPoint(p, e, nu0 + ((nu1 - nu0) * k) / n));
  return pts;
}

// XY平面上の正方形グリッド (中心 cx, 一辺 2*half)
function planeGridGeometry(cx, half, divisions) {
  const pts = [];
  for (let k = 0; k <= divisions; k++) {
    const t = -half + (2 * half * k) / divisions;
    pts.push(new THREE.Vector3(cx + t, -half, 0), new THREE.Vector3(cx + t, half, 0));
    pts.push(new THREE.Vector3(cx - half, t, 0), new THREE.Vector3(cx + half, t, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

/**
 * 周回軌道ビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 天体の番号
 * @param {string} [params.key]  表示対象の識別子。変わったときだけ画角を取り直す
 * @param {"insert"|"escape"} params.kind 投入(減速)か脱出(加速)か
 * @param {number} params.rp    近点半径 [km]
 * @param {number} params.ra    遠点半径 [km]
 * @param {number} [params.vinf] 双曲線側のV∞ [km/s] (未確定なら双曲線は描かない)
 * @param {number} [params.dv]   近点ΔV [km/s]
 */
export function updateOrbitView({ planetNum, key, kind = "insert", rp, ra, vinf, dv }) {
  if (!scene) return;

  const R = planetNum != undefined && planetNum >= 0 ? planet_radius[planetNum] : undefined;
  const mu = planetNum != undefined && planetNum >= 0 ? planet_mu[planetNum] : undefined;
  const ready = R != undefined && mu != undefined && rp > 0 && ra >= rp;
  setVisible(ready);
  if (!ready) {
    geom = null;
    updateHandles();
    invalidateOrbitView();
    return;
  }

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);

  // すべて天体半径を1とした無次元で描く
  const rp_n = rp / R;
  const ra_n = ra / R;
  const a_n = (rp_n + ra_n) / 2;
  const e_e = ra_n > rp_n ? (ra_n - rp_n) / (ra_n + rp_n) : 0;
  const p_e = a_n * (1 - e_e * e_e);

  const keep_n = (min_flyby_rp(planetNum) ?? R) / R;
  keepOutSphere.scale.setScalar(keep_n);
  // 近点が下限より十分外なら、余計な線を出さない
  keepOutSphere.visible = rp_n < keep_n * 1.02;

  // --- 周回軌道 (楕円) ---
  const orbitPts = conicPoints(p_e, e_e, -Math.PI, Math.PI, 240);
  setLinePoints(orbitLine, orbitPts);

  // --- 双曲線 ---
  // 楕円と同じくらいの広さまで描くと、2つの軌道の関係が読み取りやすい
  const r_max = Math.max(ra_n * 1.05, rp_n * 6);
  const e_h = vinf > 0 ? 1 + (rp * vinf * vinf) / mu : undefined;
  let hyperPts = null;
  if (e_h != undefined && e_h > 1) {
    const p_h = rp_n * (1 + e_h);
    // 漸近線に達する真近点角。数値的にちょうど乗らないよう少し内側で止める
    const nu_inf = Math.acos(-1 / e_h);
    const c = (p_h / r_max - 1) / e_h;
    const nu_max = Math.min(nu_inf - 1e-3, Math.acos(Math.max(-1, Math.min(1, c))));
    // 投入は入ってくる側 (ν<0)、脱出は出ていく側 (ν>0) を描く
    hyperPts =
      kind === "escape"
        ? conicPoints(p_h, e_h, 0, nu_max, 160)
        : conicPoints(p_h, e_h, -nu_max, 0, 160);
    setLinePoints(hyperbolaLine, hyperPts);
    hyperbolaLine.visible = true;
  } else {
    hyperbolaLine.visible = false;
  }

  // --- 画面の広さと中心 ---
  // 天体は楕円の焦点なので、楕円の中心 (=近点から -X に a*e) を原点へ寄せる
  const center_x = -a_n * e_e;
  root.position.set(-center_x, 0, 0);

  let extent = a_n;
  const span = (pts) => {
    for (const p of pts) {
      extent = Math.max(extent, Math.hypot(p.x - center_x, p.y, p.z));
    }
  };
  span(orbitPts);
  if (hyperPts) span(hyperPts);

  const head = extent * 0.04;

  // --- 近点・遠点 ---
  const peri = new THREE.Vector3(rp_n, 0, 0);
  const apo = new THREE.Vector3(-ra_n, 0, 0);
  setLinePoints(rpLine, [new THREE.Vector3(), peri]);
  setLinePoints(raLine, [new THREE.Vector3(), apo]);
  periapsisMarker.position.copy(peri);
  apoapsisMarker.position.copy(apo);
  periapsisMarker.scale.setScalar(extent * 0.022);
  apoapsisMarker.scale.setScalar(extent * 0.022);
  // 円軌道では遠点は近点と区別できないので描かない
  const eccentric = ra_n > rp_n * 1.01;
  raLine.visible = eccentric;
  apoapsisMarker.visible = eccentric;

  // --- 進行方向 ---
  // 双曲線の途中に矢じるしを置く。投入(ν<0側)も脱出(ν>0側)も、探査機は真近点角が
  // 増える向きに進むので、点列の順方向がそのまま進行方向になる。
  if (hyperPts && hyperPts.length > 6) {
    const mid = Math.floor(hyperPts.length / 2);
    const tangent = new THREE.Vector3().subVectors(hyperPts[mid + 2], hyperPts[mid - 2]).normalize();
    travelArrowhead.position.copy(hyperPts[mid]);
    travelArrowhead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    travelArrowhead.scale.set(head * 0.55, head, head * 0.55);
    travelArrowhead.visible = true;
  } else {
    travelArrowhead.visible = false;
  }

  // --- 近点ΔV ---
  // 近点では速度は動径に垂直 (+Y)。投入は逆向きに噴いて減速、脱出は順向きに加速。
  // 長さは「双曲線の近点速度に対する割合」に比例させ、短すぎない下限を設ける。
  // 長さは画面の広さに対する割合で決める。遠点を広げると軌道は桁で大きくなるので、
  // 天体の大きさを基準にすると矢印が見えなくなってしまう。
  const v_hyp = vinf > 0 ? Math.sqrt(vinf * vinf + (2 * mu) / rp) : undefined;
  const frac = v_hyp && dv > 0 ? Math.min(dv / v_hyp, 1) : 0;
  const dv_len = extent * (0.08 + 0.25 * frac);
  const dv_dir = kind === "escape" ? 1 : -1;
  setArrow(dvArrow, peri, peri.clone().add(new THREE.Vector3(0, dv_dir * dv_len, 0)), head * 1.2, 0.3, 0.5);
  dvArrow.visible = frac > 0;

  // --- 軌道面 ---
  planeGrid.geometry.dispose();
  planeGrid.geometry = planeGridGeometry(0, extent, 8);

  geom = { rp_n, ra_n, R, extent, center_x };
  updateHandles();

  // 画角の取り直しは、表示対象が変わったときと、規模が桁で変わったときだけ。
  // 遠点を少し動かすたびにカメラが動くと大きさの感覚が崩れる。
  const scaled = lastFitExtent > 0 ? extent / lastFitExtent : Infinity;
  if (key !== lastViewKey || scaled > REFIT_RATIO || scaled < 1 / REFIT_RATIO) {
    lastViewKey = key;
    fitCamera(extent);
  }
  invalidateOrbitView();
}

// ハンドルの位置と、動かせる向きを示す補助線を引き直す
function updateHandles() {
  if (!rpHandle) return;

  const ready = geom != null;
  const showRp = ready && activeHandle === "rp";
  const showRa = ready && activeHandle === "ra";
  rpHandle.visible = showRp;
  rpGuide.visible = showRp;
  raHandle.visible = showRa;
  raGuide.visible = showRa;
  if (!ready) return;

  if (showRp) {
    // 伸び縮みする向き = 近点方向 (+X)
    rpHandle.position.set(geom.rp_n, 0, 0);
    setLinePoints(rpGuide, [new THREE.Vector3(), new THREE.Vector3(Math.max(geom.rp_n * 2, geom.extent * 0.5), 0, 0)]);
  }

  if (showRa) {
    // 伸び縮みする向き = 遠点方向 (-X)
    raHandle.position.set(-geom.ra_n, 0, 0);
    setLinePoints(raGuide, [new THREE.Vector3(), new THREE.Vector3(-geom.extent * 1.6, 0, 0)]);
  }

  scaleHandleToScreen(rpHandle, camera, renderer);
  scaleHandleToScreen(raHandle, camera, renderer);
}

// ハンドルをドラッグしている間の反映
function applyDrag(key, raycaster) {
  if (!geom) return;
  // 軸は天体 (root の原点) を通る。root は楕円の中心合わせでずらしてあるので、
  // その分を軸の通る点として渡す。
  const origin = root.position;

  if (key === "rp") {
    const t = closestOnAxis(raycaster, new THREE.Vector3(1, 0, 0), origin);
    if (t == undefined) return;
    if (handlers.onRp) handlers.onRp(Math.max(0, t) * geom.R);
    return;
  }

  const t = closestOnAxis(raycaster, new THREE.Vector3(-1, 0, 0), origin);
  if (t == undefined) return;
  if (handlers.onRa) handlers.onRa(Math.max(0, t) * geom.R);
}

// 全体が画角に収まる距離にカメラを置き直す
function fitCamera(extent) {
  lastFitExtent = extent;
  const fitDist = (extent * 1.3) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  controls.minDistance = fitDist * 0.02;
  controls.maxDistance = fitDist * 8;
  // 軌道の規模は天体半径の数倍から数百倍まで変わる。near/far を固定にすると
  // 大きい軌道で深度の分解能が足りなくなり、天体の陰影がちらつく。
  camera.near = fitDist * 1e-3;
  camera.far = fitDist * 100;
  camera.updateProjectionMatrix();
}

function setVisible(visible) {
  planetMesh.visible = visible;
  planeGrid.visible = visible;
  orbitLine.visible = visible;
  rpLine.visible = visible;
  periapsisMarker.visible = visible;
  if (!visible) {
    keepOutSphere.visible = false;
    hyperbolaLine.visible = false;
    raLine.visible = false;
    apoapsisMarker.visible = false;
    dvArrow.visible = false;
    travelArrowhead.visible = false;
  }
}

// 周回軌道ビューも絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)。
// 周回軌道投入/軌道脱出以外のノードを選んでいる間は非表示なので何もしない。
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  if (!renderer.domElement.offsetParent) return;
  resizeToDisplaySize();
  if (controls) controls.update();
  scaleHandleToScreen(rpHandle, camera, renderer);
  scaleHandleToScreen(raHandle, camera, renderer);
  renderer.render(scene, camera);
});

/** 周回軌道ビューを描き直す予約を入れる */
export function invalidateOrbitView(frames) {
  loop.invalidate(frames);
}
