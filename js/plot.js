import { State, PlotState } from './state.js';
import { AU } from './trajectory.js';
import { makeRenderLoop } from './view3d.js';

export let renderer, scene, camera, sun, labelRenderer, controls;

// --- 太陽系ビューの配色 ---
// 「いまどのノードのどのレグを触っているか」が一目で分かるよう、選択中の
// ノードに繋がる2本のレグとそのノードだけを濃く描き、残りは淡く落とす。
export const COLOR_LEG_ACTIVE = 0x2a5bd7; // 選択中ノードに繋がるレグ
export const COLOR_LEG_IDLE = 0x9fb0cc; // それ以外のレグ
const COLOR_NODE_SELECTED = 0x1f4fd8;
// 破線で描く2種類の軌道。マヌーバ未実行(赤)と、最終軌道で到達した軌道(緑)。
export const COLOR_COAST = 0xd6543f;
export const COLOR_ACHIEVED = 0x2f9e6e;
const COLOR_NODE_NEIGHBOR = 0xa8bcdd;
const LEG_IDLE_OPACITY = 0.4;

// css/elements.css の --header-height / --canvas-padding と一致させること
const HEADER_HEIGHT = 64;
const CANVAS_PADDING = 24;
// 下だけは詰める。統計バーの下に余白を残すと画面の底が空いて見えるため
// (CSSの #graph-panel の padding-bottom と揃えること)
const CANVAS_PADDING_BOTTOM = 12;
// canvasと、その下の統計バーとの間隔 (css/elements.css の #graph-panel > .stat-bar と揃える)
const STAT_BAR_GAP = 10;

// --- Z軸(黄道面からの高さ)の拡大 ---
// 太陽系は極端に平たいので、等倍だと軌道傾斜がほとんど読み取れない。
// 描画座標のY(=物理のz)だけを一様に引き伸ばして、上下の起伏を見えるようにする。
// 目盛りと軸ラベルも同じだけ伸ばすので、伸ばした状態でも高さは正しく読める。
let z_scale = 1;

/** 太陽中心の位置 [km] を描画座標に直す (Z軸の拡大込み) */
export function drawingPos(pos) {
  return new THREE.Vector3((pos[0] / AU), (pos[2] / AU) * z_scale, -(pos[1] / AU));
}

/** いまのZ軸拡大率 */
export function getZScale() {
  return z_scale;
}

/**
 * Z軸の拡大率を変える。目盛り・軸ラベルも一緒に伸ばす。
 * 軌道や天体の位置は次の描き直しで反映されるので、呼び出し側で
 * update_plot() / toggle_planet() を呼ぶこと。
 */
export function setZScale(s) {
  z_scale = Math.max(1, s);
  // Y軸の線と、そこにぶら下がっている「◯AU」ラベル。X/Z軸のラベルは y=0 なので
  // このスケールの影響を受けない (Y軸のラベルだけが一緒に伸びる)。
  if (axis.length >= 2) axis[1].line.scale.y = z_scale;
  for (const g of tick_groups) g.y.scale.y = z_scale;
  invalidate();
}

const axis = [];

// 目盛りは本数が多い (0.1AU刻みだけで100本 × 3軸)。1本ずつ THREE.Line にすると
// それだけでドローコールが数百に膨れ、内蔵GPUでは描画がそのまま重さになる。
// 透明度は軸ごとにしか変えないので、軸ごとに1つの LineSegments へまとめる。
// これで目盛りのドローコールは 3刻み × 3軸 = 9本で済む。
const tick_groups = []; // { coords, half, fade, x, y, z }

/**
 * 目盛りの束を作る。
 * @param {number[]} coords 目盛りを打つ位置 (AU)
 * @param {number} half     目盛り線の長さの半分 (AU)
 * @param {number} fade     カメラ距離に応じて薄くする割合 (0で距離に依らない)
 */
function createTickGroup(coords, half, fade) {
  const make = (arr) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xaaaaaa, transparent: true })
    );
    line.material.depthTest = false;
    // 軸いっぱいに広がっていて常に画面内にあるうえ、Y軸の目盛りは向きを
    // 描き換えるので、境界球の取り直しが要らないようカリングを切っておく
    line.frustumCulled = false;
    scene.add(line);
    return line;
  };

  const xp = [], yp = [], zp = [];
  coords.forEach((i) => {
    xp.push(i, 0, -half, i, 0, half);
    yp.push(0, i, -half, 0, i, half);
    zp.push(-half, 0, i, half, 0, i);
  });

  const group = { coords, half, fade, x: make(xp), y: make(yp), z: make(zp) };
  tick_groups.push(group);
  return group;
}

export function initPlot() {
  const plot_area = document.getElementById("graph-panel");

  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#plot"),
    antialias: true,
  });
  // 端末によっては devicePixelRatio が3にもなり、描くピクセル数が9倍になって
  // しまう。線画中心の絵なので2で頭打ちにしても見た目はほとんど変わらない。
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
  // CSS2DRendererは手前のラベルほど大きなz-indexを個々のラベルに振る。この層に
  // z-indexを与えて重なりの文脈を作らないと、その値が画面全体と競合して、
  // ラベルの数が多いときにダイアログや道具ボタンの上に抜けてしまう。
  labelRenderer.domElement.style.zIndex = "1";
  // OrbitControlsはこの層(canvasではなくラベルの重なり)にドラッグを付ける。
  // 素のdivなのでブラウザは既定でテキスト選択の起点にでき、回転操作の
  // ドラッグがそのままテキスト選択になって、マウスがビュー外に出た先の
  // 文字まで選択されてしまっていた。ここを選択不可にして起点にさせない。
  labelRenderer.domElement.style.userSelect = "none";
  plot_area.appendChild(labelRenderer.domElement);

  controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
  controls.enablePan = false;
  controls.maxDistance = 200;

  axis.push(createLine([new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -50, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 0, 50)], 0xaaaaaa));

  const coords0_1 = [], coords1 = [], coords5 = [];
  for (let i = -5; i < 5; i = i + 0.1) coords0_1.push(i);
  for (let i = -20; i < 20; i = i + 1) if (i != 0) coords1.push(i);
  for (let i = -50; i < 50; i = i + 5) if (i != 0) coords5.push(i);
  createTickGroup(coords0_1, 0.05, 0.06);
  createTickGroup(coords1, 0.2, 0.02);
  createTickGroup(coords5, 1, 0);

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

  // 選択中ノード(index 1)とその前後(0, 2)のマーカー。
  // 選択中だけを濃い色にして、前後は「掴めるが脇役」と分かる淡さにする。
  for (let i = 0; i < 3; i++) {
    const marker = new THREE.SphereGeometry(0.03, 32, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: i == 1 ? COLOR_NODE_SELECTED : COLOR_NODE_NEIGHBOR,
    });
    const marker_sphere = new THREE.Mesh(marker, markerMaterial);
    marker_sphere.position.set(i, 0, 0);
    marker_sphere.visible = false;
    PlotState.marker_spheres.push(marker_sphere);
    scene.add(marker_sphere);
  }

  vinf_arrow = makeVectorArrow(VINF_COLOR, "vinf_arrow");

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
}

// --- 速度ベクトルの矢印 (打上げのV∞ / マヌーバのΔV) ---
// それぞれの点から伸びる矢印として太陽系ビューに描く。
// 長さは大きさに比例させるが、同時にカメラ距離にも比例させて、ズームしても
// 画面上の見え方が変わらないようにする (惑星マーカーの拡大と同じ考え方)。
// これで、内惑星を見ている縮尺でも外惑星まで引いた縮尺でも同じ操作感になる。
const VINF_COLOR = 0xff8c1a;
const DSM_COLOR = 0x9b4fd8; // B面ビューの近点ΔVと同じ色
const VEC_AU_PER_KMS = 0.12; // camera_dist = 7 のときの 1 km/s あたりの長さ [AU]
const VEC_CAMERA_DIST_REF = 7;
// 現実的な大きさ(数km/s)では長さをそのまま比例させたいが、遷移がうまく繋がって
// いないときは数十km/sにもなり、比例のままだと矢印が画面外まで伸びてしまう。
// tanhで頭打ちにして、通常の範囲ではほぼ比例・大きいところでは飽和させる
// (単調なので、マウスで長さから大きさを決めるときも一意に戻せる)。
const VEC_SOFT_KMS = 12;
// ΔVは数百m/sということも多く、比例のままだと矢印が見えないほど短くなるので
// 下限を設ける (この長さ以下では向きだけを示す印になる)
const VEC_MIN_AU = 0.05;

let vinf_arrow;
let vinf_state = null; // { pos: Vector3, dir: Vector3, mag } (描画座標系)
const dsm_arrows = []; // マヌーバノードごとのΔV矢印 (使い回す)
const dsm_states = [];

function makeVectorArrow(color, name) {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 1, color, 0.2, 0.1);
  arrow.name = name;
  // 惑星の公転軌道や遷移軌道と重なっても隠れないよう、他の線と同様に手前に描く
  arrow.line.material.transparent = true;
  arrow.line.material.depthTest = false;
  arrow.cone.material.transparent = true;
  arrow.cone.material.depthTest = false;
  arrow.renderOrder = 3;
  arrow.visible = false;
  scene.add(arrow);
  return arrow;
}

// 太陽中心の位置・ベクトルを、描画座標系 (x, z, -y) の状態に直す
function vectorState(pos, vec) {
  const mag = Math.hypot(vec[0], vec[1], vec[2]);
  if (!(mag > 1e-9)) return null;
  return {
    pos: drawingPos(pos),
    // 向きも空間と同じだけ引き伸ばす。そうしないとZ拡大したとき、矢印だけが
    // 軌道の傾きと違う方を向いてしまう (方向だけなのでAUへの換算は不要)。
    dir: new THREE.Vector3(vec[0], vec[2] * z_scale, -vec[1]).normalize(),
    mag,
  };
}

// いまのカメラ距離に合わせて矢印の長さを取り直す
function applyVectorScale(arrow, state) {
  if (!arrow || !state) return;
  const shown = VEC_SOFT_KMS * Math.tanh(state.mag / VEC_SOFT_KMS);
  const len = Math.max(shown * VEC_AU_PER_KMS, VEC_MIN_AU) * (PlotState.camera_dist / VEC_CAMERA_DIST_REF);
  arrow.position.copy(state.pos);
  arrow.setDirection(state.dir);
  arrow.setLength(len, len * 0.24, len * 0.13);
}

function applyAllVectorScales() {
  applyVectorScale(vinf_arrow, vinf_state);
  for (let i = 0; i < dsm_arrows.length; i++) {
    if (dsm_arrows[i].visible) applyVectorScale(dsm_arrows[i], dsm_states[i]);
  }
}

/**
 * V∞の矢印を出発天体の位置に置き直す。
 * @param {number[]} pos   出発天体の太陽中心位置 [km]
 * @param {number[]} v_inf V∞ベクトル [km/s] (太陽中心慣性系)
 */
export function updateVinfArrow(pos, v_inf) {
  if (!vinf_arrow) return;
  const state = vectorState(pos, v_inf);
  if (state == null) {
    hideVinfArrow();
    return;
  }
  vinf_state = state;
  vinf_arrow.visible = true;
  applyVectorScale(vinf_arrow, vinf_state);
  invalidate();
}

export function hideVinfArrow() {
  vinf_state = null;
  if (vinf_arrow) vinf_arrow.visible = false;
  invalidate();
}

/**
 * マヌーバ(DSM)のΔV矢印をまとめて置き直す。
 * 選択していないマヌーバの矢印も薄く出しておくと、どこで加速しているミッション
 * なのかが一目で分かる。
 * @param {{pos:number[], vec:number[], selected:boolean}[]} list
 */
export function updateDsmArrows(list) {
  if (!scene) return;
  for (let i = 0; i < Math.max(list.length, dsm_arrows.length); i++) {
    if (i >= list.length) {
      if (dsm_arrows[i]) dsm_arrows[i].visible = false;
      continue;
    }
    const state = vectorState(list[i].pos, list[i].vec);
    if (dsm_arrows[i] == undefined) dsm_arrows[i] = makeVectorArrow(DSM_COLOR, "dsm_arrow_" + i);
    dsm_states[i] = state;
    if (state == null) {
      dsm_arrows[i].visible = false;
      continue;
    }
    const opacity = list[i].selected ? 1 : 0.3;
    dsm_arrows[i].line.material.opacity = opacity;
    dsm_arrows[i].cone.material.opacity = opacity;
    dsm_arrows[i].visible = true;
    applyVectorScale(dsm_arrows[i], state);
  }
  invalidate();
}

const planetGeometry = new THREE.SphereGeometry(0.02, 32, 32);
const planetMaterial = new THREE.MeshStandardMaterial({ color: 0xddaa44 });
// 取り込んだ小天体は惑星と見分けが付くように、少し冷たい色にする
const smallBodyMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa7b8 });

/** 天体の丸とラベルを1つ足す (i は天体番号) */
export function appendPlanet(pos, i, is_small_body = false) {
  const sphere = new THREE.Mesh(planetGeometry, is_small_body ? smallBodyMaterial : planetMaterial);
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

  sphere.position.copy(drawingPos(pos));
  scene.add(sphere);
  PlotState.planet_speres[i] = sphere;
  sphere.name = String(i);
  invalidate();
  return sphere;
}

export function createPlanets(planet_pos) {
  planet_pos.forEach((pos, i) => appendPlanet(pos, i, false));
}

/**
 * 天体番号 base 以降の丸と軌道を消す (取り込んだ小天体を入れ替えるとき用)。
 * CSS2DRendererはオブジェクトを消してもラベルのDOMを片付けないので、
 * こちらで外しておかないと文字だけが画面に残る。
 */
export function removePlanetsFrom(base) {
  for (let i = base; i < PlotState.planet_speres.length; i++) {
    const sphere = PlotState.planet_speres[i];
    if (!sphere) continue;
    for (const child of sphere.children) {
      if (child.element && child.element.parentNode) child.element.parentNode.removeChild(child.element);
    }
    scene.remove(sphere);
  }
  PlotState.planet_speres.length = Math.min(PlotState.planet_speres.length, base);

  for (let i = base; i < PlotState.orbit_lines.length; i++) {
    const entry = PlotState.orbit_lines[i];
    if (entry && entry.line) scene.remove(entry.line);
  }
  PlotState.orbit_lines.length = Math.min(PlotState.orbit_lines.length, base);
  invalidate();
}

export function update_planets(planet_pos) {
  planet_pos.forEach((pos, i) => {
    PlotState.planet_speres[i].position.copy(drawingPos(pos));
  });
  invalidate();
}

// --- 何も選んでいないときに出す、全ノードの薄い丸 ---
// 選択中の前後3つ(marker_spheres)とは別に、ミッションのどこに節があるのかを
// 一覧として示すためのもの。天体を持つ節では天体そのものと同じ位置に来るので、
// 天体の丸(半径0.02)より一回り大きくして、囲む輪のように見せる。
const NODE_MARKER_SCALE = 1.15;
const node_markers = [];

/** @param {number[][]} list 各ノードの太陽中心位置 [km] */
export function updateNodeMarkers(list) {
  if (!scene) return;
  for (let i = 0; i < Math.max(list.length, node_markers.length); i++) {
    if (i >= list.length) {
      if (node_markers[i]) node_markers[i].visible = false;
      continue;
    }
    if (node_markers[i] == undefined) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 16, 16),
        new THREE.MeshStandardMaterial({ color: COLOR_NODE_NEIGHBOR, transparent: true, opacity: 0.45 })
      );
      mesh.name = "node_marker_" + i;
      node_markers.push(mesh);
      scene.add(mesh);
    }
    if (list[i] == undefined) {
      node_markers[i].visible = false;
      continue;
    }
    node_markers[i].position.copy(drawingPos(list[i]));
    node_markers[i].visible = true;
    node_markers[i].scale.setScalar((PlotState.camera_dist / 7) * NODE_MARKER_SCALE);
  }
  invalidate();
}

export function createLine(initialPoints, c = 0x0000ff, width = 2) {
  const positions = new Float32Array(initialPoints.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  initialPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y * z_scale;
    positions[i * 3 + 2] = point.z;
  });

  const material = new THREE.LineBasicMaterial({ color: c, linewidth: width, transparent: true });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  scene.add(line);
  invalidate();
  return { line, positions, geometry };
}

// 破線。LineDashedMaterialは頂点ごとの累積距離が必要なので、
// 更新のたびに computeLineDistances() を呼び直す必要がある。
export function createDashedLine(pointCount, c = COLOR_COAST, dashSize = 0.06, gapSize = 0.04) {
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

/**
 * 遷移軌道の弧を、選択中かどうかで塗り分ける。
 * @param {object} lineData createLineの戻り値
 * @param {boolean} active 選択中ノードに繋がるレグか
 */
export function styleLeg(lineData, active) {
  if (!lineData) return;
  lineData.line.material.color.setHex(active ? COLOR_LEG_ACTIVE : COLOR_LEG_IDLE);
  lineData.line.material.opacity = active ? 1 : LEG_IDLE_OPACITY;
  invalidate();
}

/** 線を捨てる (点数が変わって作り直すとき用) */
export function disposeLine(lineData) {
  if (!lineData || !lineData.line) return;
  scene.remove(lineData.line);
  if (lineData.geometry) lineData.geometry.dispose();
  if (lineData.line.material) lineData.line.material.dispose();
  invalidate();
}

export function updateLine(lineData, newPoints) {
  const { positions, geometry } = lineData;
  if (newPoints.length > positions.length / 3) {
    console.warn("新しい頂点数が多すぎます。ジオメトリを再生成してください。");
    return;
  }
  newPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y * z_scale;
    positions[i * 3 + 2] = point.z;
  });
  for (let i = newPoints.length * 3; i < positions.length; i++) {
    positions[i] = 0;
  }
  geometry.attributes.position.needsUpdate = true;
  invalidate();
}

export function updateLayout() {
  const plot_area = document.getElementById("graph-panel");
  // グラフパネルに実際に割り当てられた幅を基準にする
  // (UI-panel側の内容量次第で幅の配分は50:50から変わり得るため、
  //  window.innerWidth/2 という固定の仮定だとcanvasがはみ出す/UIパネルを隠すことがあった)
  let w = plot_area.clientWidth - CANVAS_PADDING * 2;
  // canvasの下に置いてある数値のまとめ (統計バー) のぶんを引く
  const stat_bar = plot_area.querySelector(".stat-bar");
  const below = stat_bar ? stat_bar.getBoundingClientRect().height + STAT_BAR_GAP : 0;

  let h;
  // CSS側のメディアクエリ (max-aspect-ratio: 1/1) と同じ閾値 (幅<=高さ) に揃える
  if (window.innerWidth <= window.innerHeight) {
    // 縦長ウィンドウ: #main_area は縦積みになるので、
    // 正方形に近い形にしつつ縦の使用可能量を超えないようにする
    h = Math.min(w, window.innerHeight - HEADER_HEIGHT - CANVAS_PADDING - CANVAS_PADDING_BOTTOM - below);
  } else {
    h = plot_area.clientHeight - CANVAS_PADDING - CANVAS_PADDING_BOTTOM - below;
  }
  w = Math.max(w, 50);
  h = Math.max(h, 50);
  if (renderer && labelRenderer && camera) {
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  invalidate();
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

  // Y軸の目盛りだけは、どの方向から見ても線として見えるようカメラの方を向かせる
  // (X/Z軸の目盛りは黄道面に寝ているので向きを変える必要がない)。
  for (const g of tick_groups) {
    const attr = g.y.geometry.attributes.position;
    const a = attr.array;
    const cx = (camera.position.x / PlotState.camera_dist) * g.half;
    const cz = (camera.position.z / PlotState.camera_dist) * g.half;
    for (let k = 0; k < a.length; k += 6) {
      a[k] = -cz;
      a[k + 2] = cx;
      a[k + 3] = cz;
      a[k + 5] = -cx;
    }
    attr.needsUpdate = true;

    g.x.material.opacity = 1 - Math.abs(direction.x) - PlotState.camera_dist * g.fade;
    g.y.material.opacity = 1 - Math.abs(direction.y) - PlotState.camera_dist * g.fade;
    g.z.material.opacity = 1 - Math.abs(direction.z) - PlotState.camera_dist * g.fade;
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

  // ノードのマーカーも惑星と同じくカメラ距離に合わせる。
  // 選択中のノード(index 1)は前後のノードより一回り大きくして、
  // どれを選んでいるのかが縮尺によらず分かるようにする。
  for (let i = 0; i < PlotState.marker_spheres.length; i++) {
    PlotState.marker_spheres[i].scale.setScalar((PlotState.camera_dist / 7) * (i == 1 ? 1.4 : 0.85));
  }
  for (const mk of node_markers) mk.scale.setScalar((PlotState.camera_dist / 7) * NODE_MARKER_SCALE);

  applyAllVectorScales();
  invalidate();
}

// 太陽系ビューは動くものが無いので、絵が変わったときだけ描く。
// 変えた側から invalidate() を呼ぶ約束にしてある (このファイル内の
// 更新関数は自分で呼ぶので、外から呼ぶ必要があるのは plot.js を通さずに
// シーンを触ったとき — 例えば .visible を直接切り替えたとき)。
const loop = makeRenderLoop(() => {
  if (!renderer || !scene || !camera) return;
  renderer.render(scene, camera);
  if (labelRenderer) labelRenderer.render(scene, camera);
});

/** 太陽系ビューを描き直す予約を入れる */
export function invalidate(frames) {
  loop.invalidate(frames);
}
