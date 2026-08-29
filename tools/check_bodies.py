#!/usr/bin/env python3
"""作った小天体データベースが読める形かを確かめる。

自動更新はMPCの配布ファイルをそのまま信じて走るので、向こうの都合で形式や
中身が変わったときに、壊れたものをそのまま公開しないための関所。
GitHub Actions が commit する前にここを通す。
"""

import io
import json
import math
import os
import sys

FORMAT = "atd-bodies"
# 天体の数がこれを下回ったら、取得か抽出が失敗したとみなす
MIN_COUNT = {"popular": 40, "neo": 30000, "comet": 500, "distant": 5000, "named": 20000}


def fail(msg):
    print("NG: " + msg)
    return 1


ASTEROID_FIELDS = ["num", "name", "desig", "epoch", "a", "e", "i", "node", "peri", "M", "H", "type"]
COMET_FIELDS = ["num", "name", "desig", "epoch", "q", "e", "i", "node", "peri", "tp", "H", "type"]


def check_group(name, group):
    """1つの群 (小惑星か彗星のどちらか) の中身を見る"""
    errors = 0
    kind = group.get("kind")
    want = COMET_FIELDS if kind == "comet" else ASTEROID_FIELDS
    if group.get("fields") != want:
        errors += fail("%s: %s の fields が仕様と違う" % (name, kind))

    bodies = group.get("bodies") or []
    if len(bodies) != group.get("count"):
        errors += fail("%s: %s の件数が count と食い違う" % (name, kind))

    n = len(want)
    is_comet = kind == "comet"
    seen = set()
    bad = 0
    for b in bodies:
        if len(b) != n:
            bad += 1
            continue
        num, desig = b[0], b[2]
        if not num and not desig:
            bad += 1  # どちらも無いと天体を指す手段が無い
            continue
        # 小惑星と彗星は番号の体系が別なので、群ごとに重複を見る
        key = str(num) if num else desig
        if key in seen:
            bad += 1
        seen.add(key)

        epoch, size, e, inc = b[3], b[4], b[5], b[6]
        if not (2400000 < epoch < 2600000):
            bad += 1  # 元期が現実的な範囲か (1858年〜2400年ごろ)
        elif not (0 <= e < 100) or not (0 <= inc <= 180):
            bad += 1
        elif size is None or not math.isfinite(size) or size <= 0:
            bad += 1  # 小惑星は a>0、彗星は q>0
        elif not is_comet and e >= 1:
            bad += 1  # 楕円要素で来ているはずのものが双曲線になっている

    if bad:
        errors += fail("%s: %s におかしな行が %d 件" % (name, kind, bad))
    return errors, len(bodies)


def check_set(path, entry):
    errors = 0
    with io.open(path, encoding="utf-8") as f:
        data = json.load(f)

    if data.get("format") != FORMAT:
        errors += fail("%s: format が違う (%s)" % (entry["file"], data.get("format")))

    groups = data.get("groups") or []
    if not groups:
        return fail("%s: groups が空" % entry["file"])
    if [g.get("kind") for g in groups] != entry.get("kinds"):
        errors += fail("%s: 群の並びが index.json と食い違う" % entry["file"])

    total = 0
    for g in groups:
        e, n = check_group(entry["file"], g)
        errors += e
        total += n

    if total != entry["count"]:
        errors += fail("%s: 件数が index.json と食い違う (%d / %d)" % (entry["file"], total, entry["count"]))

    low = MIN_COUNT.get(entry["id"])
    if low is not None and total < low:
        errors += fail("%s: 件数が少なすぎる (%d < %d)。取得か抽出に失敗している" % (entry["file"], total, low))

    print("  %-8s %6d 件 %8.2f MB %s" % (entry["id"], total, os.path.getsize(path) / 1e6, "OK" if not errors else "NG"))
    return errors


def main(out_dir):
    index_path = os.path.join(out_dir, "index.json")
    if not os.path.exists(index_path):
        return fail("index.json がない")

    with io.open(index_path, encoding="utf-8") as f:
        index = json.load(f)

    errors = 0
    if index.get("format") != FORMAT + "-index":
        errors += fail("index.json: format が違う")
    if not index.get("sets"):
        return fail("index.json: sets が空")

    print("生成: %s / 合計 %d 件" % (index.get("generated_at"), index.get("total", 0)))
    for entry in index["sets"]:
        path = os.path.join(out_dir, entry["file"])
        if not os.path.exists(path):
            errors += fail("%s がない" % entry["file"])
            continue
        errors += check_set(path, entry)

    if errors:
        print("=> %d 件の問題" % errors)
        return 1
    print("=> 問題なし")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "data/bodies"))
