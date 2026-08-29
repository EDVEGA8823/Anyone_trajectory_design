// 小天体 (小惑星・彗星) のデータを読むところ。
//
// データの作られ方と形式は data/bodies/README.md を参照。要点だけ書くと、
//   ・目録 (index.json) → まとまりごとのファイル、という2段構え
//   ・最初は「よく使う天体」だけ読み、他は必要になったときに取りに行く
//   ・小惑星は (a, M)、彗星は (q, 近日点通過時刻) で軌道が与えられる
// 読み込んだものはここに溜めておき、画面側は id で引く。

import { AU, MU_SUN, conic_state } from './trajectory.js';

const BASE = "data/bodies/";
const DEG2RAD = Math.PI / 180;

let index_data = null;
let index_promise = null;
const loaded = new Map(); // set id -> 天体の配列
const loading = new Map(); // set id -> 読み込み中の Promise
const by_id = new Map(); // id -> 天体 (よく使う天体と元のまとまりで重なるので最初のものを採る)
let popular_tree = []; // よく使う天体の分類 (popular.json の tree)

// 番号の体系は種別ごとに別 (1 は Ceres、1P は Halley、1I は 'Oumuamua) なので、
// 天体を指すidは接頭辞で分ける
const ID_PREFIX = { asteroid: "a:", comet: "c:", interstellar: "i:" };
// 近点距離と近点通過時刻で軌道が与えられるもの (楕円とは限らない)
const PERIHELION_KINDS = ["comet", "interstellar"];

export function makeBodyId(kind, num, desig) {
  return (ID_PREFIX[kind] || "a:") + (num ? String(num) : desig);
}

/** 画面に出す名前。「(162173) Ryugu」「67P/Churyumov-Gerasimenko」「1I/'Oumuamua」など */
export function bodyLabel(b) {
  if (b.kind === "comet") {
    const head = b.num ? b.num + "P" : b.desig;
    return b.name ? head + "/" + b.name : head;
  }
  if (b.kind === "interstellar") {
    return b.name ? b.desig + "/" + b.name : b.desig;
  }
  if (b.num && b.name) return "(" + b.num + ") " + b.name;
  if (b.num) return "(" + b.num + ") " + b.desig;
  return b.desig;
}

/** 一覧の2行目に出す、番号や符号の補足 */
export function bodySubLabel(b) {
  const parts = [];
  if (b.num && b.desig) parts.push(b.desig);
  if (b.type) parts.push(b.type);
  return parts.join(" ・ ");
}

// 配列で来ている1件を、扱いやすいオブジェクトに直す
function to_object(row, fields, kind, set_id) {
  const b = { kind, set: set_id };
  for (let i = 0; i < fields.length; i++) b[fields[i]] = row[i];
  return normalizeBody(b);
}

/**
 * 天体の足りない項目を補う。
 * 小惑星は (a, 元期の平均近点角)、彗星と恒星間天体は (近点距離, 近点通過時刻)
 * で与えられるので、どちらでも使えるよう反対側も計算しておく。
 * ミッションファイルから読んだ天体もここを通す。
 *
 * @returns {object|null} 軌道が読み取れないものは null
 */
export function normalizeBody(raw) {
  if (!raw || typeof raw !== "object") return null;
  const kind = PERIHELION_KINDS.includes(raw.kind) ? raw.kind : "asteroid";
  const b = { ...raw, kind };
  const num = (v) => typeof v === "number" && isFinite(v);

  if (!num(b.e) || !num(b.i) || !num(b.node) || !num(b.peri)) return null;
  if (PERIHELION_KINDS.includes(kind)) {
    if (!num(b.q) || !num(b.tp)) return null;
    b.a = b.e < 1 ? b.q / (1 - b.e) : null; // 放物線・双曲線では意味を持たない
  } else {
    if (!num(b.a) || !num(b.M) || !num(b.epoch)) return null;
    b.q = b.a * (1 - b.e);
  }

  b.id = makeBodyId(kind, b.num, b.desig);
  b.closed = b.e < 1; // 閉じた軌道か (周期があるか)
  return b;
}

async function fetch_json(file) {
  const res = await fetch(BASE + file, { cache: "default" });
  if (!res.ok) throw new Error(file + " が読めません (" + res.status + ")");
  return res.json();
}

/** 目録を読む (何度呼んでも実際の読み込みは1回) */
export function loadBodyIndex() {
  if (index_promise) return index_promise;
  index_promise = fetch_json("index.json").then((d) => {
    index_data = d;
    return d;
  });
  return index_promise;
}

/** まとまりを1つ読む */
export function loadBodySet(set_id) {
  if (loaded.has(set_id)) return Promise.resolve(loaded.get(set_id));
  if (loading.has(set_id)) return loading.get(set_id);

  const p = loadBodyIndex()
    .then((idx) => {
      const entry = idx.sets.find((s) => s.id === set_id);
      if (!entry) throw new Error("知らないまとまり: " + set_id);
      return fetch_json(entry.file);
    })
    .then((data) => {
      // よく使う天体のファイルだけは分類の木も持っている
      if (set_id === "popular") popular_tree = data.tree || [];
      const list = [];
      for (const g of data.groups) {
        for (const row of g.bodies) {
          const b = to_object(row, g.fields, g.kind, set_id);
          if (!b) continue;
          list.push(b);
          if (!by_id.has(b.id)) by_id.set(b.id, b);
        }
      }
      loaded.set(set_id, list);
      loading.delete(set_id);
      return list;
    });

  loading.set(set_id, p);
  return p;
}

/**
 * すべてのまとまりを読む (検索のため)。
 * 1.5MBほど取りに行くので、進み具合を知らせながら順に読む。
 */
export async function loadAllBodySets(on_progress) {
  const idx = await loadBodyIndex();
  const rest = idx.sets.filter((s) => !loaded.has(s.id));
  for (let i = 0; i < rest.length; i++) {
    if (on_progress) on_progress(rest[i], i, rest.length);
    await loadBodySet(rest[i].id);
  }
  return idx.sets.length;
}

export function allBodySetsLoaded() {
  return !!index_data && index_data.sets.every((s) => loaded.has(s.id));
}

export function bodySets() {
  return index_data ? index_data.sets : [];
}

export function bodyIndex() {
  return index_data;
}

/** よく使う天体の分類の木 (popular.json の tree)。読み込み後に中身が入る */
export function popularTree() {
  return popular_tree;
}

export function bodyById(id) {
  return by_id.get(id) || null;
}

export function bodiesByIds(ids) {
  const out = [];
  for (const id of ids) {
    const b = by_id.get(id);
    if (b) out.push(b);
  }
  return out;
}

export function bodiesOfSet(set_id) {
  return loaded.get(set_id) || [];
}

/* ==================================================================
   軌道
   ================================================================== */

/**
 * 天体の軌道要素を、計算に使う形 (km・ラジアン) に直す。
 *
 * 小惑星は元期の平均近点角で与えられているので、そこから近点通過時刻に直す。
 * こうしておくと楕円・放物線・双曲線を同じ式 (conic_state) で扱える。
 *
 * @returns {{q, e, i, node, peri, tp}} tp はユリウス日
 */
export function bodyConic(b) {
  const el = {
    q: b.q * AU,
    e: b.e,
    i: b.i * DEG2RAD,
    node: b.node * DEG2RAD,
    peri: b.peri * DEG2RAD,
    tp: b.tp,
  };
  if (el.tp == undefined) {
    // 平均近点角 M0 [deg] から近点通過時刻を求める。
    // M = n (t - tp) なので tp = 元期 - M0/n。M0 は ±180度に畳んで直近の通過を採る
    const a = b.a * AU;
    const n = Math.sqrt(MU_SUN / (a * a * a)) * 86400; // [rad/日]
    let m0 = b.M * DEG2RAD;
    m0 = m0 - 2 * Math.PI * Math.round(m0 / (2 * Math.PI));
    el.tp = b.epoch - m0 / n;
  }
  return el;
}

/** 天体のある時刻 (ユリウス日) での太陽中心の位置・速度 [km, km/s] */
export function bodyStateAt(b, jd) {
  const el = bodyConic(b);
  return conic_state(el, (jd - el.tp) * 86400);
}

/**
 * 軌道を描くための点列 (太陽中心, km)。
 * 閉じた軌道は1周、開いた軌道は近点をはさんだ一区間を描く。
 */
export function bodyOrbitPoints(b, count = 181) {
  const el = bodyConic(b);
  const n = count % 2 === 0 ? count + 1 : count; // 近点をちょうど1点に置くため奇数にする
  const points = [];

  if (b.e < 1) {
    const a = el.q / (1 - el.e);
    const period = 2 * Math.PI * Math.sqrt((a * a * a) / MU_SUN); // [s]
    for (let k = 0; k < n; k++) {
      points.push(conic_state(el, (k / (n - 1) - 0.5) * period).r);
    }
    return points;
  }

  // 開いた軌道。太陽から離れすぎない範囲 (近点距離の30倍あたりまで) を描く
  const far = Math.max(el.q * 30, 5 * AU);
  const p = el.q * (1 + el.e);
  const cos_nu = (p / far - 1) / el.e; // r = p/(1+e cos nu) が far になる向き
  const nu_max = Math.acos(Math.max(-1, Math.min(1, cos_nu)));
  const t_max = time_from_true_anomaly(el, nu_max);
  for (let k = 0; k < n; k++) {
    // 時間で等間隔に取ると近点の周りが粗くなる (一番速く曲がるところ)。
    // 中央ほど詰まるように取り直す
    const u = (2 * k) / (n - 1) - 1;
    points.push(conic_state(el, t_max * u * Math.abs(u)).r);
  }
  return points;
}

// 真近点角 nu に達するまでの近点からの経過時間 [s] (開いた軌道用)
function time_from_true_anomaly(el, nu) {
  const { q, e } = el;
  if (Math.abs(e - 1) <= 1e-8) {
    const D = Math.tan(nu / 2);
    return Math.sqrt((2 * q * q * q) / MU_SUN) * (D + (D * D * D) / 3);
  }
  const a = q / (1 - e); // 双曲線では負
  const H = 2 * Math.atanh(Math.sqrt((e - 1) / (e + 1)) * Math.tan(nu / 2));
  const M = e * Math.sinh(H) - H;
  return M / Math.sqrt(MU_SUN / Math.abs(a * a * a));
}

/* ==================================================================
   検索
   ================================================================== */

// 「1999 JU3」と「1999ju3」を同じに扱う
function normalize(s) {
  return String(s || "").toLowerCase().replace(/[\s_/()-]/g, "");
}

/**
 * 読み込み済みのまとまりから探す。
 * 番号がぴったり合うもの → 名前が一致 → 名前の先頭一致 → 部分一致 の順に並べる。
 */
export function searchBodies(query, limit = 200) {
  const raw = String(query || "").trim();
  if (!raw) return [];
  const q = normalize(raw);
  const num = /^\d+$/.test(raw) ? Number(raw) : null;

  const hits = [];
  const seen = new Set();
  for (const list of loaded.values()) {
    for (const b of list) {
      if (seen.has(b.id)) continue;
      const name = normalize(b.name);
      const desig = normalize(b.desig);
      let score = -1;

      if (num != null && b.num === num) score = 0;
      else if (name && name === q) score = 1;
      else if (desig === q) score = 2;
      else if (name && name.startsWith(q)) score = 3;
      else if (desig.startsWith(q)) score = 4;
      else if (name && name.includes(q)) score = 5;
      else if (desig.includes(q)) score = 6;
      if (score < 0) continue;

      seen.add(b.id);
      hits.push({ b, score });
    }
  }

  hits.sort((x, y) => {
    if (x.score !== y.score) return x.score - y.score;
    // 同じ当たり方なら明るい (大きい) ものから
    const hx = x.b.H == null ? 99 : x.b.H;
    const hy = y.b.H == null ? 99 : y.b.H;
    if (hx !== hy) return hx - hy;
    return (x.b.num || 1e9) - (y.b.num || 1e9);
  });

  return hits.slice(0, limit).map((h) => h.b);
}
