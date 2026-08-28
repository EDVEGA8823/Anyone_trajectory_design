import { launch_frame } from './trajectory.js';
import { createVectorView } from './vector_view.js';

// 打上げ操作パネル用の小さな3Dビュー。
// 出発天体を中心に、脱出速度ベクトル V∞ と、それを決める2つの角度
// (方位角 α・仰角 δ) を描く。
//
// 中身は vector_view.js の共通ビュー。「大きさ + 基準方向まわりの2角」で
// 決まる速度ベクトルという点で手動マヌーバのΔVとまったく同じなので、
// 同じ部品を設定違いで使い回している。ここでは
//   基準方向 = 天体の公転方向、1目盛 = 1 km/s (固定)、陰影 = 太陽方向
// という打上げ向けの取り決めだけを持つ。

const COLOR_VINF = 0xff8c1a;
const COLOR_ALPHA = 0x3b6fe0;
const COLOR_DELTA = 0xe0a03b;
const COLOR_PLANET_ORBIT = 0x4caf82;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

const view = createVectorView({
  canvasId: "launch_canvas",
  cells: 10, // 1目盛 = 1 km/s なので、グリッド全体で ±5 km/s
  centerRadius: 0.55, // 天体の見た目の半径 [km/s単位]。物理的な意味は無い
  alphaR: 3.2,
  deltaR: 2.2,
  colors: {
    vector: COLOR_VINF,
    alpha: COLOR_ALPHA,
    delta: COLOR_DELTA,
    reference: COLOR_PLANET_ORBIT,
    center: 0x3a7bd5,
  },
  // 太陽が天体の向こう側にあることも多いので、環境光はB面ビューより強めにして
  // 影の側でも天体が黒い塊にならないようにする
  ambient: 0.45,
  useSunLight: true,
  adaptiveScale: false, // 打上げのV∞は常に数km/sなので目盛りは固定でよい
});

export function initLaunchView() {
  view.init();
}

/** ドラッグでV∞・α・δが変わったときに呼ぶコールバックを登録する */
export function setLaunchViewHandlers(h) {
  view.setHandlers({
    onMagnitude: h && h.onVinf,
    onAlpha: h && h.onAlpha,
    onDelta: h && h.onDelta,
  });
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setLaunchActiveHandle(which) {
  view.setActiveHandle(which === "vinf" ? "vector" : which);
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
  const ready = planetNum != undefined && planetNum != -1 && vinf != undefined && vinf > 0;

  // 太陽は天体から見て -r_pla の向き。矢印では描かず、平行光の向きに反映する。
  let sunDir;
  const frame = planetPos && planetVel ? launch_frame(planetPos, planetVel) : undefined;
  if (frame && planetPos) {
    const rn = Math.hypot(planetPos[0], planetPos[1], planetPos[2]);
    if (rn > 1e-12) {
      const s = [-planetPos[0] / rn, -planetPos[1] / rn, -planetPos[2] / rn];
      const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      sunDir = [d(s, frame.x_hat), d(s, frame.z_hat), -d(s, frame.y_hat)];
    }
  }

  view.update({
    ready,
    key,
    magnitude: vinf,
    alpha,
    delta,
    centerColor: ready ? PLANET_COLORS[planetNum] ?? 0xddaa44 : undefined,
    sunDir,
  });
}

/** 打上げビューを描き直す予約を入れる */
export function invalidateLaunchView(frames) {
  view.invalidate(frames);
}

// テスト・デバッグ用 (以前のモジュール変数と同じものを見せる)
export const launchView = view;
