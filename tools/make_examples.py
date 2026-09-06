# -*- coding: utf-8 -*-
"""「例を読み込む」に並べるミッションを data/examples/ に書き出す。

  python tools/make_examples.py <url>

url はローカルに立てた静的サーバのもの (例: http://127.0.0.1:8421/index.html)。

中身の作り方は2通りある。どちらも「資料に載っているものと同じ設計」になるように、
資料を作るのに使ったものをそのまま使う。

  ・チュートリアルの5本 … 図を撮るのと同じ台本 (docs_scenarios.py) を最後まで
    走らせて、出来上がったミッションを保存ファイルの形で書き出す。
    手順を直せば例も一緒に直る。
  ・資料の3本 … 図と本文で使っている設計 (docs_missions.py) をそのまま使う。

書き出すのは
  data/examples/<id>.json … 保存ファイルと同じ形 (読込と同じ道で読める)
  data/examples/index.json … 一覧に出す名前と説明、解説ページへの入口
"""
import io
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, "data", "examples")

from docs_scenarios import SCENARIOS
from docs_shots import Tab, launch, close_browser
from docs_missions import MISSIONS

# 並べる順は資料の目次と同じ (チュートリアル → 資料)。
#   group    … 一覧の見出し
#   scenario … docs_scenarios.py の台本を走らせて作る
#   mission  … docs_missions.py に固めてある設計を使う
EXAMPLES = [
    {"id": "mars", "group": "チュートリアル", "scenario": "mars", "name": "① 火星に行って帰ってくる",
     "desc": "MMX風。火星の周回軌道に入り、フォボスの高さで観測して、地球に戻る。",
     "doc": "docs/mars.html"},
    {"id": "mercury", "group": "チュートリアル", "scenario": "mercury", "name": "② 金星の重力で水星へ",
     "desc": "マリナー10号風。金星で減速し、水星に3回会うための共鳴軌道に乗る。",
     "doc": "docs/mercury.html"},
    {"id": "pluto", "group": "チュートリアル", "scenario": "pluto", "name": "③ 木星に押してもらって冥王星へ",
     "desc": "ニューホライズンズ風。木星スイングバイの威力と、ロケットの選択。",
     "doc": "docs/pluto.html"},
    {"id": "jupiter", "group": "チュートリアル", "scenario": "jupiter", "name": "④ 地球をもう一度使って木星へ",
     "desc": "Juno風。遠日点での噴射で V∞ を育てる ΔVEGA。",
     "doc": "docs/jupiter.html"},
    {"id": "ryugu", "group": "チュートリアル", "scenario": "ryugu", "name": "⑤ 小惑星にランデブーする",
     "desc": "はやぶさ2風。1年で地球に戻る軌道からリュウグウへ。",
     "doc": "docs/ryugu.html"},
    {"id": "hohmann", "group": "資料", "scenario": "hohmann_broken", "name": "面を折って木星へ",
     "desc": "ホーマン遷移が3次元で使えない理由と、その回避 (ブロークンプレーン)。",
     "doc": "docs/hohmann.html"},
    {"id": "dvega", "group": "資料", "mission": "ΔVEGA長", "name": "ΔVEGA で木星へ",
     "desc": "2年で地球に戻る軌道を組み、遠日点で 588 m/s 噴いて V∞ を育てる。",
     "doc": "docs/swingby2.html"},
    {"id": "vega", "group": "資料", "mission": "VEGA", "name": "VEGA で木星へ",
     "desc": "金星に寄って V∞ を上げ、地球で木星へ放り出してもらう。",
     "doc": "docs/swingby2.html"},
    {"id": "veega", "group": "資料", "mission": "VEEGA", "name": "VEEGA で木星へ",
     "desc": "地球を2回使って曲げを分ける。いちばん軽く打ち上げられる。",
     "doc": "docs/swingby2.html"},
]


def run_scenario(tab, name):
    """台本を最後まで走らせて、出来上がったミッションを保存ファイルの形で返す"""
    for desc, js, _shot, _sel in SCENARIOS[name]():
        tab.ev(js)
        time.sleep(0.3)
    tab.ev("__D.deselect()")
    time.sleep(0.5)
    return tab.ev(
        "(async () => (await import('./js/mission/mission_file.js')).missionData())()"
    )


def main():
    url = sys.argv[1]
    os.makedirs(OUT, exist_ok=True)
    index = {"format": "atd-examples-index", "version": 1, "examples": []}

    for ex in EXAMPLES:
        if "mission" in ex:
            data = json.loads(json.dumps(MISSIONS[ex["mission"]]))
        else:
            # 台本ごとにブラウザを開き直す。1つのブラウザで太陽系ビューを何度も
            # 作り直すと、後のほうで描画が目に見えて遅くなるため
            port = 9359
            proc = launch(port, 1500, 950)
            try:
                tab = Tab(port)
                tab.call("Page.enable")
                tab.call("Runtime.enable")
                tab.call("Page.navigate", url=url)
                time.sleep(4.5)
                tab.ev(open(os.path.join(HERE, "docs_helper.js"), encoding="utf-8").read())
                data = run_scenario(tab, ex["scenario"])
            finally:
                close_browser(proc)

        # 名前は一覧に出すものに揃える。保存した時刻は例には要らない
        data["name"] = ex["name"]
        data.pop("saved_at", None)
        path = os.path.join(OUT, ex["id"] + ".json")
        io.open(path, "w", encoding="utf-8", newline="").write(
            json.dumps(data, ensure_ascii=False, indent=1)
        )
        index["examples"].append({"id": ex["id"], "group": ex["group"], "name": ex["name"],
                                  "desc": ex["desc"], "doc": ex["doc"],
                                  "file": ex["id"] + ".json"})
        print("書いた", ex["id"], len(data["nodes"]), "シーケンス",
              "/ 小天体", len(data.get("bodies", [])))

    io.open(os.path.join(OUT, "index.json"), "w", encoding="utf-8", newline="").write(
        json.dumps(index, ensure_ascii=False, indent=1)
    )
    print("目録に", len(index["examples"]), "件")


if __name__ == "__main__":
    main()
