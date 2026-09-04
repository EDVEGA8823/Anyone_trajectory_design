# 小天体の軌道データ 仕様

小惑星・彗星の軌道要素をここに置く。`tools/build_bodies.py` が
[IAU Minor Planet Center (MPC)](https://www.minorplanetcenter.net/) の配布ファイルから
作り、GitHub Actions が定期的に走らせて更新する。**手で編集しない。**

## なぜファイルに焼くのか

このアプリは GitHub Pages の静的配信で、実行時にサーバ側の処理を挟めない。
MPC のファイルをブラウザから直接取ることもできない (CORS が通らないし、
一番大きいものは 180 MB ある)。

そこで **取得と抽出をビルド時に済ませ、必要な天体だけを JSON にして同梱する**。
アプリ側は同じドメインの静的ファイルを読むだけで済む。

## 更新

| | |
|---|---|
| 仕組み | `.github/workflows/update-bodies.yml` |
| 頻度 | 毎月1日 03:00 UTC (+ Actions の画面から手動実行) |
| 手順 | MPC から取得 → 抽出 → `tools/check_bodies.py` で検査 → 変化があれば commit |

月1回で足りるのは、MPC の元期 (Epoch) が半年ごとにしか動かないため。新しく
見つかった天体をすぐ入れたいときは手動実行する。

`--full` を付けた実行では 180 MB の `mpcorb_extended.json.gz` を落として
155万件を走査する (Actions で3〜4分)。付けない場合、名前付き小惑星
(`named.json`) は更新されない。

> 履歴の膨らみが気になるなら、data を commit せず Actions で Pages を
> 直接デプロイする形 (`actions/deploy-pages`) に変えてもよい。1回の更新で
> 約 8 MB (圧縮後 2.5 MB 程度) が積み上がる。

## 出典と扱い

- IAU Minor Planet Center, `Extended_Files/` および `iau/MPCORB/`
- 恒星間天体だけは NASA/JPL Small-Body Database (`ssd-api.jpl.nasa.gov`)。
  MPC の配布ファイルには入っていない (MPCORB は双曲線の天体を1件も持たず、
  `CometEls.txt` にもI系列は無い)
- どちらも自由に利用できるが、出典を明記すること。生成したファイルにも
  `source` として取得元 URL と取得時刻を埋めてある

## ファイル構成

| ファイル | 中身 | 件数 | 大きさ (gzip後) |
|---|---|---:|---:|
| `index.json` | 目録。最初にこれだけ読む | - | 1 KB |
| `popular.json` | よく使う天体 (`tools/popular_bodies.txt` で指定) | 64 | 4 KB |
| `interstellar.json` | 恒星間天体 (1I/'Oumuamua など) | 3 | 1 KB |
| `neo.json` | 地球接近天体 | 42,237 | 1.5 MB |
| `comet.json` | 彗星 | 934 | 40 KB |
| `distant.json` | 木星以遠 (ケンタウルス・太陽系外縁天体・準惑星) | 8,242 | 310 KB |
| `named.json` | 上に入らない、名前付き または H≦11 (直径30km程度以上) の小惑星 | 26,244 | 1.2 MB |

(件数は 2026-08 時点。GitHub Pages はテキストを自動で gzip 配信する)

`preload: true` のもの (`popular` と `interstellar`) は小さいので最初から読む。

155万件ある小惑星を全部は入れない。名前も番号も付いていない暗い天体は、
軌道が定まっていない上に探査の目標にもならないので落としている。

## 読み込み方

1. `index.json` を読む
2. `preload: true` のまとまり (`popular.json`) だけ先に読む
3. 検索されたら、残りのまとまりを取りに行く

`popular.json` の天体は元のまとまりにも残っている。**id が重複するので、
併せて使うときは id で重複を除くこと。**

## レコードの形

各ファイルは「群 (group)」の集まり。小惑星と彗星は要素の与え方が違うので
同じ配列には混ぜない。ふつうは1群だけだが、`popular.json` には両方入る。

```json
{
  "format": "atd-bodies",
  "version": 1,
  "set": "popular",
  "label": "よく使う天体",
  "generated_at": "2026-08-29T11:33:21Z",
  "source": { "name": "IAU Minor Planet Center", "files": [...] },
  "count": 61,
  "groups": [
    {
      "kind": "asteroid",
      "fields": ["num","name","desig","epoch","a","e","i","node","peri","M","H","type"],
      "count": 50,
      "bodies": [
        [162173,"Ryugu","1999 JU3",2461200.5,1.1896,0.19,5.88,251.6,211.4,120.0,19.2,"Apollo"]
      ]
    },
    {
      "kind": "comet",
      "fields": ["num","name","desig","epoch","q","e","i","node","peri","tp","H","type"],
      "count": 11,
      "bodies": [
        [0,"Hale-Bopp","C/1995 O1",2461280.5,0.924569,0.994899,89.7392,281.7983,130.7193,2450536.5341,-2.0,"非周期彗星"]
      ]
    }
  ]
}
```

値は配列で持つ (キー名を毎行繰り返すと3倍近くになるため)。並び順は `fields` が示す。

| 項目 | 意味 | 単位 |
|---|---|---|
| `num` | 小惑星番号・周期彗星番号 (無番号は 0) | - |
| `name` | 名前 (無ければ空文字) | - |
| `desig` | 仮符号・符号 (`1999 JU3` / `C/1995 O1`) | - |
| `epoch` | 元期 | ユリウス日 (TT) |
| `a` | 軌道長半径 (小惑星) | AU |
| `q` | 近日点距離 (彗星) | AU |
| `e` | 離心率 | - |
| `i` `node` `peri` | 軌道傾斜角・昇交点黄経 Ω・近日点引数 ω | 度 |
| `M` | 元期における平均近点角 (小惑星) | 度 |
| `tp` | 近日点通過時刻 (彗星) | ユリウス日 (TT) |
| `H` | 絶対等級 (不明は `null`) | 等 |
| `type` | MPC の軌道分類 (`Apollo` `MBA` `Distant Object` など) | - |

角度は J2000.0 の黄道座標系。アプリ内部の惑星の要素と同じ基準なので、
そのまま混ぜて使える。

### id (ミッションファイルからの参照)

```
番号があれば   a:162173   c:67P   i:1I
無ければ符号   a:1998 KY26   c:C/1995 O1
```

小惑星は `a:`、彗星は `c:`、恒星間天体は `i:`。**番号の体系は種別ごとに別**
(1 は Ceres、1P は Halley、1I は 'Oumuamua) なので、接頭辞を落とさないこと。

保存したミッションを開くときは、番号 → 符号の順に照合する (後から番号が
付いた天体でも、符号で保存したファイルが読めるように)。

### 要素の使い方

MPC が配る接触軌道要素 (osculating elements)。摂動は入っていないので、
元期から離れるほど実際とずれる。設計の当たりを付けるには十分だが、
**実際の運用計画にはそのまま使わないこと**。

`js/core/bodies.js` の `bodyConic()` が、どの与えられ方でも
「近点距離 q・離心率 e・向き3つ・近点通過時刻 tp」に揃える。小惑星の
平均近点角は `tp = 元期 - M0/n` で通過時刻に直す。

そのうえで `trajectory.js` の `conic_state(el, dt)` が位置と速度を出す。
楕円・放物線・双曲線を同じ入口で扱えるよう、軌道長半径ではなく近点距離を
基準にしてある (e=1 では軌道長半径が発散するため)。

```
e < 1     楕円   M = n(t-tp) → solve_kepler → 離心近点角 E → 真近点角
|e-1|≦1e-8 放物線 バーカーの式を3次方程式として解いて真近点角
e > 1     双曲線 M = n(t-tp) → solve_kepler → 双曲線近点角 H → 真近点角

真近点角が出れば、位置と速度は円錐曲線に共通の式で書ける:
  r = q(1+e) / (1 + e cos nu),  h = sqrt(mu q (1+e))
  v = (mu/h) { -sin(nu) P + (e + cos nu) Q }
```

長周期彗星 (934件中115件が放物線・双曲線) と恒星間天体もこれで扱える。

## 未対応

- 46P/Wirtanen・55P/Tempel-Tuttle など、MPC の `CometEls.txt` に載っていない
  周期彗星がいくつかある。載り次第、自動で入る
- 彗星の非重力効果 (ガス噴出による加速) は入っていない
- 恒星間天体は数が少ないので JPL から1件ずつ引いている。`1I` から順に試して
  見つからないものが2つ続いたら止める (新しく見つかっても自動で入る)
