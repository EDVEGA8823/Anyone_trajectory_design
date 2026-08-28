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

// 「大きさ + 基準方向まわりの2つの角度」で決まる速度ベクトルを、マウスで
// 操作するための小さな3Dビュー。打上げの脱出速度 V∞ と、手動マヌーバの ΔV は
// まったく同じ形の設計変数なので、同じビューを2つ作って使い回す。
//
// 【座標系】基準となる直交系 (x_hat, y_hat, z_hat) を次の向きで描画する。
//   x_hat (基準方向: 打上げなら天体の公転方向、マヌーバなら探査機の進行方向)
//         -> 画面右 (+X)
//   z_hat (軌道面の法線)                                    -> 画面上 (+Y)
//   y_hat                                                   -> 画面奥 (-Z)
// したがって物理ベクトル w は (w·x_hat, w·z_hat, -(w·y_hat)) に置く。
// 方位角αは軌道面内で x_hat から測り、仰角δは軌道面からの傾き。
//
// 【縮尺】1目盛 = scale [km/s]。打上げは常に1 km/sで固定だが、マヌーバのΔVは
// 数十m/sから数km/sまで幅があるので、表示するノードが変わったときにだけ
// きりの良い目盛りを選び直す (操作中に縮尺が動くと大きさの感覚が崩れるため)。

// 目盛りの候補。ΔVの大きさに対して「矢印がグリッドの半分くらいに収まる」
// ものを選ぶ。
const NICE_SCALES = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];

/**
 * ビューを1つ作る。
 *
 * @param {object} config
 * @param {string} config.canvasId    描画先のcanvasのid
 * @param {number} config.cells       グリッドの一辺の目の数
 * @param {number} config.centerRadius 中心に置く球の見た目の半径 [目盛]
 * @param {number} config.alphaR      方位角ハンドルの半径 [目盛]
 * @param {number} config.deltaR      仰角ハンドルの半径 [目盛]
 * @param {object} config.colors      { vector, alpha, delta, reference, center }
 * @param {number} config.ambient     環境光の強さ
 * @param {boolean} config.useSunLight 太陽方向の平行光で陰影を付けるか
 *        (深宇宙の一点であるマヌーバでは天体が無いので使わない)
 * @param {boolean} config.adaptiveScale 大きさに合わせて目盛りを選び直すか
 */
export function createVectorView(config) {
  const {
    canvasId,
    cells = 10,
    centerRadius = 0.55,
    alphaR = 3.2,
    deltaR = 2.2,
    colors,
    ambient = 0.45,
    useSunLight = true,
    adaptiveScale = false,
  } = config;

  const CANVAS_MAX = 460;
  const CANVAS_BORDER = 1;
  const HALF = cells / 2; // グリッドの半幅 [目盛]

  let renderer, scene, camera, controls, sunLight;
  let centerMesh, planeGrid, referenceArrow, referenceLine;
  let vectorArrow, shadowLine, riseLine, alphaArc, deltaArc;
  let vectorHandle, alphaHandle, deltaHandle, vectorGuide, alphaGuide, deltaGuide;

  let activeHandle = null; // null | "vector" | "alpha" | "delta"
  let drag = null;
  let handlers = {}; // { onMagnitude(km/s), onAlpha(rad), onDelta(rad) }
  let geom = null;
  let lastViewKey;
  let scale = 1; // 1目盛あたりの大きさ [km/s]
  let resizeToDisplaySize;

  function init() {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(35, 1, 0.05, 5000);
    // 基準方向(+X)が画面右、法線(+Y)が画面上に来るよう、+Z側の斜め上から見る。
    // 軌道面を斜めから見下ろす角度にしないと、仰角δの傾きが読み取れない。
    camera.position.set(0.3, 0.8, 1).setLength(14);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, ambient));
    sunLight = new THREE.DirectionalLight(0xfff4e0, useSunLight ? 1.5 : 0.9);
    sunLight.position.set(0.4, 1, 0.6);
    scene.add(sunLight);
    scene.add(sunLight.target);

    // 軌道面 (= 方位角αを測る面)。グリッドはXY平面で作られるので寝かせる。
    planeGrid = new THREE.LineSegments(
      squareGridGeometry(HALF, cells),
      new THREE.LineBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0.22, depthWrite: false })
    );
    planeGrid.rotation.x = -Math.PI / 2;
    planeGrid.renderOrder = -1;
    scene.add(planeGrid);

    centerMesh = new THREE.Mesh(
      new THREE.SphereGeometry(centerRadius, 40, 40),
      new THREE.MeshStandardMaterial({ color: colors.center, roughness: 0.62, metalness: 0.0 })
    );
    centerMesh.name = "center";
    scene.add(centerMesh);

    // 基準方向 (= 方位角 α の 0°)
    referenceArrow = makeArrow(colors.reference, 0.85);
    scene.add(referenceArrow);
    referenceLine = makeLine([new THREE.Vector3()], colors.reference, 0.5);
    scene.add(referenceLine);

    vectorArrow = makeArrow(colors.vector, 1);
    vectorArrow.name = "vector_arrow";
    scene.add(vectorArrow);

    // ベクトルを軌道面に落とした影と、そこから持ち上げる線。
    // この2本があると仰角δがどこの角度なのか読み取れる。
    shadowLine = makeLine([new THREE.Vector3()], colors.vector, 0.35);
    scene.add(shadowLine);
    riseLine = makeLine([new THREE.Vector3()], colors.vector, 0.35);
    scene.add(riseLine);

    alphaArc = makeLine([new THREE.Vector3()], colors.alpha, 1);
    scene.add(alphaArc);
    deltaArc = makeLine([new THREE.Vector3()], colors.delta, 1);
    scene.add(deltaArc);

    vectorGuide = makeLine([new THREE.Vector3()], colors.vector, 0.35);
    scene.add(vectorGuide);
    vectorHandle = makeHandle(colors.vector);
    vectorHandle.name = "vector_handle";
    scene.add(vectorHandle);

    alphaGuide = makeLine([new THREE.Vector3()], colors.alpha, 0.45);
    scene.add(alphaGuide);
    alphaHandle = makeHandle(colors.alpha);
    alphaHandle.name = "alpha_handle";
    scene.add(alphaHandle);

    deltaGuide = makeLine([new THREE.Vector3()], colors.delta, 0.45);
    scene.add(deltaGuide);
    deltaHandle = makeHandle(colors.delta);
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

    controls.addEventListener("change", () => invalidate());
    window.addEventListener("resize", () => invalidate());
    invalidate();
  }

  function activeHandleMesh() {
    if (activeHandle === "vector") return vectorHandle;
    if (activeHandle === "alpha") return alphaHandle;
    if (activeHandle === "delta") return deltaHandle;
    return null;
  }

  /** どの欄のハンドルを出すか。null で全部隠す */
  function setActiveHandle(which) {
    const next = which === "vector" || which === "alpha" || which === "delta" ? which : null;
    if (next === activeHandle) return;
    activeHandle = next;
    if (drag && drag.dragging() !== activeHandle) drag.cancel();
    updateHandles();
    invalidate();
  }

  function setHandlers(h) {
    handlers = h || {};
  }

  // 軌道面内で方位角 α の向き (描画座標)
  function inPlaneDir(alpha) {
    return new THREE.Vector3(Math.cos(alpha), 0, -Math.sin(alpha));
  }

  // ベクトルの単位方向 (描画座標)
  function vecDir(alpha, delta) {
    const c = Math.cos(delta);
    return new THREE.Vector3(c * Math.cos(alpha), Math.sin(delta), -c * Math.sin(alpha));
  }

  // f(t) を [t0, t1] で刻んだ折れ線
  function arcPoints(f, t0, t1, n = 48) {
    const pts = [];
    for (let k = 0; k <= n; k++) pts.push(f(t0 + ((t1 - t0) * k) / n));
    return pts;
  }

  // 矢印がグリッドの半分くらいに収まる、きりの良い目盛りを選ぶ。
  // まだ0のとき (足したばかりのマヌーバ) は一番細かい目盛りになってしまうので、
  // 惑星間のDSMとしてありふれた大きさを下限として見込んでおく。
  const MIN_SCALE_BASIS = 0.15; // [km/s]
  function pickScale(magnitude) {
    const want = Math.max(magnitude, MIN_SCALE_BASIS) / (HALF * 0.6);
    for (const s of NICE_SCALES) if (s >= want) return s;
    return NICE_SCALES[NICE_SCALES.length - 1];
  }

  /**
   * 表示内容を更新する。
   *
   * @param {object} params
   * @param {boolean} params.ready   描くだけの情報が揃っているか
   * @param {string} [params.key]    表示対象の識別子。変わったときだけ画角と縮尺を取り直す
   * @param {number} params.magnitude ベクトルの大きさ [km/s]
   * @param {number} params.alpha    方位角 [rad] (基準方向が0)
   * @param {number} params.delta    仰角 [rad] (軌道面から法線向きが正)
   * @param {number} [params.centerColor] 中心の球の色
   * @param {number[]} [params.sunDir] 描画座標での太陽方向 (陰影に使う)
   */
  function update({ ready, key, magnitude, alpha = 0, delta = 0, centerColor, sunDir }) {
    if (!scene) return;

    setVisible(!!ready);
    if (!ready) {
      geom = null;
      updateHandles();
      invalidate();
      return;
    }

    if (centerColor != undefined) centerMesh.material.color.setHex(centerColor);

    // 縮尺は表示するノードが変わったときにだけ選び直す。操作中に動くと
    // 「どれくらい大きくしたのか」の感覚が崩れる。
    const key_changed = key !== lastViewKey;
    if (adaptiveScale && key_changed) scale = pickScale(magnitude);

    const shown = magnitude / scale; // 描画単位での長さ
    const dir = vecDir(alpha, delta);
    const flat = inPlaneDir(alpha);
    const tip = dir.clone().multiplyScalar(shown);
    const shadow = flat.clone().multiplyScalar(shown * Math.cos(delta));

    // ビューの広さ。矢印が短くてもグリッドの広さは変わらないので、
    // 矢じるしなどの見た目の大きさはグリッドを基準に決める。
    const extent = Math.max(HALF, shown * 1.2);
    const head = Math.min(Math.max(shown * 0.16, 0.25), 0.8);

    setArrow(vectorArrow, new THREE.Vector3(), tip, head, 0.2, 0.5);

    setLinePoints(shadowLine, [new THREE.Vector3(), shadow]);
    setLinePoints(riseLine, [shadow, tip]);
    // 仰角がほぼ0のときは影と本体が重なるだけなので描かない
    const tilted = Math.abs(delta) > 1e-3;
    shadowLine.visible = tilted;
    riseLine.visible = tilted;

    // 基準方向 (=α の基準) は中心を貫いて前後に伸ばす
    setArrow(
      referenceArrow,
      new THREE.Vector3(-HALF, 0, 0),
      new THREE.Vector3(HALF, 0, 0),
      0.45,
      0.1,
      0.45
    );
    setLinePoints(referenceLine, [new THREE.Vector3(), new THREE.Vector3(HALF, 0, 0)]);

    // 方位角の円弧 (軌道面内、基準方向から反時計回りに α)
    const arcA = Math.min(alphaR * 0.55, Math.max(shown * 0.45, 0.8));
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
    if (useSunLight && sunDir) {
      sunLight.position.set(sunDir[0], sunDir[1], sunDir[2]).setLength(50);
      sunLight.target.position.set(0, 0, 0);
    }

    geom = { magnitude, alpha, delta, dir, flat, tip, extent, shown };
    updateHandles();

    // 画角を取り直すのは表示するノードが変わったときだけ。
    // 大きさや角度を変えるたびにカメラが動くと操作しづらいので動かさない。
    if (key_changed) {
      lastViewKey = key;
      fitCamera(extent);
    }
    invalidate();
  }

  // ハンドルの位置と、動かせる向きを示す補助線を引き直す
  function updateHandles() {
    if (!vectorHandle) return;

    const ready = geom != null;
    const show = {
      vector: ready && activeHandle === "vector",
      alpha: ready && activeHandle === "alpha",
      delta: ready && activeHandle === "delta",
    };
    vectorHandle.visible = show.vector;
    vectorGuide.visible = show.vector;
    alphaHandle.visible = show.alpha;
    alphaGuide.visible = show.alpha;
    deltaHandle.visible = show.delta;
    deltaGuide.visible = show.delta;
    if (!ready) return;

    if (show.vector) {
      // 伸び縮みする向き = ベクトルの向きそのもの
      vectorHandle.position.copy(geom.tip);
      setLinePoints(vectorGuide, [
        new THREE.Vector3(),
        geom.dir.clone().multiplyScalar(Math.max(geom.shown * 1.6, HALF)),
      ]);
    }

    if (show.alpha) {
      // 回る向き = 軌道面内の円
      alphaHandle.position.copy(geom.flat.clone().multiplyScalar(alphaR));
      setLinePoints(alphaGuide, arcPoints((t) => inPlaneDir(t).multiplyScalar(alphaR), 0, 2 * Math.PI, 72));
    }

    if (show.delta) {
      // 回る向き = α の向きを含む鉛直面内の半円 (δ は ±90°まで)
      const up = new THREE.Vector3(0, 1, 0);
      deltaHandle.position.copy(
        geom.flat.clone().multiplyScalar(Math.cos(geom.delta) * deltaR).addScaledVector(up, Math.sin(geom.delta) * deltaR)
      );
      setLinePoints(
        deltaGuide,
        arcPoints(
          (t) => geom.flat.clone().multiplyScalar(Math.cos(t) * deltaR).addScaledVector(up, Math.sin(t) * deltaR),
          -Math.PI / 2,
          Math.PI / 2
        )
      );
    }

    // 表示に切り替わった最初のフレームで大きすぎる状態が見えないようにする
    scaleHandleToScreen(vectorHandle, camera, renderer);
    scaleHandleToScreen(alphaHandle, camera, renderer);
    scaleHandleToScreen(deltaHandle, camera, renderer);
  }

  // ハンドルをドラッグしている間の反映
  function applyDrag(key, raycaster) {
    if (!geom) return;

    if (key === "vector") {
      // ベクトルの向きを軸に、マウスに最も近い点までの長さをそのまま大きさにする
      const t = closestOnAxis(raycaster, geom.dir);
      if (t == undefined) return;
      if (handlers.onMagnitude) handlers.onMagnitude(Math.max(0, t) * scale);
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
    const d = Math.atan2(p.y, along);
    // 背面に回り込んだ(方位角が反対向きになる)場合は±90度で止める
    const lim = Math.PI / 2;
    if (handlers.onDelta) handlers.onDelta(Math.max(-lim, Math.min(lim, d)));
  }

  // 全体が画角に収まる距離にカメラを置き直す
  function fitCamera(extent) {
    const fitDist = (extent * 1.15) / Math.tan((camera.fov * Math.PI) / 180 / 2);
    camera.position.setLength(fitDist);
    controls.minDistance = fitDist * 0.15;
    controls.maxDistance = fitDist * 6;
  }

  function setVisible(visible) {
    centerMesh.visible = visible;
    planeGrid.visible = visible;
    referenceArrow.visible = visible;
    referenceLine.visible = visible;
    vectorArrow.visible = visible;
    shadowLine.visible = visible;
    riseLine.visible = visible;
    alphaArc.visible = visible;
    deltaArc.visible = visible;
  }

  // 絵が変わったときだけ描く (詳しくは view3d.js の makeRenderLoop)。
  // 対象のノードを選んでいない間は非表示なので、予約が入っても何もしない。
  const loop = makeRenderLoop(() => {
    if (!renderer || !scene || !camera) return;
    if (!renderer.domElement.offsetParent) return;
    resizeToDisplaySize();
    if (controls) controls.update();
    scaleHandleToScreen(vectorHandle, camera, renderer);
    scaleHandleToScreen(alphaHandle, camera, renderer);
    scaleHandleToScreen(deltaHandle, camera, renderer);
    renderer.render(scene, camera);
  });

  function invalidate(frames) {
    loop.invalidate(frames);
  }

  return {
    init,
    update,
    setHandlers,
    setActiveHandle,
    invalidate,
    /** いまの1目盛あたりの大きさ [km/s] */
    getScale: () => scale,
    // テスト・デバッグ用
    get scene() {
      return scene;
    },
    get camera() {
      return camera;
    },
    get controls() {
      return controls;
    },
  };
}
