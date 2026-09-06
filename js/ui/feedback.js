// 「フィードバックを送る」の画面。
//
// 置き場所を持たないアプリ (GitHub Pages の静的ファイル) なので、預かる先は
// リポジトリの Issues を借りる。受け取り口を自前で建てると、鍵の置き場と
// 迷惑投稿の始末を抱えることになるため、送信そのものはここでは持たない。
//
// ここでやるのは3つだけ。
//   ・書いてもらう欄を出す
//   ・環境と、いまの設計 (共有リンク) を添える
//   ・何を送ることになるのかを見せてから、GitHub へ渡す / 手元にコピーする
//
// 設計を添えるのは、軌道の計算に関わる報告が「どの設計で起きたか」無しには
// 再現できないため。ただし共有リンクには設計がそのまま入るので、何が出ていくかを
// 見せたうえで外せるようにしてある。

import { missionShareUrl, toClipboard } from '../mission/share_link.js';
import { State } from '../core/state.js';
import { launcher_list } from '../core/launchers.js';
import { notify } from './topbar.js';

const ISSUE_URL = "https://github.com/EDVEGA8823/Anyone_trajectory_design/issues/new";
// 本文が長すぎるとURLとして弾かれる。日本語は1文字が9文字ぶんに膨らむので、
// 打ち込める量にも上限を置いたうえで、それでも溢れたらコピーに回す
const MAX_TEXT = 1200;
const MAX_URL = 7000;

let root = null;
let text_el = null;
let attach_el = null;
let preview_el = null;
let share_url = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function launcher_label() {
  const found = launcher_list().find((l) => l.id === State.launcher);
  return found ? found.label : String(State.launcher || "-");
}

/** 報告に添える、こちらで分かること */
function environment() {
  const m = State.mission_sequence;
  return [
    ["ブラウザ", navigator.userAgent],
    ["画面", window.innerWidth + "×" + window.innerHeight +
      " (倍率 " + (window.devicePixelRatio || 1) + ")"],
    ["アプリ", location.origin + location.pathname],
    ["シーケンス", (m ? m.count : 0) + "個"],
    ["ロケット", launcher_label()],
  ];
}

function body_text() {
  const said = (text_el.value || "").trim();
  const lines = ["### 何が起きましたか", "", said || "(まだ書かれていません)", "", "### 環境", ""];
  for (const [k, v] of environment()) lines.push("- " + k + ": " + v);
  if (attach_el.checked && share_url) {
    lines.push("", "### そのときの設計", "", share_url);
  }
  return lines.join("\n");
}

function title_text() {
  // 1行目を見出しにする。空なら種別だけ
  const first = (text_el.value || "").trim().split(/\r?\n/)[0].trim();
  if (!first) return "フィードバック";
  return first.length > 50 ? first.slice(0, 50) + "…" : first;
}

function refresh() {
  if (preview_el) preview_el.textContent = body_text();
}

function issue_link() {
  return (
    ISSUE_URL +
    "?title=" + encodeURIComponent(title_text()) +
    "&body=" + encodeURIComponent(body_text())
  );
}

async function send_to_github() {
  const url = issue_link();
  if (url.length > MAX_URL) {
    // URLに載せきれない。手で貼ってもらうほうが確実
    const ok = await toClipboard(body_text());
    notify(ok ? "長いので内容をコピーしました。GitHubの本文に貼り付けてください"
              : "内容が長すぎます。少し短くしてください");
    if (!ok) return;
    window.open(ISSUE_URL + "?title=" + encodeURIComponent(title_text()), "_blank", "noopener");
    closeFeedback();
    return;
  }
  window.open(url, "_blank", "noopener");
  closeFeedback();
}

async function copy_all() {
  if (await toClipboard(body_text())) {
    notify("内容をコピーしました");
    closeFeedback();
  } else {
    notify("コピーできませんでした");
  }
}

function build() {
  const overlay = el("div", "fb-overlay");
  const win = el("div", "fb-window");

  const head = el("div", "fb-head");
  head.appendChild(el("div", "fb-title", "フィードバックを送る"));
  const close = el("button", "fb-close", "×");
  close.type = "button";
  close.title = "閉じる";
  close.onclick = closeFeedback;
  head.appendChild(close);
  win.appendChild(head);

  const body = el("div", "fb-body");
  body.appendChild(el("label", "fb-label", "何が起きましたか / どうしたいですか"));
  text_el = document.createElement("textarea");
  text_el.className = "fb-text";
  text_el.rows = 6;
  text_el.maxLength = MAX_TEXT;
  text_el.placeholder = "例) 木星への周回軌道投入で、遠点を上げても投入ΔVが変わらない";
  text_el.oninput = refresh;
  body.appendChild(text_el);

  const attach_row = el("label", "fb-check");
  attach_el = document.createElement("input");
  attach_el.type = "checkbox";
  attach_el.checked = true;
  attach_el.onchange = refresh;
  attach_row.appendChild(attach_el);
  attach_row.appendChild(el("span", null, "いまの設計を添える (共有リンク)"));
  body.appendChild(attach_row);

  const det = document.createElement("details");
  det.className = "fb-details";
  const sum = document.createElement("summary");
  sum.textContent = "送る内容を見る";
  det.appendChild(sum);
  preview_el = el("pre", "fb-preview");
  det.appendChild(preview_el);
  body.appendChild(det);

  const foot_btns = el("div", "fb-buttons");
  const go = el("button", "fb-btn fb-btn--primary", "GitHubで報告する");
  go.type = "button";
  go.onclick = send_to_github;
  const copy = el("button", "fb-btn", "内容をコピー");
  copy.type = "button";
  copy.onclick = copy_all;
  foot_btns.appendChild(copy);
  foot_btns.appendChild(go);
  body.appendChild(foot_btns);
  win.appendChild(body);

  win.appendChild(
    el(
      "div",
      "fb-foot",
      "GitHubで報告するにはアカウントが要ります。持っていなければ「内容をコピー」して、" +
        "Xやメールで送ってください。書いた内容と、上に出ている環境・設計が公開の場所に載ります。"
    )
  );

  overlay.appendChild(win);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeFeedback();
  });
  return overlay;
}

export function openFeedback() {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  root.style.display = "flex";
  // 設計は開いた時点のものを添える (開いている間は画面を触れないので変わらない)
  share_url = null;
  refresh();
  missionShareUrl().then((url) => {
    share_url = url ?? null;
    if (!share_url && attach_el) {
      attach_el.checked = false;
      attach_el.disabled = true;
      attach_el.parentElement.title = "まだシーケンスがありません";
    } else if (attach_el) {
      attach_el.disabled = false;
      attach_el.parentElement.title = "";
    }
    refresh();
  });
  text_el.focus();
}

export function closeFeedback() {
  if (root) root.style.display = "none";
}

export function isFeedbackOpen() {
  return !!root && root.style.display !== "none";
}
