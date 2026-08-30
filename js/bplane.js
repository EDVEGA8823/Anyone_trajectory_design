import { planet_radius, planet_mu, min_flyby_rp } from './trajectory.js';
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
  intersectPlane,
  makeRenderLoop,
} from './view3d.js';

// スイングバイ操作パネル用の小さな3Dビュー。
// 通過天体を中心に、実際の双曲線軌道がB面(入射漸近線に垂直で天体中心を通る平面)を
// 貫く様子を描画し、近点半径rp・回転角β・近点ΔV、および天体の公転方向を
// 視覚化する。太陽方向は矢印では描かず、平行光の向きとして陰影に反映する。
// メインの太陽系ビュー(plot.js)とは独立した専用のシーンを持つ。
//
// 【座標系】天体半径=1の無次元スケールで描画する。描画フレームは
//   入射漸近線の進行方向 = -Z、B面 = XY平面、β=0の基準 = +X
// 実際の物理フレーム(i_hat=入射V∞方向, j_hat, k_hat)との対応は toDrawing() を参照。

export let renderer, scene, camera, controls;

let planetMesh, keepOutSphere, eclipticPlane, bplaneGroup, hyperbolaLine, asymptoteArrow, travelArrowhead;
let pierceMarker, periapsisMarker, rpLine, betaArc, betaRefLine, bVectorLine, coastHyperbola;
let orbitArrow, dvArrow;
let root, sunLight;
let lastViewKey; // いま表示しているノード。切り替わったときだけ画角を取り直す

// --- マウスで掴んで rp / β を変えるためのハンドル ---
// 常に掴めるものが出ていると視界とカメラ操作の邪魔になるので、右側の
// 対応する欄を選んでいる間だけ、その欄のハンドルを表示する。
//   rp   : 近点方向(半径方向)に伸び縮みするハンドル
//   beta : B面内をぐるっと回るハンドル
let rpHandle, betaHandle, rpGuide, betaGuide;
let activeHandle = null; // null | "rp" | "beta"
let drag = null; // view3d.js のドラッグ下回り
let handlers = {}; // { onRp(rp[km]), onBeta(beta[rad]) }
let geom = null; // 直近の描画スケール (ハンドルの配置とドラッグの換算に使う)

// 黄道面グリッドは「軌道の傾きを読むための背景」なので、どの縮尺でも画面を
// 覆えていないと役に立たない。単位は天体半径 (このビューは天体半径=1で描く)。
//
// 以前は広さを固定 (天体半径25個ぶん) していた。地球のスイングバイなら十分だが、
// 木星のように接近距離が天体半径の何十倍にもなると、中身のほうがはるかに大きく
// なってグリッドは中央の小さな敷物にしか見えなくなる (近点20半径で、中身の
// 12%しか覆えていなかった)。
//
// そこで、目の数は固定したまま目の大きさだけをきりの良い値から選び、中身の
// ECLIPTIC_MARGIN 倍を覆うようにする。目の数が変わらないので、どの天体でも
// 同じ粗さの背景になる。
const ECLIPTIC_CELLS = 28; // 一辺の目の数 (見た目の粗さはこれで一定になる)
const ECLIPTIC_MARGIN = 4; // 描いた中身の何倍まで敷くか (引いても端が見えないように)
const ECLIPTIC_CELL_STEPS = [0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
let eclipticCell = 0; // いま張ってある目の大きさ

// キャンバスは操作パネルの空きに合わせて伸縮する正方形。大きさは
// 下の resizeToDisplaySize が毎フレーム決める。
const CANVAS_MAX = 460;
const CANVAS_BORDER = 1; // CSSで引いている境界線の太さ
let resizeToDisplaySize;

const COLOR_ORBIT = 0x1a1c20;
const COLOR_ASYMPTOTE = 0xa1a4ad;
const COLOR_BPLANE = 0x3b6fe0;
const COLOR_RP = 0xd6543f;
const COLOR_BETA = 0xe0a03b;
const COLOR_DV = 0x9b4fd8;
const COLOR_PLANET_ORBIT = 0x4caf82;
const COLOR_COAST = 0x8a8f99; // 近点ΔVを打たなかった場合の出射側

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initBPlane() {
  const canvas = document.getElementById("bplane_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();

  // 表示の向きは「天体の公転方向を画面右(+X)、天の北極方向を画面上(+Y)」に固定する。
  // カメラを動かすとOrbitControlsの回転軸(camera.upから一度だけ決まる)と噛み合わず、
  // ユーザーの手動回転も打ち消してしまうため、代わりに中身をまとめて回転させる。
  // 剛体回転なので双曲線の幾何はそのまま保たれる。
  root = new THREE.Group();
  scene.add(root);

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
  // カメラ自体は世界座標に固定したまま(rootだけを回すので)なので、ここで決めた
  // 向きが常に成り立つ。公転方向(+X)が手前左下から奥右上に抜けて見えるよう、
  // カメラを -X,-Y 側(やや-Yを弱めに)・+Z側に置く。
  camera.position.set(-0.6, -0.35, 0.8).setLength(10);
  camera.lookAt(0, 0, 0);

  // 陰影のコントラストを出すため環境光は控えめにし、太陽方向の平行光を強くする
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));
  sunLight = new THREE.DirectionalLight(0xfff4e0, 2.1);
  sunLight.position.set(0, 1, 0);
  root.add(sunLight);
  root.add(sunLight.target);

  // 黄道面 (天の北極方向に垂直な、太陽系全体の基準面)。ごく薄いグレーの
  // グリッドとして、B面や近点のスケールに比べてずっと広く描く。
  // 広さは fitEcliptic が決め、向きは毎回のupdateBPlaneでnorthHatに合わせる。
  eclipticPlane = new THREE.LineSegments(
    squareGridGeometry(1, ECLIPTIC_CELLS),
    new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.16, depthWrite: false })
  );
  eclipticPlane.name = "ecliptic";
  eclipticPlane.renderOrder = -1;
  root.add(eclipticPlane);

  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.62, metalness: 0.0 })
  );
  root.add(planetMesh);

  // 通過禁止領域 (大気・放射線帯を避けるための最小近点半径)
  keepOutSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 24),
    new THREE.MeshBasicMaterial({ color: COLOR_RP, transparent: true, opacity: 0.12, wireframe: true })
  );
  root.add(keepOutSphere);

  // B面(正方形)とその外枠・グリッド
  bplaneGroup = new THREE.Group();
  root.add(bplaneGroup);

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: COLOR_BPLANE, transparent: true, opacity: 0.09, side: THREE.DoubleSide })
  );
  plane.name = "bplane_face";
  bplaneGroup.add(plane);

  const frame = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(-1, 1, 0),
    ]),
    new THREE.LineBasicMaterial({ color: COLOR_BPLANE, transparent: true, opacity: 0.55 })
  );
  frame.name = "bplane_frame";
  bplaneGroup.add(frame);

  const grid = new THREE.LineSegments(
    squareGridGeometry(1, 4),
    new THREE.LineBasicMaterial({ color: COLOR_BPLANE, transparent: true, opacity: 0.22 })
  );
  grid.name = "bplane_grid";
  bplaneGroup.add(grid);

  betaRefLine = makeLine([new THREE.Vector3()], COLOR_ASYMPTOTE, 0.7);
  bplaneGroup.add(betaRefLine);

  bVectorLine = makeLine([new THREE.Vector3()], COLOR_BPLANE, 0.95);
  bplaneGroup.add(bVectorLine);

  betaArc = makeLine([new THREE.Vector3()], COLOR_BETA, 1);
  bplaneGroup.add(betaArc);

  pierceMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_BPLANE })
  );
  bplaneGroup.add(pierceMarker);

  hyperbolaLine = makeLine([new THREE.Vector3()], COLOR_ORBIT, 1);
  hyperbolaLine.name = "hyperbola";
  root.add(hyperbolaLine);

  // 近点ΔVを打たなかった場合の出射側。実際に飛ぶ経路(実線)と区別できるよう
  // 破線にする (太陽系ビューの「マヌーバ未実行」の破線と同じ考え方)。
  coastHyperbola = makeDashedLine([new THREE.Vector3()], COLOR_COAST, 0.9);
  coastHyperbola.name = "coast_hyperbola";
  root.add(coastHyperbola);

  // 探査機の進行方向 (双曲線の出射側先端に付ける矢じるし)。
  // 軌道本体(COLOR_ORBIT=ほぼ黒)と同じ色だと重なって見分けがつかないため、
  // はっきり明るい色にする。
  travelArrowhead = new THREE.Mesh(
    new THREE.ConeGeometry(1, 1, 16),
    new THREE.MeshBasicMaterial({ color: 0x5b6472 })
  );
  travelArrowhead.material.depthTest = false;
  travelArrowhead.renderOrder = 2;
  root.add(travelArrowhead);

  asymptoteArrow = makeArrow(COLOR_ASYMPTOTE, 0.55);
  root.add(asymptoteArrow);

  periapsisMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_RP })
  );
  root.add(periapsisMarker);

  rpLine = makeLine([new THREE.Vector3()], COLOR_RP, 1);
  root.add(rpLine);

  // 天体の進行方向 (公転方向)
  orbitArrow = makeArrow(COLOR_PLANET_ORBIT, 0.85);
  root.add(orbitArrow);

  // 太陽方向は陰影(平行光の向き)で示すので、線としては描画しない。
  // 太陽光自体は updateBPlane 内の applyOrientation で毎回向きを更新する。

  // 近点ΔV。近点は天体表面のすぐ外側になることが多く、そのままだと
  // 天体に隠れてしまうので、他の線と同様に深度テストを切って手前に描く。
  dvArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, COLOR_DV, 0.25, 0.14);
  dvArrow.name = "dv_arrow";
  dvArrow.line.material.depthTest = false;
  dvArrow.cone.material.depthTest = false;
  dvArrow.renderOrder = 2;
  root.add(dvArrow);

  // rp / β をマウスで動かすためのハンドルと、動かせる向きを示す補助線
  rpGuide = makeLine([new THREE.Vector3()], COLOR_RP, 0.35);
  root.add(rpGuide);
  rpHandle = makeHandle(COLOR_RP);
  rpHandle.name = "rp_handle";
  root.add(rpHandle);

  betaGuide = makeLine([new THREE.Vector3()], COLOR_BETA, 0.45);
  root.add(betaGuide);
  betaHandle = makeHandle(COLOR_BETA);
  betaHandle.name = "beta_handle";
  root.add(betaHandle);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 400;

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

  controls.addEventListener("change", () => invalidateBPlane());
  window.addEventListener("resize", () => invalidateBPlane());
  invalidateBPlane();
}

/** ドラッグでrp/βが変わったときに呼ぶコールバックを登録する */
export function setBPlaneHandlers(h) {
  handlers = h || {};
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setBPlaneActiveHandle(which) {
  const next = which === "rp" || which === "beta" ? which : null;
  if (next === activeHandle) return;
  activeHandle = next;
  if (drag && drag.dragging() !== activeHandle) drag.cancel();
  updateHandles();
}

function activeHandleMesh() {
  if (activeHandle === "rp") return rpHandle;
  if (activeHandle === "beta") return betaHandle;
  return null;
}

// ハンドルの位置と、動かせる向きを示す補助線を引き直す
function updateHandles() {
  if (!rpHandle) return;

  const ready = geom != undefined && hyperbolaLine.visible;
  const showRp = ready && activeHandle === "rp";
  const showBeta = ready && activeHandle === "beta";
  rpHandle.visible = showRp;
  rpGuide.visible = showRp;
  betaHandle.visible = showBeta;
  betaGuide.visible = showBeta;
  if (!ready) return;

  if (showRp) {
    rpHandle.position.copy(geom.periapsis);
    // 伸び縮みする向き = 天体中心から近点へ向かう半径線
    const far = Math.max(geom.rp_n * 2.2, geom.extent * 0.8);
    setLinePoints(rpGuide, [new THREE.Vector3(), geom.P_hat.clone().multiplyScalar(far)]);
  }

  if (showBeta) {
    betaHandle.position.copy(geom.pierce);
    // 回る向き = B面内の、Bベクトルの長さの円
    const pts = [];
    for (let k = 0; k <= 72; k++) {
      const t = (2 * Math.PI * k) / 72;
      pts.push(new THREE.Vector3(geom.b_n * Math.cos(t), geom.b_n * Math.sin(t), 0));
    }
    setLinePoints(betaGuide, pts);
  }

  // 表示に切り替わった最初のフレームで大きすぎる状態が見えないよう、
  // ここでも画面上の大きさを合わせておく
  scaleHandleToScreen(rpHandle, camera, renderer);
  scaleHandleToScreen(betaHandle, camera, renderer);
  invalidateBPlane();
}

// ハンドルをドラッグしている間の反映
function applyDrag(key, raycaster) {
  if (!geom) return;

  if (key === "rp") {
    // 近点方向は rp によってもわずかに回るので、毎回いまの向きを軸に取る
    const axis = geom.P_hat.clone().applyQuaternion(root.quaternion).normalize();
    const t = closestOnAxis(raycaster, axis);
    if (t == undefined) return;
    const rp = Math.max(geom.minRp, t * geom.radius);
    if (handlers.onRp) handlers.onRp(rp);
    return;
  }

  // B面(root座標のXY平面)との交点を root のローカル座標で見る
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
  const hit = intersectPlane(raycaster, n);
  if (!hit) return;
  const p = root.worldToLocal(hit);
  if (p.lengthSq() < 1e-12) return;
  // 描画側は bHat = (cos β, -sin β, 0) なので符号を戻す
  if (handlers.onBeta) handlers.onBeta(-Math.atan2(p.y, p.x));
}

// B面ビューは絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)。
// スイングバイ以外のノードを選んでいる間はそもそも非表示なので、その間は
// 描画予約が入っても何もしない。
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  if (!renderer.domElement.offsetParent) return;
  resizeToDisplaySize();
  if (controls) controls.update();
  scaleHandleToScreen(rpHandle, camera, renderer);
  scaleHandleToScreen(betaHandle, camera, renderer);
  renderer.render(scene, camera);
});

/** B面ビューを描き直す予約を入れる */
export function invalidateBPlane(frames) {
  loop.invalidate(frames);
}

/**
 * 物理フレームのベクトルを描画フレームに移す。
 *
 * swingby()の規約では出射V∞の偏向方向は d = j_hat*cos(beta) + k_hat*sin(beta) であり、
 * 双曲線の幾何上その反対側にBベクトルが来る。描画側で b_hat=(cos b,-sin b,0) と
 * 取ると、対応する回転は i_hat->(0,0,-1), j_hat->(-1,0,0), k_hat->(0,1,0)
 * (行列式+1の正しい回転)となり、成分では次式になる。
 */
function toDrawing(w, i_hat, j_hat, k_hat) {
  const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return new THREE.Vector3(-d(w, j_hat), d(w, k_hat), -d(w, i_hat));
}

/**
 * B面ビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 通過天体の番号
 * @param {string} [params.key]     表示対象の識別子。これが変わったときだけ
 *                                  カメラの画角を取り直す (rp/betaの変更では動かさない)
 * @param {number} [params.rp]      近点半径 [km]
 * @param {number} [params.beta]    B面内での回転角 [rad]
 * @param {number} [params.vinf]    入射V∞ [km/s]
 * @param {number} [params.vinfOut] 脱出V∞ [km/s]。近点ΔVを打つ自動モードでは
 *                                  入射と値が変わり、出射側が別の双曲線になる
 * @param {number} [params.turnDeficit] rpが下限でクランプされて足りない曲げ角 [rad]。
 *                                  この分は近点ΔVで向きを変えることになるので、
 *                                  ΔVの向きに効く
 * @param {number} [params.dv]      近点ΔV [km/s]
 * @param {number[]} [params.planetVel] 天体の太陽中心速度 [km/s]
 * @param {number[]} [params.planetPos] 天体の太陽中心位置 [km]
 * @param {number[]} [params.iHat] 物理フレーム基底 (swingby_info由来)
 * @param {number[]} [params.jHat]
 * @param {number[]} [params.kHat]
 */
export function updateBPlane({ planetNum, key, rp, beta = 0, vinf, vinfOut, turnDeficit = 0, dv = 0, planetVel, planetPos, iHat, jHat, kHat }) {
  if (!scene || planetNum == undefined || planetNum == -1) return;

  const radius = planet_radius[planetNum];
  const mu = planet_mu[planetNum];
  if (radius == undefined || mu == undefined) return;

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);
  keepOutSphere.scale.setScalar(min_flyby_rp(planetNum) / radius);

  const hasOrbit = rp != undefined && rp > 0 && vinf != undefined && vinf > 0;
  setOrbitVisible(hasOrbit);
  if (!hasOrbit) {
    setContextVisible(false);
    geom = undefined;
    updateHandles();
    return;
  }

  // --- 双曲線のパラメータ (天体半径=1に無次元化) ---
  const rp_n = rp / radius;
  const a_n = -mu / (vinf * vinf) / radius; // 負
  const e = 1 - rp_n / a_n;
  const b_n = Math.abs(a_n) * Math.sqrt(e * e - 1);
  const nu_inf = Math.acos(-1 / e);

  // 入射漸近線の進行方向は -Z、Bベクトルは B面(XY)内で β に対応する向き。
  // (β の回り方を swingby() の規約に合わせるため Y成分の符号を反転している)
  const bHat = new THREE.Vector3(Math.cos(beta), -Math.sin(beta), 0);
  const inHat = new THREE.Vector3(0, 0, -1);

  // 軌道面内の基底 P_hat(近点方向) / Q_hat(近点から90度進んだ方向) を逆算する。
  //   inHat = -cos(nu_inf)*P + sin(nu_inf)*Q
  //   bHat  =  sin(nu_inf)*P + cos(nu_inf)*Q
  // この変換行列は行列式-1の対称行列(=自己逆行列)なので、同じ係数で逆に解ける。
  const cn = Math.cos(nu_inf);
  const sn = Math.sin(nu_inf);
  const P_hat = new THREE.Vector3().addScaledVector(inHat, -cn).addScaledVector(bHat, sn).normalize();
  const Q_hat = new THREE.Vector3().addScaledVector(inHat, sn).addScaledVector(bHat, cn).normalize();

  // --- B面(正方形) ---
  const halfSize = Math.max(b_n * 1.3, rp_n * 1.6);

  // --- 双曲線本体 ---
  // 真近点角で切ると漸近線近くで急に遠方へ飛んでいくため、動径がビューの
  // 大きさを超えたところで切る。こうすると常に画面内に収まる。
  const rMax = halfSize * 2.3;
  // 近点から真近点角 nu の点 (軌道要素 e, p から)
  const conicPoint = (e_b, p_b, nu) => {
    const r = p_b / (1 + e_b * Math.cos(nu));
    return new THREE.Vector3().addScaledVector(P_hat, r * Math.cos(nu)).addScaledVector(Q_hat, r * Math.sin(nu));
  };
  // 動径が rMax を超えない範囲での真近点角の上限
  const clipNu = (e_b, p_b) => {
    const cosClip = (p_b / rMax - 1) / e_b;
    const nu_inf_b = Math.acos(-1 / e_b);
    return Math.min(Math.acos(Math.max(-1, Math.min(1, cosClip))), nu_inf_b * 0.995);
  };
  const branch = (e_b, p_b, nu0, nu1, N = 80) =>
    Array.from({ length: N + 1 }, (_, k) => conicPoint(e_b, p_b, nu0 + ((nu1 - nu0) * k) / N));

  const p_n = a_n * (1 - e * e);
  const nuMax = clipNu(e, p_n);

  // --- 出射側 ---
  // 自動モード(パワード・フライバイ)では近点でΔVを打つので、出射側は入射側とは
  // 別の双曲線になる。近点の位置と進行方向(動径に垂直)は噴射の前後で共通なので、
  // 同じ P_hat / rp のまま、エネルギー(=脱出V∞)だけが違う枝として描ける。
  //
  // rpが下限でクランプされて曲げ角が足りない場合、Missionは不足分を近点ΔVの
  // 向き変更で補う前提でΔVを見積もっている。ただしその向き変更を実際に加えると
  // 噴射点は出射側の近点ではなくなり、自由飛行の分だけ余計に曲がってしまう
  // (曲げ角が要求値を通り越す)。ここでは幾何として辻褄の合う2本
  // (入射側・出射側とも近点を共有する双曲線)を描き、足りない分は
  // 右側の「曲げ不足」の数値に任せる。
  const vinf_out = vinfOut != undefined && vinfOut > 0 ? vinfOut : vinf;
  const a_out = -mu / (vinf_out * vinf_out) / radius;
  const e_out = 1 - rp_n / a_out;
  const p_out = a_out * (1 - e_out * e_out);
  const nuMaxOut = clipNu(e_out, p_out);

  const inPts = branch(e, p_n, -nuMax, 0);
  const outPts = branch(e_out, p_out, 0, nuMaxOut);
  const pts = inPts.concat(outPts.slice(1));
  setLinePoints(hyperbolaLine, pts);

  // ΔVを打たなかった場合の出射側 (無推力なら入射と同じ双曲線の鏡像になる)。
  // ΔVがほぼ無い手動モードでは実際の経路と重なるだけなので描かない。
  const powered = Math.abs(vinf_out - vinf) > 1e-6;
  if (powered) {
    // 破線の刻みは場面の大きさに合わせる (固定だと縮尺次第で実線に見えてしまう)
    coastHyperbola.material.dashSize = halfSize * 0.06;
    coastHyperbola.material.gapSize = halfSize * 0.04;
    setLinePoints(coastHyperbola, branch(e, p_n, 0, nuMax));
  }
  coastHyperbola.visible = powered;

  // 探査機の進行方向を示す矢じるし。双曲線は曲がっているのでArrowHelperではなく、
  // 出射側の末尾2点から接線方向を取り、そこに小さな円錐を向けて置く。
  const tail = pts[pts.length - 1];
  const tangent = new THREE.Vector3().subVectors(tail, pts[pts.length - 2]).normalize();
  const headLen = Math.min(rp_n * 0.5, halfSize * 0.12);
  travelArrowhead.position.copy(tail);
  travelArrowhead.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  travelArrowhead.scale.set(headLen * 0.55, headLen, headLen * 0.55);
  travelArrowhead.visible = true;

  // --- 入射漸近線 (進行方向 = inHat の矢印) ---
  const pierce = bHat.clone().multiplyScalar(b_n);
  const far = rMax;
  setArrow(
    asymptoteArrow,
    pierce.clone().addScaledVector(inHat, -far),
    pierce.clone().addScaledVector(inHat, far * 0.3),
    headLen
  );
  bplaneGroup.getObjectByName("bplane_face").scale.setScalar(halfSize);
  bplaneGroup.getObjectByName("bplane_frame").scale.setScalar(halfSize);
  bplaneGroup.getObjectByName("bplane_grid").scale.setScalar(halfSize);

  setLinePoints(betaRefLine, [new THREE.Vector3(), new THREE.Vector3(halfSize, 0, 0)]);
  setLinePoints(bVectorLine, [new THREE.Vector3(), pierce.clone()]);
  pierceMarker.position.copy(pierce);

  // βの円弧 (基準線 +X から Bベクトルまで。bHatのY反転に合わせて -beta 方向に振る)
  const arcR = Math.min(Math.max(b_n * 0.45, rp_n * 0.5), halfSize * 0.5);
  const arcPts = [];
  for (let k = 0; k <= 48; k++) {
    const t = (-beta * k) / 48;
    arcPts.push(new THREE.Vector3(arcR * Math.cos(t), arcR * Math.sin(t), 0));
  }
  setLinePoints(betaArc, arcPts);

  // --- 近点と rp ---
  const periapsis = P_hat.clone().multiplyScalar(rp_n);
  periapsisMarker.position.copy(periapsis);
  setLinePoints(rpLine, [new THREE.Vector3(), periapsis]);

  // rMax(双曲線・漸近線の描画範囲)も含めて、実際に描いた内容全体が画角に
  // 収まるようにする
  const extent = Math.max(halfSize, rp_n, b_n, rMax);

  // マウスのハンドル用に、いまの縮尺と掴む点を控えておく
  geom = {
    radius,
    minRp: min_flyby_rp(planetNum),
    P_hat: P_hat.clone(),
    periapsis: periapsis.clone(),
    pierce: pierce.clone(),
    rp_n,
    b_n,
    extent,
  };
  updateHandles();

  // --- 近点ΔV ---
  // 噴射前の速度は近点なので動径に垂直 (= Q_hat 方向)。噴射後の速度は
  //   ・大きさ: 脱出V∞に対応する近点速度 (減速することも多い)
  //   ・向き  : 曲げ角が足りているなら同じく Q_hat。rpが下限でクランプされて
  //             足りない場合は、その不足分だけ曲がる向き(+Q から -P 側)に回す
  // なので ΔV = v_out - v_in は必ずしも順行方向ではない。
  //   ΔV = Q(vp_out cos td - vp_in) - P(vp_out sin td)
  // (この大きさは Mission 側の余弦定理による dv_periapsis と一致する)
  if (dv > 1e-9) {
    const vp = Math.sqrt(vinf * vinf + (2 * mu) / rp);
    const vp_out = Math.sqrt(vinf_out * vinf_out + (2 * mu) / rp);
    const td = turnDeficit ?? 0;
    const dvVec = Q_hat.clone()
      .multiplyScalar(vp_out * Math.cos(td) - vp)
      .addScaledVector(P_hat, -vp_out * Math.sin(td));
    if (dvVec.lengthSq() < 1e-18) dvVec.copy(Q_hat);
    // ΔVの大きさを近点速度との比で表し、見やすい長さに写像する
    // 近点付近は天体スケールなので、ビュー全体の大きさだけで決めると小さすぎる。
    // 近点半径も下限の基準に入れて、常に読み取れる長さにする。
    const len = Math.min(
      Math.max((dv / vp) * rp_n * 6, extent * 0.12, rp_n * 0.6),
      extent * 0.6
    );
    dvArrow.position.copy(periapsis);
    dvArrow.setDirection(dvVec.normalize());
    dvArrow.setLength(len, len * 0.32, len * 0.18);
    dvArrow.visible = true;
  } else {
    dvArrow.visible = false;
  }

  // --- 天体の公転方向・太陽方向(陰影用)・天の北極方向 ---
  const haveFrame = iHat && jHat && kHat;
  let vHat, sHat, northHat;

  if (haveFrame && planetVel) {
    const vn = Math.hypot(planetVel[0], planetVel[1], planetVel[2]);
    if (vn > 1e-12) {
      vHat = toDrawing([planetVel[0] / vn, planetVel[1] / vn, planetVel[2] / vn], iHat, jHat, kHat);
      const L = extent * 1.5;
      // 手前(-L)から矢じるし(+L)まで。天体を通り抜けて進行方向を示す
      setArrow(orbitArrow, vHat.clone().multiplyScalar(-L), vHat.clone().multiplyScalar(L), extent * 0.22, 0.12, 0.4);
      orbitArrow.visible = true;
    } else orbitArrow.visible = false;
  } else orbitArrow.visible = false;

  if (haveFrame && planetPos) {
    const rn = Math.hypot(planetPos[0], planetPos[1], planetPos[2]);
    // 天体から見た太陽の方向 = -r_pla。線には描かず、陰影(平行光)にのみ使う。
    if (rn > 1e-12) sHat = toDrawing([-planetPos[0] / rn, -planetPos[1] / rn, -planetPos[2] / rn], iHat, jHat, kHat);
  }

  if (haveFrame) {
    // 黄道面の法線(=天の北極方向)。太陽系全体で共通の固定ベクトル[0,0,1]。
    northHat = toDrawing([0, 0, 1], iHat, jHat, kHat);
    // 黄道面は向きだけここで合わせる (広さは fitEcliptic が決める)
    eclipticPlane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), northHat);
    eclipticPlane.visible = true;
  } else {
    eclipticPlane.visible = false;
  }

  applyOrientation(vHat, sHat, northHat);

  const view_changed = key !== lastViewKey;
  // 黄道面グリッドは中身より広く保つ (ノードを選び直したときは合わせ直す)
  fitEcliptic(extent, view_changed);

  // 画角を取り直すのは表示するノードが変わったときだけ。
  // rpやβを変えるたびにカメラが動くと、見ている大きさの感覚が崩れて
  // 操作しづらいので、パラメータの変更ではズームを一切動かさない。
  if (view_changed) {
    lastViewKey = key;
    fitCamera(extent);
  }

  invalidateBPlane();
}

/**
 * 黄道面グリッドを、いまの縮尺に合わせて敷き直す。
 * 目の数は変えず、目の大きさだけをきりの良い値から選ぶので、どの天体でも
 * 同じ粗さの背景になる。
 *
 * rpを大きく動かすと中身だけがグリッドを追い越してしまうので、広げる側は
 * 毎回追従する。逆に縮める側はノードを選び直したときだけにしてある
 * (ドラッグの途中でグリッドが縮むと、目の大きさが変わってちらつくため)。
 *
 * @param {boolean} reset 縮める向きにも合わせ直すか
 */
function fitEcliptic(extent, reset) {
  const want = (extent * ECLIPTIC_MARGIN * 2) / ECLIPTIC_CELLS;
  const cell = ECLIPTIC_CELL_STEPS.find((s) => s >= want) ?? ECLIPTIC_CELL_STEPS[ECLIPTIC_CELL_STEPS.length - 1];
  if (cell === eclipticCell || (!reset && cell < eclipticCell)) return;
  eclipticCell = cell;
  eclipticPlane.geometry.dispose();
  eclipticPlane.geometry = squareGridGeometry((cell * ECLIPTIC_CELLS) / 2, ECLIPTIC_CELLS);
}

// 全体が画角に収まる距離にカメラを置き直す
function fitCamera(extent) {
  const fitDist = (extent * 1.25) / Math.tan((camera.fov * Math.PI) / 180 / 2);
  camera.position.setLength(fitDist);
  // ズームの範囲は「合わせた距離」を基準に広めに取る。実際の規模(extent)に
  // 追従させると、rpを変えた拍子に現在のカメラ位置が範囲外になって飛んでしまう。
  controls.minDistance = fitDist * 0.1;
  controls.maxDistance = fitDist * 30;
}

/**
 * 中身をまとめて回転させ、表示の基準を天の北極方向と天体の公転方向に合わせる。
 *   天の北極方向(黄道面の法線, 固定)        -> 画面上 (+Y)
 *   公転方向の北極直交成分                  -> 画面右 (+X)
 *   (X,Y)の外積                            -> 手前   (+Z)
 * 太陽方向は(北極とは無関係に)実際の向きのまま矢印で表示する。
 * 平行光も太陽方向に置き直す(rootの子なので回転後も太陽側から当たる)。
 * ベクトルが無い/北極と公転方向がほぼ平行(縮退)の場合は回転を掛けない。
 */
function applyOrientation(vHat, sHat, northHat) {
  if (!vHat || !northHat) return;

  const y = northHat.clone().normalize();
  // 公転方向から北極成分を抜いたものを画面右方向にする
  const x = vHat.clone().addScaledVector(y, -vHat.dot(y));
  if (x.lengthSq() < 1e-12) return; // 公転方向が北極とほぼ平行(縮退。極軌道など)
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();

  // x,y,zを行にした行列が、描画フレーム -> 表示フレーム の回転になる
  const m = new THREE.Matrix4().set(
    x.x, x.y, x.z, 0,
    y.x, y.y, y.z, 0,
    z.x, z.y, z.z, 0,
    0, 0, 0, 1
  );
  root.setRotationFromMatrix(m);

  // 光源は回転前(root内)の座標で置くので、描画フレームでの太陽方向をそのまま使う
  if (sHat) {
    sunLight.position.copy(sHat).setLength(50);
    sunLight.target.position.set(0, 0, 0);
  }
}

function setOrbitVisible(visible) {
  hyperbolaLine.visible = visible;
  if (!visible) coastHyperbola.visible = false;
  travelArrowhead.visible = visible;
  asymptoteArrow.visible = visible;
  pierceMarker.visible = visible;
  periapsisMarker.visible = visible;
  rpLine.visible = visible;
  betaArc.visible = visible;
  betaRefLine.visible = visible;
  bVectorLine.visible = visible;
  bplaneGroup.visible = visible;
  if (!visible) dvArrow.visible = false;
}

function setContextVisible(visible) {
  orbitArrow.visible = visible;
  if (!visible) eclipticPlane.visible = false;
}
