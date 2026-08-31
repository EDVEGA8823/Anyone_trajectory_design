import { createVinfView } from './vinf_view.js';

// 再出発(小天体にランデブーした状態から飛び立つ節)の操作パネル用3Dビュー。
//
// 中身は軌道脱出の遠景とまったく同じ (vinf_view.js)。違うのは、こちらには
// 近景が無いこと: 小天体の重力はほとんど無いので周回軌道を組む意味が薄く、
// 「周回軌道から双曲線へ乗り移る」という近景の題材そのものが無い。
// そのため再出発ではこのビュー1つだけを出す (タブも無い)。

const view = createVinfView("departure_canvas");

export function initDepartureView() {
  view.init();
}

/** ドラッグでV∞・α・δが変わったときに呼ぶコールバックを登録する */
export function setDepartureViewHandlers(h) {
  view.setHandlers(h);
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setDepartureActiveHandle(which) {
  view.setActiveHandle(which);
}

/** 再出発ビューの表示内容を更新する (引数は vinf_view.js を参照) */
export function updateDepartureView(params) {
  view.update(params);
}

/** 再出発ビューを描き直す予約を入れる */
export function invalidateDepartureView(frames) {
  view.invalidate(frames);
}

// テスト・デバッグ用
export const departureView = view.view;
