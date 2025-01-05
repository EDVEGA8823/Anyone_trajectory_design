// import * as vec from "./lib/vector.js"

//諸定数
const MU_SUN = 1.32712440018e11;
const AU = 149597870.7;

let element_0 = [
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
let element_dot = [
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

const i_hat = [1, 0, 0];
const j_hat = [0, 1, 0];
const k_hat = [0, 0, 1];

function solve_kepler(e, M) {
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

function get_planet_elements(T, n) {
  T_TDB = (T - 2451545.0) / 36525.0;
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

function change_coordinate(v) {
  return [v[0], v[2], -v[1]];
}
function get_orbit(elements) {
  pos = [100];
  for (let i = 0; i < 100; i++) {
    let { r, v } = get_planets_pos_E(elements, (2 * Math.PI * i) / 99);
    pos[i] = new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU);
  }
  return pos;
}

function get_W_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  return [Math.sin(W) * Math.sin(i), -Math.cos(W) * Math.sin(i), Math.cos(i)];
}
function get_P_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  return [
    Math.cos(w) * Math.cos(W) - Math.sin(w) * Math.sin(W) * Math.cos(i),
    Math.cos(w) * Math.sin(W) + Math.sin(w) * Math.cos(W) * Math.cos(i),
    Math.sin(w) * Math.sin(i),
  ];
}
function get_Q_hat(elements) {
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  return [
    -Math.sin(w) * Math.cos(W) - Math.cos(w) * Math.sin(W) * Math.cos(i),
    -Math.sin(w) * Math.sin(W) + Math.cos(w) * Math.cos(W) * Math.cos(i),
    Math.cos(w) * Math.sin(i),
  ];
}
function get_planets_pos(elements) {
  return get_planets_pos_E(elements, elements[5]);
}

function get_planets_pos_E(elements, E) {
  let a = elements[0];
  let e = elements[1];
  let i = elements[2];
  let W = elements[3];
  let w = elements[4];
  // console.log(E)

  var P_hat = get_P_hat(elements);
  var Q_hat = get_Q_hat(elements);
  r = [];
  v = [];
  if (e < 1) {
    p = a * (1 - e * e);
    r_n = a * (1 - e * Math.cos(E));
    r = math.add(math.multiply(P_hat, a * (Math.cos(E) - e)), math.multiply(Q_hat, Math.sqrt(a * p) * Math.sin(E)));
    r_norm = math.norm(r);
    v = math.add(
      math.multiply(P_hat, (-Math.sqrt(MU_SUN * a) * Math.sin(E)) / r_norm),
      math.multiply(Q_hat, Math.sqrt(MU_SUN * p * Math.cos(E)) / r_norm)
    );
  } else {
    p = -a * (e * e - 1);
    r_n = -a * (e * Math.cosh(E) - 1);
    r = math.add(math.multiply(P_hat, -a * (e - Math.cosh(E))), math.multiply(Q_hat, Math.sqrt(-a * p) * Math.sinh(E)));
    r_norm = math.norm(r);
    v = math.add(
      math.multiply(P_hat, (Math.sqrt(MU_SUN * -a) * Math.sinh(E)) / r_norm),
      math.multiply(Q_hat, Math.sqrt(MU_SUN * p * Math.cosh(E)) / r_norm)
    );
  }

  return { r, v };
  // return rotate_x(x, y, i, w, W)
}
function ic2par(r, v, mu) {
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

function JulianToDate(julianDay) {
  // ユリウス日をミリ秒に変換
  const timestamp = (julianDay - 2440587.5) * 86400000;

  // Date オブジェクトを作成
  return new Date(timestamp);
}
function DateToJulian(date) {
  const time = date.getTime(); // UTCタイムスタンプ（ミリ秒）
  return time / 86400000 + 2440587.5; // ミリ秒を日に変換し、1970年1月1日のJD基準値を加算
}

function nu2E(nu, e) {
  if (e < 1) return 2 * math.atan(math.sqrt((1 - e) / (1 + e)) * math.tan(nu / 2));
  else return 2 * math.atanh(math.sqrt((e - 1) / (e + 1)) * math.tan(nu / 2));
}

function E2M(E, e) {
  if (e < 1) return E - e * math.sin(E);
  else return e * math.sinh(E) - E;
}

function kepler_equation(a, e, E, μ) {
  if (a > 0) return math.sqrt(a ** 3 / μ) * (E - e * math.sin(E));
  else return math.sqrt((-a) ** 3 / μ) * (e * math.sinh(E) - E);
}
function get_peariod(a, μ) {
  return 2 * Math.PI * Math.sqrt(Math.abs(a) ** 3 / μ);
}

function Dlag_planet() {
  raycaster.setFromCamera(mouse, camera);
  nu = get_nu();

  if (old_nu > 2 && nu < -2) rev_count += 1;
  if (old_nu < -2 && nu > 2) rev_count -= 1;
  a = planet_elements[selected_planet][0];
  e = planet_elements[selected_planet][1];
  // console.log(rev_count)

  old_dE = old_E - Math.round(old_E / 2 / Math.PI) * 2 * Math.PI;

  pre_time = tmp_date;
  tmp_date =
    old_time + (kepler_equation(a, e, nu2E(nu, e), MU_SUN) - kepler_equation(a, e, old_dE, MU_SUN) + get_peariod(a, MU_SUN) * rev_count) / 86400;
  if (tmp_date - pre_time > get_peariod(a, MU_SUN) / 86400) {
    tmp_date = tmp_date - get_peariod(a, MU_SUN) / 86400;
  }
  if (pre_time - tmp_date > get_peariod(a, MU_SUN) / 86400) {
    tmp_date = tmp_date + get_peariod(a, MU_SUN) / 86400;
  }
  // console.log( nu2E(nu, e), old_dE);
  Update_time();
  old_nu = nu;
}
function Select_planet() {
  raycaster.setFromCamera(mouse, camera);

  is_selected = false;

  v = raycaster.ray.direction;
  x_0 = camera.position;
  if (mode == User_Mode.None) {
    for (let i = 0; i < planet_num; i++) {
      p = planet_speres[i].position;
      dist = new THREE.Vector3().subVectors(p, x_0).cross(v).length() / v.length();
      if (dist < 0.015 * camera_dist) {
        selected_planet = i;
        is_selected = true;
        break;
      }
    }
  }
  if (is_selected) {
    planet_speres[selected_planet].children[0].element.style.color = "red";
    old_E = planet_elements[selected_planet][5];
    controls.enableRotate = false;
    is_change_time = true;
    get_nu();
    old_nu = rev_count = 0;
  }
}

function get_nu() {
  vec = get_W_hat(planet_elements[selected_planet]);
  W_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);
  vec = get_P_hat(planet_elements[selected_planet]);
  P_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);

  u = raycaster.ray.direction;
  x_0 = raycaster.ray.origin;
  p = new THREE.Vector3().copy(x_0).sub(u.multiplyScalar(W_hat.dot(x_0) / W_hat.dot(u)));
  return -P_hat.angleTo(p) * -Math.sign(P_hat.cross(p).dot(W_hat));
}

class Mission {
  #m_planet_nums = [];
  #m_dates = [];
  #m_types = [];
  #m_is_auto_mode = [];
  #m_count = 0;

  #m_planet_pos = [];
  #m_planet_vel = [];

  #m_s_c_pos = [];
  #m_s_c_vel = [];

  m_trajectory_arcs = [];

  #calc_planet(i) {
    if (i < 0) return;
    if (this.#m_planet_nums[i] == -1) return;
    let elements = get_planet_elements(this.#m_dates[i], this.#m_planet_nums[i]);
    let { r, v } = get_planets_pos(elements);
    this.#m_planet_pos[i] = r;
    this.#m_planet_vel[i] = v;
  }
  #set_s_c(i) {
    if (i >= this.#m_count) return;
    if (this.#m_planet_pos[i] == undefined || this.#m_dates[i] == undefined) return;
    this.#m_s_c_pos[i] = this.#m_planet_pos[i];

    if (this.#m_is_auto_mode[i]) {
      if (this.#m_planet_pos[i + 1] != undefined && this.#m_dates[i] != undefined) {
        this.#m_s_c_pos[i + 1] = this.#m_planet_pos[i + 1];
        let time_diff = this.#m_dates[i + 1] - this.#m_dates[i];
        v = lambert_probrem(MU_SUN, this.#m_s_c_pos[i], this.#m_s_c_pos[i + 1], time_diff * 86400);
        this.#m_s_c_vel[i] = v;
      }
    }
  }
  #update_trajectory(i) {
    if (i >= this.#m_count) return;
    if (this.#m_s_c_pos[i] == undefined || this.#m_s_c_vel[i] == undefined) return;
    console.log("update_trajectory");

    if (this.#m_planet_vel[i + 1] != undefined) {
      let par = ic2par(this.#m_s_c_pos[i], this.#m_s_c_vel[i][0], MU_SUN);
      let dt = (this.#m_dates[i + 1] - this.#m_dates[i]) * 86400;
      let E_0 = par[5];
      let M_0 = E2M(E_0, par[1]);
      let dM = (dt / get_peariod(par[0], MU_SUN)) * 2 * Math.PI;
      let M_1 = M_0 + dM;
      let E_1 = solve_kepler(par[1], M_1);

      console.log(dt, dM);

      let p = [];
      for (let j = 0; j < 100; j++) {
        let { r, v } = get_planets_pos_E(par, E_0 + ((E_1 - E_0) * j) / 99);
        p.push(new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU));
      }
      this.m_trajectory_arcs[i] = p;
    }
  }
  get_trajectory(i) {
    if (this.m_trajectory_arcs[i] == undefined) return [];

    return this.m_trajectory_arcs[i];
  }

  planet_num(i) {
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
  get count() {
    return this.#m_count;
  }
  set_planet_num(i, num) {
    this.#m_planet_nums[i] = num;
    this.#calc_planet(i);
    this.#set_s_c(i);
    this.#update_trajectory(i);
  }
  set_date(i, date) {
    this.#m_dates[i] = date;
    this.#calc_planet(i);
    this.#set_s_c(i);
    this.#update_trajectory(i);
  }
  set_type(i, type) {
    this.#m_types[i] = type;
  }
  set_auto_mode(i, is_auto) {
    this.#m_is_auto_mode[i] = is_auto;
  }

  add(idx, date) {
    this.#m_types[0] = Sequence_Type.None;
    this.#m_is_auto_mode.splice(idx, 0, true);
    this.#m_dates.splice(idx, 0, date);
    if (this.#m_count != 0) {
      if (idx == 0 && this.#m_dates[1] - this.#m_dates[0] < 30) this.#m_dates[0] = this.#m_dates[1] - 30;
      else if (idx == this.#m_count && this.#m_dates[this.#m_count] - this.#m_dates[this.#m_count - 1] < 30)
        this.#m_dates[this.#m_count] = this.#m_dates[this.#m_count - 1] + 30;
      else if (this.#m_dates[idx] > this.#m_dates[idx - 1] || this.#m_dates[idx] < this.#m_dates[idx + 1])
        this.#m_dates[idx] = (this.#m_dates[idx - 1] + this.#m_dates[idx + 1]) / 2;
    }

    if (idx == 0) this.#m_planet_nums.splice(idx, 0, 2);
    else this.#m_planet_nums.splice(idx, 0, -1);
    this.#m_types.splice(idx, 0, Sequence_Type.None);
    this.#m_types[0] = Sequence_Type.Launch;
    this.#m_count++;

    this.#calc_planet(idx);

    // this.#m_dates[10]=10
    // console.log(this.#m_dates[-1]);
  }
}
