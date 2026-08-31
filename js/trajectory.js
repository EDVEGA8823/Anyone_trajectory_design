import { Sequence_Type } from './state.js';

//諸定数
export const MU_SUN = 1.32712440018e11;
export const AU = 149597870.7;

export let element_0 = [
  [57909226.54152438, 0.20563593, 0.12225994793212572, 4.4025986842958265, 1.3518935764250155, 0.8435309954891992],
  [108209474.53737916, 0.00677672, 0.05924827411109566, 3.176134456089366, 2.296896356038777, 1.3383157224083446],
  [149598261.1504425, 0.01671123, -2.6720990848033185e-7, 1.7534375570727851, 1.796601474049171, 0],
  [227943822.42757303, 0.0933941, 0.03228320542488929, -0.07947238153833505, -0.41789517122343994, 0.8649771297497416],
  [778340816.6927108, 0.04838624, 0.02276602153047185, 0.6003311378658575, 0.2570604668470747, 1.7536005259699596],
  [1426666414.179921, 0.05386179, 0.04338874330931084, 0.8718660371588796, 1.6161553101630626, 1.9837835429754038],
  [2870658170.655732, 0.04725744, 0.013485074058964219, 5.467036266405599, 2.9837149917991095, 1.2918390439753027],
  [4498396417.009467, 0.00859048, 0.030893086454925476, -0.9620260018875293, 0.7847831489880195, 2.3000686413544607],
  [5906440596.528804, 0.2488273, 0.29914964427853585, 4.170098397482234, 3.9107403406360577, 1.92516687576987],
];
export let element_dot = [
  [55.351212159, 0.00001906, -0.00010380328272943754, 2608.7903050105283, 0.0028008501038607634, -0.0021876098216166338],
  [583.4316957299999, -0.00004107, -0.000013768902468983266, 1021.3285495824113, 0.000046832245285838646, -0.004846677754625787],
  [840.740033334, -0.00004392, -0.00022596219320209946, 628.3075779009216, 0.005642189402906841, 0],
  [2763.072671829, 0.00007882, -0.0001419181320003401, 334.06130168138657, 0.007756433087685417, -0.005106369657353154],
  [-17363.824852149, -0.00013253, -0.00003206414182008862, 52.966311891385956, 0.003709290314332382, 0.0035725329463972646],
  [-187087.09709742, -0.00050991, 0.00003379114511493701, 21.33653878870552, -0.007312443666192486, -0.00503838053087464],
  [-293475.11882443196, -0.00004397, -0.00004240085431502504, 7.4784221716045405, 0.007121865056514843, 0.0007401224027385382],
  [39330.776185737, 0.00005105, 0.000006173578630154342, 3.812836741319127, -0.00562719702463221, -0.00008877861586364437],
  [-47266.943226371994, 0.0000517, 8.40899633610868e-7, 2.534354299461879, -0.0007091171521756345, -0.0002065565753808753],
];

// 惑星ごとの重力定数 mu [km^3/s^2] と赤道半径 [km] (State.planet_list と同じ並び順:
// 水星,金星,地球,火星,木星,土星,天王星,海王星,冥王星)。スイングバイ計算に使用する。
export const planet_mu = [
  22032, // 水星
  324859, // 金星
  398600.4418, // 地球
  42828.3, // 火星
  126686534, // 木星
  37931187, // 土星
  5793939, // 天王星
  6836529, // 海王星
  871, // 冥王星
];
export const planet_radius = [
  2439.7, // 水星
  6051.8, // 金星
  6378.137, // 地球
  3396.2, // 火星
  71492, // 木星
  60268, // 土星
  25559, // 天王星
  24764, // 海王星
  1188.3, // 冥王星
];
// スイングバイ時に確保する、天体表面からの最低通過高度 [km]。
// 大気(や巨大ガス惑星の場合は放射線帯・リング)を避けるための実用的な下限で、
// 実ミッションの設定やpykepのsafe_radiusの慣習に近い値を採用している。
export const MIN_FLYBY_ALTITUDE = [
  200, // 水星: 大気がほぼ無いので低くてよい
  300, // 金星: 濃密な大気
  300, // 地球: 大気
  200, // 火星: 希薄な大気
  71492 * 0.5, // 木星: 強烈な放射線帯を避けるため半径の1.5倍相当を近点下限とする
  60268 * 0.5, // 土星: リング・放射線帯を避ける
  25559 * 0.3, // 天王星
  24764 * 0.3, // 海王星
  100, // 冥王星: 大気は希薄
];

// 天体nに対して許容される最小の近点半径 [km] (= 天体半径 + 最低通過高度)。
// スイングバイのrpはこれを下回れない。
export function min_flyby_rp(n) {
  if (planet_radius[n] == undefined) return undefined;
  return planet_radius[n] + MIN_FLYBY_ALTITUDE[n];
}

// --- 天体周回軌道 (周回軌道投入 / 軌道脱出) ---
//
// 【ΔVが位相に依らないこと】
// 近点で軌道接線方向に噴射する場合、必要なΔVは (V∞, rp, ra, mu) だけで決まり、
// 軌道面の向きにも近点の方向にも、天体のどの位相で到着するかにも依らない。
//   ・入射双曲線は「エネルギー(V∞)」と「近点半径(rp)」だけで形が決まる
//   ・目標の楕円も rp と ra だけで決まる
//   ・両者は近点を共有し、近点では速度がどちらも動径に垂直 = 同じ向き
// なので単純な速さの差になる。B面のどこを狙うか(=できあがる軌道の向き)は
// 費用に影響しない。したがって「厳密な位相」を決めなくてもΔVは厳密に出せる。
//
// 逆に位相が効くのは軌道脱出の側で、周回軌道の近点方向は投入時に決まってしまう
// のに対し、出発に必要なV∞の向きは日々変わる。ここでは「投入時に、後の出発に
// 都合の良い向きを選んでおいた」= 軌道の向きは自由に取れる、という前提を置く。
// 初期検討では標準的な仮定で、面変更や近点移動の費用はここには含まれない。

/**
 * 天体を回る軌道の近点速度 [km/s]。
 * ra == rp なら円軌道、ra → ∞ なら放物線(脱出)速度に一致する。
 */
export function periapsis_speed(mu, rp, ra) {
  if (!(mu > 0) || !(rp > 0)) return undefined;
  if (!isFinite(ra)) return Math.sqrt((2 * mu) / rp);
  const r_a = Math.max(ra, rp);
  return Math.sqrt((2 * mu * r_a) / (rp * (rp + r_a)));
}

/**
 * 双曲線軌道と、近点を共有する周回軌道との速度差 [km/s]。
 * 周回軌道投入(捕獲)でも軌道脱出でも同じ式になる。
 * @param {number} v_inf 双曲線側のV∞ [km/s]
 */
export function parking_orbit_dv(mu, v_inf, rp, ra) {
  const v_orb = periapsis_speed(mu, rp, ra);
  if (v_orb == undefined) return undefined;
  return Math.sqrt(v_inf * v_inf + (2 * mu) / rp) - v_orb;
}

/**
 * 天体のヒル半径 [km]。太陽の重力に対して天体が衛星を保持できる範囲の目安。
 * @param {number} mu_pla  天体の重力定数 [km^3/s^2]
 * @param {number} r_helio そのときの太陽からの距離 [km]
 */
export function hill_radius(mu_pla, r_helio) {
  if (!(mu_pla > 0) || !(r_helio > 0)) return undefined;
  return r_helio * Math.cbrt(mu_pla / (3 * MU_SUN));
}

// 周回軌道として認める遠点半径の上限 (ヒル半径に対する割合)。
// ヒル半径ぎりぎりの軌道は太陽の摂動で剥がされてしまうため、順行衛星の
// 安定限界としてよく使われる 1/2 を採る。上限を設けないと「遠点を無限に
// 遠くすれば投入ΔVはいくらでも小さくできる」という非現実的な答えが出てしまう。
export const MAX_PARKING_RA_HILL = 0.5;

// 既定の周回軌道。近点は通過可能な下限(=オーベルト効果が最大)、
// 遠点は天体半径の20倍程度の、実際の捕獲軌道によくある大きさにする。
export const DEFAULT_PARKING_RA_FACTOR = 20;

// --- 大気圏突入 ---
//
// 突入インターフェース高度 [km]。「ここから先は大気の影響を無視できない」と
// 決めた高さで、突入速度や経路角はこの高さでの値として定義される慣習になっている。
// 地球の120kmが最も広く使われる値で、他天体もそれぞれの探査機の慣習に合わせた。
export const ENTRY_ALTITUDE = [
  100, // 水星: 大気が無いので便宜的な値 (実質は衝突)
  150, // 金星: 濃密な大気 (ベネラ/パイオニアの慣習)
  120, // 地球: 標準的な突入インターフェース
  120, // 火星: MSL等で使われる値
  450, // 木星: ガリレオ探査機が1barの450km上を基準にした
  450, // 土星
  450, // 天王星
  450, // 海王星
  50, // 冥王星: 大気は希薄
];

/** 天体nの突入インターフェース半径 [km] */
export function entry_interface_radius(n) {
  if (planet_radius[n] == undefined) return undefined;
  return planet_radius[n] + ENTRY_ALTITUDE[n];
}

/**
 * 突入インターフェースでの速度 [km/s]。
 * 無限遠から突入高度まで落ちてくる間のエネルギー保存そのもの。
 *   v_entry = √(V∞² + 2μ/r_e)
 * V∞ = 0 でもその高さの脱出速度は残るので、地球なら 11.1 km/s が下限になる。
 */
export function entry_velocity(mu, v_inf, r_e) {
  if (!(mu > 0) || !(r_e > 0)) return undefined;
  return Math.sqrt(v_inf * v_inf + (2 * mu) / r_e);
}

/**
 * 突入インターフェースでの経路角γ (水平から測り、降下方向が負) を与えたときの、
 * 大気に入るまでの双曲線軌道。
 *
 *   h = r_e・v_e・cos γ          (角運動量)
 *   p = h²/μ,  e = √(1 + h²V∞²/μ²)
 *   cos ν_e = (p/r_e − 1)/e     (突入点の真近点角。降下中なので ν_e < 0)
 *   r_p = p/(1+e)                (近点半径。放物線側でも安定な形で計算する)
 *
 * @returns {{v_e, h, p, e, nu_e, rp}|undefined}
 */
export function entry_conic(mu, v_inf, r_e, gamma) {
  const v_e = entry_velocity(mu, v_inf, r_e);
  if (v_e == undefined) return undefined;
  const h = r_e * v_e * Math.cos(gamma);
  const p = (h * h) / mu;
  const e = Math.sqrt(Math.max(0, 1 + ((h * h) / (mu * mu)) * v_inf * v_inf));
  // 真上から落ちる極限 (h→0) では真近点角が定まらないので、そこは弾く
  if (!(e > 1e-9) || !(p > 0)) return undefined;
  const cos_nu = Math.max(-1, Math.min(1, (p / r_e - 1) / e));
  // 降下中 = 近点へ向かっている = 真近点角は負
  const nu_e = -Math.acos(cos_nu);
  return { v_e, h, p, e, nu_e, rp: p / (1 + e) };
}

// --- 進行方向を基準にした推力 (手動マヌーバ) ---
//
// 打上げの手動モードとまったく同じ流儀で向きを決める。
//   x_hat = 進行方向, z_hat = 軌道面の法線, y_hat = z×x
// を基準に、方位角αと仰角δで向きを、大きさをΔVで与える。
// 打上げは「天体の公転速度」を基準に取るのに対し、マヌーバは「探査機自身の
// 速度」を基準に取る、という違いしかないので計算はそのまま使い回せる。
export const impulse_frame = launch_frame;

/**
 * 速度vで進んでいる探査機に、進行方向基準の(ΔV, α, δ)で推力を与える。
 * @returns {{dv_vec:number[], v_after:number[]}|undefined}
 */
export function apply_impulse(r, v, dv, alpha, delta) {
  const out = launch_velocity(r, v, dv, alpha, delta);
  return out == undefined ? undefined : { dv_vec: out.v_inf_vec, v_after: out.v_out };
}

/**
 * ΔVベクトルを進行方向基準の2角に分解する (get_launch_angles と同じ考え方)。
 * 自動マヌーバでも「どっち向きに、どれだけ噴いているのか」を同じ形で読める。
 */
export function impulse_angles(r, v, dv_vec) {
  const frame = impulse_frame(r, v);
  const dv = math.norm(dv_vec);
  if (frame == undefined || !(dv > 1e-12)) return undefined;
  return {
    alpha: Math.atan2(math.dot(dv_vec, frame.y_hat), math.dot(dv_vec, frame.x_hat)),
    delta: Math.asin(Math.max(-1, Math.min(1, math.dot(dv_vec, frame.z_hat) / dv))),
  };
}

export const i_hat = [1, 0, 0];
export const j_hat = [0, 1, 0];
export const k_hat = [0, 0, 1];

// |e-1| がこれ以下なら放物線として扱う。楕円・双曲線の式は e が1に近づくほど
// 軌道長半径が発散して桁落ちするので、その手前で放物線の式に切り替える。
export const PARABOLIC_TOL = 1e-8;

const KEPLER_TOL = 1e-12; // 離心近点角の収束判定 [rad]
const KEPLER_MAX_ITER = 100;

/**
 * ケプラー方程式を解く。楕円は離心近点角 E、双曲線は双曲線近点角 H を返す。
 *
 *   楕円   M = E - e sin E
 *   双曲線 M = e sinh H - H
 *
 * ニュートン法だけだと、双曲線で M が大きいときに初期値 H=M から sinh(M) が
 * 溢れて発散する。単調な関数なので、必ず解を含む区間を先に作り、その中で
 * ニュートン法を回して、外に出たら二分法に落とす。
 *
 * 放物線 (e≒1) はこの形では解けない (M=0 で微分が0になる)。
 * conic_state が barker_true_anomaly に振り分けるので、ここには来ない。
 */
export function solve_kepler(e, M) {
  if (!isFinite(e) || !isFinite(M)) return NaN;
  if (M === 0) return 0;

  const hyperbolic = e > 1;
  const f = hyperbolic ? (x) => e * Math.sinh(x) - x - M : (x) => x - e * Math.sin(x) - M;
  const df = hyperbolic ? (x) => e * Math.cosh(x) - 1 : (x) => 1 - e * Math.cos(x);

  // 解を挟む区間。楕円は E = M + e sinE から |E-M| ≦ e、双曲線は0から広げる
  let lo, hi;
  if (hyperbolic) {
    const s = Math.sign(M);
    hi = s;
    for (let i = 0; i < 200 && f(hi) * s < 0; i++) hi *= 2;
    lo = 0;
    if (s < 0) {
      const t = lo;
      lo = hi;
      hi = t;
    }
  } else {
    lo = M - e - 1e-12;
    hi = M + e + 1e-12;
  }

  // 初期値。楕円は定番の M + e sinM、双曲線は M ≒ e sinh H の逆から
  let x = hyperbolic ? Math.asinh(M / e) : M + e * Math.sin(M);
  if (!isFinite(x)) x = (lo + hi) / 2;

  for (let i = 0; i < KEPLER_MAX_ITER; i++) {
    const y = f(x);
    // 区間を詰める (次に外へ飛んだときの落とし先になる)
    if (y > 0) hi = x;
    else lo = x;

    const d = df(x);
    let next = d !== 0 ? x - y / d : (lo + hi) / 2;
    if (!isFinite(next) || next < Math.min(lo, hi) || next > Math.max(lo, hi)) {
      next = (lo + hi) / 2; // 区間の外に出たら二分法
    }
    const step = next - x;
    x = next;
    if (Math.abs(step) < KEPLER_TOL) break;
  }
  return x;
}

/**
 * 放物線軌道 (e=1) のバーカーの方程式を解いて、真近点角を返す。
 *
 *   t - tp = sqrt(2q^3/mu) (D + D^3/3),  D = tan(nu/2)
 *
 * 3次方程式なので、カルダノの公式でそのまま解ける。
 *
 * @param {number} mu 中心天体の重力定数 [km^3/s^2]
 * @param {number} q  近点距離 [km]
 * @param {number} dt 近点通過からの経過時間 [s]
 */
export function barker_true_anomaly(mu, q, dt) {
  const A = Math.sqrt(mu / (2 * q * q * q)) * dt; // = D + D^3/3
  const B = 1.5 * A;
  const s = Math.sqrt(B * B + 1);
  const D = Math.cbrt(B + s) + Math.cbrt(B - s);
  return 2 * Math.atan(D);
}

// 惑星の数 (水星〜冥王星)。これ以降の番号は取り込んだ小天体に割り当てる
export const PLANET_COUNT = 9;

// 小天体の軌道要素を返す関数。取り込みを担う側 (js/small_bodies.js) が
// 起動時に登録する。ここから小天体の一覧を直接見に行くと、物理の計算だけを
// 持つこのファイルが画面側の都合に依存してしまうので、口だけ開けておく。
let small_body_provider = null;

/** @param {(n:number) => ({q,e,i,node,peri,tp}|null)} fn 天体番号から近点基準の要素を返す関数 */
export function setSmallBodyProvider(fn) {
  small_body_provider = fn;
}

/**
 * 取り込んだ小天体の物理量を、天体番号で引く表に足す。
 * こうしておけば、天体ごとの定数を引いている既存の処理が番号だけで動く。
 */
export function setBodyConstants(n, { mu, radius, min_altitude = 0, entry_altitude = 0 }) {
  planet_mu[n] = mu;
  planet_radius[n] = radius;
  MIN_FLYBY_ALTITUDE[n] = min_altitude;
  ENTRY_ALTITUDE[n] = entry_altitude;
}

/**
 * 番号 n 以降の物理量を捨てる。
 * 取り込んだ小天体を消すと後ろの番号が繰り上がるので、入れ直す前に一度空にする
 * (消さないと、消した天体のぶんが表の末尾に残る)。
 */
export function clearBodyConstantsFrom(n) {
  for (const table of [planet_mu, planet_radius, MIN_FLYBY_ALTITUDE, ENTRY_ALTITUDE]) {
    if (table.length > n) table.length = n;
  }
}

/**
 * 近点距離基準の要素 {q,e,i,node,peri,tp} を、この先の計算で使う
 * [a, e, i, Ω, ω, 離心近点角] の並びに直す。
 *
 * 放物線 (e=1) はこの並びでは表せない (軌道長半径が発散する) ので、ごくわずかに
 * 楕円へ寄せる。形の違いは相対 1e-7 程度で、設計の当たりを付けるには影響しない。
 */
function conic_to_elements(el, T) {
  let e = el.e;
  if (Math.abs(e - 1) <= PARABOLIC_TOL) e = 1 - 1e-7;

  const a = el.q / (1 - e); // 双曲線では負
  const n = Math.sqrt(MU_SUN / Math.abs(a * a * a)); // [rad/s]
  const M = n * (T - el.tp) * 86400;
  const E = solve_kepler(e, M);
  return [a, e, el.i, el.node, el.peri, E];
}

export function get_planet_elements(T, n) {
  if (n >= PLANET_COUNT) {
    const el = small_body_provider ? small_body_provider(n) : null;
    return el ? conic_to_elements(el, T) : undefined;
  }

  let T_TDB = (T - 2451545.0) / 36525.0;
  let X = element_0[n].map((y, i) => y + T_TDB * element_dot[n][i]);

  let a = X[0];
  let e = X[1];
  let i = X[2]; //Math.abs();
  let w = X[4] - X[5];
  let W = X[5];
  let L = X[3];
  let M = L - X[4];

  let E = solve_kepler(e, M);

  return [a, e, i, W, w, E];
}

export function change_coordinate(v) {
  return [v[0], v[2], -v[1]];
}

// 開いた軌道 (放物線・双曲線) を描く範囲。
//
// 恒星間天体は太陽の近くにいる期間がごく短く、探査の当たりを付けるには
// 「まだ遠くにいる時期に出発して追いかける」「通り過ぎたあとを追う」といった
// ところまで見えている必要がある。近点まわりだけを描いていると、そこから先へ
// 時刻を動かせなかった (線の上しか掴めないため)。
//
// 1I/'Oumuamua (近日点0.26AU・V∞26km/s) で 100AU までとると、近点をはさんで
// 前後およそ18年ぶんになる。海王星の軌道 (30AU) の外まで届く。
const OPEN_ORBIT_SPAN = 60; // 近日点距離の何倍まで伸ばすか
const OPEN_ORBIT_MIN_FAR = 100; // ただし最低でもこれだけは伸ばす [AU]

/**
 * 軌道を折れ線で描くときの、点を取る離心近点角(双曲線なら双曲線近点角)の並び。
 *
 * 描画 (get_orbit) と、マウスで軌道を掴むときの当たり判定 (js/orbit_pick.js) で
 * 同じ並びを使うために切り出してある。両者がずれると「線の上を指しているのに
 * 掴めない」ことになるので、範囲と刻みは必ずここ1か所で決める。
 *
 * @param {number[]} elements 軌道要素 [a, e, i, W, w, E]
 * @param {number} n 点の数
 * @returns {Float64Array} 近点角の並び (楕円は0→2πの一周、双曲線は前後対称)
 */
export function orbit_anomalies(elements, n = 100) {
  const a = elements[0];
  const e = elements[1];
  const out = new Float64Array(n);

  if (e >= 1) {
    // 双曲線は一周しない。近点をはさんで、太陽から離れすぎない範囲だけ描く。
    // 中央ほど点が詰まるように取る (一番速く曲がるのが近点のまわり)
    const q = a * (1 - e);
    const far = Math.max(q * OPEN_ORBIT_SPAN, OPEN_ORBIT_MIN_FAR * AU);
    const H_max = Math.acosh(Math.max(1, (1 - far / a) / e));
    for (let i = 0; i < n; i++) {
      const u = (2 * i) / (n - 1) - 1;
      out[i] = H_max * u * Math.abs(u);
    }
    return out;
  }

  for (let i = 0; i < n; i++) out[i] = (2 * Math.PI * i) / (n - 1);
  return out;
}

// マヌーバの「未実行時の軌道」で、開いた軌道を描く幅 (いまの位置の前後)。
// こちらは天体の軌道と違って「この節がどこへ流されるか」を見るためのものなので、
// 遠くまで伸ばさず手元だけを描く
const COAST_OPEN_SPAN = 2.5;

/**
 * マヌーバの「未実行時の軌道」を描く近点角の並び。
 * 楕円は1周分、開いた軌道はいまの位置のまわりだけ。
 *
 * 描画 (get_coast_orbit) と、マウスで掴むときの当たり判定で同じ並びを使う。
 */
export function coast_anomalies(par, n = 181) {
  const out = new Float64Array(n);
  if (par[1] < 1) {
    for (let k = 0; k < n; k++) out[k] = (2 * Math.PI * k) / (n - 1);
    return out;
  }
  const E0 = par[5];
  for (let k = 0; k < n; k++) out[k] = E0 - COAST_OPEN_SPAN + (2 * COAST_OPEN_SPAN * k) / (n - 1);
  return out;
}

export function get_orbit(elements) {
  const anomalies = orbit_anomalies(elements, 100);
  const pos = new Array(anomalies.length);
  for (let i = 0; i < anomalies.length; i++) {
    const { r } = get_planets_pos_E(elements, anomalies[i]);
    pos[i] = new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU);
  }
  return pos;
}

export function get_W_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  return [Math.sin(W) * Math.sin(i), -Math.cos(W) * Math.sin(i), Math.cos(i)];
}

export function get_P_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  return [
    Math.cos(w) * Math.cos(W) - Math.sin(w) * Math.sin(W) * Math.cos(i),
    Math.cos(w) * Math.sin(W) + Math.sin(w) * Math.cos(W) * Math.cos(i),
    Math.sin(w) * Math.sin(i),
  ];
}

export function get_Q_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  return [
    -Math.sin(w) * Math.cos(W) - Math.cos(w) * Math.sin(W) * Math.cos(i),
    -Math.sin(w) * Math.sin(W) + Math.cos(w) * Math.cos(W) * Math.cos(i),
    Math.cos(w) * Math.sin(i),
  ];
}

export function get_planets_pos(elements) {
  return get_planets_pos_E(elements, elements[5]);
}

export function get_planets_pos_E(elements, E) {
  let a = elements[0];
  let e = elements[1];
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  // console.log(E)

  var P_hat = get_P_hat(elements);
  var Q_hat = get_Q_hat(elements);
  let r = [];
  let v = [];
  let p, r_n, r_norm;
  if (e < 1) {
    p = a * (1 - e * e);
    r_n = a * (1 - e * Math.cos(E));
    r = math.add(math.multiply(P_hat, a * (Math.cos(E) - e)), math.multiply(Q_hat, Math.sqrt(a * p) * Math.sin(E)));
    r_norm = math.norm(r);
    v = math.add(
      math.multiply(P_hat, (-Math.sqrt(MU_SUN * a) * Math.sin(E)) / r_norm),
      math.multiply(Q_hat, (Math.sqrt(MU_SUN * p) * Math.cos(E)) / r_norm)
    );
  } else {
    p = -a * (e * e - 1);
    r_n = -a * (e * Math.cosh(E) - 1);
    r = math.add(math.multiply(P_hat, -a * (e - Math.cosh(E))), math.multiply(Q_hat, Math.sqrt(-a * p) * Math.sinh(E)));
    r_norm = math.norm(r);
    // 双曲線の速度。位置 r = P|a|(e - coshH) + Q sqrt(|a|p) sinhH を時間微分すると
    //   v = -P sqrt(mu|a|) sinhH / r + Q sqrt(mu p) coshH / r
    // となり、P成分は楕円の場合と同じく負符号になる
    // (ここが正だと双曲線の伝播で軌道エネルギーが保存せず、離心率が変わってしまう)
    v = math.add(
      math.multiply(P_hat, (-Math.sqrt(MU_SUN * -a) * Math.sinh(E)) / r_norm),
      math.multiply(Q_hat, (Math.sqrt(MU_SUN * p) * Math.cosh(E)) / r_norm)
    );
  }

  return { r, v };
}

/**
 * 近点距離と離心率で与えられた軌道の、近点通過から dt 秒後の位置と速度。
 *
 * 楕円・放物線・双曲線を同じ入口で扱う。小天体 (特に長周期彗星や恒星間天体)
 * は e が1をまたぐので、軌道長半径ではなく近点距離を基準にした方が素直に書ける
 * (e=1 では軌道長半径が発散する)。
 *
 * 真近点角さえ出れば、位置と速度は円錐曲線に共通の式で書ける:
 *   r = p / (1 + e cos nu),  p = q(1 + e),  h = sqrt(mu p)
 *   v = (mu/h) { -sin nu * P + (e + cos nu) * Q }
 *
 * @param {object} el {q[km], e, i[rad], node[rad], peri[rad]}
 * @param {number} dt 近点通過からの経過時間 [s]
 * @param {number} mu 中心天体の重力定数 [km^3/s^2]
 * @returns {{r: number[], v: number[], nu: number}}
 */
export function conic_state(el, dt, mu = MU_SUN) {
  const { q, e } = el;
  let nu;

  if (Math.abs(e - 1) <= PARABOLIC_TOL) {
    nu = barker_true_anomaly(mu, q, dt);
  } else if (e < 1) {
    const a = q / (1 - e);
    const M = Math.sqrt(mu / (a * a * a)) * dt;
    const E = solve_kepler(e, M);
    // tan(nu/2) = sqrt((1+e)/(1-e)) tan(E/2) を atan2 で象限ごと出す
    nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  } else {
    const a = q / (1 - e); // 双曲線では負
    const M = Math.sqrt(mu / Math.abs(a * a * a)) * dt;
    const H = solve_kepler(e, M);
    // tan(nu/2) = sqrt((e+1)/(e-1)) tanh(H/2)
    nu = 2 * Math.atan2(Math.sqrt(e + 1) * Math.tanh(H / 2), Math.sqrt(e - 1));
  }

  const p = q * (1 + e);
  const r_norm = p / (1 + e * Math.cos(nu));
  const h = Math.sqrt(mu * p);
  // get_P_hat / get_Q_hat は [a, e, i, W, w] の並びだけを見る
  const orient = [0, e, el.i, el.node, el.peri];
  const P = get_P_hat(orient);
  const Q = get_Q_hat(orient);

  const cn = Math.cos(nu);
  const sn = Math.sin(nu);
  const vr = -(mu / h) * sn;
  const vt = (mu / h) * (e + cn);

  const r = [];
  const v = [];
  for (let k = 0; k < 3; k++) {
    r[k] = r_norm * (cn * P[k] + sn * Q[k]);
    v[k] = vr * P[k] + vt * Q[k];
  }
  return { r, v, nu };
}

export function ic2par(r, v, mu) {
  const norm = (vec) => math.sqrt(math.dot(vec, vec));
  const cross = (a, b) => math.cross(a, b);
  const dot = (a, b) => math.dot(a, b);
  const atan2 = math.atan2;
  const atan = math.atan;
  const asinh = math.asinh;

  const r_norm = norm(r);
  const epsilon = dot(v, v) / 2 - mu / r_norm;
  const a = -mu / (2 * epsilon);

  const h = cross(r, v);
  const P = math.subtract(math.multiply(-mu / r_norm, r), cross(h, v));
  const e = norm(P) / mu;

  let E = 0;
  if (e === 0) {
    E = 0;
  } else if (e < 1) {
    const ecosE = 1 - r_norm / a;
    const esinE = dot(r, v) / math.sqrt(mu * a);
    E = atan2(esinE, ecosE);
  } else {
    E = asinh(dot(r, v) / (e * math.sqrt(-mu * a)));
  }

  const W_hat = math.divide(h, norm(h));
  const N_hat = math.divide(cross(k_hat, h), norm(cross(k_hat, h)));

  let i = math.acos(dot(W_hat, k_hat));
  let Omega = i === 0 ? 0 : math.acos(dot(N_hat, i_hat));
  if (math.dot(N_hat, j_hat) < 0) Omega = 2 * math.pi - Omega;

  let omega =
    e === 0
      ? 0
      : math.dot(k_hat, math.divide(P, norm(P))) < 0
      ? 2 * math.pi - math.acos(math.dot(N_hat, math.divide(P, norm(P))))
      : math.acos(math.dot(N_hat, math.divide(P, norm(P))));

  return [a, e, i, Omega, omega, E];
}

export function JulianToDate(julianDay) {
  const timestamp = (julianDay - 2440587.5) * 86400000;
  return new Date(timestamp);
}

export function DateToJulian(date) {
  const time = date.getTime();
  return time / 86400000 + 2440587.5;
}

export function nu2E(nu, e) {
  if (e < 1) return 2 * math.atan(math.sqrt((1 - e) / (1 + e)) * math.tan(nu / 2));
  else return 2 * math.atanh(math.sqrt((e - 1) / (e + 1)) * math.tan(nu / 2));
}

export function E2M(E, e) {
  if (e < 1) return E - e * math.sin(E);
  else return e * math.sinh(E) - E;
}

export function kepler_equation(a, e, E, μ) {
  if (a > 0) return math.sqrt(a ** 3 / μ) * (E - e * math.sin(E));
  else return math.sqrt((-a) ** 3 / μ) * (e * math.sinh(E) - E);
}

export function get_peariod(a, μ) {
  return 2 * Math.PI * Math.sqrt(Math.abs(a) ** 3 / μ);
}

/* ==================================================================
   多周回のランベール問題
   ==================================================================
   出発と到着の間に太陽をM周してから着く解。同じ2点・同じ飛行時間でも
   M=0 の直行解とはまったく別の軌道になり、外惑星や小惑星へは
   「1周まわってから着く」方がずっと安いことが多い。

   ライブラリ (Izzo法) は M と low_path を受け取れるので、こちら側は
   「その飛行時間で何周まで可能か」と「その周回数に必要な最短飛行時間」を
   用意して、選ばせる/はみ出しを防ぐ役に回る。
   ================================================================== */

// ランベール問題の無次元飛行時間 T。M周の解は T ≧ M*pi でしか存在しない
function lambert_nondim_time(r1, r2, tof, mu = MU_SUN) {
  const c = math.norm(math.subtract(r2, r1));
  const s = (math.norm(r1) + math.norm(r2) + c) / 2;
  return { T: Math.sqrt((2 * mu) / s ** 3) * tof, s };
}

/**
 * その飛行時間で見込める周回数の上限。
 * 境界のすぐ手前では1多く出ることがあるので (厳密な下限 T_min はライブラリの
 * 内部にしかない)、実際に解けるかは呼び出し側で確かめること。
 * ポークチョップのように何万回も解く場面で、無駄な例外を投げないための足切り。
 */
export function lambert_rev_limit(r1, r2, tof, mu = MU_SUN) {
  if (!(tof > 0)) return 0;
  const { T } = lambert_nondim_time(r1, r2, tof, mu);
  return Math.max(0, Math.floor(T / Math.PI));
}

/**
 * M周の解が成り立つ最短の飛行時間 [s]。
 *
 * 厳密な下限 T_min(M) はライブラリの内部で、外からは呼べない。飛行時間を
 * 延ばせば必ず解けるようになる (単調) ので、実際に解かせて二分法で境界を挟む。
 * 20回ほど解いても 0.5ms 程度なので、表示のために毎回求めても問題にならない。
 *
 * @returns {number|undefined} 見つからなければ undefined
 */
export function lambert_min_tof(r1, r2, revs, mu = MU_SUN, prograde = true) {
  if (revs <= 0) return 0;
  const solvable = (tof) => {
    try {
      const v = lambert_probrem(mu, r1, r2, tof, revs, prograde);
      return !!(v && v[0] && isFinite(v[0][0]));
    } catch (e) {
      return false;
    }
  };

  // T ≧ M*pi が必要条件。ここから上へ広げて、解ける飛行時間を1つ見つける
  const { s } = lambert_nondim_time(r1, r2, 1, mu);
  let lo = revs * Math.PI * Math.sqrt(s ** 3 / (2 * mu));
  let hi = lo * 1.5;
  for (let k = 0; k < 40 && !solvable(hi); k++) hi *= 1.5;
  if (!solvable(hi)) return undefined;

  for (let k = 0; k < 40 && (hi - lo) / hi > 1e-6; k++) {
    const mid = (lo + hi) / 2;
    if (solvable(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// MGA-1DSMでDSMを打つ既定の位置 (レグの時間割合)
export const DEFAULT_DSM_ETA = 0.5;

// レグ上で起こる軌道要素上の節目
export const Leg_Event = {
  Perihelion: "perihelion", // 近日点
  Aphelion: "aphelion", // 遠日点
  AscendingNode: "ascending_node", // 昇交点 (黄道面を南->北へ横切る)
  DescendingNode: "descending_node", // 降交点 (北->南)
};

// 交点が意味を持たないとみなす軌道傾斜角のしきい値 [rad] (約0.006度)
const COPLANAR_INC = 1e-4;

// 隣り合うノードの間に最低限空ける日数
const MIN_NODE_GAP = 10;

function wrap_pi(x) {
  let y = (x + Math.PI) % (2 * Math.PI);
  if (y < 0) y += 2 * Math.PI;
  return y - Math.PI;
}

/**
 * 状態ベクトル(r0, v0)から始まる2体軌道について、時刻 t0 から t1 までの間に
 * 通過する近日点・遠日点・昇交点・降交点を列挙する。
 *
 * 楕円では区間が1周を超えると同じ節目を複数回通るため、その分もすべて返す。
 * 双曲線には遠日点が無く、交点も漸近線の手前(|ν| < ν∞)にある場合だけ通る。
 * 軌道傾斜角がほぼ0の場合は交点が定まらないので交点は返さない。
 *
 * @param {number[]} r0 基準時刻の位置 [km]
 * @param {number[]} v0 基準時刻の速度 [km/s]
 * @param {number} t0 レグ開始のユリウス日 (r0, v0 の時刻)
 * @param {number} t1 レグ終了のユリウス日
 * @param {number} [mu] 中心天体の重力定数 [km^3/s^2]
 * @returns {Array<{type:string, date:number, nu:number, E:number,
 *                  r:number[], v:number[], r_norm:number, speed:number}>}
 *          日付の昇順。求められない場合は空配列。
 */
export function leg_events(r0, v0, t0, t1, mu = MU_SUN) {
  if (r0 == undefined || v0 == undefined || t0 == undefined || t1 == undefined) return [];
  if (!(t1 > t0)) return [];

  const par = ic2par(r0, v0, mu);
  const a = par[0];
  const e = par[1];
  const inc = par[2];
  const w = par[4];
  if (!isFinite(a) || !isFinite(e) || e < 0) return [];

  // 各節目の真近点角。交点は緯度引数 u = ω + ν が 0 / π になる点。
  const candidates = [{ type: Leg_Event.Perihelion, nu: 0, E: 0 }];
  if (e < 1) candidates.push({ type: Leg_Event.Aphelion, nu: Math.PI, E: Math.PI });
  if (Math.abs(inc) > COPLANAR_INC && Math.abs(Math.abs(inc) - Math.PI) > COPLANAR_INC) {
    candidates.push({ type: Leg_Event.AscendingNode, nu: wrap_pi(-w) });
    candidates.push({ type: Leg_Event.DescendingNode, nu: wrap_pi(Math.PI - w) });
  }

  // 基準時刻の近点通過からの経過時間。各節目との差がレグ開始からの経過になる。
  const t_epoch = kepler_equation(a, e, par[5], mu);
  const nu_inf = e > 1 ? Math.acos(-1 / e) : undefined;
  const period_d = e < 1 ? get_peariod(a, mu) / 86400 : undefined;

  const events = [];
  for (const c of candidates) {
    // 双曲線では漸近線の手前しか通らない
    if (nu_inf != undefined && Math.abs(c.nu) >= nu_inf) continue;

    const E = c.E != undefined ? c.E : nu2E(c.nu, e);
    if (!isFinite(E)) continue;
    const date0 = t0 + (kepler_equation(a, e, E, mu) - t_epoch) / 86400;

    const add = (date) => {
      const { r, v } = get_planets_pos_E(par, E);
      events.push({
        type: c.type,
        date,
        nu: c.nu,
        E,
        r,
        v,
        r_norm: math.norm(r),
        speed: math.norm(v),
      });
    };

    if (period_d != undefined) {
      // 楕円: レグが何周ぶんかを跨ぐこともあるので、区間内の通過をすべて拾う
      for (let k = Math.ceil((t0 - date0) / period_d); ; k++) {
        const date = date0 + k * period_d;
        if (date > t1) break;
        add(date);
      }
    } else if (date0 >= t0 && date0 <= t1) {
      add(date0);
    }
  }

  events.sort((x, y) => x.date - y.date);
  return events;
}

/**
 * 2体問題で状態ベクトル(r, v)を dt 秒だけ伝播する。
 * 楕円・双曲線どちらにも対応する(平均近点角の進み方を場合分けする)。
 * @returns {{r:number[], v:number[]}|undefined} 伝播後の位置・速度
 */
export function propagate(r0, v0, dt, mu) {
  const par = ic2par(r0, v0, mu);
  const a = par[0];
  const e = par[1];
  if (!isFinite(a) || !isFinite(e)) return undefined;

  const E0 = par[5];
  const M0 = E2M(E0, e);
  // 平均運動 n = sqrt(mu/|a|^3)。双曲線(a<0)でも同じ形で定義できる
  const n = Math.sqrt(mu / Math.abs(a) ** 3);
  const M1 = M0 + n * dt;
  const E1 = solve_kepler(e, M1);
  if (!isFinite(E1)) return undefined;

  const par1 = [a, e, par[2], par[3], par[4], E1];
  const { r, v } = get_planets_pos_E(par1, E1);
  if (!isFinite(r[0]) || !isFinite(v[0])) return undefined;
  return { r, v };
}

/**
 * スイングバイ(フライバイ)による速度ベクトルの回転を計算する (MGA用、DSM無し)。
 *
 * 通過天体を焦点とする双曲線軌道として扱い、天体に対する相対速度(V∞)の
 * "大きさ"は変えずに"向き"だけを回転させる、無推力のパッチドコニック近似。
 * 曲げ角(ターン角)は近点半径 rp によって決まり、回転面の向き(どちらに
 * 曲がるか)は beta によって決まる。
 *
 *   v_inf_in  = v_in - v_pla                     (入射時の相対速度)
 *   a         = -mu_pla / |v_inf_in|^2            (双曲線の半長径, 負)
 *   e         = 1 - rp / a                        (離心率, >1)
 *   delta     = 2 * asin(1 / e)                   (曲げ角)
 *   v_inf_out = |v_inf_in| を保ったまま v_inf_in を delta だけ回転したもの
 *   v_out     = v_inf_out + v_pla                 (出射時の太陽中心速度)
 *
 * @param {number[]} v_in   通過前の太陽中心速度ベクトル [km/s]
 * @param {number[]} v_pla  通過天体の太陽中心速度ベクトル [km/s]
 * @param {number} rp       近点半径 (天体中心からの距離) [km]。天体の半径+最低通過高度以上であること
 * @param {number} beta     b面内での回転角 [rad] (0〜2π)。フライバイでどちら向きに曲がるかを決める
 * @param {number} mu_pla   通過天体の重力定数 [km^3/s^2]
 * @returns {{v_out: number[], v_inf_in: number[], v_inf_out: number[], v_inf: number, delta: number, e: number}}
 */
export function swingby(v_in, v_pla, rp, beta, mu_pla) {
  const v_inf_in = math.subtract(v_in, v_pla);
  const v_inf = math.norm(v_inf_in);

  if (v_inf < 1e-9) {
    throw new Error("swingby: 通過天体に対する相対速度がほぼ0のため、フライバイの向きを定義できません");
  }

  // 双曲線軌道のパラメータ (aは負の値を取る慣習)
  const a = -mu_pla / (v_inf * v_inf);
  const e = 1 - rp / a;
  const delta = 2 * Math.asin(1 / e);

  // 入射V∞方向 i_hat を基準にした正規直交基底 (i_hat, j_hat, k_hat) を作る。
  // j_hat は天体の公転面(v_pla方向)を基準に取ることで、beta=0が概ね
  // "公転面内で曲がる"向きに対応するようにしている。
  const i_hat = math.divide(v_inf_in, v_inf);
  let j_hat = math.cross(i_hat, v_pla);
  let j_norm = math.norm(j_hat);
  if (j_norm < 1e-9) {
    // v_pla が i_hat とほぼ平行な退化ケース: 別の基準ベクトルで代用する
    const ref = Math.abs(i_hat[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    j_hat = math.cross(i_hat, ref);
    j_norm = math.norm(j_hat);
  }
  j_hat = math.divide(j_hat, j_norm);
  const k_hat = math.cross(i_hat, j_hat);

  const v_inf_out = math.multiply(
    math.add(
      math.add(math.multiply(i_hat, Math.cos(delta)), math.multiply(j_hat, Math.sin(delta) * Math.cos(beta))),
      math.multiply(k_hat, Math.sin(delta) * Math.sin(beta))
    ),
    v_inf
  );

  const v_out = math.add(v_inf_out, v_pla);

  return { v_out, v_inf_in, v_inf_out, v_inf, delta, e };
}

/**
 * 打上げ方向を測るための、天体の運動を基準にした右手直交系。
 *   x_hat = 公転方向, z_hat = 軌道面の法線(≒黄道北), y_hat = z_hat × x_hat
 * 太陽系の慣性系で角度を指定するより、「公転方向から何度」の方が直感的なので
 * この向きを基準にしている。
 */
export function launch_frame(r_pla, v_pla) {
  const vn = math.norm(v_pla);
  const h = math.cross(r_pla, v_pla);
  const hn = math.norm(h);
  if (!(vn > 0) || !(hn > 0)) return undefined;
  const x_hat = math.divide(v_pla, vn);
  const z_hat = math.divide(h, hn);
  const y_hat = math.cross(z_hat, x_hat);
  return { x_hat, y_hat, z_hat };
}

/**
 * 手動モードの打上げ: |V∞| と2つの角度から出発速度を作る。
 *   v_inf = V (cosδcosα x_hat + cosδsinα y_hat + sinδ z_hat)
 * @param {number} vinf  無限遠方での速度の大きさ [km/s]
 * @param {number} alpha 方位角 [rad] (軌道面内、公転方向を0として y_hat 側が正)
 * @param {number} delta 仰角 [rad] (軌道面から外れる向き、北側が正)
 * @returns {{v_inf_vec:number[], v_out:number[]}|undefined}
 */
export function launch_velocity(r_pla, v_pla, vinf, alpha, delta) {
  const frame = launch_frame(r_pla, v_pla);
  if (frame == undefined) return undefined;
  const { x_hat, y_hat, z_hat } = frame;
  const c = Math.cos(delta);
  const v_inf_vec = math.add(
    math.add(
      math.multiply(x_hat, vinf * c * Math.cos(alpha)),
      math.multiply(y_hat, vinf * c * Math.sin(alpha))
    ),
    math.multiply(z_hat, vinf * Math.sin(delta))
  );
  return { v_inf_vec, v_out: math.add(v_pla, v_inf_vec) };
}

export class Mission {
  #m_planet_nums = [];
  #m_dates = [];
  #m_types = [];
  #m_is_auto_mode = [];
  #m_count = 0;

  #m_planet_pos = [];
  #m_planet_vel = [];

  #m_s_c_pos = [];
  #m_s_c_vel = [];

  #m_rp = []; // スイングバイの近点半径 [km] (Swingbyノードのみ意味を持つ)
  #m_beta = []; // スイングバイのb面内回転角 [rad] (Swingbyノードのみ意味を持つ)
  // 周回軌道の近点/遠点半径 [km]。周回軌道投入(Orbit)ノードだけが持ち、
  // 続く軌道脱出(Escape)ノードは同じ軌道から出るので投入側の値を共有する。
  #m_orbit_rp = [];
  #m_orbit_ra = [];
  #m_orbit_info = []; // 直近に計算された投入/脱出の結果 (get_orbit_info用)

  // 手動マヌーバの設計変数。打上げの手動モードと同じ (大きさと2つの角度)。
  #m_dsm_dv = []; // ΔVの大きさ [km/s]
  #m_dsm_alpha = []; // 方位角 [rad] (進行方向が0)
  #m_dsm_delta = []; // 仰角 [rad] (軌道面から法線向きが正)

  // 手動モードの軌道脱出パラメータ。打上げの手動モードとまったく同じ量
  // (天体を離れるときの|V∞|と2つの角度) だが、打上げが常にノード0の1つきり
  // なのに対し軌道脱出はいくつも置けるので、ノードごとの配列で持つ。
  #m_escape_vinf = [];
  #m_escape_alpha = [];
  #m_escape_delta = [];

  // 大気圏突入ノードの突入経路角 [rad] (水平から測り、降下方向が負) と計算結果
  #m_entry_gamma = [];
  #m_entry_info = [];

  // 小天体との出会い (フライバイ・ランデブー) の計算結果
  #m_encounter_info = [];

  // レグ (ノードiから次のノードへの区間) をランベールで解くときの設定。
  //   #m_leg_revs   太陽を何周してから着くか (0 = 直行)
  //   #m_leg_low    同じ周回数にある2つの解のどちらを採るか (true = 小さい軌道)
  // レグは出発側のノードが持つ。#m_leg_info には実際に使えた値を入れる
  // (指定した周回数が飛行時間的に無理なら直行に落ちるので、その顛末も含む)。
  #m_leg_revs = [];
  #m_leg_low = [];
  #m_leg_info = [];

  #m_swingby_info = []; // 直近に計算されたスイングバイ結果 (get_swingby_info用)
  #m_dsm_info = []; // 直近に計算されたDSM(マヌーバ)結果 (get_dsm_info用)
  #m_end_info = []; // 最終軌道ノードで到達した軌道 (get_end_info用)
  // 軌道上の節目(近日点など)に固定されているノードの、その節目の種別。
  // 固定されていれば、前後の時刻を動かしてもその節目に追従し続ける。
  #m_pinned_event = [];

  // 手動モードの打上げパラメータ (打上げは常にノード0なのでスカラで持つ)
  #m_launch_vinf = 3; // |V∞| [km/s]
  #m_launch_alpha = 0; // 方位角 [rad] (公転方向が0)
  #m_launch_delta = 0; // 仰角 [rad] (軌道面から北向きが正)

  #m_trajectory_arcs = [];

  // i は「天体を離れる」ノードの番号。既定の0は打上げ (常に先頭ノード)。
  // 軌道脱出 (周回軌道からの再出発) も天体を離れる瞬間という点で打上げと
  // 同じ形の量を持つので、同じ計算をノードを指定して使い回せる。
  get_v_inf(i = 0) {
    const v_inf = this.get_launch_v_inf_vec(i);
    return v_inf == undefined ? 0 : math.norm(v_inf);
  }

  // 天体を離れる瞬間の双曲線余剰速度ベクトル [km/s] (太陽中心慣性系)。
  // その天体の公転速度と、離れる瞬間の探査機速度の差。3Dビューの矢印表示に使う。
  get_launch_v_inf_vec(i = 0) {
    const v_pla = this.#m_planet_vel[i];
    const v_sc = this.#m_s_c_vel[i] != undefined ? this.#m_s_c_vel[i][0] : undefined;
    if (v_pla == undefined || v_sc == undefined) return undefined;
    return math.subtract(v_sc, v_pla);
  }

  // いまの出発軌道を launch_frame で測った |V∞| と2つの角度。
  // 手動モードでは設定値そのものになるが、自動モードでもランベール解から
  // 逆算できるので、どちらのモードでも打上げビューに同じ形で表示できる。
  // 軌道脱出には手動モードが無い(常に自動)ので、i≠0のときは逆算一択になる。
  get_launch_angles(i = 0) {
    // 手動モードでは、この3つがそのまま設計変数。ベクトルから逆算せずに
    // 持っている値を返す。V∞を0まで絞ると速度ベクトルからは向きが取り出せず、
    // 逆算に頼ると打上げビューが消えて、引き伸ばして戻せなくなってしまう。
    if (this.#m_types[i] === Sequence_Type.Launch && this.#m_is_auto_mode[i] === false) {
      return { vinf: this.#m_launch_vinf, alpha: this.#m_launch_alpha, delta: this.#m_launch_delta };
    }
    return this.#launch_angles_from_velocity(i);
  }

  // 出発速度から |V∞| と2つの角度を逆算する (自動モードの表示用)
  #launch_angles_from_velocity(i) {
    const v_inf = this.get_launch_v_inf_vec(i);
    const r_pla = this.#m_planet_pos[i];
    const v_pla = this.#m_planet_vel[i];
    if (v_inf == undefined || r_pla == undefined || v_pla == undefined) return undefined;

    const frame = launch_frame(r_pla, v_pla);
    if (frame == undefined) return undefined;
    const V = math.norm(v_inf);
    if (!(V > 0)) return undefined;

    return {
      vinf: V,
      delta: Math.asin(Math.max(-1, Math.min(1, math.dot(v_inf, frame.z_hat) / V))),
      alpha: Math.atan2(math.dot(v_inf, frame.y_hat), math.dot(v_inf, frame.x_hat)),
    };
  }

  // ミッション全体のΔVの合計 [km/s]。
  // 自動スイングバイの近点ΔV(パワード・フライバイ)、マヌーバノードのDSM ΔV
  // (MGA-1DSM)、周回軌道への投入/からの脱出ΔVを足し合わせる。
  get_total_dv() {
    let total = 0;
    for (let i = 0; i < this.#m_count; i++) {
      const sb = this.#m_swingby_info[i];
      if (sb && sb.dv_periapsis) total += sb.dv_periapsis;
      const dsm = this.#m_dsm_info[i];
      if (dsm && dsm.dv) total += dsm.dv;
      const orb = this.#m_orbit_info[i];
      if (orb && orb.dv > 0) total += orb.dv;
      const enc = this.#m_encounter_info[i];
      if (enc && enc.dv > 0) total += enc.dv;
    }
    return total;
  }

  /**
   * フライバイ・ランデブーの計算結果。
   * {kind, planet_num, v_rel_in, v_rel_out, dv_arrive, dv_depart, dv, terminal}
   */
  get_encounter_info(i) {
    return this.#m_encounter_info[i] ?? null;
  }

  // マヌーバ(DSM)ノードiに入ってくる軌道(前ノードの出発状態が描く円錐曲線)の
  // 軌道要素と、その基準時刻(前ノードの日付)を返す。
  // マウスドラッグでマヌーバ位置(=日付)を動かすのに使う。
  get_incoming_conic(i) {
    if (i <= 0 || i >= this.#m_count) return null;
    // 天体を持たないノード(マヌーバ・最終軌道)は、この軌道の上を滑って動かせる
    if (this.#m_types[i] !== Sequence_Type.Maneuver && this.#m_types[i] !== Sequence_Type.End) return null;
    const r = this.#m_s_c_pos[i - 1];
    const v = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][0] : undefined;
    if (r == undefined || v == undefined) return null;
    const par = ic2par(r, v, MU_SUN);
    if (!isFinite(par[0]) || !isFinite(par[1])) return null;
    return { par, epoch: this.#m_dates[i - 1] };
  }

  // 「DSMを実行しなかった場合」にそのまま流されていく軌道。
  //   マヌーバ(DSM)ノード          : そのマヌーバを打たずに流された場合
  //   手動のスイングバイ/打上げ    : 直後のDSMを打たずに流された場合
  //     (rp/betaやV∞を調整している最中に、DSM無しでどこへ行くかが見える)
  #coast_conic(i) {
    if (i < 0 || i >= this.#m_count) return null;
    const type = this.#m_types[i];
    // 最終軌道ノードでは「到達した軌道」そのものを1周分描く (未実行の軌道ではない)
    if (type === Sequence_Type.End) {
      const info = this.#m_end_info[i];
      return info == undefined ? null : { par: info.par, epoch: this.#m_dates[i] };
    }
    if (type === Sequence_Type.Maneuver) return this.get_incoming_conic(i);
    if ((type === Sequence_Type.Swingby || type === Sequence_Type.Launch) && !this.#m_is_auto_mode[i]) {
      // 直後に自動挿入されているマヌーバノードの「未実行時の軌道」を借りる
      return this.get_incoming_conic(i + 1);
    }
    return null;
  }

  // DSMを実行しなかった場合の軌道の描画点 (#coast_conic を参照)。
  get_coast_orbit(i) {
    const conic = this.#coast_conic(i);
    if (conic == null) return [];
    const par = conic.par;
    const anomalies = coast_anomalies(par);
    const pts = new Array(anomalies.length);
    for (let k = 0; k < anomalies.length; k++) {
      const { r } = get_planets_pos_E(par, anomalies[k]);
      pts[k] = new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU);
    }
    return pts;
  }

  /**
   * ノードiの時刻を動かせる範囲で、そのノードが乗る軌道上に現れる節目を返す。
   *
   * マヌーバ(DSM)は前ノードから出る軌道の上を滑って動くので、その軌道について
   * 「前ノード〜次ノード」= DSMを打てる範囲を見る。それ以外のノードは、
   * そこから次ノードまでのレグを見る。
   */
  get_node_events(i) {
    if (i < 0 || i >= this.#m_count) return [];
    if (this.#m_types[i] !== Sequence_Type.Maneuver) return this.get_leg_events(i);
    if (i - 1 < 0 || i + 1 >= this.#m_count) return [];

    const r0 = this.#m_s_c_pos[i - 1];
    const v0 = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][0] : undefined;
    return leg_events(r0, v0, this.#m_dates[i - 1], this.#m_dates[i + 1], MU_SUN);
  }

  /**
   * ノードiからi+1までのレグの間に通る近日点・遠日点・昇交点・降交点を返す。
   * 詳細は leg_events を参照。レグが成立していない場合は空配列。
   */
  get_leg_events(i) {
    if (i < 0 || i + 1 >= this.#m_count) return [];
    const r0 = this.#m_s_c_pos[i];
    const v0 = this.#m_s_c_vel[i] != undefined ? this.#m_s_c_vel[i][0] : undefined;
    return leg_events(r0, v0, this.#m_dates[i], this.#m_dates[i + 1], MU_SUN);
  }

  // マヌーバ(DSM)ノードiの直近の計算結果。マヌーバノードでない場合はnull。
  get_dsm_info(i) {
    return this.#m_dsm_info[i] ?? null;
  }

  // 最終軌道ノードで到達した太陽中心軌道 (#calc_end を参照)
  get_end_info(i) {
    return this.#m_end_info[i] ?? null;
  }

  // 指定した値だけで軌道が決まるノードか (= 目的地を持たなくても成立する)
  // 「自力では次の目的地に届かない節」。この後ろにはDSMのマヌーバノードが要る。
  //   手動の打上げ・スイングバイ・軌道脱出 … 大きさと向きを自分で決めるので
  //                                          届く保証が無い
  //   フライバイ                 … 無推力で通り過ぎるだけなので軌道を変えられない
  #is_manual_node(i) {
    const t = this.#m_types[i];
    if (t === Sequence_Type.Flyby) return true;
    return (
      (t === Sequence_Type.Launch || t === Sequence_Type.Swingby || t === Sequence_Type.Escape) &&
      !this.#m_is_auto_mode[i]
    );
  }

  /**
   * ノードiを最終軌道(ミッションの終端)にできるか。
   * 最後のノードで、かつ直前が手動モードのノード(またはそのDSM)のときだけ許す。
   * 自動モードは「次の天体までをランベールで解く」ので、目的地が無いと軌道が
   * 決まらない。手動モードなら上流の指定値だけで軌道が決まるので終われる。
   */
  can_end(i) {
    if (i <= 0 || i !== this.#m_count - 1) return false;
    if (this.#m_types[i] === Sequence_Type.End) return true;
    if (this.#is_manual_node(i - 1)) return true;
    // 手動モードに付いてくるDSMの並びは、最終軌道にする際に取り除かれる
    let k = i - 1;
    while (k >= 0 && this.#m_types[k] === Sequence_Type.Maneuver) k--;
    return k >= 0 && k < i - 1 && this.#is_manual_node(k);
  }

  // 自動モードに戻せるか。最終軌道が続いている間は目的地が無いので手動のみ。
  can_set_auto(i) {
    return !(i + 1 < this.#m_count && this.#m_types[i + 1] === Sequence_Type.End);
  }

  #calc_planet(i) {
    if (i < 0 || i >= this.#m_count) return;
    // 天体が未選択なら位置は無い。先に消しておかないと、以前ここに割り当てて
    // いた天体の位置が残ったままになり、#set_s_c 以降がそれを「まだ有効な
    // 位置」として使い続けてしまう (天体を外したのに軌道が繋がって見える)。
    this.#m_planet_pos[i] = undefined;
    this.#m_planet_vel[i] = undefined;
    if (this.#m_planet_nums[i] == -1) return;
    let elements = get_planet_elements(this.#m_dates[i], this.#m_planet_nums[i]);
    let { r, v } = get_planets_pos(elements);

    this.#m_planet_pos[i] = r;
    this.#m_planet_vel[i] = v;
  }

  // 入射V∞ベクトルを基準にした正規直交基底 (i_hat, j_hat, k_hat) を作る。
  // j_hat は天体の公転面(v_pla方向)を基準に取る(swingby()と同じ流儀)。
  #frame(v_inf_in_vec, v_inf_in, v_pla) {
    const i_hat = math.divide(v_inf_in_vec, v_inf_in);
    let j_hat = math.cross(i_hat, v_pla);
    let j_norm = math.norm(j_hat);
    if (j_norm < 1e-9) {
      const ref = Math.abs(i_hat[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
      j_hat = math.cross(i_hat, ref);
      j_norm = math.norm(j_hat);
    }
    j_hat = math.divide(j_hat, j_norm);
    const k_hat = math.cross(i_hat, j_hat);
    return { i_hat, j_hat, k_hat };
  }

  // 自動モード: 前後2本のランベール弧から「入射V∞」と「出射に必要なV∞」を求め、
  // 向きの差はスイングバイの幾何(rp, beta)で、大きさの差は近点でのΔV(パワード・
  // フライバイ)で埋めて軌道を厳密に接続する。rp・beta・近点ΔVは計算結果(表示用)
  // であり、軌道自体(#m_s_c_vel)はランベール解のまま変えない。
  #calc_swingby_auto(i) {
    this.#m_swingby_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const v_in = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][1] : undefined;
    const v_out = this.#m_s_c_vel[i] != undefined ? this.#m_s_c_vel[i][0] : undefined;
    const v_pla = this.#m_planet_vel[i];
    const n = this.#m_planet_nums[i];
    if (v_in == undefined || v_out == undefined || v_pla == undefined || n == undefined || n == -1) return;
    const mu_pla = planet_mu[n];
    if (mu_pla == undefined) return;

    const v_inf_in_vec = math.subtract(v_in, v_pla);
    const v_inf_in = math.norm(v_inf_in_vec);
    const v_inf_out_vec = math.subtract(v_out, v_pla);
    const v_inf_out = math.norm(v_inf_out_vec);
    if (v_inf_in < 1e-9 || v_inf_out < 1e-9) return;

    const { i_hat, j_hat, k_hat } = this.#frame(v_inf_in_vec, v_inf_in, v_pla);
    const out_hat = math.divide(v_inf_out_vec, v_inf_out);

    // 入射方向と出射に必要な方向のなす角 = 実現すべき曲げ角
    const cos_delta = Math.max(-1, Math.min(1, math.dot(i_hat, out_hat)));
    const delta = Math.acos(cos_delta);
    const beta = Math.atan2(math.dot(out_hat, k_hat), math.dot(out_hat, j_hat));

    // 必要な曲げ角deltaを実現するrpを解く (パワード・フライバイ)。
    // 近点で噴射する場合、入射側・出射側は別々の双曲線になり、それぞれ
    // 漸近線から近点まで asin(1/e) だけ曲がるので、全体の曲げ角は
    //   delta(rp) = asin(1/e_in(rp)) + asin(1/e_out(rp))
    //   e_in  = 1 + rp*v_inf_in^2/mu,  e_out = 1 + rp*v_inf_out^2/mu
    // delta(rp)はrpについて単調減少なので、二分法で解ける。
    const turn_at = (r) =>
      Math.asin(1 / (1 + (r * v_inf_in * v_inf_in) / mu_pla)) +
      Math.asin(1 / (1 + (r * v_inf_out * v_inf_out) / mu_pla));

    const rp_min = min_flyby_rp(n);
    let rp;
    let rp_clamped = false;

    if (delta <= 1e-9) {
      // 曲げ不要。安全な範囲で最も遠い(=影響の小さい)通過とみなす
      rp = undefined;
    } else if (turn_at(rp_min) <= delta) {
      // 下限まで寄せても曲げ足りない -> 大気等に突入しないよう下限でクランプする
      rp = rp_min;
      rp_clamped = true;
    } else {
      // 二分法。上限は曲げ角が十分小さくなるまで広げる
      let lo = rp_min;
      let hi = Math.max(rp_min * 2, 1);
      for (let k = 0; k < 200 && turn_at(hi) > delta; k++) hi *= 2;
      for (let k = 0; k < 100; k++) {
        const mid = 0.5 * (lo + hi);
        if (turn_at(mid) > delta) lo = mid;
        else hi = mid;
      }
      rp = 0.5 * (lo + hi);
    }

    // 近点ΔV。曲げ角が足りている場合、入射側と出射側の近点速度は同じ向き
    // (近点では速度は動径に垂直)なので単純な速さの差になる。
    // 下限クランプで曲げ足りない場合は、その不足分の角度だけ向きも変える必要が
    // あるため、余弦定理でベクトル差として求める(不足0なら上式に一致する)。
    let dv_periapsis = 0;
    let turn_deficit = 0;
    if (rp != undefined && rp > 0) {
      if (rp_clamped) turn_deficit = delta - turn_at(rp);
      const vp_in = Math.sqrt(v_inf_in * v_inf_in + (2 * mu_pla) / rp);
      const vp_out = Math.sqrt(v_inf_out * v_inf_out + (2 * mu_pla) / rp);
      dv_periapsis = Math.sqrt(
        vp_in * vp_in + vp_out * vp_out - 2 * vp_in * vp_out * Math.cos(turn_deficit)
      );
    }

    this.#m_rp[i] = rp;
    this.#m_beta[i] = beta;
    this.#m_swingby_info[i] = {
      v_inf_in,
      v_inf_out,
      delta,
      beta,
      rp,
      rp_min,
      rp_clamped,
      turn_deficit,
      dv_periapsis,
      i_hat,
      j_hat,
      k_hat,
      mode: "auto",
    };
  }

  // 手動モード (MGA-1DSM): ユーザーが指定したrp・betaで無推力フライバイし、
  // その後レグ途中の指定位置(eta)でDSM(深宇宙マヌーバ)を打って、そこから先を
  // ランベールで解いて次の天体へ正確に繋げる。
  //
  //   スイングバイ -> [eta の割合だけ2体伝播] -> DSM -> [ランベール] -> 次の天体
  //
  // フライバイ自体は無推力なので侵入速度と脱出速度の大きさは等しい。
  // 目的地への到達はDSMのΔVが担保する。設計変数は rp, beta, eta の3つ。
  #calc_swingby_manual(i) {
    this.#m_swingby_info[i] = undefined;
    this.#m_dsm_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const v_in = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][1] : undefined;
    const v_pla = this.#m_planet_vel[i];
    const n = this.#m_planet_nums[i];
    if (v_in == undefined || v_pla == undefined || n == undefined || n == -1) return;
    const mu_pla = planet_mu[n];
    if (mu_pla == undefined) return;

    // 大気・放射線帯を避けるため、rpは天体ごとの下限を下回れない
    const rp = Math.max(this.#m_rp[i] ?? min_flyby_rp(n), min_flyby_rp(n));
    const beta = this.#m_beta[i] ?? 0;

    let result;
    try {
      result = swingby(v_in, v_pla, rp, beta, mu_pla);
    } catch (e) {
      // v_inがほぼ0など、フライバイの向きを定義できない場合は前回の値を維持する
      return;
    }

    const { i_hat, j_hat, k_hat } = this.#frame(result.v_inf_in, result.v_inf, v_pla);
    this.#m_swingby_info[i] = {
      v_inf_in: result.v_inf,
      v_inf_out: result.v_inf,
      delta: result.delta,
      beta,
      rp,
      rp_min: min_flyby_rp(n),
      rp_clamped: rp > (this.#m_rp[i] ?? rp),
      turn_deficit: 0,
      dv_periapsis: 0, // 無推力フライバイなので近点ΔVは無い
      i_hat,
      j_hat,
      k_hat,
      mode: "manual",
    };

    // フライバイ直後の速度。ここから先はマヌーバノードが引き継ぐ
    // (到着速度(index 1)は #update_trajectory 側で伝播結果から補完される)
    this.#m_s_c_vel[i] = [result.v_out, undefined];
  }

  // 手動モードの打上げ: |V∞| と2つの角度で決めた出発速度をそのまま使う。
  // (角度の測り方は launch_velocity を参照)
  #calc_launch_manual(i) {
    const r_pla = this.#m_planet_pos[i];
    const v_pla = this.#m_planet_vel[i];
    if (r_pla == undefined || v_pla == undefined) return;

    const result = launch_velocity(
      r_pla,
      v_pla,
      this.#m_launch_vinf,
      this.#m_launch_alpha,
      this.#m_launch_delta
    );
    if (result == undefined) return;
    // 到着速度(index 1)は前レグが無いので使わない
    this.#m_s_c_vel[i] = [result.v_out, undefined];
  }

  // 自動モードでの出発速度から、手動モードの初期値(|V∞|と2つの角度)を取る。
  // 手動に切り替えた瞬間に軌道が飛ばないようにするため。
  #init_launch_manual_from_auto() {
    // まだ自動モードの状態で呼ばれるが、順番に頼らないよう逆算の側を直に使う
    const angles = this.#launch_angles_from_velocity(0);
    if (angles == undefined) return;
    this.#m_launch_vinf = angles.vinf;
    this.#m_launch_delta = angles.delta;
    this.#m_launch_alpha = angles.alpha;
  }

  // 手動モードの軌道脱出: 打上げの手動モードとまったく同じで、|V∞|と2つの
  // 角度で決めた速度でその天体を離れる。次の目的地へ届かせるのは、後ろに
  // 自動で入るマヌーバ(DSM)の役目。周回軌道から双曲線に乗り移るための
  // 近点ΔVは、自動のときと同じく #calc_orbit がこの速度から求める。
  #calc_escape_manual(i) {
    const r_pla = this.#m_planet_pos[i];
    const v_pla = this.#m_planet_vel[i];
    if (r_pla == undefined || v_pla == undefined) return;

    const result = launch_velocity(
      r_pla,
      v_pla,
      this.escape_vinf(i),
      this.escape_alpha(i),
      this.escape_delta(i)
    );
    if (result == undefined) return;
    // 到着速度(index 1)は #update_trajectory 側で伝播結果から補完される
    this.#m_s_c_vel[i] = [result.v_out, undefined];
    this.#calc_orbit(i);
  }

  // 軌道脱出を手動に切り替えたときの初期値。打上げと同じく、切り替えた瞬間に
  // 軌道が飛ばないよう、いまの自動モードの解から逆算した値を入れる。
  #init_escape_manual_from_auto(i) {
    const angles = this.#launch_angles_from_velocity(i);
    if (angles == undefined) return;
    this.#m_escape_vinf[i] = angles.vinf;
    this.#m_escape_delta[i] = angles.delta;
    this.#m_escape_alpha[i] = angles.alpha;
  }

  // マヌーバ(DSM)ノード: 天体ではなく深宇宙の一点。
  // 位置は前ノードの出発状態をこのノードの日付まで2体伝播して求め、
  // そこから次の天体までをランベールで解く。ΔVは
  //   (ランベールが要求する出発速度) - (伝播してきた到着速度)
  // MGA-1DSMではこのΔVが目的地への到達を担保する。
  #calc_maneuver(i) {
    this.#m_dsm_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const r_prev = this.#m_s_c_pos[i - 1];
    const v_prev = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][0] : undefined;
    if (r_prev == undefined || v_prev == undefined) return;

    const dt1 = (this.#m_dates[i] - this.#m_dates[i - 1]) * 86400;
    if (!(dt1 > 0)) return;

    // 1) 前ノードの出発状態をこのノードの日付まで伝播 -> DSM地点と到着速度
    const arrived = propagate(r_prev, v_prev, dt1, MU_SUN);
    if (arrived == undefined) return;
    this.#m_s_c_pos[i] = arrived.r;

    // 手動マヌーバ: 打上げの手動モードと同じく、進行方向を基準にした
    // (ΔV, 方位角, 仰角) で噴射する。ここから先はまた無推力で流れていき、
    // 目的地への到達は並びの最後の自動マヌーバが担保する。
    if (!this.#m_is_auto_mode[i]) {
      const applied = apply_impulse(
        arrived.r,
        arrived.v,
        this.dsm_dv(i),
        this.dsm_alpha(i),
        this.dsm_delta(i)
      );
      const v_after = applied != undefined ? applied.v_after : arrived.v;
      const dv_vec = applied != undefined ? applied.dv_vec : [0, 0, 0];
      this.#m_s_c_vel[i] = [v_after, undefined];
      this.#m_dsm_info[i] = {
        r: arrived.r,
        v_before: arrived.v,
        v_after,
        dv_vec,
        dv: math.norm(dv_vec),
        angles: { alpha: this.dsm_alpha(i), delta: this.dsm_delta(i) },
        mode: "manual",
      };
      return;
    }

    // 2) DSM地点から次の天体までをランベールで解く
    const r_target = this.#m_planet_pos[i + 1];
    const dt2 = (this.#m_dates[i + 1] - this.#m_dates[i]) * 86400;
    if (r_target == undefined || !(dt2 > 0)) return;

    let v_lam;
    try {
      v_lam = this.#solve_leg(i, arrived.r, r_target, dt2);
    } catch (e) {
      return;
    }
    if (v_lam == undefined || v_lam[0] == undefined) return;

    const dv_vec = math.subtract(v_lam[0], arrived.v);
    const dv = math.norm(dv_vec);

    this.#m_s_c_vel[i] = v_lam;
    this.#m_dsm_info[i] = {
      r: arrived.r,
      v_before: arrived.v,
      v_after: v_lam[0],
      dv_vec,
      dv,
      // 自動でも向きは決まっているので、手動と同じ形 (2角) でも読めるようにする
      angles: impulse_angles(arrived.r, arrived.v, dv_vec),
      mode: "auto",
    };
  }

  // 最終軌道ノード: 目的地を持たず、直前のノードの出発状態をこのノードの
  // 日付まで伝播するだけ。到達した太陽中心軌道そのものがミッションの成果になる。
  // (手動モードのノードの後にしか置けないので、軌道は上流の指定値だけで決まる)
  #calc_end(i) {
    this.#m_end_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const r_prev = this.#m_s_c_pos[i - 1];
    const v_prev = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][0] : undefined;
    if (r_prev == undefined || v_prev == undefined) return;

    const dt = (this.#m_dates[i] - this.#m_dates[i - 1]) * 86400;
    if (!(dt > 0)) return;
    const arrived = propagate(r_prev, v_prev, dt, MU_SUN);
    if (arrived == undefined) return;

    this.#m_s_c_pos[i] = arrived.r;
    // ここで終わりなので、出発速度は到着速度と同じ (加速しない)
    this.#m_s_c_vel[i] = [arrived.v, arrived.v];

    const par = ic2par(arrived.r, arrived.v, MU_SUN);
    const a = par[0];
    const e = par[1];
    if (!isFinite(a) || !isFinite(e)) return;

    this.#m_end_info[i] = {
      par,
      a,
      e,
      inc: par[2],
      periapsis: a * (1 - e), // 近日点距離 [km] (双曲線もa<0なので正になる)
      apoapsis: e < 1 ? a * (1 + e) : undefined, // 遠日点距離 [km]
      period: e < 1 ? get_peariod(a, MU_SUN) : undefined, // 公転周期 [s]
      c3: -MU_SUN / a, // 太陽に対するC3 [km^2/s^2]。正なら太陽系脱出
      escaping: e >= 1,
      r: arrived.r,
      v: arrived.v,
      r_norm: math.norm(arrived.r),
      speed: math.norm(arrived.v),
    };
  }

  // --- 大気圏突入 ---

  // 突入経路角の既定値。試料回収カプセルでよく使われる -8度あたりを採る
  // (はやぶさ -12度、スターダスト -8.2度、OSIRIS-REx -8.2度)。
  static #DEFAULT_ENTRY_GAMMA = (-8 * Math.PI) / 180;

  /** 大気圏突入ノードの突入経路角 [rad] (水平から測り、降下方向が負) */
  entry_gamma(i) {
    return this.#m_entry_gamma[i] ?? Mission.#DEFAULT_ENTRY_GAMMA;
  }

  set_entry_gamma(i, gamma) {
    // 水平飛行(0)は突入にならず、真下(-90度)は物理的に成立しても意味が無い。
    // どちらの端も避けて挟む。
    const lim = (89.9 * Math.PI) / 180;
    const g = Math.max(-lim, Math.min(-1e-4, gamma));
    this.#m_entry_gamma[i] = g;
    this.#recompute_all();
  }

  get_entry_info(i) {
    return this.#m_entry_info[i];
  }

  // 大気に入って終わりなので、後ろに節が続けられない = 最後の節でだけ選べる
  can_entry(i) {
    return i > 0 && i === this.#m_count - 1;
  }

  /**
   * 大気圏突入ノード: 入ってくるレグの到着速度から天体に対するV∞を取り、
   * 突入インターフェースでの速度と、そこへ至る双曲線軌道を求める。
   * 推進を使わないのでΔVは発生しない (総ΔVにも入らない)。
   */
  #calc_entry(i) {
    this.#m_entry_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const v_in = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][1] : undefined;
    const v_pla = this.#m_planet_vel[i];
    const n = this.#m_planet_nums[i];
    if (v_in == undefined || v_pla == undefined || n == undefined || n < 0) return;
    const mu = planet_mu[n];
    const r_e = entry_interface_radius(n);
    if (mu == undefined || r_e == undefined) return;

    const v_inf_vec = math.subtract(v_in, v_pla);
    const v_inf = math.norm(v_inf_vec);
    const gamma = this.entry_gamma(i);
    const conic = entry_conic(mu, v_inf, r_e, gamma);
    if (conic == undefined) return;

    // 3Dビューを実際の向き (天体の公転方向・天の北極) に合わせるための基準系。
    // スイングバイと同じ取り方にして、2つのビューで向きの意味が揃うようにする。
    const frame = v_inf > 1e-9 ? this.#frame(v_inf_vec, v_inf, v_pla) : undefined;

    this.#m_entry_info[i] = {
      planet_num: n,
      v_inf,
      v_inf_vec,
      planet_vel: v_pla,
      planet_pos: this.#m_planet_pos[i],
      i_hat: frame ? frame.i_hat : undefined,
      j_hat: frame ? frame.j_hat : undefined,
      k_hat: frame ? frame.k_hat : undefined,
      gamma,
      r_entry: r_e,
      altitude: ENTRY_ALTITUDE[n],
      radius: planet_radius[n],
      v_entry: conic.v_e,
      e: conic.e,
      p: conic.p,
      nu_entry: conic.nu_e,
      rp: conic.rp,
    };
  }

  // --- 周回軌道投入 / 軌道脱出 ---

  // その節が使う周回軌道を持っているノードの番号。
  // 投入ノードは自分自身。軌道脱出ノードは「直前の投入ノードと同じ軌道から出る」
  // ので投入側を指す (同じ軌道を2箇所で別々に持つと食い違うため共有する)。
  #parking_source(i) {
    if (this.#m_types[i] === Sequence_Type.Orbit) return i;
    if (this.#m_types[i] === Sequence_Type.Escape) {
      if (i > 0 && this.#m_types[i - 1] === Sequence_Type.Orbit) return i - 1;
    }
    return undefined;
  }

  /**
   * ノードiで許される周回軌道の範囲 [km]。
   *   近点: 大気・放射線帯を避ける下限 (スイングバイと同じ)
   *   遠点: ヒル半径の半分 (それより外は太陽の摂動で軌道を保てない)
   */
  orbit_limits(i) {
    const src = this.#parking_source(i);
    if (src == undefined) return undefined;
    const n = this.#m_planet_nums[src];
    if (n == undefined || n < 0) return undefined;
    const mu = planet_mu[n];
    const rp_min = min_flyby_rp(n);
    if (mu == undefined || rp_min == undefined) return undefined;

    const r_pla = this.#m_planet_pos[src];
    const hill = r_pla != undefined ? hill_radius(mu, math.norm(r_pla)) : undefined;
    return {
      planet_num: n,
      mu,
      radius: planet_radius[n],
      rp_min,
      ra_max: hill != undefined ? hill * MAX_PARKING_RA_HILL : undefined,
      hill,
    };
  }

  // 未設定なら既定の周回軌道を返す
  orbit_rp(i) {
    const src = this.#parking_source(i);
    if (src == undefined) return undefined;
    const lim = this.orbit_limits(i);
    if (lim == undefined) return this.#m_orbit_rp[src];
    return Math.max(this.#m_orbit_rp[src] ?? lim.rp_min, lim.rp_min);
  }

  orbit_ra(i) {
    const src = this.#parking_source(i);
    if (src == undefined) return undefined;
    const lim = this.orbit_limits(i);
    const rp = this.orbit_rp(i);
    if (lim == undefined) return this.#m_orbit_ra[src];
    let ra = this.#m_orbit_ra[src] ?? lim.radius * DEFAULT_PARKING_RA_FACTOR;
    if (lim.ra_max != undefined) ra = Math.min(ra, lim.ra_max);
    return Math.max(ra, rp);
  }

  set_orbit_rp(i, rp) {
    const src = this.#parking_source(i);
    if (src == undefined) return;
    const lim = this.orbit_limits(i);
    let v = lim != undefined ? Math.max(rp, lim.rp_min) : rp;
    // 近点が遠点を追い越したら、遠点も一緒に押し上げて円軌道で止める
    if (lim != undefined && lim.ra_max != undefined) v = Math.min(v, lim.ra_max);
    this.#m_orbit_rp[src] = v;
    if (this.#m_orbit_ra[src] != undefined && this.#m_orbit_ra[src] < v) this.#m_orbit_ra[src] = v;
    this.#recompute_all();
  }

  set_orbit_ra(i, ra) {
    const src = this.#parking_source(i);
    if (src == undefined) return;
    const lim = this.orbit_limits(i);
    const rp = this.orbit_rp(i);
    let v = Math.max(ra, rp); // 遠点は近点より内側にはできない
    if (lim != undefined && lim.ra_max != undefined) v = Math.min(v, lim.ra_max);
    this.#m_orbit_ra[src] = v;
    this.#recompute_all();
  }

  get_orbit_info(i) {
    return this.#m_orbit_info[i];
  }

  // 軌道脱出は「直前が同じ天体の周回軌道投入」のときにだけ意味を持つ
  can_escape(i) {
    return i > 0 && this.#m_types[i - 1] === Sequence_Type.Orbit;
  }

  /** 再出発 (ランデブーした天体から飛び立つ節) が置けるか */
  can_depart(i) {
    return i > 0 && this.#m_types[i - 1] === Sequence_Type.Rendezvous;
  }

  /**
   * 周回軌道投入 / 軌道脱出のΔVを求める。
   *
   * 投入: 直前のレグの到着速度からV∞を取り、近点で減速して楕円に入る。
   *       捕獲後は天体に束縛されるので、太陽中心では天体と一緒に動く
   *       (=次のレグは天体の公転軌道をなぞる「滞在」になる)。
   * 脱出: 次のレグ(ランベール解)の出発速度からV∞を取り、近点で加速して出る。
   *
   * どちらも近点接線噴射なので、ΔVは向きや位相に依らない(定義部の説明を参照)。
   */
  /**
   * フライバイ・ランデブーの費用を計算する (小天体との出会い)。
   *
   * 小惑星や彗星の重力は、スイングバイに使えるほどではない (ケレスでさえ
   * 曲げ角は1度に満たない)。だから速度を変えるぶんは全部自前のΔVになる。
   *
   *   フライバイ   通り過ぎるだけ。入ってきた速度と出ていく速度の差を払う
   *   ランデブー   天体に速度を合わせる。着くときに |v_in - v_天体|、
   *                その先へ向かうならさらに |v_out - v_天体| が要る
   *                (小天体には「軌道脱出」に当たる節が無いので、到着と出発を
   *                 この1つの節でまとめて持つ)
   */
  /**
   * レグ (ノードiから次まで) をランベールで解く。
   *
   * 指定された周回数で解けないときは直行 (0周) に落とす。日付を動かすだけで
   * 簡単に「その周回数には短すぎる」側へ入るので、ここで落としておかないと
   * 軌道が消えてミッションが壊れて見える。落としたことは #m_leg_info に残し、
   * 操作パネルで断る。
   *
   * @returns {[number[], number[]]|undefined} [出発速度, 到着速度]
   */
  #solve_leg(i, r1, r2, tof) {
    const wanted = this.#m_leg_revs[i] ?? 0;
    const low = this.#m_leg_low[i] !== false;
    const limit = lambert_rev_limit(r1, r2, tof);

    const attempt = (revs) => {
      try {
        const v = lambert_probrem(MU_SUN, r1, r2, tof, revs, true, low);
        return v && v[0] && isFinite(v[0][0]) ? v : undefined;
      } catch (e) {
        return undefined;
      }
    };

    let used = Math.min(wanted, limit);
    let v_lam = attempt(used);
    // 境界のすぐ手前では上限が1多く出ることがあるので、落として解き直す
    while (v_lam == undefined && used > 0) {
      used -= 1;
      v_lam = attempt(used);
    }

    // どんな軌道で行くことになったか (遠日点で大きさが分かる)
    let aphelion;
    if (v_lam != undefined) {
      const par = ic2par(r1, v_lam[0], MU_SUN);
      if (par != undefined && par[0] > 0 && par[1] < 1) aphelion = par[0] * (1 + par[1]);
    }

    this.#m_leg_info[i] = {
      revs: used,
      revs_wanted: wanted,
      low_path: low,
      max_revs: limit,
      tof,
      aphelion, // [km]
      // 指定どおりに解けなかったか (パネルで断るため)
      fallback: used !== wanted,
    };
    return v_lam;
  }

  /**
   * 同じ周回数にある2つの解の下見。どちらを選ぶかは軌道の大きさで決めたいので、
   * 両方を解いて遠日点を返す (1回20マイクロ秒程度なので、表示のたびに解いてよい)。
   *
   * @returns {{low: number|undefined, high: number|undefined}} 遠日点 [km]
   */
  leg_branch_preview(i) {
    const out = { low: undefined, high: undefined };
    if (!this.leg_is_lambert(i)) return out;
    const revs = this.#m_leg_revs[i] ?? 0;
    if (revs <= 0) return out;

    const r1 = this.#m_s_c_pos[i];
    const r2 = this.#m_s_c_pos[i + 1] ?? this.#m_planet_pos[i + 1];
    const tof = (this.#m_dates[i + 1] - this.#m_dates[i]) * 86400;
    if (r1 == undefined || r2 == undefined || !(tof > 0)) return out;

    for (const low of [true, false]) {
      try {
        const v = lambert_probrem(MU_SUN, r1, r2, tof, revs, true, low);
        if (!v || !v[0]) continue;
        const par = ic2par(r1, v[0], MU_SUN);
        if (par != undefined && par[0] > 0 && par[1] < 1) out[low ? "low" : "high"] = par[0] * (1 + par[1]);
      } catch (e) {
        // その分枝は無い
      }
    }
    return out;
  }

  #calc_encounter(i) {
    this.#m_encounter_info[i] = undefined;
    const type = this.#m_types[i];
    const n = this.#m_planet_nums[i];
    const v_pla = this.#m_planet_vel[i];
    if (n == undefined || n === -1 || v_pla == undefined) return;

    const v_in = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][1] : undefined;

    if (type === Sequence_Type.Rendezvous) {
      // 天体に速度を合わせる。その先は天体と一緒に進むので、出ていく速度は
      // 天体の速度で固定する (周回軌道投入とまったく同じ扱い)。
      // 次の目的地へ向かうぶんのΔVは、後ろに続く「再出発」の節が持つ。
      this.#m_s_c_vel[i] = [v_pla];
    } else if (type === Sequence_Type.Flyby) {
      // フライバイは無推力。入ってきた速度のまま通り過ぎる。
      // つまり出ていく軌道は入ってきた軌道の続きで、こちらから選べない。
      // 次の目的地へ届かせるのは、後ろに入るDSMの役目 (手動スイングバイと同じ)
      if (v_in != undefined) this.#m_s_c_vel[i] = [v_in];
    }
    // 再出発は軌道がランベール解のまま (出ていく向きは次の目的地が決める)

    const v_out = this.#m_s_c_vel[i] != undefined ? this.#m_s_c_vel[i][0] : undefined;
    const rel = (v) => (v == undefined ? undefined : math.norm(math.subtract(v, v_pla)));
    const v_rel_in = rel(v_in);
    const v_rel_out = rel(v_out);

    let dv = 0;
    if (type === Sequence_Type.Rendezvous) dv = v_rel_in ?? 0; // 到着で速度を合わせる
    else if (type === Sequence_Type.Departure) dv = v_rel_out ?? 0; // 出発で振り切る

    this.#m_encounter_info[i] = {
      kind:
        type === Sequence_Type.Rendezvous ? "rendezvous" : type === Sequence_Type.Departure ? "departure" : "flyby",
      planet_num: n,
      v_rel_in, // 天体に対する相対速度 (フライバイの通過の速さ)
      v_rel_out,
      dv, // フライバイは常に0
      // 到着だけで終わる節か (この先が無い)
      terminal: i + 1 >= this.#m_count,
    };
  }

  #calc_orbit(i) {
    this.#m_orbit_info[i] = undefined;
    const type = this.#m_types[i];
    const is_insert = type === Sequence_Type.Orbit;
    const v_pla = this.#m_planet_vel[i];
    const n = this.#m_planet_nums[i];
    const mu = n != undefined && n >= 0 ? planet_mu[n] : undefined;

    // 投入したら天体と一緒に公転する。速度を確定させるのはΔVが出せない
    // ときも同じ (でないと軌道が繋がらなくなる)。
    if (is_insert && v_pla != undefined) this.#m_s_c_vel[i] = [v_pla];

    if (mu == undefined || v_pla == undefined) return;

    // 投入は「入ってくる速度」、脱出は「出ていく速度」を見る
    const v_sc = is_insert
      ? this.#m_s_c_vel[i - 1] != undefined
        ? this.#m_s_c_vel[i - 1][1]
        : undefined
      : this.#m_s_c_vel[i] != undefined
      ? this.#m_s_c_vel[i][0]
      : undefined;
    if (v_sc == undefined) return;

    const v_inf = math.norm(math.subtract(v_sc, v_pla));
    const rp = this.orbit_rp(i);
    const ra = this.orbit_ra(i);
    const lim = this.orbit_limits(i);
    if (rp == undefined || ra == undefined) return;

    const dv = parking_orbit_dv(mu, v_inf, rp, ra);
    const a = (rp + ra) / 2;

    this.#m_orbit_info[i] = {
      kind: is_insert ? "insert" : "escape",
      planet_num: n,
      v_inf,
      rp,
      ra,
      a,
      e: (ra - rp) / (ra + rp),
      period: get_peariod(a, mu), // 周回周期 [s]
      v_periapsis_hyp: Math.sqrt(v_inf * v_inf + (2 * mu) / rp),
      v_periapsis_orbit: periapsis_speed(mu, rp, ra),
      // 遠点を無限遠に取った場合(=放物線捕獲)の下限。これ以上は安くならない
      dv_min: parking_orbit_dv(mu, v_inf, rp, Infinity),
      ra_max: lim != undefined ? lim.ra_max : undefined,
      ra_clamped: lim != undefined && lim.ra_max != undefined && ra >= lim.ra_max * (1 - 1e-9),
      dv,
    };
  }

  #set_s_c(i) {
    if (i < 0 || i >= this.#m_count) return;

    // 種別ごとの計算結果は、その種別のときにしか作り直されない。消さずにおくと
    // 種別を変えたあとも前の結果が残り、総ΔVに二重に乗ってしまう
    // (スイングバイをやめたのに近点ΔVが計上され続ける、など)。
    this.#m_swingby_info[i] = undefined;
    this.#m_orbit_info[i] = undefined;
    this.#m_entry_info[i] = undefined;
    this.#m_encounter_info[i] = undefined;
    this.#m_dsm_info[i] = undefined;
    this.#m_end_info[i] = undefined;

    if (this.#m_dates[i] == undefined) return;

    // マヌーバ(DSM)ノードは天体上ではなく深宇宙の一点。位置も伝播で求めるので
    // 天体位置の存在チェックより先に処理する。
    if (this.#m_types[i] === Sequence_Type.Maneuver) {
      this.#calc_maneuver(i);
      return;
    }

    // 最終軌道ノードも天体を持たない (伝播した先がそのまま到達点)
    if (this.#m_types[i] === Sequence_Type.End) {
      this.#calc_end(i);
      return;
    }

    if (this.#m_planet_pos[i] == undefined) return;
    this.#m_s_c_pos[i] = this.#m_planet_pos[i];

    // 大気圏突入: 大気に入って終わりなので出発速度は無い。突入条件だけ計算する。
    if (this.#m_types[i] === Sequence_Type.Entry) {
      this.#calc_entry(i);
      return;
    }

    // 周回軌道投入: 捕獲されるとその先は天体と一緒に公転するので、
    // ランベールで次の目的地へ向かわせてはいけない。#calc_orbit が
    // 出発速度を天体の公転速度に固定する (= 次のレグが「滞在」になる)。
    if (this.#m_types[i] === Sequence_Type.Orbit) {
      this.#calc_orbit(i);
      return;
    }

    // フライバイ: 無推力で通り過ぎるだけなので、次の目的地をランベールで
    // 狙うことはできない (狙えるなら、それはもうΔVを使っている)。
    // 入ってきた軌道の続きをそのまま飛ぶ。
    if (this.#m_types[i] === Sequence_Type.Flyby) {
      this.#calc_encounter(i);
      return;
    }

    // ランデブー: 天体に速度を合わせてそのまま張り付く。次へ向かうのは
    // 後ろに続く「再出発」の役目 (周回軌道投入と軌道脱出の関係と同じ)
    if (this.#m_types[i] === Sequence_Type.Rendezvous) {
      this.#calc_encounter(i);
      return;
    }

    const is_swingby = this.#m_types[i] === Sequence_Type.Swingby;

    // 手動モードの打上げ(MGA-1DSM): ランベールを使わず、指定した|V∞|と2つの
    // 角度で飛び出すだけ。目的地への到達は直後のマヌーバノードが担保する。
    if (this.#m_types[i] === Sequence_Type.Launch && !this.#m_is_auto_mode[i]) {
      this.#calc_launch_manual(i);
      return;
    }

    // 手動モードの軌道脱出: 打上げの手動モードと同じく、指定した|V∞|と2つの
    // 角度でその天体を離れる。次の天体への到達は直後のマヌーバノードが担保する。
    if (this.#m_types[i] === Sequence_Type.Escape && !this.#m_is_auto_mode[i]) {
      this.#calc_escape_manual(i);
      return;
    }

    if (is_swingby && !this.#m_is_auto_mode[i]) {
      // 手動スイングバイ(MGA-1DSM): ランベールを使わず、指定したrp/betaで曲げるだけ。
      // 目的地への到達は直後のマヌーバノードのΔVが担保する。
      this.#calc_swingby_manual(i);
      return;
    }

    if (this.#m_is_auto_mode[i]) {
      // 先に消しておく。次の目的地が無い(天体未選択・末尾など)ときや
      // ランベールが解けなかったときにここを素通りすると、前に解けていた
      // ときの出発速度が残ったままになり、#update_trajectory が それを使って
      // (もう無いはずの)行き先への軌道を描き続けてしまう。
      this.#m_s_c_vel[i] = undefined;
      if (this.#m_planet_pos[i + 1] != undefined && this.#m_dates[i] != undefined) {
        this.#m_s_c_pos[i + 1] = this.#m_planet_pos[i + 1];
        let time_diff = this.#m_dates[i + 1] - this.#m_dates[i];
        const v_lam = this.#solve_leg(i, this.#m_s_c_pos[i], this.#m_s_c_pos[i + 1], time_diff * 86400);
        if (v_lam != undefined) this.#m_s_c_vel[i] = v_lam;
      }
      if (is_swingby) {
        // 自動スイングバイ: 軌道はランベール解のまま、rp/beta/近点ΔVを診断情報として計算する
        this.#calc_swingby_auto(i);
      }
      // 再出発: 軌道はランベール解のまま、天体に張り付いた状態から
      // その速度に乗るためのΔVを計算する (軌道脱出と同じ立ち位置)
      if (this.#m_types[i] === Sequence_Type.Departure) this.#calc_encounter(i);
      // 軌道脱出: 軌道はランベール解のまま (出発の向き・大きさは次の目的地が決める)。
      // 周回軌道からその出発速度に乗るための近点ΔVを計算する。
      if (this.#m_types[i] === Sequence_Type.Escape) this.#calc_orbit(i);
    }
  }

  #update_trajectory(i) {
    if (i < 0 || i >= this.#m_count) return;
    // 既定は「レグ無し」。これを解けたときだけ下で上書きする。
    // 先に消しておかないと、ノードを削除して最後尾になったノードや、
    // 位置/速度が求まらなくなったノードで、以前解けていたときの軌道が
    // 太陽系ビューに残ってしまう (#m_trajectory_arcsは#remove_nodeで
    // 添字を詰めるだけで、中身の再計算はここでしかしないため)。
    this.#m_trajectory_arcs[i] = undefined;
    if (this.#m_s_c_pos[i] == undefined || this.#m_s_c_vel[i] == undefined) return;

    // 次ノードが天体とは限らない(マヌーバノードは深宇宙の一点)ので、
    // 天体速度の有無ではなく日付の有無でレグの成立を判定する
    if (i + 1 < this.#m_count && this.#m_dates[i + 1] != undefined) {
      let par = ic2par(this.#m_s_c_pos[i], this.#m_s_c_vel[i][0], MU_SUN);
      let dt = (this.#m_dates[i + 1] - this.#m_dates[i]) * 86400;
      let E_0 = par[5];
      let M_0 = E2M(E_0, par[1]);
      let dM = (dt / get_peariod(par[0], MU_SUN)) * 2 * Math.PI;
      let M_1 = M_0 + dM;
      let E_1 = solve_kepler(par[1], M_1);

      // 多周回のレグは同じ楕円を何周もするので、点数も周回数ぶん増やす
      // (100点のまま2周させると、1周あたり50点になって折れ線が目立つ)
      const revs = this.#m_leg_info[i] != undefined ? this.#m_leg_info[i].revs : 0;
      const N = 100 * (1 + revs);

      let p = [];
      let v_end;
      for (let j = 0; j < N; j++) {
        let { r, v } = get_planets_pos_E(par, E_0 + ((E_1 - E_0) * j) / (N - 1));
        p.push(new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU));
        if (j === N - 1) v_end = v;
      }
      this.#m_trajectory_arcs[i] = p;

      // ランベールで解いた場合は既に厳密な到着速度(index 1)が入っているので上書きしない。
      // スイングバイ由来の出発速度など到着速度が未確定(=着地点が惑星と一致する保証がない)
      // 場合のみ、実際に伝播した先の速度を補完する(=次のスイングバイの入射速度として使う)。
      if (this.#m_s_c_vel[i][1] == undefined) {
        this.#m_s_c_vel[i][1] = v_end;
      }
    }
  }

  // 日付・惑星割当・種別・スイングバイパラメータのいずれかが変わったときに、
  // シーケンス全体を先頭から再計算する。スイングバイは前レグの到着速度に
  // 依存するため、隣接ノードだけでなく後続ノードまで影響が連鎖しうる。
  // ノード数はたかが知れているので、都度全体を計算し直しても軽い。
  // 前提が崩れた節を普通の節に戻す状態の正規化 (先頭を必ず打上げにするのと同じ)。
  //   軌道脱出: 直前の周回軌道投入と同じ天体の、同じ軌道から出る節。天体も揃える
  //   大気圏突入: 大気に入って終わりなので、後ろに節が続いていたら成立しない
  #normalize_types() {
    for (let i = 0; i < this.#m_count; i++) {
      if (this.#m_types[i] === Sequence_Type.Escape) {
        if (!this.can_escape(i)) {
          this.#m_types[i] = Sequence_Type.None;
          continue;
        }
        this.#m_planet_nums[i] = this.#m_planet_nums[i - 1];
      } else if (this.#m_types[i] === Sequence_Type.Departure) {
        // 再出発は、直前のランデブーと同じ天体から飛び立つ節
        if (!this.can_depart(i)) {
          this.#m_types[i] = Sequence_Type.None;
          continue;
        }
        this.#m_planet_nums[i] = this.#m_planet_nums[i - 1];
      } else if (this.#m_types[i] === Sequence_Type.Entry && !this.can_entry(i)) {
        this.#m_types[i] = Sequence_Type.None;
      }
    }
  }

  #recompute_all() {
    this.#normalize_types();
    this.#normalize_maneuvers();

    // set_s_c は i+1 の天体位置(ランベール用)を必要とするため、天体の位置・速度は
    // 先に全ノード分計算しておく。
    for (let i = 0; i < this.#m_count; i++) this.#calc_planet(i);

    // その後、i=0から順に「前レグの到着速度を確定させる(update_trajectory) →
    // このノードの出発速度を決める(set_s_c)」を繰り返す。スイングバイの出発速度は
    // 前レグの到着速度に依存するため、この順序を崩すと未確定のまま参照してしまう。
    for (let i = 0; i < this.#m_count; i++) {
      // 節目に固定されているノードは、上流(i-1まで)が確定したこの時点で
      // 日付を追従させる。レグの弧を張る update_trajectory より先に行う。
      this.#apply_pinned_event(i);
      if (i > 0) this.#update_trajectory(i - 1);
      this.#set_s_c(i);
    }
    // 最後尾のノードは出ていくレグを持たない (update_trajectory(i)はi+1が
    // あって初めて呼ばれる) ので、上のループでは触れない。以前ここが
    // 最後尾でなかったとき(=末尾のノードを削除したとき)の軌道が残らないよう、
    // 明示的に空にしておく。
    if (this.#m_count > 0) this.#m_trajectory_arcs[this.#m_count - 1] = undefined;
  }

  // 前後のノードとの最小間隔を守る位置に日付を切り詰める
  #clamp_date(i, date) {
    if (i != 0 && date - this.#m_dates[i - 1] < MIN_NODE_GAP) return this.#m_dates[i - 1] + MIN_NODE_GAP;
    if (i != this.#m_count - 1 && this.#m_dates[i + 1] - date < MIN_NODE_GAP) {
      return this.#m_dates[i + 1] - MIN_NODE_GAP;
    }
    return date;
  }

  // 節目に固定されているノードの日付を、いまの軌道での節目の時刻に合わせる。
  // 前後のノードに阻まれてそこまで動かせない場合や、その節目を通らなくなった
  // 場合は固定を解除し、日付はこれまで通り前後の間隔で切り詰める。
  #apply_pinned_event(i) {
    const type = this.#m_pinned_event[i];
    if (type == undefined) return;

    // 固定できるのは、決まった軌道の上を滑って動けるマヌーバ(DSM)だけ
    if (this.#m_types[i] !== Sequence_Type.Maneuver || i - 1 < 0 || i + 1 >= this.#m_count) {
      this.#m_pinned_event[i] = undefined;
      return;
    }

    const r0 = this.#m_s_c_pos[i - 1];
    const v0 = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][0] : undefined;
    const t_prev = this.#m_dates[i - 1];
    const t_next = this.#m_dates[i + 1];
    if (r0 == undefined || v0 == undefined || t_prev == undefined || t_next == undefined) return;

    const hits = leg_events(r0, v0, t_prev, t_next, MU_SUN).filter((e) => e.type === type);
    if (hits.length === 0) {
      // その節目を通らなくなった
      this.#m_pinned_event[i] = undefined;
      this.#m_dates[i] = this.#clamp_date(i, this.#m_dates[i]);
      return;
    }

    // 楕円で複数回通る場合は、いまの日付にいちばん近いものを選ぶ
    const now = this.#m_dates[i];
    const target = hits.reduce((a, b) => (Math.abs(b.date - now) < Math.abs(a.date - now) ? b : a)).date;
    const clamped = this.#clamp_date(i, target);
    // 節目まで動かしきれなかった = レンジから外れた -> 固定を外して切り詰めるだけ
    if (Math.abs(clamped - target) > 1e-9) this.#m_pinned_event[i] = undefined;
    this.#m_dates[i] = clamped;
  }

  /**
   * ノードiを軌道上の節目(Leg_Eventの種別)に固定する。nullで固定を解除。
   * 固定されている間は、前後のノードの時刻を変えてもその節目に追従する。
   */
  set_pinned_event(i, type) {
    if (i < 0 || i >= this.#m_count) return;
    this.#m_pinned_event[i] = type ?? undefined;
    this.#recompute_all();
  }

  // ノードiが固定されている節目の種別。固定されていなければnull。
  pinned_event(i) {
    return this.#m_pinned_event[i] ?? null;
  }

  get_trajectory(i) {
    if (this.#m_trajectory_arcs[i] == undefined) return [];
    return this.#m_trajectory_arcs[i];
  }

  get_s_c_pos(i) {
    return this.#m_s_c_pos[i];
  }

  // スイングバイノードiの直近の計算結果を返す。
  // 自動: { v_inf_in, v_inf_out, delta[曲げ角], beta, rp, dv_periapsis[近点ΔV], mode:"auto" }
  // 手動: { v_inf_in, v_inf_out, v_out, delta, e, beta, dv_periapsis:0, mode:"manual" }
  // Swingbyノードでない、または計算できていない場合はnull。
  get_swingby_info(i) {
    return this.#m_swingby_info[i] ?? null;
  }

  /* --- レグ (ノードiから次のノードまでの区間) --- */

  /** そのレグをランベールで解いているか (＝周回数を選べるか) */
  leg_is_lambert(i) {
    if (i < 0 || i + 1 >= this.#m_count) return false;
    if (this.#m_dates[i] == undefined || this.#m_dates[i + 1] == undefined) return false;
    const t = this.#m_types[i];
    if (t === Sequence_Type.Maneuver) return true; // DSMから次の天体まで
    if (
      t === Sequence_Type.Orbit ||
      t === Sequence_Type.Entry ||
      t === Sequence_Type.End ||
      t === Sequence_Type.Flyby ||
      t === Sequence_Type.Rendezvous
    ) {
      return false; // 天体に留まる / 無推力で通り過ぎる節は、次を狙っていない
    }
    return !!this.#m_is_auto_mode[i];
  }

  leg_revs(i) {
    return this.#m_leg_revs[i] ?? 0;
  }

  set_leg_revs(i, revs) {
    if (i < 0 || i >= this.#m_count) return;
    this.#m_leg_revs[i] = Math.max(0, Math.round(revs) || 0);
    this.#recompute_all();
  }

  leg_low_path(i) {
    return this.#m_leg_low[i] !== false;
  }

  set_leg_low_path(i, low) {
    if (i < 0 || i >= this.#m_count) return;
    this.#m_leg_low[i] = !!low;
    this.#recompute_all();
  }

  /** 直近に解いたレグの顛末 {revs, revs_wanted, low_path, max_revs, tof, fallback} */
  get_leg_info(i) {
    return this.#m_leg_info[i] ?? null;
  }

  /** そのレグで指定の周回数に必要な最短飛行時間 [日] (解けなければ undefined) */
  leg_min_days(i, revs) {
    if (revs <= 0) return 0;
    const r1 = this.#m_s_c_pos[i];
    const r2 = this.#m_s_c_pos[i + 1] ?? this.#m_planet_pos[i + 1];
    if (r1 == undefined || r2 == undefined) return undefined;
    const tof = lambert_min_tof(r1, r2, revs);
    return tof == undefined ? undefined : tof / 86400;
  }

  planet_num(i) {
    if (i < 0 || i >= this.#m_count) return -1;
    return this.#m_planet_nums[i];
  }

  /**
   * index i から dir (+1|-1) 方向へ、天体を持つノードが見つかるまで辿る。
   * マヌーバ(DSM)は深宇宙の一点で天体を持たないので、1レグに複数繋がって
   * いると隣のノードだけを見ても天体に辿り着けないことがある
   * (例: 打上げ→マヌーバ→マヌーバ→スイングバイ)。見つからなければ -1。
   */
  nearest_planet(i, dir) {
    for (let k = i; k >= 0 && k < this.#m_count; k += dir) {
      if (this.#m_planet_nums[k] != -1) return this.#m_planet_nums[k];
    }
    return -1;
  }

  date(i) {
    return this.#m_dates[i];
  }

  type(i) {
    return this.#m_types[i];
  }

  is_auto_mode(i) {
    return this.#m_is_auto_mode[i];
  }

  rp(i) {
    const n = this.#m_planet_nums[i];
    if (n == undefined || n == -1) return this.#m_rp[i];
    return this.#m_rp[i] ?? min_flyby_rp(n);
  }

  // 天体ごとに許容される最小の近点半径 [km] (大気・放射線帯の回避)
  min_rp(i) {
    const n = this.#m_planet_nums[i];
    if (n == undefined || n == -1) return undefined;
    return min_flyby_rp(n);
  }

  // 天体の太陽中心位置・速度 (B面ビューで太陽方向と公転方向を描くのに使う)
  planet_pos(i) {
    return this.#m_planet_pos[i];
  }

  planet_vel(i) {
    return this.#m_planet_vel[i];
  }

  beta(i) {
    return this.#m_beta[i] ?? 0;
  }

  get count() {
    return this.#m_count;
  }

  /**
   * ノードが指している天体番号を付け替える。
   * 取り込んだ小天体を消すと後ろの番号が繰り上がるので、そのときに使う。
   *
   * @param {(n:number) => number} map 今の番号から新しい番号を返す関数
   * @returns {boolean} 1つでも変わったか
   */
  renumber_planets(map) {
    let changed = false;
    for (let i = 0; i < this.#m_count; i++) {
      const now = this.#m_planet_nums[i];
      if (now == undefined || now === -1) continue;
      const next = map(now);
      if (next === now) continue;
      this.#m_planet_nums[i] = next;
      changed = true;
    }
    if (changed) this.#recompute_all();
    return changed;
  }

  /** その天体を使っているノードの番号 (無ければ空) */
  nodes_using_planet(num) {
    const out = [];
    for (let i = 0; i < this.#m_count; i++) {
      if (this.#m_planet_nums[i] === num) out.push(i);
    }
    return out;
  }

  async set_planet_num(i, num) {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.#m_planet_nums[i] = num;
        this.#recompute_all();
        resolve();
      }, 100);
    });
  }

  set_date(i, date) {
    if (i < 0 || i >= this.#m_count) return date;
    const clamped = this.#clamp_date(i, date);
    if (clamped === this.#m_dates[i]) return clamped;

    // 手で時刻を動かしたら、節目への固定は外れる
    this.#m_pinned_event[i] = undefined;
    this.#m_dates[i] = clamped;
    this.#recompute_all();
    return clamped;
  }

  set_type(i, type) {
    // 自力では次の目的地に届かない節 (手動の打上げ/スイングバイ・フライバイ) は
    // 後ろにDSMを従える。その要否は種別を変えると入れ替わる
    const was_manual = this.#is_manual_node(i);
    const was_end = this.#m_types[i] === Sequence_Type.End;
    this.#m_types[i] = type;
    const is_manual = this.#is_manual_node(i);

    if (was_manual && !is_manual) this.#remove_maneuvers_after(i);
    if (!was_manual && is_manual && !this.#has_maneuver_after(i)) this.#insert_maneuver_after(i);

    if (type === Sequence_Type.End) {
      // 天体を持たない節になるので、割り当てられていた天体は外す
      this.#m_planet_nums[i] = -1;
      // 直前のDSMは「次の天体へ届かせる」ためのものなので、目的地が無くなれば不要
      this.#remove_maneuvers_before(i);
    } else if (was_end && i > 0 && this.#is_manual_node(i - 1) && !this.#has_maneuver_after(i - 1)) {
      // 最終軌道をやめて目的地を持つ節に戻したら、届かせるためのDSMを入れ直す
      this.#insert_maneuver_after(i - 1);
    }

    this.#recompute_all();
  }

  // 打上げ・スイングバイの自動/手動を切り替える。
  //   スイングバイ 自動: パワード・フライバイ / 手動: 指定したrp・betaで無推力
  //   打上げ       自動: ランベールで次の天体へ / 手動: 指定した|V∞|と角度で出発
  // どちらも手動では次の天体に届かないので、直後にDSM用のマヌーバノードを
  // 自動で挿入する。自動に戻すときは取り除く。
  set_auto_mode(i, is_auto) {
    const type = this.#m_types[i];
    const has_manual =
      type === Sequence_Type.Swingby || type === Sequence_Type.Launch || type === Sequence_Type.Escape;
    // 最終軌道が続いている間は目的地が無いので自動には戻せない
    if (is_auto && !this.can_set_auto(i)) return;

    // 手動に切り替えるときは、いまの軌道から初期値を取って飛びを防ぐ
    if (has_manual && !is_auto && this.#m_is_auto_mode[i]) {
      if (type === Sequence_Type.Launch) this.#init_launch_manual_from_auto();
      else if (type === Sequence_Type.Escape) this.#init_escape_manual_from_auto(i);
    }
    this.#m_is_auto_mode[i] = is_auto;

    if (has_manual) {
      if (!is_auto) {
        if (!this.#has_maneuver_after(i)) this.#insert_maneuver_after(i);
      } else {
        this.#remove_maneuvers_after(i);
      }
    }

    this.#recompute_all();
  }

  // --- 手動モードの打上げパラメータ ---
  launch_vinf() {
    return this.#m_launch_vinf;
  }
  launch_alpha() {
    return this.#m_launch_alpha;
  }
  launch_delta() {
    return this.#m_launch_delta;
  }
  set_launch_vinf(vinf) {
    this.#m_launch_vinf = Math.max(0, vinf);
    this.#recompute_all();
  }
  set_launch_alpha(alpha) {
    this.#m_launch_alpha = alpha;
    this.#recompute_all();
  }
  set_launch_delta(delta) {
    // 仰角は±90度まで (これを超えると方位角側で表せる)
    const lim = Math.PI / 2;
    this.#m_launch_delta = Math.max(-lim, Math.min(lim, delta));
    this.#recompute_all();
  }

  // --- 手動モードの軌道脱出パラメータ (打上げの手動モードと同じ流儀) ---
  // 既定値は打上げの初期値と揃えず、切り替え時に自動解から入れる
  // (#init_escape_manual_from_auto)。それも取れないときだけ0にする。
  escape_vinf(i) {
    return this.#m_escape_vinf[i] ?? 0;
  }
  escape_alpha(i) {
    return this.#m_escape_alpha[i] ?? 0;
  }
  escape_delta(i) {
    return this.#m_escape_delta[i] ?? 0;
  }
  set_escape_vinf(i, vinf) {
    this.#m_escape_vinf[i] = Math.max(0, vinf);
    this.#recompute_all();
  }
  set_escape_alpha(i, alpha) {
    this.#m_escape_alpha[i] = alpha;
    this.#recompute_all();
  }
  set_escape_delta(i, delta) {
    // 仰角は±90度まで (これを超えると方位角側で表せる)
    const lim = Math.PI / 2;
    this.#m_escape_delta[i] = Math.max(-lim, Math.min(lim, delta));
    this.#recompute_all();
  }

  // --- 手動マヌーバの設計変数 (打上げの手動モードと同じ流儀) ---
  dsm_dv(i) {
    return this.#m_dsm_dv[i] ?? 0;
  }
  dsm_alpha(i) {
    return this.#m_dsm_alpha[i] ?? 0;
  }
  dsm_delta(i) {
    return this.#m_dsm_delta[i] ?? 0;
  }
  set_dsm_dv(i, dv) {
    this.#m_dsm_dv[i] = Math.max(0, dv);
    this.#recompute_all();
  }
  set_dsm_alpha(i, alpha) {
    this.#m_dsm_alpha[i] = alpha;
    this.#recompute_all();
  }
  set_dsm_delta(i, delta) {
    // 仰角は±90度まで (これを超えると方位角側で表せる)
    const lim = Math.PI / 2;
    this.#m_dsm_delta[i] = Math.max(-lim, Math.min(lim, delta));
    this.#recompute_all();
  }

  #has_maneuver_after(i) {
    return i + 1 < this.#m_count && this.#m_types[i + 1] === Sequence_Type.Maneuver;
  }

  /**
   * ノードiの直後に並んでいるマヌーバをまとめて取り除く。
   * 手動レグには複数のDSMが並びうるので、1つだけ消すと取り残される。
   */
  #remove_maneuvers_after(i) {
    let n = 0;
    while (this.#has_maneuver_after(i)) {
      this.#remove_node(i + 1);
      n++;
    }
    return n;
  }

  /** ノードiの直前に並んでいるマヌーバをまとめて取り除き、取り除いた数を返す */
  #remove_maneuvers_before(i) {
    let n = 0;
    while (i - 1 - n >= 0 && this.#m_types[i - 1 - n] === Sequence_Type.Maneuver) n++;
    for (let k = 0; k < n; k++) this.#remove_node(i - 1 - k);
    return n;
  }

  /**
   * 挿入位置idxが「手動ノードとその行き先の間」= DSMを並べる区間の中か。
   * ここに節を足せるのはマヌーバだけで、他の種別は置きようがない
   * (手動ノードは次の天体に直接は届かず、途中はDSMで繋ぐため)。
   */
  #in_manual_leg(idx) {
    if (idx <= 0 || idx > this.#m_count) return false;
    // 直前からマヌーバを遡り、その先が「DSMを持っている手動ノード」なら区間の中
    let k = idx - 1;
    while (k >= 0 && this.#m_types[k] === Sequence_Type.Maneuver) k--;
    return k >= 0 && this.#is_manual_node(k) && this.#has_maneuver_after(k);
  }

  /**
   * 手動レグに並ぶマヌーバの自動/手動を整える。
   *
   * 並びの最後の1つだけが自動マヌーバで、これがランベールで次の目的地へ繋ぐ
   * 役目を負う。それより手前は手動マヌーバ (ユーザーがΔVを指定するDSM) になる。
   * マルチインパルス遷移を組むときは、この並びを増やしていくことになる。
   */
  #normalize_maneuvers() {
    for (let i = 0; i < this.#m_count; i++) {
      if (this.#m_types[i] !== Sequence_Type.Maneuver) continue;
      let e = i;
      while (e + 1 < this.#m_count && this.#m_types[e + 1] === Sequence_Type.Maneuver) e++;
      for (let k = i; k <= e; k++) this.#m_is_auto_mode[k] = k === e;
      i = e;
    }
  }

  /**
   * その節を個別に削除できるか。
   * 自動マヌーバは手動モードに付随する構造なので個別には消せない
   * (自動/手動の切り替えで出入りする)。手で足した手動マヌーバは消せる。
   */
  can_remove(i) {
    if (i < 0 || i >= this.#m_count) return false;
    if (this.#m_types[i] === Sequence_Type.Maneuver) return !this.#m_is_auto_mode[i];
    return true;
  }

  // ノードiの直後にマヌーバ(DSM)ノードを挿入する。
  // 日付は既定でレグの DEFAULT_DSM_ETA の位置に置く。
  #insert_maneuver_after(i) {
    const idx = i + 1;
    // 挿入位置の日付。次ノードが無い場合はレグが無いので何もしない
    if (idx >= this.#m_count) return;
    // 次が最終軌道なら届かせる目的地が無いのでDSMは要らない
    if (this.#m_types[idx] === Sequence_Type.End) return;
    const t0 = this.#m_dates[i];
    const t1 = this.#m_dates[idx];
    if (t0 == undefined || t1 == undefined) return;
    const date = t0 + (t1 - t0) * DEFAULT_DSM_ETA;

    this.#m_planet_nums.splice(idx, 0, -1); // 天体ではない
    this.#m_dates.splice(idx, 0, date);
    this.#m_types.splice(idx, 0, Sequence_Type.Maneuver);
    this.#m_is_auto_mode.splice(idx, 0, true);
    this.#m_rp.splice(idx, 0, undefined);
    this.#m_beta.splice(idx, 0, 0);
    this.#m_orbit_rp.splice(idx, 0, undefined);
    this.#m_orbit_ra.splice(idx, 0, undefined);
    this.#m_orbit_info.splice(idx, 0, undefined);
    this.#m_entry_gamma.splice(idx, 0, undefined);
    this.#m_entry_info.splice(idx, 0, undefined);
    this.#m_dsm_dv.splice(idx, 0, undefined);
    this.#m_dsm_alpha.splice(idx, 0, undefined);
    this.#m_dsm_delta.splice(idx, 0, undefined);
    this.#m_escape_vinf.splice(idx, 0, undefined);
    this.#m_escape_alpha.splice(idx, 0, undefined);
    this.#m_escape_delta.splice(idx, 0, undefined);
    this.#m_planet_pos.splice(idx, 0, undefined);
    this.#m_planet_vel.splice(idx, 0, undefined);
    this.#m_s_c_pos.splice(idx, 0, undefined);
    this.#m_s_c_vel.splice(idx, 0, undefined);
    this.#m_swingby_info.splice(idx, 0, undefined);
    this.#m_encounter_info.splice(idx, 0, undefined);
    this.#m_leg_revs.splice(idx, 0, 0);
    this.#m_leg_low.splice(idx, 0, true);
    this.#m_leg_info.splice(idx, 0, undefined);
    this.#m_dsm_info.splice(idx, 0, undefined);
    this.#m_end_info.splice(idx, 0, undefined);
    this.#m_pinned_event.splice(idx, 0, undefined);
    this.#m_trajectory_arcs.splice(idx, 0, undefined);
    this.#m_count++;
  }

  #remove_node(idx) {
    if (idx < 0 || idx >= this.#m_count) return;
    this.#m_planet_nums.splice(idx, 1);
    this.#m_dates.splice(idx, 1);
    this.#m_types.splice(idx, 1);
    this.#m_is_auto_mode.splice(idx, 1);
    this.#m_rp.splice(idx, 1);
    this.#m_beta.splice(idx, 1);
    this.#m_orbit_rp.splice(idx, 1);
    this.#m_orbit_ra.splice(idx, 1);
    this.#m_orbit_info.splice(idx, 1);
    this.#m_entry_gamma.splice(idx, 1);
    this.#m_entry_info.splice(idx, 1);
    this.#m_dsm_dv.splice(idx, 1);
    this.#m_dsm_alpha.splice(idx, 1);
    this.#m_dsm_delta.splice(idx, 1);
    this.#m_escape_vinf.splice(idx, 1);
    this.#m_escape_alpha.splice(idx, 1);
    this.#m_escape_delta.splice(idx, 1);
    this.#m_planet_pos.splice(idx, 1);
    this.#m_planet_vel.splice(idx, 1);
    this.#m_s_c_pos.splice(idx, 1);
    this.#m_s_c_vel.splice(idx, 1);
    this.#m_swingby_info.splice(idx, 1);
    this.#m_encounter_info.splice(idx, 1);
    this.#m_leg_revs.splice(idx, 1);
    this.#m_leg_low.splice(idx, 1);
    this.#m_leg_info.splice(idx, 1);
    this.#m_dsm_info.splice(idx, 1);
    this.#m_end_info.splice(idx, 1);
    this.#m_pinned_event.splice(idx, 1);
    this.#m_trajectory_arcs.splice(idx, 1);
    this.#m_count--;
  }

  set_rp(i, rp) {
    // 大気・放射線帯に突入しないよう、天体ごとの下限でクランプする
    const min = this.min_rp(i);
    this.#m_rp[i] = min != undefined ? Math.max(rp, min) : rp;
    this.#recompute_all();
  }

  set_beta(i, beta) {
    this.#m_beta[i] = beta;
    this.#recompute_all();
  }

  add(idx, date) {
    // 挿入位置が手動ノードとその行き先の間なら、そこに置けるのはマヌーバだけ。
    // 判定は配列をずらす前に済ませておく。
    const in_manual_leg = this.#in_manual_leg(idx);

    this.#m_types[0] = Sequence_Type.None;
    this.#m_is_auto_mode.splice(idx, 0, true);
    this.#m_dates.splice(idx, 0, date);
    this.#m_rp.splice(idx, 0, undefined);
    this.#m_beta.splice(idx, 0, 0);
    this.#m_orbit_rp.splice(idx, 0, undefined);
    this.#m_orbit_ra.splice(idx, 0, undefined);
    this.#m_orbit_info.splice(idx, 0, undefined);
    this.#m_entry_gamma.splice(idx, 0, undefined);
    this.#m_entry_info.splice(idx, 0, undefined);
    this.#m_dsm_dv.splice(idx, 0, undefined);
    this.#m_dsm_alpha.splice(idx, 0, undefined);
    this.#m_dsm_delta.splice(idx, 0, undefined);
    this.#m_escape_vinf.splice(idx, 0, undefined);
    this.#m_escape_alpha.splice(idx, 0, undefined);
    this.#m_escape_delta.splice(idx, 0, undefined);
    // 平行配列はすべて同じ位置にずらす。ここを漏らすと途中挿入のときに
    // 添字がずれて別ノードの計算結果を参照してしまう。
    this.#m_planet_pos.splice(idx, 0, undefined);
    this.#m_planet_vel.splice(idx, 0, undefined);
    this.#m_s_c_pos.splice(idx, 0, undefined);
    this.#m_s_c_vel.splice(idx, 0, undefined);
    this.#m_swingby_info.splice(idx, 0, undefined);
    this.#m_encounter_info.splice(idx, 0, undefined);
    this.#m_leg_revs.splice(idx, 0, 0);
    this.#m_leg_low.splice(idx, 0, true);
    this.#m_leg_info.splice(idx, 0, undefined);
    this.#m_dsm_info.splice(idx, 0, undefined);
    this.#m_end_info.splice(idx, 0, undefined);
    this.#m_pinned_event.splice(idx, 0, undefined);
    this.#m_trajectory_arcs.splice(idx, 0, undefined);

    if (this.#m_count != 0) {
      if (idx == 0 && this.#m_dates[1] - this.#m_dates[0] < 50) this.#m_dates[0] = this.#m_dates[1] - 50;
      else if (idx == this.#m_count && this.#m_dates[this.#m_count] - this.#m_dates[this.#m_count - 1] < 50)
        this.#m_dates[this.#m_count] = this.#m_dates[this.#m_count - 1] + 50;
      else if (idx != 0 && idx != this.#m_count) this.#m_dates[idx] = (this.#m_dates[idx - 1] + this.#m_dates[idx + 1]) / 2;
    }

    if (idx == 0) this.#m_planet_nums.splice(idx, 0, 2);
    else this.#m_planet_nums.splice(idx, 0, -1);
    this.#m_types.splice(idx, 0, Sequence_Type.None);
    this.#m_types[0] = Sequence_Type.Launch;
    this.#m_count++;

    // 手動レグの中に足したものは手動マヌーバ (ユーザーがΔVを指定するDSM)。
    // 並びの最後だけが自動マヌーバになるよう #normalize_maneuvers が整える。
    if (in_manual_leg) {
      this.#m_types[idx] = Sequence_Type.Maneuver;
      this.#m_planet_nums[idx] = -1;
      this.#m_is_auto_mode[idx] = false;
    }

    // 周回軌道投入の直後に節を足したら、既定でその軌道からの脱出にする。
    // 捕獲されたまま次の目的地へ飛べはしないので、続きがあるならまず脱出しか
    // ありえない。天体も投入側に揃える (#normalize_types が維持する)。
    if (idx > 0 && this.#m_types[idx - 1] === Sequence_Type.Orbit) {
      this.#m_types[idx] = Sequence_Type.Escape;
      this.#m_planet_nums[idx] = this.#m_planet_nums[idx - 1];
    }

    // ランデブーの直後も同じ。天体に張り付いたままでは次へ行けないので、
    // 続きがあるならまず再出発
    if (idx > 0 && this.#m_types[idx - 1] === Sequence_Type.Rendezvous) {
      this.#m_types[idx] = Sequence_Type.Departure;
      this.#m_planet_nums[idx] = this.#m_planet_nums[idx - 1];
    }

    // 手動モードのノードの後ろに新しい目的地が来たら、そこへ届かせるための
    // DSMを補う (最終軌道を消したあとに行き先を足した場合など)。
    // このとき新しいノードは1つ後ろにずれる。
    let added = idx;
    if (!in_manual_leg && idx > 0 && this.#is_manual_node(idx - 1) && !this.#has_maneuver_after(idx - 1)) {
      this.#insert_maneuver_after(idx - 1);
      added = idx + 1;
    }

    this.#recompute_all();
    return added;
  }

  /**
   * ミッションを保存用の素の値に書き出す。
   *
   * 出すのは設計変数だけ (種別・天体・日付・手動パラメータ)。位置や速度、
   * ΔVといった計算結果は入れない。読み込み側で全部計算し直すので、入れても
   * 大きくなるうえに古くなるだけで、食い違えばむしろ害になる。
   *
   * 種別は日本語のラベルではなく Sequence_Type のキー (Launch など) で書く。
   * 表示の文言を変えても、また英語表示を入れても、保存したファイルが読める。
   */
  serialize() {
    const key_of = {};
    for (const [k, v] of Object.entries(Sequence_Type)) key_of[v] = k;

    const nodes = [];
    for (let i = 0; i < this.#m_count; i++) {
      const n = { type: key_of[this.#m_types[i]] ?? "None", date: this.#m_dates[i] };
      if (this.#m_planet_nums[i] != undefined && this.#m_planet_nums[i] !== -1) n.planet = this.#m_planet_nums[i];
      if (!this.#m_is_auto_mode[i]) n.manual = true;
      if (this.#m_rp[i] != undefined) n.rp = this.#m_rp[i];
      if (this.#m_beta[i]) n.beta = this.#m_beta[i];
      if (this.#m_orbit_rp[i] != undefined) n.orbit_rp = this.#m_orbit_rp[i];
      if (this.#m_orbit_ra[i] != undefined) n.orbit_ra = this.#m_orbit_ra[i];
      if (this.#m_entry_gamma[i] != undefined) n.entry_gamma = this.#m_entry_gamma[i];
      if (this.#m_dsm_dv[i] != undefined) {
        n.dsm = { dv: this.#m_dsm_dv[i], alpha: this.#m_dsm_alpha[i] ?? 0, delta: this.#m_dsm_delta[i] ?? 0 };
      }
      if (this.#m_escape_vinf[i] != undefined) {
        n.escape = {
          vinf: this.#m_escape_vinf[i],
          alpha: this.#m_escape_alpha[i] ?? 0,
          delta: this.#m_escape_delta[i] ?? 0,
        };
      }
      if (this.#m_pinned_event[i] != undefined) n.pinned = this.#m_pinned_event[i];
      // レグの周回数 (既定は直行なので、指定があるときだけ書く)
      if (this.#m_leg_revs[i]) {
        n.rev = this.#m_leg_revs[i];
        if (this.#m_leg_low[i] === false) n.branch = "high";
      }
      nodes.push(n);
    }

    return {
      launch: { vinf: this.#m_launch_vinf, alpha: this.#m_launch_alpha, delta: this.#m_launch_delta },
      nodes,
    };
  }

  /**
   * serialize() で書き出したものからミッションを組み立て直す。
   *
   * 手で書き換えたファイルも来うるので、値は読める形に直してから入れる
   * (知らない種別は「---」、範囲外の天体は未割当、日付の前後が詰まりすぎて
   * いれば最小間隔まで広げる)。前提が崩れた節を普通の節に戻す正規化は
   * #recompute_all がやるので、多少おかしくても壊れた状態にはならない。
   *
   * @returns {boolean} 読めたか
   */
  restore(data) {
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return false;

    const nodes = data.nodes;
    const num = (v, fallback) => (typeof v === "number" && isFinite(v) ? v : fallback);
    const blank = () => new Array(nodes.length).fill(undefined);

    this.#m_count = nodes.length;
    this.#m_types = nodes.map((n) => Sequence_Type[n.type] ?? Sequence_Type.None);
    this.#m_types[0] = Sequence_Type.Launch; // 先頭は常に打上げ
    this.#m_dates = nodes.map((n, i) => num(n.date, i * MIN_NODE_GAP));
    this.#m_planet_nums = nodes.map((n) => {
      const p = Math.round(num(n.planet, -1));
      return p >= 0 && p < planet_mu.length ? p : -1;
    });
    this.#m_is_auto_mode = nodes.map((n) => !n.manual);
    this.#m_rp = nodes.map((n) => num(n.rp, undefined));
    this.#m_beta = nodes.map((n) => num(n.beta, 0));
    this.#m_orbit_rp = nodes.map((n) => num(n.orbit_rp, undefined));
    this.#m_orbit_ra = nodes.map((n) => num(n.orbit_ra, undefined));
    this.#m_entry_gamma = nodes.map((n) => num(n.entry_gamma, undefined));
    this.#m_dsm_dv = nodes.map((n) => (n.dsm ? num(n.dsm.dv, 0) : undefined));
    this.#m_dsm_alpha = nodes.map((n) => (n.dsm ? num(n.dsm.alpha, 0) : undefined));
    this.#m_dsm_delta = nodes.map((n) => (n.dsm ? num(n.dsm.delta, 0) : undefined));
    this.#m_escape_vinf = nodes.map((n) => (n.escape ? num(n.escape.vinf, 0) : undefined));
    this.#m_escape_alpha = nodes.map((n) => (n.escape ? num(n.escape.alpha, 0) : undefined));
    this.#m_escape_delta = nodes.map((n) => (n.escape ? num(n.escape.delta, 0) : undefined));
    this.#m_pinned_event = nodes.map((n) =>
      Object.values(Leg_Event).includes(n.pinned) ? n.pinned : undefined
    );
    this.#m_leg_revs = nodes.map((n) => Math.max(0, Math.round(num(n.rev, 0))));
    this.#m_leg_low = nodes.map((n) => n.branch !== "high");

    // 日付は必ず前から順に、最小間隔を空けて並ぶようにする
    for (let i = 1; i < this.#m_count; i++) {
      if (this.#m_dates[i] - this.#m_dates[i - 1] < MIN_NODE_GAP) {
        this.#m_dates[i] = this.#m_dates[i - 1] + MIN_NODE_GAP;
      }
    }

    const launch = data.launch ?? {};
    this.#m_launch_vinf = Math.max(0, num(launch.vinf, 3));
    this.#m_launch_alpha = num(launch.alpha, 0);
    this.#m_launch_delta = num(launch.delta, 0);

    // 計算結果は持ち込まない。読み込んだ設計変数から全部やり直す
    this.#m_planet_pos = blank();
    this.#m_planet_vel = blank();
    this.#m_s_c_pos = blank();
    this.#m_s_c_vel = blank();
    this.#m_orbit_info = blank();
    this.#m_entry_info = blank();
    this.#m_swingby_info = blank();
    this.#m_encounter_info = blank();
    this.#m_leg_info = blank();
    this.#m_dsm_info = blank();
    this.#m_end_info = blank();
    this.#m_trajectory_arcs = blank();

    this.#recompute_all();
    return true;
  }

  /**
   * シーケンスを1つ削除する。
   *
   * マヌーバ(DSM)ノードは手動モードに付随して自動で出し入れするものなので、
   * ここでは消せない (自動/手動の切り替えで消す)。手動モードのノードを消す
   * ときは、その相棒のDSMも一緒に片付ける。
   *
   * @returns {boolean} 削除したか
   */
  remove(i) {
    if (!this.can_remove(i)) return false;

    // 手動ノードを消すときは、付いていたDSMの並びも一緒に片付ける
    if (this.#is_manual_node(i)) this.#remove_maneuvers_after(i);
    this.#remove_node(i);

    // 行き先が無くなってDSMだけが末尾に残ったら、その持ち主を自動に戻す
    while (this.#m_count > 0 && this.#m_types[this.#m_count - 1] === Sequence_Type.Maneuver) {
      this.#remove_node(this.#m_count - 1);
      if (this.#m_count > 0) this.#m_is_auto_mode[this.#m_count - 1] = true;
    }

    // 先頭は常に打上げ。繰り上がったノードには前の打上げの手動パラメータを
    // 引き継がせる意味が無いので、自動に戻しておく。
    if (i == 0 && this.#m_count > 0) {
      this.#m_types[0] = Sequence_Type.Launch;
      if (!this.#m_is_auto_mode[0]) {
        if (this.#has_maneuver_after(0)) this.#remove_node(1);
        this.#m_is_auto_mode[0] = true;
      }
    }

    this.#recompute_all();
    return true;
  }
}
