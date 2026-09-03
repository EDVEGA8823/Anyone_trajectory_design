import { missionData, applyMissionData } from './mission_file.js';

// 元に戻す / やり直す。
//
// 【持ち方】操作の一つひとつを覚えるのではなく、設計そのものを丸ごと覚える。
// 設計変数はミッション全体でもたかだか数キロバイトの JSON で、保存ファイルと
// 同じ形 (missionData) がすでにあるので、それを積むだけで済む。
// 「どの操作が何を変えたか」を操作ごとに書いていく方式だと、節の追加や種別の
// 変更のように後続まで作り直す操作で戻し方が複雑になり、書き漏らした操作が
// そのまま「戻せない操作」になる。丸ごと覚える方式なら数え漏らしが起きない。
//
// 【いつ覚えるか】操作が一区切りついたところ、具体的には
//   ・押したとき (click) とマウスのボタンを離したとき (pointerup)
//   ・欄の値が確定したとき (change)            … 選択欄・入力欄
//   ・打ち込みが少し止まったとき (input/keyup) … ミッション名などの連続入力
// で、いまの中身が直前に覚えたものと違っていたら積む。
// ドラッグ中の途中経過は積まれないので、掴んで動かした操作はひと続きで戻る。
//
// ただし、合図を受けた「その場」では積まない。押した合図 (pointerup) は
// クリックの処理より先に届くので、その場で見た中身はまだ変わっていない。
// 天体の選択のように、変更そのものが非同期で終わる操作もある。
// そこで少し待ってから、落ち着いた中身を積む。

const LIMIT = 50; // 覚えておく手数。これを超えたら古いものから捨てる
const SETTLE = 250; // 操作の処理が終わるのを待つ時間 [ms]
const TYPING_PAUSE = 700; // 打ち込みが止まったと見なすまで [ms]

let past = []; // 過去の状態 (古い順)
let future = []; // 元に戻したぶん (やり直しで使う)
let base = null; // いま画面に出ている状態 { key, data }
let applying = false; // 入れ替えの最中 (自分が起こした変化を積み直さない)
let on_change = null; // ボタンの見た目を更新するための呼び出し先
let pending = 0; // 積むのを待っている最中のタイマー

// 保存した時刻は中身の違いではないので、比べる前に落とす
function keyOf(data) {
  if (!data) return null;
  const { saved_at, ...rest } = data;
  return JSON.stringify(rest);
}

function current() {
  const data = missionData();
  if (!data) return null;
  const { saved_at, ...rest } = data;
  return { key: JSON.stringify(rest), data: rest };
}

function notifyChange() {
  if (on_change) on_change({ undo: canUndo(), redo: canRedo() });
}

/**
 * いまの状態を「ここから先が変更」の基準にする。
 * 新規作成・ファイルの読込のあとに呼ぶ (そこまでの手数は戻れなくなる)。
 */
export function resetHistory() {
  if (pending) {
    clearTimeout(pending);
    pending = 0;
  }
  past = [];
  future = [];
  base = current();
  notifyChange();
}

/**
 * 変化があれば1手として積む。無ければ何もしない。
 * 操作の区切りごとに呼ばれるので、選んだだけ・見ただけでは積まれない
 * (選択は設計の中身ではないので missionData に入らない)。
 */
export function recordHistory() {
  if (applying) return;
  const now = current();
  if (!now) return;
  if (base && now.key === base.key) return;

  if (base) {
    past.push(base);
    if (past.length > LIMIT) past.shift();
  }
  base = now;
  future = []; // 新しく変えたら、それまでのやり直し先は繋がらなくなる
  notifyChange();
}

export function canUndo() {
  return past.length > 0;
}

export function canRedo() {
  return future.length > 0;
}

// 積んである状態へ入れ替える。入れ替え中の再描画で recordHistory が
// 呼ばれても積み直さないよう applying を立てておく。
function apply(entry) {
  let ok = false;
  applying = true;
  try {
    // 元に戻すときは、見ていた場所から目が離れないよう選択を保つ
    ok = applyMissionData(entry.data, { keepSelection: true });
  } finally {
    applying = false;
  }
  // 入れ替えられなかったものを「いま出ている状態」として覚えると、
  // 以降の1手ずつが画面と食い違っていく。積み直さずにここで止める。
  if (ok) base = entry;
  notifyChange();
  return ok;
}

/** 1手戻す */
export function undoMission() {
  // 待っている途中で押されたぶんを取りこぼさないよう、先に区切る
  flush();
  if (past.length === 0) return false;
  const entry = past.pop();
  const from = base;
  // 積み替えは入れ替えより先に。apply がボタンの出し分けまで済ませるので、
  // 後から積むと「やり直せるのにボタンが押せない」状態のまま残る
  future.push(from);
  if (!apply(entry)) {
    future.pop(); // 戻せなかったので手数はそのまま
    past.push(entry);
    return false;
  }
  return true;
}

/** 戻したぶんを1手やり直す */
export function redoMission() {
  flush();
  if (future.length === 0) return false;
  const entry = future.pop();
  const from = base;
  past.push(from);
  if (!apply(entry)) {
    past.pop();
    future.push(entry);
    return false;
  }
  return true;
}

// 待っているぶんを今すぐ積む
function flush() {
  if (!pending) return;
  clearTimeout(pending);
  pending = 0;
  recordHistory();
}

// 少し待ってから積む。続けて合図が来たら待ち直す (ドラッグや連続入力を
// ひと続きの1手にまとめるため)
function schedule(delay) {
  if (applying) return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = 0;
    recordHistory();
  }, delay);
}

/**
 * 画面の操作を見張って、区切りごとに積む。
 *
 * 変更する側すべてに「積んでね」と書いて回るのではなく、操作の終わりを
 * まとめて拾う。書き漏らした操作がそのまま戻せない操作になるのを避けたい
 * のと、ドラッグの途中経過を積まずに済むため。
 *
 * @param {(state: {undo: boolean, redo: boolean}) => void} [onChange]
 *        戻せる/やり直せるが変わったときの呼び出し先 (ボタンの出し分け用)
 */
export function initHistory(onChange) {
  on_change = onChange;
  base = current();

  // 操作が終わった合図。捕捉段階で拾うので、途中で止められても効く。
  //   click     … 押した操作すべて (キーボードで押した場合もこれは出る)
  //   pointerup … ドラッグの終わり (掴んで動かすと click は出ないことがある)
  //   change    … 選択欄・入力欄の値が確定したとき
  for (const type of ["click", "pointerup", "change"]) {
    document.addEventListener(type, () => schedule(SETTLE), { capture: true, passive: true });
  }
  // 打ち込みは1文字ごとに積むと戻すのが大変なので、手が止まってからまとめる
  for (const type of ["input", "keyup"]) {
    document.addEventListener(type, () => schedule(TYPING_PAUSE), { capture: true, passive: true });
  }
  notifyChange();
}
