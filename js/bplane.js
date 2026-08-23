import { planet_radius, planet_mu, min_flyby_rp } from './trajectory.js';

// スイングバイ操作パネル用の小さな3Dビュー。
// 通過天体を中心に、実際の双曲線軌道がB面(入射漸近線に垂直な、天体中心を通る平面)を
// 貫く様子を描画し、近点半径rpと回転角βがどこを指すのかを視覚化する。
// メインの太陽系ビュー(plot.js)とは完全に独立した、専用のレンダラー/シーンを持つ。

export let renderer, scene, camera, controls;

let planetMesh, keepOutSphere, bplaneGroup, hyperbolaLine, asymptoteLine;
let pierceMarker, periapsisMarker, rpLine, betaArc, betaRefLine, bVectorLine;

const CANVAS_SIZE = 180;

// 天体半径を1とした無次元スケールで描画する。
const R = 1;

const COLOR_ORBIT = 0x1a1c20;
const COLOR_ASYMPTOTE = 0xa1a4ad;
const COLOR_BPLANE = 0x3b6fe0;
const COLOR_RP = 0xd6543f;
const COLOR_BETA = 0xe0a03b;

// 見た目用の天体の色 (State.planet_list と同じ並び順)
const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

export function initBPlane() {
  const canvas = document.getElementById("bplane_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
  camera.position.set(7, 5, 7);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 0.6);
  key.position.set(3, 5, 2);
  scene.add(key);

  // 通過天体
  planetMesh = new THREE.Mesh(
    new THREE.SphereGeometry(R, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.85 })
  );
  scene.add(planetMesh);

  // 通過禁止領域 (大気・放射線帯を避けるための最小近点半径)
  keepOutSphere = new THREE.Mesh(
    new THREE.SphereGeometry(R, 24, 24),
    new THREE.MeshBasicMaterial({ color: COLOR_RP, transparent: true, opacity: 0.12, wireframe: true })
  );
  scene.add(keepOutSphere);

  // B面まわりの要素はまとめて回転させたいのでグループにする。
  // グループのローカル座標系では、入射漸近線方向が -Z、B面が XY平面。
  bplaneGroup = new THREE.Group();
  scene.add(bplaneGroup);

  // B面(円盤)とその外周
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(1, 48),
    new THREE.MeshBasicMaterial({ color: COLOR_BPLANE, transparent: true, opacity: 0.1, side: THREE.DoubleSide })
  );
  disk.name = "bplane_disk";
  bplaneGroup.add(disk);

  const rim = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(circlePoints(1, 48)),
    new THREE.LineBasicMaterial({ color: COLOR_BPLANE, transparent: true, opacity: 0.5 })
  );
  rim.name = "bplane_rim";
  bplaneGroup.add(rim);

  // β=0 の基準線 (B面内のT軸方向)。βはこの線からの回転角。
  betaRefLine = makeLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], COLOR_ASYMPTOTE, 0.7);
  bplaneGroup.add(betaRefLine);

  // B ベクトル (天体中心 → 漸近線がB面を貫く点)
  bVectorLine = makeLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)], COLOR_BPLANE, 0.95);
  bplaneGroup.add(bVectorLine);

  // βを示す円弧 (基準線からBベクトルまで)
  betaArc = makeLine([new THREE.Vector3(0, 0, 0)], COLOR_BETA, 1);
  bplaneGroup.add(betaArc);

  // 漸近線がB面を貫く点
  pierceMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_BPLANE })
  );
  bplaneGroup.add(pierceMarker);

  // 双曲線軌道そのもの
  hyperbolaLine = makeLine([new THREE.Vector3(0, 0, 0)], COLOR_ORBIT, 1);
  scene.add(hyperbolaLine);

  // 入射漸近線 (B面を貫く直線)
  asymptoteLine = makeLine([new THREE.Vector3(0, 0, 0)], COLOR_ASYMPTOTE, 0.55);
  scene.add(asymptoteLine);

  // 近点マーカーと、天体中心→近点を結ぶ線 (これが rp)
  periapsisMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 16, 16),
    new THREE.MeshBasicMaterial({ color: COLOR_RP })
  );
  scene.add(periapsisMarker);

  rpLine = makeLine([new THREE.Vector3(0, 0, 0)], COLOR_RP, 1);
  scene.add(rpLine);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 3;
  controls.maxDistance = 60;

  animate();
}

function makeLine(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  return line;
}

function setLinePoints(line, points) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function circlePoints(radius, segments) {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(radius * Math.cos(t), radius * Math.sin(t), 0));
  }
  return pts;
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

/**
 * B面ビューの表示内容を更新する。
 *
 * 描画は天体半径を1とした無次元スケールで行う。ワールド座標系の取り方は
 *   入射漸近線方向 = -Z、B面 = XY平面、β=0の基準方向 = +X
 * とし、双曲線はこの座標系の中で解析的に描く。
 *
 * @param {object} params
 * @param {number} params.planetNum 通過天体の番号 (State.planet_list のインデックス)
 * @param {number} [params.rp]      近点半径 [km]
 * @param {number} [params.beta]    B面内での回転角 [rad]
 * @param {number} [params.vinf]    入射V∞ [km/s]
 */
export function updateBPlane({ planetNum, rp, beta = 0, vinf }) {
  if (!scene || planetNum == undefined || planetNum == -1) return;

  const radius = planet_radius[planetNum];
  const mu = planet_mu[planetNum];
  if (radius == undefined || mu == undefined) return;

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);

  // 通過禁止球 (最小近点半径)
  const minRp = min_flyby_rp(planetNum);
  keepOutSphere.scale.setScalar(minRp / radius);

  // rp・vinfが未確定なら描けないので、天体と禁止領域だけ表示して終わる
  const hasOrbit = rp != undefined && rp > 0 && vinf != undefined && vinf > 0;
  setVisible(hasOrbit);
  if (!hasOrbit) return;

  // --- 双曲線のパラメータ (天体半径=1に無次元化) ---
  const rp_n = rp / radius;
  const a_n = -mu / (vinf * vinf) / radius; // 負
  const e = 1 - rp_n / a_n;
  const b_n = Math.abs(a_n) * Math.sqrt(e * e - 1); // 衝突パラメータ = |B|
  const nu_inf = Math.acos(-1 / e); // 漸近線に対応する真近点角

  // --- 近点方向の座標系を作る ---
  // 入射漸近線の進行方向は -Z、Bベクトルの向きは β で決まる XY平面内の方向。
  // 軌道面は (入射漸近線, Bベクトル) が張る平面。
  const bHat = new THREE.Vector3(Math.cos(beta), Math.sin(beta), 0); // B面内のBベクトル方向
  const inHat = new THREE.Vector3(0, 0, -1); // 入射漸近線の進行方向

  // 軌道面内の基底 P_hat(近点方向) / Q_hat(近点から90度進んだ方向) を逆算する。
  // 真近点角 nu=-nu_inf で無限遠から入ってくる幾何から、
  //   inHat = -cos(nu_inf)*P + sin(nu_inf)*Q
  //   bHat  =  sin(nu_inf)*P + cos(nu_inf)*Q
  // が成り立つ。この変換行列は行列式-1の対称行列(=自己逆行列)なので、
  // 同じ係数で逆に解ける。
  const cn = Math.cos(nu_inf);
  const sn = Math.sin(nu_inf);
  const P_hat = new THREE.Vector3()
    .addScaledVector(inHat, -cn)
    .addScaledVector(bHat, sn)
    .normalize();
  const Q_hat = new THREE.Vector3()
    .addScaledVector(inHat, sn)
    .addScaledVector(bHat, cn)
    .normalize();

  // --- 双曲線本体を描く ---
  const pts = [];
  const nuMax = nu_inf * 0.985; // 漸近線に漸近する手前まで
  const N = 160;
  for (let k = 0; k <= N; k++) {
    const nu = -nuMax + (2 * nuMax * k) / N;
    const r = (a_n * (1 - e * e)) / (1 + e * Math.cos(nu));
    pts.push(
      new THREE.Vector3()
        .addScaledVector(P_hat, r * Math.cos(nu))
        .addScaledVector(Q_hat, r * Math.sin(nu))
    );
  }
  setLinePoints(hyperbolaLine, pts);

  // --- 入射漸近線: B面上の貫通点を通り、入射方向に伸びる直線 ---
  const pierce = bHat.clone().multiplyScalar(b_n);
  const far = Math.max(b_n * 1.6, rp_n * 3);
  setLinePoints(asymptoteLine, [
    pierce.clone().addScaledVector(inHat, -far),
    pierce.clone().addScaledVector(inHat, far * 0.35),
  ]);

  // --- B面(円盤・外周・基準線・Bベクトル・βの弧) ---
  // グループ自体は回さず、要素をB面(XY平面)内で組み立てる。
  const diskScale = Math.max(b_n * 1.25, rp_n * 1.5);
  bplaneGroup.getObjectByName("bplane_disk").scale.setScalar(diskScale);
  bplaneGroup.getObjectByName("bplane_rim").scale.setScalar(diskScale);

  setLinePoints(betaRefLine, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(diskScale, 0, 0)]);
  setLinePoints(bVectorLine, [new THREE.Vector3(0, 0, 0), pierce.clone()]);
  pierceMarker.position.copy(pierce);

  // βの円弧 (基準線 +X から Bベクトル方向まで)
  const arcR = Math.min(b_n * 0.45, diskScale * 0.4);
  const arcPts = [];
  const steps = 40;
  for (let k = 0; k <= steps; k++) {
    const t = (beta * k) / steps;
    arcPts.push(new THREE.Vector3(arcR * Math.cos(t), arcR * Math.sin(t), 0));
  }
  setLinePoints(betaArc, arcPts);

  // --- 近点と rp ---
  const periapsis = P_hat.clone().multiplyScalar(rp_n);
  periapsisMarker.position.copy(periapsis);
  setLinePoints(rpLine, [new THREE.Vector3(0, 0, 0), periapsis]);

  // 全体が収まるようにカメラの距離感を調整する
  const extent = Math.max(diskScale, rp_n, b_n) * 2.4;
  controls.minDistance = extent * 0.5;
  controls.maxDistance = extent * 6;
  if (camera.position.length() > extent * 6 || camera.position.length() < extent * 0.5) {
    camera.position.setLength(extent * 1.6);
  }
}

function setVisible(visible) {
  hyperbolaLine.visible = visible;
  asymptoteLine.visible = visible;
  pierceMarker.visible = visible;
  periapsisMarker.visible = visible;
  rpLine.visible = visible;
  betaArc.visible = visible;
  betaRefLine.visible = visible;
  bVectorLine.visible = visible;
  bplaneGroup.visible = visible;
}
