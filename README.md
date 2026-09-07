# だれでも軌道設計
https://edvega8823.github.io/Anyone_trajectory_design/

惑星探査機の軌道を、日付と行き先を並べるだけで組み立てられるブラウザアプリです。
日本語と英語、明るい配色と暗い配色に対応しています。

使い方は [docs/](docs/index.html) ([English](docs/en/index.html))。

## ライセンス

TODO: このリポジトリ自身のライセンスは未定。決まったら LICENSE を置く。

## 使っているもの

同梱しているもの (`js/lib/`)

| | 作者 | ライセンス | 出どころ |
|---|---|---|---|
| math.js (mathjs) | Jos de Jong | Apache-2.0 ([全文](js/lib/math.js.LICENSE.txt)) | github.com/josdejong/mathjs |
| lambert_probrem.js | Chris Lexmond, Unstoppable Games | MIT | github.com/influenceth/lambert-orbit |

読み込んでいるもの (CDN)

| | 作者 | ライセンス | 出どころ |
|---|---|---|---|
| three.js r142 | three.js authors | MIT | github.com/mrdoob/three.js |
| Noto Sans JP | Google Fonts | OFL-1.1 | fonts.google.com |

移植したもの

- `js/core/launchers.js` の打上げ能力の表と補間は pykep (`pykep/trajopt/_launchers.py`) の移植。
  Copyright (c) 2023-2026 Dario Izzo / Advanced Concepts Team, ESA。**MPL-2.0** なので、
  このファイルは MPL-2.0 のまま置いてある (ファイル冒頭に表示あり)。
  github.com/esa/pykep

データ

- 小天体の軌道要素は [IAU Minor Planet Center](https://www.minorplanetcenter.net/) の配布ファイルから。
  恒星間天体だけは NASA/JPL Small-Body Database。詳しくは [data/bodies/README.md](data/bodies/README.md)。
- 惑星の軌道要素は J2000.0 元期からの線形近似 (JPL の公開値)。