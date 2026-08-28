// 画面上部のバー。
//
// ミッションそのものの操作 (保存・読込・天体の追加) と、アプリまわりの操作
// (ヘルプ・言語・共有) を集めた場所。軌道設計そのものの操作は右の操作パネルに
// あるので、ここには「設計以外のこと」だけを置く。
//
// 中身の処理はまだ無い。押されたら setTopbarHandlers で登録された関数を呼び、
// 登録が無ければ「準備中」と出すだけにしてある。後から実装を差し込めるように、
// ボタンの並びと呼び口だけを先に決めておくのがこのファイルの役目。

const ICON = {
  // ブランドマーク (黄道面を回る軌道)
  brand:
    '<ellipse cx="12" cy="12" rx="9.2" ry="4.6" transform="rotate(-20 12 12)"/>' +
    '<circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="19.4" cy="8.2" r="1.5" fill="currentColor" stroke="none"/>',
  body: '<circle cx="10" cy="10" r="5.5"/><path d="M18.5 15v6M15.5 18h6"/>',
  save: '<path d="M12 3v11M8 10.5l4 4 4-4M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
  load: '<path d="M12 14.5V3.5M8 7l4-4 4 4M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 1 1 3.2 2.5c-.5.2-.7.6-.7 1.1v.6"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  file: '<path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13 3v6h6"/>',
  example: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2 2 2 0 0 1 2-2h4.5A1.5 1.5 0 0 1 20 5.5v12a1.5 1.5 0 0 1-1.5 1.5H14a2 2 0 0 0-2 2 2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 17.5z"/><path d="M12 6v14"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3 3 3-2.5L20 17"/>',
  link: '<path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.2 1.2"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.2-1.2"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  feedback: '<path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H9l-4.5 3.5V6.5A2.5 2.5 0 0 1 7 4h10.5A2.5 2.5 0 0 1 20 6.5z"/>',
  // Xのロゴだけは輪郭が細かいので塗りで描く
  x: '<path fill="currentColor" stroke="none" d="M17.53 3h2.94l-6.42 7.34L21.6 21h-5.9l-4.63-6.05L5.78 21H2.83l6.87-7.85L2.4 3h6.05l4.18 5.53zm-1.03 16.2h1.63L7.6 4.71H5.85z"/>',
};

function svg(name) {
  return (
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICON[name] +
    "</svg>"
  );
}

/**
 * バーとメニューに並べるもの。
 *   where: "bar"  … 常にバーに置く
 *          "both" … 広いときはバー、狭いときはメニュー (CSSで出し分ける)
 *          "menu" … メニューだけ
 */
const ACTIONS = [
  {
    id: "add_body",
    label: "天体を追加",
    icon: "body",
    hint: "小惑星や彗星を、番号や名前を指定して天体の一覧に加える",
    where: "both",
    primary: true,
  },
  { id: "save", label: "保存", icon: "save", hint: "いまのミッションをファイルに保存する", where: "both" },
  { id: "load", label: "読込", icon: "load", hint: "保存したミッションを読み込む", where: "both" },
  { id: "share_x", label: "Xで共有", icon: "x", hint: "いまのミッションをXに投稿する", where: "both", compact: true },
  { id: "help", label: "ヘルプ", icon: "help", hint: "使い方のドキュメントを開く", where: "both", compact: true },
  { sep: true },

  { id: "new", label: "新規作成", icon: "file", hint: "ミッションを空にして最初からやり直す", where: "menu" },
  { id: "examples", label: "例を読み込む", icon: "example", hint: "実際の探査機のミッションを読み込んで参考にする", where: "menu" },
  { sep: true },
  { id: "export_image", label: "画像で保存", icon: "image", hint: "いまの軌道図を画像として保存する", where: "menu" },
  { id: "share_link", label: "共有リンクをコピー", icon: "link", hint: "このミッションを開けるURLをコピーする", where: "menu" },
  { sep: true },
  { id: "shortcuts", label: "キーボード操作", icon: "keyboard", hint: "ショートカットの一覧を見る", where: "menu" },
  { id: "settings", label: "表示設定", icon: "settings", hint: "単位や配色などの表示の設定", where: "menu" },
  { id: "feedback", label: "フィードバックを送る", icon: "feedback", hint: "要望や不具合を伝える", where: "menu" },
];

const LANGUAGES = [
  ["ja", "JP"],
  ["en", "EN"],
];

let handlers = {};
let menu_el = null;
let lang_el = null;
let language = "ja";
let toast_timer = 0;

/* ==================================================================
   組み立て
   ================================================================== */

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != undefined) e.innerHTML = html;
  return e;
}

function fire(action) {
  close_menu();
  const fn = handlers[action.id];
  if (fn) {
    fn(action.id);
    return;
  }
  // まだ中身が無いもの。押しても何も起きないと壊れて見えるので、そう言っておく
  notify("「" + action.label + "」は準備中です");
}

function make_button(action) {
  const btn = el("button", "topbar-btn", svg(action.icon) + '<span class="topbar-btn-label">' + action.label + "</span>");
  btn.type = "button";
  btn.title = action.label + "\n" + action.hint;
  btn.dataset.id = action.id;
  if (action.primary) btn.classList.add("topbar-btn--primary");
  // アイコンだけで意味が通るものは、狭いときに文字を隠す
  if (action.compact) btn.classList.add("topbar-btn--compact");
  btn.onclick = () => fire(action);
  return btn;
}

function make_menu_item(action) {
  const item = el("button", "topbar-menu-item", svg(action.icon) + "<span>" + action.label + "</span>");
  item.type = "button";
  item.title = action.hint;
  item.dataset.id = action.id;
  // バーにも出ているものは、バーが詰まって隠れたときだけメニューに出す
  if (action.where === "both") item.classList.add("only-narrow");
  item.onclick = () => fire(action);
  return item;
}

function make_language() {
  const wrap = el("div", "topbar-lang");
  wrap.title = "表示言語を切り替える";
  LANGUAGES.forEach(([code, text]) => {
    const b = el("button", "topbar-lang-btn", text);
    b.type = "button";
    b.dataset.lang = code;
    b.onclick = () => {
      const fn = handlers.language;
      if (fn) {
        fn(code); // 実装がある場合は、切り替えた側が setTopbarLanguage を呼ぶ
        return;
      }
      // 実装が無いうちは見た目だけ動かすと嘘になるので、言うだけにする
      if (code !== language) notify("英語表示は準備中です");
    };
    wrap.appendChild(b);
  });
  lang_el = wrap;
  return wrap;
}

function make_menu() {
  const menu = el("div", "topbar-menu");
  menu.hidden = true;
  for (const a of ACTIONS) {
    if (a.sep) {
      menu.appendChild(el("div", "topbar-menu-sep"));
      continue;
    }
    if (a.where === "bar") continue;
    menu.appendChild(make_menu_item(a));
  }
  return menu;
}

function toggle_menu(btn) {
  if (!menu_el) return;
  const open = menu_el.hidden;
  if (open) tidy_separators();
  menu_el.hidden = !open;
  btn.classList.toggle("active", open);
}

// 区切り線は、画面幅によって項目が出入りするので開くたびに見直す。
// 前後に見えている項目が無い区切りと、続けて並んだ区切りは引っ込める。
function tidy_separators() {
  const kids = Array.from(menu_el.children);
  const is_sep = (e) => e.classList.contains("topbar-menu-sep");
  const shown = (e) => !is_sep(e) && getComputedStyle(e).display !== "none";

  let before = false;
  for (let i = 0; i < kids.length; i++) {
    if (!is_sep(kids[i])) {
      if (shown(kids[i])) before = true;
      continue;
    }
    let after = false;
    for (let j = i + 1; j < kids.length; j++) {
      if (shown(kids[j])) {
        after = true;
        break;
      }
    }
    const use = before && after;
    kids[i].style.display = use ? "" : "none";
    if (use) before = false; // 次の項目が出るまで、続けて区切らない
  }
}

function close_menu() {
  if (!menu_el || menu_el.hidden) return;
  menu_el.hidden = true;
  const btn = document.querySelector(".topbar-more");
  if (btn) btn.classList.remove("active");
}

/** 上部バーを組み立てる。index.html には空の #topbar_actions だけ置いてある */
export function initTopbar() {
  const host = document.getElementById("topbar_actions");
  if (!host) return;
  host.innerHTML = "";

  for (const a of ACTIONS) {
    if (a.sep || a.where === "menu") continue;
    if (a.id === "share_x" || a.id === "help") continue; // 右寄りの並びは後でまとめて置く
    host.appendChild(make_button(a));
  }

  host.appendChild(el("div", "topbar-sep"));
  host.appendChild(make_button(ACTIONS.find((a) => a.id === "share_x")));
  host.appendChild(make_language());
  host.appendChild(make_button(ACTIONS.find((a) => a.id === "help")));

  const more = el("button", "topbar-btn topbar-more", svg("more"));
  more.type = "button";
  more.title = "そのほかの操作";
  more.setAttribute("aria-label", "そのほかの操作");
  more.onclick = (e) => {
    e.stopPropagation();
    toggle_menu(more);
  };
  host.appendChild(more);

  menu_el = make_menu();
  host.appendChild(menu_el);

  // メニューの外を触ったら閉じる
  document.addEventListener("click", (e) => {
    if (menu_el && !menu_el.hidden && !menu_el.contains(e.target)) close_menu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close_menu();
  });

  setTopbarLanguage(language);
}

/* ==================================================================
   外向きの API
   ================================================================== */

/**
 * ボタンが押されたときに呼ぶ関数を登録する。
 * キーは ACTIONS の id (add_body, save, load, share_x, help, new, examples,
 * export_image, share_link, shortcuts, settings, feedback) と language。
 * 登録されていないボタンは「準備中」と出すだけになる。
 */
export function setTopbarHandlers(h) {
  handlers = { ...handlers, ...h };
}

/** いま選ばれている言語を見た目に反映する ("ja" | "en") */
export function setTopbarLanguage(code) {
  language = code;
  if (!lang_el) return;
  for (const b of lang_el.querySelectorAll(".topbar-lang-btn")) {
    b.classList.toggle("active", b.dataset.lang === code);
  }
}

export function topbarLanguage() {
  return language;
}

/** ミッション名の欄の中身 */
export function missionName() {
  const input = document.getElementById("mission_name");
  return input ? input.value : "";
}

export function setMissionName(name) {
  const input = document.getElementById("mission_name");
  if (input) input.value = name;
}

/**
 * 画面上部に短い知らせを出す (数秒で消える)。
 * 上部バー以外からも使える汎用の口にしてある。
 */
export function notify(text) {
  let t = document.getElementById("toast");
  if (!t) {
    t = el("div", "toast");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  if (toast_timer) clearTimeout(toast_timer);
  toast_timer = setTimeout(() => {
    t.classList.remove("show");
    toast_timer = 0;
  }, 2400);
}
