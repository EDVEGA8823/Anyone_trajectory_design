// ヘルプのページの配色。
//
// アプリ (js/ui/theme.js) と同じ鍵 (atd_theme) を読む。同じ置き場所なので、
// アプリで暗い配色を選んでおけばヘルプも暗く開く。ヘルプはアプリの窓の
// 隣に並べて読むもの (「ヘルプ」は別窓で開く) なので、片方だけ白いと
// まぶしい。
//
// ここで持つのは3つだけ。
//   ・どちらを使うかを決めて <html data-theme> に書く
//   ・上のバーに切り替えを1つ置く
//   ・アプリ側で切り替えられたら、開いたままのこのページも追いかける
//
// ちらつきを防ぐため、data-theme を書くところだけは各ページの <head> に
// 直に置いてある (このファイルを待つと一瞬白い画面が出る)。ここはその続き。

(function () {
  "use strict";

  var KEY = "atd_theme"; // "auto" | "light" | "dark"
  var ORDER = ["auto", "light", "dark"];
  var LABEL = { auto: "配色 自動", light: "配色 明るい", dark: "配色 暗い" };
  var HINT = {
    auto: "いまは端末の設定に合わせています。押すと「明るい」になります",
    light: "いまは明るい配色です。押すと「暗い」になります",
    dark: "いまは暗い配色です。押すと端末の設定に合わせます",
  };

  var button = null;

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark" || v === "auto") return v;
    } catch (e) {
      // プライベートウィンドウなどで使えないことがある。既定に落とす
    }
    return "auto";
  }

  function system() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function apply(pref) {
    document.documentElement.dataset.theme = pref === "auto" ? system() : pref;
    if (button) {
      button.textContent = LABEL[pref];
      button.title = HINT[pref];
    }
  }

  function set(pref) {
    try {
      localStorage.setItem(KEY, pref);
    } catch (e) {
      // 覚えられなくても、このページのあいだは切り替わったままにする
    }
    apply(pref);
  }

  function build() {
    var bar = document.querySelector(".topbar");
    if (!bar) return;
    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-btn";
    button.onclick = function () {
      var i = ORDER.indexOf(read());
      set(ORDER[(i + 1) % ORDER.length]);
    };
    // 「タブで開く」の左に置く。並びの最後は、そのページ自身への入口のまま
    var last = bar.querySelector('a[target="_blank"]');
    if (last) bar.insertBefore(button, last);
    else bar.appendChild(button);
    apply(read());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", build);
  } else {
    build();
  }

  // アプリ側 (別の窓) で切り替えられたら、開いたままのこのページも追いかける。
  // storage は「他の窓が書いたとき」にだけ届くので、自分で押したぶんは来ない
  window.addEventListener("storage", function (e) {
    if (e.key === KEY) apply(read());
  });

  // 「自動」のあいだは端末の設定の変化についていく
  if (window.matchMedia) {
    var m = window.matchMedia("(prefers-color-scheme: dark)");
    var on = function () {
      if (read() === "auto") apply("auto");
    };
    if (m.addEventListener) m.addEventListener("change", on);
    else if (m.addListener) m.addListener(on);
  }
})();
