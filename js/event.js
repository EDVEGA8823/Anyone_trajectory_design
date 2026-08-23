import { State, User_Mode, PlotState } from './state.js';
import { change_sequence, change_sequence_propaty, toggle_planet, updateControlPanelDisplay, update_plot } from './main.js';
import { camera, controls, createLine } from './plot.js';
import { get_W_hat, get_P_hat, get_peariod, kepler_equation, nu2E, MU_SUN } from './trajectory.js';
import { JulianToDate, DateToJulian } from './trajectory.js';

let date_time, sequence, confirm_time, cancel_time, v_inf, C3, sequence_panel, plot_area;

export function initEvents() {
  date_time = document.getElementById("date_time");
  sequence = document.getElementById("sequence");
  sequence_panel = document.getElementsByClassName("sequence-panel")[0];
  confirm_time = document.getElementById("confirm_time");
  cancel_time = document.getElementById("cancel_time");
  v_inf = document.getElementById("v_inf");
  C3 = document.getElementById("C3");
  plot_area = document.getElementById("graph-panel");

  confirm_time.addEventListener("click", function () {
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
    change_sequence();
  });

  cancel_time.addEventListener("click", function () {
    State.tmp_date = State.old_date;
    State.tmp_date = State.mission_sequence.set_date(State.selected_sequence, State.old_date);
    Update_time();
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
  });

  sequence_panel.addEventListener("click", handleSequencePanelClick);

  date_time.addEventListener("change", function () {
    State.tmp_date = DateToJulian(new Date(date_time.value));
    Update_time();
  });

  // Mouse and Touch events for Plot area
  plot_area.addEventListener("mousedown", handleMouseDown);
  plot_area.addEventListener("mouseup", handleMouseUp);
  plot_area.addEventListener("mousemove", handleMouseMove);

  plot_area.addEventListener("touchstart", handleTouchStart);
  plot_area.addEventListener("touchend", handleTouchEnd);
  plot_area.addEventListener("touchmove", handleTouchMove);
}

function handleSequencePanelClick(event) {
  if (event.target.className == "add_sequence") {
    State.selected_sequence = Number(event.target.id);
    State.mission_sequence.add(State.selected_sequence, State.tmp_date);
    const points = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
    State.arcs.splice(State.selected_sequence, 0, createLine(points, 0x0000ff));
    updateAfterAdd();
    return;
  } else if (event.target.className == "sequence-panel") {
    State.selected_sequence = -1;
  } else {
    State.selected_sequence = Number(event.target.id);
  }
  
  if (isNaN(State.selected_sequence)) State.selected_sequence = -1;
  updateAfterAdd();
}

function updateAfterAdd() {
  updateControlPanelDisplay();
  change_sequence();
  change_sequence_propaty();
  toggle_planet();
  if (State.selected_sequence != -1) {
    State.tmp_date = State.mission_sequence.date(State.selected_sequence);
    State.old_date = State.tmp_date;
    Update_time();
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
  }
}

export function Update_time() {
  if (!State.mission_sequence) return;
  State.tmp_date = State.mission_sequence.set_date(State.selected_sequence, State.tmp_date);
  date_time.value = JulianToDate(State.tmp_date)
    .toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replaceAll("/", "-");
  
  confirm_time.style.visibility = "Visible";
  cancel_time.style.visibility = "Visible";
  update_plot();
  let v = State.mission_sequence.get_v_inf(State.selected_sequence);
  v_inf.textContent = v.toFixed(2);
  C3.textContent = (v * v).toFixed(2);
}

// --------------------- Mouse / Touch Handlers ---------------------

function handleTouchStart(event) {
  if (event.touches.length != 1) return;
  State.old_time = State.tmp_date;
  const element = event.currentTarget;
  const x = event.touches[0].clientX - element.offsetLeft;
  const y = event.touches[0].clientY - element.offsetTop;
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  State.mouse.x = (x / w) * 2 - 1;
  State.mouse.y = -(y / h) * 2 + 1 - 0.04;

  Select_planet();
}

function handleTouchMove(event) {
  if (!State.is_change_time) return;
  const element = event.currentTarget;
  const x = event.touches[0].clientX - element.offsetLeft;
  const y = event.touches[0].clientY - element.offsetTop;
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  State.mouse.x = (x / w) * 2 - 1;
  State.mouse.y = -(y / h) * 2 + 1 - 0.04;

  Dlag_planet();
}

function handleTouchEnd(event) {
  if (event.touches.length != 0) return;
  if(State.selected_planet !== -1 && PlotState.planet_speres[State.selected_planet]) {
      PlotState.planet_speres[State.selected_planet].children[0].element.style.color = "black";
  }
  if(controls) controls.enableRotate = true;
  State.is_change_time = false;
}

function handleMouseDown(event) {
  if (event.button != 0) return;
  State.old_time = State.tmp_date;
  const element = event.currentTarget;
  const x = event.clientX - element.offsetLeft;
  const y = event.clientY - element.offsetTop;
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  State.mouse.x = (x / w) * 2 - 1;
  State.mouse.y = -(y / h) * 2 + 1 - 0.04;

  Select_planet();
}

function handleMouseMove(event) {
  if (!State.is_change_time) return;
  const element = event.currentTarget;
  const x = event.clientX - element.offsetLeft;
  const y = event.clientY - element.offsetTop;
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  State.mouse.x = (x / w) * 2 - 1;
  State.mouse.y = -(y / h) * 2 + 1 - 0.04;

  Dlag_planet();
}

function handleMouseUp(event) {
  if (event.button != 0) return;
  if(State.selected_planet !== -1 && PlotState.planet_speres[State.selected_planet]) {
    PlotState.planet_speres[State.selected_planet].children[0].element.style.color = "black";
  }
  if(controls) controls.enableRotate = true;
  State.is_change_time = false;
}

function Select_planet() {
  State.raycaster.setFromCamera(State.mouse, camera);
  State.is_selected = false;

  let v = State.raycaster.ray.direction;
  let x_0 = camera.position;
  
  if (State.mode == User_Mode.None) {
    for (let i = 0; i < State.planet_num; i++) {
        // 非表示中(toggle_planetで隠された惑星)はヒットテスト対象から除外する。
        // 位置は非表示でも毎フレーム更新され続けるため、除外しないと見えていない
        // 惑星がクリックを奪ってしまい、時刻変更が発動せずカメラ回転にフォール
        // スルーする不具合の原因になっていた。
        if(!PlotState.planet_speres[i] || !PlotState.planet_speres[i].visible) continue;
      let p = PlotState.planet_speres[i].position;
      let dist = new THREE.Vector3().subVectors(p, x_0).cross(v).length() / v.length();
      if (dist < 0.015 * PlotState.camera_dist) {
        State.selected_planet = i;
        State.is_selected = true;
        break;
      }
    }
  }
  
  if (State.is_selected) {
    // シーケンスに割り当てられた惑星と一致するかで発動を制限していたが、
    // リファクタリング前には無かった制約で、一致しない(が見えている)惑星を
    // クリックすると時刻変更が発動せずカメラ回転にフォールスルーしてしまう
    // 不具合の原因だったため撤去し、惑星をクリックしたら常に時刻変更モードに
    // 入る元の挙動に戻す。
    PlotState.planet_speres[State.selected_planet].children[0].element.style.color = "red";
    State.old_E = State.planet_elements[State.selected_planet][5];
    if(controls) controls.enableRotate = false;
    State.is_change_time = true;
    get_nu();
    State.old_nu = 0;
    State.rev_count = 0;
  }
}

function Dlag_planet() {
  State.raycaster.setFromCamera(State.mouse, camera);
  let nu = get_nu();

  if (State.old_nu > 2 && nu < -2) State.rev_count += 1;
  if (State.old_nu < -2 && nu > 2) State.rev_count -= 1;
  
  let a = State.planet_elements[State.selected_planet][0];
  let e = State.planet_elements[State.selected_planet][1];

  let old_dE = State.old_E - Math.round(State.old_E / 2 / Math.PI) * 2 * Math.PI;

  let pre_time = State.tmp_date;
  State.tmp_date = State.old_time + (kepler_equation(a, e, nu2E(nu, e), MU_SUN) - kepler_equation(a, e, old_dE, MU_SUN) + get_peariod(a, MU_SUN) * State.rev_count) / 86400;
  
  if (State.tmp_date - pre_time > get_peariod(a, MU_SUN) / 86400) {
    State.tmp_date = State.tmp_date - get_peariod(a, MU_SUN) / 86400;
  }
  if (pre_time - State.tmp_date > get_peariod(a, MU_SUN) / 86400) {
    State.tmp_date = State.tmp_date + get_peariod(a, MU_SUN) / 86400;
  }
  
  Update_time();
  State.old_nu = nu;
}

function get_nu() {
  let vec1 = get_W_hat(State.planet_elements[State.selected_planet]);
  let W_hat = new THREE.Vector3(vec1[0], vec1[2], -vec1[1]);
  
  let vec2 = get_P_hat(State.planet_elements[State.selected_planet]);
  let P_hat = new THREE.Vector3(vec2[0], vec2[2], -vec2[1]);

  let u = State.raycaster.ray.direction;
  let x_0 = State.raycaster.ray.origin;
  let p = new THREE.Vector3().copy(x_0).sub(u.multiplyScalar(W_hat.dot(x_0) / W_hat.dot(u)));
  return -P_hat.angleTo(p) * -Math.sign(P_hat.cross(p).dot(W_hat));
}
