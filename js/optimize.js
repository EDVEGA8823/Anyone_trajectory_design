/**
 * 「自動調整」の中身。いまの設計を出発点に、最終質量が大きくなる方へ動かす。
 *
 * 目指すのは大域最適ではなく、手で作った設計の近くにある局所最適。
 * 別物の軌道を返してきては「調整」にならないので、
 *   ・出発点は1つ (いまの設計) だけ。多点から始めて良い所を拾いに行かない
 *   ・変数の範囲は初期値のまわりに狭く取る (js/opt_problem.js の既定)
 * としてある。実測でも、まともな設計からなら狭い範囲で改善の9割以上が取れ、
 * 多点から始めても同じ計算時間では単発に勝てなかった。
 *
 * ── 解き方 ──────────────────────────────────────────
 * 2つの方法を交互に回す。
 *
 *   有限差分の勾配   滑らかな所を稼ぐ担当。1反復あたり 2n 回の評価で済み、
 *                    変数が増えても効率が落ちない
 *   Nelder-Mead      折れ点を跨ぐ担当。ΔVの大きさ |v| は v=0 で微分できず、
 *                    そこが局所最適になっている。手動モードに切り替えた
 *                    直後の設計はまさにその点にいる (自動解から初期値を
 *                    取るのでDSMのΔVがちょうど0) ので、勾配だけでは
 *                    1歩も動けない
 *
 * どちらも進めなくなったら終わり。時間切れでも、そこまでで一番良かった
 * 設計を返す。
 */

import { buildProblem, cloneMission } from './opt_problem.js';

// 一度に止めてよい時間 [ms]。この区切りごとに画面へ制御を返す。
// 数秒かかることがあるので、その間ボタンが固まって見えないようにする。
const SLICE_MS = 120;

// 全体の上限。これを超えたら、その時点で一番良い設計を返す
const DEFAULT_BUDGET_MS = 6000;
const DEFAULT_MAX_EVAL = 20000;

// 2つの方法が続けて何回空振りしたら諦めるか
const GIVE_UP = 4;

// 「良くなった」と言う下限。これ未満の差でミッションを書き換えると、
// 見た目は何も変わらないのに「元に戻す」の履歴だけが1つ増えてしまう
const MIN_GAIN = 1e-3;

// 打上げ質量に対してこれだけしか残らない設計は、まだ設計と呼べない。
// 積荷が載らないので、狭い範囲で数%整えても意味が無く、広く探し直す
const USELESS_MASS_RATIO = 0.01;

const clamp01 = (x) => x.map((u) => Math.min(1, Math.max(0, u)));

/**
 * 有限差分の勾配 + 射影 + Barzilai-Borwein の歩幅。
 *
 * 刻み h は正規化した空間での値。すべての変数を [0,1] に揃えてあるので、
 * 1つの h が全変数で通用する (これは正規化しておいた御利益)。
 * 実測では h を 1e-3〜1e-6 で振っても勾配が 1e-6〜1e-3 の相対差でしか
 * 動かない = 平坦域が広いので、差分でも十分な精度が出る。
 */
function grad_step(f, x0, { maxEval, h = 1e-5 }) {
  const n = x0.length;
  let calls = 0;
  const F = (x) => {
    calls++;
    return f(x);
  };
  const grad = (x) => {
    const g = new Array(n);
    for (let k = 0; k < n; k++) {
      // 端では片側に寄せる (箱の外を評価しない)
      const hp = Math.min(h, 1 - x[k]);
      const hm = Math.min(h, x[k]);
      if (hp + hm < 1e-12) {
        g[k] = 0;
        continue;
      }
      const xp = x.slice();
      xp[k] += hp;
      const xm = x.slice();
      xm[k] -= hm;
      g[k] = (F(xp) - F(xm)) / (hp + hm);
    }
    return g;
  };

  let x = x0.slice();
  let fx = F(x);
  let g = grad(x);
  let alpha = 0.01;
  while (calls < maxEval) {
    // 後退直線探索。射影しながら、下がる歩幅が見つかるまで縮める
    let a = alpha;
    let hit = false;
    let xn, fn;
    for (let t = 0; t < 30 && calls < maxEval; t++) {
      xn = clamp01(x.map((u, k) => u - a * g[k]));
      fn = F(xn);
      if (fn < fx - 1e-14) {
        hit = true;
        break;
      }
      a *= 0.4;
    }
    if (!hit) break;

    const gn = grad(xn);
    // BB1 の歩幅。ヘッセ行列を持たずに曲がり具合を歩幅へ反映させる
    const s = xn.map((u, k) => u - x[k]);
    const y = gn.map((v, k) => v - g[k]);
    const sy = s.reduce((p, v, k) => p + v * y[k], 0);
    const ss = s.reduce((p, v) => p + v * v, 0);
    alpha = sy > 1e-18 ? Math.min(1, Math.max(1e-6, ss / sy)) : a * 2;

    x = xn;
    fx = fn;
    g = gn;
    if (ss < 1e-24) break;
  }
  return { x, f: fx, calls };
}

/** Nelder-Mead。箱は評価のときに切り詰める */
function nelder_mead(f, x0, { maxEval, step = 0.06, tol = 1e-12 }) {
  const n = x0.length;
  let calls = 0;
  const F = (x) => {
    calls++;
    return f(clamp01(x));
  };

  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const y = x0.slice();
    // 端に貼り付いている変数は内側へ振る
    y[i] += y[i] + step <= 1 ? step : -step;
    simplex.push(y);
  }
  let fv = simplex.map(F);

  while (calls < maxEval) {
    const order = fv.map((_, i) => i).sort((a, b) => fv[a] - fv[b]);
    simplex = order.map((i) => simplex[i]);
    fv = order.map((i) => fv[i]);
    if (Math.abs(fv[n] - fv[0]) < tol) break;

    const center = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) center[k] += simplex[i][k] / n;
    const reflect = (t) => center.map((c, k) => c + t * (c - simplex[n][k]));

    const xr = reflect(1);
    const fr = F(xr);
    if (fr < fv[0]) {
      const xe = reflect(2);
      const fe = F(xe);
      if (fe < fr) {
        simplex[n] = xe;
        fv[n] = fe;
      } else {
        simplex[n] = xr;
        fv[n] = fr;
      }
    } else if (fr < fv[n - 1]) {
      simplex[n] = xr;
      fv[n] = fr;
    } else {
      const xc = reflect(-0.5);
      const fc = F(xc);
      if (fc < fv[n]) {
        simplex[n] = xc;
        fv[n] = fc;
      } else {
        // 全体を最良点へ引き寄せる
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, k) => simplex[0][k] + 0.5 * (v - simplex[0][k]));
          fv[i] = F(simplex[i]);
        }
      }
    }
  }

  let best = 0;
  for (let i = 1; i <= n; i++) if (fv[i] < fv[best]) best = i;
  return { x: clamp01(simplex[best]), f: fv[best], calls };
}

const nextFrame = () =>
  new Promise((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 0)));

/**
 * ミッションを自動調整する。
 *
 * 渡したミッション自体は触らない。複製の上で試して、結果を serialize した
 * 形で返す。採用するかどうかは呼ぶ側が決める。
 *
 * @param {import('./trajectory.js').Mission} mission いまの設計
 * @param {object} [opts]
 * @param {string} [opts.launcher] 打上げ能力の見積もりに使う機種
 * @param {number} [opts.budget_ms] 使ってよい時間 [ms]
 * @param {(p:{ratio:number, mass:number, gain:number}) => void} [opts.onProgress]
 * @param {() => boolean} [opts.cancelled] true を返すと途中で切り上げる
 * @returns {Promise<{ok:boolean, reason?:string, rescue?:boolean, improved:boolean,
 *   before:number, after:number, gain:number, dv_before?:number, dv_after?:number,
 *   data?:object, calls:number, ms:number}>}
 */
export async function tuneMission(mission, opts = {}) {
  const budget_ms = opts.budget_ms ?? DEFAULT_BUDGET_MS;
  const max_eval = opts.max_eval ?? DEFAULT_MAX_EVAL;
  const fail = (reason) => ({
    ok: false, reason, rescue: false, improved: false,
    before: 0, after: 0, gain: 0, dv_before: 0, dv_after: 0, calls: 0, ms: 0,
  });

  if (mission == undefined || mission.count < 2) return fail('シーケンスが2つ以上ないと調整できません');

  // 折れ線は描くためだけのもの。切っておくと1回の評価が数倍速くなる
  const work = cloneMission(mission, { arcs: false });
  if (work == undefined) return fail('ミッションを複製できませんでした');

  const base_opts = opts.launcher ? { launcher: opts.launcher } : {};
  const first = buildProblem(work, base_opts);
  if (first.n === 0) return fail('動かせるところがありません');

  const t0 = performance.now();
  let calls = 0;

  /**
   * 1つの問題を、時間と回数が尽きるまで解く。
   * 解き終えた設計は、そのままミッション (work) に焼き付けて返す。
   */
  const solve = async (problem, show_gain) => {
    const objective = (x) => {
      calls++;
      return problem.objective(x);
    };
    let x = problem.x0.slice();
    // 1回の評価の重さを測る。ノードが増えると重くなるので、区切りの大きさを
    // 回数ではなく時間で決められるようにしておく
    const probe = performance.now();
    let f = objective(x);
    objective(x);
    const per_ms = Math.max((performance.now() - probe) / 2, 0.02);
    const slice = Math.max(40, Math.round(SLICE_MS / per_ms));

    let phase = 'grad';
    // 2つの方法が続けて空振りしたら終わり。1往復で見切ると早すぎる
    // (Nelder-Mead は歩幅を細かくし直すと、そこからまた下がることがある)ので、
    // 2往復ぶん粘ってから諦める
    let stalled = 0;
    let nm_step = 0.06;

    while (stalled < GIVE_UP && calls < max_eval) {
      if (performance.now() - t0 > budget_ms) break;
      if (opts.cancelled && opts.cancelled()) break;

      const budget = Math.min(slice, max_eval - calls);
      const r =
        phase === 'grad'
          ? grad_step(objective, x, { maxEval: budget })
          : nelder_mead(objective, x, { maxEval: budget, step: nm_step });

      if (r.f < f - 1e-12) {
        x = r.x.slice();
        f = r.f;
        stalled = 0;
      } else {
        stalled++;
        // Nelder-Mead が空振りしたら、次はもっと細かく探る
        if (phase === 'nm') nm_step = Math.max(0.004, nm_step * 0.5);
      }
      phase = phase === 'grad' ? 'nm' : 'grad';

      if (opts.onProgress) {
        opts.onProgress({
          ratio: Math.min(1, (performance.now() - t0) / budget_ms),
          // 元が成り立っていないときの「何%」は基準が無くて意味を成さないので出さない
          gain: show_gain ? Math.exp(-f) - 1 : undefined,
        });
      }
      await nextFrame();
    }
    return problem.evaluate(x); // 最良点をミッションへ焼き付けて成績を返す
  };

  // いまの設計がそもそも成り立っていない (打ち上げられない / 軌道が繋がらない)、
  // または成り立ってはいても質量がまるで残らない (積荷を運べない) ときは、
  // 狭い範囲で整えても仕方がない。守るべき「元の設計」がまだ無いので、
  // 範囲を広げて使いものになるところまで連れて行く。
  const useless =
    first.base.ok && first.base.final_mass < first.base.launch_mass * USELESS_MASS_RATIO;
  const rescue = !first.base.ok || useless;
  let last_reason = first.base.reason;
  if (rescue) {
    const wide = buildProblem(work, { ...base_opts, launch_window_days: 365, tof_scale: 4 });
    const r = await solve(wide, false);
    last_reason = r.ok ? undefined : r.reason;
  }

  // 成り立つところまで来たら、そこを出発点に本来の (狭い範囲の) 調整を続ける。
  // 助けたところで止めると、良くなる余地を残したまま返すことになる
  const problem = buildProblem(work, base_opts);
  const best = problem.base.ok ? await solve(problem, true) : problem.base;

  const before = first.base.ok ? first.base.final_mass : 0;
  const after = best.ok ? best.final_mass : 0;
  // 元が成り立っていなかったなら、成り立つ設計が見つかった時点で前進。
  // そうでなければ、目に見える差 (0.1%) が出たときだけ「良くなった」と言う
  const improved = best.ok && (rescue || after > before * (1 + MIN_GAIN));

  return {
    ok: true,
    rescue,
    improved,
    before,
    after,
    gain: before > 0 ? after / before - 1 : 0,
    reason: improved ? undefined : last_reason,
    dv_before: first.base.dv,
    dv_after: best.dv,
    data: improved ? work.serialize() : undefined,
    calls,
    ms: performance.now() - t0,
  };
}
