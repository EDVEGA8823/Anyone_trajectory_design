import { createVinfView } from './vinf_view.js';

// 軌道脱出(周回軌道からの再出発)操作パネル用の遠景3Dビュー。
//
// 近景 (orbit_view.js) は天体のすぐそば・周回軌道のスケールで、近点ΔVで
// 双曲線に乗り移る様子を見せる。こちらはその先、天体から十分離れて
// V∞ に落ち着いたあとのスケールを見せる (中身は vinf_view.js を参照)。
//
// 打上げと同じく自動/手動があり、手動モードでは V∞・α・δ をこのビューの上で
// マウスで動かせる (自動モードでは読み取るだけ)。

const view = createVinfView("orbit_far_canvas");

export function initEscapeView() {
  view.init();
}

/** ドラッグでV∞・α・δが変わったときに呼ぶコールバックを登録する (手動モード用) */
export function setEscapeViewHandlers(h) {
  view.setHandlers(h);
}

/** どの欄のハンドルを出すか。null で全部隠す */
export function setEscapeActiveHandle(which) {
  view.setActiveHandle(which);
}

/** 軌道脱出の遠景ビューの表示内容を更新する (引数は vinf_view.js を参照) */
export function updateEscapeView(params) {
  view.update(params);
}

/** 軌道脱出の遠景ビューを描き直す予約を入れる */
export function invalidateEscapeView(frames) {
  view.invalidate(frames);
}

// テスト・デバッグ用
export const escapeView = view.view;
