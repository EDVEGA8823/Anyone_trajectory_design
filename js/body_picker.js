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
  normalizeBody,
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
let current = null; // いま一覧に出しているもの {type:"tree"|"set"|"mine"|"search", ...}
let search_timer = 0;
let on_add = null;
let on_remove = null;
let list_imported = null; // 取り込み済みの天体を返す関数 () => [{num, id, label, body}]

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

// 折りたたみは見出し (よく使う天体 / すべての天体) と、子を持つ分類の両方。
// 分類が十数個あるので、全部並べると左枠が読みにくい。
// 既定では「よく使う天体」だけを開き、その中の分類はすべて畳んでおく。
const SECTION_MINE = "sec:mine";
const SECTION_POPULAR = "sec:popular";
const SECTION_ALL = "sec:all";
const SECTION_MANUAL = "sec:manual";
// 取り込んだ天体はここからしか消せないうえ、多くても数件なので開いておく
const expanded = new Set([SECTION_MINE, SECTION_POPULAR]);

/** 取り込み済みの天体 (id をキーにした表) */
function imported_map() {
  const map = new Map();
  for (const r of list_imported ? list_imported() : []) map.set(r.id, r);
  return map;
}

const CHEVRON =
  '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" ' +
  'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';

function toggle(key) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
}

// 見出し。押すとその塊ごと開閉する
function section_head(key, label, on_toggle) {
  const item = el("button", "bp-section");
  item.type = "button";
  const mark = el("span", "bp-node-mark");
  mark.innerHTML = CHEVRON;
  item.appendChild(mark);
  item.appendChild(el("span", null, label));
  item.classList.toggle("open", expanded.has(key));
  item.onclick = () => {
    toggle(key);
    on_toggle();
  };
  return item;
}

function tree_node(label, depth, on_click, count, foldable) {
  const item = el("button", "bp-node");
  item.type = "button";
  item.style.paddingLeft = 8 + depth * 14 + "px";
  const mark = el("span", "bp-node-mark");
  if (foldable) mark.innerHTML = CHEVRON;
  item.appendChild(mark);
  item.appendChild(el("span", "bp-node-label", label));
  if (count != undefined) item.appendChild(el("span", "bp-node-count", count.toLocaleString()));
  item.onclick = on_click;
  return item;
}

function render_tree() {
  const active = tree_el.querySelector(".bp-node.active");
  const active_key = active ? active.dataset.key : null;
  tree_el.innerHTML = "";

  // --- 取り込んだ天体。ここからしか消せないので、1件でもあれば見せる ---
  const mine = list_imported ? list_imported() : [];
  if (mine.length > 0) {
    tree_el.appendChild(section_head(SECTION_MINE, "取り込んだ天体", render_tree));
    if (expanded.has(SECTION_MINE)) {
      const item = tree_node("一覧 (消せます)", 0, () => show_imported(), mine.length);
      item.dataset.key = SECTION_MINE + ":list";
      if (item.dataset.key === active_key) item.classList.add("active");
      tree_el.appendChild(item);
    }
  }

  // --- よく使う天体 ---
  tree_el.appendChild(section_head(SECTION_POPULAR, "よく使う天体", render_tree));

  const walk = (nodes, depth, parent_path) => {
    for (const n of nodes) {
      const path = parent_path ? parent_path + "/" + n.label : n.label;
      const has_children = !!(n.children && n.children.length);
      const open = expanded.has(path);
      const item = tree_node(
        n.label,
        depth,
        () => {
          // 押したら中身を出し、子を持つものはその場で開閉もする
          if (has_children) toggle(path);
          show_tree_node(n, path);
        },
        collect_ids(n).length,
        has_children
      );
      item.dataset.key = path;
      if (has_children) item.classList.toggle("open", open);
      if (path === active_key) item.classList.add("active");
      tree_el.appendChild(item);
      if (has_children && open) walk(n.children, depth + 1, path);
    }
  };

  if (expanded.has(SECTION_POPULAR)) {
    const tree = popularTree();
    if (tree.length === 0) tree_el.appendChild(el("div", "bp-tree-empty", "読み込み中…"));
    else walk(tree, 0, "");
  }

  // --- すべての天体。枝を開いたときに取りに行く ---
  tree_el.appendChild(section_head(SECTION_ALL, "すべての天体", render_tree));
  if (expanded.has(SECTION_ALL)) {
    for (const s of bodySets()) {
      if (s.id === "popular") continue;
      const key = "set:" + s.id;
      const item = tree_node(s.label, 0, () => show_set(s, key), s.count);
      item.dataset.key = key;
      item.title = s.note + "\n" + s.count.toLocaleString() + " 件 (" + Math.round(s.bytes / 1e5) / 10 + " MB)";
      if (key === active_key) item.classList.add("active");
      tree_el.appendChild(item);
    }
  }

  // --- 軌道要素を自分で入力。掲載されていない天体や自前のデータを使うための
  // 上級者向けの入口なので、他の分類と分けて控えめに置く ---
  tree_el.appendChild(el("div", "bp-tree-sep"));
  const manual = tree_node("軌道要素を入力して追加", 0, () => show_manual_form(), undefined, false);
  manual.classList.add("bp-manual-link");
  manual.dataset.key = SECTION_MANUAL;
  manual.title = "掲載されていない天体を、自分で用意した軌道要素から追加する";
  if (SECTION_MANUAL === active_key) manual.classList.add("active");
  tree_el.appendChild(manual);
}

// 枝とその下にぶら下がる天体のidを全部集める
function collect_ids(node) {
  let ids = node.ids ? node.ids.slice() : [];
  for (const c of node.children || []) ids = ids.concat(collect_ids(c));
  return ids;
}

function mark_active(key) {
  for (const b of tree_el.querySelectorAll(".bp-node")) {
    b.classList.toggle("active", key != null && b.dataset.key === key);
  }
}

function show_tree_node(node, key) {
  search_el.value = "";
  current = { type: "tree", node, key };
  render_tree(); // 開閉が変わっているので作り直す
  mark_active(key);
  render_list(bodiesByIds(collect_ids(node)), node.label);
}

function show_imported() {
  search_el.value = "";
  current = { type: "mine" };
  render_tree();
  mark_active(SECTION_MINE + ":list");
  const mine = list_imported ? list_imported() : [];
  render_list(mine.map((r) => r.body), "取り込んだ天体");
}

async function show_set(entry, key) {
  mark_active(key);
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

function show_manual_form() {
  search_el.value = "";
  set_status("");
  current = { type: "manual" };
  render_tree();
  mark_active(SECTION_MANUAL);
  render_manual_form();
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
    list_el.appendChild(
      el("div", "bp-empty", current && current.type === "mine" ? "取り込んだ天体はまだありません" : "該当する天体がありません")
    );
    return;
  }

  const head = el("div", "bp-list-head");
  head.appendChild(el("span", null, title + " " + bodies.length.toLocaleString() + " 件"));
  if (bodies.length > MAX_ROWS) {
    head.appendChild(el("span", "bp-list-more", "先頭 " + MAX_ROWS + " 件を表示。検索で絞り込めます"));
  }
  list_el.appendChild(head);

  const table = el("div", "bp-rows");
  const mine = imported_map();
  for (const b of bodies.slice(0, MAX_ROWS)) {
    table.appendChild(make_row(b, mine.get(b.id)));
  }
  list_el.appendChild(table);
}

function make_row(b, imported) {
  const row = el("div", "bp-row");
  row.dataset.id = b.id;

  const main = el("div", "bp-row-main");
  // 天体名の行。双曲線・放物線の目印は行の並び(a/e/i/周期の列)を崩さないよう、
  // 別列にせず名前の右にくっつける
  const name_line = el("div", "bp-row-name-line");
  name_line.appendChild(el("span", "bp-row-name", bodyLabel(b)));
  if (!b.closed) {
    // 二度と戻らない軌道。設計としては「一度きりの機会」なので目印を出す
    const open_kind = Math.abs(b.e - 1) < 1e-6 ? "放物線" : "双曲線";
    row.title = open_kind + "軌道。太陽系を離れるので、次の機会は無い";
    name_line.appendChild(el("span", "bp-badge", open_kind));
  }
  main.appendChild(name_line);
  const sub = bodySubLabel(b);
  if (sub) main.appendChild(el("div", "bp-row-sub", sub));
  row.appendChild(main);

  const nums = el("div", "bp-row-nums");
  // 記号だけでは何の数字か分からないので、行にまとめて説明を付ける
  nums.title = b.closed
    ? "a: 軌道の大きさ / e: 軌道のつぶれ具合 (0で真円) / i: 軌道の傾き"
    : "q: 太陽にいちばん近づく距離 / e: 軌道のつぶれ具合 / i: 軌道の傾き";
  const period = period_years(b);
  // 開いた軌道 (放物線・双曲線) には軌道長半径も周期も無いので、近点距離を出す
  nums.appendChild(el("span", null, b.closed ? "a " + fmt(b.a, 3) + " AU" : "q " + fmt(b.q, 3) + " AU"));
  nums.appendChild(el("span", null, "e " + fmt(b.e, 3)));
  nums.appendChild(el("span", null, "i " + fmt(b.i, 1) + "°"));
  nums.appendChild(el("span", null, period ? "周期 " + fmt(period, 1) + "年" : "周期 —"));
  row.appendChild(nums);

  if (imported) {
    row.classList.add("imported");
    row.appendChild(el("span", "bp-badge bp-badge--in", "取り込み済み"));
    const del = el("button", "bp-del", "外す");
    del.type = "button";
    del.title = "「" + imported.label + "」を天体の一覧から外す";
    del.onclick = (e) => {
      e.stopPropagation(); // 行の選択には反応させない
      remove_imported(imported);
    };
    row.appendChild(del);
  }

  row.onclick = () => select_body(b, row);
  row.ondblclick = () => {
    select_body(b, row);
    add_selected();
  };
  return row;
}

/* ==================================================================
   軌道要素を自分で入力
   ==================================================================
   掲載されていない天体 (未発見・仮の設計・JPL Horizonsから拾った値など)
   を、軌道要素そのものから追加するための入口。あくまで上級者向けの
   素朴な入力欄でよく、視覚化などは持たせない。
   小惑星は (a, 平均近点角M, 元期)、彗星・恒星間天体は (近日点距離q,
   近日点通過tp) で軌道が決まる (normalizeBody と同じ規約)。 */

function manual_field(label, { type = "number", step, placeholder } = {}) {
  const col = el("div", "column");
  col.appendChild(el("label", null, label));
  const input = document.createElement("input");
  input.type = type;
  if (step != undefined) input.step = String(step);
  if (placeholder) input.placeholder = placeholder;
  col.appendChild(input);
  return { col, input };
}

function render_manual_form() {
  list_el.innerHTML = "";
  select_body(null); // 一覧の選択・下の追加ボタンはこの画面では使わない

  const wrap = el("div", "bp-manual");
  wrap.appendChild(
    el(
      "div",
      "bp-manual-hint",
      "掲載されていない天体を、軌道要素から直接追加します。" +
        "元期・近日点通過はユリウス日(JD)で入力してください。"
    )
  );

  let kind = "asteroid";
  const kindCol = el("div", "column");
  kindCol.appendChild(el("label", null, "分類"));
  const kindBtns = el("div", "row bp-manual-kind");
  const asteroidBtn = el("button", "mode-btn active", "小惑星");
  const cometBtn = el("button", "mode-btn", "彗星・恒星間天体");
  asteroidBtn.type = "button";
  cometBtn.type = "button";
  kindBtns.appendChild(asteroidBtn);
  kindBtns.appendChild(cometBtn);
  kindCol.appendChild(kindBtns);
  wrap.appendChild(kindCol);

  const desig = manual_field("符号・仮符号", { type: "text", placeholder: "例: 2020 XL5" });
  const name = manual_field("名前 (任意)", { type: "text", placeholder: "例: Ryugu" });
  const nameRow = el("div", "row");
  nameRow.appendChild(desig.col);
  nameRow.appendChild(name.col);
  wrap.appendChild(nameRow);

  const eF = manual_field("離心率 e", { step: 0.0001 });
  const iF = manual_field("軌道傾斜角 i [deg]", { step: 0.01 });
  const row1 = el("div", "row");
  row1.appendChild(eF.col);
  row1.appendChild(iF.col);
  wrap.appendChild(row1);

  const nodeF = manual_field("昇交点黄経 Ω [deg]", { step: 0.01 });
  const periF = manual_field("近日点引数 ω [deg]", { step: 0.01 });
  const row2 = el("div", "row");
  row2.appendChild(nodeF.col);
  row2.appendChild(periF.col);
  wrap.appendChild(row2);

  // 分類で必要な項目が変わる。小惑星は a・M・元期、彗星・恒星間天体は q・近日点通過
  const aF = manual_field("軌道長半径 a [AU]", { step: 0.0001 });
  const mF = manual_field("平均近点角 M [deg]", { step: 0.01 });
  const epochF = manual_field("元期 [JD]", { step: 0.0001 });
  const asteroidRow = el("div", "row");
  asteroidRow.appendChild(aF.col);
  asteroidRow.appendChild(mF.col);
  asteroidRow.appendChild(epochF.col);
  wrap.appendChild(asteroidRow);

  const qF = manual_field("近日点距離 q [AU]", { step: 0.0001 });
  const tpF = manual_field("近日点通過 [JD]", { step: 0.0001 });
  const cometRow = el("div", "row");
  cometRow.appendChild(qF.col);
  cometRow.appendChild(tpF.col);
  cometRow.style.display = "none";
  wrap.appendChild(cometRow);

  const hF = manual_field("絶対等級 H (任意)", { step: 0.1 });
  const numF = manual_field("番号 (任意)", { step: 1 });
  const row3 = el("div", "row");
  row3.appendChild(hF.col);
  row3.appendChild(numF.col);
  wrap.appendChild(row3);

  const set_kind = (k) => {
    kind = k;
    asteroidBtn.classList.toggle("active", k === "asteroid");
    cometBtn.classList.toggle("active", k === "comet");
    asteroidRow.style.display = k === "asteroid" ? "" : "none";
    cometRow.style.display = k === "comet" ? "" : "none";
  };
  asteroidBtn.onclick = () => set_kind("asteroid");
  cometBtn.onclick = () => set_kind("comet");

  const error = el("div", "bp-manual-error");
  wrap.appendChild(error);

  const actions = el("div", "row bp-manual-actions");
  const submit = el("button", "bp-add", "この内容で追加");
  submit.type = "button";
  submit.onclick = () => {
    const num = (input) => {
      const v = parseFloat(input.value);
      return isFinite(v) ? v : undefined;
    };
    if (!desig.input.value.trim() && num(numF.input) == undefined) {
      error.textContent = "符号・仮符号か番号のどちらかは入力してください";
      return;
    }
    const raw = {
      kind,
      desig: desig.input.value.trim() || undefined,
      name: name.input.value.trim() || undefined,
      num: num(numF.input),
      e: num(eF.input),
      i: num(iF.input),
      node: num(nodeF.input),
      peri: num(periF.input),
      H: num(hF.input),
    };
    if (kind === "asteroid") {
      raw.a = num(aF.input);
      raw.M = num(mF.input);
      raw.epoch = num(epochF.input);
    } else {
      raw.q = num(qF.input);
      raw.tp = num(tpF.input);
    }
    const body = normalizeBody(raw);
    if (!body) {
      error.textContent = "軌道要素が読み取れません。数値が入っていない欄がないか確認してください";
      return;
    }
    error.textContent = "";
    if (on_add) on_add(body);
    else notify("「" + bodyLabel(body) + "」を選びました");
    closeBodyPicker();
  };
  actions.appendChild(submit);
  wrap.appendChild(actions);

  list_el.appendChild(wrap);
}

function remove_imported(entry) {
  if (!on_remove) return;
  if (!on_remove(entry.num)) return; // 使用中などで消せなかった
  // 一覧と左の木を作り直す (番号が繰り上がっているので取り直す)
  render_tree();
  if (current && current.type === "mine") show_imported();
  else if (current && current.type === "tree") show_tree_node(current.node, current.key);
  else if (current && current.type === "search") run_search();
  else if (current && current.type === "set") render_list(bodiesOfSet(current.entry.id), current.entry.label);
}

function select_body(b, row) {
  selected = b || null;
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
    b.closed ? "a " + fmt(b.a, 4) + " AU" : null,
    "e " + fmt(b.e, 4),
    "i " + fmt(b.i, 2) + "°",
    "近日点 " + fmt(b.q, 3) + " AU",
    period ? "周期 " + fmt(period, 2) + " 年" : "太陽系を離れる軌道",
    b.H != null ? "H " + fmt(b.H, 1) : null,
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
      // 右側が空のままだと何をする画面か分かりにくいので、最初の分類の中身は
      // 出しておく。ただし枝は畳んだまま (押されるまで開かない)
      const first = popularTree()[0];
      if (first) show_tree_node(first, first.label);
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

/**
 * 外側と繋ぐ関数を登録する。
 *
 * @param {object} h
 * @param {(body:object) => void} h.onAdd 天体が選ばれたとき
 * @param {(num:number) => boolean} h.onRemove 取り込み済みの天体を外すとき
 *   (消せたら true を返すこと。シーケンスで使われている等で断ることがある)
 * @param {() => {num:number,id:string,label:string,body:object}[]} h.listImported
 *   取り込み済みの天体を返す関数
 */
export function setBodyPickerHandlers(h) {
  on_add = h && h.onAdd;
  on_remove = h && h.onRemove;
  list_imported = h && h.listImported;
}

// テスト・デバッグ用
export function bodyPickerSelection() {
  return selected;
}
