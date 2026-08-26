import { State, Sequence_Type, PlotState } from './state.js';
import { get_planet_elements, get_orbit, get_planets_pos, JulianToDate, Mission, AU } from './trajectory.js';
import {
  initPlot,
  update_planets,
  updateLine,
  createLine,
  createDashedLine,
  updateDashedLine,
  createPlanets,
  updateLayout,
} from './plot.js';
import { initEvents, Update_time } from './event.js';
import { initBPlane, updateBPlane, setBPlaneHandlers, setBPlaneActiveHandle } from './bplane.js';

export function add_sequence(id) {
  let sequence_elem = document.createElement("div");
  sequence_elem.className = "sequence";
  sequence_elem.title = id + 1 + ".  " + State.mission_sequence.type(id);
  if (id == State.selected_sequence) sequence_elem.classList.add("selected");
  
  const span1 = document.createElement("span");
  if (State.mission_sequence.type(id) === Sequence_Type.Maneuver) {
    // マヌーバ(DSM)は天体ではなく深宇宙の一点なので、天体名の代わりにΔVを出す
    const dsm = State.mission_sequence.get_dsm_info(id);
    span1.textContent = dsm ? "ΔV " + (dsm.dv * 1000).toFixed(0) + " m/s" : "深宇宙";
  } else if (State.mission_sequence.planet_num(id) == -1) {
    span1.textContent = "---";
  } else {
    span1.textContent = State.planet_list[State.mission_sequence.planet_num(id)];
  }

  const span2 = document.createElement("span");
  span2.textContent = JulianToDate(State.mission_sequence.date(id)).toLocaleDateString();

  span1.id = id;
  span2.id = id;
  sequence_elem.appendChild(span1);
  sequence_elem.appendChild(span2);
  sequence_elem.id = id;

  const sequence = document.getElementById("sequence");
  sequence.appendChild(sequence_elem);

  let add_sequence_elem = document.createElement("div");
  add_sequence_elem.className = "add_sequence";
  add_sequence_elem.id = id + 1;
  add_sequence_elem.textContent = "+ シーケンスを追加";
  sequence.appendChild(add_sequence_elem);
}

export function change_sequence() {
  const sequence = document.getElementById("sequence");

  while (sequence.firstChild) {
    sequence.removeChild(sequence.firstChild);
  }
  let add_sequence_elem = document.createElement("div");
  add_sequence_elem.className = "add_sequence";
  add_sequence_elem.id = 0;
  add_sequence_elem.textContent = "+ シーケンスを追加";
  sequence.appendChild(add_sequence_elem);

  for (let i = 0; i < State.mission_sequence.count; i++) {
    add_sequence(i);
  }
  let v = State.mission_sequence.get_v_inf(State.selected_sequence);
  const v_inf = document.getElementById("v_inf");
  const C3 = document.getElementById("C3");
  v_inf.textContent = v.toFixed(2);
  C3.textContent = (v * v).toFixed(2);

  const total_dv = document.getElementById("total_dv");
  total_dv.textContent = (State.mission_sequence.get_total_dv() * 1000).toFixed(1); // km/s -> m/s
}

export function change_sequence_propaty() {
  const select = document.getElementById("propaty");
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }
  let option0 = document.createElement("option");
  option0.text = "---";
  option0.value = "default";
  option0.hidden = true;
  option0.selected = true;
  select.add(option0);

  State.planet_list.forEach((element) => {
    let option = document.createElement("option");
    option.text = element;
    option.value = element;
    select.add(option);
  });
  select.selectedIndex = State.mission_sequence.planet_num(State.selected_sequence) + 1;
  select.onchange = async function () {
    await State.mission_sequence.set_planet_num(State.selected_sequence, select.selectedIndex - 1);
    change_sequence();
    update_plot();
    toggle_planet();
  };

  const sequence_propaty = document.getElementById("sequence_propaty");
  while (sequence_propaty.firstChild) {
    sequence_propaty.removeChild(sequence_propaty.firstChild);
  }

  if (State.selected_sequence != 0) {
    let option1 = document.createElement("option");
    option1.text = "変更";
    option1.value = "default";
    option1.hidden = true;
    option1.selected = true;
    sequence_propaty.add(option1);

    Object.values(Sequence_Type).forEach((value, i) => {
      let option = document.createElement("option");
      option.text = value;
      option.value = value;
      if (i > 1) {
        if (State.mission_sequence.planet_num(State.selected_sequence) < 10) {
          if (value != Sequence_Type.Flyby && value != Sequence_Type.Rendezvous) {
            sequence_propaty.add(option);
          }
        } else {
          if (value != Sequence_Type.Swingby && value != Sequence_Type.Orbit) {
            sequence_propaty.add(option);
          }
        }
      }
    });
  }
  const sequence_type = document.getElementById("sequence_type");

  sequence_propaty.onchange = function () {
    State.mission_sequence.set_type(State.selected_sequence, sequence_propaty.value);
    change_sequence();
    update_plot();
    updateControlPanelDisplay();
    sequence_propaty.selectedIndex = 0;
    sequence_type.textContent = State.mission_sequence.type(State.selected_sequence);
  };

  sequence_type.textContent = State.mission_sequence.type(State.selected_sequence);
}

export function calc() {
  let planet_pos = new Array(State.planet_num);
  let planet_orbits = new Array(State.planet_num);
  for (let i = 0; i < State.planet_num; i++) {
    let elements = get_planet_elements(State.tmp_date, i);
    State.planet_elements[i] = elements;
    let orbit = get_orbit(elements);
    let { r, v } = get_planets_pos(elements);
    planet_pos[i] = r;
    planet_orbits[i] = orbit;
  }
  return [planet_pos, planet_orbits];
}

export function update_plot() {
  let [planet_pos, planet_orbits] = calc();
  update_planets(planet_pos);

  planet_orbits.forEach((orbit, i) => {
    updateLine(PlotState.orbit_lines[i], orbit);
  });
  
  for (let i = 0; i < State.mission_sequence.count; i++) {
    if (State.mission_sequence.get_trajectory(i).length != 0) {
      // Missionは手動スイングバイ時にマヌーバノードを自前で挿入するため、
      // ノード数が増えて arcs が足りなくなることがある。足りなければここで作る。
      if (State.arcs[i] == undefined) {
        const points = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
        State.arcs[i] = createLine(points, 0x0000ff);
      }
      updateLine(State.arcs[i], State.mission_sequence.get_trajectory(i));
    }
  }
}

export function make_plot() {
  // `initPlot` must be done before we add lines
  let [planet_pos, planet_orbits] = calc();
  createPlanets(planet_pos);

  planet_orbits.forEach((orbit) => {
    PlotState.orbit_lines.push(createLine(orbit, 0x999999));
  });
}

export function toggle_planet() {
  // マヌーバ(DSM)ノードは天体を持たない(planet_num == -1)ので、
  // 天体の有無だけで判定するとマーカーが出なくなる。種別も見て判定する。
  const is_maneuver =
    State.selected_sequence != -1 &&
    State.mission_sequence.type(State.selected_sequence) === Sequence_Type.Maneuver;

  if (
    State.selected_sequence != -1 &&
    (State.mission_sequence.planet_num(State.selected_sequence) != -1 || is_maneuver)
  ) {
    for (let i = 0; i < PlotState.orbit_lines.length; i++) {
      toggle_visibility(i, false);
    }
    for (let i = 0; i < 3; i++) {
      let n = State.selected_sequence + i - 1;
      let pos = State.mission_sequence.get_s_c_pos(n);
      if (pos != undefined) {
        PlotState.marker_spheres[i].visible = true;
        PlotState.marker_spheres[i].position.set(pos[0] / AU, pos[2] / AU, -pos[1] / AU);
      } else PlotState.marker_spheres[i].visible = false;
    }
  } else {
    for (let i = 0; i < PlotState.orbit_lines.length; i++) {
      toggle_visibility(i, true);
    }
    for (let i = 0; i < 3; i++) {
      PlotState.marker_spheres[i].visible = false;
    }
  }

  if (State.mission_sequence.planet_num(State.selected_sequence - 1) != -1) {
    toggle_visibility(State.mission_sequence.planet_num(State.selected_sequence - 1), true);
  }
  if (State.mission_sequence.planet_num(State.selected_sequence) != -1) {
    toggle_visibility(State.mission_sequence.planet_num(State.selected_sequence), true);
  }
  if (State.mission_sequence.planet_num(State.selected_sequence + 1) != -1) {
    toggle_visibility(State.mission_sequence.planet_num(State.selected_sequence + 1), true);
  }

  update_coast_orbit();
}

// マヌーバ(DSM)ノードを選択中は、「マヌーバを実行しなかった場合に
// そのまま流されていく軌道」を赤い破線で表示する。
export function update_coast_orbit() {
  const i = State.selected_sequence;
  const show =
    i != -1 &&
    State.mission_sequence &&
    State.mission_sequence.type(i) === Sequence_Type.Maneuver;

  if (!show) {
    if (PlotState.coast_line) PlotState.coast_line.line.visible = false;
    return;
  }

  const pts = State.mission_sequence.get_coast_orbit(i);
  if (pts.length === 0) {
    if (PlotState.coast_line) PlotState.coast_line.line.visible = false;
    return;
  }

  // updateLineは余った頂点を(0,0,0)で埋めるため、確保数と実際の点数がずれると
  // 原点へ伸びる線が描かれてしまう。点数がちょうど合うように確保する。
  if (PlotState.coast_line == undefined || PlotState.coast_line.positions.length !== pts.length * 3) {
    if (PlotState.coast_line) PlotState.coast_line.line.visible = false;
    PlotState.coast_line = createDashedLine(pts.length);
  }
  updateDashedLine(PlotState.coast_line, pts);
  PlotState.coast_line.line.visible = true;
}

export function toggle_visibility(i, visible) {
  if (PlotState.orbit_lines[i]) PlotState.orbit_lines[i].line.visible = visible;
  if (PlotState.planet_speres[i]) {
    PlotState.planet_speres[i].visible = visible;
    if (visible) {
      PlotState.planet_speres[i].children[0].element.innerHTML = State.planet_list[i];
    } else {
      PlotState.planet_speres[i].children[0].element.innerHTML = "";
    }
  }
}

export function updateControlPanelDisplay() {
  const alway = document.getElementsByClassName("alway");
  for (let i = 0; i < alway.length; i++) {
    if (State.selected_sequence != -1) {
      alway[i].style.display = "flex";
    } else {
      alway[i].style.display = "none";
    }
  }

  const is_swingby =
    State.selected_sequence != -1 &&
    State.mission_sequence &&
    State.mission_sequence.type(State.selected_sequence) === Sequence_Type.Swingby;
  const swingby_only = document.getElementsByClassName("swingby-only");
  for (let i = 0; i < swingby_only.length; i++) {
    swingby_only[i].style.display = is_swingby ? "flex" : "none";
  }
  if (is_swingby) updateBPlaneView();
}

// 現在選択中のシーケンスのスイングバイパラメータをB面ビューと右側UIに反映する
export function updateBPlaneView() {
  const i = State.selected_sequence;
  if (i == -1 || !State.mission_sequence) return;
  const planetNum = State.mission_sequence.planet_num(i);
  if (planetNum == -1) return;

  const rp = State.mission_sequence.rp(i);
  const beta = State.mission_sequence.beta(i);
  const info = State.mission_sequence.get_swingby_info(i);
  updateBPlane({
    planetNum,
    // 表示対象が変わったときだけB面ビューの画角を取り直させる
    key: i + ":" + planetNum,
    rp,
    beta,
    vinf: info ? info.v_inf_in : undefined,
    dv: info ? info.dv_periapsis : 0,
    planetVel: State.mission_sequence.planet_vel(i),
    planetPos: State.mission_sequence.planet_pos(i),
    iHat: info ? info.i_hat : undefined,
    jHat: info ? info.j_hat : undefined,
    kHat: info ? info.k_hat : undefined,
  });
  renderSwingbyControls();
}

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// スイングバイの自動/手動切り替えUIと、パラメータの表示/入力欄を描画する。
// 自動 (MGA): 前後のランベール弧を繋ぎ、向きの差はrp/betaで、大きさの差は
//       近点ΔV(パワード・フライバイ)で吸収して次の天体に正確に到達する
//       (rp/beta/ΔVは計算結果)。
// 手動 (MGA-1DSM): ユーザーがrp/betaを指定して無推力で曲げ、直後に自動挿入される
//       マヌーバ(DSM)ノードのΔVで次の天体へ到達させる。DSMの位置はその
//       マヌーバノードの日付で決まる(選択して時刻を変えられる)。
export function renderSwingbyControls() {
  const i = State.selected_sequence;
  const container = document.querySelector(".swingby-controls");
  if (!container || i == -1 || !State.mission_sequence) return;

  const is_auto = State.mission_sequence.is_auto_mode(i);
  const info = State.mission_sequence.get_swingby_info(i);

  // 自動モードや別のノードに移ったらマウスハンドルは引っ込める
  if (State.swingby_handle && (is_auto || handle_seq !== i)) setSwingbyHandle(null);

  container.innerHTML = "";

  // 自動/手動の切り替えは見出しの横に置く (狭い数値欄の縦を使わないため)
  const modeRow = document.getElementById("swingby_mode");
  if (modeRow) modeRow.innerHTML = "";

  const autoBtn = document.createElement("button");
  autoBtn.type = "button";
  autoBtn.textContent = "自動";
  autoBtn.className = "mode-btn" + (is_auto ? " active" : "");
  autoBtn.onclick = () => {
    State.mission_sequence.set_auto_mode(i, true);
    update_plot();
    change_sequence();
    updateBPlaneView();
  };

  const manualBtn = document.createElement("button");
  manualBtn.type = "button";
  manualBtn.textContent = "手動";
  manualBtn.className = "mode-btn" + (!is_auto ? " active" : "");
  manualBtn.onclick = () => {
    State.mission_sequence.set_auto_mode(i, false);
    update_plot();
    change_sequence();
    updateBPlaneView();
  };

  if (modeRow) {
    modeRow.appendChild(autoBtn);
    modeRow.appendChild(manualBtn);
  }

  if (is_auto) {
    if (info) {
      // rpは下限でクランプ済みなので、必要な曲げ角に届かない場合は
      // その不足分が近点ΔVに乗る。クランプされた事実は値の脇に添えるだけにする。
      const rpText =
        info.rp != undefined
          ? info.rp.toFixed(0) + " km" + (info.rp_clamped ? " (下限)" : "")
          : "-";
      const rows = [
        ["侵入速度", info.v_inf_in.toFixed(3) + " km/s"],
        ["脱出速度", info.v_inf_out.toFixed(3) + " km/s"],
        ["曲げ角", (info.delta * RAD2DEG).toFixed(1) + "°"],
        ["近点半径", rpText],
        ["近点ΔV", (info.dv_periapsis * 1000).toFixed(1) + " m/s"],
      ];
      if (info.turn_deficit > 1e-9) {
        rows.push(["曲げ不足", (info.turn_deficit * RAD2DEG).toFixed(1) + "°"]);
      }
      container.appendChild(makeReadout(rows));
    } else {
      const readout = document.createElement("div");
      readout.className = "swingby-readout";
      readout.textContent = "前後のレグが決まると自動計算されます";
      container.appendChild(readout);
    }
  } else {
    const form = document.createElement("div");
    form.className = "column swingby-inputs";
    const rp = State.mission_sequence.rp(i);
    const beta = State.mission_sequence.beta(i);

    const min_rp = State.mission_sequence.min_rp(i);

    const rpLabel = document.createElement("label");
    rpLabel.textContent = "近点半径 rp [km]";
    const rpInput = document.createElement("input");
    rpInput.type = "number";
    rpInput.step = "100";
    if (min_rp != undefined) rpInput.min = String(Math.ceil(min_rp));
    rpInput.value = rp != undefined ? rp.toFixed(0) : "";
    rpInput.onchange = () => {
      State.mission_sequence.set_rp(i, Number(rpInput.value));
      update_plot();
      // 下限でクランプされた場合は入力欄の表示も実際の値に合わせる
      const applied = State.mission_sequence.rp(i);
      if (applied != undefined) rpInput.value = applied.toFixed(0);
      updateBPlaneView();
    };

    const betaLabel = document.createElement("label");
    betaLabel.textContent = "回転角 β [deg]";
    const betaInput = document.createElement("input");
    betaInput.type = "number";
    betaInput.step = "5";
    betaInput.value = (beta * RAD2DEG).toFixed(1);
    betaInput.onchange = () => {
      State.mission_sequence.set_beta(i, Number(betaInput.value) * DEG2RAD);
      update_plot();
      updateBPlaneView();
    };

    // 欄を選ぶと、その欄に対応するハンドルがB面ビューに出てマウスで動かせる。
    // 常に掴めるものを出しておくとカメラ操作の邪魔になるので、選択制にしている。
    const rpField = makeParamField("rp", rpLabel, rpInput);
    if (min_rp != undefined) {
      const note = document.createElement("div");
      note.className = "swingby-hint";
      note.textContent = `下限 ${min_rp.toFixed(0)} km (大気・放射線帯)`;
      rpField.appendChild(note);
    }
    form.appendChild(rpField);
    form.appendChild(makeParamField("beta", betaLabel, betaInput));
    container.appendChild(form);

    // 自動と同じく、フライバイの結果(速度・曲げ角)も併記する。
    // 手動は無推力なので侵入速度と脱出速度は同じ大きさになり(1行にまとめる)、
    // 目的地への到達は直後のマヌーバ(DSM)のΔVが担う。
    if (info) {
      const rows = [
        ["侵入/脱出速度", info.v_inf_in.toFixed(3) + " km/s"],
        ["曲げ角", (info.delta * RAD2DEG).toFixed(1) + "°"],
      ];
      const dsm = State.mission_sequence.get_dsm_info(i + 1);
      if (dsm) rows.push(["DSMのΔV", (dsm.dv * 1000).toFixed(1) + " m/s"]);
      container.appendChild(makeReadout(rows));
    }
  }
}

// マウスハンドルを出しているシーケンス番号 (別のノードに移ったら消すため)
let handle_seq = -1;

// B面ビューのハンドルの出し分け。keyは "rp" | "beta" | null
export function setSwingbyHandle(key) {
  State.swingby_handle = key;
  handle_seq = key ? State.selected_sequence : -1;
  setBPlaneActiveHandle(key);
}

// ラベルと入力欄を、クリックでハンドルを出せる1つの欄にまとめる。
// 選択中の欄のラベルをもう一度押すとハンドルを消す (カメラ操作に戻れるように)。
function makeParamField(key, label, input) {
  const field = document.createElement("div");
  field.className = "column param-field param-field--" + key;
  if (State.swingby_handle === key) field.classList.add("active");
  field.appendChild(label);
  field.appendChild(input);
  field.addEventListener("click", (event) => {
    const on_label = event.target === label;
    setSwingbyHandle(State.swingby_handle === key && on_label ? null : key);
    // ここでDOMを作り直すと入力欄のフォーカスが飛ぶので、見た目だけ切り替える
    document
      .querySelectorAll(".param-field")
      .forEach((el) => el.classList.toggle("active", el.classList.contains("param-field--" + State.swingby_handle)));
  });
  return field;
}

// [項目名, 値] の並びを、幅の狭い1カラムに積んで表示する
function makeReadout(rows) {
  const readout = document.createElement("div");
  readout.className = "swingby-readout";
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "row swingby-readout-row";
    row.innerHTML = `<span>${label}</span><span>${value}</span>`;
    readout.appendChild(row);
  });
  return readout;
}

// B面ビューのハンドルをドラッグしている間の反映。
// 入力欄に打ち込んだときと同じ経路を通す (下限クランプもMission側で効く)。
function apply_rp_from_drag(rp) {
  const i = State.selected_sequence;
  if (i == -1 || !State.mission_sequence) return;
  State.mission_sequence.set_rp(i, rp);
  refresh_after_swingby_change();
}

function apply_beta_from_drag(beta) {
  const i = State.selected_sequence;
  if (i == -1 || !State.mission_sequence) return;
  State.mission_sequence.set_beta(i, beta);
  refresh_after_swingby_change();
}

function refresh_after_swingby_change() {
  update_plot();
  change_sequence(); // マヌーバのΔVと総ΔVの表示を追従させる
  updateBPlaneView();
}

// ========================================
// Main execution / initialization
// ========================================
function boot() {
  // Initialize Mission
  State.mission_sequence = new Mission();
  
  // Set up events
  initEvents();

  // Initial UI updates
  updateControlPanelDisplay();
  change_sequence();
  change_sequence_propaty();

  // Setup three.js
  initPlot();
  make_plot();
  updateLayout();
  initBPlane();
  setBPlaneHandlers({ onRp: apply_rp_from_drag, onBeta: apply_beta_from_drag });

  // Update time for the initial load
  Update_time();
}

boot();
