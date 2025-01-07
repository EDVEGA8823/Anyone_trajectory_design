let date_time = document.getElementById("date_time");

// let D_1year = document.getElementById("D_1year");
// let D_1month = document.getElementById("D_1month");
// let D_5day = document.getElementById("D_5day");
// let D_1day = document.getElementById("D_1day");
// let U_1day = document.getElementById("U_1day");
// let U_5day = document.getElementById("U_5day");
// let U_1month = document.getElementById("U_1month");
// let U_1year = document.getElementById("U_1year");

let sequence = document.getElementById("sequence");
let contlol_panel = document.getElementsByClassName("control-panel")[0];

let sequence_panel = document.getElementsByClassName("sequence-panel")[0];

let confirm_time = document.getElementById("confirm_time");
let cancel_time = document.getElementById("cancel_time");

let v_inf= document.getElementById("v_inf");
let C3= document.getElementById("C3");

// sequence_panel.addEventListener("click", (event) => {
//     if(event)
//     console.log("click");
// });
// sequence.addEventListener("click", (event) => {
//     console.log(event.target)
//   if (event.target.className == "add_sequence") {
//     selected_sequence = Number(event.target.id);
//     mission_sequence.add(selected_sequence, tmp_date);
//     console.log(mission_sequence.types[selected_sequence]);
//     for (i = 0; i < contlol_panel.children.length; i++) {
//       if (contlol_panel.children[i].id == "launch") {
//         if (mission_sequence.types[selected_sequence] == Sequence_Type.Launch) contlol_panel.children[i].style.display = "flex";
//         else contlol_panel.children[i].style.display = "none";
//       }
//     }
//     // if (mission_sequence.types[selected_sequence] == Sequence_Type.Launch) {
//     // contlol_panel.classList.toggle("launch");
//     // }
//     // else
//     // contlol_panel.classList.toggle("hide_launch");
//   }

//   else {
//     selected_sequence = Number(event.target.id);
//     console.log(selected_sequence);
//   }
//   change_sequence();

// });

confirm_time.addEventListener("click", function () {
  confirm_time.style.visibility = "hidden";
  cancel_time.style.visibility = "hidden";
  change_sequence();
});

cancel_time.addEventListener("click", function () {
  tmp_date = old_date;
  mission_sequence.set_date(selected_sequence,old_date);
  Update_time();
  confirm_time.style.visibility = "hidden";
  cancel_time.style.visibility = "hidden";
});

sequence_panel.addEventListener("click", (event) => {
  handleSequencePanelClick(event);
});

function handleSequencePanelClick(event) {
  if (event.target.className == "add_sequence") {
    selected_sequence = Number(event.target.id);
    mission_sequence.add(selected_sequence, tmp_date);
    // console.log(mission_sequence.types[selected_sequence]);
  } else if (event.target.className == "sequence-panel") {
    selected_sequence = -1;
  } else {
    selected_sequence = Number(event.target.id);
  }
  if(isNaN(selected_sequence)) selected_sequence = -1;

  updateControlPanelDisplay();
  change_sequence();
  change_sequence_propaty();
  if (selected_sequence != -1) {
    tmp_date = mission_sequence.date(selected_sequence);
    old_date = tmp_date;
    Update_time();
    confirm_time.style.visibility = "hidden";
    cancel_time.style.visibility = "hidden";
  }
}

function updateControlPanelDisplay() {
  //   for (i = 0; i < contlol_panel.children.length; i++) {
  //     if (contlol_panel.children[i].id == "launch") {
  //       if (mission_sequence.types[selected_sequence] == Sequence_Type.Launch) contlol_panel.children[i].style.display = "flex";
  //       else contlol_panel.children[i].style.display = "none";
  //     }
  //     if (contlol_panel.children[i].id == "flyby") {
  //       if (mission_sequence.types[selected_sequence] == Sequence_Type.Flyby) contlol_panel.children[i].style.display = "flex";
  //       else contlol_panel.children[i].style.display = "none";
  //     }
  //     if (contlol_panel.children[i].id == "swingby") {
  //       if (mission_sequence.types[selected_sequence] == Sequence_Type.Swingby) contlol_panel.children[i].style.display = "flex";
  //       else contlol_panel.children[i].style.display = "none";
  //     }
  //     if (contlol_panel.children[i].id == "orbit") {
  //       if (mission_sequence.types[selected_sequence] == Sequence_Type.Orbit) contlol_panel.children[i].style.display = "flex";
  //       else contlol_panel.children[i].style.display = "none";
  //     }
  //     if (contlol_panel.children[i].id == "maneuver") {
  //       if (mission_sequence.types[selected_sequence] == Sequence_Type.Maneuver) contlol_panel.children[i].style.display = "flex";
  //       else contlol_panel.children[i].style.display = "none";
  //     }
  //   }
  launch = document.getElementsByClassName("launch");
  flyby = document.getElementsByClassName("flyby");
  swingby = document.getElementsByClassName("swingby");
  orbit = document.getElementsByClassName("orbit");
  maneuver = document.getElementsByClassName("maneuver");
  alway = document.getElementsByClassName("alway");

  //   if (mission_sequence.types[selected_sequence] == Sequence_Type.Launch) launch.style.display = "flex";
  //   else launch.style.display = "none";
  //   if (mission_sequence.types[selected_sequence] == Sequence_Type.Flyby) flyby.style.display = "flex";
  //   else flyby.style.display = "none";
  //   if (mission_sequence.types[selected_sequence] == Sequence_Type.Swingby) swingby.style.display = "flex";
  //   else swingby.style.display = "none";
  //   if (mission_sequence.types[selected_sequence] == Sequence_Type.Orbit) orbit.style.display = "flex";
  //   else orbit.style.display = "none";
  //   if (mission_sequence.types[selected_sequence] == Sequence_Type.Maneuver) maneuver.style.display = "flex";
  //   else maneuver.style.display = "none";
  for (let i = 0; i < alway.length; i++) {
    if (selected_sequence != -1) {
      alway[i].style.display = "flex";
    } else {
      alway[i].style.display = "none";
    }
  }

  //   else alway.style.display = "none";
}
updateControlPanelDisplay();

function Update_time() {
  date_time.value = JulianToDate(tmp_date)
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
  mission_sequence.set_date(selected_sequence,tmp_date);
  update_plot();
  v=mission_sequence.get_v_inf(selected_sequence)
  v_inf.textContent=v.toFixed(2);
  C3.textContent=(v*v).toFixed(2);
// console.log(mission_sequence.get_v_inf(selected_sequence));
  //   change_sequence();
}
Update_time();

date_time.addEventListener("change", function () {
  tmp_date = DateToJulian(new Date(date_time.value));
  //   change_sequence();
  Update_time();
});

// U_1day.addEventListener("click", function () {
//   tmp_date += 1;
//   Update_time();
// });
// U_5day.addEventListener("click", function () {
//   tmp_date += 5;
//   Update_time();
// });
// U_1month.addEventListener("click", function () {
//   d = JulianToDate(tmp_date);
//   d.setMonth(d.getMonth() + 1);
//   tmp_date = DateToJulian(d);
//   Update_time();
// });
// U_1year.addEventListener("click", function () {
//   d = JulianToDate(tmp_date);
//   d.setFullYear(d.getFullYear() + 1);
//   tmp_date = DateToJulian(d);
//   Update_time();
// });

// D_1day.addEventListener("click", function () {
//   tmp_date -= 1;
//   Update_time();
// });
// D_5day.addEventListener("click", function () {
//   tmp_date -= 5;
//   Update_time();
// });
// D_1month.addEventListener("click", function () {
//   d = JulianToDate(tmp_date);
//   d.setMonth(d.getMonth() - 1);
//   tmp_date = DateToJulian(d);
//   Update_time();
// });
// D_1year.addEventListener("click", function () {
//   d = JulianToDate(tmp_date);
//   d.setFullYear(d.getFullYear() - 1);
//   tmp_date = DateToJulian(d);
//   Update_time();
// });
// let change_day = [D_1year, D_1month, D_5day, D_1day, U_1day, U_5day, U_1month, U_1year];

// let is_pushed = [null, null];

// for (let i = 0; i < change_day.length; i++) {
//   // ボタンを押し続けたとき
//   change_day[i].addEventListener("mousedown", () => {
//     if (is_pushed[i]) return; // 既に実行中の場合はスキップ
//     is_pushed[i] = setInterval(() => {
//       change_day[i].click(); // クリックイベントを発火
//     }, 250); // 100msごとにクリック
//   });

//   // ボタンを離したとき
//   change_day[i].addEventListener("mouseup", () => {
//     clearInterval(is_pushed[i]); // 自動クリックを停止
//     is_pushed[i] = null;
//   });
//   change_day[i].addEventListener("mouseleave", () => {
//     clearInterval(is_pushed[i]); // 自動クリックを停止
//     is_pushed[i] = null;
//   });

//   // スマホ対応 (タッチイベント)

//   //   change_day[i].addEventListener("to")
//   change_day[i].addEventListener("touchstart", (e) => {
//     change_day[i].click();
//     e.preventDefault(); // デフォルト動作を防止
//     if (is_pushed[i]) return;
//     is_pushed[i] = setInterval(() => {
//       change_day[i].click(); // クリックイベントを発火
//     }, 250);
//   });

//   change_day[i].addEventListener("touchend", () => {
//     clearInterval(is_pushed[i]); // 自動クリックを停止
//     is_pushed[i] = null;
//   });
// }
// function clicked_plots() {}

// マウスイベントを登録
plot_area.addEventListener("mousedown", handleMouseDown);
plot_area.addEventListener("mouseup", handleMouseUp);
plot_area.addEventListener("mousemove", handleMouseMove);

plot_area.addEventListener("touchstart", handleTouchStart);
plot_area.addEventListener("touchend", handleTouchEnd);
plot_area.addEventListener("touchmove", handleTouchMove);

function handleTouchStart(event) {
  if (event.touches.length != 1) return;
  old_time = tmp_date;
  const element = event.currentTarget;
  // canvas要素上のXY座標
  const x = event.touches[0].clientX - element.offsetLeft;
  const y = event.touches[0].clientY - element.offsetTop;
  // canvas要素の幅・高さ
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  // -1〜+1の範囲で現在のマウス座標を登録する
  mouse.x = (x / w) * 2 - 1;
  mouse.y = -(y / h) * 2 + 1 - 0.04;

  Select_planet();
}
function handleTouchMove(event) {
  if (!is_change_time) return;
  const element = event.currentTarget;
  // canvas要素上のXY座標
  const x = event.touches[0].clientX - element.offsetLeft;
  const y = event.touches[0].clientY - element.offsetTop;
  // canvas要素の幅・高さ
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  // -1〜+1の範囲で現在のマウス座標を登録する
  mouse.x = (x / w) * 2 - 1;
  mouse.y = -(y / h) * 2 + 1 - 0.04;

  Dlag_planet();
}
function handleTouchEnd(event) {
  if (event.touches.length != 0) return;
  planet_speres[selected_planet].children[0].element.style.color = "black";
  controls.enableRotate = true;
  is_change_time = false;
}

// マウスを動かしたときのイベント
function handleMouseDown(event) {
  if (event.button != 0) return;
  old_time = tmp_date;
  const element = event.currentTarget;
  // canvas要素上のXY座標
  const x = event.clientX - element.offsetLeft;
  const y = event.clientY - element.offsetTop;
  // canvas要素の幅・高さ
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  // -1〜+1の範囲で現在のマウス座標を登録する
  mouse.x = (x / w) * 2 - 1;
  mouse.y = -(y / h) * 2 + 1 - 0.04;

  Select_planet();
}

function handleMouseMove(event) {
  if (!is_change_time) return;
  const element = event.currentTarget;
  // canvas要素上のXY座標
  const x = event.clientX - element.offsetLeft;
  const y = event.clientY - element.offsetTop;
  // canvas要素の幅・高さ
  const w = element.offsetWidth;
  const h = element.offsetHeight;

  // -1〜+1の範囲で現在のマウス座標を登録する
  mouse.x = (x / w) * 2 - 1;
  mouse.y = -(y / h) * 2 + 1 - 0.04;

  Dlag_planet();
}
function handleMouseUp(event) {
  if (event.button != 0) return;
  planet_speres[selected_planet].children[0].element.style.color = "black";
  controls.enableRotate = true;
  is_change_time = false;
}
