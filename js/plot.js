import { State, PlotState } from './state.js';
import { AU } from './trajectory.js';

export let renderer, scene, camera, sun, labelRenderer, controls;

// css/elements.css の --header-height / --canvas-padding と一致させること
const HEADER_HEIGHT = 64;
const CANVAS_PADDING = 24;

const axis = [];
const xticks0_1 = [], yticks0_1 = [], zticks0_1 = [];
const xticks1 = [], yticks1 = [], zticks1 = [];
const xticks5 = [], yticks5 = [], zticks5 = [];

export function initPlot() {
  const plot_area = document.getElementById("graph-panel");

  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#plot"),
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(PlotState.width, PlotState.height);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(30, PlotState.width / PlotState.height, 0.01, 50000);
  camera.position.set(0, PlotState.camera_dist, 0);

  const aLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(aLight);

  const sunGeometry = new THREE.SphereGeometry(0.07, 32, 32);
  const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xeeee22 });
  sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(plot_area.clientWidth, plot_area.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = CANVAS_PADDING + "px";
  labelRenderer.domElement.style.left = CANVAS_PADDING + "px";
  plot_area.appendChild(labelRenderer.domElement);

  controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
  controls.enablePan = false;
  controls.maxDistance = 200;

  axis.push(createLine([new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -50, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 0, 50)], 0xaaaaaa));

  for (let i = -5; i < 5; i = i + 0.1) {
    xticks0_1.push(createLine([new THREE.Vector3(i, 0, -0.05), new THREE.Vector3(i, 0, 0.05)], 0xaaaaaa));
    yticks0_1.push(createLine([new THREE.Vector3(0, i, -0.05), new THREE.Vector3(0, i, 0.05)], 0xaaaaaa));
    zticks0_1.push(createLine([new THREE.Vector3(-0.05, 0, i), new THREE.Vector3(0.05, 0, i)], 0xaaaaaa));
  }
  for (let i = -20; i < 20; i = i + 1) {
    if (i == 0) continue;
    xticks1.push(createLine([new THREE.Vector3(i, 0, -0.2), new THREE.Vector3(i, 0, 0.2)], 0xaaaaaa));
    yticks1.push(createLine([new THREE.Vector3(0, i, -0.2), new THREE.Vector3(0, i, 0.2)], 0xaaaaaa));
    zticks1.push(createLine([new THREE.Vector3(-0.2, 0, i), new THREE.Vector3(0.2, 0, i)], 0xaaaaaa));
  }
  for (let i = -50; i < 50; i = i + 5) {
    if (i == 0) continue;
    xticks5.push(createLine([new THREE.Vector3(i, 0, -1), new THREE.Vector3(i, 0, 1)], 0xaaaaaa));
    yticks5.push(createLine([new THREE.Vector3(0, i, -1), new THREE.Vector3(0, i, 1)], 0xaaaaaa));
    zticks5.push(createLine([new THREE.Vector3(-1, 0, i), new THREE.Vector3(1, 0, i)], 0xaaaaaa));
  }

  for (let i = -50; i < 50; i++) {
    if (i == 0) continue;
    if (i % 5 != 0 && (i < -10 || i > 10)) continue;
    
    const ticks_label_x = document.createElement("div");
    ticks_label_x.className = i % 5 != 0 ? "label_1au_x" : "label_5au_x";
    ticks_label_x.textContent = Math.abs(i) + "AU";
    ticks_label_x.style.backgroundColor = "transparent";
    axis[1].line.layers.enableAll();
    const Label_x = new THREE.CSS2DObject(ticks_label_x);
    Label_x.position.set(i, 0, i % 5 != 0 ? 0.3 : 1.3);
    axis[1].line.add(Label_x);
    Label_x.layers.set(0);

    const ticks_label_y = document.createElement("div");
    ticks_label_y.className = i % 5 != 0 ? "label_1au_y" : "label_5au_y";
    ticks_label_y.textContent = Math.abs(i) + "AU";
    ticks_label_y.style.backgroundColor = "transparent";
    const Label_y = new THREE.CSS2DObject(ticks_label_y);
    Label_y.position.set(0, i % 5 != 0 ? i + 0.04 : i + 0.5, 0);
    axis[1].line.add(Label_y);
    Label_y.layers.set(0);

    const ticks_label_z = document.createElement("div");
    ticks_label_z.className = i % 5 != 0 ? "label_1au_z" : "label_5au_z";
    ticks_label_z.textContent = Math.abs(i) + "AU";
    ticks_label_z.style.backgroundColor = "transparent";
    const Label_z = new THREE.CSS2DObject(ticks_label_z);
    Label_z.position.set(i % 5 != 0 ? 0.3 : 1.3, 0, i);
    axis[1].line.add(Label_z);
    Label_z.layers.set(0);
  }

  for (let i = 0; i < 3; i++) {
    const marker = new THREE.SphereGeometry(0.03, 32, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: i == 1 ? 0x55d8ff : 0x0059b3 });
    const marker_sphere = new THREE.Mesh(marker, markerMaterial);
    marker_sphere.position.set(i, 0, 0);
    marker_sphere.visible = false;
    PlotState.marker_spheres.push(marker_sphere);
    scene.add(marker_sphere);
  }

  createVinfArrow();

  controls.addEventListener("change", update_camera);
  window.addEventListener("resize", updateLayout);

  updateLayout();
  // CSS2DObjectのDOM要素はCSS2DRendererが一度レンダリングするまで実際の
  // document には挿入されない。update_camera()は document.getElementsByClassName
  // でラベル要素を取得して不透明度を設定するため、先に一度描画しておかないと
  // 初期状態ではラベルがまだ見つからず設定が空振りしてしまう
  // (=カメラを操作するまで軸ラベルの透明化が効かない不具合の原因だった)。
  labelRenderer.render(scene, camera);
  update_camera();
  animate();
}

// --- 打上げのV∞ベクトル ---
// 出発天体から伸びる矢印として太陽系ビューに描く。
// 長さは |V∞| に比例させるが、同時にカメラ距離にも比例させて、ズームしても
// 画面上の見え方が変わらないようにする (惑星マーカーの拡大と同じ考え方)。
// これで、内惑星を見ている縮尺でも外惑星まで引いた縮尺でも同じ操作感になる。
const VINF_COLOR = 0xff8c1a;
const VINF_AU_PER_KMS = 0.12; // camera_dist = 7 のときの 1 km/s あたりの長さ [AU]
const VINF_CAMERA_DIST_REF = 7;
// 現実的なV∞(数km/s)では長さをそのまま比例させたいが、遷移がうまく繋がって
// いないときは数十km/sにもなり、比例のままだと矢印が画面外まで伸びてしまう。
// tanhで頭打ちにして、通常の範囲ではほぼ比例・大きいところでは飽和させる
// (単調なので、後でマウスで長さから大きさを決めるときも一意に戻せる)。
const VINF_SOFT_KMS = 12;
let vinf_arrow;
let vinf_state = null; // { pos: Vector3, dir: Vector3, mag } (描画座標系)

function createVinfArrow() {
  vinf_arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, VINF_COLOR, 0.2, 0.1);
  // 惑星の公転軌道や遷移軌道と重なっても隠れないよう、他の線と同様に手前に描く
  vinf_arrow.line.material.depthTest = false;
  vinf_arrow.cone.material.depthTest = false;
  vinf_arrow.renderOrder = 3;
  vinf_arrow.visible = false;
  scene.add(vinf_arrow);
}

/**
 * V∞の矢印を出発天体の位置に置き直す。
 * @param {number[]} pos   出発天体の太陽中心位置 [km]
 * @param {number[]} v_inf V∞ベクトル [km/s] (太陽中心慣性系)
 */
export function updateVinfArrow(pos, v_inf) {
  if (!vinf_arrow) return;
  const mag = Math.hypot(v_inf[0], v_inf[1], v_inf[2]);
  if (!(mag > 1e-9)) {
    hideVinfArrow();
    return;
  }
  vinf_state = {
    pos: new THREE.Vector3(pos[0] / AU, pos[2] / AU, -pos[1] / AU),
    // 描画座標系は (x, z, -y)。方向だけなのでAUへの換算は不要。
    dir: new THREE.Vector3(v_inf[0], v_inf[2], -v_inf[1]).normalize(),
    mag,
  };
  vinf_arrow.visible = true;
  applyVinfScale();
}

export function hideVinfArrow() {
  vinf_state = null;
  if (vinf_arrow) vinf_arrow.visible = false;
}

// いまのカメラ距離に合わせて矢印の長さを取り直す
function applyVinfScale() {
  if (!vinf_arrow || !vinf_state) return;
  const shown = VINF_SOFT_KMS * Math.tanh(vinf_state.mag / VINF_SOFT_KMS);
  const len = shown * VINF_AU_PER_KMS * (PlotState.camera_dist / VINF_CAMERA_DIST_REF);
  vinf_arrow.position.copy(vinf_state.pos);
  vinf_arrow.setDirection(vinf_state.dir);
  vinf_arrow.setLength(len, len * 0.24, len * 0.13);
}

export function createPlanets(planet_pos) {
  const sphereGeometry = new THREE.SphereGeometry(0.02, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xddaa44 });
  sphereMaterial.transparent = false;

  planet_pos.forEach((pos, i) => {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    const planetDiv = document.createElement("div");
    planetDiv.className = "label_planet";
    planetDiv.textContent = State.planet_list[i];
    planetDiv.style.backgroundColor = "transparent";
    planetDiv.style.marginTop = "-1.2em";
    planetDiv.style.cursor = "pointer";

    const planetLabel = new THREE.CSS2DObject(planetDiv);
    planetLabel.position.set(0, 0, 0);
    sphere.add(planetLabel);
    planetLabel.layers.set(0);

    sphere.position.set(pos[0] / AU, pos[2] / AU, -pos[1] / AU);
    scene.add(sphere);
    PlotState.planet_speres.push(sphere);
    sphere.name = String(i);
  });
}

export function update_planets(planet_pos) {
  planet_pos.forEach((pos, i) => {
    PlotState.planet_speres[i].position.set(pos[0] / AU, pos[2] / AU, -pos[1] / AU);
  });
}

export function createLine(initialPoints, c = 0x0000ff, width = 2) {
  const positions = new Float32Array(initialPoints.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  initialPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });

  const material = new THREE.LineBasicMaterial({ color: c, linewidth: width, transparent: true });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  scene.add(line);
  return { line, positions, geometry };
}

// 破線。LineDashedMaterialは頂点ごとの累積距離が必要なので、
// 更新のたびに computeLineDistances() を呼び直す必要がある。
export function createDashedLine(pointCount, c = 0xd6543f, dashSize = 0.06, gapSize = 0.04) {
  const positions = new Float32Array(pointCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.LineDashedMaterial({ color: c, dashSize, gapSize, transparent: true });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  line.visible = false;
  line.computeLineDistances();
  scene.add(line);
  return { line, positions, geometry };
}

export function updateDashedLine(lineData, newPoints) {
  updateLine(lineData, newPoints);
  lineData.line.computeLineDistances();
}

export function updateLine(lineData, newPoints) {
  const { positions, geometry } = lineData;
  if (newPoints.length > positions.length / 3) {
    console.warn("新しい頂点数が多すぎます。ジオメトリを再生成してください。");
    return;
  }
  newPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });
  for (let i = newPoints.length * 3; i < positions.length; i++) {
    positions[i] = 0;
  }
  geometry.attributes.position.needsUpdate = true;
}

export function updateLayout() {
  const plot_area = document.getElementById("graph-panel");
  // グラフパネルに実際に割り当てられた幅を基準にする
  // (UI-panel側の内容量次第で幅の配分は50:50から変わり得るため、
  //  window.innerWidth/2 という固定の仮定だとcanvasがはみ出す/UIパネルを隠すことがあった)
  let w = plot_area.clientWidth - CANVAS_PADDING * 2;
  let h;
  // CSS側のメディアクエリ (max-aspect-ratio: 1/1) と同じ閾値 (幅<=高さ) に揃える
  if (window.innerWidth <= window.innerHeight) {
    // 縦長ウィンドウ: #main_area は縦積みになるので、
    // 正方形に近い形にしつつ縦の使用可能量を超えないようにする
    h = Math.min(w, window.innerHeight - HEADER_HEIGHT - CANVAS_PADDING * 2);
  } else {
    h = plot_area.clientHeight - CANVAS_PADDING * 2;
  }
  w = Math.max(w, 50);
  h = Math.max(h, 50);
  if (renderer && labelRenderer && camera) {
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

export function update_camera() {
  if (!camera) return;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  PlotState.camera_dist = camera.position.length();

  if (axis.length >= 3) {
    axis[0].line.material.opacity = 1 - Math.abs(direction.x);
    axis[1].line.material.opacity = 1 - Math.abs(direction.y);
    axis[2].line.material.opacity = 1 - Math.abs(direction.z);
  }

  for (let i = 0; i < yticks0_1.length; i++) {
    yticks0_1[i].positions[0] = (-camera.position.z / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[2] = (camera.position.x / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[3] = (camera.position.z / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[5] = (-camera.position.x / PlotState.camera_dist) * 0.05;
    yticks0_1[i].geometry.attributes.position.needsUpdate = true;

    xticks0_1[i].line.material.opacity = 1 - Math.abs(direction.x) - PlotState.camera_dist * 0.06;
    yticks0_1[i].line.material.opacity = 1 - Math.abs(direction.y) - PlotState.camera_dist * 0.06;
    zticks0_1[i].line.material.opacity = 1 - Math.abs(direction.z) - PlotState.camera_dist * 0.06;
  }
  for (let i = 0; i < yticks1.length; i++) {
    yticks1[i].positions[0] = (-camera.position.z / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[2] = (camera.position.x / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[3] = (camera.position.z / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[5] = (-camera.position.x / PlotState.camera_dist) * 0.2;
    yticks1[i].geometry.attributes.position.needsUpdate = true;

    xticks1[i].line.material.opacity = 1 - Math.abs(direction.x) - PlotState.camera_dist * 0.02;
    yticks1[i].line.material.opacity = 1 - Math.abs(direction.y) - PlotState.camera_dist * 0.02;
    zticks1[i].line.material.opacity = 1 - Math.abs(direction.z) - PlotState.camera_dist * 0.02;
  }
  for (let i = 0; i < yticks5.length; i++) {
    yticks5[i].positions[0] = -camera.position.z / PlotState.camera_dist;
    yticks5[i].positions[2] = camera.position.x / PlotState.camera_dist;
    yticks5[i].positions[3] = camera.position.z / PlotState.camera_dist;
    yticks5[i].positions[5] = -camera.position.x / PlotState.camera_dist;
    yticks5[i].geometry.attributes.position.needsUpdate = true;

    xticks5[i].line.material.opacity = 1 - Math.abs(direction.x);
    yticks5[i].line.material.opacity = 1 - Math.abs(direction.y);
    zticks5[i].line.material.opacity = 1 - Math.abs(direction.z);
  }

  const au_labels_x = document.getElementsByClassName("label_1au_x");
  const au_labels_y = document.getElementsByClassName("label_1au_y");
  const au_labels_z = document.getElementsByClassName("label_1au_z");
  const au_labels_5_x = document.getElementsByClassName("label_5au_x");
  const au_labels_5_y = document.getElementsByClassName("label_5au_y");
  const au_labels_5_z = document.getElementsByClassName("label_5au_z");

  for (let i = 0; i < au_labels_x.length; i++) au_labels_x[i].style.setProperty("--opacity", -Math.abs(direction.x) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_y.length; i++) au_labels_y[i].style.setProperty("--opacity", -Math.abs(direction.y) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_z.length; i++) au_labels_z[i].style.setProperty("--opacity", -Math.abs(direction.z) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_5_x.length; i++) au_labels_5_x[i].style.setProperty("--opacity", 1 - Math.abs(direction.x));
  for (let i = 0; i < au_labels_5_y.length; i++) au_labels_5_y[i].style.setProperty("--opacity", 1 - Math.abs(direction.y));
  for (let i = 0; i < au_labels_5_z.length; i++) au_labels_5_z[i].style.setProperty("--opacity", 1 - Math.abs(direction.z));

  for (let i = 0; i < PlotState.planet_speres.length; i++) {
    PlotState.planet_speres[i].scale.set(PlotState.camera_dist / 7, PlotState.camera_dist / 7, PlotState.camera_dist / 7);
  }

  applyVinfScale();
}

function animate() {
  requestAnimationFrame(animate);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }
}
