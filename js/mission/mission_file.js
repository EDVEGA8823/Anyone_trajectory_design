import { State } from '../core/state.js';
import { launcher_list } from '../core/launchers.js';
import { notify, missionName, setMissionName } from '../ui/topbar.js';
import { update_plot, reload_small_bodies } from '../main.js';
import { updateAfterAdd } from '../ui/event.js';
import { isSmallBody, smallBody, smallBodyNumber, smallBodiesForSave } from '../core/small_bodies.js';
import { normalizeBody } from '../core/bodies.js';
import { confirmDialog } from '../ui/dialog.js';
import { resetHistory, refreshHistoryState } from './history.js';
import { t, allWordings } from '../ui/i18n.js';

// ミッションの保存と読込。
//
// 形式は JSON。設計変数だけを平文で書くので、テキストエディタで開いて中身を
// 読めるし、手で日付を書き換えることもできる (読み込み側で辻褄は合わせる)。
// 計算結果は入れない。読み込んだときに全部計算し直すので、入れても古くなるだけ。
//
// 保存の中身は Mission.serialize() / Mission.restore() が持っている。
// ここが持つのはファイルの出し入れと、アプリ全体の状態の入れ替えだけ。

const FORMAT = "anyone-trajectory-design";
const VERSION = 1;
// ミッション名の既定。値そのものは日本語のまま持ち (保存ファイルとの
// 突き合わせに使うため)、画面に出すときは defaultMissionName() を通す
export const DEFAULT_NAME = "無題のミッション";

/** いまの言語での「無題のミッション」 */
export function defaultMissionName() {
  return t(DEFAULT_NAME);
}

/**
 * 名前が「まだ付けていない」ものかどうか。
 * 言語を切り替えると既定の文字が変わるので、どちらの言葉でも既定とみなす
 * (英語で始めて日本語に切り替えた人の名前を、勝手に付けた名前と扱わない)。
 */
export function isDefaultMissionName(name) {
  return !name || allWordings(DEFAULT_NAME).includes(name);
}

/* ==================================================================
   保存し忘れの見張り
   ==================================================================
   変更のたびに旗を立てて回るのではなく、最後に保存/読込/新規作成した時点の
   中身を丸ごと覚えておいて、いまの中身と比べる。設計変数は小さいので比較は
   一瞬で済むし、「どの操作で汚れるか」を数え漏らす心配が無い。 */

let saved_snapshot = null;

// 保存の中身から、比べる意味の無いもの (保存した時刻) を除いた文字列
function snapshot() {
  const data = missionData();
  if (!data) return null;
  const { saved_at, ...rest } = data;
  return JSON.stringify(rest);
}

/** いまの中身を「保存済み」として覚える (保存・読込・新規作成のあとに呼ぶ) */
export function markMissionSaved() {
  saved_snapshot = snapshot();
  // 未保存の目印を消すのを呼ぶ側に任せると、いつか付けっぱなしになる。
  // 「保存済みにする」と「目印を付け直す」は必ず一緒に起きるのでここで呼ぶ
  refreshHistoryState();
}

/**
 * 保存していない変更があるか。
 * シーケンスが空のときは失うものが無いので、常に false。
 */
export function missionHasUnsavedChanges() {
  const mission = State.mission_sequence;
  if (!mission || mission.count === 0) return false;
  return snapshot() !== saved_snapshot;
}

/** いまの状態を保存用のオブジェクトにまとめる */
export function missionData() {
  const mission = State.mission_sequence;
  if (!mission) return null;

  const data = {
    format: FORMAT,
    version: VERSION,
    app: "だれでも軌道設計",
    saved_at: new Date().toISOString(),
    name: missionName() || defaultMissionName(),
    launcher: State.launcher,
    ...mission.serialize(),
  };

  // 取り込んだ小天体は軌道要素ごと保存する。データベース側が更新されて元期が
  // 変わっても、保存したときと同じ軌道でミッションを開き直せるようにするため。
  const bodies = smallBodiesForSave();
  if (bodies.length > 0) data.bodies = bodies;

  // 節が持つ天体の番号は「取り込んだ順」で決まるので、そのままでは他の環境で
  // 別の天体を指しかねない。小天体はidで書いておく
  for (const node of data.nodes) {
    if (isSmallBody(node.planet)) {
      const b = smallBody(node.planet);
      if (b) {
        node.body = b.id;
        delete node.planet;
      }
    }
  }
  return data;
}

// ファイル名に使えない文字を落とす
function safe_filename(name) {
  const base = (name || defaultMissionName()).replace(/[\\/:*?"<>|]/g, "_").trim();
  return (base.length > 0 ? base : "mission") + ".json";
}

/** いまのミッションをファイルとして保存する */
export function saveMissionFile() {
  const data = missionData();
  if (!data) return;
  if (data.nodes.length === 0) {
    notify(t("保存するシーケンスがありません"));
    return;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe_filename(data.name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐ消すとダウンロードが始まらない環境があるので、少し置いてから片付ける
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  markMissionSaved();
  notify(t("「{name}」を保存しました", { name: a.download }));
}

/**
 * 消えたら戻せない操作の前に、保存し忘れが無いか尋ねる。
 * @param {string} action 「読み込む」など、これから何をするか
 * @returns {Promise<boolean>} 進めてよいか
 */
export async function confirmDiscard(action) {
  if (!missionHasUnsavedChanges()) return true;
  return confirmDialog({
    title: t("保存していない変更があります"),
    message:
      t("いまのミッション「{name}」はまだ保存されていません。\nこのまま{action}と、ここまでの設計は失われます。",
        { name: missionName() || t(DEFAULT_NAME), action }),
    ok: t("保存せずに{action}", { action }),
    cancel: t("やめる"),
    danger: true,
  });
}

/** ファイル選択のダイアログを出して読み込む */
export async function openMissionFile() {
  if (!(await confirmDiscard(t("読み込む")))) return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (file) readMissionFile(file);
  };
  input.click();
}

/** File を読んでミッションに反映する */
export function readMissionFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(String(reader.result));
    } catch (e) {
      notify(t("読み込めませんでした (JSONとして解釈できません)"));
      return;
    }
    loadMissionData(data, file.name);
  };
  reader.onerror = () => notify(t("ファイルを読めませんでした"));
  reader.readAsText(file);
}

/**
 * 読み込んだ中身をアプリに反映する。
 * ミッションだけでなく、選択位置・チェック・ロケット・名前も入れ替える。
 */
export function loadMissionData(data, filename) {
  if (data && data.format && data.format !== FORMAT) {
    notify(t("このアプリの保存ファイルではないようです"));
    return false;
  }
  if (data && data.version > VERSION) {
    // 新しい版で増えた項目は読み飛ばされるだけなので、断ったうえで読む
    notify(t("新しい版のファイルです。読めない項目があるかもしれません"));
  }

  // 空のミッションは「戻れる先」としては正しいが、ファイルとしては中身が
  // 無いということなので、読み込みのときだけここで断る
  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0 || !applyMissionData(data)) {
    notify(t("読み込めませんでした (シーケンスが入っていません)"));
    return false;
  }

  markMissionSaved(); // 読み込んだ直後は、ファイルと画面の中身が同じ
  resetHistory(); // 別のミッションになったので、ここより前へは戻さない
  notify(t("「{name}」を読み込みました", { name: filename ?? data.name ?? t("ミッション") }));
  return true;
}

/**
 * missionData() の形をした中身で、画面の状態をまるごと入れ替える。
 *
 * ファイルの読込 (loadMissionData) と、元に戻す/やり直す (js/history.js) が
 * 共有する。どちらも「その時点の設計に丸ごと戻す」という同じ操作なので、
 * 入れ替えの手順を2か所に書くと必ず食い違う。
 *
 * ファイル特有の話 (形式の確認・保存済みの印・読み込んだという知らせ) は
 * 呼ぶ側が持つ。ここは状態の入れ替えだけを行う。
 *
 * @param {object} data 入れ替える中身
 * @param {object} [opts]
 * @param {boolean} [opts.keepSelection] 選んでいるノードを保つか
 *        (元に戻すときは、見ていた場所から目が離れないように保つ。
 *         ファイルを開くときは前のミッションの選択を引き継ぐ理由が無いので外す)
 * @returns {boolean} 入れ替えられたか
 */
export function applyMissionData(data, { keepSelection = false } = {}) {
  const mission = State.mission_sequence;
  if (!mission) return false;

  const prev_selected = State.selected_sequence;

  // 小天体を先に取り込む (節が指す天体番号は、この並び順で決まる)
  const bodies = Array.isArray(data.bodies) ? data.bodies.map(normalizeBody).filter(Boolean) : [];
  reload_small_bodies(bodies);

  // idで書かれている天体を、取り込んだ後の番号に直す
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  for (const node of nodes) {
    if (typeof node.body !== "string") continue;
    const num = smallBodyNumber(node.body);
    if (num >= 0) node.planet = num;
  }

  if (!mission.restore(data)) return false;

  // 選択は節の番号で持っているので、節が減っていれば末尾に寄せる
  State.selected_sequence = keepSelection ? Math.min(prev_selected, mission.count - 1) : -1;
  State.editing_sequence = -1;
  State.checked.clear();
  State.tmp_date = mission.date(0) ?? State.tmp_date;
  State.old_date = State.tmp_date;

  // ロケットは知っているものだけ受け付ける (機種が消えていても壊れないように)
  if (typeof data.launcher === "string" && launcher_list().some((l) => l.id === data.launcher)) {
    State.launcher = data.launcher;
    const select = document.getElementById("launcher");
    if (select) select.value = data.launcher;
  }

  setMissionName(typeof data.name === "string" && data.name ? data.name : defaultMissionName());

  update_plot();
  updateAfterAdd(); // 一覧・操作パネル・時刻欄・マーカーをまとめて作り直す
  return true;
}

/**
 * 画面にファイルを落として読み込めるようにする。
 * 保存したファイルをそのまま放り込めるほうが、選び直すより早い。
 */
export function initMissionFileDrop() {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("dragover", (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types).includes("Files")) return;
    stop(e);
    e.dataTransfer.dropEffect = "copy";
    document.body.classList.add("file-drop");
  });
  window.addEventListener("dragleave", (e) => {
    // 画面の外へ出たときだけ外す (子要素をまたぐたびに点滅させない)
    if (e.relatedTarget) return;
    document.body.classList.remove("file-drop");
  });
  window.addEventListener("drop", async (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    document.body.classList.remove("file-drop");
    if (!file) return;
    stop(e);
    if (!(await confirmDiscard(t("読み込む")))) return;
    readMissionFile(file);
  });
}
