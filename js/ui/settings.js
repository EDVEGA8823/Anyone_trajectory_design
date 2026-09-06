// 「表示設定」の画面。
//
// いまのところ中身は配色 (明るい/暗い) だけ。単位の切り替えなど、
// 設計そのものではない「見え方」の設定はここに足していく。
//
// 配色は選んだ瞬間に変わる。OKを押さないと反映されない作りにすると、
// どちらが自分に合うか見比べられないため。

import { themePref, setThemePref, currentTheme, onThemeChange } from './theme.js';

const THEMES = [
  {
    id: "auto",
    label: "自動",
    desc: "お使いの端末の設定に合わせる",
  },
  {
    id: "light",
    label: "明るい",
    desc: "白い地に濃い文字。図を人に見せるとき向き",
  },
  {
    id: "dark",
    label: "暗い",
    desc: "黒い地に明るい文字。暗い部屋でまぶしくない",
  },
];

let root = null;
let buttons = new Map();
let note_el = null;
let unsubscribe = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function refresh() {
  const pref = themePref();
  for (const [id, btn] of buttons) btn.classList.toggle("st-choice--on", id === pref);
  if (note_el) {
    note_el.textContent =
      pref === "auto"
        ? "いまは端末の設定に従って「" + (currentTheme() === "dark" ? "暗い" : "明るい") + "」で出しています。"
        : "この端末では、次に開いたときもこの配色で出します。";
  }
}

function build() {
  const overlay = el("div", "st-overlay");
  const win = el("div", "st-window");

  const head = el("div", "st-head");
  head.appendChild(el("div", "st-title", "表示設定"));
  const close = el("button", "st-close", "×");
  close.type = "button";
  close.title = "閉じる";
  close.onclick = closeSettings;
  head.appendChild(close);
  win.appendChild(head);

  const body = el("div", "st-body");
  body.appendChild(el("div", "st-label", "配色"));

  const row = el("div", "st-choices");
  for (const t of THEMES) {
    const btn = el("button", "st-choice");
    btn.type = "button";
    btn.title = t.desc;
    btn.appendChild(swatch(t.id));
    btn.appendChild(el("div", "st-choice-name", t.label));
    btn.appendChild(el("div", "st-choice-desc", t.desc));
    btn.onclick = () => setThemePref(t.id);
    buttons.set(t.id, btn);
    row.appendChild(btn);
  }
  body.appendChild(row);

  note_el = el("div", "st-note");
  body.appendChild(note_el);
  win.appendChild(body);

  win.appendChild(
    el(
      "div",
      "st-foot",
      "ヘルプのページも同じ配色で開きます。画像で保存したときの色も、いまの配色になります。"
    )
  );

  overlay.appendChild(win);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeSettings();
  });
  return overlay;
}

/** 見本。明るい/暗い/自動 のそれぞれを、そのまま小さく描いて見せる */
function swatch(id) {
  const box = el("div", "st-swatch st-swatch--" + id);
  box.appendChild(el("div", "st-swatch-bar"));
  box.appendChild(el("div", "st-swatch-line"));
  box.appendChild(el("div", "st-swatch-line st-swatch-line--short"));
  return box;
}

export function openSettings() {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  root.style.display = "flex";
  // 「自動」のまま端末側が切り替わったときも、下の説明を合わせる
  if (!unsubscribe) unsubscribe = onThemeChange(refresh);
  refresh();
}

export function closeSettings() {
  if (root) root.style.display = "none";
}

export function isSettingsOpen() {
  return !!root && root.style.display !== "none";
}
