import { State, User_Mode, PlotState, Sequence_Type } from './state.js';
import {
  change_sequence,
  change_sequence_propaty,
  clear_checks,
  renderLegEvents,
  update_stat_bar,
  toggle_planet,
  updateControlPanelDisplay,
  update_plot,
  update_sequence_times,
} from './main.js';
import { camera, controls, createLine, getZScale } from './plot.js';
import { coast_anomalies, kepler_equation, MU_SUN } from './trajectory.js';
import { buildOrbitSamples, pickAnomaly } from './orbit_pick.js';
import { JulianToDate, DateToJulian } from './trajectory.js';

let date_time, sequence, confirm_time, cancel_time, v_inf, C3, total_dv, sequence_panel, plot_area, edit_target;

// 惑星やノードのマーカーを掴める範囲。カメラ距離に比例させることで、
// ズームしても画面上の当たり判定の広さが変わらないようにしている。
// 画面上の半径にすると 縦の画角(2*tan(fov/2)=0.536) から
//   PICK_RADIUS / 0.536 ≒ 画面高さの 3.4% (キャンバス700pxで24px程度)
// マーカーの見た目(半径 0.0036〜0.006 * カメラ距離)より広いが、
// 掴んでドラッグする操作なのでこのくらいの余裕を持たせている。
const PICK_RADIUS = 0.018;

export function initEvents() {
  date_time = document.getElementById("date_time");
  sequence = document.getElementById("sequence");
  sequence_panel = document.getElementsByClassName("sequence-panel")[0];
  confirm_time = document.getElementById("confirm_time");
  cancel_time = document.getElementById("cancel_time");
  edit_target = document.getElementById("edit_target");
  v_inf = document.getElementById("v_inf");
  C3 = document.getElementById("C3");
  total_dv = document.getElementById("total_dv");
  plot_area = document.getElementById("graph-panel");

  confirm_time.addEventListener("click", function () {
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
    change_sequence();
  });

  cancel_time.addEventListener("click", function () {
    // set_dateはUpdate_timeが呼ぶ。ここで直接動かしてしまうと差分が0になり、
    // 一緒に動かしたチェック済みノードが戻らなくなる。
    State.tmp_date = State.old_date;
    Update_time();
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
  });

  // 時刻の微調整。マウスでの大まかな移動に対して、こちらは決まった日数だけ動かす。
  // 通常の時刻変更と同じ経路(Update_time)を通るので、前後の最小間隔でのクリップも
  // チェックしたノードの追従も同じように効く。
  document.querySelectorAll(".date-nudge button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (State.editing_sequence == -1) return;
      State.tmp_date += Number(btn.dataset.days);
      Update_time();
    });
  });

  sequence_panel.addEventListener("click", handleSequencePanelClick);

  const deselect_btn = document.getElementById("deselect_sequence");
  if (deselect_btn) deselect_btn.addEventListener("click", deselectSequence);

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
    const at = Number(event.target.id);
    // DSMが同時に挿入されると新しいノードは後ろにずれるので、実際の位置を受け取る
    State.selected_sequence = State.mission_sequence.add(at, State.tmp_date);
    const points = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
    State.arcs.splice(at, 0, createLine(points, 0x0000ff));
    clear_checks(); // ノードが増えて添字がずれるため
    updateAfterAdd();
    return;
  }

  // 枠の中は何段かに分かれているので、押された要素そのものではなく
  // それが属する枠を探す (枠の外を押したら選択を外す)
  const card = event.target.closest(".sequence");
  State.selected_sequence = card ? Number(card.id) : -1;

  if (isNaN(State.selected_sequence)) State.selected_sequence = -1;
  updateAfterAdd();
}

// 操作パネルの閉じるボタン。一覧の何もないところを押すのと同じ選択解除だが、
// 「押せば選択が外れる」ことがそちらより分かりやすい入口として置いている。
export function deselectSequence() {
  State.selected_sequence = -1;
  updateAfterAdd();
}

// チェックしたシーケンスをまとめて削除する。
// 後ろから消していけば、まだ消していないノードの番号がずれない。
// (手動モードのノードを消すと相棒のDSMも一緒に消えるが、それも後ろ側なので同じ)
// マヌーバ(DSM)は自動/手動に付随するノードなので remove が受け付けず、
// 持ち主ごと消された場合を除いて残る。
export function delete_checked() {
  const mission = State.mission_sequence;
  if (!mission || State.checked.size === 0) return;

  const targets = Array.from(State.checked).sort((a, b) => b - a);
  const first = targets[targets.length - 1];
  let removed = 0;
  for (const i of targets) {
    if (mission.remove(i)) removed++;
  }
  if (removed === 0) {
    clear_checks();
    return;
  }

  // 選択中ノードは、消えた範囲より前ならそのまま、そうでなければ手前に寄せる
  const sel = Math.min(State.selected_sequence, first);
  State.selected_sequence = mission.count === 0 ? -1 : Math.max(Math.min(sel, mission.count - 1), 0);

  clear_checks();
  update_plot();
  updateAfterAdd();
}

// シーケンスの枠内のゴミ箱ボタンから呼ばれる。
// 手動モードのノードを消すと相棒のDSMも一緒に消えるので、消えた個数を見て
// 選択位置を詰め直す。
export function delete_sequence(i) {
  const mission = State.mission_sequence;
  if (!mission) return;

  const before = mission.count;
  if (!mission.remove(i)) return;
  clear_checks(); // ノードが減って添字がずれるため
  const removed = before - mission.count;

  let sel = State.selected_sequence;
  if (sel >= i) sel = sel >= i + removed ? sel - removed : i; // 消えたノードを選んでいたらその位置へ
  sel = Math.min(sel, mission.count - 1);
  State.selected_sequence = mission.count === 0 ? -1 : Math.max(sel, 0);

  update_plot();
  updateAfterAdd();
}

// シーケンスの並びが丸ごと変わったあとの作り直し。
// ノードの追加・削除のほか、ファイルからの読み込みでも使う。
export function updateAfterAdd() {
  updateControlPanelDisplay();
  change_sequence();
  change_sequence_propaty();
  toggle_planet();
  // シーケンスを選び直したら時刻編集の対象も選択中ノードに戻す
  State.editing_sequence = -1;
  set_edit_target(State.selected_sequence);
  if (State.selected_sequence != -1) {
    Update_time();
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
  }
  update_edit_target_label();
  renderLegEvents();
}

// 時刻編集の対象ノードを切り替える。
// 選択中のシーケンス(B面や種別を表示しているノード)とは独立に、その前後の
// ノードの時刻も動かせるようにするための仕組み。tmp_dateは常に「編集対象
// ノードの日付」を指すので、対象を変えたら表示時刻もそのノードに合わせる。
function set_edit_target(n) {
  if (State.editing_sequence !== n) {
    State.editing_sequence = n;
    // キャンセル用の基準は対象が変わったときだけ取り直す
    if (n != -1) State.old_date = State.mission_sequence.date(n);
  }
  if (n == -1) return;
  const date = State.mission_sequence.date(n);
  const moved = State.tmp_date !== date;
  State.tmp_date = date;
  // 表示時刻が動いたら惑星の軌道要素(State.planet_elements)を取り直す。
  // ドラッグで掴む軌道はこの時刻基準の要素から作るので、ここで揃えておく。
  if (moved) update_plot();
}

// どのノードの時刻を編集しているかを時刻欄の横に表示する。
function update_edit_target_label() {
  if (!edit_target) return;
  const n = State.editing_sequence;
  if (n == -1 || !State.mission_sequence || n >= State.mission_sequence.count) {
    edit_target.textContent = "";
    edit_target.classList.remove("other");
    return;
  }
  const p = State.mission_sequence.planet_num(n);
  const name = p == -1 ? State.mission_sequence.type(n) : State.planet_list[p];
  edit_target.textContent = n + 1 + ". " + name;
  edit_target.classList.toggle("other", n !== State.selected_sequence);
}

/**
 * チェックしたノードを、いま動かしたノードと同じ差分だけ動かす。
 * レグの間隔を保ったまま打上げ窓ごとずらす、といった操作のためのもの。
 *
 * 動かす順番が肝心で、増やすときは後ろのノードから、減らすときは前のノードから
 * 動かす。逆にすると、まだ動いていない隣との最小間隔でクリップされてしまう。
 *
 * @param {number} anchor 実際に操作したノード (これ自身はもう動いている)
 * @param {number} delta  そのノードが実際に動いた量 [日]
 */
function shift_checked(anchor, delta) {
  const mission = State.mission_sequence;
  if (!mission || !isFinite(delta) || delta === 0 || State.checked.size === 0) return;

  const targets = Array.from(State.checked)
    .filter((i) => i !== anchor && i >= 0 && i < mission.count)
    // 節目(近日点など)に固定しているノードはその節目に自動で追従するので触らない
    .filter((i) => mission.pinned_event(i) == null)
    .sort((a, b) => (delta > 0 ? b - a : a - b));

  for (const i of targets) mission.set_date(i, mission.date(i) + delta);
}

export function Update_time() {
  if (!State.mission_sequence) return;
  const anchor = State.editing_sequence;
  const before = State.mission_sequence.date(anchor);
  State.tmp_date = State.mission_sequence.set_date(anchor, State.tmp_date);
  // 実際に動いた分 (クリップされたらその分だけ) を、チェックしたノードにも配る
  if (before != undefined) shift_checked(anchor, State.tmp_date - before);
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
  // 惑星ドラッグでの時刻変更でも、選択中がスイングバイならB面ビュー/右側の
  // 数値表示をリアルタイムに追従させる (rp・beta・近点ΔVは日付に依存するため)
  updateControlPanelDisplay();
  update_stat_bar();
  update_edit_target_label();
  renderLegEvents();
  // ミッションシーケンス一覧の日付も、ドラッグ中を含めて追従させる。
  // 一覧を作り直す change_sequence() はチェック状態などを乱すので、
  // ここでは日付だけを書き換える軽い経路を使う
  update_sequence_times();
}

// --------------------- Mouse / Touch Handlers ---------------------

function handleTouchStart(event) {
  if (event.touches.length != 1) return;
  if (!setMouseFromEvent(event.touches[0].clientX, event.touches[0].clientY)) return;
  Select_planet();
}


/**
 * マウス/指の位置を、太陽系ビューのキャンバス基準の正規化座標に直す。
 *
 * 以前は listener を張っている #graph-panel の offsetLeft/offsetTop と、
 * padding込みの offsetWidth/offsetHeight を混ぜて使っていた。パネルは
 * canvas より一回り大きく、canvas はその中で中央に置かれるので、原点も
 * 縮尺もずれる。さらに -0.04 のずらしが入っていたため、レイは狙った点より
 * 下へ飛んでいた (丸を掴むには少し上をクリックする必要があった)。
 * 他のビュー(view3d.js の setRayFromEvent)と同じく、canvas の実際の矩形で測る。
 *
 * @returns {boolean} 測れたか (非表示のときは false)
 */
function setMouseFromEvent(clientX, clientY) {
  const canvas = document.getElementById("plot");
  if (!canvas) return false;
  const rect = canvas.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return false;
  State.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  State.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  return true;
}

function handleTouchMove(event) {
  if (!State.is_change_time) return;
  if (!setMouseFromEvent(event.touches[0].clientX, event.touches[0].clientY)) return;
  Dlag_planet();
}

function handleTouchEnd(event) {
  if (event.touches.length != 0) return;
  endDrag();
}

function endDrag() {
  if (State.selected_planet !== -1 && PlotState.planet_speres[State.selected_planet]) {
    PlotState.planet_speres[State.selected_planet].children[0].element.style.color = "black";
  }
  if (controls) controls.enableRotate = true;
  const was_dragging = State.is_change_time;
  State.is_change_time = false;
  State.drag_orbit = null;
  // 選択中以外のノードも動かせるので、どのノードがいつになったかを一覧に反映する
  if (was_dragging) change_sequence();
}

function handleMouseDown(event) {
  if (event.button != 0) return;
  if (!setMouseFromEvent(event.clientX, event.clientY)) return;
  Select_planet();
}

function handleMouseMove(event) {
  if (!State.is_change_time) return;
  if (!setMouseFromEvent(event.clientX, event.clientY)) return;
  Dlag_planet();
}

function handleMouseUp(event) {
  if (event.button != 0) return;
  endDrag();
}

function Select_planet() {
  State.raycaster.setFromCamera(State.mouse, camera);
  State.is_selected = false;

  let v = State.raycaster.ray.direction;
  let x_0 = camera.position;

  // 選択中ノードとその前後のノードのマーカーを先に掴み判定する。
  // マーカーは各ノードの探査機位置そのものなので、これを掴むことで
  // 選択を切り替えずに前後ノードの時刻も動かせる。
  if (Select_marker(v, x_0)) return;

  if (State.mode == User_Mode.None) {
    for (let i = 0; i < State.planet_num; i++) {
        // 非表示中(toggle_planetで隠された惑星)はヒットテスト対象から除外する。
        // 位置は非表示でも毎フレーム更新され続けるため、除外しないと見えていない
        // 惑星がクリックを奪ってしまい、時刻変更が発動せずカメラ回転にフォール
        // スルーする不具合の原因になっていた。
        if(!PlotState.planet_speres[i] || !PlotState.planet_speres[i].visible) continue;
      let p = PlotState.planet_speres[i].position;
      let dist = new THREE.Vector3().subVectors(p, x_0).cross(v).length() / v.length();
      if (dist < PICK_RADIUS * PlotState.camera_dist) {
        State.selected_planet = i;
        State.is_selected = true;
        break;
      }
    }
  }
  
  if (State.is_selected) {
    // 惑星そのものをドラッグしたときは選択中シーケンスの時刻を動かす
    // (惑星は常に現在表示時刻の位置に描かれているので、前後ノードの時刻を
    //  動かしたい場合はそのノードのマーカーを掴んでもらう)
    set_edit_target(State.selected_sequence);
    // シーケンスに割り当てられた惑星と一致するかで発動を制限していたが、
    // リファクタリング前には無かった制約で、一致しない(が見えている)惑星を
    // クリックすると時刻変更が発動せずカメラ回転にフォールスルーしてしまう
    // 不具合の原因だったため撤去し、惑星をクリックしたら常に時刻変更モードに
    // 入る元の挙動に戻す。
    if (!set_drag_orbit(State.planet_elements[State.selected_planet], State.tmp_date)) {
      State.is_selected = false;
      return;
    }
    PlotState.planet_speres[State.selected_planet].children[0].element.style.color = "red";
    if(controls) controls.enableRotate = false;
    State.is_change_time = true;
    update_edit_target_label();
  }
}

// 選択中ノードとその前後(marker_spheres[0..2] = selected-1, selected, selected+1)の
// マーカーを掴めたら true を返す。マーカーは各ノードの探査機位置なので、
// 掴んだノードの時刻をそのまま動かせる。
function Select_marker(v, x_0) {
  const sel = State.selected_sequence;
  if (sel == -1 || !State.mission_sequence) return false;

  // 重なったときは選択中ノード(index 1)を優先する
  for (const k of [1, 0, 2]) {
    const marker = PlotState.marker_spheres[k];
    if (!marker || !marker.visible) continue;

    const dist = new THREE.Vector3().subVectors(marker.position, x_0).cross(v).length() / v.length();
    if (dist >= PICK_RADIUS * PlotState.camera_dist) continue;

    const n = sel + k - 1;
    if (n < 0 || n >= State.mission_sequence.count) continue;
    if (start_drag_node(n)) return true;
  }
  return false;
}

/**
 * 掴んだ軌道をドラッグ中ずっと使う形にまとめる。
 *
 * 時刻は「近点通過からの時間の差」で決めるので、基準になる日付と、その日付での
 * 近点通過からの時間をここで固定しておく。以降は画面上でカーソルに一番近い点の
 * 近点角を拾い (js/orbit_pick.js)、その差を日付に直すだけでよい。
 *
 * @param {number[]} elements 軌道要素 [a, e, i, W, w, E]
 * @param {number} base_date elements[5] に対応する日付 [JD]
 * @param {Float64Array} [anomalies] 描かれている線と揃えた近点角の並び
 */
function set_drag_orbit(elements, base_date, anomalies) {
  const a = elements[0];
  const e = elements[1];
  const E_base = elements[5];
  const t_base = kepler_equation(a, e, E_base, MU_SUN);
  if (!isFinite(t_base)) return false;

  State.drag_orbit = {
    elements: elements.slice(),
    base_date,
    t_base,
    samples: buildOrbitSamples(elements, anomalies),
    E_prev: E_base,
  };
  return true;
}

// ノードnの時刻ドラッグを開始する。
// マヌーバ(DSM)は天体を持たないので入ってくる軌道に沿って、天体を持つノードは
// その天体の公転軌道に沿って動かす。
function start_drag_node(n) {
  const mission = State.mission_sequence;

  // 天体を持たないノード(マヌーバ・最終軌道)は、乗っている軌道に沿って動かす
  if (mission.type(n) === Sequence_Type.Maneuver || mission.type(n) === Sequence_Type.End) {
    const conic = mission.get_incoming_conic(n);
    if (conic == null) return false;

    set_edit_target(n);
    // 軌道要素の epoch は前のノードの日付 (そこでの近点角が par[5])。
    // 掴めるのは描かれている「未実行時の軌道」の上だけなので、その範囲を渡す
    if (!set_drag_orbit(conic.par, conic.epoch, coast_anomalies(conic.par, 241))) return false;
    State.is_change_time = true;
    State.is_selected = true;
    if (controls) controls.enableRotate = false;
    update_edit_target_label();
    return true;
  }

  const p = mission.planet_num(n);
  if (p == -1 || !State.planet_elements[p]) return false;

  // 先に表示時刻をそのノードに揃える (set_edit_target が planet_elements を
  // 取り直すので、掴む軌道要素はそのあとで読む)
  set_edit_target(n);
  if (!set_drag_orbit(State.planet_elements[p], State.tmp_date)) return false;
  State.selected_planet = p;
  if (PlotState.planet_speres[p]) {
    PlotState.planet_speres[p].children[0].element.style.color = "red";
  }
  State.is_change_time = true;
  State.is_selected = true;
  if (controls) controls.enableRotate = false;
  update_edit_target_label();
  return true;
}

/**
 * 掴んでいる軌道の上を、カーソルに追わせて時刻を動かす。
 *
 * 画面上で軌道の線に一番近い点を探し (js/orbit_pick.js)、その点の近点角から
 * 「近点通過からの時間」を出して、基準日との差を日付にする。
 * 近点角は前フレームから連続になるよう選ぶので、何周したかを数える必要はない。
 */
function Dlag_planet() {
  const drag = State.drag_orbit;
  if (drag == null) return;

  const E = pickAnomaly(drag.samples, State.mouse, camera, getZScale(), drag.E_prev);
  // 軌道が画面の外に出ているなど、掴める点が見つからないときは動かさない
  if (E == null) return;

  const dt = kepler_equation(drag.elements[0], drag.elements[1], E, MU_SUN) - drag.t_base;
  if (!isFinite(dt)) return;
  drag.E_prev = E;

  // 前後のノードの間に収めるクランプは Mission.set_date が行う
  // (Update_time が set_date を呼ぶので、ここでは希望日付を渡すだけでよい)
  State.tmp_date = drag.base_date + dt / 86400;
  Update_time();
  // マーカー位置と「マヌーバ未実行時の軌道」をドラッグに追従させる
  toggle_planet();
}
