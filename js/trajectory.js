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
// スイングバイの近点半径のデフォルトに使う、天体表面からの最低通過高度の目安 [km]
export const MIN_FLYBY_ALTITUDE = 200;

export const i_hat = [1, 0, 0];
export const j_hat = [0, 1, 0];
export const k_hat = [0, 0, 1];

export function solve_kepler(e, M) {
  let E = M;
  let dE = 1;
  if (e < 1) {
    while (Math.abs(dE) > 1e-6) {
      dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= dE;
    }
  } else {
    while (Math.abs(dE) > 1e-6) {
      dE = (e * Math.sinh(E) - E - M) / (e * Math.cosh(E) - 1);
      E -= dE;
    }
  }
  return E;
}

export function get_planet_elements(T, n) {
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

export function get_orbit(elements) {
  let pos = [100];
  for (let i = 0; i < 100; i++) {
    let { r, v } = get_planets_pos_E(elements, (2 * Math.PI * i) / 99);
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
    v = math.add(
      math.multiply(P_hat, (Math.sqrt(MU_SUN * -a) * Math.sinh(E)) / r_norm),
      math.multiply(Q_hat, (Math.sqrt(MU_SUN * p) * Math.cosh(E)) / r_norm)
    );
  }

  return { r, v };
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
  #m_swingby_info = []; // 直近に計算されたスイングバイ結果 (get_swingby_info用)

  #m_trajectory_arcs = [];

  get_v_inf() {
    if (this.#m_planet_vel[0] == undefined || this.#m_s_c_vel[0] == undefined) return 0;
    return math.norm(math.subtract(this.#m_s_c_vel[0][0], this.#m_planet_vel[0]));
  }

  #calc_planet(i) {
    if (i < 0 || i >= this.#m_count) return;
    if (this.#m_planet_nums[i] == -1) return;
    let elements = get_planet_elements(this.#m_dates[i], this.#m_planet_nums[i]);
    let { r, v } = get_planets_pos(elements);

    this.#m_planet_pos[i] = r;
    this.#m_planet_vel[i] = v;
  }

  // スイングバイノードiの出発速度を、前レグの到着速度を双曲線で曲げて求める。
  // (MGA: ランベール問題を自由に解くのではなく、物理的に出発速度が決まる)
  #calc_swingby(i) {
    this.#m_swingby_info[i] = undefined;
    if (i <= 0 || i >= this.#m_count) return;

    const v_in = this.#m_s_c_vel[i - 1] != undefined ? this.#m_s_c_vel[i - 1][1] : undefined;
    const v_pla = this.#m_planet_vel[i];
    const n = this.#m_planet_nums[i];
    if (v_in == undefined || v_pla == undefined || n == undefined || n == -1) return;
    const mu_pla = planet_mu[n];
    if (mu_pla == undefined) return;

    const rp = this.#m_rp[i] ?? planet_radius[n] + MIN_FLYBY_ALTITUDE;
    const beta = this.#m_beta[i] ?? 0;

    try {
      const result = swingby(v_in, v_pla, rp, beta, mu_pla);
      // 到着速度(index 1)は #update_trajectory 側で実際の伝播結果から補完する
      this.#m_s_c_vel[i] = [result.v_out, undefined];
      this.#m_swingby_info[i] = result;
    } catch (e) {
      // v_inがほぼ0など、フライバイの向きを定義できない場合は前回の値を維持する
    }
  }

  #set_s_c(i) {
    if (i < 0 || i >= this.#m_count) return;
    if (this.#m_planet_pos[i] == undefined || this.#m_dates[i] == undefined) return;
    this.#m_s_c_pos[i] = this.#m_planet_pos[i];

    if (this.#m_types[i] === Sequence_Type.Swingby) {
      this.#calc_swingby(i);
    } else if (this.#m_is_auto_mode[i]) {
      if (this.#m_planet_pos[i + 1] != undefined && this.#m_dates[i] != undefined) {
        this.#m_s_c_pos[i + 1] = this.#m_planet_pos[i + 1];
        let time_diff = this.#m_dates[i + 1] - this.#m_dates[i];
        let v_lam = lambert_probrem(MU_SUN, this.#m_s_c_pos[i], this.#m_s_c_pos[i + 1], time_diff * 86400);
        this.#m_s_c_vel[i] = v_lam;
      }
    }
  }

  #update_trajectory(i) {
    if (i < 0 || i >= this.#m_count) return;
    if (this.#m_s_c_pos[i] == undefined || this.#m_s_c_vel[i] == undefined) return;

    if (this.#m_planet_vel[i + 1] != undefined) {
      let par = ic2par(this.#m_s_c_pos[i], this.#m_s_c_vel[i][0], MU_SUN);
      let dt = (this.#m_dates[i + 1] - this.#m_dates[i]) * 86400;
      let E_0 = par[5];
      let M_0 = E2M(E_0, par[1]);
      let dM = (dt / get_peariod(par[0], MU_SUN)) * 2 * Math.PI;
      let M_1 = M_0 + dM;
      let E_1 = solve_kepler(par[1], M_1);

      let p = [];
      let v_end;
      for (let j = 0; j < 100; j++) {
        let { r, v } = get_planets_pos_E(par, E_0 + ((E_1 - E_0) * j) / 99);
        p.push(new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU));
        if (j === 99) v_end = v;
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
  #recompute_all() {
    // set_s_c は i+1 の天体位置(ランベール用)を必要とするため、天体の位置・速度は
    // 先に全ノード分計算しておく。
    for (let i = 0; i < this.#m_count; i++) this.#calc_planet(i);

    // その後、i=0から順に「前レグの到着速度を確定させる(update_trajectory) →
    // このノードの出発速度を決める(set_s_c)」を繰り返す。スイングバイの出発速度は
    // 前レグの到着速度に依存するため、この順序を崩すと未確定のまま参照してしまう。
    for (let i = 0; i < this.#m_count; i++) {
      if (i > 0) this.#update_trajectory(i - 1);
      this.#set_s_c(i);
    }
  }

  get_trajectory(i) {
    if (this.#m_trajectory_arcs[i] == undefined) return [];
    return this.#m_trajectory_arcs[i];
  }

  get_s_c_pos(i) {
    return this.#m_s_c_pos[i];
  }

  // スイングバイノードiの直近の計算結果 (v_inf, delta[曲げ角], eなど) を返す。
  // Swingbyノードでない、または計算できていない場合はnull。
  get_swingby_info(i) {
    return this.#m_swingby_info[i] ?? null;
  }

  planet_num(i) {
    if (i < 0 || i >= this.#m_count) return -1;
    return this.#m_planet_nums[i];
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
    return this.#m_rp[i] ?? (n != undefined && n != -1 ? planet_radius[n] + MIN_FLYBY_ALTITUDE : undefined);
  }

  beta(i) {
    return this.#m_beta[i] ?? 0;
  }

  get count() {
    return this.#m_count;
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
    if (i != 0) {
      if (date - this.#m_dates[i - 1] < 10) return (this.#m_dates[i] = this.#m_dates[i - 1] + 10);
    }
    if (i != this.#m_count - 1) {
      if (this.#m_dates[i + 1] - date < 10) return (this.#m_dates[i] = this.#m_dates[i + 1] - 10);
    }

    this.#m_dates[i] = date;
    this.#recompute_all();
    return date;
  }

  set_type(i, type) {
    this.#m_types[i] = type;
    this.#recompute_all();
  }

  set_auto_mode(i, is_auto) {
    this.#m_is_auto_mode[i] = is_auto;
    this.#recompute_all();
  }

  set_rp(i, rp) {
    this.#m_rp[i] = rp;
    this.#recompute_all();
  }

  set_beta(i, beta) {
    this.#m_beta[i] = beta;
    this.#recompute_all();
  }

  add(idx, date) {
    this.#m_types[0] = Sequence_Type.None;
    this.#m_is_auto_mode.splice(idx, 0, true);
    this.#m_dates.splice(idx, 0, date);
    this.#m_rp.splice(idx, 0, undefined);
    this.#m_beta.splice(idx, 0, 0);

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

    this.#recompute_all();
  }
}
