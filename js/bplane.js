import { planet_radius, planet_mu } from './trajectory.js';

// スイングバイ操作パネル用の小さな3Dビュー。
// 通過天体とB面(入射方向に垂直な、天体中心を通る平面)、
// 通過安全境界(天体半径+最低通過高度)、狙い点(rp, betaから決まる)を表示する。
// メインの太陽系ビュー(plot.js)とは完全に独立した、専用のレンダラー/シーンを持つ。

export let renderer, scene, camera, controls;

let planetMesh, keepOutRing, aimMarker;

const CANVAS_SIZE = 180;

// 見た目用の天体の色 (State.planet_list と同じ並び順)。実際の質感ではなく
// パッと見て天体を区別できるようにするための簡易的な配色。
const PLANET_COLORS = [
  0x9c9c9c, // 水星
  0xe0c58f, // 金星
  0x3a7bd5, // 地球
  0xc1440e, // 火星
  0xd9a066, // 木星
  0xe4d2a4, // 土星
  0x9fd8e0, // 天王星
  0x4f6fd8, // 海王星
  0xc9b28a, // 冥王星
];

export function initBPlane() {
  const canvas = document.getElementById("bplane_canvas");
  if (!canvas) return;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(CANVAS_SIZE, CANVAS_SIZE, false);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  camera.position.set(3.2, 2.4, 3.4);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 0.7);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  // 天体本体
  planetMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshStandardMaterial({ color: 0x3a7bd5 }));
  scene.add(planetMesh);

  // B面 (グリッド)。天体中心を通り、入射方向に垂直な平面。
  const grid = new THREE.GridHelper(8, 16, 0x3b6fe0, 0xc7d3ea);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  // B面のξ軸・η軸 (方向の目安。実際の座標軸ラベルは今後の右側UIで補足する)
  scene.add(makeAxisLine(0xd6543f, 4)); // ξ方向 (X軸)
  scene.add(makeAxisLine(0x3b6fe0, 4, true)); // η方向 (Z軸)

  // 通過安全境界 (天体半径 + 最低通過高度の目安)
  keepOutRing = new THREE.Mesh(
    new THREE.RingGeometry(1, 1.05, 64),
    new THREE.MeshBasicMaterial({ color: 0xd6543f, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  keepOutRing.rotation.x = -Math.PI / 2;
  scene.add(keepOutRing);

  // 狙い点 (rp, betaから決まるB面上の位置)
  aimMarker = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  aimMarker.position.set(3, 0, 0);
  scene.add(aimMarker);

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 14;

  animate();
}

function makeAxisLine(color, length, zAxis = false) {
  const a = zAxis ? new THREE.Vector3(0, 0, -length) : new THREE.Vector3(-length, 0, 0);
  const b = zAxis ? new THREE.Vector3(0, 0, length) : new THREE.Vector3(length, 0, 0);
  const geometry = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

/**
 * B面ビューの表示内容を更新する。
 * @param {object} params
 * @param {number} params.planetNum  通過天体の番号 (State.planet_list のインデックス)
 * @param {number} [params.rp]       近点半径 [km]
 * @param {number} [params.beta]     b面内での回転角 [rad]
 * @param {number} [params.vinf]     入射V∞ [km/s] (わかれば実際のB(狙い点までの距離)を計算する)
 */
export function updateBPlane({ planetNum, rp, beta = 0, vinf }) {
  if (!scene || planetNum == undefined || planetNum == -1) return;

  const radius = planet_radius[planetNum];
  const mu = planet_mu[planetNum];
  if (radius == undefined) return;

  planetMesh.material.color.setHex(PLANET_COLORS[planetNum] ?? 0xddaa44);

  // 通過安全境界の半径 (天体半径に対する比)
  const safeRatio = rp != undefined ? rp / radius : 1.03;
  keepOutRing.geometry.dispose();
  keepOutRing.geometry = new THREE.RingGeometry(Math.max(safeRatio - 0.03, 0.02), safeRatio, 64);

  // 狙い点までの距離B (天体半径を1とした比)。B = rp * sqrt(1 + 2mu/(rp*vinf^2))
  // vinf(入射V∞)が分かっていない場合は、見た目用の仮の値を使う。
  let B_over_R = 3;
  if (rp != undefined && mu != undefined && vinf) {
    const B = rp * Math.sqrt(1 + (2 * mu) / (rp * vinf * vinf));
    B_over_R = B / radius;
  } else if (rp != undefined) {
    B_over_R = Math.max(rp / radius, 1.05);
  }

  aimMarker.position.set(B_over_R * Math.cos(beta), 0, B_over_R * Math.sin(beta));
}
