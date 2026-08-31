import { launch_frame } from './trajectory.js';
import { createVectorView } from './vector_view.js';

// 「天体を離れる瞬間の、天体に対する相対速度」を見る遠景3Dビューのひな型。
//
// 打上げビュー (launch_view.js) とまったく同じ絵 — 速度ベクトルと、それを
// 決める2つの角度 (方位角α・仰角δ) — を見せる。同じ量だが呼び名は場面で違う:
//   惑星の周回軌道から出ていく (軌道脱出) … 「脱出速度 V∞」。無限遠まで
//        離れたときに残る速度で、そこまで登る途中で重力に食われる分は
//        近点ΔV (近景 orbit_view.js) の側が受け持つ
//   小天体から飛び立つ (再出発)          … 「出発ΔV」。重力がほとんど無く
//        登る途中で食われる分も無限遠も意味を持たないので、噴いたΔVが
//        そのまま相対速度になる
//
// この絵が要る節は2つあり、どちらも「いま居る天体から自分の速度で飛び立つ」
// という同じ形をしている:
//   軌道脱出 (Escape)    … 惑星の周回軌道から出ていく。近景 (orbit_view.js) と
//                          タブで切り替える
//   再出発 (Departure)   … 小天体にランデブーした状態から飛び立つ。小天体には
//                          周回軌道を組む意味がほとんど無いので近景は無く、
//                          この遠景だけを出す
// 中身は vector_view.js の共通ビューで、ここでは
//   基準方向 = 天体の公転方向、1目盛 = 1 km/s (固定)、陰影 = 太陽方向
// という打上げ向けの取り決めを共有する。

const COLOR_VINF = 0xff8c1a;
const COLOR_ALPHA = 0x3b6fe0;
const COLOR_DELTA = 0xe0a03b;
const COLOR_PLANET_ORBIT = 0x4caf82;

const PLANET_COLORS = [
  0x9c9c9c, 0xe0c58f, 0x3a7bd5, 0xc1440e, 0xd9a066, 0xe4d2a4, 0x9fd8e0, 0x4f6fd8, 0xc9b28a,
];

// 取り込んだ小天体 (番号が惑星の範囲より後ろ) の色。岩っぽい色で塗る
const SMALL_BODY_COLOR = 0xddaa44;

// 中心を「軌道上の一点」として描くときの色。太陽系ビューの選択中ノードの印と
// 同じ色にして、同じものを指していると分かるようにする (js/plot.js)
const COLOR_NODE = 0x1f4fd8;

/**
 * 遠景ビューを1つ作る。
 * @param {string} canvasId 描画先のcanvasのid
 * @param {object} [opts]
 * @param {"body"|"node"} [opts.centerStyle] 中心の描き方 (vector_view.js を参照)。
 *        小天体は重力も大きさもほとんど無いので "node" (軌道上の一点) で描く
 */
export function createVinfView(canvasId, { centerStyle = "body" } = {}) {
  const node_center = centerStyle === "node";
  const view = createVectorView({
    canvasId,
    centerStyle,
    cells: 10, // 1目盛 = 1 km/s。画角はこの ±5 km/s に合わせる (打上げビューと同じ)
    gridCells: 36,
    // 一点として描くときは小さく。惑星のように場所を取ると、大きさのある
    // 天体に見えてしまう
    centerRadius: node_center ? 0.22 : 0.55,
    alphaR: 3.2,
    deltaR: 2.2,
    colors: {
      vector: COLOR_VINF,
      alpha: COLOR_ALPHA,
      delta: COLOR_DELTA,
      reference: COLOR_PLANET_ORBIT,
      center: node_center ? COLOR_NODE : 0x3a7bd5,
    },
    ambient: 0.45,
    useSunLight: true,
    adaptiveScale: false,
  });

  return {
    init: () => view.init(),

    /** ドラッグでV∞・α・δが変わったときに呼ぶコールバックを登録する (手動モード用) */
    setHandlers: (h) =>
      view.setHandlers({
        onMagnitude: h && h.onVinf,
        onAlpha: h && h.onAlpha,
        onDelta: h && h.onDelta,
      }),

    /** どの欄のハンドルを出すか。null で全部隠す */
    setActiveHandle: (which) => view.setActiveHandle(which === "vinf" ? "vector" : which),

    /**
     * 表示内容を更新する。
     *
     * @param {object} params
     * @param {number} params.planetNum 天体の番号 (-1 で「何も出さない」)
     * @param {string} [params.key]   表示対象の識別子。変わったときだけ画角を取り直す
     * @param {number} params.vinf    |V∞| [km/s]
     * @param {number} params.alpha   方位角 [rad] (公転方向が0)
     * @param {number} params.delta   仰角 [rad] (軌道面から北向きが正)
     * @param {number[]} [params.planetPos] 天体の太陽中心位置 [km] (陰影の向きに使う)
     * @param {number[]} [params.planetVel] 天体の太陽中心速度 [km/s]
     */
    update: ({ planetNum, key, vinf, alpha = 0, delta = 0, planetPos, planetVel }) => {
      const ready = planetNum != undefined && planetNum != -1 && vinf != undefined && vinf >= 0;

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
        // 一点として描くときは天体ごとの色を使わない (大きさのある天体を
        // 表しているわけではないので、色で天体を示すとかえって紛らわしい)
        centerColor: !ready || node_center ? undefined : PLANET_COLORS[planetNum] ?? SMALL_BODY_COLOR,
        sunDir,
      });
    },

    invalidate: (frames) => view.invalidate(frames),

    // テスト・デバッグ用
    view,
  };
}
