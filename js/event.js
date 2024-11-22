let date_time = document.getElementById("date_time");

let D_1year = document.getElementById("D_1year");
let D_1month = document.getElementById("D_1month");
let D_5day = document.getElementById("D_5day");
let D_1day = document.getElementById("D_1day");
let U_1day = document.getElementById("U_1day");
let U_5day = document.getElementById("U_5day");
let U_1month = document.getElementById("U_1month");
let U_1year = document.getElementById("U_1year");

function Update_time() {
  date_time.value = JulianToDate(dates[0])
    .toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replaceAll("/", "-");
  update_plot();
  make_launch_sequence();
}

date_time.addEventListener("change", function () {
  dates[0] = DateToJulian(new Date(date_time.value));
  update_plot();
  make_launch_sequence();
  Update_time();
});

U_1day.addEventListener("click", function () {
  dates[0] += 1;
  Update_time();
});
U_5day.addEventListener("click", function () {
  dates[0] += 5;
  Update_time();
});
U_1month.addEventListener("click", function () {
  d = JulianToDate(dates[0]);
  d.setMonth(d.getMonth() + 1);
  dates[0] = DateToJulian(d);
  Update_time();
});
U_1year.addEventListener("click", function () {
  d = JulianToDate(dates[0]);
  console.log(d.getYear());
  d.setFullYear(d.getFullYear() + 1);
  dates[0] = DateToJulian(d);
  Update_time();
});

D_1day.addEventListener("click", function () {
  dates[0] -= 1;
  Update_time();
});
D_5day.addEventListener("click", function () {
  dates[0] -= 5;
  Update_time();
});
D_1month.addEventListener("click", function () {
  d = JulianToDate(dates[0]);
  d.setMonth(d.getMonth() - 1);
  dates[0] = DateToJulian(d);
  Update_time();
});
D_1year.addEventListener("click", function () {
  d = JulianToDate(dates[0]);
  d.setFullYear(d.getFullYear() - 1);
  dates[0] = DateToJulian(d);
  Update_time();
});
let change_day = [
  D_1year,
  D_1month,
  D_5day,
  D_1day,
  U_1day,
  U_5day,
  U_1month,
  U_1year,
];

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
