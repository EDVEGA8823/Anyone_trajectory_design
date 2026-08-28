import { State, Sequence_Type, PlotState } from './state.js';
import {
  get_planet_elements,
  get_orbit,
  get_planets_pos,
  JulianToDate,
  Mission,
  AU,
  planet_radius,
} from './trajectory.js';
import {
  initPlot,
  update_planets,
  updateLine,
  createLine,
  createDashedLine,
  updateDashedLine,
  createPlanets,
  updateLayout,
  updateVinfArrow,
  hideVinfArrow,
  updateDsmArrows,
  styleLeg,
  COLOR_LEG_ACTIVE,
  COLOR_COAST,
  COLOR_ACHIEVED,
  invalidate,
} from './plot.js';
import { initEvents, Update_time, delete_sequence, delete_checked } from './event.js';
import { launcher_list, launcher_mass, launch_declination } from './launchers.js';
import { initBPlane, updateBPlane, setBPlaneHandlers, setBPlaneActiveHandle, invalidateBPlane } from './bplane.js';
import {
  initLaunchView,
  updateLaunchView,
  setLaunchViewHandlers,
  setLaunchActiveHandle,
  invalidateLaunchView,
} from './launch_view.js';
import {
  initOrbitView,
  updateOrbitView,
  setOrbitViewHandlers,
  setOrbitActiveHandle,
  invalidateOrbitView,
} from './orbit_view.js';
import {
  initDsmView,
  updateDsmView,
  setDsmViewHandlers,
  setDsmActiveHandle,
  invalidateDsmView,
  dsmViewScale,
} from './dsm_view.js';
import {
  initEntryView,
  updateEntryView,
  setEntryViewHandlers,
  setEntryActiveHandle,
  invalidateEntryView,
} from './entry_view.js';

export function add_sequence(id) {
  let sequence_elem = document.createElement("div");
  sequence_elem.className = "sequence";
  sequence_elem.title = id + 1 + ".  " + State.mission_sequence.type(id);
  if (id == State.selected_sequence) sequence_elem.classList.add("selected");
  
  if (State.checked.has(id)) sequence_elem.classList.add("checked");
  sequence_elem.appendChild(make_check_box(id));

  const span1 = document.createElement("span");
  if (State.mission_sequence.type(id) === Sequence_Type.Maneuver) {
    // マヌーバ(DSM)は天体ではなく深宇宙の一点なので、天体名の代わりにΔVを出す。
    // 並びの最後の自動マヌーバだけが次の目的地へ繋ぐ役目を持つので、
    // 手で足した手動マヌーバとは見分けが付くようにする。
    const dsm = State.mission_sequence.get_dsm_info(id);
    if (!State.mission_sequence.is_auto_mode(id)) {
      span1.textContent = "深宇宙 (手動)";
    } else {
      span1.textContent = dsm ? "ΔV " + (dsm.dv * 1000).toFixed(0) + " m/s" : "深宇宙";
    }
  } else if (State.mission_sequence.type(id) === Sequence_Type.End) {
    // 最終軌道も天体を持たないので、到達した軌道の種類を出す
    span1.textContent = end_orbit_label(State.mission_sequence.get_end_info(id));
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

  // 自動マヌーバ(DSM)は手動モードに付随して出し入れするノードなので個別には
  // 消せない (前のノードを自動に戻すと消える)。手で足した手動マヌーバは消せる。
  if (State.mission_sequence.can_remove(id)) {
    sequence_elem.appendChild(make_delete_button(id));
  }

  const sequence = document.getElementById("sequence");
  sequence.appendChild(sequence_elem);

  // 最終軌道と大気圏突入の後ろには何も続かないので、追加ボタンも出さない
  const tail_type = State.mission_sequence.type(id);
  if (tail_type === Sequence_Type.End || tail_type === Sequence_Type.Entry) return;

  let add_sequence_elem = document.createElement("div");
  add_sequence_elem.className = "add_sequence";
  add_sequence_elem.id = id + 1;
  add_sequence_elem.textContent = "+ シーケンスを追加";
  sequence.appendChild(add_sequence_elem);
}

// まとめて操作するためのチェックボックス。
// シーケンスの選択(操作パネルに出すノード)とは独立なので、押しても選択は動かさない。
function make_check_box(id) {
  const box = document.createElement("input");
  box.type = "checkbox";
  box.className = "seq-check";
  box.checked = State.checked.has(id);
  box.title = "まとめて操作する対象にする";
  box.onclick = (event) => {
    event.stopPropagation(); // 枠のクリック(=シーケンスの選択)まで伝えない
    if (box.checked) State.checked.add(id);
    else State.checked.delete(id);
    const card = box.closest(".sequence");
    if (card) card.classList.toggle("checked", box.checked);
    renderBulkBar();
  };
  return box;
}

// チェックした分をまとめて操作するバー。1つ以上選ばれている間だけ出す。
export function renderBulkBar() {
  const bar = document.getElementById("bulk_bar");
  if (!bar) return;
  bar.innerHTML = "";

  const count = State.checked.size;
  if (count === 0) {
    bar.style.display = "none";
    return;
  }
  bar.style.display = "flex";

  const label = document.createElement("span");
  label.className = "bulk-count";
  label.textContent = count + "件を選択中";
  bar.appendChild(label);

  // 時刻の追従は見えない挙動なので、選んでいる間は明示しておく
  const hint = document.createElement("span");
  hint.className = "bulk-hint";
  hint.textContent = "時刻は同じ差分で一緒に動きます";
  bar.appendChild(hint);

  const actions = document.createElement("div");
  actions.className = "row bulk-actions";

  const del = document.createElement("button");
  del.type = "button";
  del.className = "bulk-btn danger";
  del.textContent = "まとめて削除";
  del.onclick = () => delete_checked();
  actions.appendChild(del);

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "bulk-btn";
  clear.textContent = "選択解除";
  clear.onclick = () => {
    clear_checks();
    change_sequence();
  };
  actions.appendChild(clear);

  bar.appendChild(actions);
}

// ノードの増減で添字がずれるので、構成が変わったときは選択を解除する
export function clear_checks() {
  State.checked.clear();
  renderBulkBar();
}

// シーケンスの枠の右上に置く削除ボタン
function make_delete_button(id) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "seq-delete";
  btn.title = "このシーケンスを削除";
  // stroke="currentColor" にしてCSS側の色(ホバーで赤)に追従させる。
  // アイコン自体はクリック判定を持たせない (押されたのはボタン、として扱う)
  btn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 6h18M9 6V4h6v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>';
  btn.onclick = (event) => {
    // 枠のクリック(=シーケンスの選択)まで伝わらないようにする
    event.stopPropagation();
    delete_sequence(id);
  };
  return btn;
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
  update_stat_bar();
  renderBulkBar();
}

// 探査機の推進系。ドライ質量(=燃料を使い切った後に残る質量)を出すのに要る。
// 二液式のアポジエンジン程度を想定した既定値。
const ISP = 320; // 比推力 [s]
const G0 = 9.80665; // [m/s^2]
const EARTH = 2; // State.planet_list の地球の番号

// --- 統計バーの色分け ---
// 「見た瞬間に、この設計が楽なのか苦しいのか」が分かるように、値の大きさで
// 4段階に塗り分ける。閾値は惑星間ミッションでよく見る値からの目安。
const LEVELS = ["good", "ok", "warn", "bad"];
const C3_LEVELS = [10, 30, 60]; // [km^2/s^2] 小さいほど楽
const DV_LEVELS = [300, 1000, 2500]; // [m/s] 小さいほど楽
const KEEP_LEVELS = [0.25, 0.5, 0.8]; // 残る質量の割合。大きいほど楽

// 小さいほど良い量
function level_low(v, t) {
  if (!isFinite(v)) return null;
  if (v < t[0]) return "good";
  if (v < t[1]) return "ok";
  if (v < t[2]) return "warn";
  return "bad";
}
// 大きいほど良い量
function level_high(v, t) {
  if (!isFinite(v)) return null;
  if (v >= t[2]) return "good";
  if (v >= t[1]) return "ok";
  if (v >= t[0]) return "warn";
  return "bad";
}

// 値とその枠に段階を反映する (okは既定色のまま)
function paint(el, level, paint_box = true) {
  if (!el) return;
  const box = el.closest(".value_box");
  LEVELS.forEach((l) => {
    el.classList.remove("lvl-" + l);
    if (box && paint_box) box.classList.remove("lvl-" + l);
  });
  if (!level) return;
  el.classList.add("lvl-" + level);
  if (box && paint_box) box.classList.add("lvl-" + level);
}

// 右下の統計バー (脱出速度・C3・総ΔV・打上げ質量) をまとめて更新する。
// 時刻のドラッグ中も呼ばれるので、軽い処理だけにしておく。
export function update_stat_bar() {
  const mission = State.mission_sequence;
  if (!mission) return;

  const v = mission.get_v_inf();
  const v_el = document.getElementById("v_inf");
  const c3_el = document.getElementById("C3");
  v_el.textContent = v.toFixed(2);
  c3_el.textContent = (v * v).toFixed(2);
  // 脱出速度とC3は同じ量なので同じ色にする
  const c3_level = mission.count > 0 ? level_low(v * v, C3_LEVELS) : null;
  paint(v_el, c3_level);
  paint(c3_el, c3_level);

  const dv = mission.get_total_dv(); // km/s
  const dv_el = document.getElementById("total_dv");
  dv_el.textContent = (dv * 1000).toFixed(0);
  paint(dv_el, mission.count > 0 ? level_low(dv * 1000, DV_LEVELS) : null);

  update_launch_mass(v, dv);
}

// 選んだロケットで打ち上げられる質量と、総ΔVを出し切った後に残る質量。
function update_launch_mass(vinf, dv_kms) {
  const wet_el = document.getElementById("wet_mass");
  const dry_el = document.getElementById("dry_mass");
  const group = document.querySelector(".launcher-group");
  if (!wet_el || !dry_el) return;

  const mission = State.mission_sequence;
  const arrow = document.getElementById("mass_arrow");
  const box = wet_el.closest(".value_box");
  const show = (wet, dry, note, level, approx = false) => {
    wet_el.textContent = wet;
    dry_el.textContent = dry;
    // 数値が出せないとき (「打ち上げ不可」など) は矢印と右側を畳んで1つだけ出す。
    // 文字は数値より長いので、幅を食わないよう小さくもする。
    const numeric = /^[\d.]+$/.test(wet);
    wet_el.classList.toggle("as-text", !numeric);
    if (arrow) arrow.style.display = numeric ? "" : "none";
    dry_el.style.display = numeric ? "" : "none";
    if (group) group.title = note;
    // 色は「燃料を使った後にどれだけ残るか」で決める。打上げ質量そのものは
    // 機種で桁が変わるので色を付けず、既定の文字色のままにする。
    paint(wet_el, numeric ? null : level, false);
    paint(dry_el, level, false);
    if (box) {
      LEVELS.forEach((l) => box.classList.remove("lvl-" + l));
      if (level) box.classList.add("lvl-" + level);
      // 表の値そのものでない (外挿・近似) ときは枠を破線にする
      box.classList.toggle("approx", approx);
    }
  };

  // 打上げ能力の表・式はいずれも地球からの打上げのもの
  if (mission.count === 0 || mission.planet_num(0) !== EARTH) {
    show("-", "-", "地球からの打上げのときだけ見積もれます", null);
    return;
  }

  const decl = launch_declination(mission.get_launch_v_inf_vec());
  const { mass, status, sourceMode, confidence } = launcher_mass(State.launcher, vinf, decl);
  // 破線は「かなり粗い推定」のときだけに絞る。既定のH3のように式で与える
  // 参考値まで破線にすると、常に破線になって意味を持たなくなる。
  const approx = confidence === "speculative";

  if (status === "over_vinf") {
    show("打ち上げ不可", "-", "この脱出速度はこの機種の能力を超えています", "bad", approx);
    return;
  }

  // ロケット方程式。総ΔVの分の燃料を使うと、残るのはこれだけ。
  const dry = mass * Math.exp((-dv_kms * 1000) / (ISP * G0));
  show(
    mass.toFixed(0),
    dry.toFixed(0),
    launch_mass_note(status, decl, sourceMode, confidence),
    level_high(mass > 0 ? dry / mass : 0, KEEP_LEVELS),
    approx
  );
}

// 値の出どころ (launchers.js の sourceMode / confidence) を一言で説明する
const SOURCE_NOTE = {
  raw: "公開されている性能表の値",
  extrapolated: "表の外側を外挿した推定",
  "parking-orbit-surrogate": "パーキング軌道経由とみなした近似 (赤緯0の90%)",
  "free-DLA-envelope": "赤緯を選べる前提の包絡 (比較用)",
};
const CONFIDENCE_NOTE = {
  table: "表の値",
  reference: "参考値",
  speculative: "粗い推定",
};

function launch_mass_note(status, decl, sourceMode, confidence) {
  const base =
    "赤緯 " + decl.toFixed(1) + "°・比推力 " + ISP + "秒で見積もり\n" +
    "打上げ質量: 燃料も含めた打上げ時の質量 (ウェット質量)\n" +
    "残る質量: 総ΔVの分の燃料を使い切った後に残る質量 (ドライ質量)";
  const from = SOURCE_NOTE[sourceMode];
  const conf = CONFIDENCE_NOTE[confidence];
  const origin = from ? "\n出どころ: " + from + (conf ? " / " + conf : "") : "";
  if (status === "outside_range") return base + origin + "\n(この機種の見積もりが妥当な範囲の外です)";
  return base + origin;
}

// ロケットの選択肢を作る (起動時に一度だけ)
export function initLauncherSelect() {
  const select = document.getElementById("launcher");
  if (!select) return;
  select.innerHTML = "";
  launcher_list().forEach((l) => {
    const option = document.createElement("option");
    option.value = l.id;
    option.text = l.label;
    option.title = l.note;
    select.add(option);
  });
  select.value = State.launcher;
  select.onchange = () => {
    State.launcher = select.value;
    update_stat_bar();
  };
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
  // 天体を持たない節(マヌーバ・最終軌道)では天体の選択自体を伏せる
  const sel_type = State.selected_sequence != -1 ? State.mission_sequence.type(State.selected_sequence) : null;
  // 天体を持たない節(マヌーバ・最終軌道)と、天体が直前の投入ノードに
  // 自動で揃う軌道脱出では、天体の選択自体を伏せる
  select.disabled =
    sel_type === Sequence_Type.Maneuver ||
    sel_type === Sequence_Type.End ||
    sel_type === Sequence_Type.Escape;
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

  // マヌーバは手動レグに付随する節なので、他の種別には変えられない
  // (要らなくなったら削除するか、手動ノードを自動に戻す)
  const is_maneuver = sel_type === Sequence_Type.Maneuver;
  sequence_propaty.disabled = is_maneuver;

  if (State.selected_sequence != 0 && !is_maneuver) {
    let option1 = document.createElement("option");
    option1.text = "変更";
    option1.value = "default";
    option1.hidden = true;
    option1.selected = true;
    sequence_propaty.add(option1);

    // 最終軌道は「手動モードのノードの後の最後の節」でしか意味を持たないので、
    // その条件を満たすときだけ選択肢に出す
    const can_end = State.mission_sequence.can_end(State.selected_sequence);
    // 軌道脱出は「直前が周回軌道投入」のときだけ。天体は投入側に自動で揃う
    const can_escape = State.mission_sequence.can_escape(State.selected_sequence);
    // 大気圏突入は大気に入って終わりなので、最後の節でだけ選べる
    const can_entry = State.mission_sequence.can_entry(State.selected_sequence);

    Object.values(Sequence_Type).forEach((value, i) => {
      let option = document.createElement("option");
      option.text = value;
      option.value = value;
      if (i > 1) {
        if (value == Sequence_Type.End) {
          if (can_end) sequence_propaty.add(option);
        } else if (value == Sequence_Type.Escape) {
          if (can_escape) sequence_propaty.add(option);
        } else if (value == Sequence_Type.Entry) {
          if (can_entry) sequence_propaty.add(option);
        } else if (value == Sequence_Type.Maneuver) {
          // マヌーバは手動レグ (手動の打上げ/スイングバイと次の目的地の間) に
          // だけ置ける節なので、種別の変更では選ばせない。その区間で
          // 「+ シーケンスを追加」を押すと手動マヌーバとして入る。
        } else if (State.mission_sequence.planet_num(State.selected_sequence) < 10) {
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
    clear_checks(); // DSMが出入りして添字がずれるため
    // 最終軌道にするとその手前のDSMが取り除かれ、ノードが1つ前にずれる
    State.selected_sequence = Math.min(State.selected_sequence, State.mission_sequence.count - 1);
    change_sequence();
    update_plot();
    updateControlPanelDisplay();
    // 軌道脱出にすると天体が直前の投入ノードに揃うので、天体の欄も作り直す。
    // (併せて選択肢の顔ぶれと「変更」への戻しも行われる)
    change_sequence_propaty();
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
  
  // Missionは自動/手動の切り替えでマヌーバノードを自前で出し入れするため、
  // ノード数が増減して arcs と食い違うことがある。arcs側が多い場合も必ず
  // 走査し、描くものが無くなった弧は隠す (隠さないと前の線が残り続ける)。
  const count = State.mission_sequence.count;
  const sel = State.selected_sequence;
  for (let i = 0; i < Math.max(count, State.arcs.length); i++) {
    const points = i < count ? State.mission_sequence.get_trajectory(i) : [];
    if (points.length == 0) {
      if (State.arcs[i]) State.arcs[i].line.visible = false;
      continue;
    }
    if (State.arcs[i] == undefined) {
      const blank = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
      State.arcs[i] = createLine(blank, COLOR_LEG_ACTIVE);
    }
    updateLine(State.arcs[i], points);
    // レグ i はノード i と i+1 を繋ぐので、選択中ノードに繋がるのは
    // sel-1 (入ってくる側) と sel (出ていく側) の2本。
    // 何も選んでいないときは全部を主役の色で描く。
    styleLeg(State.arcs[i], sel == -1 || i == sel || i == sel - 1);
    State.arcs[i].line.visible = true;
  }

  update_vinf_arrow();
  update_dsm_arrows();
  invalidate();
}

// マヌーバ(DSM)のΔVを太陽系ビューに矢印で描く。
// 選択中のマヌーバは濃く、それ以外は薄く出す。
export function update_dsm_arrows() {
  const mission = State.mission_sequence;
  if (!mission) return;

  const list = [];
  for (let i = 0; i < mission.count; i++) {
    if (mission.type(i) !== Sequence_Type.Maneuver) continue;
    const dsm = mission.get_dsm_info(i);
    if (dsm == null) continue;
    list.push({ pos: dsm.r, vec: dsm.dv_vec, selected: i === State.selected_sequence });
  }
  updateDsmArrows(list);
}

// 打上げのV∞ベクトルを太陽系ビューに矢印で描く。
// 打上げノードを選んでいる間だけ出す(手動モードではこの矢印がそのまま
// 操作対象になる)。日付が動くと出発天体の位置もV∞も変わるので、
// 軌道を引き直す update_plot と、選択が変わる toggle_planet の両方から呼ぶ。
export function update_vinf_arrow() {
  const i = State.selected_sequence;
  const mission = State.mission_sequence;
  if (i == -1 || !mission || mission.type(i) !== Sequence_Type.Launch) {
    hideVinfArrow();
    return;
  }

  const pos = mission.get_s_c_pos(i);
  const v_inf = mission.get_launch_v_inf_vec();
  if (pos == undefined || v_inf == undefined) {
    hideVinfArrow();
    return;
  }
  updateVinfArrow(pos, v_inf);
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
  // マヌーバ(DSM)と最終軌道のノードは天体を持たない(planet_num == -1)ので、
  // 天体の有無だけで判定するとマーカーが出なくなる。種別も見て判定する。
  const type = State.selected_sequence != -1 ? State.mission_sequence.type(State.selected_sequence) : null;
  const no_planet_node = type === Sequence_Type.Maneuver || type === Sequence_Type.End;

  if (
    State.selected_sequence != -1 &&
    (State.mission_sequence.planet_num(State.selected_sequence) != -1 || no_planet_node)
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
  update_vinf_arrow();
  update_dsm_arrows();
  update_leg_highlight();
  invalidate();
}

// レグの塗り分けだけを引き直す (選択が変わっただけで軌道は変わらないとき用)
function update_leg_highlight() {
  const sel = State.selected_sequence;
  for (let i = 0; i < State.arcs.length; i++) {
    if (!State.arcs[i] || !State.arcs[i].line.visible) continue;
    styleLeg(State.arcs[i], sel == -1 || i == sel || i == sel - 1);
  }
}

// 「DSMを実行しなかった場合にそのまま流されていく軌道」を赤い破線で表示する。
// マヌーバ(DSM)ノードのほか、手動スイングバイのノードを選んでいる間も、
// 直後のDSMを打たなかった場合の軌道として同じものを出す。
// 対象外のノードでは get_coast_orbit が空を返すので破線は消える。
export function update_coast_orbit() {
  const i = State.selected_sequence;
  const pts = i != -1 && State.mission_sequence ? State.mission_sequence.get_coast_orbit(i) : [];
  if (pts.length === 0) {
    if (PlotState.coast_line) PlotState.coast_line.line.visible = false;
    invalidate();
    return;
  }

  // updateLineは余った頂点を(0,0,0)で埋めるため、確保数と実際の点数がずれると
  // 原点へ伸びる線が描かれてしまう。点数がちょうど合うように確保する。
  if (PlotState.coast_line == undefined || PlotState.coast_line.positions.length !== pts.length * 3) {
    if (PlotState.coast_line) PlotState.coast_line.line.visible = false;
    PlotState.coast_line = createDashedLine(pts.length);
  }
  // 同じ破線を2つの意味で使い回すので色で区別する。
  //   マヌーバ未実行の軌道 = 赤 / 最終軌道で到達した軌道 = 緑
  // 最終軌道ノード自体と、その手前の手動ノード(パラメータを動かしながら
  // 結果の軌道を見たい)では「到達した軌道」を描いている
  const mission = State.mission_sequence;
  const achieved =
    mission.type(i) === Sequence_Type.End ||
    (i + 1 < mission.count && mission.type(i + 1) === Sequence_Type.End);
  PlotState.coast_line.line.material.color.setHex(achieved ? COLOR_ACHIEVED : COLOR_COAST);
  updateDashedLine(PlotState.coast_line, pts);
  PlotState.coast_line.line.visible = true;
  invalidate();
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
  invalidate();
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

  const is_maneuver =
    State.selected_sequence != -1 &&
    State.mission_sequence &&
    State.mission_sequence.type(State.selected_sequence) === Sequence_Type.Maneuver;
  const maneuver_only = document.getElementsByClassName("maneuver-only");
  for (let i = 0; i < maneuver_only.length; i++) {
    maneuver_only[i].style.display = is_maneuver ? "flex" : "none";
  }

  const is_launch =
    State.selected_sequence != -1 &&
    State.mission_sequence &&
    State.mission_sequence.type(State.selected_sequence) === Sequence_Type.Launch;
  const launch_only = document.getElementsByClassName("launch-only");
  for (let i = 0; i < launch_only.length; i++) {
    launch_only[i].style.display = is_launch ? "flex" : "none";
  }

  const is_end =
    State.selected_sequence != -1 &&
    State.mission_sequence &&
    State.mission_sequence.type(State.selected_sequence) === Sequence_Type.End;
  const end_only = document.getElementsByClassName("end-only");
  for (let i = 0; i < end_only.length; i++) {
    end_only[i].style.display = is_end ? "flex" : "none";
  }

  // 周回軌道投入と軌道脱出は同じ周回軌道を編集するので、同じパネルを使う
  const sel_type =
    State.selected_sequence != -1 && State.mission_sequence
      ? State.mission_sequence.type(State.selected_sequence)
      : null;
  const is_orbit = sel_type === Sequence_Type.Orbit || sel_type === Sequence_Type.Escape;
  const orbit_only = document.getElementsByClassName("orbit-only");
  for (let i = 0; i < orbit_only.length; i++) {
    orbit_only[i].style.display = is_orbit ? "flex" : "none";
  }

  const is_entry = sel_type === Sequence_Type.Entry;
  const entry_only = document.getElementsByClassName("entry-only");
  for (let i = 0; i < entry_only.length; i++) {
    entry_only[i].style.display = is_entry ? "flex" : "none";
  }

  // パネルの表示/非表示が切り替わると、隠れていたビューが現れることがある。
  // オンデマンド描画なので、現れた側に描き直しを頼んでおく。
  invalidateBPlane();
  invalidateLaunchView();
  invalidateOrbitView();
  invalidateEntryView();
  invalidateDsmView();

  if (is_swingby) updateBPlaneView();
  if (is_maneuver) renderManeuverControls();
  else if (State.dsm_handle) setDsmHandle(null);
  if (is_end) renderEndControls();
  if (is_orbit) renderOrbitControls();
  else if (State.orbit_handle) setOrbitHandle(null);
  if (is_entry) renderEntryControls();
  else if (State.entry_handle) setEntryHandle(null);
  if (is_launch) renderLaunchControls();
  // 打上げ以外に移ったらハンドルの選択は解除しておく
  else if (State.launch_handle) setLaunchHandle(null);
}

// 打上げビュー(操作パネルの3Dプレビュー)に、いまの出発条件を反映する。
// 自動モードでもランベール解から角度を逆算して同じ絵を出すので、
// 「自動だとどこへ向かって飛び出しているのか」がそのまま読み取れる。
export function updateLaunchViewFromMission() {
  const i = State.selected_sequence;
  const mission = State.mission_sequence;
  if (i == -1 || !mission) return;

  const planetNum = mission.planet_num(i);
  const angles = mission.get_launch_angles();
  updateLaunchView({
    planetNum,
    // 表示対象が変わったときだけ画角を取り直させる
    key: i + ":" + planetNum,
    vinf: angles ? angles.vinf : undefined,
    alpha: angles ? angles.alpha : 0,
    delta: angles ? angles.delta : 0,
    planetPos: mission.planet_pos(i),
    planetVel: mission.planet_vel(i),
  });
}

// 打上げの自動/手動切り替えと、手動モードのパラメータ入力を描画する。
//   自動: 次の天体までをランベールで解く (V∞は結果)
//   手動 (MGA-1DSM): |V∞| と2つの角度で飛び出し、直後に自動挿入される
//         マヌーバ(DSM)のΔVで次の天体へ到達させる
export function renderLaunchControls() {
  const container = document.getElementById("launch_controls");
  const i = State.selected_sequence;
  if (!container || i == -1 || !State.mission_sequence) return;

  const mission = State.mission_sequence;
  const is_auto = mission.is_auto_mode(i);
  const vinf = mission.get_v_inf();

  // 自動モードや別のノードに移ったらマウスハンドルは引っ込める
  if (State.launch_handle && (is_auto || launch_handle_seq !== i)) setLaunchHandle(null);

  updateLaunchViewFromMission();

  const modeRow = document.getElementById("launch_mode");
  if (modeRow) {
    modeRow.innerHTML = "";
    [
      ["自動", true],
      ["手動", false],
    ].forEach(([text, auto]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.className = "mode-btn" + (is_auto === auto ? " active" : "");
      // 最終軌道が続いている間は目的地が無いので自動には戻せない
      if (auto && !mission.can_set_auto(i)) {
        btn.disabled = true;
        btn.title = "最終軌道で終えている間は手動のみ";
      }
      btn.onclick = () => {
        mission.set_auto_mode(i, auto);
        refresh_after_swingby_change();
      };
      modeRow.appendChild(btn);
    });
  }

  container.innerHTML = "";

  if (is_auto) {
    // 自動でも向きは決まっているので、ビューと同じ量を数字でも並べる
    const angles = mission.get_launch_angles();
    const rows = [
      ["脱出速度 V∞", vinf.toFixed(3) + " km/s"],
      ["C3", (vinf * vinf).toFixed(2) + " km²/s²"],
    ];
    if (angles) {
      rows.push(["方位角 α", (angles.alpha * RAD2DEG).toFixed(1) + "°"]);
      rows.push(["仰角 δ", (angles.delta * RAD2DEG).toFixed(1) + "°"]);
    }
    container.appendChild(makeReadout(rows));
    return;
  }

  const form = document.createElement("div");
  form.className = "column swingby-inputs";

  // 欄を選ぶと、その欄に対応するハンドルが打上げビューに出てマウスで動かせる。
  // (スイングバイの rp / β と同じ仕組み)
  const addField = (key, label_text, value, step, on_change) => {
    const label = document.createElement("label");
    label.textContent = label_text;
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = value;
    input.onchange = () => on_change(Number(input.value));
    const field = makeParamField(key, label, input, LAUNCH_HANDLE);
    field.classList.add("launch-field");
    form.appendChild(field);
  };

  addField("vinf", "脱出速度 V∞ [km/s]", mission.launch_vinf().toFixed(3), 0.01, (v) => {
    mission.set_launch_vinf(v);
    refresh_after_swingby_change();
  });
  addField("alpha", "方位角 α [deg]", (mission.launch_alpha() * RAD2DEG).toFixed(1), 0.1, (v) => {
    mission.set_launch_alpha(v * DEG2RAD);
    refresh_after_swingby_change();
  });
  addField("delta", "仰角 δ [deg]", (mission.launch_delta() * RAD2DEG).toFixed(1), 0.1, (v) => {
    mission.set_launch_delta(v * DEG2RAD);
    refresh_after_swingby_change();
  });

  const hint = document.createElement("div");
  hint.className = "swingby-hint";
  hint.textContent = "α: 天体の公転方向から / δ: 軌道面から北向きが正";
  form.appendChild(hint);
  container.appendChild(form);

  const rows = [["C3", (vinf * vinf).toFixed(2) + " km²/s²"]];
  const dsm = mission.get_dsm_info(i + 1);
  if (dsm) rows.push(["DSMのΔV", (dsm.dv * 1000).toFixed(1) + " m/s"]);
  container.appendChild(makeReadout(rows));
}

const LEG_EVENT_LABEL = {
  perihelion: "近日点",
  aphelion: "遠日点",
  ascending_node: "昇交点",
  descending_node: "降交点",
};
const MAX_LEG_EVENTS = 8;

// 時刻の枠に、いま時刻を編集しているノードが乗る軌道上の節目
// (近日点・遠日点・昇交点・降交点) を一覧表示する。
// 後でここから時刻を選べるようにするため、各行に日付を持たせてある。
export function renderLegEvents() {
  const list = document.getElementById("leg_events");
  if (!list) return;
  list.innerHTML = "";

  const i = State.editing_sequence;
  if (i == -1 || !State.mission_sequence) return;

  const mission = State.mission_sequence;
  // 一覧を出すのはマヌーバ(DSM)だけ。天体のノードは日付を変えるとレグ自体が
  // 変わってしまい、節目を選ぶという操作が意味を持たない。
  if (mission.type(i) !== Sequence_Type.Maneuver) return;

  const events = mission.get_node_events(i);
  const pinned = mission.pinned_event(i);

  if (events.length === 0) {
    const empty = document.createElement("div");
    empty.className = "leg-event-empty";
    empty.textContent = "この区間に近日点・遠日点・交点はありません";
    list.appendChild(empty);
    return;
  }

  events.slice(0, MAX_LEG_EVENTS).forEach((ev) => {
    const row = document.createElement("div");
    row.className = "leg-event leg-event--" + ev.type;
    row.dataset.date = String(ev.date);
    row.dataset.type = ev.type;

    const name = document.createElement("span");
    name.className = "leg-event-name";
    name.textContent = LEG_EVENT_LABEL[ev.type] ?? ev.type;

    const date = document.createElement("span");
    date.className = "leg-event-date";
    date.textContent = JulianToDate(ev.date).toLocaleDateString("ja-JP");

    const dist = document.createElement("span");
    dist.className = "leg-event-r";
    dist.textContent = (ev.r_norm / AU).toFixed(2) + " AU";

    row.appendChild(name);
    row.appendChild(date);
    row.appendChild(dist);

    row.classList.add("pinnable");
    row.title = "この点に固定する (前後の時刻を変えても追従します)";
    if (pinned === ev.type) {
      row.classList.add("pinned");
      row.title = "固定を解除する";
      const mark = document.createElement("span");
      mark.className = "leg-event-pin";
      mark.textContent = "固定中";
      row.appendChild(mark);
    }
    row.addEventListener("click", () => pin_node_to_event(i, ev.type));
    list.appendChild(row);
  });

  if (events.length > MAX_LEG_EVENTS) {
    const more = document.createElement("div");
    more.className = "leg-event-empty";
    more.textContent = "ほか " + (events.length - MAX_LEG_EVENTS) + " 件";
    list.appendChild(more);
  }
}

// 一覧の行をクリックしたとき。同じ節目をもう一度押すと固定を解除する。
function pin_node_to_event(i, type) {
  const mission = State.mission_sequence;
  mission.set_pinned_event(i, mission.pinned_event(i) === type ? null : type);
  // 固定で日付が動くので、時刻欄が見ている日付を実際の値に合わせ直す
  State.tmp_date = mission.date(i);
  change_sequence();
  toggle_planet();
  Update_time(); // 時刻欄・節目一覧・操作パネル・軌道の描画をまとめて更新
}

// 到達した軌道の一言まとめ (シーケンス一覧のカードにも使う)
export function end_orbit_label(info) {
  if (info == null) return "軌道未確定";
  if (info.e >= 1.001) return "太陽系脱出";
  if (info.e >= 0.999) return "脱出境界";
  return "太陽周回";
}

const SEC_PER_YEAR = 365.25 * 86400;

// 最終軌道ノード: 目的地を持たずに終えるミッションの成果 (到達した太陽中心軌道) を出す。
export function renderEndControls() {
  const summary = document.getElementById("end_summary");
  const container = document.getElementById("end_readout");
  const i = State.selected_sequence;
  if (!summary || !container || i == -1 || !State.mission_sequence) return;

  const info = State.mission_sequence.get_end_info(i);
  container.innerHTML = "";

  if (info == null) {
    summary.textContent = "前のレグが決まると計算されます";
    summary.className = "end-summary";
    return;
  }

  summary.textContent = end_orbit_label(info);
  summary.className = "end-summary" + (info.escaping ? " escaping" : "");

  const tiles = info.escaping
    ? [
        ["離心率", info.e.toFixed(3), "", true],
        ["C3", info.c3.toFixed(2), "km²/s²", false],
        ["近日点", (info.periapsis / AU).toFixed(3), "AU", false],
        ["傾斜角", (info.inc * RAD2DEG).toFixed(2), "°", false],
      ]
    : [
        ["近日点", (info.periapsis / AU).toFixed(3), "AU", true],
        ["遠日点", (info.apoapsis / AU).toFixed(3), "AU", true],
        ["離心率", info.e.toFixed(3), "", false],
        ["傾斜角", (info.inc * RAD2DEG).toFixed(2), "°", false],
        ["周期", (info.period / SEC_PER_YEAR).toFixed(2), "年", false],
      ];

  tiles.forEach(([title, value, unit, primary]) => {
    const box = document.createElement("div");
    box.className = "value_box" + (primary ? " primary" : "");
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    const u = document.createElement("div");
    u.className = "unit";
    u.textContent = unit;
    box.appendChild(t);
    box.appendChild(v);
    box.appendChild(u);
    container.appendChild(box);
  });
}

// マヌーバ(DSM)ノードのΔVなどを操作パネルに表示する。
// updateControlPanelDisplay は Update_time からも呼ばれるので、マヌーバを
// マウスでドラッグしている間もこの表示がそのまま追従する。
export function renderManeuverControls() {
  const container = document.getElementById("maneuver_readout");
  const i = State.selected_sequence;
  if (!container || i == -1 || !State.mission_sequence) return;

  const mission = State.mission_sequence;
  const dsm = mission.get_dsm_info(i);
  const is_auto = mission.is_auto_mode(i);
  const inputs = document.getElementById("maneuver_inputs");
  const badge = document.getElementById("maneuver_badge");
  container.innerHTML = "";
  if (inputs) inputs.innerHTML = "";

  // 並びの最後の自動マヌーバは次の目的地へ繋ぐ役目を負っていて値は計算で決まる。
  // 手前の手動マヌーバはユーザーが (ΔV, α, δ) を指定する。どちらなのかを明示する。
  if (badge) {
    badge.textContent = is_auto ? "自動 (行き先へ接続)" : "手動";
    badge.className = "orbit-badge" + (is_auto ? "" : " safe");
  }

  // 別のノードに移ったらマウスハンドルは引っ込める
  if (State.dsm_handle && (is_auto || dsm_handle_seq !== i)) setDsmHandle(null);

  // 3Dビューは手動マヌーバのときだけ出す (自動は計算で決まる値なので触れない)
  const view_row = document.getElementById("dsm_view_row");
  const legend = document.getElementById("dsm_legend");
  if (view_row) view_row.style.display = is_auto ? "none" : "flex";
  if (legend) legend.style.display = is_auto ? "none" : "flex";

  // 手動マヌーバの設計変数。打上げの手動モードとまったく同じ流儀 (大きさ + 2角)。
  if (!is_auto && inputs) {
    // 欄を選ぶと、その欄に対応するハンドルがマヌーバビューに出てマウスで動かせる
    const addField = (key, label_text, value, step, hint, on_change) => {
      const label = document.createElement("label");
      label.textContent = label_text;
      if (hint) label.title = hint;
      const input = document.createElement("input");
      input.type = "number";
      input.step = String(step);
      input.value = value;
      input.onchange = () => {
        on_change(Number(input.value));
        refresh_after_swingby_change();
      };
      inputs.appendChild(makeParamField(key, label, input, DSM_HANDLE));
    };

    addField("dv", "ΔV [m/s]", (mission.dsm_dv(i) * 1000).toFixed(0), 1, "噴射の大きさ", (v) =>
      mission.set_dsm_dv(i, v / 1000)
    );
    addField(
      "alpha",
      "方位角 α [deg]",
      (mission.dsm_alpha(i) * RAD2DEG).toFixed(1),
      0.1,
      "軌道面内で、進行方向から測った角 (進行方向が0)",
      (v) => mission.set_dsm_alpha(i, v * DEG2RAD)
    );
    addField(
      "delta",
      "仰角 δ [deg]",
      (mission.dsm_delta(i) * RAD2DEG).toFixed(1),
      0.1,
      "軌道面からの傾き (軌道面の法線向きが正)。±90度まで",
      (v) => mission.set_dsm_delta(i, v * DEG2RAD)
    );

    updateDsmView({
      // 目盛りを選び直すのは、ノードが変わったときと、ΔVの桁が変わったとき
      // だけにする。操作のたびに目盛りが動くと大きさの感覚が崩れるが、桁が
      // 変わったまま据え置くと矢印がグリッドから外れて読めなくなる。
      key: "dsm" + i + ":" + Math.floor(Math.log10(Math.max(mission.dsm_dv(i), 0.05))),
      dv: mission.dsm_dv(i),
      alpha: mission.dsm_alpha(i),
      delta: mission.dsm_delta(i),
      ready: dsm != null,
    });
    const scale = document.getElementById("dsm_scale");
    if (scale) scale.textContent = "グリッド 1目盛 = " + (dsmViewScale() * 1000).toFixed(0) + " m/s";
  }

  if (dsm == null) {
    const note = document.createElement("div");
    note.className = "swingby-hint";
    note.textContent = "前後のレグが決まると計算されます";
    container.appendChild(note);
    return;
  }

  const norm = (v) => Math.hypot(v[0], v[1], v[2]);
  const tiles = [
    ["ΔV", (dsm.dv * 1000).toFixed(1), "m/s", true],
    ["実行前", norm(dsm.v_before).toFixed(3), "km/s", false],
    ["実行後", norm(dsm.v_after).toFixed(3), "km/s", false],
    ["太陽距離", (norm(dsm.r) / AU).toFixed(3), "AU", false],
  ];
  // 自動マヌーバでも向きは決まっているので、手動と同じ2角で読めるようにする
  if (is_auto && dsm.angles) {
    tiles.push(["方位角 α", (dsm.angles.alpha * RAD2DEG).toFixed(1), "°", false]);
    tiles.push(["仰角 δ", (dsm.angles.delta * RAD2DEG).toFixed(1), "°", false]);
  }
  tiles.forEach(([title, value, unit, primary]) => {
    const box = document.createElement("div");
    box.className = "value_box" + (primary ? " primary" : "");
    const t = document.createElement("div");
    t.className = "title";
    t.textContent = title;
    const v = document.createElement("div");
    v.className = "value";
    v.textContent = value;
    const u = document.createElement("div");
    u.className = "unit";
    u.textContent = unit;
    box.appendChild(t);
    box.appendChild(v);
    box.appendChild(u);
    container.appendChild(box);
  });
}

const SEC_PER_DAY = 86400;
const SEC_PER_HOUR = 3600;

// 周期を桁に応じた単位で読みやすく出す
function format_period(sec) {
  if (!(sec > 0) || !isFinite(sec)) return "-";
  if (sec < 2 * SEC_PER_DAY) return (sec / SEC_PER_HOUR).toFixed(1) + " 時間";
  if (sec < 2 * SEC_PER_YEAR) return (sec / SEC_PER_DAY).toFixed(1) + " 日";
  return (sec / SEC_PER_YEAR).toFixed(2) + " 年";
}

// 半径を桁に応じて出す (地球周回の数千kmから木星周回の数百万kmまで扱うため)
function format_radius(km) {
  if (km == undefined || !isFinite(km)) return "-";
  if (Math.abs(km) >= 1e6) return (km / 1e6).toFixed(3) + "e6 km";
  return km.toFixed(0) + " km";
}

/**
 * 周回軌道投入 / 軌道脱出の操作パネル。
 *
 * どちらも同じ周回軌道 (近点半径 rp と遠点半径 ra) が設計変数で、ΔVは
 *   ΔV = √(V∞² + 2μ/rp) − √(2μ・ra/(rp(rp+ra)))
 * になる。近点で接線方向に噴射する前提なので、軌道面の向きや到着位相には
 * 依らない (trajectory.js の該当箇所に導出を書いてある)。
 * 投入ノードと脱出ノードは同じ軌道を共有するので、どちらの欄から編集しても
 * 同じ値が動く。
 */
export function renderOrbitControls() {
  const i = State.selected_sequence;
  const inputs = document.getElementById("orbit_inputs");
  const readout = document.getElementById("orbit_readout");
  const title = document.getElementById("orbit_title");
  const badge = document.getElementById("orbit_badge");
  if (!inputs || !readout || i == -1 || !State.mission_sequence) return;

  const mission = State.mission_sequence;
  const type = mission.type(i);
  const is_insert = type === Sequence_Type.Orbit;
  const info = mission.get_orbit_info(i);
  const lim = mission.orbit_limits(i);

  // 別のノードに移ったらマウスハンドルは引っ込める
  if (State.orbit_handle && orbit_handle_seq !== i) setOrbitHandle(null);

  title.textContent = is_insert ? "周回軌道投入 (捕獲)" : "軌道脱出 (再出発)";
  badge.textContent = is_insert ? "減速" : "加速";
  badge.className = "orbit-badge " + (is_insert ? "brake" : "boost");

  inputs.innerHTML = "";
  readout.innerHTML = "";

  if (lim == undefined) {
    // 縦を使わないよう、説明は読み値の枠に1行だけ出す
    readout.appendChild(
      makeReadout([
        [
          "",
          is_insert ? "天体を選ぶと計算されます" : "直前の「周回軌道投入」と同じ天体からのみ",
        ],
      ])
    );
    updateOrbitView({ planetNum: -1 });
    return;
  }

  const rp = mission.orbit_rp(i);
  const ra = mission.orbit_ra(i);

  // 欄を選ぶと、その欄に対応するハンドルが3Dビューに出てマウスで動かせる
  const addField = (key, label_text, hint, value, step, min, max, apply) => {
    const label = document.createElement("label");
    label.textContent = label_text;
    // 上下限の理由などはツールチップに逃がす。パネルの縦は3Dビューに使いたい。
    if (hint) label.title = hint;
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    if (min != undefined) input.min = String(Math.ceil(min));
    if (max != undefined) input.max = String(Math.floor(max));
    input.value = value.toFixed(0);
    input.onchange = () => {
      apply(Number(input.value));
      // 上下限でクランプされた場合は入力欄も実際の値に合わせる
      refresh_after_orbit_change();
    };
    inputs.appendChild(makeParamField(key, label, input, ORBIT_HANDLE));
  };

  // 入力は半径ではなく天体表面からの高度で受け取る (手動スイングバイと同じ)。
  // 内部は一貫して半径で扱い、ここで足し引きするだけにする。
  const R = lim.radius;
  // 刻みは天体の大きさに合わせる (地球で10km、木星で1000km程度)
  const step = Math.max(10, Math.round(R / 500) * 10);
  addField(
    "orbit_rp",
    "近点高度 [km]",
    `下限 ${(lim.rp_min - R).toFixed(0)} km (大気・放射線帯)`,
    rp - R,
    step,
    lim.rp_min - R,
    lim.ra_max - R,
    (v) => mission.set_orbit_rp(i, v + R)
  );
  addField(
    "orbit_ra",
    "遠点高度 [km]",
    `上限 ${format_radius(lim.ra_max - R)} (ヒル半径の半分。これより外は太陽の摂動で軌道を保てない)` +
      (info && info.dv_min != undefined
        ? "\n上限まで広げたときの" + (is_insert ? "投入" : "脱出") + "ΔV " + (info.dv_min * 1000).toFixed(0) + " m/s"
        : ""),
    ra - R,
    step * 10,
    rp - R,
    lim.ra_max - R,
    (v) => mission.set_orbit_ra(i, v + R)
  );

  // 3Dビュー。V∞が未確定でも周回軌道そのものは描けるので、常に更新する。
  updateOrbitView({
    planetNum: lim.planet_num,
    // 表示対象が変わったときだけ画角を取り直させる
    key: i + ":" + lim.planet_num + ":" + type,
    kind: is_insert ? "insert" : "escape",
    rp,
    ra,
    vinf: info ? info.v_inf : undefined,
    dv: info ? info.dv : undefined,
  });

  if (info == null) {
    readout.appendChild(
      makeReadout([["", is_insert ? "前のレグが決まると計算" : "次の目的地が決まると計算"]])
    );
    return;
  }

  // 高度は入力欄に出ているので、こちらには元の半径を出しておく
  // (双曲線や軌道の式に現れるのは半径の方なので、両方見えるようにする)
  const rows = [
    [is_insert ? "侵入速度 V∞" : "脱出速度 V∞", info.v_inf.toFixed(3) + " km/s"],
    [is_insert ? "投入ΔV" : "脱出ΔV", (info.dv * 1000).toFixed(1) + " m/s"],
    ["近点半径 rp", format_radius(info.rp)],
    ["遠点半径 ra", format_radius(info.ra)],
    ["離心率", info.e.toFixed(4)],
    ["周期", format_period(info.period)],
  ];
  // 遠点がヒル半径の上限に張り付いていることは、値の脇に短く添えるだけにする
  if (info.ra_clamped) rows[3][1] += " (上限)";
  readout.appendChild(makeReadout(rows));
}

// --- 突入速度の色分け ---
// 地球への試料回収カプセルを基準にした目安 [km/s]。小さいほど楽。
//   11.2 : 月・低エネルギー帰還級 (アポロ)。地球脱出速度とほぼ同じで、これが下限
//   12.9 : スターダストの再突入速度 = 人類が実際に経験した最速
//   16   : ISASが研究している15km/s級カプセル (土星圏からの帰還を想定) が
//          収まる範囲。設計点そのものが15km/sなので、境目は少し上に取る。
// 他天体では大気の濃さが違うので、あくまで地球基準の目安として使う。
const ENTRY_V_LEVELS = [11.2, 12.9, 16];
const ENTRY_V_HINT =
  "突入速度の目安 (地球の試料回収カプセル基準)\n" +
  "11.2未満: 月・低エネルギー帰還級 (アポロ)。すでに実績のある領域\n" +
  "12.9未満: スターダスト (人類が経験した最速) まで\n" +
  "16未満: ISASが研究中の15km/s級カプセル (土星圏からの帰還) の想定範囲。\n" +
  "        機体はまだ無く、新たに開発が要る\n" +
  "16以上: 現状の研究でも想定されていない";

// 突入経路角の目安。浅すぎると大気で跳ね返されて宇宙へ戻り、深すぎると
// 減速度と加熱率が跳ね上がる。カプセルによるが、この幅が実用的な回廊。
const ENTRY_GAMMA_MIN = -14; // [deg] これより深いと厳しい
const ENTRY_GAMMA_MAX = -5.5; // [deg] これより浅いと跳ね返される恐れ

/**
 * 大気圏突入の操作パネル。
 *
 * 突入速度は無限遠から突入高度まで落ちる間のエネルギー保存だけで決まり、
 *   v = √(V∞² + 2μ/r)
 * 設計変数は突入経路角γ (水平から測り降下が負) のみ。γは突入速度を変えず、
 * 軌道の形 (どれくらい浅く入るか) と回廊の成否を決める。
 */
export function renderEntryControls() {
  const i = State.selected_sequence;
  const inputs = document.getElementById("entry_inputs");
  const readout = document.getElementById("entry_readout");
  const badge = document.getElementById("entry_badge");
  if (!inputs || !readout || i == -1 || !State.mission_sequence) return;

  const mission = State.mission_sequence;
  const info = mission.get_entry_info(i);

  // 別のノードに移ったらマウスハンドルは引っ込める
  if (State.entry_handle && entry_handle_seq !== i) setEntryHandle(null);

  inputs.innerHTML = "";
  readout.innerHTML = "";

  const planetNum = mission.planet_num(i);
  if (planetNum == -1) {
    readout.appendChild(makeReadout([["", "天体を選ぶと計算されます"]]));
    updateEntryView({ planetNum: -1 });
    badge.textContent = "";
    badge.className = "orbit-badge";
    return;
  }

  // 突入経路角の入力 (欄を選ぶと3Dビューにハンドルが出る)
  const gamma_deg = mission.entry_gamma(i) * RAD2DEG;
  const label = document.createElement("label");
  label.textContent = "突入経路角 γ [deg]";
  label.title =
    "水平から測った突入時の降下角 (下向きが負)。\n" +
    `実用的な回廊はおおむね ${ENTRY_GAMMA_MIN} 〜 ${ENTRY_GAMMA_MAX} 度。\n` +
    "浅すぎると大気で跳ね返されて宇宙へ戻り、深すぎると減速度と加熱率が跳ね上がる。\n" +
    "γは突入速度そのものは変えない (エネルギーで決まるため)。";
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.1";
  input.min = "-89";
  input.max = "-0.1";
  input.value = gamma_deg.toFixed(1);
  input.onchange = () => {
    mission.set_entry_gamma(i, Number(input.value) * DEG2RAD);
    refresh_after_entry_change();
  };
  inputs.appendChild(makeParamField("gamma", label, input, ENTRY_HANDLE));

  if (info == null) {
    readout.appendChild(makeReadout([["", "前のレグが決まると計算されます"]]));
    updateEntryView({ planetNum: -1 });
    badge.textContent = "";
    badge.className = "orbit-badge";
    return;
  }

  // 突入速度がどのあたりの水準なのかを一言で添える (色は ENTRY_V_LEVELS と同じ段階)
  const v_level = level_low(info.v_entry, ENTRY_V_LEVELS);
  const BADGE = {
    good: ["実績あり", "safe"],
    ok: ["実績内", ""],
    warn: ["要開発", "caution"],
    bad: ["想定外", "risk"],
  };
  const [badge_text, badge_class] = BADGE[v_level] ?? ["", ""];
  badge.textContent = badge_text;
  badge.className = "orbit-badge " + badge_class;

  const g_deg = info.gamma * RAD2DEG;
  const g_level = g_deg < ENTRY_GAMMA_MIN || g_deg > ENTRY_GAMMA_MAX ? "warn" : null;

  readout.appendChild(
    makeReadout([
      ["侵入速度 V∞", info.v_inf.toFixed(3) + " km/s"],
      ["突入速度", info.v_entry.toFixed(3) + " km/s", v_level, ENTRY_V_HINT],
      ["突入高度", info.altitude.toFixed(0) + " km"],
      ["経路角 γ", g_deg.toFixed(1) + "°", g_level],
    ])
  );

  updateEntryView({
    planetNum,
    key: i + ":" + planetNum,
    gamma: info.gamma,
    vinf: info.v_inf,
    vEntry: info.v_entry,
    e: info.e,
    p: info.p,
    nuEntry: info.nu_entry,
    // 実際の向き (公転方向・北・太陽) に合わせて描くための基準
    planetVel: info.planet_vel,
    planetPos: info.planet_pos,
    iHat: info.i_hat,
    jHat: info.j_hat,
    kHat: info.k_hat,
  });
}

function refresh_after_entry_change() {
  update_plot();
  update_stat_bar();
  change_sequence();
  updateControlPanelDisplay();
}

function refresh_after_orbit_change() {
  update_plot();
  update_stat_bar();
  change_sequence();
  updateControlPanelDisplay();
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
    // 近点ΔVを打つ自動モードでは、出射側は入射側と別の双曲線になる
    vinfOut: info ? info.v_inf_out : undefined,
    turnDeficit: info ? info.turn_deficit : 0,
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
  // 最終軌道が続いている間は目的地が無いので自動には戻せない
  if (!State.mission_sequence.can_set_auto(i)) {
    autoBtn.disabled = true;
    autoBtn.title = "最終軌道で終えている間は手動のみ";
  }
  autoBtn.onclick = () => {
    State.mission_sequence.set_auto_mode(i, true);
    refresh_after_swingby_change();
  };

  const manualBtn = document.createElement("button");
  manualBtn.type = "button";
  manualBtn.textContent = "手動";
  manualBtn.className = "mode-btn" + (!is_auto ? " active" : "");
  manualBtn.onclick = () => {
    State.mission_sequence.set_auto_mode(i, false);
    refresh_after_swingby_change();
  };

  if (modeRow) {
    modeRow.appendChild(autoBtn);
    modeRow.appendChild(manualBtn);
  }

  if (is_auto) {
    if (info) {
      // rpは下限でクランプ済みなので、必要な曲げ角に届かない場合は
      // その不足分が近点ΔVに乗る。クランプされた事実は値の脇に添えるだけにする。
      const R = planet_radius[State.mission_sequence.planet_num(i)] ?? 0;
      const rpText =
        info.rp != undefined
          ? (info.rp - R).toFixed(0) + " km" + (info.rp_clamped ? " (下限)" : "")
          : "-";
      const rows = [
        ["侵入速度", info.v_inf_in.toFixed(3) + " km/s"],
        ["脱出速度", info.v_inf_out.toFixed(3) + " km/s"],
        ["曲げ角", (info.delta * RAD2DEG).toFixed(1) + "°"],
        ["近点高度", rpText],
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
    // 入力は半径ではなく天体表面からの高度で受け取る (「火星の3596km」より
    // 「高度200km」の方が直感的に分かるため)。内部は一貫して半径で扱う。
    const R = planet_radius[State.mission_sequence.planet_num(i)] ?? 0;
    const min_alt = min_rp != undefined ? min_rp - R : undefined;

    const rpLabel = document.createElement("label");
    rpLabel.textContent = "近点高度 [km]";
    const rpInput = document.createElement("input");
    rpInput.type = "number";
    rpInput.step = "10";
    if (min_alt != undefined) rpInput.min = String(Math.ceil(min_alt));
    rpInput.value = rp != undefined ? (rp - R).toFixed(0) : "";
    rpInput.onchange = () => {
      State.mission_sequence.set_rp(i, Number(rpInput.value) + R);
      // 下限でクランプされた場合は入力欄の表示も実際の値に合わせる
      const applied = State.mission_sequence.rp(i);
      if (applied != undefined) rpInput.value = (applied - R).toFixed(0);
      refresh_after_swingby_change();
    };

    const betaLabel = document.createElement("label");
    betaLabel.textContent = "回転角 β [deg]";
    const betaInput = document.createElement("input");
    betaInput.type = "number";
    betaInput.step = "0.1";
    betaInput.value = (beta * RAD2DEG).toFixed(1);
    betaInput.onchange = () => {
      State.mission_sequence.set_beta(i, Number(betaInput.value) * DEG2RAD);
      refresh_after_swingby_change();
    };

    // 欄を選ぶと、その欄に対応するハンドルがB面ビューに出てマウスで動かせる。
    // 常に掴めるものを出しておくとカメラ操作の邪魔になるので、選択制にしている。
    const rpField = makeParamField("rp", rpLabel, rpInput);
    if (min_alt != undefined) {
      const note = document.createElement("div");
      note.className = "swingby-hint";
      note.textContent = `下限 ${min_alt.toFixed(0)} km (大気・放射線帯)`;
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
        // B面ビューの赤い線は天体中心からの半径なので、その値も添えておく
        ["近点半径", info.rp != undefined ? info.rp.toFixed(0) + " km" : "-"],
      ];
      const dsm = State.mission_sequence.get_dsm_info(i + 1);
      if (dsm) rows.push(["DSMのΔV", (dsm.dv * 1000).toFixed(1) + " m/s"]);
      container.appendChild(makeReadout(rows));
    }
  }
}

// マウスハンドルを出しているシーケンス番号 (別のノードに移ったら消すため)
let handle_seq = -1;
let launch_handle_seq = -1;
let orbit_handle_seq = -1;
let entry_handle_seq = -1;
let dsm_handle_seq = -1;

// B面ビューのハンドルの出し分け。keyは "rp" | "beta" | null
export function setSwingbyHandle(key) {
  State.swingby_handle = key;
  handle_seq = key ? State.selected_sequence : -1;
  setBPlaneActiveHandle(key);
}

// 打上げビューのハンドルの出し分け。keyは "vinf" | "alpha" | "delta" | null
export function setLaunchHandle(key) {
  State.launch_handle = key;
  launch_handle_seq = key ? State.selected_sequence : -1;
  setLaunchActiveHandle(key);
}

// 周回軌道ビューのハンドルの出し分け。
// 欄のキーはスイングバイの "rp" と衝突しないよう接頭辞を付けてあるので、
// ビュー側の名前 ("rp" | "ra") に直してから渡す。
export function setOrbitHandle(key) {
  State.orbit_handle = key;
  orbit_handle_seq = key ? State.selected_sequence : -1;
  setOrbitActiveHandle(key === "orbit_rp" ? "rp" : key === "orbit_ra" ? "ra" : null);
}

// マヌーバビューのハンドルの出し分け。keyは "dv" | "alpha" | "delta" | null
export function setDsmHandle(key) {
  State.dsm_handle = key;
  dsm_handle_seq = key ? State.selected_sequence : -1;
  setDsmActiveHandle(key);
}

// 大気圏突入ビューのハンドルの出し分け。keyは "gamma" | null
export function setEntryHandle(key) {
  State.entry_handle = key;
  entry_handle_seq = key ? State.selected_sequence : -1;
  setEntryActiveHandle(key);
}

// makeParamField に渡す、どのビューのハンドルを操作する欄なのかの指定
const SWINGBY_HANDLE = { get: () => State.swingby_handle, set: setSwingbyHandle };
const LAUNCH_HANDLE = { get: () => State.launch_handle, set: setLaunchHandle };
const ORBIT_HANDLE = { get: () => State.orbit_handle, set: setOrbitHandle };
const ENTRY_HANDLE = { get: () => State.entry_handle, set: setEntryHandle };
const DSM_HANDLE = { get: () => State.dsm_handle, set: setDsmHandle };

// ラベルと入力欄を、クリックでハンドルを出せる1つの欄にまとめる。
// 選択中の欄のラベルをもう一度押すとハンドルを消す (カメラ操作に戻れるように)。
function makeParamField(key, label, input, handle = SWINGBY_HANDLE) {
  const field = document.createElement("div");
  field.className = "column param-field param-field--" + key;
  if (handle.get() === key) field.classList.add("active");
  field.appendChild(label);
  field.appendChild(input);
  field.addEventListener("click", (event) => {
    const on_label = event.target === label;
    handle.set(handle.get() === key && on_label ? null : key);
    // ここでDOMを作り直すと入力欄のフォーカスが飛ぶので、見た目だけ切り替える
    const active = handle.get();
    document
      .querySelectorAll(".param-field")
      .forEach((el) => el.classList.toggle("active", active != null && el.classList.contains("param-field--" + active)));
  });
  return field;
}

// [項目名, 値, 段階?] の並びを、幅の狭い1カラムに積んで表示する。
// 段階 ("good"|"ok"|"warn"|"bad") を渡すと、統計バーと同じ色で値を塗る。
function makeReadout(rows) {
  const readout = document.createElement("div");
  readout.className = "swingby-readout";
  rows.forEach(([label, value, level, hint]) => {
    const row = document.createElement("div");
    row.className = "row swingby-readout-row";
    if (hint) row.title = hint;
    row.innerHTML = `<span>${label}</span><span${level ? ` class="lvl-${level}"` : ""}>${value}</span>`;
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

// マヌーバビューのハンドルをドラッグしている間の反映。
function apply_dsm_from_drag(set) {
  return (value) => {
    const i = State.selected_sequence;
    if (i == -1 || !State.mission_sequence) return;
    set(State.mission_sequence, i, value);
    refresh_after_swingby_change();
  };
}

// 大気圏突入ビューのハンドルをドラッグしている間の反映。
function apply_entry_gamma_from_drag(gamma) {
  const i = State.selected_sequence;
  if (i == -1 || !State.mission_sequence) return;
  State.mission_sequence.set_entry_gamma(i, gamma);
  refresh_after_entry_change();
}

// 周回軌道ビューのハンドルをドラッグしている間の反映。
// 入力欄に打ち込んだときと同じ経路を通す (上下限のクランプもMission側で効く)。
function apply_orbit_from_drag(set) {
  return (value) => {
    const i = State.selected_sequence;
    if (i == -1 || !State.mission_sequence) return;
    set(State.mission_sequence, i, value);
    refresh_after_orbit_change();
  };
}

// 打上げビューのハンドルをドラッグしている間の反映。
// 入力欄に打ち込んだときと同じ経路を通す (δの±90度クランプもMission側で効く)。
function apply_launch_from_drag(set) {
  return (value) => {
    const i = State.selected_sequence;
    if (i == -1 || !State.mission_sequence) return;
    set(State.mission_sequence, value);
    refresh_after_swingby_change();
  };
}

function refresh_after_swingby_change() {
  clear_checks(); // DSMが出入りして添字がずれるため
  update_plot();
  change_sequence(); // マヌーバのΔVと総ΔVの表示を追従させる
  // 自動/手動の切り替えではマヌーバノードが出入りしてノードの並びが変わるので、
  // マーカーとΔV未実行時の軌道も引き直す
  toggle_planet();
  // 選択中のノードに応じた欄 (打上げ/スイングバイ/マヌーバ) を出し直す
  updateControlPanelDisplay();
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
  initLauncherSelect();
  initPlot();
  make_plot();
  updateLayout();
  initBPlane();
  setBPlaneHandlers({ onRp: apply_rp_from_drag, onBeta: apply_beta_from_drag });
  initLaunchView();
  setLaunchViewHandlers({
    onVinf: apply_launch_from_drag((m, v) => m.set_launch_vinf(v)),
    onAlpha: apply_launch_from_drag((m, v) => m.set_launch_alpha(v)),
    onDelta: apply_launch_from_drag((m, v) => m.set_launch_delta(v)),
  });
  initOrbitView();
  setOrbitViewHandlers({
    onRp: apply_orbit_from_drag((m, i, v) => m.set_orbit_rp(i, v)),
    onRa: apply_orbit_from_drag((m, i, v) => m.set_orbit_ra(i, v)),
  });
  initEntryView();
  setEntryViewHandlers({ onGamma: apply_entry_gamma_from_drag });
  initDsmView();
  setDsmViewHandlers({
    onDv: apply_dsm_from_drag((m, i, v) => m.set_dsm_dv(i, v)),
    onAlpha: apply_dsm_from_drag((m, i, v) => m.set_dsm_alpha(i, v)),
    onDelta: apply_dsm_from_drag((m, i, v) => m.set_dsm_delta(i, v)),
  });

  // Update time for the initial load
  Update_time();

  install_redraw_safety_net();
}

// 3つの3Dビューはどれも「変わったときだけ描く」方式にしてある(view3d.jsの
// makeRenderLoop)。変えた側が invalidate を呼ぶのが本筋だが、このアプリの絵は
// 例外なくユーザーの操作をきっかけに変わるので、操作そのものを合図にして
// 一通り描き直す保険も掛けておく。
// 何も起きていない間は1フレームも描かないので、この保険の費用はほぼゼロ。
function install_redraw_safety_net() {
  const redraw = () => {
    invalidate();
    invalidateBPlane();
    invalidateLaunchView();
    invalidateOrbitView();
    invalidateEntryView();
    invalidateDsmView();
  };
  for (const type of ["pointerup", "pointerdown", "wheel", "input", "change", "keyup"]) {
    document.addEventListener(type, redraw, { passive: true, capture: true });
  }
}

boot();
