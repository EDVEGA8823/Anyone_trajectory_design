// 表示言語 (日本語 / 英語)。
//
// 【鍵は日本語そのもの】
// t("打上げ") のように、日本語の文字列をそのまま鍵にして英語を引く。
// 別に鍵を用意する流儀 (t("seq.launch")) にしなかったのは、
//   ・コードを読むときに、何が出るのかがその場で分かる
//   ・訳が無い分は日本語のまま出るので、途中の状態でも画面が壊れない
//   ・鍵を考える手間と、鍵と文言がずれる事故が無い
// ため。訳の一覧は js/i18n/en.js にある。
//
// 【同じ日本語で訳し分けたいとき】
// "自動##配色" のように ## のあとに但し書きを付けると、別の鍵として扱える。
// 日本語で出すときは但し書きを落とす。
//
// 【差し込み】
// t("「{name}」を読み込みました", { name: "火星" }) のように {名前} で埋める。
// 文字列を + で繋いで作ると、英語と語順が違うときに直せなくなるため。
//
// 【切り替わったとき】
// CSSと違って、文字は書き直さないと変わらない。onLangChange() で知らせるので、
// 画面を組み立てている側が描き直す。作ったきり使い回している画面 (ダイアログ) は
// 覚えている DOM を捨てて、次に開くときに作り直させる。

import { EN } from '../i18n/en.js';

const KEY = "atd_lang"; // "ja" | "en"
const TABLES = { ja: null, en: EN };
const LISTENERS = new Set();

let lang = "ja";

/* ==================================================================
   引く
   ================================================================== */

/** "自動##配色" → "自動" */
function bare(s) {
  const i = s.indexOf("##");
  return i < 0 ? s : s.slice(0, i);
}

/**
 * 訳を引く。
 *
 * 中身が決まっていないところ (何も選んでいないときの種別など) から
 * undefined が渡ることがある。訳の引き当てで画面を止めたくないので、
 * 文字でないものはそのまま返す。
 *
 * @param {string} s 日本語の原文 (但し書きを付けるときは "原文##但し書き")
 * @param {object} [params] {名前} を埋める値
 */
export function t(s, params) {
  if (typeof s !== "string") return s == undefined ? "" : String(s);
  const table = TABLES[lang];
  let out = table && table[s] !== undefined ? table[s] : bare(s);
  if (params) {
    out = out.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? String(params[k]) : m));
  }
  return out;
}

/**
 * その原文の、すべての言語での言い方を返す (原文自身を含む)。
 *
 * 「まだ名前を付けていないミッション」の判定に使う。英語で始めて日本語に
 * 切り替えた人の "Untitled mission" を、その人が付けた名前と取り違えないため。
 */
export function allWordings(s) {
  const out = [s];
  for (const table of Object.values(TABLES)) {
    if (table && table[s] !== undefined) out.push(table[s]);
  }
  return out;
}

/* ==================================================================
   決める
   ================================================================== */

function read_pref() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "ja" || v === "en") return v;
  } catch (e) {
    // プライベートウィンドウなどで localStorage が使えないことがある
  }
  // 覚えていなければ、ブラウザの言語から決める。日本語以外は英語で出す
  const nav = (navigator.language || "").toLowerCase();
  return nav.startsWith("ja") ? "ja" : "en";
}

/** 起動時に一度だけ呼ぶ */
export function initLang() {
  lang = read_pref();
  document.documentElement.lang = lang;
}

/** "ja" | "en" */
export function currentLang() {
  return lang;
}

export function setLang(next) {
  if (next !== "ja" && next !== "en") return;
  if (next === lang) return;
  lang = next;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch (e) {
    // 覚えられなくても、この画面のあいだは切り替わったままにする
  }
  applyStaticText();
  for (const fn of LISTENERS) {
    try {
      fn(lang);
    } catch (e) {
      // ひとつの画面がつまずいても、残りは切り替える
      console.error(e);
    }
  }
}

/** 切り替わったときに呼んでほしい関数を預ける。外すための関数を返す */
export function onLangChange(fn) {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}

/* ==================================================================
   index.html に直に書いてある文字
   ==================================================================
   HTML側は data-i18n="原文" と書いておく。属性に出るものは
   data-i18n-title / data-i18n-placeholder / data-i18n-aria。
   原文は属性の値に持たせているので、HTMLだけ読んでも何が出るか分かる。 */

// value は入れない。入力欄の中身は人が打ったものかもしれず、言語を
// 切り替えるたびに書き戻すと、付けた名前が消える。既定のままかどうかの
// 判断が要るので、そこは js/main.js が受け持つ
const ATTRS = [
  ["data-i18n-title", "title"],
  ["data-i18n-placeholder", "placeholder"],
  ["data-i18n-aria", "aria-label"],
];

export function applyStaticText() {
  // タブに出る見出し。<title> は data-i18n を付けられないのでここで直に
  document.title = t("だれでも軌道設計");
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const [attr, target] of ATTRS) {
    for (const el of document.querySelectorAll("[" + attr + "]")) {
      el.setAttribute(target, t(el.getAttribute(attr)));
    }
  }
}
