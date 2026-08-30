// はい/いいえを尋ねる小さな画面。
//
// 標準の confirm() は見た目が浮くうえ、ブラウザによっては「このサイトの
// ダイアログをブロック」で握り潰されて、押していないのに進んでしまう。
// 消えたら戻せない操作 (新規作成・読込による上書き) はここを通す。

let root = null;
let win = null;
let title_el = null;
let text_el = null;
let ok_btn = null;
let cancel_btn = null;
let resolve_now = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function build() {
  const overlay = el("div", "dlg-overlay");
  win = el("div", "dlg-window");

  title_el = el("div", "dlg-title");
  text_el = el("div", "dlg-text");
  const foot = el("div", "dlg-foot");
  cancel_btn = el("button", "dlg-btn");
  cancel_btn.type = "button";
  ok_btn = el("button", "dlg-btn dlg-btn--primary");
  ok_btn.type = "button";
  foot.appendChild(cancel_btn);
  foot.appendChild(ok_btn);

  win.appendChild(title_el);
  win.appendChild(text_el);
  win.appendChild(foot);
  overlay.appendChild(win);

  cancel_btn.onclick = () => close(false);
  ok_btn.onclick = () => close(true);
  // 枠の外を押したときは「やめる」扱い (消えたら戻せない側には倒さない)
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close(false);
  });
  document.addEventListener("keydown", (e) => {
    if (!resolve_now) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      close(true);
    }
  });
  return overlay;
}

function close(answer) {
  if (!resolve_now) return;
  const fn = resolve_now;
  resolve_now = null;
  root.style.display = "none";
  fn(answer);
}

/**
 * 尋ねて、押されたほうを返す。
 *
 * @param {object} o
 * @param {string} o.title 見出し
 * @param {string} o.message 本文 (改行で複数行にできる)
 * @param {string} [o.ok] 進めるほうのボタンの文字
 * @param {string} [o.cancel] やめるほうのボタンの文字
 * @param {boolean} [o.danger] 消えたら戻せない操作か
 *   (進めるほうを赤くし、最初は「やめる」に焦点を当てる)
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message, ok = "OK", cancel = "キャンセル", danger = false }) {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  // 前の問いが残っていたら、それは「やめる」で閉じる
  if (resolve_now) close(false);

  title_el.textContent = title || "";
  text_el.textContent = message || "";
  ok_btn.textContent = ok;
  cancel_btn.textContent = cancel;
  ok_btn.classList.toggle("dlg-btn--danger", !!danger);
  root.style.display = "flex";

  return new Promise((resolve) => {
    resolve_now = resolve;
    (danger ? cancel_btn : ok_btn).focus();
  });
}

/** 開いているか (テスト用) */
export function isDialogOpen() {
  return !!resolve_now;
}
