// 明るい配色と暗い配色の切り替え。
//
// 実際の色は css/tokens.css が持っている。ここがやるのは3つだけ。
//   ・どちらを使うかを決めて <html data-theme="light|dark"> に書く
//   ・選んだものを覚えておく (次に開いたときも同じ配色で出す)
//   ・切り替わったことを、CSSでは色を変えられないもの (three.js の3Dビュー、
//     2Dのポークチョップ図、書き出す画像) に知らせる
//
// 「自動」は端末の設定 (prefers-color-scheme) に従う。ただし data-theme には
// 常に light か dark のどちらかを書き込む。CSSのメディアクエリに任せず必ず
// 書くのは、three.js 側が「いまどちらなのか」を1か所を見るだけで判るように
// するため。ヘルプのページも同じ鍵を読むので、アプリを暗くしておけば
// ヘルプも暗く開く。

const KEY = "atd_theme"; // "auto" | "light" | "dark"
const LISTENERS = new Set();

let pref = "auto";
// index.html の先頭の小さな script が、スタイルより先にここを書いている。
// その値から始めることで、起動時に「変わった」合図を余計に出さずに済む
let theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
let media = null;

/* ==================================================================
   決める・書く
   ================================================================== */

function read_pref() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch (e) {
    // プライベートウィンドウなどで localStorage が使えないことがある。
    // 覚えられないだけで動きはするので、既定に落とす
  }
  return "auto";
}

function system_theme() {
  return media && media.matches ? "dark" : "light";
}

function resolve(p) {
  return p === "auto" ? system_theme() : p;
}

function apply(next) {
  const changed = next !== theme;
  theme = next;
  document.documentElement.dataset.theme = next;
  if (changed) {
    // 色を読み直すのは、data-theme を書いたあとでないと古い値が返る
    for (const fn of LISTENERS) {
      try {
        fn(theme);
      } catch (e) {
        // ひとつのビューがつまずいても、残りは切り替える
        console.error(e);
      }
    }
  }
}

/* ==================================================================
   外から使うもの
   ================================================================== */

/** 起動時に一度だけ呼ぶ */
export function initTheme() {
  media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  pref = read_pref();
  apply(resolve(pref));
  if (media) {
    // 「自動」のときだけ、端末の設定の変化についていく
    const on_change = () => {
      if (pref === "auto") apply(system_theme());
    };
    if (media.addEventListener) media.addEventListener("change", on_change);
    else if (media.addListener) media.addListener(on_change);
  }
}

/** "auto" | "light" | "dark" */
export function themePref() {
  return pref;
}

/** 実際に出ているほう。"light" | "dark" */
export function currentTheme() {
  return theme;
}

export function setThemePref(next) {
  if (next !== "auto" && next !== "light" && next !== "dark") return;
  pref = next;
  try {
    localStorage.setItem(KEY, next);
  } catch (e) {
    // 覚えられなくても、この画面のあいだは切り替わったままにする
  }
  apply(resolve(pref));
}

/** 切り替わったときに呼んでほしい関数を預ける。外すための関数を返す */
export function onThemeChange(fn) {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}

/* ==================================================================
   色を読む
   ================================================================== */

/**
 * css/tokens.css に書いてある色を1つ読む。
 * @param {string} name --line-red のような変数名
 * @param {string} fallback 読めなかったときの色
 */
export function cssColor(name, fallback = "#000000") {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  const s = (v || "").trim();
  return s || fallback;
}

/** three.js に渡すための 0xRRGGBB。#abc の短い書き方にも一応備える */
export function cssHex(name, fallback = 0x000000) {
  const s = cssColor(name, "");
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return fallback;
  const h = m[1];
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h;
  return parseInt(full, 16);
}

/**
 * 3Dビュー・2D図が使う線の色をまとめて取る。
 * 切り替わるたびに読み直す (値を持ち回すと、切り替え後に古い色が残る)。
 */
export function viewColors() {
  return {
    dark: cssHex("--line-dark", 0x1a1c20),
    gray: cssHex("--line-gray", 0x8a8f99),
    red: cssHex("--line-red", 0xd6543f),
    blue: cssHex("--line-blue", 0x3b6fe0),
    orange: cssHex("--line-orange", 0xe0a03b),
    purple: cssHex("--line-purple", 0x9b4fd8),
    green: cssHex("--line-green", 0x4caf82),
    vinf: cssHex("--line-vinf", 0xff8c1a),
    track: cssHex("--line-track", 0x2a5bd7),
    plotBg: cssHex("--plot-bg", 0xffffff),
  };
}

/** 暗い配色かどうか。明るさを振り分けたいところで使う */
export function isDark() {
  return theme === "dark";
}
