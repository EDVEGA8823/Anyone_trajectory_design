// 操作パネルに置く小さな3Dビュー (スイングバイのB面ビュー、打上げのV∞ビュー) で
// 共通に使う部品をまとめたもの。
// メインの太陽系ビュー(plot.js)とは別に、それぞれ独自のシーンを持つビューが
// 同じ流儀 (正方形キャンバス・画面上一定サイズのハンドル・OrbitControlsとの
// 共存) で動くようにするためのもの。

// 掴み判定の半径 [画面px]。小さな球の実形状で判定すると狙いにくいので、
// 見た目(HANDLE_PX)より広めに取る。
export const HANDLE_HIT_PX = 18;
export const HANDLE_PX = 9; // ハンドルの見た目の半径 [画面px]

/**
 * 「変化があったときだけ描く」ための描画ループ。
 *
 * このアプリの3Dビューはどれもアニメーションを持たず、ユーザーが何かを操作した
 * ときにしか絵が変わらない。それでも requestAnimationFrame で回し続けると、
 * 何も起きていない間も毎秒60回シーン全体を描き直すことになり、内蔵GPUだと
 * それだけでファンが回る。そこで「汚れている(=描き直す必要がある)」間だけ
 * rAFを回し、落ち着いたらループごと止める。
 *
 * invalidate() の既定値が2フレームなのは、レイアウト変更の直後など
 * 「1フレーム目では新しい大きさがまだ確定していない」ことがあるため。
 *
 * @param {() => void} step 1フレーム分の描画
 * @returns {{invalidate: (frames?: number) => void}}
 */
export function makeRenderLoop(step) {
  let pending = 0;
  let handle = 0;

  function frame() {
    handle = 0;
    if (pending <= 0) return;
    pending--;
    step();
    // step()の中で更にinvalidateされることもあるので、消化後に見直す
    if (pending > 0 && handle === 0) handle = requestAnimationFrame(frame);
  }

  return {
    invalidate(frames = 2) {
      if (frames > pending) pending = frames;
      if (handle === 0) handle = requestAnimationFrame(frame);
    },
  };
}

/** XY平面上の正方形グリッド (一辺 2*half を divisions 等分) */
export function squareGridGeometry(half, divisions) {
  const pts = [];
  for (let k = 0; k <= divisions; k++) {
    const t = -half + (2 * half * k) / divisions;
    pts.push(new THREE.Vector3(t, -half, 0), new THREE.Vector3(t, half, 0));
    pts.push(new THREE.Vector3(-half, t, 0), new THREE.Vector3(half, t, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

export function makeLine(points, color, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  return line;
}

/** 破線。LineDashedMaterialは頂点ごとの累積距離が要るので計算しておく */
export function makeDashedLine(points, color, opacity = 1, dashSize = 0.3, gapSize = 0.2) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineDashedMaterial({ color, transparent: true, opacity, dashSize, gapSize });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  line.computeLineDistances();
  return line;
}

export function setLinePoints(line, points) {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  // 破線は頂点を張り替えるたびに累積距離を取り直す必要がある
  if (line.material.isLineDashedMaterial) line.computeLineDistances();
}

// 方向を示す矢印。線分と同様に深度テストを切って手前に描く。
export function makeArrow(color, opacity = 1) {
  const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), 1, color, 0.001, 0.001);
  arrow.line.material.transparent = true;
  arrow.line.material.opacity = opacity;
  arrow.line.material.depthTest = false;
  arrow.cone.material.transparent = true;
  arrow.cone.material.opacity = opacity;
  arrow.cone.material.depthTest = false;
  arrow.renderOrder = 2;
  return arrow;
}

// 始点・終点(進行方向)を指定してArrowHelperを更新する。
// maxHeadは矢じるしの絶対的な上限サイズ(場面のスケールに合わせる)。
// 線がとても長い場合に矢じるしだけが不自然に巨大化するのを防ぐ。
export function setArrow(arrow, from, to, maxHead, headLenRatio = 0.22, headWidthRatio = 0.5) {
  const diff = new THREE.Vector3().subVectors(to, from);
  const len = diff.length();
  if (len < 1e-9) return;
  arrow.position.copy(from);
  arrow.setDirection(diff.multiplyScalar(1 / len));
  const headLength = Math.min(len * headLenRatio, len * 0.6, maxHead ?? Infinity);
  arrow.setLength(len, headLength, headLength * headWidthRatio);
}

/**
 * 折れ線の途中に並べる矢じるしを作る。
 *
 * 軌道や漸近線はグリッドの端まで引いてあるので、先端に1つ置いても画角の外に
 * 出てしまって進行方向が読めない。線の途中に何個か置いて、どこを見ていても
 * 向きが分かるようにするための部品。
 *
 * @param {number} color
 * @param {number} count 置く数
 * @param {number} opacity
 * @returns {THREE.Group}
 */
export function makeArrowTrail(color, count = 2, opacity = 1) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    material.depthTest = false;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 16), material);
    cone.renderOrder = 2;
    group.add(cone);
  }
  return group;
}

/**
 * 折れ線に沿って矢じるしを置き直す。位置は「弧の長さの何割か」で指定する。
 * 点の間隔は場所によって大きく違う (双曲線は遠方ほど粗い) ので、
 * 添字ではなく実際の長さで測らないと見た目が偏る。
 *
 * 大きさはここでは決めない。scaleArrowTrail が画面上の大きさで毎フレーム
 * 決めるので、どこまで引いても同じ見え方になる。
 *
 * @param {THREE.Group} group makeArrowTrail の戻り値
 * @param {THREE.Vector3[]} points 折れ線 (進行方向の順)
 * @param {number[]} at 弧の長さに対する割合 (0〜1)
 */
export function setArrowTrail(group, points, at) {
  const cones = group.children;
  if (!points || points.length < 2) {
    for (const c of cones) c.visible = false;
    return;
  }

  // 各点までの累積の長さ
  const acc = [0];
  for (let i = 1; i < points.length; i++) {
    acc[i] = acc[i - 1] + points[i].distanceTo(points[i - 1]);
  }
  const total = acc[acc.length - 1];
  if (!(total > 0)) {
    for (const c of cones) c.visible = false;
    return;
  }

  const up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < cones.length; k++) {
    const frac = at[k];
    if (frac == undefined) {
      cones[k].visible = false;
      continue;
    }
    const want = total * Math.max(0, Math.min(1, frac));
    let i = 1;
    while (i < acc.length - 1 && acc[i] < want) i++;
    const seg = acc[i] - acc[i - 1];
    const t = seg > 0 ? (want - acc[i - 1]) / seg : 0;
    cones[k].position.lerpVectors(points[i - 1], points[i], t);
    const dir = new THREE.Vector3().subVectors(points[i], points[i - 1]);
    if (dir.lengthSq() < 1e-18) {
      cones[k].visible = false;
      continue;
    }
    cones[k].quaternion.setFromUnitVectors(up, dir.normalize());
    cones[k].visible = true;
  }
}

/**
 * 折れ線が「中心からの距離が radius の球」を横切るところに矢じるしを置く。
 *
 * 弧の長さの割合で置くと、線を伸ばした拍子に矢じるしが画角の外へ出てしまう。
 * 距離で置けば、画角に対していつも同じあたり (中心と端の中間) に来る。
 * 双曲線や公転軌道のように行きと帰りがある線では、1つの半径で2か所を横切る
 * ので、それぞれに1つずつ置かれる。
 *
 * @param {THREE.Group} group makeArrowTrail の戻り値
 * @param {THREE.Vector3[]} points 折れ線 (進行方向の順)
 * @param {number[]} radii 置きたい距離 (近い順に埋めていく)
 * @param {THREE.Vector3} [center] 距離を測る中心 (既定は原点)
 */
export function setArrowTrailOnCircles(group, points, radii, center) {
  const cones = group.children;
  for (const c of cones) c.visible = false;
  if (!points || points.length < 2 || cones.length === 0) return;

  const c0 = center || _origin;
  const dist = points.map((p) => p.distanceTo(c0));
  const up = new THREE.Vector3(0, 1, 0);
  let k = 0;

  for (const r of radii) {
    for (let i = 1; i < points.length && k < cones.length; i++) {
      const a = dist[i - 1] - r;
      const b = dist[i] - r;
      if ((a <= 0 && b <= 0) || (a > 0 && b > 0)) continue; // またいでいない
      const t = a === b ? 0 : a / (a - b);
      const dir = new THREE.Vector3().subVectors(points[i], points[i - 1]);
      if (dir.lengthSq() < 1e-18) continue;
      cones[k].position.lerpVectors(points[i - 1], points[i], t);
      cones[k].quaternion.setFromUnitVectors(up, dir.normalize());
      cones[k].visible = true;
      k++;
    }
  }
  // どの距離も横切らない (線が短すぎる/遠すぎる) ときは、弧の長さで置き直す
  if (k === 0) setArrowTrail(group, points, [0.3, 0.7]);
}

const _origin = new THREE.Vector3();

/**
 * 矢じるしの大きさを、画面上で一定に保つ (ハンドルと同じ考え方)。
 * 線は画角の外まで伸びていて、カメラも自由に引けるので、世界座標での
 * 大きさを固定にするとどこかの縮尺で必ず大きすぎ/小さすぎになる。
 *
 * @param {THREE.Group} group makeArrowTrail の戻り値
 * @param {number} px 画面上での長さ [px]
 */
export function scaleArrowTrail(group, camera, renderer, px = 9) {
  if (!group || !group.visible || !camera || !renderer) return;
  const h = renderer.domElement.clientHeight;
  if (!h) return;
  const halfFov = Math.tan((camera.fov * Math.PI) / 180 / 2);
  const at = new THREE.Vector3();
  for (const cone of group.children) {
    if (!cone.visible) continue;
    const dist = camera.position.distanceTo(cone.getWorldPosition(at));
    const size = (px * 2 * dist * halfFov) / h;
    cone.scale.set(size * 0.45, size, size * 0.45);
  }
}

/** マウスで掴むハンドル (大きさは scaleHandleToScreen が毎フレーム決める) */
export function makeHandle(color) {
  const handle = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  handle.material.depthTest = false;
  handle.renderOrder = 4;
  handle.visible = false;
  return handle;
}

// ハンドルは掴む対象なので、遠近やズームによらず画面上の大きさを一定に保つ。
// 透視投影では見かけの大きさが (世界での大きさ / カメラからの距離) に比例するので、
// 距離に比例させた大きさを毎フレーム与える。
export function scaleHandleToScreen(handle, camera, renderer) {
  if (!handle || !handle.visible || !camera || !renderer) return;
  const h = renderer.domElement.clientHeight;
  if (!h) return;
  const dist = camera.position.distanceTo(handle.getWorldPosition(new THREE.Vector3()));
  const halfFov = Math.tan((camera.fov * Math.PI) / 180 / 2);
  handle.scale.setScalar((HANDLE_PX * 2 * dist * halfFov) / h);
}

/**
 * 枠に収まる最大の正方形をキャンバスの大きさにする関数を作る。
 * CSSのaspect-ratioは幅と高さの両方が制限されると比率を保ってくれないので、
 * 小さい方を採ってこちらで正方形を作る。
 * 対象のノードを選んでいない間は非表示(サイズ0)になるので、その場合は
 * 何もせず、表示に戻ったフレームで合わせ直す。
 */
export function makeSquareResizer(renderer, camera, maxSize, border = 1) {
  let lastSize = 0;
  return function resize() {
    const canvas = renderer.domElement;
    const box = canvas.parentElement;
    if (!box) return;

    // canvasはborder-boxではなくcontent-boxなので、枠との差(境界線)を引いておく
    const avail = Math.min(box.clientWidth, box.clientHeight) - border * 2;
    const size = Math.floor(Math.min(avail, maxSize));
    if (size <= 0 || size === lastSize) return;
    lastSize = size;

    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  };
}

/** ハンドルの当たり判定 (画面上の距離で見る) */
export function hitHandle(event, handle, camera, renderer) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0) return false;
  const p = handle.getWorldPosition(new THREE.Vector3()).project(camera);
  const hx = rect.left + (p.x * 0.5 + 0.5) * rect.width;
  const hy = rect.top + (-p.y * 0.5 + 0.5) * rect.height;
  return Math.hypot(event.clientX - hx, event.clientY - hy) < HANDLE_HIT_PX;
}

/** マウス位置からレイを引く。キャンバスが非表示のときは false */
export function setRayFromEvent(event, camera, renderer, raycaster) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;
  raycaster.setFromCamera(
    new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    ),
    camera
  );
  return true;
}

/**
 * 軸 d と、レイとの最接近点の軸上パラメータ。
 * 軸は既定では原点を通る。中身をずらして描いているビュー(周回軌道ビュー)では、
 * 軸が通る点を origin で渡す。
 */
export function closestOnAxis(raycaster, d, origin) {
  const o = origin ? raycaster.ray.origin.clone().sub(origin) : raycaster.ray.origin;
  const r = raycaster.ray.direction;
  const b = d.dot(r);
  const den = 1 - b * b;
  if (Math.abs(den) < 1e-6) return undefined; // レイが軸とほぼ平行
  return (o.dot(d) - b * o.dot(r)) / den;
}

/** 原点を通り法線 n を持つ平面と、レイとの交点 (前方に無ければ null) */
export function intersectPlane(raycaster, n) {
  const o = raycaster.ray.origin;
  const r = raycaster.ray.direction;
  const dn = r.dot(n);
  if (Math.abs(dn) < 1e-6) return null;
  const t = -o.dot(n) / dn;
  if (t <= 0) return null;
  return new THREE.Vector3().copy(o).addScaledVector(r, t);
}

/**
 * ハンドルをマウスで掴んで動かすための共通の下回りを取り付ける。
 *
 * OrbitControlsはcanvas自身のpointerdownを見ている。同じ要素に後から足すと
 * 登録順で先を越されてしまうので、documentのキャプチャ段階で先に判定して、
 * ハンドルを掴んだときだけ伝播を止める。
 *
 * @param {object} api
 * @param {() => THREE.WebGLRenderer} api.getRenderer
 * @param {() => THREE.Camera} api.getCamera
 * @param {() => object} api.getControls  ドラッグ中はカメラ操作を止める
 * @param {() => {key:string, mesh:THREE.Object3D}|null} api.getActiveHandle
 *        いま表示しているハンドル (無ければ null)
 * @param {(key:string, raycaster:THREE.Raycaster) => void} api.onDrag
 * @returns {{cancel: () => void, dragging: () => string|null}}
 */
export function attachHandleDrag({ getRenderer, getCamera, getControls, getActiveHandle, onDrag }) {
  const raycaster = new THREE.Raycaster();
  let dragging = null;

  function endDrag() {
    if (dragging == null) return;
    dragging = null;
    const controls = getControls();
    const renderer = getRenderer();
    if (controls) controls.enabled = true;
    if (renderer) renderer.domElement.style.cursor = "";
  }

  function onPointerDown(event) {
    const renderer = getRenderer();
    if (!renderer || event.button !== 0) return;
    if (event.target !== renderer.domElement) return;
    const active = getActiveHandle();
    if (!active || !active.mesh.visible) return;
    if (!hitHandle(event, active.mesh, getCamera(), renderer)) return;

    dragging = active.key;
    const controls = getControls();
    if (controls) controls.enabled = false;
    renderer.domElement.style.cursor = "grabbing";
    // ここで止めないとOrbitControlsが同時にカメラを回してしまう
    event.stopPropagation();
    event.preventDefault();
  }

  function onPointerMove(event) {
    const renderer = getRenderer();
    if (!renderer) return;

    if (dragging == null) {
      // ハンドルの上に来たら掴めることが分かるようにする
      const active = getActiveHandle();
      if (active && active.mesh.visible && event.target === renderer.domElement) {
        renderer.domElement.style.cursor = hitHandle(event, active.mesh, getCamera(), renderer) ? "grab" : "";
      }
      return;
    }
    if (!setRayFromEvent(event, getCamera(), renderer, raycaster)) return;
    onDrag(dragging, raycaster);
    event.preventDefault();
  }

  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", endDrag);

  return { cancel: endDrag, dragging: () => dragging };
}
