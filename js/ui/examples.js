// 「例を読み込む」の画面。
//
// ヘルプ (docs/) で組み立てている軌道を、そのまま読み込めるようにしたもの。
// 実体は data/examples/ に置いた保存ファイルで、資料の図を作るのと同じ手順から
// tools/make_examples.py が書き出している。だから、ここから読んだものは資料に
// 載っている図・数字とそのまま一致する。
//
// このファイルの仕事は3つだけ。
//   ・目録 (index.json) を読んで一覧を出す
//   ・選ばれたものを読み込む (上書きになるので、保存し忘れは先に尋ねる)
//   ・解説ページへの入口を添える

import { confirmDiscard, loadMissionData } from '../mission/mission_file.js';
import { notify } from './topbar.js';
import { t, currentLang, onLangChange } from './i18n.js';

const BASE = "data/examples/";

let root = null;
let list_el = null;
let index_promise = null;
let loading = false;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

/** 目録を読む (何度開いても実際の読み込みは1回) */
function loadIndex() {
  if (index_promise) return index_promise;
  index_promise = fetch(BASE + "index.json", { cache: "default" })
    .then((res) => {
      if (!res.ok) throw new Error(t("index.json が読めません ({status})", { status: res.status }));
      return res.json();
    })
    .catch((e) => {
      // 次に開いたときにもう一度試せるよう、失敗は覚えない
      index_promise = null;
      throw e;
    });
  return index_promise;
}

async function pick(item, btn) {
  if (loading) return;
  loading = true;
  btn.classList.add("ex-item--busy");
  try {
    // 読み込むと今の設計は消える。ファイルを開くときと同じ確認を通す
    if (!(await confirmDiscard(t("読み込む")))) return;
    const res = await fetch(BASE + item.file, { cache: "default" });
    if (!res.ok) throw new Error(item.file + " (" + res.status + ")");
    const data = await res.json();
    // ファイルの中の名前は日本語で固めてある。一覧に出しているのと同じ名前で
    // 読み込む (英語表示のときに、ミッション名だけ日本語で残らないように)
    data.name = shown(item, "name");
    if (loadMissionData(data, data.name)) closeExamples();
  } catch (e) {
    notify(t("例を読み込めませんでした"));
  } finally {
    loading = false;
    btn.classList.remove("ex-item--busy");
  }
}

function fill(index) {
  list_el.innerHTML = "";
  let group = null;
  (index.examples || []).forEach((item) => {
    if (item.group && item.group !== group) {
      group = item.group;
      list_el.appendChild(el("div", "ex-group", t(group)));
    }
    const row = el("div", "ex-row");
    const btn = el("button", "ex-item");
    btn.type = "button";
    btn.appendChild(el("div", "ex-name", shown(item, "name")));
    btn.appendChild(el("div", "ex-desc", shown(item, "desc")));
    btn.onclick = () => pick(item, btn);
    row.appendChild(btn);
    if (item.doc) {
      // 解説は別ページ。設計を抱えたまま遷移しないよう新しいタブで開く
      const doc = el("a", "ex-doc", t("解説"));
      doc.href = docPath(item.doc);
      doc.target = "_blank";
      doc.rel = "noopener";
      doc.title = t("この軌道の解説を読む");
      row.appendChild(doc);
    }
    list_el.appendChild(row);
  });
}

function build() {
  const overlay = el("div", "ex-overlay");
  const win = el("div", "ex-window");

  const head = el("div", "ex-head");
  head.appendChild(el("div", "ex-title", t("例を読み込む")));
  const close = el("button", "ex-close", "×");
  close.type = "button";
  close.title = t("閉じる");
  close.onclick = closeExamples;
  head.appendChild(close);
  win.appendChild(head);

  list_el = el("div", "ex-body");
  win.appendChild(list_el);

  win.appendChild(
    el(
      "div",
      "ex-foot",
      t("ヘルプ (使い方) で組み立てている軌道です。読み込むと今の設計は消えます。「解説」を開くと、その軌道をどう作ったかが順を追って読めます。")
    )
  );

  overlay.appendChild(win);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeExamples();
  });
  return overlay;
}

// 目録は名前と説明を日本語で持ち、英語は name_en / desc_en に持つ。
// 英語が無いものは日本語のまま出す (訳し忘れでも一覧が消えないように)
function shown(item, key) {
  if (currentLang() === "en" && item[key + "_en"]) return item[key + "_en"];
  return item[key] || "";
}

/** 解説の入口。英語のときは docs/en/ の同じ名前のページへ向ける */
function docPath(doc) {
  if (!doc) return doc;
  return currentLang() === "en" ? doc.replace("docs/", "docs/en/") : doc;
}

// 言語が変わったら、覚えている画面を捨てる (次に開くときに組み直す)
onLangChange(() => {
  if (root) {
    root.remove();
    root = null;
    list_el = null;
  }
});

export function openExamples() {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  root.style.display = "flex";
  list_el.innerHTML = "";
  list_el.appendChild(el("div", "ex-note", t("読み込んでいます…")));
  loadIndex().then(
    (index) => {
      if (isExamplesOpen()) fill(index);
    },
    () => {
      list_el.innerHTML = "";
      list_el.appendChild(el("div", "ex-note", t("例の一覧を読めませんでした。")));
    }
  );
}

export function closeExamples() {
  if (root) root.style.display = "none";
}

export function isExamplesOpen() {
  return !!root && root.style.display !== "none";
}
