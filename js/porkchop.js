import { MU_SUN, get_planet_elements, get_planets_pos, JulianToDate, lambert_min_tof } from './trajectory.js';

// ポークチョップ図。
//
// 自動打上げのレグ (出発天体 → 次の天体) について、出発日と到着日を総当たりで
// 振ってランベール問題を解き、打上げエネルギー C3 などを色で塗った等高線図を出す。
// 「いつ出れば安く行けるのか」を一目で掴むための図で、軌道設計では定番の絵。
//
// 操作パネルの3Dビューに重ねて浮かぶウィンドウとして出す。動かせて、大きさも変えられる。
//
// 計算量は (出発日の数)×(到着日の数) 回のランベール。標準の 100×100 でも1万回あり、
// 手元のPCで 0.2 秒ほど、非力な端末ならその数倍かかる。まとめて回すと画面が固まって
// しまうので、数ミリ秒ごとに区切って進捗を出しながら計算する (compute_grid)。

const MIN_TOF_DAYS = 10; // これより短い飛行時間は Mission 側の最小間隔と揃えて除外する
const DAY = 86400;

// 何周までの解を計算するか。太陽を1周してから着く解は直行とはまったく別の
// 島として現れる。2周までで実用上ほぼ足りる (それ以上は飛行時間が長すぎる)
const MAX_REVS = 2;

// 周回数と分枝の組み合わせ。0周は解が1つだけ、1周以上は2つある
const COMBOS = (() => {
  const list = [{ rev: 0, low: true }];
  for (let m = 1; m <= MAX_REVS; m++) {
    list.push({ rev: m, low: true });
    list.push({ rev: m, low: false });
  }
  return list;
})();

// 表示する周回数。"auto" は各点で一番安い周回数を採る
let rev_mode = "auto";

// 表示できる指標。key はグリッドに持たせた配列名と対応する
const METRICS = {
  c3: {
    label: "打上げ C3",
    unit: "km²/s²",
    pick: (cell) => cell.c3,
    digits: 1,
  },
  arrive: {
    label: "到着 V∞",
    unit: "km/s",
    pick: (cell) => cell.varr,
    digits: 2,
  },
  total: {
    label: "合計 V∞",
    unit: "km/s",
    pick: (cell) => cell.vdep + cell.varr,
    digits: 2,
  },
};

// 低い(=安い)ほど青、高いほど赤。値の大小がそのまま「楽か苦しいか」に読めるようにする
const COLOR_STOPS = [
  [0.0, 0x30, 0x41, 0x9b],
  [0.25, 0x2b, 0x8f, 0xbd],
  [0.45, 0x2f, 0xa4, 0x6a],
  [0.65, 0xb6, 0xc6, 0x2f],
  [0.85, 0xe0, 0x8a, 0x2a],
  [1.0, 0xc3, 0x3a, 0x2a],
];

const PAD = { left: 78, right: 68, top: 20, bottom: 46 };
const HOVER_HINT = "クリックでその時刻に設定 / ドラッグで移動 / ホイールで拡大縮小";

let win = null; // ウィンドウのルート要素
let canvas = null;
let hover_el = null;
let spinner_el = null;
let status_el = null;
let title_el = null;
let metric_sel = null;
let rev_sel = null;
let dep_span_input = null;
let arr_span_input = null;
let res_sel = null;

let target = null; // {index, dep_num, arr_num, dep_date, arr_date}
let view = null; // いま映している日付の範囲 {dep0, dep1, arr0, arr1}
let grid = null; // compute_grid の結果 (自分が計算されたときの範囲を持つ)
let color_range = null; // 色と等高線の段階 {lo, hi, max, metric}。拡大しても変えない
let metric = "c3";
let job = 0; // 計算の世代番号。閉じたり作り直したりすると進めて古い計算を捨てる
let spinner_timer = 0;
let on_pick = null; // 後でマウス選択から時刻を決めるためのフック
let hover_cell = null;
let win_x = 0; // ウィンドウの画面上の位置 (position:fixed なので画面座標)
let win_y = 0;

/* ==================================================================
   計算
   ================================================================== */

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const wrap_pi = (x) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));

// 黄道面に投影した太陽から見た方向 [rad]
function longitude(num, date) {
  const { r } = get_planets_pos(get_planet_elements(date, num));
  return Math.atan2(r[1], r[0]);
}

/**
 * 図の初期表示範囲を、ホーマン遷移から見積もった打上げ窓のまわりに取る。
 *
 * ホーマン遷移 (両天体の軌道に内接する半楕円) は、二体問題で最も安い遷移の目安。
 * その飛行時間 T_h の間に目標天体が進む角 n2*T_h を差し引いた位相差
 *   φ_req = π - n2*T_h
 * のときに出発すれば、着いたところに目標天体が居る。位相差は会合周期で一巡するので、
 * いまの位相差からこの条件までの時間を求めれば、次の (または直前の) 窓が分かる。
 *
 * 実際の最適解は離心率と軌道傾斜のぶんだけずれるが、図に窓を収めるには十分な精度。
 * 現在の設定日が窓から離れている場合は、印が図から消えないように範囲を広げる
 * (ただし際限なく広げると肝心の谷が潰れるので、基準の2倍まで)。
 *
 * 再出発 (dep_min_date が入っているとき) は、見積もった窓がまるごと「まだ着いて
 * いない日付」に落ちることがある (ホーマン遷移の見積もりは天体に留まっている
 * 期間を知らないため)。その場合は窓の形はそのまま、出発・到着の両方をまとめて
 * 後ろへずらし、到着日より前が見えなくなるようにする。
 */
function auto_view(info) {
  const { dep_num, arr_num, dep_date, arr_date, dep_min_date } = info;
  const a1 = get_planet_elements(dep_date, dep_num)[0];
  const a2 = get_planet_elements(dep_date, arr_num)[0];

  // 平均運動 [rad/日]
  const n1 = Math.sqrt(MU_SUN / (a1 * a1 * a1)) * DAY;
  const n2 = Math.sqrt(MU_SUN / (a2 * a2 * a2)) * DAY;

  const at = (a1 + a2) / 2;
  const tof_h = Math.PI * Math.sqrt((at * at * at) / MU_SUN) / DAY; // ホーマン遷移の飛行時間 [日]

  const rate = n2 - n1; // 位相差が進む速さ [rad/日]
  let dep_c = dep_date;
  let synodic = Math.max(2 * Math.PI / Math.abs(n1), 2 * Math.PI / Math.abs(n2));

  if (Math.abs(rate) > 1e-12) {
    synodic = (2 * Math.PI) / Math.abs(rate);
    const phi_req = wrap_pi(Math.PI - n2 * tof_h);
    const phi_now = wrap_pi(longitude(arr_num, dep_date) - longitude(dep_num, dep_date));
    let dt = (phi_req - phi_now) / rate;
    dt = ((dt % synodic) + synodic) % synodic; // 次の窓まで [0, 会合周期)
    if (dt > synodic / 2) dt -= synodic; // 直前の窓のほうが近ければそちら
    dep_c = dep_date + dt;
  }
  const arr_c = dep_c + tof_h;

  // 出発側は窓の幅 (会合周期の1割強)、到着側は飛行時間の振れ幅を目安にする。
  // 外惑星は会合周期が短い割に窓が緩やかなので、飛行時間からの見積もりも下限に入れる。
  const dep_base = clamp(Math.max(synodic * 0.12, tof_h * 0.1), 60, 500);
  const arr_base = clamp(tof_h * 0.5, 60, 900);
  const dep_span = clamp(Math.max(dep_base, Math.min(Math.abs(dep_date - dep_c) + 30, dep_base * 2)), 20, 6000);
  const arr_span = clamp(Math.max(arr_base, Math.min(Math.abs(arr_date - arr_c) + 30, arr_base * 2)), 20, 6000);

  let dep0 = dep_c - dep_span;
  let dep1 = dep_c + dep_span;
  let arr0 = arr_c - arr_span;
  let arr1 = arr_c + arr_span;

  if (dep_min_date != undefined && dep1 < dep_min_date) {
    const shift = dep_min_date - dep0; // 窓の左端が到着日に来るところまで、両軸まとめてずらす
    dep0 += shift;
    dep1 += shift;
    arr0 += shift;
    arr1 += shift;
  }

  return { dep0, dep1, arr0, arr1 };
}

/**
 * 出発日×到着日の総当たりでランベールを解く。
 * 重いので数ミリ秒ごとに実行を手放し、その都度 on_progress を呼ぶ。
 *
 * @returns {Promise<object|null>} 世代が変わって捨てられた場合は null
 */
async function compute_grid(spec, on_progress, generation) {
  const { dep_num, arr_num, dep0, dep1, arr0, arr1, cols, rows } = spec;

  // 天体の位置・速度は日付ごとに決まるので、格子の各軸について先に1回ずつ求めておく
  // (格子の中で毎回計算すると cols*rows 回になり、ランベールより重くなる)
  const dep_r = new Float64Array(cols * 3);
  const dep_v = new Float64Array(cols * 3);
  const arr_r = new Float64Array(rows * 3);
  const arr_v = new Float64Array(rows * 3);
  const dep_t = new Float64Array(cols);
  const arr_t = new Float64Array(rows);

  for (let j = 0; j < cols; j++) {
    const t = cols === 1 ? dep0 : dep0 + ((dep1 - dep0) * j) / (cols - 1);
    dep_t[j] = t;
    const { r, v } = get_planets_pos(get_planet_elements(t, dep_num));
    for (let c = 0; c < 3; c++) {
      dep_r[j * 3 + c] = r[c];
      dep_v[j * 3 + c] = v[c];
    }
  }
  for (let k = 0; k < rows; k++) {
    const t = rows === 1 ? arr0 : arr0 + ((arr1 - arr0) * k) / (rows - 1);
    arr_t[k] = t;
    const { r, v } = get_planets_pos(get_planet_elements(t, arr_num));
    for (let c = 0; c < 3; c++) {
      arr_r[k * 3 + c] = r[c];
      arr_v[k * 3 + c] = v[c];
    }
  }

  const n = cols * rows;
  // 周回数と分枝の組み合わせごとに面を作る。表示のときにどれを使うかを選ぶので、
  // 指標を切り替えても解き直さなくて済む。
  // 周回数を固定しているときはその分だけ解く (自動の5通りに対して2通りなので、
  // 飛行時間の長い範囲では倍以上速くなる)
  const combos = spec.combos ?? COMBOS;
  const c3 = combos.map(() => new Float32Array(n).fill(NaN));
  const vdep = combos.map(() => new Float32Array(n).fill(NaN));
  const varr = combos.map(() => new Float32Array(n).fill(NaN));

  const r1 = [0, 0, 0];
  const r2 = [0, 0, 0];
  let mark = performance.now();
  let solved = 0;
  let calls = 0; // ランベールを解いた回数 (重さの目安。1回20マイクロ秒ほど)

  for (let k = 0; k < rows; k++) {
    r2[0] = arr_r[k * 3];
    r2[1] = arr_r[k * 3 + 1];
    r2[2] = arr_r[k * 3 + 2];

    for (let j = 0; j < cols; j++) {
      const tof = (arr_t[k] - dep_t[j]) * DAY;
      if (tof < MIN_TOF_DAYS * DAY) continue; // 到着が出発より前 / 短すぎる区間
      // 再出発 (dep_min_date あり): 実際に着いた日より前には出発できない
      if (spec.dep_min_date != undefined && dep_t[j] < spec.dep_min_date) continue;

      r1[0] = dep_r[j * 3];
      r1[1] = dep_r[j * 3 + 1];
      r1[2] = dep_r[j * 3 + 2];

      // 何周まで見込めるか。無理な周回数まで解かせると、そのぶん例外が飛んで
      // 何万セルぶんとなると効いてくる
      const limit = rev_limit(r1, r2, tof);
      const idx = k * cols + j;
      let any = false;

      for (let c = 0; c < combos.length; c++) {
        if (combos[c].rev > limit) continue;
        let v;
        calls++;
        try {
          v = lambert_probrem(MU_SUN, r1, r2, tof, combos[c].rev, true, combos[c].low);
        } catch (e) {
          continue; // 収束しない配置 (ほぼ180度遷移など) は空白のまま残す
        }
        if (!v || !v[0] || !v[1]) continue;

        const ax = v[0][0] - dep_v[j * 3];
        const ay = v[0][1] - dep_v[j * 3 + 1];
        const az = v[0][2] - dep_v[j * 3 + 2];
        const bx = v[1][0] - arr_v[k * 3];
        const by = v[1][1] - arr_v[k * 3 + 1];
        const bz = v[1][2] - arr_v[k * 3 + 2];
        const a2 = ax * ax + ay * ay + az * az;
        const b2 = bx * bx + by * by + bz * bz;
        if (!isFinite(a2) || !isFinite(b2)) continue;

        c3[c][idx] = a2; // C3 = |V∞|^2 がそのまま打上げエネルギー
        vdep[c][idx] = Math.sqrt(a2);
        varr[c][idx] = Math.sqrt(b2);
        any = true;
      }
      if (any) solved++;
    }

    // 数ミリ秒使ったら一度実行を手放す。ぐるぐると進捗が動き、操作も効くようになる
    const now = performance.now();
    if (now - mark > 12) {
      mark = now;
      if (on_progress) on_progress((k + 1) / rows);
      await new Promise((r) => setTimeout(r, 0));
      if (generation !== job) return null; // 閉じられた / 条件が変わった
    }
  }

  const grid = { ...spec, dep_t, arr_t, combos, c3, vdep, varr, solved, calls };
  // どの組み合わせを採るかは表示のたびに決まる。最初に一度きめておく
  choose_solutions(grid);
  return grid;
}

/**
 * その飛行時間で見込める周回数の上限。
 * trajectory.js の lambert_rev_limit と同じ式だが、こちらは何万回も回るので
 * mathjs を使わず素の演算で書く (1回あたり5マイクロ秒ほど違う)。
 */
function rev_limit(r1, r2, tof) {
  const cx = r2[0] - r1[0];
  const cy = r2[1] - r1[1];
  const cz = r2[2] - r1[2];
  const c = Math.sqrt(cx * cx + cy * cy + cz * cz);
  const n1 = Math.sqrt(r1[0] * r1[0] + r1[1] * r1[1] + r1[2] * r1[2]);
  const n2 = Math.sqrt(r2[0] * r2[0] + r2[1] * r2[1] + r2[2] * r2[2]);
  const s = (n1 + n2 + c) / 2;
  const T = Math.sqrt((2 * MU_SUN) / (s * s * s)) * tof;
  return Math.max(0, Math.floor(T / Math.PI));
}

// いまの表示に必要な組み合わせが、その格子に入っているか
function has_needed_combos(g) {
  if (!g || !g.combos) return false;
  if (rev_mode === "auto") return g.combos.length === COMBOS.length;
  return g.combos.some((c) => c.rev === rev_mode);
}

/**
 * 指定した周回数の解が成り立つところへ、到着日の範囲を移す。
 *
 * M周の解には最短飛行時間があり (地球→火星なら1周で817日)、既定の範囲は
 * ホーマン遷移のまわりなので、そのままでは1周の島がほとんど入らない。
 * 最短飛行時間を求めて、その少し先を中心にした窓に取り直す。
 *
 * @returns {boolean} 移したか
 */
function fit_view_for_revs(revs) {
  if (!view || !target) return false;
  const dep_c = (view.dep0 + view.dep1) / 2;
  const p1 = get_planets_pos(get_planet_elements(dep_c, target.dep_num)).r;

  // 最短飛行時間は到着側の位置にも依るので、2〜3回まわして落ち着かせる
  let arr_c = (view.arr0 + view.arr1) / 2;
  for (let k = 0; k < 3; k++) {
    const p2 = get_planets_pos(get_planet_elements(arr_c, target.arr_num)).r;
    const tof = lambert_min_tof(p1, p2, revs);
    if (tof == undefined) return false;
    arr_c = dep_c + (tof / DAY) * 1.25; // 最短ぴったりだと解が1点しかないので少し先
  }

  const half = clamp((arr_c - dep_c) * 0.3, 60, 3000);
  view.arr0 = arr_c - half;
  view.arr1 = arr_c + half;
  return true;
}

/**
 * 各点で「どの周回数・どの分枝を採るか」を決めて、その値を面に焼く。
 *
 * 自動のときは、いま色に使っている量が一番小さくなる組み合わせを採る。
 * 周回数を指定したときは、その周回数の2つの分枝のうち安い方。
 * 描画やマウス操作はこの結果 (value/choice) だけを見るので、周回数や指標を
 * 切り替えても解き直しは要らない。
 */
function choose_solutions(g) {
  if (!g) return;
  const n = g.dep_t.length * g.arr_t.length;
  const value = new Float32Array(n).fill(NaN);
  const choice = new Int8Array(n).fill(-1);

  for (let c = 0; c < g.combos.length; c++) {
    if (rev_mode !== "auto" && g.combos[c].rev !== rev_mode) continue;
    const c3 = g.c3[c];
    const vdep = g.vdep[c];
    const varr = g.varr[c];
    for (let i = 0; i < n; i++) {
      const base = c3[i];
      if (!(base === base)) continue;
      const v = metric === "c3" ? base : metric === "arrive" ? varr[i] : vdep[i] + varr[i];
      if (!(v === v)) continue;
      if (choice[i] < 0 || v < value[i]) {
        value[i] = v;
        choice[i] = c;
      }
    }
  }
  g.value = value;
  g.choice = choice;
}

/**
 * 指定した日付ぴったりの遷移をひとつ解く。
 *
 * 格子は表示のためのもので点が粗いので、マウスが指している値とクリックで決まる時刻は
 * こちらで解き直す。1回 20μs 程度なのでマウスを動かすたびに解いても問題にならないし、
 * 「読めた値」と「設定される時刻」が食い違わない。
 */
function solve_point(dep_num, arr_num, t1, t2) {
  const tof = (t2 - t1) * DAY;
  if (!(tof >= MIN_TOF_DAYS * DAY)) return null;

  const p1 = get_planets_pos(get_planet_elements(t1, dep_num));
  const p2 = get_planets_pos(get_planet_elements(t2, arr_num));
  const limit = rev_limit(p1.r, p2.r, tof);

  // 表示している周回数の中で、いま色に使っている量が一番小さいものを採る
  let best = null;
  for (const cb of COMBOS) {
    if (cb.rev > limit) continue;
    if (rev_mode !== "auto" && cb.rev !== rev_mode) continue;

    let v;
    try {
      v = lambert_probrem(MU_SUN, p1.r, p2.r, tof, cb.rev, true, cb.low);
    } catch (e) {
      continue;
    }
    if (!v || !v[0] || !v[1]) continue;

    const ax = v[0][0] - p1.v[0], ay = v[0][1] - p1.v[1], az = v[0][2] - p1.v[2];
    const bx = v[1][0] - p2.v[0], by = v[1][1] - p2.v[1], bz = v[1][2] - p2.v[2];
    const a2 = ax * ax + ay * ay + az * az;
    const b2 = bx * bx + by * by + bz * bz;
    if (!isFinite(a2) || !isFinite(b2)) continue;

    const vdep = Math.sqrt(a2);
    const varr = Math.sqrt(b2);
    const value = metric === "c3" ? a2 : metric === "arrive" ? varr : vdep + varr;
    if (best == null || value < best.value) {
      best = { c3: a2, vdep, varr, rev: cb.rev, low: cb.low, value };
    }
  }
  return best;
}

// 格子の (j,k) の指標値。無効なセルは NaN
// (どの周回数の解を採るかは choose_solutions が決めてある)
function cell_value(g, idx) {
  return g.value ? g.value[idx] : NaN;
}

/** その点で採用している周回数と分枝 */
function cell_combo(g, idx) {
  if (!g || !g.choice) return null;
  const c = g.choice[idx];
  return c < 0 ? null : g.combos[c];
}

/* ==================================================================
   色と目盛り
   ================================================================== */

function color_at(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const a = COLOR_STOPS[i - 1];
    const b = COLOR_STOPS[i];
    if (x <= b[0] || i === COLOR_STOPS.length - 1) {
      const f = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      return [
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
        Math.round(a[3] + (b[3] - a[3]) * f),
      ];
    }
  }
  return [0, 0, 0];
}

// 色の上限。「ここまでが検討に値する」範囲に切る。
// C3は窓から外れると桁で跳ね上がるので、全範囲を色に割り当てると、絶望的に高い隅の
// せいで肝心の谷が潰れて一面赤になってしまう。安い方の1/3だけに色を使い、
// それより高いところは灰色にして図から退かせる (ポークチョップ図の通例)。
const COLOR_QUANTILE = 0.35;

// 格子の点の数 (c3 などは組み合わせごとの面の配列なので、その長さではない)
function cell_count(g) {
  return g && g.value ? g.value.length : 0;
}

function measure_range(g) {
  const vals = [];
  for (let i = 0; i < cell_count(g); i++) {
    const v = cell_value(g, i);
    if (v === v) vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  const lo = vals[0];
  let hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * COLOR_QUANTILE))];
  if (!(hi > lo)) hi = lo + Math.max(1, Math.abs(lo) * 0.2);
  return { lo, hi, max: vals[vals.length - 1], metric };
}

/**
 * 色と等高線の段階を決める。
 *
 * 一度決めたら拡大縮小しても変えない。表示範囲ごとに測り直すと、同じ場所を見ていても
 * 等高線の値が変わってしまい、拡大するたびに図の形が変わったように見えるため。
 * ただし映している範囲の値がすべて段階の外に出てしまったら (一面灰色 / 一面同色)
 * 読めないので、そのときだけ測り直す。
 *
 * @param {boolean} force 指標を変えたときなど、明示的に測り直す
 */
function ensure_color_range(force) {
  if (!grid) return;
  if (force || !color_range || color_range.metric !== metric) {
    color_range = measure_range(grid);
    return;
  }
  const r = measure_range(grid);
  if (!r) return;
  if (r.lo > color_range.hi || r.max < color_range.lo) color_range = r;
}

// 1/2/5 刻みで、だいたい n 本になる等高線の値を選ぶ
function nice_levels(lo, hi, n) {
  const raw = (hi - lo) / n;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / pow;
  const step = (norm > 5 ? 10 : norm > 2 ? 5 : norm > 1 ? 2 : 1) * pow;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return { levels: out, step };
}

function fmt_date(jd, short) {
  const d = JulianToDate(jd);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return short ? String(y).slice(2) + "/" + m + "/" + day : y + "/" + m + "/" + day;
}

/* ==================================================================
   描画
   ================================================================== */

function plot_rect() {
  return {
    x: PAD.left,
    y: PAD.top,
    w: canvas.clientWidth - PAD.left - PAD.right,
    h: canvas.clientHeight - PAD.top - PAD.bottom,
  };
}

// 日付 → 画面座標 (いま映している範囲 view が基準)
function to_px(rect, dep, arr) {
  const fx = (dep - view.dep0) / (view.dep1 - view.dep0);
  const fy = (arr - view.arr0) / (view.arr1 - view.arr0);
  return { x: rect.x + fx * rect.w, y: rect.y + (1 - fy) * rect.h };
}

// 画面座標 → 日付
function to_date(rect, px, py) {
  const fx = (px - rect.x) / rect.w;
  const fy = 1 - (py - rect.y) / rect.h;
  return {
    dep: view.dep0 + fx * (view.dep1 - view.dep0),
    arr: view.arr0 + fy * (view.arr1 - view.arr0),
  };
}

function draw() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const rect = plot_rect();
  if (rect.w <= 10 || rect.h <= 10) return;

  ctx.fillStyle = "#f7f7f9";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  if (!view) {
    ctx.strokeStyle = "#e3e4e8";
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
    return;
  }

  // 計算済みの格子は、いま映している範囲に合わせて置き直して描く。
  // マウスで動かした直後はまだ計算が追いついていないので、この場合だけ
  // 図がずれた位置・大きさで出る (計算が終われば view と一致する)。
  const range = grid ? color_range : null;
  if (range) {
    draw_field(ctx, rect, range);
    draw_contours(ctx, rect, range);
    draw_rev_borders(ctx, rect);
    draw_colorbar(ctx, rect, range);
  }
  draw_dep_min(ctx, rect);
  draw_tof_lines(ctx, rect);
  draw_axes(ctx, rect);
  draw_markers(ctx, rect, range);

  ctx.strokeStyle = "#c9ccd3";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
}

// 色の面。格子と同じ大きさの画像を作って引き伸ばす
function draw_field(ctx, rect, range) {
  const g = grid;
  const img = ctx.createImageData(g.cols, g.rows);
  const d = img.data;
  for (let k = 0; k < g.rows; k++) {
    // 画像は上が行0。到着日は上ほど大きいので上下を入れ替える
    const row = (g.rows - 1 - k) * g.cols;
    for (let j = 0; j < g.cols; j++) {
      const v = cell_value(g, k * g.cols + j);
      const o = (row + j) * 4;
      if (!(v === v)) {
        // 解が無い (到着が出発より前など)
        d[o] = 246;
        d[o + 1] = 246;
        d[o + 2] = 248;
        d[o + 3] = 255;
        continue;
      }
      if (v > range.hi) {
        // 高すぎて検討に値しない領域。灰色にして谷を目立たせる
        d[o] = 226;
        d[o + 1] = 226;
        d[o + 2] = 229;
        d[o + 3] = 255;
        continue;
      }
      const c = color_at((v - range.lo) / (range.hi - range.lo));
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
  }
  const off = document.createElement("canvas");
  off.width = g.cols;
  off.height = g.rows;
  off.getContext("2d").putImageData(img, 0, 0);

  // 画像の1画素は格子点を中心とした1マスなので、両端に半マスぶん食み出させる
  const hx = (g.dep1 - g.dep0) / (g.cols - 1) / 2;
  const hy = (g.arr1 - g.arr0) / (g.rows - 1) / 2;
  const a = to_px(rect, g.dep0 - hx, g.arr0 - hy);
  const b = to_px(rect, g.dep1 + hx, g.arr1 + hy);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, a.x, b.y, b.x - a.x, a.y - b.y);
  ctx.restore();
}

// 等高線 (マーチングスクエア)。ポークチョップ図の「谷」の形はこの線で読む
function draw_contours(ctx, rect, range) {
  const g = grid;
  const { levels } = nice_levels(range.lo, range.hi, 8);
  // 格子の添字を日付に直してから画面座標にする (マウスで動かした直後は
  // 映している範囲と格子の範囲がずれているため)
  const sx = (g.dep1 - g.dep0) / (g.cols - 1);
  const sy = (g.arr1 - g.arr0) / (g.rows - 1);
  const px = (j, k) => to_px(rect, g.dep0 + j * sx, g.arr0 + k * sy);

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.beginPath();

  for (const L of levels) {
    for (let k = 0; k < g.rows - 1; k++) {
      for (let j = 0; j < g.cols - 1; j++) {
        const v00 = cell_value(g, k * g.cols + j);
        const v10 = cell_value(g, k * g.cols + j + 1);
        const v11 = cell_value(g, (k + 1) * g.cols + j + 1);
        const v01 = cell_value(g, (k + 1) * g.cols + j);
        if (!(v00 === v00 && v10 === v10 && v11 === v11 && v01 === v01)) continue;

        const code = (v00 > L ? 1 : 0) | (v10 > L ? 2 : 0) | (v11 > L ? 4 : 0) | (v01 > L ? 8 : 0);
        if (code === 0 || code === 15) continue;

        const bottom = () => px(j + (L - v00) / (v10 - v00), k);
        const right = () => px(j + 1, k + (L - v10) / (v11 - v10));
        const top = () => px(j + (L - v01) / (v11 - v01), k + 1);
        const left = () => px(j, k + (L - v00) / (v01 - v00));
        const seg = (a, b) => {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        };

        switch (code) {
          case 1: case 14: seg(left(), bottom()); break;
          case 2: case 13: seg(bottom(), right()); break;
          case 3: case 12: seg(left(), right()); break;
          case 4: case 11: seg(right(), top()); break;
          case 6: case 9: seg(bottom(), top()); break;
          case 7: case 8: seg(left(), top()); break;
          // 鞍点。どちらに繋がるか一意でないので両方引く
          case 5: seg(left(), bottom()); seg(right(), top()); break;
          case 10: seg(bottom(), right()); seg(left(), top()); break;
        }
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * 周回数が切り替わる境目を点線で示す (自動のときだけ)。
 * 多周回の解は直行とは別の島として現れるので、どこからが「1周の島」なのかが
 * 見えないと、地図の谷が2つあることに気付けない。
 */
function draw_rev_borders(ctx, rect) {
  if (rev_mode !== "auto" || !grid || !grid.choice) return;
  const g = grid;
  const sx = (g.dep1 - g.dep0) / (g.cols - 1);
  const sy = (g.arr1 - g.arr0) / (g.rows - 1);
  const rev_at = (j, k) => {
    const c = g.choice[k * g.cols + j];
    return c < 0 ? -1 : g.combos[c].rev;
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "rgba(23,24,26,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let k = 0; k < g.rows; k++) {
    for (let j = 0; j < g.cols; j++) {
      const here = rev_at(j, k);
      if (here < 0) continue;
      // 右隣と周回数が違えば、その間に縦線
      if (j + 1 < g.cols && rev_at(j + 1, k) >= 0 && rev_at(j + 1, k) !== here) {
        const a = to_px(rect, g.dep0 + (j + 0.5) * sx, g.arr0 + (k - 0.5) * sy);
        const b = to_px(rect, g.dep0 + (j + 0.5) * sx, g.arr0 + (k + 0.5) * sy);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      // 上隣と違えば横線
      if (k + 1 < g.rows && rev_at(j, k + 1) >= 0 && rev_at(j, k + 1) !== here) {
        const a = to_px(rect, g.dep0 + (j - 0.5) * sx, g.arr0 + (k + 0.5) * sy);
        const b = to_px(rect, g.dep0 + (j + 0.5) * sx, g.arr0 + (k + 0.5) * sy);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * 再出発の図だけに出る、出発日の下限 (=その天体に実際に着いた日) の境界。
 * 左側 (それより前) は物理的に選べないので、斜線で塗って一目で区別できるように
 * する ("解が無い" とは違う理由であることを、灰色の無効域と見分けさせるため)。
 */
function draw_dep_min(ctx, rect) {
  if (!target || target.dep_min_date == undefined || !view) return;
  const t = target.dep_min_date;
  if (t <= view.dep0) return; // 窓がまるごと到着後 (境界は窓の外・左)

  const xAt = to_px(rect, Math.min(t, view.dep1), view.arr0).x;
  const x = clamp(xAt, rect.x, rect.x + rect.w);
  const w = x - rect.x;
  if (w <= 0) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, w, rect.h);
  ctx.clip();
  ctx.strokeStyle = "rgba(23,24,26,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  const step = 7;
  for (let sx = rect.x - rect.h; sx < x; sx += step) {
    ctx.moveTo(sx, rect.y + rect.h);
    ctx.lineTo(sx + rect.h, rect.y);
  }
  ctx.stroke();
  ctx.restore();

  if (t > view.dep1) return; // 境界そのものは窓の外 (右)。斜線だけで済ませる

  ctx.save();
  ctx.strokeStyle = "#b5341f";
  ctx.setLineDash([5, 3]);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x, rect.y);
  ctx.lineTo(x, rect.y + rect.h);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.font = "10px " + FONT;
  ctx.fillStyle = "#b5341f";
  const near_right = x > rect.x + rect.w - 70;
  ctx.textAlign = near_right ? "right" : "left";
  ctx.textBaseline = "top";
  ctx.fillText("到着 " + fmt_date(t, true), x + (near_right ? -4 : 4), rect.y + 3);
  ctx.restore();
}

// 飛行時間が一定の斜め線。ポークチョップ図では出発日と到着日が軸なので、
// 「何日で行くか」はこの斜めの向きに読む
function draw_tof_lines(ctx, rect) {
  const g = view;
  const tof_min = Math.max(MIN_TOF_DAYS, g.arr0 - g.dep1);
  const tof_max = g.arr1 - g.dep0;
  if (!(tof_max > tof_min)) return;
  const { levels } = nice_levels(tof_min, tof_max, 5);

  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(23,24,26,0.35)";
  ctx.fillStyle = "rgba(23,24,26,0.55)";
  ctx.font = "10px " + FONT;
  ctx.lineWidth = 1;

  for (const T of levels) {
    // arr = dep + T の線。図の範囲に収まる区間だけ引く
    const d_lo = Math.max(g.dep0, g.arr0 - T);
    const d_hi = Math.min(g.dep1, g.arr1 - T);
    if (!(d_hi > d_lo)) continue;
    const a = to_px(rect, d_lo, d_lo + T);
    const b = to_px(rect, d_hi, d_hi + T);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // 線の途中に日数を置く。潰れないよう端から少し内側に
    const t = 0.72;
    const lx = a.x + (b.x - a.x) * t;
    const ly = a.y + (b.y - a.y) * t;
    const text = Math.round(T) + "日";
    ctx.save();
    ctx.setLineDash([]);
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(lx - tw / 2 - 2, ly - 6, tw + 4, 12);
    ctx.fillStyle = "rgba(23,24,26,0.65)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, lx, ly);
    ctx.restore();
  }
  ctx.restore();
}

const FONT = '"Noto Sans JP", system-ui, sans-serif';

function draw_axes(ctx, rect) {
  const g = view;
  ctx.save();
  ctx.font = "10px " + FONT;
  ctx.fillStyle = "#52545c";
  ctx.strokeStyle = "#c9ccd3";

  const N = 4;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= N; i++) {
    const jd = g.dep0 + ((g.dep1 - g.dep0) * i) / N;
    const x = rect.x + (rect.w * i) / N;
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x, rect.y + rect.h + 4);
    ctx.stroke();
    ctx.fillText(fmt_date(jd, true), x, rect.y + rect.h + 7);
  }
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= N; i++) {
    const jd = g.arr0 + ((g.arr1 - g.arr0) * i) / N;
    const y = rect.y + rect.h - (rect.h * i) / N;
    ctx.beginPath();
    ctx.moveTo(rect.x - 4, y);
    ctx.lineTo(rect.x, y);
    ctx.stroke();
    ctx.fillText(fmt_date(jd, true), rect.x - 6, y);
  }

  ctx.fillStyle = "#3c3e45";
  ctx.font = "600 11px " + FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("出発日", rect.x + rect.w / 2, canvas.clientHeight - 3);
  ctx.save();
  ctx.translate(8, rect.y + rect.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "top";
  ctx.fillText("到着日", 0, 0);
  ctx.restore();
  ctx.restore();
}

function draw_colorbar(ctx, rect, range) {
  const x = rect.x + rect.w + 14;
  const w = 12;
  const over_h = 12; // 上限より高いところ (灰色) の分
  const y = rect.y + over_h;
  const h = rect.h - over_h;

  // 上限より上は図でも灰色にしてあるので、色帯の上にその分を継ぎ足しておく
  ctx.fillStyle = "rgb(226,226,229)";
  ctx.fillRect(x, rect.y, w, over_h);
  ctx.save();
  ctx.font = "9px " + FONT;
  ctx.fillStyle = "#71747c";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("以上", x + w + 5, rect.y + over_h / 2);
  ctx.restore();

  for (let i = 0; i < h; i++) {
    const c = color_at(1 - i / (h - 1));
    ctx.fillStyle = "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    ctx.fillRect(x, y + i, w, 1);
  }
  ctx.strokeStyle = "#c9ccd3";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);

  const m = METRICS[metric];
  const { levels } = nice_levels(range.lo, range.hi, 5);
  ctx.save();
  ctx.font = "10px " + FONT;
  ctx.fillStyle = "#52545c";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const L of levels) {
    const f = (L - range.lo) / (range.hi - range.lo);
    const ly = y + h - f * h;
    ctx.beginPath();
    ctx.moveTo(x + w, ly);
    ctx.lineTo(x + w + 3, ly);
    ctx.stroke();
    ctx.fillText(L.toFixed(m.digits), x + w + 5, ly);
  }
  ctx.fillStyle = "#71747c";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(m.unit, x + w + 30, rect.y - 4);
  ctx.restore();
}

// いまのシーケンスの日付と、図の中の最小点
function draw_markers(ctx, rect, range) {
  const g = grid;

  // 最小点
  if (range && g) {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < cell_count(g); i++) {
      const v = cell_value(g, i);
      if (v === v && v < bv) {
        bv = v;
        best = i;
      }
    }
    if (best >= 0) {
      const j = best % g.cols;
      const k = Math.floor(best / g.cols);
      const p = to_px(rect, g.dep_t[j], g.arr_t[k]);
      if (inside(rect, p)) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#17181a";
        ctx.lineWidth = 1.4;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // いまの設定
  if (target && target.dep_date != undefined && target.arr_date != undefined) {
    const p = to_px(rect, target.dep_date, target.arr_date);
    if (!inside(rect, p)) {
      draw_offscreen_hint(ctx, rect, p);
    } else {
      ctx.save();
      ctx.strokeStyle = "#17181a";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(rect.x, p.y);
      ctx.lineTo(rect.x + rect.w, p.y);
      ctx.moveTo(p.x, rect.y);
      ctx.lineTo(p.x, rect.y + rect.h);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#2451b8";
      ctx.stroke();
      ctx.restore();
    }
  }

  // マウスの位置
  if (hover_cell) {
    const p = to_px(rect, hover_cell.dep, hover_cell.arr);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(23,24,26,0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
}

function inside(rect, p) {
  return p.x >= rect.x - 1 && p.x <= rect.x + rect.w + 1 && p.y >= rect.y - 1 && p.y <= rect.y + rect.h + 1;
}

// いまの設定が図の外に出てしまったときに、どちらにあるかを縁の三角形で示す。
// 拡大や移動をしても「自分がいまどこを見ているか」を見失わないようにする。
function draw_offscreen_hint(ctx, rect, p) {
  const cx = clamp(p.x, rect.x + 8, rect.x + rect.w - 8);
  const cy = clamp(p.y, rect.y + 8, rect.y + rect.h - 8);
  const dx = p.x - cx;
  const dy = p.y - cy;
  const n = Math.hypot(dx, dy);
  if (n < 1e-6) return;
  const ux = dx / n;
  const uy = dy / n;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(uy, ux));
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-3, 4.5);
  ctx.lineTo(-3, -4.5);
  ctx.closePath();
  ctx.fillStyle = "#2451b8";
  ctx.fill();
  ctx.restore();
}

/* ==================================================================
   ウィンドウ (DOM)
   ================================================================== */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function build_window() {
  const root = el("div", "pc-window");

  const head = el("div", "pc-head");
  title_el = el("div", "pc-title", "ポークチョップ図");
  const close = el("button", "pc-close", "×");
  close.type = "button";
  close.title = "閉じる";
  close.onclick = () => closePorkchop();
  head.appendChild(title_el);
  head.appendChild(close);
  root.appendChild(head);

  const bar = el("div", "pc-bar");

  metric_sel = document.createElement("select");
  for (const key of Object.keys(METRICS)) {
    const o = document.createElement("option");
    o.value = key;
    o.textContent = METRICS[key].label;
    metric_sel.appendChild(o);
  }
  metric_sel.value = metric;
  metric_sel.title =
    "色で塗る量\n" +
    "打上げ C3: 出発のエネルギー (V∞の2乗)\n" +
    "到着 V∞: 目標天体に対する到着速度\n" +
    "合計 V∞: 出発のV∞と到着のV∞の和 (行きと着きの両方を見るとき)";
  metric_sel.onchange = () => {
    metric = metric_sel.value;
    choose_solutions(grid); // 量が変われば、どの周回数が安いかも変わる
    ensure_color_range(true); // 桁も変わるので測り直す
    draw();
    update_status();
  };
  bar.appendChild(metric_sel);

  // 周回数。太陽を何周してから着く解を見るか
  rev_sel = document.createElement("select");
  [
    ["auto", "周回 自動"],
    ["0", "周回 直行"],
    ["1", "周回 1周"],
    ["2", "周回 2周"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    rev_sel.appendChild(o);
  });
  rev_sel.value = "auto";
  rev_sel.title =
    "太陽を何周してから着く解を見るか。\n" +
    "自動: 各点で一番安い周回数を採る (点線が周回数の境目)\n" +
    "周回数を固定すると、その解だけの地図になる";
  rev_sel.onchange = () => {
    rev_mode = rev_sel.value === "auto" ? "auto" : Number(rev_sel.value);
    // 多周回の解は飛行時間が長いところにしか無い。いまの範囲のままだと
    // ほとんど空白になってしまうので、その周回数が成り立つ範囲へ移す
    if (rev_mode !== "auto" && rev_mode > 0 && fit_view_for_revs(rev_mode)) {
      sync_inputs();
      recompute();
      return;
    }
    // 手元の格子に、いま要る組み合わせが入っていなければ解き直す
    if (!grid || !has_needed_combos(grid)) {
      recompute();
      return;
    }
    choose_solutions(grid);
    ensure_color_range(true);
    draw();
    update_status();
  };
  bar.appendChild(rev_sel);

  const mk_span = (label, title) => {
    const wrap = el("label", "pc-span");
    wrap.appendChild(el("span", null, label));
    const input = document.createElement("input");
    input.type = "number";
    input.min = "10";
    input.step = "10";
    input.title = title;
    wrap.appendChild(input);
    wrap.appendChild(el("span", "pc-unit", "日"));
    input.onchange = () => {
      apply_inputs();
      recompute();
    };
    bar.appendChild(wrap);
    return input;
  };
  dep_span_input = mk_span("出発 ±", "映している出発日の幅 (中心から前後この日数)");
  arr_span_input = mk_span("到着 ±", "映している到着日の幅 (中心から前後この日数)");

  res_sel = document.createElement("select");
  [
    ["60", "粗い"],
    ["100", "標準"],
    ["150", "細かい"],
  ].forEach(([v, t]) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    res_sel.appendChild(o);
  });
  res_sel.value = "100";
  res_sel.title = "格子の細かさ。細かいほど時間がかかる";
  res_sel.onchange = () => recompute();
  bar.appendChild(res_sel);

  const fit = el("button", "pc-sub", "色合わせ");
  fit.type = "button";
  fit.title =
    "色と等高線の段階を、いま映っている範囲に合わせ直す。\n" +
    "段階は拡大縮小しても変わらないようにしてあるので (変えると図の形が変わって見える)、\n" +
    "拡大して色の差が乏しくなったときに押す。";
  fit.onclick = () => {
    ensure_color_range(true);
    draw();
    update_status();
  };
  bar.appendChild(fit);

  const reset = el("button", "pc-run", "初期範囲");
  reset.type = "button";
  reset.title = "ホーマン遷移から見積もった打上げ窓のまわりに戻す";
  reset.onclick = () => {
    if (!target) return;
    view = auto_view(target);
    color_range = null; // 範囲を戻すので色の段階も取り直す
    sync_inputs();
    recompute();
  };
  bar.appendChild(reset);

  root.appendChild(bar);

  const body = el("div", "pc-body");
  canvas = document.createElement("canvas");
  canvas.className = "pc-canvas";
  body.appendChild(canvas);

  spinner_el = el("div", "pc-spinner");
  spinner_el.appendChild(el("div", "pc-ring"));
  spinner_el.appendChild(el("div", "pc-progress", "0%"));
  spinner_el.style.display = "none";
  body.appendChild(spinner_el);
  root.appendChild(body);

  hover_el = el("div", "pc-hover", HOVER_HINT);
  root.appendChild(hover_el);
  status_el = el("div", "pc-status", "");
  root.appendChild(status_el);

  canvas.addEventListener("mousemove", on_move);
  canvas.addEventListener("mouseleave", () => {
    hover_cell = null;
    hover_el.textContent = HOVER_HINT;
    draw();
  });
  canvas.addEventListener("click", on_click);
  canvas.addEventListener("wheel", on_wheel, { passive: false });
  canvas.addEventListener("mousedown", on_pan_start);
  canvas.addEventListener("touchstart", on_touch_start, { passive: false });
  canvas.addEventListener("touchmove", on_touch_move, { passive: false });
  canvas.addEventListener("touchend", on_touch_end);

  make_draggable(root, head);

  // 大きさを変えたら描き直す (CSS の resize で伸縮できるようにしてある)
  if (window.ResizeObserver) {
    new ResizeObserver(() => draw()).observe(root);
  }
  // 画面が狭くなったときに、ウィンドウが外へはみ出したままにならないようにする
  window.addEventListener("resize", () => {
    if (isPorkchopOpen()) place(win_x, win_y);
  });

  return root;
}

// 画面の中に収まる位置に置く (ウィンドウは position:fixed なので画面座標そのまま)
function place(x, y) {
  win_x = Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - win.offsetWidth - 8));
  win_y = Math.min(Math.max(y, 8), Math.max(8, window.innerHeight - win.offsetHeight - 8));
  win.style.left = win_x + "px";
  win.style.top = win_y + "px";
}

// 操作パネルの3Dビューに重ねる位置を初期位置にする。
// 図を開くきっかけになったボタンのすぐ近くに出るので、視線を動かさずに済む。
function place_over_view() {
  // 図を開いたボタンと同じ箱の3Dビューに重ねる。打上げなら打上げビュー、
  // 軌道脱出なら遠景ビュー。隠れている箱のビューは大きさ0の矩形を返すので、
  // いま実際に画面に出ているものだけを見る (以前は打上げの箱だけを見ていて、
  // 軌道脱出から開くと大きさ0を基準にしてしまい画面の左上隅に出ていた)。
  const view = [...document.querySelectorAll(".view-3d")].find(
    (el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0
  );
  if (!view) {
    place(window.innerWidth - win.offsetWidth - 24, 90);
    return;
  }
  const r = view.getBoundingClientRect();
  place(r.left + r.width / 2 - win.offsetWidth / 2, r.top + r.height / 2 - win.offsetHeight / 2);
}

// ヘッダーを掴んで動かせるようにする
function make_draggable(root, handle) {
  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;
  let moving = false;

  const down = (e) => {
    if (e.target.closest(".pc-close")) return;
    moving = true;
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX;
    sy = p.clientY;
    ox = win_x;
    oy = win_y;
    e.preventDefault();
  };
  const move = (e) => {
    if (!moving) return;
    const p = e.touches ? e.touches[0] : e;
    place(ox + p.clientX - sx, oy + p.clientY - sy);
    e.preventDefault();
  };
  const up = () => {
    moving = false;
  };

  handle.addEventListener("mousedown", down);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
  handle.addEventListener("touchstart", down, { passive: false });
  window.addEventListener("touchmove", move, { passive: false });
  window.addEventListener("touchend", up);
}

// マウス位置をキャンバス内の座標に直す
function canvas_pos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.clientWidth,
    y: ((e.clientY - r.top) / r.height) * canvas.clientHeight,
  };
}

// マウスが指している一点。格子の目に吸い付かせず、その場で解き直す
function hovered(e) {
  if (!view || !target) return null;
  const rect = plot_rect();
  const p = canvas_pos(e);
  if (p.x < rect.x || p.x > rect.x + rect.w || p.y < rect.y || p.y > rect.y + rect.h) return null;

  const d = to_date(rect, p.x, p.y);
  // 再出発: 実際に着いた日より前は物理的にありえないので、解かずに弾く
  if (target.dep_min_date != undefined && d.dep < target.dep_min_date) {
    return { dep: d.dep, arr: d.arr, before_arrival: true, c3: NaN, vdep: NaN, varr: NaN, rev: 0, low: true };
  }
  const s = solve_point(target.dep_num, target.arr_num, d.dep, d.arr);
  return {
    dep: d.dep,
    arr: d.arr,
    c3: s ? s.c3 : NaN,
    vdep: s ? s.vdep : NaN,
    varr: s ? s.varr : NaN,
    rev: s ? s.rev : 0,
    low: s ? s.low : true,
  };
}

function on_move(e) {
  const c = hovered(e);
  hover_cell = c;
  if (!c) {
    hover_el.textContent = HOVER_HINT;
  } else if (c.before_arrival) {
    hover_el.textContent = fmt_date(c.dep) + " : まだ到着していません (到着 " + fmt_date(target.dep_min_date) + ")";
  } else if (!(c.c3 === c.c3)) {
    hover_el.textContent = fmt_date(c.dep) + " → " + fmt_date(c.arr) + " : 解なし";
  } else {
    const tof = Math.round(c.arr - c.dep);
    hover_el.textContent =
      fmt_date(c.dep) +
      " → " +
      fmt_date(c.arr) +
      " (飛行 " +
      tof +
      "日" +
      (c.rev > 0 ? " ・ " + c.rev + "周" : "") +
      ") / C3 " +
      c.c3.toFixed(1) +
      " km²/s² ・ 到着V∞ " +
      c.varr.toFixed(2) +
      " km/s" +
      (on_pick ? " ・ クリックでこの時刻にする" : "");
  }
  draw();
}

// 図の上で選んだ点を、そのレグの出発日・到着日にする。
// 実際に日付を動かすのは使う側 (main.js が setPorkchopHandlers で登録する)。
function on_click(e) {
  if (dragged) return; // 範囲を動かしただけのときは時刻を変えない
  const c = hovered(e);
  if (!c || !on_pick || !(c.c3 === c.c3)) return;
  // 日付だけでなく、その点で採っている周回数と分枝も渡す
  // (同じ日付でも周回数が違えば別の軌道になる)
  on_pick({ index: target.index, dep_date: c.dep, arr_date: c.arr, revs: c.rev, low_path: c.low });
}

/* ------------------------------------------------------------------
   拡大縮小と範囲移動
   ------------------------------------------------------------------
   動かした瞬間は計算済みの図をそのまま伸ばして (あるいはずらして) 見せ、
   手を止めてから計算し直す。ホイールを回すたびに 0.2 秒待たされると
   探しづらいので、見た目だけ先に追従させる。
------------------------------------------------------------------ */

const ZOOM_STEP = 1.18;
const MIN_SPAN = 10; // 片側の最小幅 [日]
const MAX_SPAN = 6000;
const RECOMPUTE_DELAY = 260; // 手を止めたと見なすまでの時間 [ms]

let dragged = false; // 直前の操作が範囲移動だったか (クリックと区別する)
let recompute_timer = 0;

function schedule_recompute() {
  if (recompute_timer) clearTimeout(recompute_timer);
  recompute_timer = setTimeout(() => {
    recompute_timer = 0;
    recompute();
  }, RECOMPUTE_DELAY);
}

// 幅が行き過ぎないように、中心を保ったまま切り詰める
function clamp_view() {
  for (const [a, b] of [["dep0", "dep1"], ["arr0", "arr1"]]) {
    const c = (view[a] + view[b]) / 2;
    const half = clamp((view[b] - view[a]) / 2, MIN_SPAN, MAX_SPAN);
    view[a] = c - half;
    view[b] = c + half;
  }
}

function on_wheel(e) {
  if (!view) return;
  e.preventDefault();
  const rect = plot_rect();
  const p = canvas_pos(e);
  const anchor = to_date(rect, clamp(p.x, rect.x, rect.x + rect.w), clamp(p.y, rect.y, rect.y + rect.h));
  const f = e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;

  // カーソルの下の日付が動かないように、その点を中心に伸縮する
  view.dep0 = anchor.dep + (view.dep0 - anchor.dep) * f;
  view.dep1 = anchor.dep + (view.dep1 - anchor.dep) * f;
  view.arr0 = anchor.arr + (view.arr0 - anchor.arr) * f;
  view.arr1 = anchor.arr + (view.arr1 - anchor.arr) * f;
  clamp_view();

  sync_inputs();
  draw();
  schedule_recompute();
}

// キャンバスの上をドラッグして範囲を動かす
function on_pan_start(e) {
  if (!view || e.button !== 0) return;
  const rect = plot_rect();
  const start = canvas_pos(e);
  if (start.x < rect.x || start.x > rect.x + rect.w || start.y < rect.y || start.y > rect.y + rect.h) return;

  const v0 = { ...view };
  dragged = false;
  canvas.style.cursor = "grabbing";

  const move = (ev) => {
    const p = canvas_pos(ev);
    const dx = p.x - start.x;
    const dy = p.y - start.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
    if (!dragged) return;

    // カーソルが掴んだ日付を離さないように範囲をずらす
    const d_dep = (dx * (v0.dep1 - v0.dep0)) / rect.w;
    const d_arr = (dy * (v0.arr1 - v0.arr0)) / rect.h;
    view.dep0 = v0.dep0 - d_dep;
    view.dep1 = v0.dep1 - d_dep;
    view.arr0 = v0.arr0 + d_arr;
    view.arr1 = v0.arr1 + d_arr;
    hover_cell = null;
    draw();
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    canvas.style.cursor = "";
    if (dragged) schedule_recompute();
    // クリック判定はこの後に来るので、次の操作までは掴んだ扱いのままにする
    setTimeout(() => {
      dragged = false;
    }, 0);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

// 指1本で移動、2本で拡大縮小
let touch_state = null;

function touch_center(t) {
  const r = canvas.getBoundingClientRect();
  const sx = canvas.clientWidth / r.width;
  const sy = canvas.clientHeight / r.height;
  let x = 0;
  let y = 0;
  for (const p of t) {
    x += (p.clientX - r.left) * sx;
    y += (p.clientY - r.top) * sy;
  }
  return { x: x / t.length, y: y / t.length };
}

function touch_spread(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

function on_touch_start(e) {
  if (!view) return;
  const t = Array.from(e.touches);
  touch_state = {
    v0: { ...view },
    center: touch_center(t),
    spread: t.length >= 2 ? touch_spread(t) : 0,
    count: t.length,
  };
  e.preventDefault();
}

function on_touch_move(e) {
  if (!view || !touch_state) return;
  const t = Array.from(e.touches);
  if (t.length !== touch_state.count) {
    on_touch_start(e); // 指の数が変わったら取り直す
    return;
  }
  const rect = plot_rect();
  const c = touch_center(t);
  const v0 = touch_state.v0;

  let f = 1;
  if (t.length >= 2 && touch_state.spread > 1) {
    f = clamp(touch_state.spread / touch_spread(t), 0.1, 10);
  }

  // つまんだ点の日付を動かさずに、指の開き具合で伸縮 + 中心の移動を重ねる
  const anchor = {
    dep: v0.dep0 + ((touch_state.center.x - rect.x) / rect.w) * (v0.dep1 - v0.dep0),
    arr: v0.arr0 + (1 - (touch_state.center.y - rect.y) / rect.h) * (v0.arr1 - v0.arr0),
  };
  const d_dep = ((c.x - touch_state.center.x) * (v0.dep1 - v0.dep0)) / rect.w;
  const d_arr = ((c.y - touch_state.center.y) * (v0.arr1 - v0.arr0)) / rect.h;

  view.dep0 = anchor.dep + (v0.dep0 - anchor.dep) * f - d_dep;
  view.dep1 = anchor.dep + (v0.dep1 - anchor.dep) * f - d_dep;
  view.arr0 = anchor.arr + (v0.arr0 - anchor.arr) * f + d_arr;
  view.arr1 = anchor.arr + (v0.arr1 - anchor.arr) * f + d_arr;
  clamp_view();

  hover_cell = null;
  sync_inputs();
  draw();
  e.preventDefault();
}

function on_touch_end() {
  if (!touch_state) return;
  touch_state = null;
  schedule_recompute();
}

// 幅の入力欄に、いま映している範囲を映す
function sync_inputs() {
  if (!view || !dep_span_input) return;
  dep_span_input.value = String(Math.round((view.dep1 - view.dep0) / 2));
  arr_span_input.value = String(Math.round((view.arr1 - view.arr0) / 2));
}

// 入力された幅を、いまの中心のまわりに反映する
function apply_inputs() {
  if (!view) return;
  const dep_c = (view.dep0 + view.dep1) / 2;
  const arr_c = (view.arr0 + view.arr1) / 2;
  const dep_h = clamp(Number(dep_span_input.value) || 1, MIN_SPAN, MAX_SPAN);
  const arr_h = clamp(Number(arr_span_input.value) || 1, MIN_SPAN, MAX_SPAN);
  view = { dep0: dep_c - dep_h, dep1: dep_c + dep_h, arr0: arr_c - arr_h, arr1: arr_c + arr_h };
  sync_inputs();
}

function show_spinner(show) {
  if (!spinner_el) return;
  if (spinner_timer) {
    clearTimeout(spinner_timer);
    spinner_timer = 0;
  }
  if (!show) {
    spinner_el.style.display = "none";
    return;
  }
  // すぐ終わる計算でちらつかせないよう、少し待ってから出す
  spinner_timer = setTimeout(() => {
    spinner_el.style.display = "flex";
  }, 120);
}

function set_progress(f) {
  const p = spinner_el && spinner_el.querySelector(".pc-progress");
  if (p) p.textContent = Math.round(f * 100) + "%";
}

function update_status(extra) {
  if (!status_el) return;
  if (extra) {
    status_el.textContent = extra;
    return;
  }
  if (!grid) {
    status_el.textContent = "";
    return;
  }
  const m = METRICS[metric];
  status_el.textContent =
    "色: " +
    m.label +
    " [" +
    m.unit +
    "] ・ " +
    (rev_mode === "auto" ? "周回数は各点で最良 (点線が境目)" : rev_mode === 0 ? "直行のみ" : rev_mode + "周のみ") +
    " ・ " +
    grid.cols +
    "×" +
    grid.rows +
    " 点中 " +
    (grid.solved ?? 0) +
    " 点で解あり ・ ◇最小 / 破線が現在 / 灰色は高すぎる領域" +
    (target && target.dep_min_date != undefined ? " / 斜線は到着前でまだ出発できない領域" : "");
}

/* ==================================================================
   外向きの API
   ================================================================== */

async function recompute() {
  if (!target || !win || !view) return;
  if (recompute_timer) {
    clearTimeout(recompute_timer); // 予約されていた分はこの計算で兼ねる
    recompute_timer = 0;
  }
  const n = Number(res_sel.value) || 100;

  // いま映している範囲をそのまま計算する
  const spec = {
    dep_num: target.dep_num,
    arr_num: target.arr_num,
    dep0: view.dep0,
    dep1: view.dep1,
    arr0: view.arr0,
    arr1: view.arr1,
    cols: n,
    rows: n,
    dep_min_date: target.dep_min_date,
    // 周回数を固定しているなら、その分だけ解けばよい
    combos: rev_mode === "auto" ? COMBOS : COMBOS.filter((c) => c.rev === rev_mode),
  };

  const generation = ++job;
  show_spinner(true);
  set_progress(0);
  update_status("計算中…");
  const t0 = performance.now();

  const result = await compute_grid(spec, set_progress, generation);
  if (generation !== job) return; // 途中で条件が変わった / 閉じられた

  show_spinner(false);
  grid = result;
  ensure_color_range(false); // 拡大縮小では段階を変えない (読めなくなったときだけ測り直す)
  draw();
  update_status();
  if (status_el) {
    status_el.textContent += " ・ " + Math.round(performance.now() - t0) + " ms";
  }
}

/**
 * ポークチョップ図を開く (すでに開いていれば対象を差し替える)。
 * @param {object} info {index, dep_num, arr_num, dep_date, arr_date, dep_name, arr_name}
 */
export function openPorkchop(info) {
  const was_open = isPorkchopOpen();
  if (!win) {
    win = build_window();
    document.body.appendChild(win);
  }
  win.style.display = "flex";
  // 閉じてから開き直したときは既定の位置に戻す。
  // 開いたまま対象が変わっただけのときは、動かした位置をそのままにする。
  if (!was_open) place_over_view();

  const same = target && target.index === info.index && target.dep_num === info.dep_num && target.arr_num === info.arr_num;
  target = { ...info };
  title_el.textContent = "ポークチョップ図  " + info.dep_name + " → " + info.arr_name;

  if (!same || !grid || !view) {
    // 対象が変わったら、ホーマン遷移から見積もった窓のまわりを映す
    view = auto_view(info);
    color_range = null; // 天体が変われば値の桁も変わる
    sync_inputs();
    recompute();
  } else {
    draw();
  }
}

export function closePorkchop() {
  job++; // 走っている計算を捨てる
  if (recompute_timer) {
    clearTimeout(recompute_timer);
    recompute_timer = 0;
  }
  show_spinner(false);
  if (win) win.style.display = "none";
}

export function isPorkchopOpen() {
  return !!win && win.style.display !== "none";
}

/** いま図が対象にしているノード番号 (開いていなければ -1) */
export function porkchopIndex() {
  return target ? target.index : -1;
}

/**
 * 開いたまま日付や対象が変わったときに、図の中の「現在の設定」の印を追従させる。
 * 図そのものは計算し直さない (範囲から外れたら印が消えるだけ)。
 * 対象のレグが自動打上げでなくなった場合は null を渡すと閉じる。
 */
export function updatePorkchopTarget(info) {
  if (!isPorkchopOpen()) return;
  if (!info) {
    closePorkchop();
    return;
  }
  if (target && (info.dep_num !== target.dep_num || info.arr_num !== target.arr_num || info.index !== target.index)) {
    openPorkchop(info);
    return;
  }
  target = { ...target, ...info };
  draw();
}

// テスト・デバッグ用 (計算した格子と、いま映している範囲をそのまま見せる)
export function porkchopGrid() {
  return grid;
}

export function porkchopView() {
  return view;
}

export function porkchopColorRange() {
  return color_range;
}

export function porkchopTargetDates() {
  return target ? { dep: target.dep_date, arr: target.arr_date } : null;
}

/**
 * 図の下の行に一言表示する (次にマウスを動かすと消える)。
 * クリックした時刻がそのまま入らなかったときの断りに使う。
 */
export function porkchopNote(text) {
  if (hover_el) hover_el.textContent = text;
}

/** 図の上をクリックしたときに呼ぶコールバックを登録する (時刻セット用) */
export function setPorkchopHandlers(h) {
  on_pick = h && h.onPick;
}
