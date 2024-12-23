let date_time = document.getElementById("date_time");

let D_1year = document.getElementById("D_1year");
let D_1month = document.getElementById("D_1month");
let D_5day = document.getElementById("D_5day");
let D_1day = document.getElementById("D_1day");
let U_1day = document.getElementById("U_1day");
let U_5day = document.getElementById("U_5day");
let U_1month = document.getElementById("U_1month");
let U_1year = document.getElementById("U_1year");

let sequence = document.getElementById("sequence");

sequence.addEventListener("click", (event) => {
  if(event.target.className=="add_sequence"){
    // add_planet(event.target.id);
    mission_sequence.add(0, 0, tmp_date);
    console.log(mission_sequence);
  }
});

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

  update_plot();
  //   change_sequence();
}
Update_time();

date_time.addEventListener("change", function () {
  tmp_date = DateToJulian(new Date(date_time.value));
  update_plot();
  //   change_sequence();
  Update_time();
});

U_1day.addEventListener("click", function () {
  tmp_date += 1;
  Update_time();
});
U_5day.addEventListener("click", function () {
  tmp_date += 5;
  Update_time();
});
U_1month.addEventListener("click", function () {
  d = JulianToDate(tmp_date);
  d.setMonth(d.getMonth() + 1);
  tmp_date = DateToJulian(d);
  Update_time();
});
U_1year.addEventListener("click", function () {
  d = JulianToDate(tmp_date);
  d.setFullYear(d.getFullYear() + 1);
  tmp_date = DateToJulian(d);
  Update_time();
});

D_1day.addEventListener("click", function () {
  tmp_date -= 1;
  Update_time();
});
D_5day.addEventListener("click", function () {
  tmp_date -= 5;
  Update_time();
});
D_1month.addEventListener("click", function () {
  d = JulianToDate(tmp_date);
  d.setMonth(d.getMonth() - 1);
  tmp_date = DateToJulian(d);
  Update_time();
});
D_1year.addEventListener("click", function () {
  d = JulianToDate(tmp_date);
  d.setFullYear(d.getFullYear() - 1);
  tmp_date = DateToJulian(d);
  Update_time();
});
let change_day = [D_1year, D_1month, D_5day, D_1day, U_1day, U_5day, U_1month, U_1year];

let is_pushed = [null, null];

for (let i = 0; i < change_day.length; i++) {
  // ボタンを押し続けたとき
  change_day[i].addEventListener("mousedown", () => {
    if (is_pushed[i]) return; // 既に実行中の場合はスキップ
    is_pushed[i] = setInterval(() => {
      change_day[i].click(); // クリックイベントを発火
    }, 250); // 100msごとにクリック
  });

  // ボタンを離したとき
  change_day[i].addEventListener("mouseup", () => {
    clearInterval(is_pushed[i]); // 自動クリックを停止
    is_pushed[i] = null;
  });
  change_day[i].addEventListener("mouseleave", () => {
    clearInterval(is_pushed[i]); // 自動クリックを停止
    is_pushed[i] = null;
  });

  // スマホ対応 (タッチイベント)

  //   change_day[i].addEventListener("to")
  change_day[i].addEventListener("touchstart", (e) => {
    change_day[i].click();
    e.preventDefault(); // デフォルト動作を防止
    if (is_pushed[i]) return;
    is_pushed[i] = setInterval(() => {
      change_day[i].click(); // クリックイベントを発火
    }, 250);
  });

  change_day[i].addEventListener("touchend", () => {
    clearInterval(is_pushed[i]); // 自動クリックを停止
    is_pushed[i] = null;
  });
}
function clicked_plots() {}

// canvas 要素の参照を取得する
// const plot = document.querySelector('#plot');
// マウス座標管理用のベクトルを作成
const mouse = new THREE.Vector2();
// マウスイベントを登録
plot_area.addEventListener("mousedown", handleMouseDown);
plot_area.addEventListener("mouseup", handleMouseUp);
plot_area.addEventListener("mousemove", handleMouseMove);

is_change_time = false;
const raycaster = new THREE.Raycaster();

old_time = 0;
old_E = 0;
old_nu = 0;
rev_count = 1;
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
  //   console.log(dist);
  if (is_selected) {
    // console.log();
    planet_speres[selected_planet].children[0].element.style.color = "red";
    old_E = planet_elements[selected_planet][5];
    controls.enableRotate = false;
    is_change_time = true;

    vec = get_W_hat(planet_elements[selected_planet]);
    W_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);
    vec = get_P_hat(planet_elements[selected_planet]);
    P_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);

    u = raycaster.ray.direction;
    x_0 = raycaster.ray.origin;
    p = new THREE.Vector3().copy(x_0).sub(u.multiplyScalar(W_hat.dot(x_0) / W_hat.dot(u)));
    old_nu = -P_hat.angleTo(p) * -Math.sign(P_hat.cross(p).dot(W_hat));
    rev_count = 0;
  }
  //   console.log(raycaster.ray)

  //   // その光線とぶつかったオブジェクトを得る
  //   const intersects = raycaster.intersectObjects(scene.children);
  // intersects.forEach(obj => {
  //     if(obj.object.name ==selected_planet){
  //         console.log(planet_elements[obj.object.name][2]);
  //         controls.enableRotate=false;
  //         // orbit_plane.rotation.y = planet_elements[obj.object.name][3];
  //     }
  // });
}
function handleMouseUp(event) {
  if (event.button != 0) return;
  planet_speres[selected_planet].children[0].element.style.color = "black";
  controls.enableRotate = true;
  is_change_time = false;
}

function handleMouseMove(event) {
  if (is_change_time) {
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

    raycaster.setFromCamera(mouse, camera);
    vec = get_W_hat(planet_elements[selected_planet]);
    W_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);
    vec = get_P_hat(planet_elements[selected_planet]);
    P_hat = new THREE.Vector3(vec[0], vec[2], -vec[1]);

    u = raycaster.ray.direction;
    x_0 = raycaster.ray.origin;

    p = new THREE.Vector3().copy(x_0).sub(u.multiplyScalar(W_hat.dot(x_0) / W_hat.dot(u)));

    nu = -P_hat.angleTo(p) * -Math.sign(P_hat.cross(p).dot(W_hat));

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
}
