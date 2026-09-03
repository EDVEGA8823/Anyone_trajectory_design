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

import { renderer, scene, camera, updateLayout, invalidate } from './plot.js';
import { State, Sequence_Type } from './state.js';
import { JulianToDate } from './trajectory.js';
import { notify } from './topbar.js';

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
 * 太陽系ビューを、画面とは別の大きさで描き直して取り込む。
 *
 * preserveDrawingBuffer を切ってあるので、描いた内容は画面へ出した時点で
 * 消える。描いてから写すまでを同じ処理の中で済ませること。
 *
 * @returns {{image: HTMLCanvasElement, labels: Array}} 絵と、その上に載せる文字
 */
function captureView(width, height) {
  const canvas = renderer.domElement;
  const aspect_before = camera.aspect;

  // 画面のレイアウトを揺らさないよう、canvasのCSSサイズには触らない (第3引数false)
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const image = document.createElement("canvas");
  image.width = canvas.width;
  image.height = canvas.height;
  image.getContext("2d").drawImage(canvas, 0, 0);

  // ラベルは canvas に写らないので、同じ投影で位置だけ求めておく。
  // カメラを戻す前に済ませること
  const labels = collectLabels(width, height);

  camera.aspect = aspect_before;
  camera.updateProjectionMatrix();
  updateLayout(); // 画面用の大きさに戻す
  invalidate();

  return { image, labels };
}

/**
 * 太陽系ビューに重ねている HTML のラベル (天体名・「1AU」) を、
 * 指定した大きさの画面に投影したときの位置と見た目で書き出す。
 */
function collectLabels(width, height) {
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
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    // 目盛りのラベルは、その軸が真横を向くと薄くなる。薄いものは省く
    const opacity = parseFloat(cs.opacity);
    if (!(opacity > 0.08)) return;

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

  // ラベルは canvas に写らないので、ここで描き足す
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const l of shot.labels) {
    ctx.globalAlpha = l.opacity;
    ctx.fillStyle = l.color;
    ctx.font = l.font;
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

  const shot = captureView(VIEW_W, VIEW_H);

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
