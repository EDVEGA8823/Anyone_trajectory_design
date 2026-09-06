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
        ("上のバーの右側", "__D.wait(200)", "basics-topbar", ".topbar-actions"),
        ("「…」のメニューを開く", "__D.menu()", "basics-menu", ".topbar-menu"),
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


# 資料「ホーマン遷移と、3次元の壁」で使う共通の値
_HOH_JUPITER = ("(async()=>{await __D.pick(1); await __D.body('木星');"
                " await __D.type('スイングバイ');})()")
_HOH_TOP = "__D.view(90, 26)"        # 真上から (木星の軌道まで枠に入る距離)
_HOH_OBL = "__D.view(12, 24, 20)"    # 斜めから (面の傾きを見る)
_HOH_EDGE = "__D.view(0, 24, 110)"   # 真横から (黄道面が1本の線になる)


def _hohmann_broken():
    """面を折る (ブロークンプレーン) の手順。壁の日付が入っている状態から始める。"""
    return [
        ("打上げを手動にする", "(async()=>{await __D.pick(0); await __D.mode(false);})()", None, None),
        # 噴射の位置は日付で決める。動かして噴射量がいちばん小さいところを選んだ
        ("噴射を置く", "__D.dates(['2030-01-22','2030-06-01',undefined])", None, None),
        ("打上げの向きと速さを置く",
         "(async()=>{await __D.pick(0); await __D.field('脱出速度', 8.4);"
         "await __D.field('方位角', 0); await __D.field('仰角', 0);})()", None, None),
        ("折ったあとの成績", "__D.deselect()", "hohmann-broken-stat", ".stat-bar"),
        ("壁と同じ画角で見る", _HOH_OBL, "hohmann-broken", None),
        # 折れ目は1度ほどなので、真横から見て Z拡大しないと線が1本に見える
        ("真横から (Z拡大なし)", _HOH_EDGE, "hohmann-broken-zoff", None),
        ("Z拡大を入れる", "(async()=>{await __D.zzoom(); await %s;})()" % _HOH_EDGE,
         "hohmann-broken-zon", None),
        ("Z拡大を戻す", "__D.zzoom()", None, None),
        ("噴射のシーケンス", "__D.pick(1)", "hohmann-broken-dsm", ".control-panel"),
    ]


def hohmann():
    """資料: ホーマン遷移と3次元の壁 (地球 → 木星)

    出発日は 2030-01-22 で通す。飛行時間だけを変えて、島① (849日) /
    転移角180度の直前 (966日) / 島② (1104日) を撮る。

    カメラの距離は、木星 (5.2AU) と軌道全体が枠に入るように選んである。
    画角の半分は tan(15度) なので、距離 26 でおよそ ±7AU 入る。
    """
    return [
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を木星のスイングバイに", _HOH_JUPITER, None, None),

        # 島① (転移角が180度より手前)
        ("島①の日付 849日", "__D.dates(['2030-01-22','2032-05-20'])", None, None),
        ("真上から", "(async()=>{await __D.deselect(); await %s;})()" % _HOH_TOP,
         "hohmann-short", None),

        # 島② (180度より向こう)
        ("島②の日付 1104日", "__D.dates(['2030-01-22','2033-01-30'])", None, None),
        ("同じ画角で", "(async()=>{await __D.deselect(); await %s;})()" % _HOH_TOP,
         "hohmann-long", None),

        # 転移角が180度に届く直前
        ("壁の日付 966日", "__D.dates(['2030-01-22','2032-09-14'])", None, None),
        ("真上から", "(async()=>{await __D.deselect(); await %s;})()" % _HOH_TOP,
         "hohmann-wall-top", None),
        ("斜めから見ると黄道面を突き抜けている", _HOH_OBL, "hohmann-wall-3d", None),
        ("成績バー", "__D.wait(200)", "hohmann-wall-stat", ".stat-bar"),

        # ポークチョップ図。安いところが2つの島に割れているのが見える。
        # 1万通り解くので、この手順だけで数分かかる
        ("真上に戻す", _HOH_TOP, None, None),
        ("出発日と到着日の地図",
         "(async()=>{await __D.pick(0); await __D.porkchop();})()", None, None),
        ("範囲を広げる",
         "(async()=>{const q=[...document.querySelectorAll('.pc-window input')];"
         "q[0].value='160'; q[0].dispatchEvent(new Event('change',{bubbles:true}));"
         "await __D.wait(300);"
         "q[1].value='420'; q[1].dispatchEvent(new Event('change',{bubbles:true}));"
         "await __D.wait(500); await __D.pcWait();})()",
         "hohmann-porkchop", ".pc-window"),
        ("閉じる", "__D.pcClose()", None, None),
    ] + _hohmann_broken()


def hohmann_broken():
    """hohmann() のうち、面を折るところの図だけを撮り直す。

    ポークチョップ図の手順を通らないので速い。画角を直したいときに使う。
    """
    return [
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を木星のスイングバイに", _HOH_JUPITER, None, None),
        ("壁の日付 966日", "__D.dates(['2030-01-22','2032-09-14'])", None, None),
    ] + _hohmann_broken()


def swingby_beta():
    """資料: 回転角βを変えると加速にも減速にもなる (地球スイングバイ)

    打上げ(手動) → 噴射 → 地球スイングバイ(手動) → 最終軌道。
    打上げを手動にすると噴射が1つ、スイングバイを手動にするともう1つ増えるので、
    最後を「最終軌道」にして余分な噴射を落としてから β を振る。
    """
    steps = [
        ("シーケンスを3つ用意する", "__D.add(3)", None, None),
        ("2番目を地球のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('地球'); await __D.type('スイングバイ');})()",
         None, None),
        ("日付 (1年で地球に戻る)", "__D.dates(['2014-12-03','2015-12-03','2017-06-03'])", None, None),
        ("打上げを手動にする", "(async()=>{await __D.pick(0); await __D.mode(false);})()", None, None),
        ("噴射の日付を置く",
         "__D.dates(['2014-12-03','2015-03-03','2015-12-03','2017-06-03'])", None, None),
        ("打上げの向きと速さを置く",
         "(async()=>{await __D.pick(0); await __D.field('脱出速度', 4.0);"
         "await __D.field('方位角', 94); await __D.field('仰角', 0);})()", None, None),
        ("スイングバイを手動にする", "(async()=>{await __D.pick(2); await __D.mode(false);})()",
         None, None),
        ("最後を最終軌道にして余分な噴射を落とす",
         "(async()=>{await __D.pick(4); await __D.type('最終軌道');})()", None, None),
    ]
    # β=90 で減速、0 でほぼそのまま、270 で加速になる (この入り方の場合)
    for beta, tag in ((90, "slow"), (0, "same"), (270, "fast")):
        steps += [
            ("β = %d 度にする" % beta,
             "(async()=>{await __D.pick(2); await __D.field('近点高度', 16000);"
             "await __D.field('回転角', %d);})()" % beta, None, None),
            ("スイングバイの図 (β=%d)" % beta, "__D.wait(300)",
             "swingby-%s-3d" % tag, "#swingby_box"),
            ("太陽系ビュー (β=%d)" % beta,
             "(async()=>{await __D.deselect(); await __D.view(90, 6);})()",
             "swingby-%s-sun" % tag, "#graph-panel"),
        ]
    return steps


# 資料「スイングバイ その2: 木星行きの軌道」で使う図
#
# 出来上がりの軌道は tools/docs_missions.py に固めてある (自動調整は
# 打ち切り時間で結果が動くので、詰めた設計をJSONにして数字と図で共有する)。
_SW2_TOP = "__D.view(90, 26)"     # 木星の軌道まで枠に入る真上から
_SW2_IN = "__D.view(90, 10)"      # 内側の区間 (遠日点 2.3 AU まで) が入る距離


def _sw2_show(name, tag, arrival, panels=()):
    """固めた軌道を読み込んで、全体・成績・一覧を撮る。

    画面の時刻は木星に着く日に合わせる。既定の「今日」のままだと、惑星の丸が
    軌道の端 (出会う場所) とまるで違うところに出て、線がどこへ向かっているのか
    読めない。
    """
    from docs_missions import js
    steps = [
        ("%s を読み込む" % name, js(name), None, None),
        ("時刻を木星に着く日に合わせる", "__D.when('%s')" % arrival, None, None),
        ("全体 (真上から)", "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP,
         "sw2-%s" % tag, None),
        ("内側だけ", _SW2_IN, "sw2-%s-in" % tag, None),
        ("成績バー", _SW2_TOP, "sw2-%s-stat" % tag, ".stat-bar"),
        ("シーケンス一覧", "__D.wait(200)", "sw2-%s-list" % tag, "#sequence"),
    ]
    for i, label in panels:
        steps.append(("%d番目のシーケンス" % (i + 1), "__D.pick(%d)" % i,
                      "sw2-%s-%s" % (tag, label), ".control-panel"))
    return steps


def sw2_direct():
    """比べるための下敷き: 地球から木星へ直行"""
    from docs_missions import js
    return [
        ("直行を読み込む", js("直行"), None, None),
        ("時刻を木星に着く日に合わせる", "__D.when('2034-03-21')", None, None),
        ("全体 (真上から)", "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP,
         "sw2-direct", None),
        ("成績バー", "__D.wait(200)", "sw2-direct-stat", ".stat-bar"),
        # ポークチョップ図は節を選んでいないと開けないので、先に打上げを選ぶ
        ("打上げのシーケンスを選ぶ", "__D.pick(0)", None, None),
        # 木星の窓を探す。ΔVEGA はこの日付から2年さかのぼって組み立てる
        ("出発日と到着日の地図", "__D.porkchop()", "sw2-porkchop", ".pc-window"),
        ("閉じる", "__D.pcClose()", None, None),
    ]


def sw2_dvega():
    """ΔVEGA の作り方 (組み立てる途中) と、出来上がり"""
    from docs_missions import js
    return [
        # --- まず木星へ直行する2つのシーケンスを置く ---
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を木星の周回軌道投入に",
         "(async()=>{await __D.pick(1); await __D.body('木星'); await __D.type('周回軌道投入');})()",
         None, None),
        ("窓の日付を入れる", "__D.dates(['2032-03-31','2034-03-21'])", None, None),

        # --- その前に打上げを足して、2年さかのぼる ---
        ("一覧のいちばん上の「+ シーケンスを追加」を押す", "__D.add(1)", None, None),
        ("2番目 (もとの打上げ) を地球のスイングバイにする",
         "(async()=>{await __D.pick(1); await __D.type('スイングバイ');})()",
         "sw2-dvega-list", "#sequence"),
        ("打上げを2年前に戻す",
         "__D.dates(['2030-02-10','2032-03-31','2034-03-21'])", None, None),
        ("地球→地球は自動では解けない", "__D.pick(0)", "sw2-dvega-auto", ".control-panel"),

        # --- 手動モードにして、2年で戻ってくる速さを入れる ---
        ("打上げを手動モードにする", "(async()=>{await __D.pick(0); await __D.mode(false);})()", None, None),
        ("噴射を遠日点あたりに置く",
         "__D.dates(['2030-02-10','2031-03-30','2032-03-31','2034-03-21'])", None, None),
        ("打上げの向きと速さを置く",
         "(async()=>{await __D.pick(0); await __D.field('脱出速度', 5.2);"
         "await __D.field('方位角', 0); await __D.field('仰角', 0);})()",
         "sw2-dvega-set", ".control-panel"),
        ("この時点の全体", "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP,
         "sw2-dvega-rough", None),

        # --- 自動調整のあと (固めた設計を読み込む) ---
        ("自動調整で詰めたもの", js("ΔVEGA長"), None, None),
        ("時刻を木星に着く日に合わせる", "__D.when('2034-07-21')", None, None),
        ("全体", "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP, "sw2-dvega", None),
        ("成績バー", "__D.wait(200)", "sw2-dvega-stat", ".stat-bar"),
        ("噴射のシーケンス", "__D.pick(1)", "sw2-dvega-dsm", ".control-panel"),
        ("地球スイングバイのシーケンス", "__D.pick(2)", "sw2-dvega-flyby", ".control-panel"),

        # --- 短いほうの2年同期 ---
        ("短いほうを読み込む", js("ΔVEGA短"), None, None),
        ("時刻を木星に着く日に合わせる", "__D.when('2035-03-06')", None, None),
        ("全体", "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP, "sw2-dvega-short", None),
    ]


def sw2_eve():
    """地球 → 金星 → 地球 (EVE) を作って、最終軌道がどこまで届くかを見る"""
    from docs_missions import js
    return [
        # --- 地球 → 金星の窓をポークチョップ図で探すところ ---
        ("シーケンスを2つ用意する", "__D.add(2)", None, None),
        ("2番目を金星のスイングバイに",
         "(async()=>{await __D.pick(1); await __D.body('金星'); await __D.type('スイングバイ');})()",
         None, None),
        ("日付を入れる", "__D.dates(['2029-10-03','2030-04-08'])", None, None),
        ("出発日と到着日の地図",
         "(async()=>{await __D.pick(0); await __D.porkchop();})()", "sw2-eve-pc", ".pc-window"),
        ("閉じる", "__D.pcClose()", None, None),

        # --- 地球スイングバイ1回で終わる ---
        ("1回で終わるものを読み込む", js("EVE1回"), None, None),
        ("時刻を最後の日に合わせる", "__D.when('2032-09-01')", None, None),
        ("シーケンス一覧", "__D.wait(200)", "sw2-eve-list", "#sequence"),
        ("全体 (木星の軌道まで枠に入れる)",
         "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP, "sw2-eve1", None),
        ("地球スイングバイのシーケンス", "__D.pick(2)", "sw2-eve1-flyby", ".control-panel"),
        ("最終軌道のシーケンス", "__D.pick(3)", "sw2-eve1-end", ".control-panel"),

        # --- 2年同期を挟んで2回目のスイングバイ ---
        ("2回にしたものを読み込む", js("EVE2回"), None, None),
        ("時刻を最後の日に合わせる", "__D.when('2036-09-01')", None, None),
        ("シーケンス一覧", "__D.wait(200)", "sw2-eve2-list", "#sequence"),
        ("全体 (同じ画角で)",
         "(async()=>{await __D.deselect(); await %s;})()" % _SW2_TOP, "sw2-eve2", None),
        ("2回目の地球スイングバイ", "__D.pick(3)", "sw2-eve2-flyby", ".control-panel"),
        ("最終軌道のシーケンス", "__D.pick(4)", "sw2-eve2-end", ".control-panel"),
    ]


def sw2_vega():
    """VEGA: 地球 → 金星 → 地球 → 木星"""
    return _sw2_show("VEGA", "vega", "2035-10-15", [(1, "venus"), (2, "flyby")])


def sw2_veega():
    """VEEGA: 地球 → 金星 → 地球 → 地球 → 木星"""
    return _sw2_show("VEEGA", "veega", "2036-01-14", [(2, "earth1"), (3, "earth2")])


SCENARIOS = {
    "basics": basics,
    "hohmann": hohmann,
    "hohmann_broken": hohmann_broken,
    "swingby_beta": swingby_beta,
    "sw2_direct": sw2_direct,
    "sw2_eve": sw2_eve,
    "sw2_dvega": sw2_dvega,
    "sw2_vega": sw2_vega,
    "sw2_veega": sw2_veega,
    "mars": mars,
    "mercury_direct": mercury_direct,
    "mercury": mercury,
    "pluto_direct": pluto_direct,
    "pluto": pluto,
    "jupiter_direct": jupiter_direct,
    "jupiter": jupiter,
    "ryugu": ryugu,
}
