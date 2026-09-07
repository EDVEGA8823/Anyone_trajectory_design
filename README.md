# だれでも軌道設計
https://edvega8823.github.io/Anyone_trajectory_design/

惑星探査機の軌道を、日付と行き先を並べるだけで組み立てられるブラウザアプリです。
日本語と英語、明るい配色と暗い配色に対応しています。

使い方は [docs/](docs/index.html) ([English](docs/en/index.html))。

## ライセンス

MIT License — 全文は [LICENSE.txt](LICENSE.txt)。

ただし `js/core/launchers.js` だけは pykep からの移植で **MPL-2.0** です
(下の「移植したもの」を参照)。

## 集めているもの

このアプリは**設計したミッションをどこにも送りません**。作った軌道はブラウザの中だけに
あり、共有リンクを配らないかぎり外へ出ることはありません
(共有リンクは設計をURLの `#` より後ろに詰めたもので、`#` から後ろはブラウザが
サーバーへ送らない場所です)。

一方で、**アクセス解析に Google アナリティクス (GA4) を入れています**。
どのページがどれくらい見られたかを知るためのもので、次のようなものが
Google へ送られます。

- 見たページのURL、参照元、おおよその地域、端末とブラウザの種類
- 訪問を区別するための識別子 (Cookie など、ブラウザの中に置かれる)

送られるのは上のような閲覧の記録だけで、**あなたが組み立てた軌道の中身は
含まれません**。集めた記録は Google のプライバシーポリシーに従って扱われます。

- Google のポリシー: https://policies.google.com/privacy
- 送られたくない場合: ブラウザの Cookie をこのサイトに対して拒否する、
  トラッキング防止の設定を使う、または Google の
  [オプトアウト アドオン](https://tools.google.com/dlpage/gaoptout) を使う

なお、配色と表示言語の設定は端末の中 (localStorage) に置くだけで、外へは送りません。

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