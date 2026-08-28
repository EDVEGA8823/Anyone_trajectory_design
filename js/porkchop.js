import { MU_SUN, get_planet_elements, get_planets_pos, JulianToDate } from './trajectory.js';

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
    label: "合計 (V∞出発+到着)",
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

let win = null; // ウィンドウのルート要素
let canvas = null;
let hover_el = null;
let spinner_el = null;
let status_el = null;
let title_el = null;
let metric_sel = null;
let dep_span_input = null;
let arr_span_input = null;
let res_sel = null;

let target = null; // {index, dep_num, arr_num, dep_date, arr_date}
let grid = null; // compute_grid の結果
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

// 天体の公転周期 [日]
function orbital_period_days(num, date) {
  const a = get_planet_elements(date, num)[0];
  return (2 * Math.PI * Math.sqrt((a * a * a) / MU_SUN)) / DAY;
}

// 出発日・到着日をどれだけの幅で振るかの初期値 [日]。
// 出発側は会合周期 (打上げ窓が巡ってくる周期) の半分、到着側はいまの飛行時間を目安にする。
export function default_spans(dep_num, arr_num, dep_date, arr_date) {
  const t_dep = orbital_period_days(dep_num, dep_date);
  const t_arr = orbital_period_days(arr_num, dep_date);
  const inv = Math.abs(1 / t_dep - 1 / t_arr);
  const synodic = inv > 1e-9 ? 1 / inv : Math.max(t_dep, t_arr);
  const tof = Math.max(arr_date - dep_date, MIN_TOF_DAYS);
  return {
    dep: Math.round(Math.min(Math.max(synodic * 0.5, 60), 900)),
    arr: Math.round(Math.min(Math.max(tof * 0.6, 60), 1200)),
  };
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
  const c3 = new Float32Array(n);
  const vdep = new Float32Array(n);
  const varr = new Float32Array(n);
  c3.fill(NaN);
  vdep.fill(NaN);
  varr.fill(NaN);

  const r1 = [0, 0, 0];
  const r2 = [0, 0, 0];
  let mark = performance.now();

  for (let k = 0; k < rows; k++) {
    r2[0] = arr_r[k * 3];
    r2[1] = arr_r[k * 3 + 1];
    r2[2] = arr_r[k * 3 + 2];

    for (let j = 0; j < cols; j++) {
      const tof = (arr_t[k] - dep_t[j]) * DAY;
      if (tof < MIN_TOF_DAYS * DAY) continue; // 到着が出発より前 / 短すぎる区間

      r1[0] = dep_r[j * 3];
      r1[1] = dep_r[j * 3 + 1];
      r1[2] = dep_r[j * 3 + 2];

      let v;
      try {
        v = lambert_probrem(MU_SUN, r1, r2, tof);
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

      const idx = k * cols + j;
      c3[idx] = a2; // C3 = |V∞|^2 がそのまま打上げエネルギー
      vdep[idx] = Math.sqrt(a2);
      varr[idx] = Math.sqrt(b2);
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

  return { ...spec, dep_t, arr_t, c3, vdep, varr };
}

// 格子の (j,k) の指標値。無効なセルは NaN
function cell_value(g, idx) {
  const c3 = g.c3[idx];
  if (!(c3 === c3)) return NaN;
  if (metric === "c3") return c3;
  if (metric === "arrive") return g.varr[idx];
  return g.vdep[idx] + g.varr[idx];
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
// せいで肝心の谷が潰れて一面赤になってしまう。安い方の1/4だけに色を使い、
// それより高いところは灰色にして図から退かせる (ポークチョップ図の通例)。
const COLOR_QUANTILE = 0.25;

function value_range(g) {
  const vals = [];
  for (let i = 0; i < g.c3.length; i++) {
    const v = cell_value(g, i);
    if (v === v) vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort((a, b) => a - b);
  const lo = vals[0];
  let hi = vals[Math.min(vals.length - 1, Math.floor(vals.length * COLOR_QUANTILE))];
  if (!(hi > lo)) hi = lo + Math.max(1, Math.abs(lo) * 0.2);
  let over = 0;
  for (const v of vals) if (v > hi) over++;
  return { lo, hi, count: vals.length, over };
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

// 日付 → 画面座標
function to_px(g, rect, dep, arr) {
  const fx = (dep - g.dep0) / (g.dep1 - g.dep0);
  const fy = (arr - g.arr0) / (g.arr1 - g.arr0);
  return { x: rect.x + fx * rect.w, y: rect.y + (1 - fy) * rect.h };
}

// 画面座標 → 日付
function to_date(g, rect, px, py) {
  const fx = (px - rect.x) / rect.w;
  const fy = 1 - (py - rect.y) / rect.h;
  return { dep: g.dep0 + fx * (g.dep1 - g.dep0), arr: g.arr0 + fy * (g.arr1 - g.arr0) };
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

  if (!grid) {
    ctx.strokeStyle = "#e3e4e8";
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w, rect.h);
    return;
  }

  const range = value_range(grid);
  if (range) {
    draw_field(ctx, rect, range);
    draw_contours(ctx, rect, range);
    draw_colorbar(ctx, rect, range);
  }
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
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

// 等高線 (マーチングスクエア)。ポークチョップ図の「谷」の形はこの線で読む
function draw_contours(ctx, rect, range) {
  const g = grid;
  const { levels } = nice_levels(range.lo, range.hi, 8);
  const sx = rect.w / (g.cols - 1);
  const sy = rect.h / (g.rows - 1);
  const px = (j, k) => ({ x: rect.x + j * sx, y: rect.y + rect.h - k * sy });

  ctx.save();
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

// 飛行時間が一定の斜め線。ポークチョップ図では出発日と到着日が軸なので、
// 「何日で行くか」はこの斜めの向きに読む
function draw_tof_lines(ctx, rect) {
  const g = grid;
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
    const a = to_px(g, rect, d_lo, d_lo + T);
    const b = to_px(g, rect, d_hi, d_hi + T);
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
  const g = grid;
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
  if (range) {
    let best = -1;
    let bv = Infinity;
    for (let i = 0; i < g.c3.length; i++) {
      const v = cell_value(g, i);
      if (v === v && v < bv) {
        bv = v;
        best = i;
      }
    }
    if (best >= 0) {
      const j = best % g.cols;
      const k = Math.floor(best / g.cols);
      const p = to_px(g, rect, g.dep_t[j], g.arr_t[k]);
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

  // いまの設定
  if (target && target.dep_date != undefined && target.arr_date != undefined) {
    const p = to_px(g, rect, target.dep_date, target.arr_date);
    if (p.x >= rect.x - 1 && p.x <= rect.x + rect.w + 1 && p.y >= rect.y - 1 && p.y <= rect.y + rect.h + 1) {
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
    const p = to_px(g, rect, hover_cell.dep, hover_cell.arr);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(23,24,26,0.7)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
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
  metric_sel.title = "色で塗る量";
  metric_sel.onchange = () => {
    metric = metric_sel.value;
    draw();
    update_status();
  };
  bar.appendChild(metric_sel);

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
    bar.appendChild(wrap);
    return input;
  };
  dep_span_input = mk_span("出発 ±", "いまの出発日を中心に、前後この日数だけ振る");
  arr_span_input = mk_span("到着 ±", "いまの到着日を中心に、前後この日数だけ振る");

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
  bar.appendChild(res_sel);

  const run = el("button", "pc-run", "再計算");
  run.type = "button";
  run.onclick = () => recompute();
  bar.appendChild(run);

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

  hover_el = el("div", "pc-hover", "図の上にマウスを置くと値が出ます");
  root.appendChild(hover_el);
  status_el = el("div", "pc-status", "");
  root.appendChild(status_el);

  canvas.addEventListener("mousemove", on_move);
  canvas.addEventListener("mouseleave", () => {
    hover_cell = null;
    hover_el.textContent = "図の上にマウスを置くと値が出ます";
    draw();
  });
  canvas.addEventListener("click", on_click);

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
  const view = document.querySelector("#launch_box .view-3d") || document.getElementById("launch_canvas");
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

function hovered(e) {
  if (!grid) return null;
  const r = canvas.getBoundingClientRect();
  const rect = plot_rect();
  const px = ((e.clientX - r.left) / r.width) * canvas.clientWidth;
  const py = ((e.clientY - r.top) / r.height) * canvas.clientHeight;
  if (px < rect.x || px > rect.x + rect.w || py < rect.y || py > rect.y + rect.h) return null;

  const d = to_date(grid, rect, px, py);
  // 一番近い格子点に吸い付かせる (値はその点のもの)
  const j = Math.round(((d.dep - grid.dep0) / (grid.dep1 - grid.dep0)) * (grid.cols - 1));
  const k = Math.round(((d.arr - grid.arr0) / (grid.arr1 - grid.arr0)) * (grid.rows - 1));
  const jj = Math.min(grid.cols - 1, Math.max(0, j));
  const kk = Math.min(grid.rows - 1, Math.max(0, k));
  const idx = kk * grid.cols + jj;
  return {
    dep: grid.dep_t[jj],
    arr: grid.arr_t[kk],
    idx,
    c3: grid.c3[idx],
    vdep: grid.vdep[idx],
    varr: grid.varr[idx],
  };
}

function on_move(e) {
  const c = hovered(e);
  hover_cell = c;
  if (!c) {
    hover_el.textContent = "図の上にマウスを置くと値が出ます";
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
      "日) / C3 " +
      c.c3.toFixed(1) +
      " km²/s² ・ 到着V∞ " +
      c.varr.toFixed(2) +
      " km/s";
  }
  draw();
}

// 図の上で選んだ点を時刻に反映するためのフック。
// 使う側 (main.js) が setPorkchopHandlers で登録する。
function on_click(e) {
  const c = hovered(e);
  if (!c || !on_pick || !(c.c3 === c.c3)) return;
  on_pick({ index: target.index, dep_date: c.dep, arr_date: c.arr });
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
  const range = value_range(grid);
  status_el.textContent =
    "色: " +
    m.label +
    " [" +
    m.unit +
    "] ・ " +
    grid.cols +
    "×" +
    grid.rows +
    " 点中 " +
    (range ? range.count : 0) +
    " 点で解あり ・ ◇最小 / 破線が現在 / 灰色は高すぎる領域";
}

/* ==================================================================
   外向きの API
   ================================================================== */

async function recompute() {
  if (!target || !win) return;
  const dep_span = Math.max(10, Number(dep_span_input.value) || 200);
  const arr_span = Math.max(10, Number(arr_span_input.value) || 200);
  const n = Number(res_sel.value) || 100;

  const spec = {
    dep_num: target.dep_num,
    arr_num: target.arr_num,
    dep0: target.dep_date - dep_span,
    dep1: target.dep_date + dep_span,
    arr0: target.arr_date - arr_span,
    arr1: target.arr_date + arr_span,
    cols: n,
    rows: n,
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

  if (!same || !grid) {
    const s = default_spans(info.dep_num, info.arr_num, info.dep_date, info.arr_date);
    dep_span_input.value = String(s.dep);
    arr_span_input.value = String(s.arr);
    recompute();
  } else {
    draw();
  }
}

export function closePorkchop() {
  job++; // 走っている計算を捨てる
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

// テスト・デバッグ用 (計算した格子をそのまま見せる)
export function porkchopGrid() {
  return grid;
}

/** 図の上をクリックしたときに呼ぶコールバックを登録する (時刻セット用) */
export function setPorkchopHandlers(h) {
  on_pick = h && h.onPick;
}
