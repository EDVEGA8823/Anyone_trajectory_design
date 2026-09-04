// キーボード操作。
//
// 一覧 (SHORTCUT_GROUPS) が実体で、キーの受け付けと「キーボード操作」の
// 画面の両方がこれを読む。別々に書くと、片方を直したときにもう片方が
// 古いまま残って、画面が嘘の説明を出すことになる。
//
// 割り当ての決め方:
//   ・画面にボタンがあるものは、その刻みに合わせる (時刻の ±1日 / ±10日 は
//     時刻の枠に並んでいるボタンと同じ)
//   ・押した結果が取り返しの付かないものは、修飾キー付きにするか、
//     元に戻す (Ctrl+Z) で戻せることを確かめてから割り当てる
//   ・ブラウザが持っていく組み合わせ (Ctrl+T、Alt+←) は使わない

import { isDialogOpen } from './dialog.js';
import { isBodyPickerOpen } from './body_picker.js';
import { isPorkchopOpen, closePorkchop } from './porkchop.js';

/* ==================================================================
   割り当て
   ==================================================================
   keys   … 画面に出す形。[["Ctrl","Z"]] のように、同じ働きの組み合わせが
            複数あれば並べる
   combos … 実際に受け付ける形。key は e.key を小文字にしたもの。
            shift を書かないときはどちらでもよい (「?」のように文字自体が
            シフトで変わるキーがあるため)。ctrl は Ctrl と ⌘ の両方。 */
export const SHORTCUT_GROUPS = [
  {
    title: "シーケンスを選ぶ",
    items: [
      {
        action: "select_prev",
        keys: [["↑"]],
        combos: [{ key: "arrowup", shift: false }],
        desc: "ひとつ前のシーケンスを選ぶ",
      },
      {
        action: "select_next",
        keys: [["↓"]],
        combos: [{ key: "arrowdown", shift: false }],
        desc: "ひとつ後のシーケンスを選ぶ",
      },
      {
        action: "escape",
        keys: [["Esc"]],
        combos: [{ key: "escape" }],
        desc: "選択を外す (時刻を変えている途中なら、その取り消し)",
      },
    ],
  },
  {
    title: "時刻を動かす",
    items: [
      {
        action: "day_back",
        keys: [["←"]],
        combos: [{ key: "arrowleft", shift: false }],
        desc: "1日 早める",
      },
      {
        action: "day_fwd",
        keys: [["→"]],
        combos: [{ key: "arrowright", shift: false }],
        desc: "1日 遅らせる",
      },
      {
        action: "day_back10",
        keys: [["Shift", "←"]],
        combos: [{ key: "arrowleft", shift: true }],
        desc: "10日 早める",
      },
      {
        action: "day_fwd10",
        keys: [["Shift", "→"]],
        combos: [{ key: "arrowright", shift: true }],
        desc: "10日 遅らせる",
      },
      {
        action: "edit_prev",
        keys: [["Shift", "↑"]],
        combos: [{ key: "arrowup", shift: true }],
        desc: "動かす相手を前のシーケンスに移す (操作パネルはそのまま)",
      },
      {
        action: "edit_next",
        keys: [["Shift", "↓"]],
        combos: [{ key: "arrowdown", shift: true }],
        desc: "動かす相手を後のシーケンスに移す",
      },
      {
        action: "confirm_time",
        keys: [["Enter"]],
        combos: [{ key: "enter" }],
        desc: "変えた時刻を確定する",
      },
    ],
  },
  {
    title: "組み立てる",
    items: [
      {
        action: "add",
        keys: [["A"]],
        combos: [{ key: "a", ctrl: false }],
        desc: "選んだシーケンスの後ろに1つ足す (選んでいなければ末尾)",
      },
      {
        action: "delete",
        keys: [["Delete"], ["Backspace"]],
        combos: [{ key: "delete" }, { key: "backspace" }],
        desc: "選んだシーケンスを消す",
      },
      {
        action: "undo",
        keys: [["Ctrl", "Z"]],
        combos: [{ key: "z", ctrl: true, shift: false }],
        desc: "元に戻す",
      },
      {
        action: "redo",
        keys: [["Ctrl", "Y"], ["Ctrl", "Shift", "Z"]],
        combos: [{ key: "y", ctrl: true }, { key: "z", ctrl: true, shift: true }],
        desc: "やり直す",
      },
    ],
  },
  {
    title: "道具",
    items: [
      {
        action: "tune",
        keys: [["T"]],
        combos: [{ key: "t", ctrl: false }],
        desc: "自動調整をかける",
      },
      {
        action: "porkchop",
        keys: [["P"]],
        combos: [{ key: "p", ctrl: false }],
        desc: "出発日と到着日の地図を開く",
      },
      {
        action: "z_zoom",
        keys: [["Z"]],
        combos: [{ key: "z", ctrl: false }],
        desc: "太陽系ビューの上下を引き伸ばす / 戻す",
      },
      {
        action: "save",
        keys: [["Ctrl", "S"]],
        combos: [{ key: "s", ctrl: true }],
        desc: "ミッションを保存する",
      },
      {
        action: "load",
        keys: [["Ctrl", "O"]],
        combos: [{ key: "o", ctrl: true }],
        desc: "ミッションを読み込む",
      },
      {
        action: "help",
        keys: [["?"]],
        combos: [{ key: "?" }],
        desc: "この一覧を出す",
      },
    ],
  },
];

/* ==================================================================
   受け付け
   ================================================================== */

// 中身は main.js が setShortcutHandlers で入れる。
// ここが直に main.js を呼ぶと、画面部品が全体の司令塔を知ることになるので、
// 上位から渡してもらう形にしておく (トップバーと同じ流儀)。
let handlers = {};

export function setShortcutHandlers(h) {
  handlers = h || {};
}

// 文字を打っている最中は、Ctrl付きのものだけ通す。
// 数値欄で←→を取り上げると桁を直せなくなるし、名前の欄でAを取り上げると
// 「A」が打てなくなる。
function isTyping(t) {
  if (!t) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  return tag === "INPUT" && !/^(checkbox|radio|button|submit|reset|file)$/.test(t.type);
}

function matches(e, c) {
  const key = String(e.key).toLowerCase();
  if (key !== c.key) return false;
  const ctrl = e.ctrlKey || e.metaKey;
  if (!!c.ctrl !== ctrl) return false;
  if (c.shift !== undefined && c.shift !== e.shiftKey) return false;
  return !e.altKey;
}

function findAction(e) {
  for (const g of SHORTCUT_GROUPS) {
    for (const item of g.items) {
      if (item.combos.some((c) => matches(e, c))) return item;
    }
  }
  return null;
}

export function installShortcutKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) return; // 日本語入力の変換中

    // 前に出ている画面が自分でキーを見ているので、こちらは手を出さない
    if (isDialogOpen() || isBodyPickerOpen()) return;
    if (isShortcutsOpen()) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        closeShortcuts();
      }
      return;
    }
    // 地図が開いている間の Esc は、地図を閉じるほうに使う
    if (isPorkchopOpen() && e.key === "Escape") {
      e.preventDefault();
      closePorkchop();
      return;
    }

    const item = findAction(e);
    if (!item) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (isTyping(e.target) && !ctrl) return;

    const fn = item.action === "help" ? openShortcuts : handlers[item.action];
    if (!fn) return;
    e.preventDefault();
    fn();
  });
}

/* ==================================================================
   「キーボード操作」の画面
   ================================================================== */

let root = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function build() {
  const overlay = el("div", "ks-overlay");
  const win = el("div", "ks-window");

  const head = el("div", "ks-head");
  head.appendChild(el("div", "ks-title", "キーボード操作"));
  const close = el("button", "ks-close", "×");
  close.type = "button";
  close.title = "閉じる";
  close.onclick = closeShortcuts;
  head.appendChild(close);
  win.appendChild(head);

  const body = el("div", "ks-body");
  SHORTCUT_GROUPS.forEach((g) => {
    const sec = el("div", "ks-group");
    sec.appendChild(el("div", "ks-group-title", g.title));
    g.items.forEach((item) => {
      const row = el("div", "ks-row");
      const keys = el("div", "ks-keys");
      item.keys.forEach((combo, i) => {
        if (i > 0) keys.appendChild(el("span", "ks-or", "/"));
        // ひとまとまりの組み合わせが途中で折り返されないよう、1つに包む
        const box = el("span", "ks-combo");
        combo.forEach((k, j) => {
          if (j > 0) box.appendChild(el("span", "ks-plus", "+"));
          box.appendChild(el("kbd", null, k));
        });
        keys.appendChild(box);
      });
      row.appendChild(keys);
      row.appendChild(el("div", "ks-desc", item.desc));
      sec.appendChild(row);
    });
    body.appendChild(sec);
  });
  win.appendChild(body);

  win.appendChild(
    el(
      "div",
      "ks-foot",
      "時刻を動かすキーは、時刻の枠に出ている相手 (「2. 金星」など) に効きます。" +
        "文字を打っている間は、Ctrl の付いたものだけ効きます。"
    )
  );

  overlay.appendChild(win);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeShortcuts();
  });
  return overlay;
}

export function openShortcuts() {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  root.style.display = "flex";
}

export function closeShortcuts() {
  if (root) root.style.display = "none";
}

export function isShortcutsOpen() {
  return !!root && root.style.display !== "none";
}
