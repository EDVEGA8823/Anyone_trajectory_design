import { createVectorView } from './vector_view.js';
import { makeThemeApplier } from './view3d.js';
import { cssHex, onThemeChange } from '../ui/theme.js';

// 手動マヌーバ(DSM)の操作パネル用の小さな3Dビュー。
// 深宇宙の一点にいる探査機を中心に、噴射する ΔV と、それを決める2つの角度
// (方位角 α・仰角 δ) を描く。
//
// 中身は打上げビューと同じ vector_view.js の共通ビュー。設計変数の形が
// まったく同じ (大きさ + 基準方向まわりの2角) だからで、ここでは
//   基準方向 = 探査機の進行方向、目盛りはΔVの大きさに合わせて選ぶ、
//   天体が無いので陰影の太陽方向は使わない
// というマヌーバ向けの取り決めだけを持つ。

// 色は css/tokens.css の --line-* から取る (明るい配色と暗い配色で入れ替わる)
let COLOR_DV = 0x9b4fd8; // 他のビューの近点ΔVと同じ色
let COLOR_ALPHA = 0x3b6fe0;
let COLOR_DELTA = 0xe0a03b;
let COLOR_TRACK = 0x2a5bd7; // 進行方向 (太陽系ビューの遷移軌道と同じ色)
// 探査機のいる一点。天体ではないので、地に対して控えめな灰色にする
let COLOR_CENTER = 0x52545c;

function read_colors() {
  COLOR_DV = cssHex("--line-purple", 0x9b4fd8);
  COLOR_ALPHA = cssHex("--line-blue", 0x3b6fe0);
  COLOR_DELTA = cssHex("--line-orange", 0xe0a03b);
  COLOR_TRACK = cssHex("--line-track", 0x2a5bd7);
  COLOR_CENTER = cssHex("--gray-600", 0x52545c);
}

function color_list() {
  return [COLOR_DV, COLOR_ALPHA, COLOR_DELTA, COLOR_TRACK, COLOR_CENTER];
}
read_colors();

const view = createVectorView({
  canvasId: "dsm_canvas",
  cells: 10,
  // 深宇宙の一点なので天体は無い。探査機の位置を示す小さな点にする。
  centerRadius: 0.18,
  alphaR: 3.2,
  deltaR: 2.2,
  colors: {
    vector: COLOR_DV,
    alpha: COLOR_ALPHA,
    delta: COLOR_DELTA,
    reference: COLOR_TRACK,
    center: COLOR_CENTER,
  },
  // 太陽方向の陰影は使わないので、形が分かるよう全体を明るくする
  ambient: 0.75,
  useSunLight: false,
  // ΔVは数十m/sから数km/sまで幅がある。表示するノードが変わったときに
  // きりの良い目盛りを選び直す。
  adaptiveScale: true,
});

onThemeChange(makeThemeApplier(color_list, read_colors, () => view.scene, () => view.invalidate()));

export function initDsmView() {
  view.init();
}

/** ドラッグでΔV・α・δが変わったときに呼ぶコールバックを登録する */
export function setDsmViewHandlers(h) {
  view.setHandlers({
    onMagnitude: h && h.onDv,
    onAlpha: h && h.onAlpha,
    onDelta: h && h.onDelta,
  });
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setDsmActiveHandle(which) {
  view.setActiveHandle(which === "dv" ? "vector" : which);
}

/**
 * マヌーバビューの表示内容を更新する。
 *
 * @param {object} params
 * @param {string} [params.key] 表示対象の識別子。変わったときだけ画角と目盛りを取り直す
 * @param {number} params.dv    ΔVの大きさ [km/s]
 * @param {number} params.alpha 方位角 [rad] (進行方向が0)
 * @param {number} params.delta 仰角 [rad] (軌道面から法線向きが正)
 * @param {boolean} params.ready 前後のレグが決まっていて描けるか
 */
export function updateDsmView({ key, dv, alpha = 0, delta = 0, ready }) {
  view.update({ ready: !!ready, key, magnitude: dv ?? 0, alpha, delta });
}

/** いまの1目盛あたりのΔV [km/s] */
export function dsmViewScale() {
  return view.getScale();
}

/** マヌーバビューを描き直す予約を入れる */
export function invalidateDsmView(frames) {
  view.invalidate(frames);
}

// テスト・デバッグ用
export const dsmView = view;
