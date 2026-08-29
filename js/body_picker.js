import {
  loadBodyIndex,
  loadBodySet,
  loadAllBodySets,
  allBodySetsLoaded,
  bodySets,
  popularTree,
  bodiesByIds,
  bodiesOfSet,
  searchBodies,
  bodyLabel,
  bodySubLabel,
} from './bodies.js';
import { notify } from './topbar.js';

// 天体を追加する画面。
//
// 左が分類の木、右がその分類に入っている天体の一覧。上の欄に打ち込むと
// 名前・番号・仮符号で探す。
//
// 「よく使う天体」(数十件) だけは最初から読んであるので、開いた瞬間に出る。
// 4万件ある地球接近天体などは、その枝を開いたときか、検索したときに取りに行く。

const MAX_ROWS = 300; // 一度に並べる上限 (4万件を全部DOMにすると固まる)
const SEARCH_DELAY = 160; // 打ち終わるのを待つ時間 [ms]

let root = null;
let tree_el = null;
let list_el = null;
let search_el = null;
let status_el = null;
let detail_el = null;
let add_btn = null;

let selected = null; // いま選んでいる天体
let current = null; // いま一覧に出しているもの {type:"tree"|"set"|"search", ...}
let search_timer = 0;
let on_add = null;

/* ==================================================================
   組み立て
   ================================================================== */

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != undefined) e.textContent = text;
  return e;
}

function build() {
  const overlay = el("div", "bp-overlay");
  const win = el("div", "bp-window");

  const head = el("div", "bp-head");
  head.appendChild(el("div", "bp-title", "天体を追加"));
  const close = el("button", "bp-close", "×");
  close.type = "button";
  close.title = "閉じる";
  close.onclick = closeBodyPicker;
  head.appendChild(close);
  win.appendChild(head);

  const bar = el("div", "bp-search");
  search_el = document.createElement("input");
  search_el.type = "search";
  search_el.placeholder = "名前・番号・仮符号で検索 (例: Ryugu / 162173 / 1999 JU3)";
  search_el.autocomplete = "off";
  search_el.oninput = () => {
    if (search_timer) clearTimeout(search_timer);
    search_timer = setTimeout(run_search, SEARCH_DELAY);
  };
  bar.appendChild(search_el);
  win.appendChild(bar);

  const body = el("div", "bp-body");
  tree_el = el("div", "bp-tree");
  list_el = el("div", "bp-list");
  body.appendChild(tree_el);
  body.appendChild(list_el);
  win.appendChild(body);

  const foot = el("div", "bp-foot");
  detail_el = el("div", "bp-detail", "天体を選んでください");
  add_btn = el("button", "bp-add", "追加");
  add_btn.type = "button";
  add_btn.disabled = true;
  add_btn.onclick = () => add_selected();
  foot.appendChild(detail_el);
  foot.appendChild(add_btn);
  win.appendChild(foot);

  status_el = el("div", "bp-status", "");
  win.appendChild(status_el);

  overlay.appendChild(win);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeBodyPicker();
  });
  document.addEventListener("keydown", on_key);
  return overlay;
}

function on_key(e) {
  if (!isBodyPickerOpen()) return;
  if (e.key === "Escape") {
    closeBodyPicker();
    return;
  }
  if (e.key === "Enter" && selected) {
    add_selected();
    return;
  }
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  // 上下で一覧を辿る (検索欄に打ち込んだまま選べるように)
  const rows = Array.from(list_el.querySelectorAll(".bp-row"));
  if (rows.length === 0) return;
  e.preventDefault();
  const now = rows.findIndex((r) => r.classList.contains("selected"));
  const next = e.key === "ArrowDown" ? Math.min(now + 1, rows.length - 1) : Math.max(now - 1, 0);
  rows[next < 0 ? 0 : next].click();
  rows[next < 0 ? 0 : next].scrollIntoView({ block: "nearest" });
}

/* ==================================================================
   左の木
   ================================================================== */

function tree_node(label, depth, on_click, count) {
  const item = el("button", "bp-node");
  item.type = "button";
  item.style.paddingLeft = 10 + depth * 14 + "px";
  item.appendChild(el("span", "bp-node-label", label));
  if (count != undefined) item.appendChild(el("span", "bp-node-count", String(count)));
  item.onclick = on_click;
  return item;
}

function render_tree() {
  tree_el.innerHTML = "";

  tree_el.appendChild(el("div", "bp-tree-head", "よく使う天体"));
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      const ids = collect_ids(n);
      const item = tree_node(n.label, depth, () => show_tree_node(n, item), ids.length);
      tree_el.appendChild(item);
      if (n.children) walk(n.children, depth + 1);
    }
  };
  const tree = popularTree();
  if (tree.length === 0) {
    tree_el.appendChild(el("div", "bp-tree-empty", "読み込み中…"));
  } else {
    walk(tree, 0);
  }

  // すべての天体。開いたときに取りに行く
  tree_el.appendChild(el("div", "bp-tree-head", "すべての天体"));
  for (const s of bodySets()) {
    if (s.id === "popular") continue;
    const item = tree_node(s.label, 0, () => show_set(s, item), s.count);
    item.title = s.note + "\n" + s.count.toLocaleString() + " 件 (" + Math.round(s.bytes / 1e5) / 10 + " MB)";
    tree_el.appendChild(item);
  }
}

// 枝とその下にぶら下がる天体のidを全部集める
function collect_ids(node) {
  let ids = node.ids ? node.ids.slice() : [];
  for (const c of node.children || []) ids = ids.concat(collect_ids(c));
  return ids;
}

function mark_active(item) {
  for (const b of tree_el.querySelectorAll(".bp-node")) b.classList.remove("active");
  if (item) item.classList.add("active");
}

function show_tree_node(node, item) {
  mark_active(item);
  search_el.value = "";
  current = { type: "tree", node };
  render_list(bodiesByIds(collect_ids(node)), node.label);
}

async function show_set(entry, item) {
  mark_active(item);
  search_el.value = "";
  current = { type: "set", entry };
  set_status("「" + entry.label + "」を読み込み中… (" + Math.round(entry.bytes / 1e5) / 10 + " MB)");
  list_el.innerHTML = "";
  list_el.appendChild(el("div", "bp-loading", "読み込み中…"));
  try {
    await loadBodySet(entry.id);
  } catch (e) {
    list_el.innerHTML = "";
    list_el.appendChild(el("div", "bp-empty", "読み込めませんでした: " + e.message));
    set_status("");
    return;
  }
  if (!current || current.type !== "set" || current.entry.id !== entry.id) return; // 待つ間に切り替わった
  set_status("");
  render_list(bodiesOfSet(entry.id), entry.label);
}

/* ==================================================================
   右の一覧
   ================================================================== */

function fmt(v, digits) {
  return v == null || !isFinite(v) ? "—" : v.toFixed(digits);
}

// 公転周期 [年]
function period_years(b) {
  return b.a && b.a > 0 ? Math.sqrt(b.a * b.a * b.a) : null;
}

function render_list(bodies, title) {
  list_el.innerHTML = "";
  select_body(null);

  if (!bodies || bodies.length === 0) {
    list_el.appendChild(el("div", "bp-empty", "該当する天体がありません"));
    return;
  }

  const head = el("div", "bp-list-head");
  head.appendChild(el("span", null, title + " " + bodies.length.toLocaleString() + " 件"));
  if (bodies.length > MAX_ROWS) {
    head.appendChild(el("span", "bp-list-more", "先頭 " + MAX_ROWS + " 件を表示。検索で絞り込めます"));
  }
  list_el.appendChild(head);

  const table = el("div", "bp-rows");
  for (const b of bodies.slice(0, MAX_ROWS)) {
    table.appendChild(make_row(b));
  }
  list_el.appendChild(table);
}

function make_row(b) {
  const row = el("div", "bp-row");
  row.dataset.id = b.id;

  const main = el("div", "bp-row-main");
  main.appendChild(el("div", "bp-row-name", bodyLabel(b)));
  const sub = bodySubLabel(b);
  if (sub) main.appendChild(el("div", "bp-row-sub", sub));
  row.appendChild(main);

  const nums = el("div", "bp-row-nums");
  const period = period_years(b);
  nums.appendChild(el("span", null, "a " + fmt(b.a, 3) + " AU"));
  nums.appendChild(el("span", null, "e " + fmt(b.e, 3)));
  nums.appendChild(el("span", null, "i " + fmt(b.i, 1) + "°"));
  nums.appendChild(el("span", null, period ? "周期 " + fmt(period, 1) + "年" : "周期 —"));
  row.appendChild(nums);

  if (!b.supported) {
    // 楕円でない軌道はいまの伝播で扱えない (data/bodies/README.md の未対応)
    row.classList.add("unsupported");
    row.title = "放物線・双曲線の軌道はまだ扱えません";
    row.appendChild(el("span", "bp-badge", "未対応"));
  }

  row.onclick = () => select_body(b, row);
  row.ondblclick = () => {
    select_body(b, row);
    add_selected();
  };
  return row;
}

function select_body(b, row) {
  selected = b && b.supported ? b : null;
  for (const r of list_el.querySelectorAll(".bp-row.selected")) r.classList.remove("selected");
  if (row) row.classList.add("selected");

  add_btn.disabled = !selected;
  if (!b) {
    detail_el.textContent = "天体を選んでください";
    return;
  }
  const period = period_years(b);
  const bits = [
    bodyLabel(b),
    "a " + fmt(b.a, 4) + " AU",
    "e " + fmt(b.e, 4),
    "i " + fmt(b.i, 2) + "°",
    "近日点 " + fmt(b.q, 3) + " AU",
    period ? "周期 " + fmt(period, 2) + " 年" : null,
    b.H != null ? "H " + fmt(b.H, 1) : null,
    b.supported ? null : "(放物線・双曲線の軌道はまだ扱えません)",
  ].filter(Boolean);
  detail_el.textContent = bits.join(" ・ ");
}

function add_selected() {
  if (!selected) return;
  const b = selected;
  if (on_add) on_add(b);
  else notify("「" + bodyLabel(b) + "」を選びました (軌道への取り込みは次の段階)");
  closeBodyPicker();
}

/* ==================================================================
   検索
   ================================================================== */

function set_status(text) {
  if (status_el) status_el.textContent = text || "";
}

async function run_search() {
  search_timer = 0;
  const q = search_el.value.trim();
  if (!q) {
    set_status("");
    if (current && current.type === "search") {
      list_el.innerHTML = "";
      list_el.appendChild(el("div", "bp-empty", "左から分類を選ぶか、上の欄で検索してください"));
    }
    return;
  }

  current = { type: "search", q };
  mark_active(null);
  render_list(searchBodies(q, MAX_ROWS), "「" + q + "」の検索結果");

  // まだ読んでいないまとまりがあれば、読み込んでから探し直す
  if (!allBodySetsLoaded()) {
    set_status("ほかの天体も読み込んで検索中…");
    await loadAllBodySets((entry, i, n) => {
      set_status("読み込み中 " + entry.label + " (" + (i + 1) + "/" + n + ")");
    });
    if (!current || current.type !== "search" || current.q !== q) return; // 打ち直された
    set_status("");
    render_list(searchBodies(q, MAX_ROWS), "「" + q + "」の検索結果");
  }
}

/* ==================================================================
   外向きの API
   ================================================================== */

export function openBodyPicker() {
  if (!root) {
    root = build();
    document.body.appendChild(root);
  }
  root.style.display = "flex";
  search_el.value = "";
  set_status("");
  render_tree();
  list_el.innerHTML = "";
  list_el.appendChild(el("div", "bp-empty", "左から分類を選ぶか、上の欄で検索してください"));
  select_body(null);
  search_el.focus();

  // 目録とよく使う天体は開いたときに読む (小さいので待たせない)
  loadBodyIndex()
    .then(() => loadBodySet("popular"))
    .then(() => {
      if (!isBodyPickerOpen()) return;
      render_tree();
      // 最初の分類を開いておく
      const first = tree_el.querySelector(".bp-node");
      if (first) first.click();
    })
    .catch((e) => {
      set_status("天体のデータを読み込めませんでした: " + e.message);
    });
}

export function closeBodyPicker() {
  if (root) root.style.display = "none";
  current = null;
}

export function isBodyPickerOpen() {
  return !!root && root.style.display !== "none";
}

/** 天体が選ばれたときに呼ぶ関数を登録する */
export function setBodyPickerHandlers(h) {
  on_add = h && h.onAdd;
}

// テスト・デバッグ用
export function bodyPickerSelection() {
  return selected;
}
