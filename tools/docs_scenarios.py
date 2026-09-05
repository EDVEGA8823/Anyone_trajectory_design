"""チュートリアル用の図を撮る台本。

各手順は (説明, JSの式, 撮る名前 or None, 切り抜きセレクタ or None)。
名前を付けた手順のあとで PNG を書き出す。
"""

def basics():
    """画面の見方"""
    return [
        ("空の画面", "__D.wait(300)", "basics-empty", None),
        ("シーケンスを2つ足す", "__D.add(2)", None, None),
        # 2つ目を選んだ状態で撮る。次の手順で変えるのは「種別」と「天体」なので、
        # その2つが見えていないと図と本文が噛み合わない
        ("2つ目を選ぶ", "__D.pick(1)", "basics-two", None),
        ("2番目を火星の周回軌道投入に",
         "(async()=>{await __D.pick(1); await __D.body('火星'); await __D.type('周回軌道投入');})()", None, None),
        ("日付を入れる", "__D.dates(['2026-10-30','2027-09-15'])", "basics-mars", None),
        ("打上げのシーケンスを選ぶ", "__D.pick(0)", "basics-launch-panel", ".control-panel"),
        ("成績バー", "__D.wait(200)", "basics-statbar", ".stat-bar"),
        ("シーケンス一覧", "__D.wait(200)", "basics-list", ".sequence-panel"),
        ("選択を外す", "__D.deselect()", "basics-preview", None),
    ]


def mars():
    """① MMX風 火星圏サンプルリターン"""
    return [
        ("シーケンスを4つ用意する", "__D.add(4)", None, None),
        ("2番目を火星の周回軌道投入に",
         "(async()=>{await __D.pick(1); await __D.body('火星'); await __D.type('周回軌道投入');})()", None, None),
        ("3番目を火星からの軌道脱出に",
         "(async()=>{await __D.pick(2); await __D.type('軌道脱出');})()", None, None),
        ("4番目を地球への大気圏突入に",
         "(async()=>{await __D.pick(3); await __D.body('地球'); await __D.type('大気圏突入');})()", None, None),
        ("日付を入れる (帰りはあとで詰める)",
         "__D.dates(['2026-10-30','2027-09-15','2030-08-25','2031-08-20'])", "mars-all", None),
        ("シーケンス一覧", "__D.deselect()", "mars-types", ".sequence-panel"),
        ("打上げの節", "__D.pick(0)", "mars-launch", ".control-panel"),

        # --- 周回軌道をフォボスの高さに ---
        ("周回軌道投入の節", "__D.pick(1)", "mars-insert", ".control-panel"),
        ("遠点を下げると投入ΔVが増える", "__D.orbit(200, 10000)", "mars-insert2", ".control-panel"),
        ("フォボスと同じ高さの円軌道にする", "__D.orbit(5980, 5980)", "mars-phobos", ".control-panel"),
        ("この時点の成績", "__D.deselect()", "mars-stat-before", ".stat-bar"),

        # --- ポークチョップ図で帰りの窓を探す ---
        ("軌道脱出の節を選ぶ", "__D.pick(2)", "mars-escape-before", ".control-panel"),
        ("ポークチョップ図を開く", "__D.porkchop()", "mars-pc", ".pc-window"),
        ("色を「到着の速さ」に変える", "__D.pcMetric('到着の速さ')", "mars-pc-arrive", ".pc-window"),
        ("図の◇を押したのと同じ日付にする",
         "(async()=>{await __D.pcMetric('打上げエネルギー'); await __D.pcClose();"
         "await __D.dates([undefined,undefined,'2030-11-03','2031-09-19']);})()", None, None),
        ("軌道脱出の節 (詰めた後)", "__D.pick(2)", "mars-escape", ".control-panel"),
        ("成績 (詰めた後)", "__D.deselect()", "mars-stat", ".stat-bar"),

        ("大気圏突入の節", "__D.pick(3)", "mars-entry", ".control-panel"),
        ("全体", "__D.deselect()", "mars-final", None),
    ]



def mercury():
    """② マリナー10号風 水星フライバイ"""
    return [
        ("シーケンスを4つ用意する", "__D.add(4)", None, None),
        ("2番目を金星のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('金星'); await __D.type('スイングバイ');})()", None, None),
        ("3番目を水星のスイングバイに",
         "(async()=>{await __D.pick(2); await __D.body('水星'); await __D.type('スイングバイ');})()", None, None),
        ("マリナー10号の実際の日付に",
         "__D.dates(['1973-11-03','1974-02-05','1974-03-29','1974-06-01'])", "mercury-all", None),
        ("金星スイングバイの節", "__D.pick(1)", "mercury-venus", ".control-panel"),
        ("水星スイングバイの節を手動にする",
         "(async()=>{await __D.pick(2); await __D.mode(false);})()", "mercury-manual", ".control-panel"),
        ("最後の節を最終軌道にする (付いてきた噴射の節は消える)",
         "(async()=>{const n=__D.State.mission_sequence.count; await __D.pick(n-1); await __D.type('最終軌道');})()",
         "mercury-end-types", ".sequence-panel"),
        ("共鳴する高度と回転角に合わせる",
         "(async()=>{await __D.pick(2); await __D.field('近点高度', 350); await __D.field('回転角', 10);})()",
         "mercury-tuned", ".control-panel"),
        ("最終軌道の節 (周期が水星2周ぶん)", "__D.pick(3)", "mercury-end", ".control-panel"),
        ("全体", "__D.deselect()", "mercury-final", None),
    ]


def jupiter():
    """③ Juno風 ΔVEGA 木星探査機"""
    return [
        ("シーケンスを3つ用意する", "__D.add(3)", None, None),
        ("2番目を地球のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('地球'); await __D.type('スイングバイ');})()", None, None),
        ("3番目を木星の周回軌道投入に",
         "(async()=>{await __D.pick(2); await __D.body('木星'); await __D.type('周回軌道投入');})()", None, None),
        ("Junoの実際の日付に",
         "__D.dates(['2011-08-05','2013-10-09','2016-07-05'])", None, None),
        ("木星まで入るところまで引く", "__D.zoom(30)", "jupiter-auto", None),
        ("打上げを選ぶと自動では解けていない", "__D.pick(0)", "jupiter-auto-panel", ".control-panel"),
        ("打上げを手動モードにする",
         "(async()=>{await __D.pick(0); await __D.mode(false);})()", "jupiter-manual", ".sequence-panel"),
        ("噴射の日付を遠日点あたりに",
         "__D.dates(['2011-08-05','2012-08-31',undefined,undefined])", None, None),
        ("打上げの向きと速さを置く",
         "(async()=>{await __D.pick(0); await __D.field('脱出速度', 5.6); await __D.field('方位角', 0); await __D.field('仰角', 0);})()",
         "jupiter-set", ".control-panel"),
        ("この時点の全体", "__D.deselect()", "jupiter-rough", None),
        ("自動調整で詰める", "__D.tune()", "jupiter-tuned", None),
        ("噴射の節", "__D.pick(1)", "jupiter-dsm", ".control-panel"),
        ("地球スイングバイの節", "__D.pick(2)", "jupiter-flyby", ".control-panel"),
        ("全体", "__D.deselect()", "jupiter-final", None),
    ]


def ryugu():
    """④ はやぶさ2風 小惑星ランデブー (実際の日付、1年同期のΔVEGA)"""
    import os as _os
    revs = _os.environ.get("REVS", "2")
    steps = [
        ("リュウグウを天体の一覧に追加する", "__D.addBody('popular','Ryugu')", None, None),
        ("シーケンスを3つ用意する", "__D.add(3)", None, None),
        ("2番目を地球のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('地球'); await __D.type('スイングバイ');})()", None, None),
        ("3番目をリュウグウのランデブーに",
         "(async()=>{await __D.pick(2); await __D.body('Ryugu'); await __D.type('ランデブー');})()", None, None),
        ("はやぶさ2の実際の日付に",
         "__D.dates(['2014-12-03','2015-12-03','2018-06-27'])", "ryugu-auto", None),
        ("シーケンス一覧", "__D.deselect()", "ryugu-types", ".sequence-panel"),
        ("地球→地球は自動では解けない", "__D.pick(0)", "ryugu-auto-panel", ".control-panel"),
        ("打上げを手動モードにする",
         "(async()=>{await __D.pick(0); await __D.mode(false);})()", None, None),
        ("噴射の日付を3か月後に",
         "__D.dates(['2014-12-03','2015-03-05',undefined,undefined])", None, None),
        ("打上げの向きと速さを置く (1年で地球に戻る値)",
         "(async()=>{await __D.pick(0); await __D.field('脱出速度', 4.0); await __D.field('方位角', 94); await __D.field('仰角', 0);})()",
         "ryugu-set", ".control-panel"),
        ("直行のままのランデブー", "__D.pick(3)", "ryugu-direct-leg", ".control-panel"),
    ]
    if revs != "0":
        steps += [
            ("リュウグウまでの区間を%s周回にする" % revs, "__D.revs(2, %s)" % revs, None, None),
            ("区間の周回数の欄", "(async()=>{await __D.pick(2); document.getElementById('leg_fold').click();})()",
             "ryugu-revs", ".control-panel"),
            ("ランデブーの節", "__D.pick(3)", "ryugu-rendezvous", ".control-panel"),
            ("噴射の節", "__D.pick(1)", "ryugu-dsm", ".control-panel"),
            ("地球スイングバイの節", "__D.pick(2)", "ryugu-flyby", ".control-panel"),
            ("全体", "__D.deselect()", "ryugu-final", None),
        ]
    return steps



def mercury_direct():
    """② の前振り: 金星を使わずに水星へ直行してみる"""
    return [
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を水星のスイングバイに (通過するだけ)",
         "(async()=>{await __D.pick(1); await __D.body('水星'); await __D.type('スイングバイ');})()", None, None),
        ("いちばん安く行ける日付にする",
         "__D.dates(['1973-12-03','1974-03-13'])", "mercury-direct", None),
        ("打上げの節", "__D.pick(0)", "mercury-direct-launch", ".control-panel"),
        ("成績バー", "__D.deselect()", "mercury-direct-stat", ".stat-bar"),
    ]


def jupiter_direct():
    """③ の前振り: 地球スイングバイを使わずに木星へ直行してみる"""
    return [
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を木星のスイングバイに (通過するだけ)",
         "(async()=>{await __D.pick(1); await __D.body('木星'); await __D.type('スイングバイ');})()", None, None),
        ("いちばん安く行ける日付にする",
         "__D.dates(['2011-07-16','2014-01-22'])", None, None),
        ("木星まで入るところまで引く", "__D.zoom(30)", "jupiter-direct", None),
        ("打上げの節", "__D.pick(0)", "jupiter-direct-launch", ".control-panel"),
        ("成績バー", "__D.deselect()", "jupiter-direct-stat", ".stat-bar"),
    ]


def pluto_direct():
    """③ の前振り: 木星を使わずに冥王星へ直行してみる"""
    return [
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を冥王星の通過に",
         "(async()=>{await __D.pick(1); await __D.body('冥王星'); await __D.type('スイングバイ');})()", None, None),
        ("ニューホライズンズと同じ日に着く日付にする",
         "__D.dates(['2006-01-19','2015-07-14'])", None, None),
        ("ロケットをアトラスVにする", "__D.launcher('atlas551_star48b')", "pluto-direct-stat", ".stat-bar"),
        ("打上げの節", "__D.pick(0)", "pluto-direct-launch", ".control-panel"),
        ("冥王星まで入るところまで引く",
         "(async()=>{await __D.deselect(); await __D.zoom(160);})()", "pluto-direct", None),
    ]


def pluto():
    """③ ニューホライズンズ風 木星スイングバイで冥王星へ"""
    return [
        ("シーケンスを3つ用意する", "__D.add(3)", None, None),
        ("2番目を木星のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('木星'); await __D.type('スイングバイ');})()", None, None),
        ("3番目を冥王星の通過に",
         "(async()=>{await __D.pick(2); await __D.body('冥王星'); await __D.type('スイングバイ');})()", None, None),
        ("ニューホライズンズの実際の日付に",
         "__D.dates(['2006-01-19','2007-02-28','2015-07-14'])", None, None),
        ("シーケンス一覧", "__D.deselect()", "pluto-types", ".sequence-panel"),
        ("ロケットをアトラスVにする", "__D.launcher('atlas551_star48b')", "pluto-stat", ".stat-bar"),
        ("冥王星まで入るところまで引く", "__D.zoom(160)", "pluto-all", None),
        ("打上げの節", "__D.pick(0)", "pluto-launch", ".control-panel"),
        ("木星スイングバイの節", "__D.pick(1)", "pluto-jupiter", ".control-panel"),
        ("打上げを20日ずらすと窓から外れる",
         "(async()=>{await __D.dates(['2006-02-08',undefined,undefined]); await __D.pick(1);})()",
         "pluto-offwindow", ".control-panel"),
        ("戻す", "__D.dates(['2006-01-19',undefined,undefined])", None, None),
        ("全体", "__D.deselect()", "pluto-final", None),
    ]


SCENARIOS = {
    "basics": basics,
    "mars": mars,
    "mercury_direct": mercury_direct,
    "mercury": mercury,
    "pluto_direct": pluto_direct,
    "pluto": pluto,
    "jupiter_direct": jupiter_direct,
    "jupiter": jupiter,
    "ryugu": ryugu,
}
