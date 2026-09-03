/**
 * 最適化問題の定式化。
 *
 * ここが持つのは「何を最大化したいのか」「動かせるのはどれか」「どこまで
 * 動かしてよいのか」の3つだけで、探索そのもの (ソルバ) は持たない。
 * 分けてあるのは、解き方を差し替えても問題の定義が動かないようにするため。
 *
 * ── 目的 ──────────────────────────────────────────────
 * 最終質量 (総ΔVを出し切った後に残る質量) の最大化。
 *
 *   最終質量 = 打上げ能力(V∞, 赤緯) × exp(-総ΔV / (Isp g0))
 *
 * 打上げ能力は V∞ が大きいほど落ちるので、「速く出る」ことと「燃料を使わない」
 * ことは正面からぶつかる。この綱引きをそのまま1つの数にしたのが最終質量で、
 * 総ΔVだけを見るのでは足りない理由でもある (打上げのV∞は総ΔVに入らない)。
 *
 * ソルバには対数をとった形を渡す。
 *
 *   f(x) = ln(最終質量の初期値) - ln(最終質量) = ΔVの増分/(Isp g0) - ln(能力比)
 *
 * 単調変換なので最適解は同じだが、
 *   ・kg のまま扱うと数千のオーダーで、変数側の 0〜1 と桁が合わない
 *   ・ΔVの項が線形になり、収束の様子が読みやすい
 *   ・初期設計で f = 0 になるので、負ならそのぶん良くなったと直に読める
 * という利点がある。
 *
 * ── 変数 ──────────────────────────────────────────────
 * すべて [0, 1] の箱に写す。ソルバ側は範囲を気にせず、同じ大きさの一歩が
 * どの変数でも同じくらいの意味を持つ状態で受け取れる。
 * 半径のように桁で効く量は対数で写す (近点半径を 6600km と 660000km で
 * 線形に並べると、内側の面白い領域が最初の1%に潰れてしまう)。
 *
 * 時刻は「打上げ日 + 各レグの飛行時間」で持つ。日付そのものを変数にすると
 * 「後のノードは前より後」という不等式制約が要るが、飛行時間なら下限
 * (最小間隔) を箱に押し込むだけで順序が自動的に守られる。
 *
 * 自動モードのノードは、前後のランベール弧で速度が決まってしまうので
 * 変数を持たない。手動モードにすると V∞ や rp/beta が自分の変数になり、
 * 代わりに後ろに付くDSMが「目的地へ届かせる」役を引き受ける (MGA-1DSM)。
 * そのDSM自身のΔVもランベールで決まる量なので変数ではない。動かせるのは
 * 「いつ打つか」= レグの飛行時間の方で、手で足した手動マヌーバのときだけ
 * 大きさと向きが変数になる。
 *
 * ΔVを (大きさ, 方位角, 仰角) で持つ節 (打上げ・DSM・軌道脱出/再出発) は、
 * 大きさが0のところで向きの勾配がちょうど0になる。噴かないなら向きに意味が
 * 無いので当然だが、初期値が0の手動DSMはそこから動き出せない。ソルバ側で
 * わずかな大きさを与えてから始めるか、多点から出発すること。
 *
 * 入れていないもの:
 *   周回数・分枝 (low/high)  … 連続でないので、探索の外で選ぶもの
 *   突入経路角                … 突入は無推力でΔVを生まないため、最終質量に
 *                               まったく効かない。入れても平らな次元が増えるだけ
 *   天体の並び・種別          … ミッションの骨格そのもので、設計変数ではない
 */

import { Sequence_Type } from './state.js';
import {
  Mission,
  MIN_NODE_GAP,
  planet_mu,
  min_flyby_rp,
  hill_radius,
  final_mass,
} from './trajectory.js';
import { launcher_mass, launch_declination, launcher_list } from './launchers.js';

const TWO_PI = 2 * Math.PI;

/**
 * 範囲の既定値。呼び出し側が options で上書きできる。
 *
 * 「いまの設計のまわりを探す」道具なので、範囲は初期値からの相対で決める。
 * 広く取れば良い解に届く見込みは増えるが、局所解だらけの空間で遠くまで
 * 見せると、いまの設計と似ても似つかない答えが返って戸惑うことになる。
 */
export const DEFAULT_OPTIONS = {
  launch_window_days: 180, // 打上げ日を前後どこまで動かすか [日]
  tof_scale: 2.0, // 各レグの飛行時間を初期値の 1/scale 〜 scale 倍で動かす
  tof_min_days: MIN_NODE_GAP, // 飛行時間の下限 [日]
  tof_max_days: 40000, // 飛行時間の上限 [日] (約110年)
  vinf_max: undefined, // 打上げV∞の上限 [km/s] (既定は機種の能力から)
  vinf_max_fallback: 12, // 機種から取れないときの上限 [km/s]
  depart_v_scale: 3.0, // 天体を離れるΔVの上限を初期値の何倍まで見るか
  depart_v_min_max: 3.0, // その上限の下駄 [km/s] (初期値が0でも動かせるように)
  dsm_dv_scale: 3.0, // DSMのΔVの上限を初期値の何倍まで見るか
  dsm_dv_min_max: 2.0, // その上限の下駄 [km/s]
  flyby_rp_hill: 0.25, // スイングバイ近点半径の上限をヒル半径の何倍にするか
  flyby_rp_factor: 200, // ヒル半径が取れないときの上限 (最小近点半径の何倍か)
  orbit_ra_ratio_max: 1e4, // 周回軌道の 遠点/近点 比の上限
  launcher: 'h3_24', // 打上げ能力の見積もりに使う機種
  keep_revs: true, // 指定した周回数で解けなくなった点を罰する
  penalty: 1e3, // 成り立たない点に与える罰の大きさ
};

// ── 変数の写像 ────────────────────────────────────────

/**
 * 1つの設計変数。lo/hi は物理単位での範囲で、正規化はここが受け持つ。
 *
 * scale:
 *   "linear"  そのまま比例で [0,1] へ
 *   "log"     対数で写す (桁で効く量。lo > 0 であること)
 *   "angle"   比例だが端が繋がっている (ソルバ側は丸めずに折り返してよい)
 */
class Variable {
  constructor({ key, label, node, scale, lo, hi, get, set }) {
    this.key = key;
    this.label = label;
    this.node = node;
    this.scale = scale;
    this.lo = lo;
    this.hi = hi;
    this.get = get;
    this.set = set;
    this.periodic = scale === 'angle';
  }

  /** 物理量 → [0,1] */
  norm(p) {
    if (this.scale === 'log') {
      const a = Math.log(this.lo);
      const b = Math.log(this.hi);
      return b === a ? 0 : (Math.log(Math.max(p, this.lo)) - a) / (b - a);
    }
    if (this.hi === this.lo) return 0;
    const u = (p - this.lo) / (this.hi - this.lo);
    // 角度はモデル側が atan2 の値をそのまま持っていることがあり、-π..π のように
    // 範囲の外に出ている。同じ向きなので、箱の中へ巻き戻す
    if (this.periodic) return u - Math.floor(u);
    return Math.min(1, Math.max(0, u));
  }

  /** [0,1] → 物理量 */
  phys(u) {
    const t = this.periodic ? u - Math.floor(u) : Math.min(1, Math.max(0, u));
    if (this.scale === 'log') {
      const a = Math.log(this.lo);
      return Math.exp(a + t * (Math.log(this.hi) - a));
    }
    return this.lo + t * (this.hi - this.lo);
  }
}

// ── ミッションの複製 ──────────────────────────────────

/**
 * ミッションの複製。最適化は画面に出ているものを直接いじらずに、
 * 複製の上で試して、採用するときだけ書き戻す。
 *
 * arcs: false にすると軌道の折れ線を作らなくなる。描画のためだけのもので
 * ΔVにも質量にも効かないが、1レグ100点を毎回組み直すので、評価を何千回も
 * 回す場面では計算時間の大半がここに消える。探索用の複製では切っておく。
 *
 * @returns {Mission|undefined}
 */
export function cloneMission(mission, { arcs = true } = {}) {
  const copy = new Mission();
  if (!copy.restore(mission.serialize())) return undefined;
  copy.set_arcs_enabled(arcs);
  return copy;
}

// ── 変数の洗い出し ────────────────────────────────────

/** その天体でのスイングバイ近点半径の上限 [km] */
function flyby_rp_max(mission, i, opt) {
  const n = mission.planet_num(i);
  const rp_min = min_flyby_rp(n);
  if (rp_min == undefined) return undefined;
  const mu = planet_mu[n];
  const r_pla = mission.planet_pos(i);
  const hill =
    mu != undefined && r_pla != undefined
      ? hill_radius(mu, Math.hypot(r_pla[0], r_pla[1], r_pla[2]))
      : undefined;
  const by_hill = hill != undefined ? hill * opt.flyby_rp_hill : undefined;
  const by_factor = rp_min * opt.flyby_rp_factor;
  // ヒル半径が取れるならそちらを優先しつつ、下限を割らないようにする
  return Math.max(rp_min * 1.01, by_hill ?? by_factor);
}

/** 打上げV∞の上限 [km/s]。機種の能力の上端まで */
function launch_vinf_max(opt) {
  if (opt.vinf_max > 0) return opt.vinf_max;
  const L = launcher_list().find((l) => l.id === opt.launcher);
  return L && L.vinf_max > 0 ? L.vinf_max : opt.vinf_max_fallback;
}

/**
 * ミッションから設計変数を洗い出す。
 * 並びは「時刻 → ノードごとの量」で、ノードは番号順。
 */
function collect_vars(mission, opt) {
  const vars = [];
  const n = mission.count;
  if (n === 0) return vars;

  /**
   * 変数を1つ登録する。
   *
   * いまの値が範囲からはみ出していたら、範囲の方を広げて中に入れる。
   * 「いまの設計から出発して、そのまわりを探す」道具なので、出発点が箱の外に
   * あるのは筋が通らない (最初の一歩でいきなり別の設計に飛ぶことになる)。
   * 角度は巻き戻せば必ず中に入るので、そのままでよい。
   */
  const add = (v) => {
    const now = v.get();
    if (v.scale !== 'angle' && typeof now === 'number' && isFinite(now)) {
      const pad = Math.max(Math.abs(now) * 0.05, (v.hi - v.lo) * 0.05);
      if (now < v.lo) v.lo = v.scale === 'log' ? Math.max(now * 0.9, 1e-12) : now - pad;
      if (now > v.hi) v.hi = v.scale === 'log' ? now * 1.1 : now + pad;
    }
    vars.push(new Variable(v));
  };

  // --- 打上げ日 ---
  const t0 = mission.date(0);
  add({
    key: 'date0',
    label: '打上げ日',
    node: 0,
    scale: 'linear',
    lo: t0 - opt.launch_window_days,
    hi: t0 + opt.launch_window_days,
    get: () => mission.date(0),
    set: undefined, // 時刻は連鎖して入れるので apply 側でまとめて扱う
  });

  // --- 各レグの飛行時間 ---
  // 節目に固定されたノードは、モデルが日付を軌道側から決めてしまうので
  // 変数にしない (入れても書いた値が上書きされるだけになる)
  for (let i = 1; i < n; i++) {
    if (mission.pinned_event(i) != undefined) continue;
    const tof = mission.date(i) - mission.date(i - 1);
    if (!(tof > 0)) continue;
    add({
      key: 'tof' + i,
      label: i + '区間の飛行時間',
      node: i,
      scale: 'linear',
      lo: Math.max(opt.tof_min_days, tof / opt.tof_scale),
      hi: Math.min(opt.tof_max_days, tof * opt.tof_scale),
      get: () => mission.date(i) - mission.date(i - 1),
      set: undefined,
    });
  }

  // --- ノードごとの量 ---
  for (let i = 0; i < n; i++) {
    const type = mission.type(i);
    const manual = mission.is_auto_mode(i) === false;

    // 手動の打上げ: V∞ の大きさと向き
    if (i === 0 && type === Sequence_Type.Launch && manual) {
      add({
        key: 'launch_vinf', label: '打上げV∞', node: 0, scale: 'linear',
        lo: 0, hi: launch_vinf_max(opt),
        get: () => mission.launch_vinf(), set: (v) => mission.set_launch_vinf(v),
      });
      add({
        key: 'launch_alpha', label: '打上げ方位角', node: 0, scale: 'angle',
        lo: 0, hi: TWO_PI,
        get: () => mission.launch_alpha(), set: (v) => mission.set_launch_alpha(v),
      });
      add({
        key: 'launch_delta', label: '打上げ仰角', node: 0, scale: 'linear',
        lo: -Math.PI / 2, hi: Math.PI / 2,
        get: () => mission.launch_delta(), set: (v) => mission.set_launch_delta(v),
      });
    }

    // 手動のスイングバイ: 近点半径と回転角。自動モードでは前後のランベール弧
    // から逆算される「結果」なので変数にならない
    if (type === Sequence_Type.Swingby && manual) {
      const rp_min = min_flyby_rp(mission.planet_num(i));
      const rp_max = flyby_rp_max(mission, i, opt);
      if (rp_min > 0 && rp_max > rp_min) {
        add({
          key: 'rp' + i, label: i + '. 近点半径', node: i, scale: 'log',
          lo: rp_min, hi: rp_max,
          get: () => mission.rp(i), set: (v) => mission.set_rp(i, v),
        });
      }
      add({
        key: 'beta' + i, label: i + '. 通過面の回転角', node: i, scale: 'angle',
        lo: 0, hi: TWO_PI,
        get: () => mission.beta(i), set: (v) => mission.set_beta(i, v),
      });
    }

    // 手動のDSM (深宇宙マヌーバ): 大きさと向き。打つ位置はレグの飛行時間が持つ。
    // 自動のDSMは「目的地へ届かせる」ためにランベールで解かれる量なので、
    // ここで動かすものではない (動かしても次の再計算で上書きされる)
    if (type === Sequence_Type.Maneuver && manual) {
      const dv = mission.dsm_dv(i);
      add({
        key: 'dsm_dv' + i, label: i + '. DSMのΔV', node: i, scale: 'linear',
        lo: 0, hi: Math.max(opt.dsm_dv_min_max, dv * opt.dsm_dv_scale),
        get: () => mission.dsm_dv(i), set: (v) => mission.set_dsm_dv(i, v),
      });
      add({
        key: 'dsm_alpha' + i, label: i + '. DSMの方位角', node: i, scale: 'angle',
        lo: 0, hi: TWO_PI,
        get: () => mission.dsm_alpha(i), set: (v) => mission.set_dsm_alpha(i, v),
      });
      add({
        key: 'dsm_delta' + i, label: i + '. DSMの仰角', node: i, scale: 'linear',
        lo: -Math.PI / 2, hi: Math.PI / 2,
        get: () => mission.dsm_delta(i), set: (v) => mission.set_dsm_delta(i, v),
      });
    }

    // 周回軌道投入: どんな軌道に入るかで捕獲ΔVが決まる。
    // 遠点は近点との比で持つ (近点を動かしたときに「遠点が近点より内側」へ
    // はみ出さないので、箱の中がまるごと成り立つ設計になる)
    if (type === Sequence_Type.Orbit) {
      const lim = mission.orbit_limits(i);
      const rp = mission.orbit_rp(i);
      const ra = mission.orbit_ra(i);
      if (lim != undefined && rp > 0 && ra >= rp) {
        const rp_max = lim.ra_max ?? rp * 100;
        if (rp_max > lim.rp_min) {
          add({
            key: 'orbit_rp' + i, label: i + '. 周回軌道の近点', node: i, scale: 'log',
            lo: lim.rp_min, hi: rp_max,
            get: () => mission.orbit_rp(i), set: (v) => mission.set_orbit_rp(i, v),
          });
        }
        add({
          key: 'orbit_ratio' + i, label: i + '. 周回軌道の遠点/近点', node: i, scale: 'log',
          lo: 1, hi: opt.orbit_ra_ratio_max,
          get: () => Math.max(1, mission.orbit_ra(i) / mission.orbit_rp(i)),
          set: (v) => mission.set_orbit_ra(i, mission.orbit_rp(i) * v),
        });
      }
    }

    // 手動の軌道脱出 / 再出発: 天体を離れるときの相対速度と向き
    if ((type === Sequence_Type.Escape || type === Sequence_Type.Departure) && manual) {
      const v = mission.depart_v(i);
      add({
        key: 'depart_v' + i, label: i + '. 出発ΔV', node: i, scale: 'linear',
        lo: 0, hi: Math.max(opt.depart_v_min_max, v * opt.depart_v_scale),
        get: () => mission.depart_v(i), set: (x) => mission.set_depart_v(i, x),
      });
      add({
        key: 'depart_alpha' + i, label: i + '. 出発の方位角', node: i, scale: 'angle',
        lo: 0, hi: TWO_PI,
        get: () => mission.depart_alpha(i), set: (x) => mission.set_depart_alpha(i, x),
      });
      add({
        key: 'depart_delta' + i, label: i + '. 出発の仰角', node: i, scale: 'linear',
        lo: -Math.PI / 2, hi: Math.PI / 2,
        get: () => mission.depart_delta(i), set: (x) => mission.set_depart_delta(i, x),
      });
    }
  }

  return vars;
}

// ── 評価 ──────────────────────────────────────────────

/**
 * いまのミッションの成績。設計変数を書き込んだ後に呼ぶ。
 *
 * @returns {{ok:boolean, reason:string|undefined, dv:number, vinf:number,
 *            decl:number, launch_mass:number, final_mass:number,
 *            fallback:boolean}}
 */
export function scoreMission(mission, opt = DEFAULT_OPTIONS) {
  const out = {
    ok: false, reason: undefined, dv: NaN, vinf: NaN, decl: 0,
    launch_mass: 0, final_mass: 0, fallback: false, status: 'unknown',
  };
  if (mission.count < 2) {
    out.reason = 'ノードが2つ未満';
    return out;
  }

  const dv = mission.get_total_dv();
  if (!isFinite(dv) || dv < 0) {
    out.reason = '総ΔVが求まらない';
    return out;
  }
  out.dv = dv;

  // 打上げのV∞。自動モードならランベール解から、手動なら指定値から出る
  const v_vec = mission.get_launch_v_inf_vec();
  const vinf = mission.get_v_inf();
  if (v_vec == undefined || !isFinite(vinf)) {
    out.reason = '打上げのV∞が求まらない';
    return out;
  }
  out.vinf = vinf;
  out.decl = launch_declination(v_vec);

  // 軌道が繋がっているか。繋がっていないレグは位置が undefined になる
  for (let i = 0; i < mission.count; i++) {
    if (mission.get_s_c_pos(i) == undefined) {
      out.reason = i + '番のノードで軌道が繋がっていない';
      return out;
    }
  }

  // 指定した周回数で解けているか。落ちた点は「別の軌道」なので、
  // そこへ流れ込むと最適化が勝手に設計を乗り換えたことになる
  for (let i = 0; i < mission.count; i++) {
    const leg = mission.get_leg_info(i);
    if (leg && leg.fallback) out.fallback = true;
  }

  const { mass, status } = launcher_mass(opt.launcher, vinf, out.decl);
  out.status = status;
  if (!(mass > 0)) {
    out.reason = 'この脱出速度はロケットの能力を超えている';
    return out;
  }
  out.launch_mass = mass;

  const fm = final_mass(mass, dv);
  if (!(fm > 0)) {
    out.reason = '最終質量が求まらない';
    return out;
  }
  out.final_mass = fm;
  out.ok = true;
  return out;
}

// ── 問題 ──────────────────────────────────────────────

/**
 * ミッションから最適化問題を組み立てる。
 *
 * 渡したミッションはそのまま評価に使われる (評価のたびに書き換わる)。
 * 画面のミッションを壊したくなければ cloneMission() を通してから渡すこと。
 *
 * 変数の顔ぶれはミッションの骨格 (ノードの並び・種別・自動/手動) から決まる
 * ので、組み立てた時点で固定される。骨格を変えたら組み立て直すこと。
 * 打上げ能力は機種で変わるので、画面で選んでいる機種を options.launcher に
 * 渡す (ここから State を見に行くと、物理の計算が画面に依存してしまう)。
 *
 * @param {Mission} mission
 * @param {object} [options] DEFAULT_OPTIONS を上書きするもの
 */
export function buildProblem(mission, options = {}) {
  const opt = { ...DEFAULT_OPTIONS, ...options };
  const vars = collect_vars(mission, opt);
  const n = vars.length;

  // 添字は毎回引き直すと n^2 になるので、組み立て時に配っておく
  const index_of = new Map();
  vars.forEach((v, k) => index_of.set(v.key, k));

  // 時刻は連鎖して入れるので、ノード番号から引けるようにしておく
  const i_date0 = index_of.get('date0');
  const i_tof = []; // ノードi の飛行時間が入っている添字 (無ければ undefined)
  for (const v of vars) if (v.key.startsWith('tof')) i_tof[v.node] = index_of.get(v.key);
  // 変数を持たないノードの飛行時間 (節目に固定されている等) は初期値のまま使う
  const tof_fixed = [];
  for (let i = 1; i < mission.count; i++) {
    if (i_tof[i] == undefined) tof_fixed[i] = mission.date(i) - mission.date(i - 1);
  }
  // 時刻以外は、それぞれの set がそのまま使える
  const node_vars = vars
    .map((v, k) => ({ v, k }))
    .filter(({ v }) => v.set != undefined);

  const start = mission.serialize();

  /** [0,1]^n → 物理量の並び */
  const toPhysical = (x) => vars.map((v, k) => v.phys(x[k]));

  /** 物理量の並び → [0,1]^n */
  const fromPhysical = (p) => vars.map((v, k) => v.norm(p[k]));

  /** いまのミッションの状態を [0,1]^n に写す */
  const current = () => vars.map((v) => v.norm(v.get()));

  /**
   * 設計変数をミッションへ書き戻す。再計算は最後に1回だけ走る。
   *
   * 時刻は「打上げ日から飛行時間を積む」形で先頭から順に入れる。後ろから
   * 入れると、途中で最小間隔に引っかかって切り詰められてしまう。
   */
  const apply = (x) => {
    const p = toPhysical(x);
    mission.batch(() => {
      if (i_date0 != undefined) {
        // 打上げ日から飛行時間を積んで、日付の並びをまとめて渡す。
        // 節目に固定されたノードは穴 (undefined) にして触らない
        const dates = [p[i_date0]];
        let t = dates[0];
        for (let i = 1; i < mission.count; i++) {
          const k = i_tof[i];
          if (k == undefined) {
            dates[i] = undefined; // 固定されたノード。モデルが置く
            t += tof_fixed[i] ?? 0;
            continue;
          }
          t += p[k];
          dates[i] = t;
        }
        mission.set_dates(dates);
      }
      for (const { v, k } of node_vars) v.set(p[k]);
    });
  };

  const base = scoreMission(mission, opt);
  // 目的関数を「初期設計より何割減ったか」で測るための基準。
  // 初期設計そのものが成り立っていないときは 1kg を基準にして、
  // 「成り立つ点が見つかりさえすれば下がる」形にしておく
  const ref_mass = base.ok ? base.final_mass : 1;

  /**
   * 一点の評価。ミッションに書き戻したうえで成績を返す。
   * @returns {{f:number, ok:boolean, ...}} f は最小化したい量
   */
  const evaluate = (x) => {
    apply(x);
    const s = scoreMission(mission, opt);
    const P = opt.penalty;
    let f;
    if (s.ok) {
      // ln(初期の最終質量 / いまの最終質量)。負なら改善
      f = Math.log(ref_mass / s.final_mass);
      // 指定した周回数で解けなくなった点は、もう同じ骨格の設計ではない。
      // 罰で切り離しておかないと、最適化が勝手に別の軌道へ乗り換えてしまう
      if (opt.keep_revs && s.fallback) f += P;
    } else if (isFinite(s.vinf)) {
      // 軌道は繋がっているが、その脱出速度はロケットが出せない。
      // 一定の壁にすると戻る向きが分からなくなるので、V∞を足して
      // 「遅い方が feasible に近い」と伝える
      f = 2 * P + s.vinf;
    } else {
      // 軌道そのものが繋がっていない。近さの測りようが無いので平らな壁。
      // 上の2つより必ず悪くしておく
      f = 3 * P;
    }
    return { f, ...s };
  };

  return {
    mission,
    options: opt,
    vars,
    n,
    labels: vars.map((v) => v.label),
    keys: vars.map((v) => v.key),
    /** 変数の範囲 (物理単位)。中身の確認・表示用 */
    bounds: vars.map((v) => ({ key: v.key, label: v.label, lo: v.lo, hi: v.hi, scale: v.scale })),
    /** ソルバに渡す箱。正規化してあるので常に 0〜1 */
    lower: new Array(n).fill(0),
    upper: new Array(n).fill(1),
    /** 端が繋がっている変数 (角度)。丸めずに折り返してよい */
    periodic: vars.map((v) => v.periodic),
    /** 初期設計 (正規化済み) */
    x0: current(),
    /** 初期設計の成績 */
    base,
    toPhysical,
    fromPhysical,
    current,
    apply,
    evaluate,
    /** ソルバ用。最小化したいスカラーだけを返す */
    objective: (x) => evaluate(x).f,
    /** 最終質量 [kg] をそのまま見たいとき */
    finalMass: (x) => evaluate(x).final_mass,
    /** 元の設計に戻す */
    reset: () => mission.restore(start),
    /** いまの設計を取り出す / 書き戻す (最良点の保存用) */
    snapshot: () => mission.serialize(),
    load: (s) => mission.restore(s),
  };
}
