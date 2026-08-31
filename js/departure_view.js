import { createVinfView } from './vinf_view.js';

// 再出発(小天体にランデブーした状態から飛び立つ節)の操作パネル用3Dビュー。
//
// 中身は軌道脱出の遠景と同じひな型 (vinf_view.js)。違いは2つ:
//   ・近景が無い。小天体の重力はほとんど無く周回軌道を組む意味が薄いので、
//     「周回軌道から双曲線へ乗り移る」という近景の題材そのものが無い。
//     そのためこのビュー1つだけを出す (タブも無い)
//   ・中心を惑星のような球ではなく、軌道上の一点 (太陽系ビューのノードの印と
//     同じ見立て) として描く。小天体には「地表」も意味のある重力圏も無いので、
//     大きな球を描くと大きさや重力があるように見えて誤解を招く
//
// 同じ理由で、この節では速度を「V∞」ではなく「出発ΔV」と呼ぶ。無限遠まで
// 登る途中で重力に食われる分が無いので、噴いたΔVがそのまま相対速度になる。

const view = createVinfView("departure_canvas", { centerStyle: "node" });

export function initDepartureView() {
  view.init();
}

/** ドラッグでΔV・α・δが変わったときに呼ぶコールバックを登録する (手動モード用) */
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
