//lambert-orbit | Copyright © influenceth | github.com/influenceth/lambert-orbit
//
// Izzo (2015) "Revisiting Lambert's problem" の解法。元は influenceth/lambert-orbit
// (poliastro / lamberthub からの移植)。最適化の土台にするため、次を直してある。
//
//   * 中間分枝 (T_1 < T < T_0) の初期値の指数が逆数になっていなかった。
//     x_0 は T=T_0 で 0、T=T_1 で 1 に繋がるべきなので指数は 1/log2(T_0/T_1)。
//     元の log2(T_1/T_0) は符号まで狂っていて、真の解が x≒0.77 のときに
//     x_0≒-1 (放物線の反対の端) を返していた。
//   * T_min を探す Halley 法が、反復のあいだ T を初期点の値のまま使い回して
//     いた。導関数の式は「その x での T」を要るので、間違った点に収束して
//     T_min を大きく見積もる。解けるはずの多周回が「解なし」で弾かれていた。
//   * 反復に必ず解を含む区間を持たせ、外へ飛んだら二分法に落とす。
//     Householder 法だけだと、初期値が端に寄ったときに戻ってこない。
//   * 超幾何関数を階乗の商から漸化式に変えた。項ごとに階乗を組み直すと
//     n が伸びたときに Infinity/Infinity = NaN になる。
//   * 2点が一直線に並ぶ (転移角 0°/180°) ときは軌道面が決まらない。
//     黙って NaN を返さず、理由を投げる。
//
// 単位は呼び出し側に合わせて km, s, km^3/s^2。

const pi = Math.PI;

// 2点が一直線とみなす、単位ベクトルの外積の大きさ。
// これ未満だと軌道面が丸め誤差で決まってしまう。
const COLLINEAR_TOL = 1e-12;

// x が動ける範囲の端。x=-1 と x=1 は特異点なので、そのものには寄せない
const X_EPS = 1e-12;

/**
 * 超幾何関数 2F1(3, 1, 5/2, x)。Izzo の飛行時間の式 (x≒1 の近傍) だけで使う。
 *
 * 項ごとに (a)_n (b)_n / ((c)_n n!) を組み直すと、分子・分母が別々に
 * Infinity に振り切れて NaN になる。隣り合う項の比だけを掛けていけば
 * 桁は溢れないし、計算量も n に比例するだけで済む。
 * 倍精度で足しても変わらなくなるまで回す。
 */
function hyp2f1(x) {
  if (x >= 1) return Infinity;
  let res = 1;
  let term = 1;
  for (let n = 0; n < 1000; n++) {
    term = (term * (3 + n) * (1 + n) * x) / ((5 / 2 + n) * (n + 1));
    const prev = res;
    res += term;
    if (res === prev) break;
  }
  return res;
}

/**
 * Solves Lambert problem using Dario Izzo's devised algorithm and based on python implementation
 * found at https://github.com/jorgepiloto/lamberthub which is, in turn, based on the implementation
 * found at https://github.com/poliastro/poliastro.
 *
 * Reference for original algorithm: Izzo, D. (2015). Revisiting Lambert's problem. Celestial Mechanics
 * and Dynamical Astronomy, 121(1), 1-15.
 *
 * Returns:
 * v1: Initial velocity vector.
 * v2: Final velocity vector.
 *
 * @param {number} mu Gravitational parameter, equivalent to GM of attractor body.
 * @param {Array.<number>} r1 Initial position vector
 * @param {Array.<number>} r2 Final position vector
 * @param {number} tof Time of flight in seconds
 * @param {number} M Number of revolutions. Must be an integer equal or greater than 0 value.
 * @param {boolean} prograde If true, specifies prograde motion. Otherwise, retrograde motion is imposed.
 * @param {boolean} low_path If two solutions are available, it selects between high or low path.
 * @param {number} maxiter Maximum number of iterations.
 * @param {number} atol Absolute tolerance.
 * @param {number} rtol Relative tolerance.
 */
function lambert_probrem (
  mu,
  r1,
  r2,
  tof,
  M = 0,
  prograde = true,
  low_path = true,
  maxiter = 35,
  atol = 1e-12,
  rtol = 1e-14
) {

  // Check that input parameters are safe
  validateGravitationalParam(mu);
  validatePositions(r1, r2);
  if (!(tof > 0)) throw new Error('Time of flight must be positive');

  // Chord
  const c = math.subtract(r2, r1);
  const c_norm = math.norm(c);
  const r1_norm = math.norm(r1);
  const r2_norm = math.norm(r2);

  // Semiperimeter
  const s = math.multiply(math.add(r1_norm, r2_norm, c_norm), 0.5);

  // Versors
  const i_r1 = math.divide(r1, r1_norm);
  const i_r2 = math.divide(r2, r2_norm);
  let i_h = math.cross(i_r1, i_r2)
  const h_norm = math.norm(i_h);
  // 2点が一直線 (転移角 0° / 180°) だと軌道面が決まらない。ここで断らないと、
  // 0で割った NaN がそのまま速度として出ていく。
  if (!(h_norm > COLLINEAR_TOL)) {
    throw new Error('Transfer plane is undefined (positions are collinear)');
  }
  i_h = math.divide(i_h, h_norm);

  // Geometry of the problem
  let ll = Math.sqrt(1 - Math.min(1.0, c_norm / s));

  // Compute the fundamental tangential directions
  let i_t1, i_t2;

  if (i_h[2] < 0) {
    ll = -ll;
    i_t1 = math.cross(i_r1, i_h);
    i_t2 = math.cross(i_r2, i_h);
  } else {
    i_t1 = math.cross(i_h, i_r1);
    i_t2 = math.cross(i_h, i_r2);
  }

  // Correct transfer angle parameter and tangential vectors regarding orbit's inclination
  if (!prograde) {
    ll = -ll;
    i_t1 = math.multiply(-1, i_t1);
    i_t2 = math.multiply(-1, i_t2);
  }

  // Non dimensional time of flight
  const T = Math.sqrt(2 * mu / Math.pow(s, 3)) * tof;

  // Find solutions and filter them
  const [ x, y ] = _findXY(ll, T, M, maxiter, atol, rtol, low_path);
  if (!isFinite(x) || !isFinite(y)) throw new Error('Failed to converge');

  // Reconstruct
  const gamma = Math.sqrt(mu * s / 2);
  const rho = (r1_norm - r2_norm) / c_norm;
  const sigma = Math.sqrt(1 - Math.pow(rho, 2));

  // Compute the radial and tangential components at initial and final position vectors
  const [ V_r1, V_r2, V_t1, V_t2 ] = _reconstruct(x, y, r1_norm, r2_norm, ll, gamma, rho, sigma);

  // Solve for the initial and final velocity
  const v1 = math.add(math.multiply(V_r1, math.divide(r1, r1_norm)), math.multiply(V_t1, i_t1));
  const v2 = math.add(math.multiply(V_r2, math.divide(r2, r2_norm)), math.multiply(V_t2, i_t2));

  return [ v1, v2 ];
};

const validateGravitationalParam = (mu) => {
  if (mu <= 0) throw new Error('Gravitational parameter must be positive');
};

const validatePositions = (r1, r2) => {

  validatePosition(r1);
  validatePosition(r2);
  // 成分ごとに見る。includes で数えると [1,2,3] と [3,2,1] のような
  // 別の点まで「同じ」と言われてしまう
  if (r1[0] === r2[0] && r1[1] === r2[1] && r1[2] === r2[2]) {
    throw new Error('Initial and final positions can not be the same');
  }
};

const validatePosition = (r) => {
  if (r.length !== 3) throw new Error('Position vector must be three dimensional');
  if (!isFinite(r[0]) || !isFinite(r[1]) || !isFinite(r[2])) throw new Error('Position must be finite');
  if (r.find(e => e !== 0) === undefined) throw new Error('Position can not be at origin');
};

/**
 * Reconstruct solution velocity vectors
 */
const _reconstruct = (x, y, r1, r2, ll, gamma, rho, sigma) => {
  const V_r1 = gamma * ((ll * y - x) - rho * (ll * y + x)) / r1;
  const V_r2 = -gamma * ((ll * y - x) + rho * (ll * y + x)) / r2;
  const V_t1 = gamma * sigma * (y + ll * x) / r1;
  const V_t2 = gamma * sigma * (y + ll * x) / r2;

  return [ V_r1, V_r2, V_t1, V_t2 ];
};

/**
 * Computes all x, y for given number of revolutions.
 */
const _findXY = (ll, T, M, maxiter, atol, rtol, low_path) => {
  // For abs(ll) == 1 the derivative is not continuous
  if (Math.abs(ll) >= 1) throw new Error('Derivative is not continuous');

  let M_max = Math.floor(T / Math.PI);
  const T_00 = Math.acos(ll) + ll * Math.sqrt(1 - Math.pow(ll, 2)) // T_xM

  // Refine maximum number of revolutions if necessary
  let x_T_min;
  if (T < (T_00 + M_max * Math.PI) && M_max > 0) {
    const [ x_min, T_min ] = _computeTMin(ll, M_max, maxiter, atol, rtol);
    if (T < T_min) M_max -= 1;
    else x_T_min = x_min;
  }

  // Check if a feasible solution exist for the given number of revolutions
  // This departs from the original paper in that we do not compute all solutions
  if (M > M_max) throw new Error('No feasible solution, try lower M!');

  // Initial guess
  const x_0 = _initialGuess(T, ll, M, low_path);

  // まずはそのまま Householder。ほとんどの配置はこれで詰む
  let x = _householder(x_0, T, ll, M, atol, rtol, maxiter);

  // 答えを飛行時間の式に戻して確かめる。初期値が端に寄ったときなど、
  // 「一歩は小さいのに全然別の点」で止まることがあるので、
  // 残差を見てから受け取る
  if (!_isSolution(x, T, ll, M)) {
    // 解を必ず含む区間を作って、外へ飛んだら二分法に落として解き直す
    let lo, hi;
    if (M === 0) {
      // T(x) は x ∈ (-1, ∞) で単調減少。x→-1 で無限大、x→∞ で 0
      lo = -1 + X_EPS;
      hi = Math.max(1.5, x_0 + 1);
      for (let k = 0; k < 60 && _tofEquation(hi, T, ll, M) > 0; k++) hi = hi * 2 + 1;
    } else {
      // 多周回は x ∈ (-1, 1) で、T_min を底にした谷。低い方/高い方の
      // どちらの枝にいるかで、区間の片側が T_min の位置になる
      // 上限を詰めるときに求めた谷は、その周回数のもの。求める周回数が
      // 違えば谷の位置も違うので、そのときは取り直す
      if (M !== M_max || x_T_min == undefined) x_T_min = _computeTMin(ll, M, maxiter, atol, rtol)[0];
      if (!isFinite(x_T_min)) {
        lo = -1 + X_EPS;
        hi = 1 - X_EPS;
      } else if (low_path) {
        lo = x_T_min;
        hi = 1 - X_EPS;
      } else {
        lo = -1 + X_EPS;
        hi = x_T_min;
      }
    }
    const x2 = _householder(x_0, T, ll, M, atol, rtol, maxiter, lo, hi);
    if (isFinite(x2)) x = x2;
  }

  if (!isFinite(x)) throw new Error('Failed to converge');
  const y = _computeY(x, ll);

  return [ x, y ];
};

// 飛行時間の式に戻したときの食い違い。これを超えたら解けていないとみなす
const RESIDUAL_TOL = 1e-9;

/** x が本当にその飛行時間の解か (残差で確かめる) */
const _isSolution = (x, T, ll, M) => {
  if (!isFinite(x) || x <= -1) return false;
  const res = _tofEquation(x, T, ll, M);
  return isFinite(res) && Math.abs(res) <= RESIDUAL_TOL * Math.max(1, T);
};

const _computeY = (x, ll) => Math.sqrt(1 - Math.pow(ll, 2) * (1 - Math.pow(x, 2)));

const _computePsi = (x, y, ll) => {
  // The auxiliary angle psi is computed using Eq.(17) by the appropriate inverse function
  if (-1 <= x && x < 1) {
    // Elliptic motion - Use arc cosine to avoid numerical errors
    return Math.acos(x * y + ll * (1 - Math.pow(x, 2)));
  } else if (x > 1) {
    // Hyperbolic motion - The hyperbolic sine is bijective
    return Math.asinh((y - x * ll) * Math.sqrt(Math.pow(x, 2) - 1));
  } else {
    // Parabolic motion
    return 0.0;
  }
};

const _tofEquation = (x, T0, ll, M) => _tofEquationY(x, _computeY(x, ll), T0, ll, M);

const _tofEquationY = (x, y, T0, ll, M) => {
  let T_;

  // Time of flight equation with externally computated y
  if (M == 0 && Math.sqrt(0.6) < x && x < Math.sqrt(1.4)) {
    const eta = y - ll * x;
    const S_1 = (1 - ll - x * eta) * 0.5;
    const Q = 4 / 3 * hyp2f1(S_1);
    T_ = (Math.pow(eta, 3) * Q + 4 * ll * eta) * 0.5;
  } else {
    const psi = _computePsi(x, y, ll);
    T_ = ((psi + M * pi) / Math.sqrt(Math.abs(1 - Math.pow(x, 2))) - x + ll * y) / (1 - Math.pow(x, 2));
  }

  return T_ - T0;
};

const _tofEquationP = (x, y, T, ll) => (3 * T * x - 2 + 2 * Math.pow(ll, 3) * x / y) / (1 - Math.pow(x, 2));

const _tofEquationP2 = (x, y, T, dT, ll) => {
  return (3 * T + 5 * x * dT + 2 * (1 - Math.pow(ll, 2)) * Math.pow(ll, 3) / Math.pow(y, 3)) / (1 - Math.pow(x, 2));
};

const _tofEquationP3 = (x, y, _, dT, ddT, ll) => {
  return (7 * x * ddT + 8 * dT - 6 * (1 - Math.pow(ll, 2)) * Math.pow(ll, 5) * x / Math.pow(y, 5)) /
    (1 - Math.pow(x, 2));
};

/**
 * その周回数で解が成り立つ下限 T_min と、そこでの x。
 * @returns {[number, number]} [x_T_min, T_min]
 */
const _computeTMin = (ll, M, maxiter, atol, rtol) => {
  let x_T_min, T_min;

  if (ll === 1) {
    x_T_min = 0.0
    T_min = _tofEquation(x_T_min, 0.0, ll, M);
  } else {
    if (M === 0) {
      x_T_min = Infinity;
      T_min = 0.0;
    } else {
      // Set x_i > 0 to avoid problems at ll = -1
      x_T_min = _halley(0.1, ll, M, atol, rtol, maxiter);
      T_min = _tofEquation(x_T_min, 0.0, ll, M);
    }
  }

  return [ x_T_min, T_min ];
};

const _initialGuess = (T, ll, M, low_path) => {
  let x_0;

  if (M === 0) {
    // Single revolution
    const T_0 = Math.acos(ll) + ll * Math.sqrt(1 - Math.pow(ll, 2)) + M * pi; // Equation 19
    const T_1 = 2 * (1 - Math.pow(ll, 3)) / 3; // Equation 21

    if (T >= T_0) {
      x_0 = Math.pow((T_0 / T), (2 / 3)) - 1;
    } else if (T < T_1) {
      x_0 = 5 / 2 * T_1 / T * (T_1 - T) / (1 - Math.pow(ll, 5)) + 1;
    } else {
      // T_1 < T < T_0。x_0 は T=T_0 で 0、T=T_1 で 1 に繋がってほしいので、
      // (T_0/T)^k - 1 の指数は k = 1/log2(T_0/T_1)
      x_0 = Math.pow(T_0 / T, 1 / Math.log2(T_0 / T_1)) - 1;
    }

    return x_0;
  } else {
    // Multiple revolution
    const x_0l = (Math.pow(((M * pi + pi) / (8 * T)), (2 / 3)) - 1) / (
      Math.pow(((M * pi + pi) / (8 * T)), (2 / 3)) + 1);
    const x_0r = (Math.pow(((8 * T) / (M * pi)), (2 / 3)) - 1) / (
      Math.pow(((8 * T) / (M * pi)), (2 / 3)) + 1);

    // Filter out the solution
    x_0 = low_path ? Math.max(x_0l, x_0r) : Math.min(x_0l, x_0r);

    return x_0;
  }
};

/**
 * 飛行時間の谷 (T_min) の位置を Halley 法で探す。
 *
 * 導関数の式 dT/dx は「その x での T」を含むので、反復のたびに T を
 * 計算し直す。初期点の T を使い回すと別の点に収束して T_min を大きく
 * 見積もり、解けるはずの多周回まで弾いてしまう。
 * 谷は x ∈ (-1, 1) の中にあるので、dT/dx の符号で挟みながら進む。
 */
const _halley = (p0, ll, M, atol, rtol, maxiter) => {
  let lo = -1 + X_EPS;
  let hi = 1 - X_EPS;
  for (let ii = 1; ii <= maxiter; ii++) {
    const y = _computeY(p0, ll);
    const T = _tofEquation(p0, 0.0, ll, M);
    const fder = _tofEquationP(p0, y, T, ll);
    const fder2 = _tofEquationP2(p0, y, T, fder, ll);
    const fder3 = _tofEquationP3(p0, y, T, fder, fder2, ll);

    // dT/dx は谷の左で負、右で正
    if (fder > 0) hi = p0;
    else lo = p0;

    // Halley step (cubic)
    const den = 2 * Math.pow(fder2, 2) - fder * fder3;
    const raw = den !== 0 ? p0 - 2 * fder * fder2 / den : NaN;

    // 収束した一歩は、区間の端をわずかに跨いでいても受け取る。
    // ここで二分法に落とすと、詰め切った答えを区間の真ん中まで戻してしまう
    if (isFinite(raw) && Math.abs(raw - p0) < rtol * Math.abs(p0) + atol) return raw;

    let p = raw;
    if (!isFinite(p) || p <= lo || p >= hi) p = (lo + hi) / 2;
    p0 = p;
  }

  // 収束しきらなくても挟んだ位置を返す。ここは T_min の見積もりに使うだけで、
  // 投げて解を丸ごと捨てるより近い値を返す方がよい
  return p0;
};

/**
 * Find a zero of time of flight equation using the Householder method.
 *
 * lo/hi を渡すと、そこを必ず解を含む区間として扱い、一歩が外へ出たら
 * 二分法に落とす。初期値が端に寄っても戻ってこられるようにするため。
 * 渡さなければ元のまま (速い方) で、こちらが常用の経路。
 *
 * @returns {number} 収束した x。だめなら NaN
 */
const _householder = (x_0, T0, ll, M, atol, rtol, maxiter, lo, hi) => {
  let f_lo = lo != undefined ? _tofEquation(lo, T0, ll, M) : NaN;
  let f_hi = hi != undefined ? _tofEquation(hi, T0, ll, M) : NaN;
  // 区間が解を挟んでいなければ、区間なしで回す
  const bracketed = isFinite(f_lo) && isFinite(f_hi) && f_lo * f_hi <= 0;
  if (bracketed) {
    if (f_lo === 0) return lo;
    if (f_hi === 0) return hi;
  }

  let p0 = x_0;
  if (bracketed && !(p0 > lo && p0 < hi)) p0 = (lo + hi) / 2;

  for (let ii = 1; ii <= maxiter; ii++) {
    const y = _computeY(p0, ll);
    const fval = _tofEquationY(p0, y, T0, ll, M);
    const T = fval + T0;
    const fder = _tofEquationP(p0, y, T, ll)
    const fder2 = _tofEquationP2(p0, y, T, fder, ll)
    const fder3 = _tofEquationP3(p0, y, T, fder, fder2, ll)

    // 解を挟んだまま区間を詰める
    if (bracketed) {
      if (fval * f_lo > 0) { lo = p0; f_lo = fval; }
      else { hi = p0; f_hi = fval; }
    }

    // Householder step (quartic)
    const den = fder * (Math.pow(fder, 2) - fval * fder2) + fder3 * Math.pow(fval, 2) / 6;
    const raw = den !== 0
      ? p0 - fval * ((Math.pow(fder, 2) - fval * fder2 / 2) / den)
      : NaN;

    // 収束した一歩は、区間の端をわずかに跨いでいても受け取る。丸めの範囲で
    // 行き過ぎただけの最後の一歩を二分法に落とすと、詰め切った答えを
    // 区間の真ん中まで戻してしまい、かえって桁が落ちる
    if (isFinite(raw) && Math.abs(raw - p0) < rtol * Math.abs(p0) + atol) return raw;

    let p = raw;
    if (bracketed && (!isFinite(p) || p <= lo || p >= hi)) p = (lo + hi) / 2;
    if (!isFinite(p)) return NaN;
    p0 = p;
  }

  return bracketed ? p0 : NaN;
};

// module.exports = solver;
