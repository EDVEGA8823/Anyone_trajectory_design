import { planet_radius, planet_mu, min_flyby_rp } from './trajectory.js';
import {
  makeLine,
  makeDashedLine,
  setLinePoints,
  makeArrowTrail,
  setArrowTrailOnCircles,
  scaleArrowTrail,
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
// 【座標系】1単位 = 天体半径。軌道面は水平 (XZ平面) に寝かせ、カメラは上から
// 見下ろす。近点方向を +X、進行方向を画面上で反時計回り(近点での速度が -Z)に取る。
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
let coastHyperbola;
let rpHandle, raHandle, rpGuide, raGuide;

let activeHandle = null; // null | "rp" | "ra"
let drag = null;
let handlers = {}; // { onRp(rp[km]), onRa(ra[km]) }
let geom = null; // 直近の描画状態 (ハンドルの配置とドラッグの換算に使う)
let lastViewKey;
let gridHalf = 0; // いま張ってある軌道面グリッドの半幅 (双曲線もここまで引く)
let resizeToDisplaySize;

const CANVAS_MAX = 460;
const CANVAS_BORDER = 1;

// 軌道面グリッドの広さ (画角を合わせたときの表示範囲に対する倍率) と目の数。
// 後から遠点を広げても外へはみ出しにくいよう、最初から広めに敷いておく。
const GRID_SPAN = 3;
const GRID_DIVISIONS = 24;

const COLOR_ORBIT = 0x3b6fe0; // 周回軌道 (楕円)
const COLOR_HYPERBOLA = 0x1a1c20; // 双曲線 (B面ビューの軌道と同じ色)
const COLOR_COAST = 0x8a8f99; // 近点ΔVを打たなかった場合 (B面ビューと同じ)
const COLOR_RP = 0xd6543f;
const COLOR_RA = 0xe0a03b;
const COLOR_DV = 0x9b4fd8;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initOrbitView() {
  const canvas = document.getElementById("orbit_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  root = new THREE.Group();
  scene.add(root);

  camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100000);
  // 水平に寝かせた軌道面を上から見下ろす。真上だとOrbitControlsの回転軸と
  // 重なって操作が不安定になるので、少しだけ手前(+Z)に倒す。
  camera.position.set(0, 1, 0.42).setLength(30);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.4);
  sunLight.position.set(0.5, 1, 0.6);
  scene.add(sunLight);

  // 軌道面。広さは画角を合わせるときにだけ決め、rp/raを動かしても変えない
  // (掴んで動かしている最中にグリッドが伸び縮みすると縮尺の感覚が崩れる)。
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

  // 実際に飛ぶ経路は実線。周回軌道投入では「近点で噴かなかった場合にそのまま
  // 飛び去る側」を灰色の破線で足して、噴射の有無で何が変わるのかを見せる
  // (B面ビューの「ΔV未実施」と同じ流儀)。
  hyperbolaLine = makeLine([new THREE.Vector3()], COLOR_HYPERBOLA, 1);
  hyperbolaLine.name = "hyperbola";
  root.add(hyperbolaLine);

  coastHyperbola = makeDashedLine([new THREE.Vector3()], COLOR_COAST, 0.9);
  coastHyperbola.name = "coast_hyperbola";
  root.add(coastHyperbola);

  orbitLine = makeLine([new THREE.Vector3()], COLOR_ORBIT, 1);
  orbitLine.name = "parking_orbit";
  root.add(orbitLine);

  // 進行方向の矢じるし。双曲線はグリッドの端まで引くので、途中に何個か置く
  travelArrowhead = makeArrowTrail(0x5b6472, 2);
  root.add(travelArrowhead);

  rpLine = makeLine([new THREE.Vector3()], COLOR_RP, 1);
  root.add(rpLine);
  raLine = makeLine([new THREE.Vector3()], COLOR_RA, 1);
  root.add(raLine);

  periapsisMarker = marker(COLOR_RP);
  root.add(periapsisMarker);
  apoapsisMarker = marker(COLOR_RA);
  root.add(apoapsisMarker);

  // 近点ΔV。このビューの主役なので、線ではなく太さのあるメッシュで描く。
  // 天体のすぐ外側になるので、他の線と同様に深度テストを切って手前に出す。
  dvArrow = makeThickArrow(COLOR_DV);
  dvArrow.name = "dv_arrow";
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

/**
 * 太さのある矢印。ArrowHelperの線は環境によらず1px固定で細く、ΔVのように
 * 「まずこれを見てほしい」ものには弱いので、円柱(軸)と円錐(頭)で作る。
 * 既定の向きは +Y。setThickArrow で位置・向き・長さを与える。
 */
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
  // CylinderもConeも原点中心なので、根元が0に来るよう半分ずらす
  shaft.scale.set(radius, shaftLen, radius);
  shaft.position.set(0, shaftLen / 2, 0);
  head.scale.set(radius * 2.4, headLen, radius * 2.4);
  head.position.set(0, shaftLen + headLen / 2, 0);
  arrow.position.copy(from);
  arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
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

// 円錐曲線 r = p / (1 + e cos ν) 上の点。軌道面は水平(XZ)で、近点が +X。
// 上から見下ろすと真近点角が増える向き = 反時計回りになる。
function conicPoint(p, e, nu) {
  const r = p / (1 + e * Math.cos(nu));
  return new THREE.Vector3(r * Math.cos(nu), 0, -r * Math.sin(nu));
}

function conicPoints(p, e, nu0, nu1, n) {
  const pts = [];
  for (let k = 0; k <= n; k++) pts.push(conicPoint(p, e, nu0 + ((nu1 - nu0) * k) / n));
  return pts;
}

// 水平面(XZ)上の正方形グリッド (中心 cx, 一辺 2*half)
function planeGridGeometry(cx, half, divisions) {
  const pts = [];
  for (let k = 0; k <= divisions; k++) {
    const t = -half + (2 * half * k) / divisions;
    pts.push(new THREE.Vector3(cx + t, 0, -half), new THREE.Vector3(cx + t, 0, half));
    pts.push(new THREE.Vector3(cx - half, 0, t), new THREE.Vector3(cx + half, 0, t));
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

  // --- 画面の広さと中心 ---
  // 天体は楕円の焦点なので、楕円の中心 (=近点から -X に a*e) を原点へ寄せる
  const center_x = -a_n * e_e;
  root.position.set(-center_x, 0, 0);

  // 画角に合わせる広さ。双曲線は「楕円と同じくらいの広さ」までで測る
  // (実際にはグリッドの端まで引くが、そこまで画角に入れると楕円が小さくなる)
  const r_fit = Math.max(ra_n * 1.05, rp_n * 6);
  let extent = a_n;
  const span = (pts) => {
    for (const p of pts) {
      extent = Math.max(extent, Math.hypot(p.x - center_x, p.y, p.z));
    }
  };
  span(orbitPts);
  const e_h = vinf > 0 ? 1 + (rp * vinf * vinf) / mu : undefined;
  const hyperbolic = e_h != undefined && e_h > 1;
  if (hyperbolic) extent = Math.max(extent, r_fit + Math.abs(center_x));

  // 軌道面グリッドの広さ。画角と同じく、表示対象が変わったときだけ決め直す
  const view_changed = key !== lastViewKey;
  if (view_changed || !(gridHalf > 0)) {
    gridHalf = extent * GRID_SPAN;
    planeGrid.geometry.dispose();
    planeGrid.geometry = planeGridGeometry(0, gridHalf, GRID_DIVISIONS);
  }

  // --- 双曲線 ---
  // 途中でぷつりと終わると「ここで止まる軌道」に見えるので、軌道面グリッドの
  // 端まで引く (画角の外まで伸びるぶんは、引けば見える)。
  //
  // 長さの基準をグリッドにするのが肝心で、そのときの extent にすると
  // 遠点を縮めたときに双曲線まで一緒に縮んでしまう。双曲線の形は近点とV∞だけで
  // 決まり、遠点とは何の関係も無いので、遠点をいじって長さが変わるのはおかしい。
  // (遠点を広げて楕円がグリッドを追い越した場合だけは、双曲線もそれに合わせる)
  const r_max = Math.max(gridHalf, extent * 1.6);
  let hyperPts = null;
  let coastPts = null;
  if (hyperbolic) {
    const p_h = rp_n * (1 + e_h);
    // 漸近線に達する真近点角。数値的にちょうど乗らないよう少し内側で止める
    const nu_inf = Math.acos(-1 / e_h);
    const c = (p_h / r_max - 1) / e_h;
    const nu_max = Math.min(nu_inf - 1e-4, Math.acos(Math.max(-1, Math.min(1, c))));
    // 実際に飛ぶ側を実線で描く。投入は入ってくる側 (ν<0)、脱出は出ていく側 (ν>0)。
    hyperPts =
      kind === "escape"
        ? conicPoints(p_h, e_h, 0, nu_max, 200)
        : conicPoints(p_h, e_h, -nu_max, 0, 200);
    setLinePoints(hyperbolaLine, hyperPts);
    hyperbolaLine.visible = true;

    // 投入では「近点で噴かなかった場合」= 同じ双曲線をそのまま出ていく側を破線で。
    // 脱出では噴かなければ周回軌道に留まるだけ(=実線の楕円)なので、描かない。
    if (kind === "escape") {
      coastHyperbola.visible = false;
    } else {
      coastPts = conicPoints(p_h, e_h, 0, nu_max, 200);
      coastHyperbola.visible = true;
    }
  } else {
    hyperbolaLine.visible = false;
    coastHyperbola.visible = false;
  }

  if (coastPts) {
    // 破線の目の粗さは軌道の規模に合わせる (固定だと大きい軌道でほぼ実線に見える)
    coastHyperbola.material.dashSize = extent * 0.025;
    coastHyperbola.material.gapSize = extent * 0.018;
    setLinePoints(coastHyperbola, coastPts);
  }

  // --- 近点・遠点 ---
  const peri = new THREE.Vector3(rp_n, 0, 0);
  const apo = new THREE.Vector3(-ra_n, 0, 0);
  setLinePoints(rpLine, [new THREE.Vector3(), peri]);
  setLinePoints(raLine, [new THREE.Vector3(), apo]);
  periapsisMarker.position.copy(peri);
  apoapsisMarker.position.copy(apo);
  periapsisMarker.scale.setScalar(extent * 0.022);
  apoapsisMarker.scale.setScalar(extent * 0.022);

  // --- 進行方向 ---
  // 探査機は真近点角が増える向きに進むので、点列の順方向がそのまま進行方向。
  // 線はグリッドの端まで伸びているので、先端ではなく途中に何個か置く。
  // 近点にはΔVの矢印が出るので、そこは避ける (投入なら末尾、脱出なら先頭が近点)。
  if (hyperPts && hyperPts.length > 6) {
    travelArrowhead.visible = true;
    // 画面の中心と端のあいだあたりに置く (画角の半幅 ≒ extent*1.3)。
    // 双曲線はここでは片側だけなので、その帯の中に2つ並べる
    setArrowTrailOnCircles(
      travelArrowhead,
      hyperPts,
      [extent * 0.5, extent * 0.85],
      new THREE.Vector3(center_x, 0, 0)
    );
  } else {
    travelArrowhead.visible = false;
  }

  // --- 近点ΔV ---
  // 近点では速度は動径に垂直で、この置き方だと -Z が進行方向になる。
  // 投入は逆向きに噴いて減速 (+Z)、脱出は順向きに加速 (-Z)。
  // 長さは画面の広さに対する割合で決める。遠点を広げると軌道は桁で大きくなるので、
  // 天体の大きさを基準にすると矢印が見えなくなってしまう。
  const v_hyp = vinf > 0 ? Math.sqrt(vinf * vinf + (2 * mu) / rp) : undefined;
  const frac = v_hyp && dv > 0 ? Math.min(dv / v_hyp, 1) : 0;
  const dv_len = extent * (0.12 + 0.35 * frac);
  const dv_dir = kind === "escape" ? -1 : 1;
  setThickArrow(dvArrow, peri, new THREE.Vector3(0, 0, dv_dir), dv_len, extent * 0.016);
  dvArrow.visible = frac > 0;

  geom = { rp_n, ra_n, R, extent, center_x };
  updateHandles();

  // 画角を取り直すのは表示するノードが変わったときだけ (B面ビューと同じ)。
  // rpやraを変えるたびにカメラが動くと、見ている大きさの感覚が崩れて操作しづらい。
  if (key !== lastViewKey) {
    lastViewKey = key;
    fitCamera(extent);
  }
  invalidateOrbitView();
}

// ハンドルの位置と、動かせる向きを示す補助線を引き直す。
// 近点・遠点の印 (球と半径線) も、掴めるのがどれか分かるよう、その欄を選んで
// いる間だけ出す。常に出していると、掴めない印まで操作対象に見えてしまう。
function updateHandles() {
  if (!rpHandle) return;

  const ready = geom != null;
  const showRp = ready && activeHandle === "rp";
  // 円軌道 (遠点=近点) でも遠点のハンドルは出す。ここで隠すと、いったん円に
  // してしまうとマウスでは遠点を広げ直せなくなってしまう。
  const showRa = ready && activeHandle === "ra";
  rpHandle.visible = showRp;
  rpGuide.visible = showRp;
  rpLine.visible = showRp;
  periapsisMarker.visible = showRp;
  raHandle.visible = showRa;
  raGuide.visible = showRa;
  raLine.visible = showRa;
  apoapsisMarker.visible = showRa;
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
  // グリッドの張り替えは updateOrbitView 側で行う (双曲線の長さもそこで
  // グリッドに合わせるので、順番が要る)
  const fitDist = (extent * 1.3) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  // 画角は以後取り直さないので、ズームで自力で追えるよう範囲を広く取る
  controls.minDistance = fitDist * 0.02;
  controls.maxDistance = fitDist * 50;
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
  // 近点・遠点の印はどの欄を選んでいるかで決まるので updateHandles が持つ
  if (!visible) {
    keepOutSphere.visible = false;
    hyperbolaLine.visible = false;
    coastHyperbola.visible = false;
    rpLine.visible = false;
    periapsisMarker.visible = false;
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
  // 矢じるしは画面上の大きさを保つ (view3d.js の scaleArrowTrail を参照)
  scaleArrowTrail(travelArrowhead, camera, renderer, 10);
  renderer.render(scene, camera);
});

/** 周回軌道ビューを描き直す予約を入れる */
export function invalidateOrbitView(frames) {
  loop.invalidate(frames);
}
