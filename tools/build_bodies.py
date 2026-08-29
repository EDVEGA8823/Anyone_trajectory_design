#!/usr/bin/env python3
"""小天体の軌道データベースを作る。

GitHub Pages は静的配信なので、実行時に Minor Planet Center (MPC) を叩けない
(CORSも通らない)。そこで GitHub Actions で定期的にここを走らせ、MPCの配布
ファイルから必要な天体だけを抜き出して data/bodies/*.json に置いておく。

使い方:
    python tools/build_bodies.py                # 小さい配布ファイルだけで作る
    python tools/build_bodies.py --full         # 名前付き小惑星 (172MB) も取る
    python tools/build_bodies.py --offline      # キャッシュ済みのファイルで作り直す

出力の仕様は data/bodies/README.md を参照。
"""

import argparse
import gzip
import io
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone

MPC = "https://www.minorplanetcenter.net"

# MPCの配布ファイル。小さいものから順に取る (--full でなければ mpcorb は飛ばす)
SOURCES = {
    "nea": {
        "url": MPC + "/Extended_Files/nea_extended.json.gz",
        "note": "地球接近天体 (NEA)",
    },
    "distant": {
        "url": MPC + "/Extended_Files/distant_extended.json.gz",
        "note": "遠方天体 (ケンタウルス・太陽系外縁天体)",
    },
    # Extended_Files には unusual_extended.json.gz もあるが、中身はNEAの配布
    # ファイルとほぼ同じ (2026-08時点で 42236件 対 42237件、先頭はどちらもEros)。
    # 取っても全部重複で落ちるだけなので使わない。
    "comet": {
        "url": MPC + "/iau/MPCORB/CometEls.txt",
        "note": "彗星",
    },
    "mpcorb": {
        "url": MPC + "/Extended_Files/mpcorb_extended.json.gz",
        "note": "全小惑星 (172MB。名前付きを拾うためだけに使う)",
        "full_only": True,
    },
}

# 出力するまとまり。id はファイル名と、ミッションファイルからの参照に使う
SETS = [
    ("popular", "よく使う天体", "探査機が訪れた天体や、名前の通った大きな天体"),
    ("neo", "地球接近天体", "地球の軌道に近づく小惑星。到達しやすい目標が多い"),
    ("comet", "彗星", "周期彗星と非周期彗星"),
    ("distant", "遠方天体", "木星以遠のケンタウルス・太陽系外縁天体・準惑星"),
    ("named", "名前付き小惑星", "上のどれにも入らない、名前の付いた小惑星と大きな小惑星"),
]

# 名前が無くてもこの明るさ (絶対等級) より明るければ named に入れる。
# H=11 はおよそ直径30km。これより小さい無名の小惑星まで入れると数十万件になる。
NAMED_MIN_H = 11.0

ASTEROID_FIELDS = ["num", "name", "desig", "epoch", "a", "e", "i", "node", "peri", "M", "H", "type"]
COMET_FIELDS = ["num", "name", "desig", "epoch", "q", "e", "i", "node", "peri", "tp", "H", "type"]

FORMAT = "atd-bodies"
VERSION = 1


# ------------------------------------------------------------------
# 取得
# ------------------------------------------------------------------

def fetch(url, cache_dir, offline=False):
    """URLを取ってキャッシュに置く。キャッシュがあればそれを使う"""
    os.makedirs(cache_dir, exist_ok=True)
    path = os.path.join(cache_dir, os.path.basename(url))
    if os.path.exists(path) and (offline or _fresh(path)):
        print("  キャッシュを使用: %s (%.1f MB)" % (path, os.path.getsize(path) / 1e6))
        return path
    if offline:
        raise SystemExit("キャッシュがありません: " + path)

    print("  取得中: %s" % url)
    t0 = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": "anyone-trajectory-design/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(path, "wb") as f:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    print("  完了: %.1f MB / %.0f 秒" % (os.path.getsize(path) / 1e6, time.time() - t0))
    return path


def _fresh(path, hours=20):
    return (time.time() - os.path.getmtime(path)) < hours * 3600


def iter_json_objects(path):
    """JSONの配列を1件ずつ流し読みする。

    mpcorb_extended は展開すると1GBを超えるので、まるごと json.load すると
    メモリに乗らない。波括弧の深さを数えて1オブジェクトずつ切り出す。
    文字列の中の括弧とエスケープを飛ばすので、整形の仕方が変わっても壊れない。
    """
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8", errors="replace") as f:
        buf = []
        depth = 0
        in_str = False
        esc = False
        while True:
            chunk = f.read(1 << 20)
            if not chunk:
                break
            for ch in chunk:
                if depth > 0:
                    buf.append(ch)
                if in_str:
                    if esc:
                        esc = False
                    elif ch == "\\":
                        esc = True
                    elif ch == '"':
                        in_str = False
                    continue
                if ch == '"':
                    in_str = True
                elif ch == "{":
                    if depth == 0:
                        buf = ["{"]
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        yield json.loads("".join(buf))
                        buf = []


# ------------------------------------------------------------------
# 変換
# ------------------------------------------------------------------

def num_of(rec):
    """MPCの "(162173)" 形式から小惑星番号を取り出す (無番号は0)"""
    s = str(rec.get("Number") or "").strip().strip("()")
    return int(s) if s.isdigit() else 0


def body_id(num, desig, kind="a"):
    """ミッションファイルから天体を指すためのid。番号があればそちらを使う"""
    if num:
        return "%s:%d" % (kind, num)
    return "%s:%s" % (kind, desig)


def round_or_none(v, digits):
    return None if v is None else round(float(v), digits)


def asteroid_record(rec):
    """MPCの1件を、保存する配列に直す。要素が欠けているものは捨てる"""
    for key in ("Epoch", "a", "e", "i", "Node", "Peri", "M"):
        if rec.get(key) is None:
            return None
    return [
        num_of(rec),
        (rec.get("Name") or "").strip(),
        (rec.get("Principal_desig") or "").strip(),
        round_or_none(rec["Epoch"], 4),
        round_or_none(rec["a"], 7),
        round_or_none(rec["e"], 7),
        round_or_none(rec["i"], 5),
        round_or_none(rec["Node"], 5),
        round_or_none(rec["Peri"], 5),
        round_or_none(rec["M"], 5),
        round_or_none(rec.get("H"), 2),
        (rec.get("Orbit_type") or "").strip(),
    ]


# CometEls.txt は固定桁。桁位置はMPCの書式定義のとおり
COMET_TYPE = {"C": "非周期彗星", "P": "周期彗星", "D": "消失", "X": "軌道不定", "A": "小惑星軌道"}


def comet_record(line):
    if len(line) < 100:
        return None
    try:
        num_s = line[0:4].strip()
        kind = line[4:5].strip()
        year = int(line[14:18])
        month = int(line[19:21])
        day = float(line[22:29])
        q = float(line[30:39])
        e = float(line[41:49])
        peri = float(line[51:59])
        node = float(line[61:69])
        inc = float(line[71:79])
        epoch_s = line[81:89].strip()
        h = line[91:95].strip()
        readable = line[102:158].strip()
    except ValueError:
        return None

    tp = julian_day(year, month, day)
    epoch = tp
    if len(epoch_s) == 8 and epoch_s.isdigit():
        epoch = julian_day(int(epoch_s[0:4]), int(epoch_s[4:6]), float(epoch_s[6:8]))

    # "67P/Churyumov-Gerasimenko" や "C/1995 O1 (Hale-Bopp)" を符号と名前に割る
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", readable)
    if m:
        desig, name = m.group(1).strip(), m.group(2).strip()
    elif "/" in readable and not readable.startswith(("C/", "P/", "D/", "X/", "A/", "I/")):
        desig, name = readable.split("/", 1)[0].strip(), readable.split("/", 1)[1].strip()
    else:
        desig, name = readable, ""

    return [
        int(num_s) if num_s.isdigit() else 0,
        name,
        desig,
        round(epoch, 4),
        round(q, 7),
        round(e, 7),
        round(inc, 5),
        round(node, 5),
        round(peri, 5),
        round(tp, 5),
        float(h) if h else None,
        COMET_TYPE.get(kind, kind),
    ]


def julian_day(year, month, day):
    """グレゴリオ暦 (日は小数可) からユリウス日"""
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    jdn = int(day) + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045
    return jdn - 0.5 + (day - int(day))


# ------------------------------------------------------------------
# 組み立て
# ------------------------------------------------------------------

def load_popular(path):
    """よく使う天体の一覧を読む。

    [親/子] の行がそこからの分類。天体を追加する画面では、この分類が
    そのまま木構造のタブになる。

    @return (キーの集合, キー -> 分類の道のり)
    """
    keys = set()
    where = {}
    category = ["その他"]
    if not os.path.exists(path):
        return keys, where
    with io.open(path, encoding="utf-8") as f:
        for line in f:
            line = line.split("#")[0].strip()
            if not line:
                continue
            if line.startswith("[") and line.endswith("]"):
                category = [p.strip() for p in line[1:-1].split("/") if p.strip()]
                continue
            keys.add(line)
            where.setdefault(line, list(category))
    return keys, where


def build_tree(paths_and_ids):
    """(分類の道のり, id) の並びから、入れ子の木を作る"""
    root = []

    def child(nodes, label):
        for n in nodes:
            if n["label"] == label:
                return n
        n = {"label": label, "children": [], "ids": []}
        nodes.append(n)
        return n

    for path, body_id_ in paths_and_ids:
        nodes = root
        node = None
        for label in path:
            node = child(nodes, label)
            nodes = node["children"]
        if node is not None:
            node["ids"].append(body_id_)

    def prune(nodes):
        for n in nodes:
            prune(n["children"])
            if not n["children"]:
                del n["children"]
            if not n["ids"]:
                del n["ids"]
        return nodes

    return prune(root)


def popular_key(rec, keys, kind):
    """よく使う天体の指定 (番号・符号・名前) に当たれば、その指定の文字列を返す。

    彗星の番号は小惑星の番号と別の体系なので、彗星は番号だけでは当てない
    (「1」でCeresを指定したつもりが 1P/Halley にも当たってしまう)。
    """
    num, name, desig = rec[0], rec[1], rec[2]
    if kind != "comet" and num and str(num) in keys:
        return str(num)
    if desig and desig in keys:
        return desig
    if name and name in keys:
        return name
    return None


def write_set(out_dir, set_id, label, note, groups, source, generated, extra=None):
    """1つのまとまりを書き出す。

    小惑星と彗星は要素の与え方が違う (a,M と q,tp) ので、同じ配列には混ぜず
    「群」に分けて持たせる。ふつうは1群だけだが、よく使う天体のように
    両方入るまとまりもあるため、どのファイルも同じ形にしてある。
    """
    path = os.path.join(out_dir, set_id + ".json")
    data = {
        "format": FORMAT,
        "version": VERSION,
        "set": set_id,
        "label": label,
        "note": note,
        "generated_at": generated,
        "source": source,
        "count": sum(len(g["bodies"]) for g in groups),
        "groups": groups,
    }
    if extra:
        data.update(extra)
    with io.open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    return os.path.getsize(path)


def make_group(kind, bodies):
    bodies.sort(key=lambda r: (r[10] is None, r[10], r[0] or 10 ** 9))  # 明るい順
    return {
        "kind": kind,
        "fields": COMET_FIELDS if kind == "comet" else ASTEROID_FIELDS,
        "count": len(bodies),
        "bodies": bodies,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/bodies")
    ap.add_argument("--cache", default=".cache/mpc")
    ap.add_argument("--popular", default="tools/popular_bodies.txt")
    ap.add_argument("--full", action="store_true", help="名前付き小惑星 (172MBの配布ファイル) も取る")
    ap.add_argument("--offline", action="store_true", help="取得せずキャッシュだけで作る")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    popular_keys, popular_where = load_popular(args.popular)
    print("よく使う天体の指定: %d 件" % len(popular_keys))

    source_info = {
        "name": "IAU Minor Planet Center",
        "site": MPC,
        "retrieved": generated,
        "files": [],
    }

    sets = {}       # set_id -> [record, ...]
    seen = set()    # 同じ天体を2つのまとまりに入れない
    popular = {"asteroid": [], "comet": []}
    tree_items = []  # (分類の道のり, id)

    def take(set_id, rec):
        kind = "comet" if set_id == "comet" else "asteroid"
        key = body_id(rec[0], rec[2], "c" if kind == "comet" else "a")
        if key in seen:
            return False
        seen.add(key)
        sets.setdefault(set_id, []).append(rec)
        # よく使う天体は、元のまとまりに残したまま popular にも複製する
        # (最初に読むファイルを小さくするため。idが重なるので使う側で重複を除く)
        hit = popular_key(rec, popular_keys, kind)
        if hit:
            popular[kind].append(rec)
            tree_items.append((popular_where.get(hit, ["その他"]), key))
        return True

    # --- 小さい配布ファイル ---
    for set_id, src_key in (("neo", "nea"), ("distant", "distant")):
        src = SOURCES[src_key]
        print("%s: %s" % (set_id, src["note"]))
        path = fetch(src["url"], args.cache, args.offline)
        source_info["files"].append({"set": set_id, "url": src["url"], "note": src["note"]})
        n = 0
        for rec in iter_json_objects(path):
            row = asteroid_record(rec)
            if row and take(set_id, row):
                n += 1
        print("  %d 件" % n)

    # --- 彗星 ---
    src = SOURCES["comet"]
    print("comet: %s" % src["note"])
    path = fetch(src["url"], args.cache, args.offline)
    source_info["files"].append({"set": "comet", "url": src["url"], "note": src["note"]})
    n = 0
    with io.open(path, encoding="utf-8", errors="replace") as f:
        for line in f:
            row = comet_record(line.rstrip("\n"))
            if row and take("comet", row):
                n += 1
    print("  %d 件" % n)

    # --- 名前付き小惑星 (大きい配布ファイル) ---
    if args.full:
        src = SOURCES["mpcorb"]
        print("named: %s" % src["note"])
        path = fetch(src["url"], args.cache, args.offline)
        source_info["files"].append({"set": "named", "url": src["url"], "note": src["note"]})
        n = 0
        scanned = 0
        for rec in iter_json_objects(path):
            scanned += 1
            if scanned % 200000 == 0:
                print("  ... %d 件走査" % scanned)
            name = (rec.get("Name") or "").strip()
            h = rec.get("H")
            if not name and (h is None or h > NAMED_MIN_H):
                continue
            row = asteroid_record(rec)
            if row and take("named", row):
                n += 1
        print("  %d 件 (%d 件を走査)" % (n, scanned))
    else:
        print("named: --full が無いので飛ばす")

    # --- 書き出し ---
    # 今回作らなかったまとまり (--full なしのときの named など) は、前回のものを
    # そのまま残して目録にも載せ続ける。載せ忘れるとアプリから見えなくなる。
    old_index = {}
    old_path = os.path.join(args.out, "index.json")
    if os.path.exists(old_path):
        try:
            with io.open(old_path, encoding="utf-8") as f:
                for e in json.load(f).get("sets", []):
                    old_index[e["id"]] = e
        except (ValueError, KeyError):
            pass

    entries = []
    total = 0
    for set_id, label, note in SETS:
        if set_id == "popular":
            groups = [make_group(k, popular[k]) for k in ("asteroid", "comet") if popular[k]]
        elif sets.get(set_id):
            groups = [make_group("comet" if set_id == "comet" else "asteroid", sets[set_id])]
        else:
            kept = old_index.get(set_id)
            if kept and os.path.exists(os.path.join(args.out, kept["file"])):
                entries.append(kept)
                total += kept["count"]
                print("  %-8s %6d 件 (前回のものを据え置き)" % (set_id, kept["count"]))
            continue
        if not groups:
            continue

        extra = {"tree": build_tree(tree_items)} if set_id == "popular" else None
        size = write_set(args.out, set_id, label, note, groups, source_info, generated, extra)
        count = sum(g["count"] for g in groups)
        entries.append({
            "id": set_id,
            "label": label,
            "note": note,
            "file": set_id + ".json",
            "kinds": [g["kind"] for g in groups],
            "count": count,
            "bytes": size,
            # よく使う天体だけは最初から読む。他は検索されたときに取りに行く
            "preload": set_id == "popular",
        })
        total += count
        print("  %-8s %6d 件 %8.2f MB" % (set_id, count, size / 1e6))

    index = {
        "format": FORMAT + "-index",
        "version": VERSION,
        "generated_at": generated,
        "source": source_info,
        "id_rule": "番号があれば a:番号 / c:番号、無ければ a:仮符号 / c:符号",
        "units": {
            "epoch": "ユリウス日 (TT)",
            "a": "AU", "q": "AU",
            "i": "度", "node": "度", "peri": "度", "M": "度",
            "tp": "近日点通過のユリウス日 (TT)",
            "H": "絶対等級",
        },
        "sets": entries,
        "total": total,
    }
    with io.open(os.path.join(args.out, "index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print("合計 %d 件 / %.2f MB" % (total, sum(e["bytes"] for e in entries) / 1e6))
    # 「popular」に取り込めなかった指定を知らせる (綴り違いに気付けるように)
    got = set()
    for r in popular["asteroid"] + popular["comet"]:
        got.update([str(r[0]), r[1], r[2]])
    missing = sorted(k for k in popular_keys if k not in got)
    if missing:
        print("見つからなかった指定: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
