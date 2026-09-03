/**
 * いまの設計を1枚の画像 (PNG) にする。
 *
 * 画面をそのまま写真に撮るのではなく、載せたいものだけを並べ直して描く。
 *
 *   ┌──────────────────────────────────┐
 *   │ ミッション名                だれでも軌道設計 │
 *   ├──────────────────────┬───────────┤
 *   │                      │ シーケンス   │
 *   │      太陽系ビュー       │  1. 打上げ   │
 *   │                      │  2. スイングバイ│
 *   ├──────────────────────┴───────────┤
 *   │ 脱出速度 / 総ΔV / ロケット / 打上げ→残る │
 *   └──────────────────────────────────┘
 *
 * こうしてある理由:
 *   ・画面の幅や高さで絵柄が変わらない。スマホで保存しても同じ形になる
 *   ・操作のための部品 (ボタン・選択欄・スクロールバー) が写り込まない
 *   ・太陽系ビューを画面の見た目より大きく、かつ高い解像度で描き直せる
 *
 * 太陽系ビューは three.js の canvas をそのまま貼る。天体名や「1AU」の
 * ラベルは canvas ではなく HTML の要素 (CSS2DRenderer) なので写らない。
 * 位置だけ同じ計算で投影し直して、文字はこちらで描く。
 */

import {
  renderer,
  scene,
  camera,
  controls,
  update_camera,
  updateLayout,
  invalidate,
  drawingPos,
  updateNodeMarkers,
} from './plot.js';
import { State, PlotState, Sequence_Type } from './state.js';
import { JulianToDate } from './trajectory.js';
import { notify } from './topbar.js';

/**
 * 天体の軌道と丸の出し入れは main.js が持っている (天体名の表もあちら側に
 * あるため)。画像を作る間だけ「使っている天体だけ」に切り替えたいので、
 * 手を貸してもらう。直に import すると main.js と輪になるので、渡してもらう。
 */
let hooks = { setBodyVisible: null, restore: null };

/**
 * @param {{setBodyVisible:(i:number,on:boolean)=>void, restore:()=>void}} h
 */
export function setExportViewHooks(h) {
  hooks = { ...hooks, ...h };
}

// 軌道全体を入れたときの余白。1.0で画面いっぱいなので、少し広げて端を空ける
const FIT_MARGIN = 1.12;

// この濃さより薄いラベルは出さない。画面では薄く残しておけば邪魔にならないが、
// 紙のように動かせない絵では、薄い文字が20個並ぶとただの汚れになる。
// (目盛りのラベルは、引くほど薄くなるよう画面側で濃さが決まっている)
const LABEL_MIN_OPACITY = 0.25;

// 節に打つ丸の大きさ [出力px] と、番号を置く距離
const NODE_R = 6;
const NODE_LABEL_GAP = 11;

// 出力の大きさ (設計上の px)。実際にはこの SCALE 倍で描く
const W = 1400;
const PAD = 40;
const HEAD_H = 54;
const GAP = 22;
const SEQ_W = 330;
const VIEW_W = W - PAD * 2 - SEQ_W - GAP;
const VIEW_H = Math.round((VIEW_W * 3) / 4);
const STAT_H = 78;
const CARD_H = 50;
const CARD_GAP = 8;

// 文字がぼやけないよう、実ピクセルはこの倍率で持つ
const SCALE = 2;

const FONT = "'Noto Sans JP', system-ui, sans-serif";

/** CSSの変数から色を取る (画面と同じ配色にするため) */
function palette() {
  const cs = getComputedStyle(document.documentElement);
  const get = (name, fallback) => (cs.getPropertyValue(name) || "").trim() || fallback;
  return {
    bg: get("--bg", "#f3f4f6"),
    surface: get("--surface", "#ffffff"),
    muted: get("--surface-muted", "#f9fafb"),
    border: get("--border", "#e5e7eb"),
    text: get("--text", "#111827"),
    textMuted: get("--text-muted", "#6b7280"),
    accent: get("--accent", "#3b6fe0"),
    badge: get("--gray-800", "#1f2937"),
    // 節の丸と番号。太陽系ビューで選択中の節に使っている色に合わせる
    node: "#1f4fd8",
  };
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** はみ出す文字は「…」で切る */
function clipText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + "…").width > max) s = s.slice(0, -1);
  return s + "…";
}

/* ==================================================================
   太陽系ビューの取り込み
   ================================================================== */

/**
 * ミッションが使っている天体の番号。
 * 画像では、この天体の軌道と名前だけを出す (全部出すと軌道の線と名前で
 * 埋まって、どれがこのミッションの舞台なのか分からなくなる)。
 */
function usedBodies(mission) {
  const set = new Set();
  for (let i = 0; i < mission.count; i++) {
    const n = mission.planet_num(i);
    if (n >= 0) set.add(n);
  }
  return set;
}

/** 各ノードの位置 (描画座標)。天体を持たないマヌーバも含む */
function nodePoints(mission) {
  const out = [];
  for (let i = 0; i < mission.count; i++) {
    const p = mission.get_s_c_pos(i);
    out.push(p == undefined ? undefined : drawingPos(p));
  }
  return out;
}

/**
 * 軌道全体が入るカメラ距離を求める。
 *
 * カメラは常に原点 (太陽) を向いているので、原点から一番遠い点までの
 * 距離を半径とする球が入れば足りる。視野角は縦に決まっているため、
 * 横長の絵では横の視野の方が広い。狭い方に合わせる。
 */
function fitDistance(mission, aspect) {
  let r = 0;
  const see = (p) => {
    if (p == undefined) return;
    const d = Math.hypot(p.x, p.y, p.z);
    if (d > r) r = d;
  };
  for (let i = 0; i < mission.count; i++) {
    for (const p of mission.get_trajectory(i) || []) see(p);
  }
  for (const p of nodePoints(mission)) see(p);
  if (!(r > 0)) return undefined;

  const v_half = (camera.fov * Math.PI) / 360;
  const h_half = Math.atan(Math.tan(v_half) * aspect);
  const half = Math.min(v_half, h_half);
  return (r / Math.sin(half)) * FIT_MARGIN;
}

/**
 * 太陽系ビューを、画面とは別の大きさ・別の画角で描き直して取り込む。
 *
 * 画面と違うのは3点。
 *   ・軌道全体が入るところまで引く (画面の縮尺は人が触っているもので、
 *     画像に残したいのは設計の全体像なので)
 *   ・使っている天体の軌道と名前だけを出す
 *   ・節の丸は画面用のものを伏せ、こちらで濃く描き直して番号を振る
 *
 * 描画バッファを保持しない設定なので、描いた内容は画面へ出た時点で消える。
 * 描いてから写すまでを同じ処理の中で済ませること。
 *
 * @returns {{image: HTMLCanvasElement, labels: Array, nodes: Array}}
 */
function captureView(mission, width, height) {
  const canvas = renderer.domElement;
  const aspect_before = camera.aspect;
  const pos_before = camera.position.clone();

  // 使っている天体だけにする
  const used = usedBodies(mission);
  if (hooks.setBodyVisible) {
    for (let i = 0; i < PlotState.orbit_lines.length; i++) hooks.setBodyVisible(i, used.has(i));
  }
  // 画面用の節の丸は伏せる (このあと自前で濃く描く)
  updateNodeMarkers([]);
  for (const m of PlotState.marker_spheres) m.visible = false;

  // 画面のレイアウトを揺らさないよう、canvasのCSSサイズには触らない (第3引数false)
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  const dist = fitDistance(mission, camera.aspect);
  if (dist > 0) camera.position.setLength(dist);
  camera.updateProjectionMatrix();
  // 目盛りの濃さ・天体の丸の大きさ・Y軸の目盛りの向きは、どれもカメラ距離で
  // 決まる。引いた状態に合わせ直さないと、近くで見ていたときの濃い目盛りが
  // そのまま出て、10AUまで引いた絵が「1AU」の文字で埋まる
  update_camera();
  renderer.render(scene, camera);

  const image = document.createElement("canvas");
  image.width = canvas.width;
  image.height = canvas.height;
  image.getContext("2d").drawImage(canvas, 0, 0);

  // canvasに写らないもの (HTMLのラベル) と、自前で描く節の位置。
  // カメラを戻す前に済ませること
  const names = new Set([...used].map((n) => State.planet_list[n]));
  const labels = collectLabels(width, height, names);
  const nodes = [];
  nodePoints(mission).forEach((p, i) => {
    if (p == undefined) return;
    const v = p.clone().project(camera);
    if (v.z < -1 || v.z > 1) return;
    nodes.push({ n: i + 1, x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height });
  });

  camera.aspect = aspect_before;
  camera.position.copy(pos_before);
  camera.updateProjectionMatrix();
  update_camera(); // 目盛りと丸の大きさも画面用に戻す
  if (hooks.restore) hooks.restore(); // 天体の出し入れと節の丸を画面用に戻す
  updateLayout(); // canvasの大きさを画面用に戻す
  invalidate();

  return { image, labels, nodes };
}

/**
 * 太陽系ビューに重ねている HTML のラベル (天体名・「1AU」) を、
 * 指定した大きさの画面に投影したときの位置と見た目で書き出す。
 *
 * @param {Set<string>} names 出してよい天体名 (目盛りのラベルはここに関係なく残す)
 */
function collectLabels(width, height, names) {
  const out = [];
  const v = new THREE.Vector3();
  scene.updateMatrixWorld();
  scene.traverse((obj) => {
    if (!obj.isCSS2DObject || !obj.element) return;
    // 消えている天体のラベルは出さない
    if (!obj.visible) return;
    for (let p = obj.parent; p; p = p.parent) if (!p.visible) return;

    const el = obj.element;
    const text = (el.textContent || "").trim();
    if (!text) return;
    // 天体名は、このミッションが使っているものだけ
    if (el.classList.contains("label_planet") && names && !names.has(text)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    // 目盛りのラベルは、引くほど・その軸が真横を向くほど薄くなる。
    // うっすらとしか出ないものは省く
    const opacity = parseFloat(cs.opacity);
    if (!(opacity > LABEL_MIN_OPACITY)) return;

    v.setFromMatrixPosition(obj.matrixWorld);
    v.project(camera);
    if (v.z < -1 || v.z > 1) return; // カメラの前後の外
    // CSS2DRenderer は要素の中心を投影点に置く。marginTop で持ち上げている
    // ぶん (天体名) は、そのままずらして合わせる
    const shift = parseFloat(cs.marginTop) || 0;
    out.push({
      text,
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height + shift,
      color: cs.color,
      font: (cs.fontWeight || 400) + " " + cs.fontSize + " " + FONT,
      opacity,
      planet: el.classList.contains("label_planet"),
    });
  });
  return out;
}

/* ==================================================================
   画面から読む
   ================================================================== */

const txt = (id) => {
  const e = document.getElementById(id);
  return e ? e.textContent.trim() : "-";
};

/** その値に画面で付いている色。苦しい設計が赤いまま画像に残るように */
const color_of = (id, fallback) => {
  const e = document.getElementById(id);
  if (!e) return fallback;
  const c = getComputedStyle(e).color;
  return c || fallback;
};

/** ミッションシーケンスの一覧。画面に出ているカードをそのまま読む */
function sequenceRows() {
  const rows = [];
  for (const card of document.querySelectorAll("#sequence .sequence")) {
    const pick = (cls) => {
      const e = card.querySelector("." + cls);
      return e ? e.textContent.trim() : "";
    };
    rows.push({ badge: pick("seq-badge"), name: pick("seq-name"), date: pick("seq-date") });
  }
  if (rows.length > 0) return rows;

  // 一覧がまだ組まれていない場合の保険 (画面を開いた直後など)
  const m = State.mission_sequence;
  if (!m) return rows;
  for (let i = 0; i < m.count; i++) {
    const n = m.planet_num(i);
    rows.push({
      badge: i + 1 + ". " + m.type(i),
      name: m.type(i) === Sequence_Type.Maneuver ? "深宇宙" : n >= 0 ? State.planet_list[n] : "---",
      date: JulianToDate(m.date(i)).toLocaleDateString(),
    });
  }
  return rows;
}

/** 成績バーに出ている値 */
function statItems() {
  const sel = document.getElementById("launcher");
  const rocket = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].text : "-";
  const numeric = /^[\d.]+$/.test(txt("wet_mass"));
  const items = [
    { title: "脱出速度", value: txt("v_inf"), unit: "km/s", color: color_of("v_inf") },
    { title: "打上げエネルギー", value: txt("C3"), unit: "km²/s²", color: color_of("C3") },
    { title: "総ΔV", value: txt("total_dv"), unit: "m/s", color: color_of("total_dv") },
    { title: "打ち上げロケット", value: rocket, unit: "" },
    { title: "打上げ質量", value: txt("wet_mass"), unit: numeric ? "kg" : "", color: color_of("wet_mass") },
  ];
  // 打ち上げられない設計では「残る質量」に出す数が無い (画面でも畳んでいる)
  if (numeric) items.push({ title: "残る質量", value: txt("dry_mass"), unit: "kg", color: color_of("dry_mass") });
  return items;
}

/* ==================================================================
   組み立て
   ================================================================== */

function drawHeader(ctx, c, name, period) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.text;
  ctx.font = "700 26px " + FONT;
  const right_w = 170;
  ctx.fillText(clipText(ctx, name, W - PAD * 2 - right_w - 20), PAD, PAD + 26);

  if (period && period !== "-") {
    ctx.font = "500 13px " + FONT;
    ctx.fillStyle = c.textMuted;
    ctx.fillText("期間 " + period, PAD, PAD + 46);
  }

  ctx.textAlign = "right";
  ctx.font = "600 13px " + FONT;
  ctx.fillStyle = c.textMuted;
  ctx.fillText("だれでも軌道設計", W - PAD, PAD + 26);
}

function drawView(ctx, c, shot, x, y) {
  ctx.save();
  roundRect(ctx, x, y, VIEW_W, VIEW_H, 12);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  ctx.drawImage(shot.image, x, y, VIEW_W, VIEW_H);

  // 節の丸。画面では選択に応じて濃さが変わるが、画像では全部を同じ濃さで
  // 出して、番号で順番が追えるようにする
  ctx.textBaseline = "middle";
  for (const n of shot.nodes) {
    const cx = x + n.x;
    const cy = y + n.y;
    ctx.beginPath();
    ctx.arc(cx, cy, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = c.node;
    ctx.fill();
    // 軌道の線と重なっても粒が分かるよう、白で縁取る
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // 番号は右横。線の上に乗っても読めるよう、白で縁を付けてから塗る
    ctx.font = "700 14px " + FONT;
    ctx.textAlign = "left";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeText(String(n.n), cx + NODE_LABEL_GAP, cy);
    ctx.fillStyle = c.node;
    ctx.fillText(String(n.n), cx + NODE_LABEL_GAP, cy);
  }

  // ラベルは canvas に写らないので、ここで描き足す
  ctx.textAlign = "center";
  for (const l of shot.labels) {
    ctx.globalAlpha = l.opacity;
    ctx.font = l.font;
    // 天体名は軌道の線に重なりやすいので、こちらも白で縁を付ける
    if (l.planet) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.strokeText(l.text, x + l.x, y + l.y);
    }
    ctx.fillStyle = l.color;
    ctx.fillText(l.text, x + l.x, y + l.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  roundRect(ctx, x + 0.5, y + 0.5, VIEW_W - 1, VIEW_H - 1, 12);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSequence(ctx, c, rows, x, y, h) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.textMuted;
  ctx.font = "700 12px " + FONT;
  ctx.fillText("ミッションシーケンス", x, y + 12);

  let cy = y + 26;
  for (const r of rows) {
    if (cy + CARD_H > y + h) {
      ctx.fillStyle = c.textMuted;
      ctx.font = "500 12px " + FONT;
      ctx.fillText("ほか " + (rows.length - rows.indexOf(r)) + " 件", x + 4, cy + 14);
      break;
    }
    roundRect(ctx, x + 0.5, cy + 0.5, SEQ_W - 1, CARD_H - 1, 8);
    ctx.fillStyle = c.surface;
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // 連番と種別の札
    ctx.font = "600 11px " + FONT;
    const bw = ctx.measureText(r.badge).width + 16;
    roundRect(ctx, x + 9, cy + 7, bw, 17, 8.5);
    ctx.fillStyle = c.badge;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(r.badge, x + 17, cy + 19.5);

    // 天体名と日付
    ctx.fillStyle = c.text;
    ctx.font = "600 13px " + FONT;
    ctx.fillText(clipText(ctx, r.name, SEQ_W - 130), x + 10, cy + 40);
    ctx.fillStyle = c.textMuted;
    ctx.font = "500 12px " + FONT;
    ctx.textAlign = "right";
    ctx.fillText(r.date, x + SEQ_W - 10, cy + 40);
    ctx.textAlign = "left";

    cy += CARD_H + CARD_GAP;
  }
}

function drawStats(ctx, c, items, x, y) {
  roundRect(ctx, x + 0.5, y + 0.5, W - PAD * 2 - 1, STAT_H - 1, 12);
  ctx.fillStyle = c.surface;
  ctx.fill();
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  const inner = W - PAD * 2 - 28;
  const cell = inner / items.length;
  ctx.textBaseline = "alphabetic";
  items.forEach((it, i) => {
    const cx = x + 14 + cell * i;
    ctx.textAlign = "left";
    ctx.fillStyle = c.textMuted;
    ctx.font = "600 11px " + FONT;
    ctx.fillText(clipText(ctx, it.title, cell - 12), cx, y + 26);

    ctx.fillStyle = it.color || c.text;
    ctx.font = "700 20px " + FONT;
    const value = clipText(ctx, it.value, cell - 12 - (it.unit ? 34 : 0));
    ctx.fillText(value, cx, y + 54);
    if (it.unit) {
      const vw = ctx.measureText(value).width;
      ctx.fillStyle = c.textMuted;
      ctx.font = "600 11px " + FONT;
      ctx.fillText(it.unit, cx + vw + 4, y + 54);
    }
    // 仕切り線
    if (i > 0) {
      ctx.strokeStyle = c.border;
      ctx.beginPath();
      ctx.moveTo(cx - 7, y + 14);
      ctx.lineTo(cx - 7, y + STAT_H - 14);
      ctx.stroke();
    }
  });
}

/** ファイル名に使えない文字を落とす */
function safe_name(name) {
  const base = (name || "mission").replace(/[\\/:*?"<>|]/g, "_").trim();
  return (base.length > 0 ? base : "mission") + ".png";
}

/**
 * いまの設計を画像にして保存する。
 * @param {string} [name] ミッション名 (画像の見出しとファイル名に使う)
 */
export async function exportMissionImage(name) {
  const mission = State.mission_sequence;
  if (!mission || mission.count === 0) {
    notify("画像にするシーケンスがありません");
    return false;
  }
  if (!renderer || !camera || !scene) {
    notify("太陽系ビューがまだ準備できていません");
    return false;
  }

  // 文字が読み込まれる前に描くと、別の書体で焼き付いてしまう
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch (e) {
      // 待てなくても描けるので、そのまま進む
    }
  }

  const c = palette();
  const rows = sequenceRows();
  const seq_h = 26 + rows.length * (CARD_H + CARD_GAP) - CARD_GAP;
  const body_h = Math.max(VIEW_H, seq_h);
  const H = PAD + HEAD_H + GAP + body_h + GAP + STAT_H + PAD;

  const out = document.createElement("canvas");
  out.width = W * SCALE;
  out.height = Math.round(H) * SCALE;
  const ctx = out.getContext("2d");
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  const shot = captureView(mission, VIEW_W, VIEW_H);

  drawHeader(ctx, c, name || "無題のミッション", txt("duration"));
  const body_y = PAD + HEAD_H + GAP;
  drawView(ctx, c, shot, PAD, body_y);
  drawSequence(ctx, c, rows, PAD + VIEW_W + GAP, body_y, body_h);
  drawStats(ctx, c, statItems(), PAD, body_y + body_h + GAP);

  const blob = await new Promise((r) => out.toBlob(r, "image/png"));
  if (!blob) {
    notify("画像を作れませんでした");
    return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe_name(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // すぐ消すとダウンロードが始まらない環境があるので、少し置いてから片付ける
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("「" + a.download + "」を保存しました");
  return true;
}
