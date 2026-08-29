import { State } from './state.js';
import { launcher_list } from './launchers.js';
import { notify, missionName, setMissionName } from './topbar.js';
import { update_plot, reload_small_bodies } from './main.js';
import { updateAfterAdd } from './event.js';
import { isSmallBody, smallBody, smallBodyNumber, smallBodiesForSave } from './small_bodies.js';
import { normalizeBody } from './bodies.js';

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
const DEFAULT_NAME = "無題のミッション";

/** いまの状態を保存用のオブジェクトにまとめる */
export function missionData() {
  const mission = State.mission_sequence;
  if (!mission) return null;

  const data = {
    format: FORMAT,
    version: VERSION,
    app: "だれでも軌道設計",
    saved_at: new Date().toISOString(),
    name: missionName() || DEFAULT_NAME,
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
  const base = (name || DEFAULT_NAME).replace(/[\\/:*?"<>|]/g, "_").trim();
  return (base.length > 0 ? base : "mission") + ".json";
}

/** いまのミッションをファイルとして保存する */
export function saveMissionFile() {
  const data = missionData();
  if (!data) return;
  if (data.nodes.length === 0) {
    notify("保存するシーケンスがありません");
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

  notify("「" + a.download + "」を保存しました");
}

/** ファイル選択のダイアログを出して読み込む */
export function openMissionFile() {
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
      notify("読み込めませんでした (JSONとして解釈できません)");
      return;
    }
    loadMissionData(data, file.name);
  };
  reader.onerror = () => notify("ファイルを読めませんでした");
  reader.readAsText(file);
}

/**
 * 読み込んだ中身をアプリに反映する。
 * ミッションだけでなく、選択位置・チェック・ロケット・名前も入れ替える。
 */
export function loadMissionData(data, filename) {
  const mission = State.mission_sequence;
  if (!mission) return false;

  if (data && data.format && data.format !== FORMAT) {
    notify("このアプリの保存ファイルではないようです");
    return false;
  }
  if (data && data.version > VERSION) {
    // 新しい版で増えた項目は読み飛ばされるだけなので、断ったうえで読む
    notify("新しい版のファイルです。読めない項目があるかもしれません");
  }

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

  if (!mission.restore(data)) {
    notify("読み込めませんでした (シーケンスが入っていません)");
    return false;
  }

  State.selected_sequence = mission.count > 0 ? 0 : -1;
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

  setMissionName(typeof data.name === "string" && data.name ? data.name : DEFAULT_NAME);

  update_plot();
  updateAfterAdd(); // 一覧・操作パネル・時刻欄・マーカーをまとめて作り直す

  notify("「" + (filename ?? data.name ?? "ミッション") + "」を読み込みました");
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
  window.addEventListener("drop", (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    document.body.classList.remove("file-drop");
    if (!file) return;
    stop(e);
    readMissionFile(file);
  });
}
