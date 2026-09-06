// 英語の対訳表。鍵は日本語の原文そのもの (js/ui/i18n.js を参照)。
//
// 【言葉づかい】
// 日本語のほうは、専門用語をできるだけ避けて「何が起きるか」を書く流儀で
// 通してある (「押すとその日付になります」)。英語も同じ調子に揃える。
// 教科書の言い回し (impulsive maneuver, hyperbolic excess velocity) は、
// 初出でだけ添えて、あとは平易な言い方を使う。
//
// 【用語の対応】
//   打上げ            Launch          スイングバイ    Swingby (gravity assist)
//   フライバイ        Flyby           周回軌道投入    Orbit insertion
//   軌道脱出          Orbit departure 大気圏突入      Atmospheric entry
//   ランデブー        Rendezvous      再出発          Departure
//   マヌーバ          Maneuver        最終軌道        Final orbit
//   脱出速度 V∞       Escape velocity 打上げエネルギー Launch energy (C3)
//   近点/遠点         Periapsis/Apoapsis  近日点/遠日点  Perihelion/Aphelion
//   方位角 α          Azimuth α       仰角 δ          Elevation δ
//   自動/手動         Auto/Manual     区間 (レグ)     Leg
//
// 【差し込み】
// {name} などはそのまま残すこと。落とすとその値が出なくなる。

export const EN = {
  /* ================================================================
     画面の骨組み (index.html)
     ================================================================ */
  "だれでも軌道設計": "Trajectory Design for Everyone",
  "無題のミッション": "Untitled mission",
  "ミッション名": "Mission name",
  "ミッションの名前。保存や共有のときの見出しになる":
    "The name of this mission. It becomes the heading when you save or share it.",
  "保存していない変更があります": "You have unsaved changes",
  "上下方向だけを引き伸ばして、軌道の傾きを見やすくします。\n太陽系は平たいので、そのままだと傾きがほとんど分かりません。\n目盛りも一緒に伸びるので、高さはそのまま読めます。":
    "Stretches the vertical direction only, so you can see how orbits are tilted.\n" +
    "The solar system is flat, so at true scale the tilt is almost invisible.\n" +
    "The ticks stretch too, so heights still read correctly.",
  "Z拡大": "Z stretch",

  "ミッションの成績": "Mission summary",
  "期間": "Duration",
  "打上げから最後のシーケンスまでの長さ": "Time from launch to the last sequence",
  "地球の重力を振り切った後に残る速度です。\n速いほど遠くへ早く行けますが、そのぶん打ち上げられる質量は減ります。\n目安: 3.2km/s未満=楽 / 5.5km/s未満=普通 / 7.7km/s未満=苦しい / それ以上=かなり苦しい":
    "The speed left over after escaping Earth's gravity.\n" +
    "Faster means farther and sooner, but less mass off the pad.\n" +
    "Rough guide: under 3.2 km/s = easy / under 5.5 = normal / under 7.7 = hard / above = very hard",
  "脱出速度": "Escape velocity",
  "打上げエネルギー": "Launch energy",
  "探査機が自分の燃料で出す速度変化の合計です。\n大きいほど燃料を食うので、残る質量が減ります。\n目安: 300未満=楽 / 1000未満=普通 / 2500未満=苦しい / それ以上=かなり苦しい":
    "The total speed change the spacecraft makes with its own fuel.\n" +
    "The larger it is, the more fuel it burns, and the less mass is left.\n" +
    "Rough guide: under 300 = easy / under 1000 = normal / under 2500 = hard / above = very hard",
  "総ΔV": "Total ΔV",
  "打ち上げロケット": "Launch vehicle",
  "打上げに使うロケット": "The rocket used for launch",
  "打上げ質量": "Launch mass",
  "燃料込み": "with fuel",
  "打ち上げた質量のうち、燃料を使い切った後に残るぶんです。\n目安 (残る割合): 80%以上=楽 / 50%以上=普通 / 25%以上=苦しい / それ未満=かなり苦しい":
    "The part of the launched mass that is left once the fuel is spent.\n" +
    "Rough guide (fraction left): 80% or more = easy / 50% or more = normal / 25% or more = hard / below = very hard",
  "残る質量": "Mass left",
  "燃料抜き": "without fuel",

  "ミッションシーケンス": "Mission sequence",
  "自動調整": "Auto-tune",
  "+ シーケンスを追加": "+ Add a sequence",

  "操作パネル": "Editor",
  "選択を外す (一覧の何もないところを押しても外せる)":
    "Deselect (clicking empty space in the list also works)",
  "選択を外す": "Deselect",
  "シーケンス": "Sequence",
  "天体": "Body",
  "時刻": "Time",
  "時刻を細かくずらす (マウスで大まかに、ここで微調整)":
    "Nudge the time (drag for a rough move, these for fine steps)",
  "日##日数の単位": "d",
  "変更": "Apply",
  "キャンセル": "Cancel",

  "打上げ (脱出速度)": "Launch (escape velocity)",
  "小天体は重力が小さすぎて、スイングバイでは軌道を曲げられません。\n向きも速さも、すべて自分の燃料で変えることになります。\nフライバイ: 通り過ぎるだけ\nランデブー: 天体に速度を合わせて一緒に進む\n再出発: そこから次の目的地へ飛び立つ":
    "Small bodies have too little gravity to bend your path with a swingby.\n" +
    "Both direction and speed have to come from your own fuel.\n" +
    "Flyby: just pass by\n" +
    "Rendezvous: match the body's velocity and travel alongside it\n" +
    "Departure: set off from there for the next destination",
  "最終軌道 (ミッションの成果)": "Final orbit (what the mission ends up on)",
  "いちばん近づく点で噴射して、周回軌道に入る (または周回軌道から飛び立つ) シーケンスです。\n必要なΔVは軌道の高さだけで決まり、どちら向きに回るかには寄らないので、\n3Dビューは代表的な姿で描いています。":
    "A burn at closest approach that puts you into orbit (or sends you out of one).\n" +
    "The ΔV depends only on the orbit's altitudes, not on which way you circle,\n" +
    "so the 3D view shows one representative case.",
  "近景: 天体のすぐそば。周回軌道の高さを決めます\n遠景: 天体を離れた後の飛ぶ向きと速さ (打上げと同じ見方)":
    "Close: right next to the body. Set the orbit's altitudes here.\n" +
    "Far: the direction and speed after leaving the body (same view as launch)",
  "大気に飛び込んでミッションを終えるシーケンスです。\n突入の速さは近づいてきた速度と天体の重力で決まるので、ここでは選べません。\n決められるのは入る角度だけ。深すぎると燃え、浅すぎると弾き返されます。":
    "Diving into the atmosphere to end the mission.\n" +
    "Entry speed follows from how fast you arrived and the body's gravity, so you cannot pick it.\n" +
    "All you choose is the angle. Too steep and you burn up, too shallow and you skip back out.",
  "天体のない宇宙空間で噴射して、軌道を変えるシーケンスです。\n噴く向きは、探査機が進む向きを0度とした方位角αと、\n軌道面からどれだけ上を向けるかの仰角δで決めます。":
    "A burn out in empty space that changes the orbit.\n" +
    "You aim it with the azimuth α, measured from the direction of travel,\n" +
    "and the elevation δ, how far above the orbit plane it points.",
  "マヌーバ (深宇宙での噴射)": "Maneuver (deep-space burn)",
  "天体の重力を借りて、燃料を使わずに軌道を曲げるシーケンスです。\nどれだけ近くを、どちら側から通るかで曲がり方が決まります。\n図は天体を正面から見たときの、探査機が狙う位置 (B面) です。":
    "Borrowing a body's gravity to bend your path without spending fuel.\n" +
    "How much it bends depends on how close you pass and which side you go around.\n" +
    "The figure shows where you aim, seen head-on (the B-plane).",
  "次の目的地までの区間です。太陽を何周してから着くかを選べます。\n遠い目的地へは、1周まわってから着く方がずっと安く済むことがよくあります。\n押すと軌道の取り方と読み取りが開きます。":
    "The leg to the next destination. You can choose how many times to circle the Sun first.\n" +
    "For far destinations, going around once is often much cheaper.\n" +
    "Click to open the branch choice and the readouts.",
  "区間の周回数": "Revolutions on this leg",

  /* 凡例 */
  "方位角": "Azimuth",
  "仰角": "Elevation",
  "天体の公転方向": "Body's orbital direction",
  "出発ΔV": "Departure ΔV",
  "周回軌道": "Orbit",
  "双曲線軌道": "Hyperbolic path",
  "噴射しない場合": "Without the burn",
  "近点": "Periapsis",
  "遠点": "Apoapsis",
  "近点ΔV": "Periapsis ΔV",
  "突入までの軌道": "Path to entry",
  "突入点・突入速度": "Entry point and speed",
  "地平線 (角度の基準)": "Horizon (the reference for the angle)",
  "突入角": "Entry angle",
  "(入る深さ)": "(how steeply you enter)",
  "探査機の進行方向": "Direction of travel",
  "通過する軌道": "Path through",
  "近点半径": "Periapsis radius",
  "狙う位置 (B面)": "Aim point (B-plane)",
  "回転角": "Rotation angle",

  /* ================================================================
     シーケンスの種別と天体 (js/core/state.js)
     ================================================================ */
  "打上げ": "Launch",
  "スイングバイ": "Swingby",
  "フライバイ": "Flyby",
  "周回軌道投入": "Orbit insertion",
  "軌道脱出": "Orbit departure",
  "大気圏突入": "Atmospheric entry",
  "ランデブー": "Rendezvous",
  "再出発": "Departure",
  "マヌーバ": "Maneuver",
  "最終軌道": "Final orbit",

  "水星": "Mercury",
  "金星": "Venus",
  "地球": "Earth",
  "火星": "Mars",
  "木星": "Jupiter",
  "土星": "Saturn",
  "天王星": "Uranus",
  "海王星": "Neptune",
  "冥王星": "Pluto",

  /* ================================================================
     上部バー (js/ui/topbar.js)
     ================================================================ */
  "天体を追加": "Add a body",
  "小惑星や彗星を、番号や名前を指定して天体の一覧に加える":
    "Add an asteroid or comet to the body list by number or name",
  "保存": "Save",
  "いまのミッションをファイルに保存する (Ctrl+S)": "Save this mission to a file (Ctrl+S)",
  "読込": "Open",
  "保存したミッションを読み込む (Ctrl+O)": "Open a saved mission (Ctrl+O)",
  "Xで共有": "Share on X",
  "いまのミッションをXに投稿する": "Post this mission on X",
  "ヘルプ": "Help",
  "使い方のドキュメントを別の窓で開く (アプリを触りながら読める)":
    "Open the guide in a separate window, so you can read it while using the app",
  "新規作成": "New",
  "ミッションを空にして最初からやり直す": "Clear the mission and start over",
  "例を読み込む": "Load an example",
  "ヘルプで組み立てている軌道を読み込む": "Load one of the trajectories built in the guide",
  "画像で保存": "Save as image",
  "いまの軌道図を画像として保存する": "Save the current trajectory figure as an image",
  "共有リンクをコピー": "Copy share link",
  "このミッションを開けるURLをコピーする": "Copy a URL that opens this mission",
  "ヘルプをタブで開く": "Open the guide in a tab",
  "使い方のドキュメントを新しいタブで開く": "Open the guide in a new tab",
  "キーボード操作": "Keyboard shortcuts",
  "ショートカットの一覧を見る": "See the list of shortcuts",
  "表示設定": "Display settings",
  "配色 (明るい/暗い) などの見え方の設定": "Appearance settings, such as the light/dark theme",
  "フィードバックを送る": "Send feedback",
  "要望や不具合を伝える": "Tell us about a problem or a request",
  "「{label}」は準備中です": "“{label}” is not ready yet",
  "表示言語を切り替える": "Switch the display language",
  "そのほかの操作": "More",
  "元に戻す": "Undo",
  "やり直す": "Redo",

  /* ================================================================
     はい/いいえ (js/ui/dialog.js)
     ================================================================ */
  "OK": "OK",

  /* ================================================================
     例を読み込む (js/ui/examples.js)
     ================================================================ */
  "index.json が読めません ({status})": "Cannot read index.json ({status})",
  "読み込む": "Load",
  "例を読み込めませんでした": "Could not load the example",
  "解説": "Guide",
  "この軌道の解説を読む": "Read how this trajectory was built",
  "閉じる": "Close",
  "ヘルプ (使い方) で組み立てている軌道です。読み込むと今の設計は消えます。「解説」を開くと、その軌道をどう作ったかが順を追って読めます。":
    "These are the trajectories built in the guide. Loading one discards your current design. " +
    "Open “Guide” to read how each was put together, step by step.",
  "読み込んでいます…": "Loading…",
  "例の一覧を読めませんでした。": "Could not read the list of examples.",
  "チュートリアル": "Tutorials",
  "資料": "Reference",

  /* ================================================================
     表示設定 (js/ui/settings.js)
     ================================================================ */
  "自動##配色": "Auto",
  "お使いの端末の設定に合わせる": "Follow your device's setting",
  "明るい": "Light",
  "白い地に濃い文字。図を人に見せるとき向き":
    "Dark text on white. Good for showing figures to other people",
  "暗い": "Dark",
  "黒い地に明るい文字。暗い部屋でまぶしくない":
    "Light text on black. Easy on the eyes in a dark room",
  "いまは端末の設定に従って「{theme}」で出しています。":
    "Right now it follows your device and shows “{theme}”.",
  "この端末では、次に開いたときもこの配色で出します。":
    "This device will use this theme again next time.",
  "配色": "Theme",
  "ヘルプのページも同じ配色で開きます。画像で保存したときの色も、いまの配色になります。":
    "The guide pages open with the same theme, and saved images use it too.",

  /* ================================================================
     キーボード操作 (js/ui/shortcuts.js)
     ================================================================ */
  "シーケンスを選ぶ": "Selecting a sequence",
  "ひとつ前のシーケンスを選ぶ": "Select the previous sequence",
  "ひとつ後のシーケンスを選ぶ": "Select the next sequence",
  "選択を外す (時刻を変えている途中なら、その取り消し)":
    "Deselect (or cancel a time edit in progress)",
  "時刻を動かす": "Moving the time",
  "1日 早める": "1 day earlier",
  "1日 遅らせる": "1 day later",
  "10日 早める": "10 days earlier",
  "10日 遅らせる": "10 days later",
  "動かす相手を前のシーケンスに移す (操作パネルはそのまま)":
    "Move the target to the previous sequence (the editor stays put)",
  "動かす相手を後のシーケンスに移す": "Move the target to the next sequence",
  "変えた時刻を確定する": "Apply the new time",
  "組み立てる": "Building",
  "選んだシーケンスの後ろに1つ足す (選んでいなければ末尾)":
    "Add one after the selected sequence (at the end if nothing is selected)",
  "新規作成 (Ctrl+N はブラウザが使うので Alt も足す)":
    "New mission (Ctrl+N belongs to the browser, so Alt is added)",
  "選んだシーケンスを消す": "Delete the selected sequence",
  "道具": "Tools",
  "自動調整をかける": "Run auto-tune",
  "出発日と到着日の地図を開く": "Open the departure/arrival map",
  "太陽系ビューの上下を引き伸ばす / 戻す": "Stretch the solar-system view vertically / undo it",
  "ミッションを保存する": "Save the mission",
  "ミッションを読み込む": "Open a mission",
  "この一覧を出す": "Show this list",
  "時刻を動かすキーは、時刻の枠に出ている相手 (「2. 金星」など) に効きます。何も選んでいないときは太陽系ビューが見ている時刻が動くだけで、シーケンスの日付は変わりません。文字を打っている間は、Ctrl の付いたものだけ効きます。":
    "The time keys act on whatever the time box names (“2. Venus”, for example). " +
    "With nothing selected they only move the time the solar-system view is showing; " +
    "no sequence dates change. While you are typing, only the Ctrl combinations work.",

  /* ================================================================
     フィードバックを送る (js/ui/feedback.js)
     ================================================================ */
  "何が起きましたか / どうしたいですか": "What happened, or what would you like?",
  "例) 木星への周回軌道投入で、遠点を上げても投入ΔVが変わらない":
    "e.g. Inserting into Jupiter orbit, raising the apoapsis does not change the insertion ΔV",
  "いまの設計を添える (共有リンク)": "Attach the current design (share link)",
  "まだシーケンスがありません": "There are no sequences yet",
  "送る内容を見る": "See what will be sent",
  "GitHubで報告する": "Report on GitHub",
  "内容をコピー": "Copy the text",
  "GitHubで報告するにはアカウントが要ります。持っていなければ「内容をコピー」して、Xやメールで送ってください。書いた内容と、上に出ている環境・設計が公開の場所に載ります。":
    "Reporting on GitHub needs an account. If you do not have one, use “Copy the text” " +
    "and send it by X or email. What you write, along with the environment and design shown above, " +
    "will be posted somewhere public.",
  "### 何が起きましたか": "### What happened",
  "(まだ書かれていません)": "(nothing written yet)",
  "### 環境": "### Environment",
  "### そのときの設計": "### The design at the time",
  "ブラウザ": "Browser",
  "画面": "Screen",
  "アプリ": "App",
  "シーケンス##環境の見出し": "Sequences",
  "倍率": "scale",
  "ロケット": "Launch vehicle",
  "{n}個": "{n}",
  "フィードバック": "Feedback",
  "長いので内容をコピーしました。GitHubの本文に貼り付けてください":
    "It was too long for a link, so the text was copied. Paste it into the GitHub body.",
  "内容が長すぎます。少し短くしてください": "The text is too long. Please shorten it a little.",
  "内容をコピーしました": "Copied the text",
  "コピーできませんでした": "Could not copy",
};
