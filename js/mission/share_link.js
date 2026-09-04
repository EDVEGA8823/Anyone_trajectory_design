/**
 * ミッションを人に渡す。URLにして配るのと、Xへ投稿するのと2通り。
 *
 * 置き場所を持たないアプリ (GitHub Pages の静的ファイル) なので、設計そのものを
 * URLに詰める。保存ファイルと同じJSONを縮めて載せるだけで、サーバーは要らない。
 *
 *   https://…/#m1=z<base64url>
 *
 * ── クエリ (?) ではなくフラグメント (#) に置く理由 ──────────────
 *   ・フラグメントはサーバーに送られない。設計がアクセスログに残らないし、
 *     他のサイトへ飛んだときのRefererにも乗らない
 *   ・サーバー側のURL長の制限を受けない
 *
 * ── 長さ ────────────────────────────────────────────
 * 実測 (deflate + base64url):
 *   地球→火星 (2節)                    208字
 *   地球→金星→火星 (3節)               275字
 *   カッシーニ相当 EVVEJS (6節)         416字
 *   同・手動 MGA-1DSM (DSM込み11節)     484字
 *   2節 + 小天体2個                     527字
 * 最悪でも600字ほどで、貼り付け先で折れる心配は無い。
 *
 * 小さい設計では圧縮のオーバーヘッドの方が大きい (2節で 279→326字) ので、
 * 縮んだときだけ圧縮する。どちらかは先頭の1文字 (z/r) で分かるようにしてある。
 */

import {
  missionData,
  applyMissionData,
  confirmDiscard,
  markMissionSaved,
  DEFAULT_NAME,
} from './mission_file.js';
import { resetHistory } from './history.js';
import { notify } from '../ui/topbar.js';
import { renderMissionImage } from './export_image.js';
import { confirmDialog } from '../ui/dialog.js';

// フラグメントに置く名前。数字は形式の版で、serialize() の形が変わっても
// 古いリンクを見分けられるようにしておく
const KEY = "m1";

// 中身の詰め方。z = 圧縮あり、r = そのまま
const PACK_DEFLATE = "z";
const PACK_RAW = "r";

/* ==================================================================
   詰める / ほどく
   ================================================================== */

function b64url_encode(bytes) {
  let s = "";
  // apply(null, 大きい配列) は引数の数の上限に当たるので、地道に繋ぐ
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64url_decode(text) {
  const s = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deflate(bytes) {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const w = cs.writable.getWriter();
    w.write(bytes);
    w.close();
    return new Uint8Array(await new Response(cs.readable).arrayBuffer());
  } catch (e) {
    return null;
  }
}

async function inflate(bytes) {
  if (typeof DecompressionStream === "undefined") return null;
  const ds = new DecompressionStream("deflate-raw");
  const w = ds.writable.getWriter();
  w.write(bytes);
  w.close();
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

/** 共有に要らないものを落とす (91バイトぶん短くなる) */
function shareData() {
  const data = missionData();
  if (!data) return null;
  const out = { ...data };
  delete out.saved_at; // 共有した時刻は設計の一部ではない
  delete out.app; // 開く先はこのアプリだと分かっている
  delete out.format; // 同上
  return out;
}

/** いまのミッションを載せたURL。載せるものが無ければ undefined */
export async function missionShareUrl() {
  const data = shareData();
  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return undefined;

  const raw = new TextEncoder().encode(JSON.stringify(data));
  const z = await deflate(raw);
  // 縮まなかったなら、そのまま載せた方が短い
  const packed = z && z.length < raw.length ? PACK_DEFLATE + b64url_encode(z) : PACK_RAW + b64url_encode(raw);
  return location.origin + location.pathname + location.search + "#" + KEY + "=" + packed;
}

/** URLのフラグメントから設計を取り出す。読めなければ undefined */
async function readToken(hash) {
  const text = (hash || "").replace(/^#/, "");
  if (!text) return undefined;
  const packed = new URLSearchParams(text).get(KEY);
  if (!packed) return undefined;

  try {
    const body = b64url_decode(packed.slice(1));
    let bytes = body;
    if (packed[0] === PACK_DEFLATE) {
      bytes = await inflate(body);
      if (!bytes) return undefined;
    } else if (packed[0] !== PACK_RAW) {
      return undefined; // 知らない詰め方 (新しい版のリンク)
    }
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return undefined;
    return data;
  } catch (e) {
    return undefined;
  }
}

/* ==================================================================
   コピーする
   ================================================================== */

async function toClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // 許可が下りなかった場合は下の手に回る
    }
  }
  // file:// で開いた場合など、クリップボードAPIが使えないとき
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (e) {
    ok = false;
  }
  ta.remove();
  return ok;
}

/** いまのミッションを開けるURLをクリップボードへ */
export async function copyShareLink() {
  const url = await missionShareUrl();
  if (!url) {
    notify("共有するシーケンスがありません");
    return false;
  }
  if (await toClipboard(url)) {
    notify("共有リンクをコピーしました");
    return true;
  }
  notify("コピーできませんでした (アドレス欄からURLを控えてください)");
  return false;
}

/* ==================================================================
   受け取る
   ================================================================== */

/** 読み込んだらフラグメントを消す (設計を変えても残り続けて食い違うため) */
function clearHash() {
  if (!location.hash) return;
  history.replaceState(null, "", location.pathname + location.search);
}

/**
 * フラグメントに設計が載っていれば読み込む。
 *
 * @param {boolean} ask 上書きになるときに断りを入れるか
 * @returns {Promise<boolean>} 読み込んだか
 */
async function loadFromHash(ask) {
  const data = await readToken(location.hash);
  if (data == undefined) {
    // 中身のあるフラグメントなのに読めなかったときだけ知らせる
    // (ただの "#" や他の用途の値でいちいち騒がない)
    if (new URLSearchParams(location.hash.replace(/^#/, "")).get(KEY)) {
      notify("共有リンクを読み取れませんでした");
      clearHash();
    }
    return false;
  }

  // 開いた先に作りかけの設計があるときだけ断る。
  // (新しいタブで開いたときは空なので、そのまま入る)
  if (ask && !(await confirmDiscard("リンクのミッションを開く"))) {
    clearHash();
    return false;
  }

  if (!applyMissionData(data)) {
    notify("共有リンクのミッションを開けませんでした");
    clearHash();
    return false;
  }
  // 読み込んだ直後は「リンクのとおり」なので、まだ変更されていない扱いにする
  // (ファイルを開いたときと同じ)
  markMissionSaved();
  resetHistory();
  clearHash();
  notify("共有リンクからミッションを開きました");
  return true;
}

/**
 * 共有リンクの受け取りを始める。
 *
 * 開いた瞬間だけでなく、あとからフラグメントが変わったときも拾う。
 * 同じページを開いたままアドレス欄にリンクを貼られると、# より後ろしか
 * 変わらないのでページは読み込み直されず、そのままでは何も起きない。
 * そこが唯一「作りかけの設計を上書きする」場面なので、そこでだけ断りを入れる。
 */
export function initShareLink() {
  // 開いた直後。まだ何も作っていないので黙って入れる
  loadFromHash(false);
  window.addEventListener("hashchange", () => loadFromHash(true));
}

/* ==================================================================
   Xへ投稿する
   ==================================================================
   Xの投稿画面をURLで開く仕組み (intent) には、画像を渡す口が無い。
   文字とURLしか載せられないので、絵を添えるには別の道が要る。

     スマホ       端末の共有シートに投げる。そこからXを選べば、
                  文字・URL・画像がまとめて入る
     デスクトップ  画像をクリップボードへ写し、何が起きるかを断ってから
                  投稿画面を開く。本文とURLは埋まった状態で開くので、
                  投稿欄に画像を貼り付けるだけで済む

   デスクトップで先に断るのは、開いてからでは遅いため。投稿画面は別のタブで
   開くので、こちら側に出した知らせは目に入らないまま消える。
   ================================================================== */

// 投稿の本文。ミッション名は既定のままなら入れない (「無題のミッション」は情報にならない)
function postText(name) {
  const head = name && name !== DEFAULT_NAME ? "「" + name + "」\n" : "";
  return head + "#だれでも軌道設計 でミッションを作成しました";
}

/** Xの投稿画面を、本文とURLを入れた状態で開く */
function openIntent(text, url) {
  const q = "text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
  window.open("https://x.com/intent/post?" + q, "_blank", "noopener");
}

/**
 * 端末の共有シートに任せてよいか。
 *
 * スマホの共有シートにはXが並ぶので、そこから選んでもらうのが一番きれいに
 * 収まる (文字・URL・画像がまとめて入る)。
 * 一方デスクトップの共有シートはメールやBluetoothが並ぶだけでXが居ないことが
 * 多く、「Xで共有」と書いたボタンの行き先としては外れになる。canShare は
 * デスクトップでも true を返すので、これだけを頼りにすると必ずそちらへ
 * 流れてしまう。行き先がXだと分かっている投稿画面の方へ回す。
 */
function preferSystemShare() {
  const uad = navigator.userAgentData;
  if (uad && typeof uad.mobile === "boolean") return uad.mobile;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** 画像をクリップボードへ。入れられたか */
async function imageToClipboard(blob) {
  if (!navigator.clipboard || !navigator.clipboard.write || typeof ClipboardItem === "undefined") return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * いまのミッションをXへ投稿する。
 *
 * 画像を作る間に押された合図 (ユーザー操作) の有効期限が切れると
 * navigator.share が断られるので、作ってすぐ呼ぶこと。
 *
 * @param {string} [name] ミッション名
 */
export async function shareOnX(name) {
  const url = await missionShareUrl();
  if (!url) {
    notify("共有するシーケンスがありません");
    return false;
  }
  const text = postText(name);
  const made = await renderMissionImage(name); // 作れなくても文字とURLでは出せる

  // スマホなら、端末の共有シートに画像ごと渡すのが一番きれいに収まる
  if (made && preferSystemShare() && typeof File === "function" && navigator.canShare && navigator.share) {
    const file = new File([made.blob], made.filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ text, url, files: [file] });
        return true;
      } catch (e) {
        // 共有をやめただけなら、こちらから追い打ちはしない
        if (e && e.name === "AbortError") return false;
        // 共有シートが使えなかった場合は下の手に回る
      }
    }
  }

  // デスクトップ。画像は投稿画面に自動では入らないので、先に手元へ写しておく。
  // 押された直後のいまなら操作の権限が生きている
  const copied = made ? await imageToClipboard(made.blob) : false;

  // 何が起きるかは、開く前に伝える。
  // 開いてから知らせても、新しいタブへ移った後なので目に入らない
  const go = await confirmDialog({
    title: "Xの投稿画面を開きます",
    message: copied
      ? "本文と共有リンクを入れた状態で開きます。\n\n" +
        "画像はクリップボードにコピーしました。投稿欄で貼り付け (Ctrl+V) してください。"
      : "本文と共有リンクを入れた状態で開きます。\n\n" +
        "画像はコピーできませんでした。付けたいときは「画像で保存」で保存してから、投稿欄に落としてください。",
    ok: "開く",
    cancel: "やめる",
  });
  if (!go) return false;

  openIntent(text, url);
  return true;
}
