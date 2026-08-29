// 小天体 (小惑星・彗星) のデータを読むところ。
//
// データの作られ方と形式は data/bodies/README.md を参照。要点だけ書くと、
//   ・目録 (index.json) → まとまりごとのファイル、という2段構え
//   ・最初は「よく使う天体」だけ読み、他は必要になったときに取りに行く
//   ・小惑星は (a, M)、彗星は (q, 近日点通過時刻) で軌道が与えられる
// 読み込んだものはここに溜めておき、画面側は id で引く。

const BASE = "data/bodies/";

let index_data = null;
let index_promise = null;
const loaded = new Map(); // set id -> 天体の配列
const loading = new Map(); // set id -> 読み込み中の Promise
const by_id = new Map(); // id -> 天体 (よく使う天体と元のまとまりで重なるので最初のものを採る)
let popular_tree = []; // よく使う天体の分類 (popular.json の tree)

/** 天体を指す文字列。小惑星は a:、彗星は c: (番号の体系が別なので分ける) */
export function makeBodyId(kind, num, desig) {
  const head = kind === "comet" ? "c:" : "a:";
  return head + (num ? String(num) : desig);
}

/** 画面に出す名前。「(162173) Ryugu」「67P/Churyumov-Gerasimenko」など */
export function bodyLabel(b) {
  if (b.kind === "comet") {
    const head = b.num ? b.num + "P" : b.desig;
    return b.name ? head + "/" + b.name : head;
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

  // 小惑星は (a,e)、彗星は (q,e) で来る。どちらでも使えるよう両方を持たせる
  if (kind === "comet") {
    b.a = b.e < 1 ? b.q / (1 - b.e) : null;
  } else {
    b.q = b.a * (1 - b.e);
  }
  b.id = makeBodyId(kind, b.num, b.desig);
  // 楕円でないものは、いまの伝播 (楕円専用のケプラー方程式) では扱えない
  b.supported = b.e < 1 && b.a > 0;
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
