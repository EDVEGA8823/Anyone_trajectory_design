import { launch_frame } from './trajectory.js';
import { createVectorView } from './vector_view.js';

// 軌道脱出(周回軌道からの再出発)操作パネル用の遠景3Dビュー。
//
// 近景 (orbit_view.js) は天体のすぐそば・周回軌道のスケールで、近点ΔVで
// 双曲線に乗り移る様子を見せる。こちらはその先、天体から十分離れて
// V∞に落ち着いたあとのスケールで、打上げビューとまったく同じ絵
// (脱出速度ベクトル V∞ と、それを決める2つの角度 方位角α・仰角δ) を見せる。
// 「天体を離れる瞬間の相対速度」という点で打上げの脱出速度と同じ量なので、
// 中身は launch_view.js とほぼ同じ設定で vector_view.js を使い回している。
//
// 打上げと違って軌道脱出は常に自動モード (次の目的地までランベールで解く)
// なので、ここは読み取り専用 (ドラッグでの編集は無い)。

const COLOR_VINF = 0xff8c1a;
const COLOR_ALPHA = 0x3b6fe0;
const COLOR_DELTA = 0xe0a03b;
const COLOR_PLANET_ORBIT = 0x4caf82;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

const view = createVectorView({
  canvasId: "orbit_far_canvas",
  cells: 10, // 1目盛 = 1 km/s。画角はこの ±5 km/s に合わせる (打上げビューと同じ)
  gridCells: 36,
  centerRadius: 0.55,
  alphaR: 3.2,
  deltaR: 2.2,
  colors: {
    vector: COLOR_VINF,
    alpha: COLOR_ALPHA,
    delta: COLOR_DELTA,
    reference: COLOR_PLANET_ORBIT,
    center: 0x3a7bd5,
  },
  ambient: 0.45,
  useSunLight: true,
  adaptiveScale: false,
});

export function initEscapeView() {
  view.init();
}

/**
 * 軌道脱出の遠景ビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {number} params.planetNum 天体の番号
 * @param {string} [params.key]   表示対象の識別子。変わったときだけ画角を取り直す
 * @param {number} params.vinf    |V∞| [km/s]
 * @param {number} params.alpha   方位角 [rad] (公転方向が0)
 * @param {number} params.delta   仰角 [rad] (軌道面から北向きが正)
 * @param {number[]} [params.planetPos] 天体の太陽中心位置 [km] (陰影の向きに使う)
 * @param {number[]} [params.planetVel] 天体の太陽中心速度 [km/s]
 */
export function updateEscapeView({ planetNum, key, vinf, alpha = 0, delta = 0, planetPos, planetVel }) {
  const ready = planetNum != undefined && planetNum != -1 && vinf != undefined && vinf >= 0;

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

/** 軌道脱出の遠景ビューを描き直す予約を入れる */
export function invalidateEscapeView(frames) {
  view.invalidate(frames);
}

// テスト・デバッグ用
export const escapeView = view;
