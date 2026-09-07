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
  "だれでも軌道設計": "Anyone trajectory design",
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

  /* ================================================================
     操作パネルと一覧 (js/main.js)
     ================================================================ */
  /* 見出しに添える読み値 */
  "この後の軌道修正": "Course correction ahead",
  "目的地にきちんと届くよう、この後の宇宙空間で自動的に噴射する量。\n手前の設定が的を外しているほど大きくなるので、小さく収まるほど良い設計。":
    "The burn made automatically later in deep space so that you actually reach the target.\n" +
    "The further off your settings are, the larger it grows, so smaller is better.",
  "軌道面の中で、天体が進む向きを0度として測った角":
    "The angle within the orbit plane, measured from the body's direction of travel",
  "軌道面からどれだけ上を向けるか (上向きが正、±90度)":
    "How far above the orbit plane it points (up is positive, ±90°)",
  "{name}での V∞": "V∞ at {name}",
  "着くときの V∞": "V∞ on arrival",
  "次の天体": "the next body",
  "{name}に着くときの、その天体から見た速さ。\nスイングバイで曲げられる角度は、この速さと近づく高さで決まる。":
    "How fast you arrive at {name}, as seen from that body.\n" +
    "How far a swingby can bend your path follows from this speed and how close you pass.",
  "パワードスイングバイ": "Powered swingby",
  "深宇宙 (手動)": "Deep space (manual)",
  "深宇宙": "Deep space",

  /* 一覧 */
  "まとめて操作する対象にする": "Include in a bulk action",
  "{n}件を選択中": "{n} selected",
  "時刻は同じ差分で一緒に動きます": "Their times move together by the same amount",
  "選択解除": "Clear",
  "選んだシーケンスをまとめて削除": "Delete the selected sequences",
  "{n}件のシーケンスを削除します": "Delete {n} sequences",
  "この操作は取り消せません。": "This cannot be undone.",
  "削除": "Delete",
  "やめる": "Cancel",
  "このシーケンスを削除": "Delete this sequence",

  /* 成績バー */
  "{n}ヶ月": "{n} months",
  "{n}年": "{n} years",
  "打上げから最後のシーケンスまでの長さ ({days}日)": "Time from launch to the last sequence ({days} days)",
  "シーケンスが2つ以上あると出ます": "Shown once there are two or more sequences",
  "地球からの打上げのときだけ見積もれます": "Only estimated for launches from Earth",
  "打ち上げ不可": "Cannot launch",
  "この速度まで加速するのは、このロケットの能力を超えています":
    "Getting up to this speed is beyond what this rocket can do",
  "この構成では不可": "Not with this configuration",
  "上段 (キックステージ) が強すぎて、この程度の打上げエネルギーには使えません。\n遠くへ速く行くとき専用の構成です":
    "The upper stage (kick stage) is too strong to use at a launch energy this low.\n" +
    "It is meant for going far and fast.",
  "打上げ質量: 燃料も含めた、打ち上げるときの全体の質量\n残る質量: 総ΔVの分の燃料を使い切った後に残る、探査機そのものの質量\n打ち上げる向き (赤緯 {decl}°) と探査機の燃費 (比推力 {isp}秒) から見積もっています":
    "Launch mass: everything put on the rocket, fuel included\n" +
    "Mass left: the spacecraft itself, once the fuel for the total ΔV is spent\n" +
    "Estimated from the launch direction (declination {decl}°) and the engine's efficiency (specific impulse {isp} s)",
  "出どころ: {from}": "Source: {from}",
  /* 番号を並べるときの区切り。英語では読点にする */
  "・": ", ",
  "(この機種の見積もりが妥当な範囲の外です)": "(outside the range where this vehicle's estimate holds)",
  "公開されている性能表の値": "from the published performance table",
  "表の外側を外挿した推定": "extrapolated beyond the table",
  "パーキング軌道経由とみなした近似 (赤緯0の90%)": "approximated as going via a parking orbit (90% of declination 0)",
  "赤緯を選べる前提の包絡 (比較用)": "envelope assuming a free choice of declination (for comparison)",
  "表の値": "tabulated",
  "参考値": "indicative",
  "粗い推定": "rough estimate",

  /* 種別を選ぶところ */
  "先頭のシーケンスは常に打上げです。": "The first sequence is always a launch.",
  "マヌーバは手動モードの区間に付いてくるので、種別は変えられません。":
    "A maneuver comes with a manual-mode leg, so its type cannot be changed.",
  "要らなくなったら、これを削除するか、手前のシーケンスを自動モードに戻してください":
    "If you no longer need it, delete it, or switch the sequence before it back to auto",
  "先に天体を選ぶと、種別を選べるようになります。": "Pick a body first, then you can choose the type.",
  "選べる種別は天体で変わる (惑星ならスイングバイ・周回軌道投入、小天体ならフライバイ・ランデブー)":
    "Which types are available depends on the body (swingby and orbit insertion for planets, flyby and rendezvous for small bodies)",
  "この位置・この天体で選べる種別はありません。": "No type is available at this position with this body.",

  /* 天体の出し入れ */
  "「{name}」はすでに一覧にあります": "“{name}” is already in the list",
  "「{name}」を天体に追加しました (シーケンスの天体欄から選べます)":
    "Added “{name}” to the bodies (pick it from a sequence's body list)",
  "「{name}」はシーケンス {list} で使われています。先に別の天体に変えるか、そのシーケンスを消してください":
    "“{name}” is used by sequence {list}. Change those to another body, or delete them first.",
  "「{name}」を一覧から外しました": "Removed “{name}” from the list",
  "窓を開けませんでした。ポップアップの許可を確かめてください":
    "Could not open the window. Check that pop-ups are allowed.",
  "新しく作り直す": "start over",
  "新しいミッションを始めました": "Started a new mission",

  /* ポークチョップ図を開くボタン */
  "出発日と到着日を探す": "Find departure and arrival dates",
  "出発日と到着日をいろいろ変えて、どの組み合わせが楽に行けるかを\n地図 (ポークチョップ図) にします。押した点をそのまま日付にできます。":
    "Sweeps departure and arrival dates and maps which pairs are easy to fly\n" +
    "(a porkchop plot). Click a point to use those dates.",
  "次のシーケンスの天体を決めると開けます": "Available once the next sequence has a body",
  "{name}を {n} 日遅らせ": "moved {name} {n} days later",
  "{name}を {n} 日早め": "moved {name} {n} days earlier",
  "出発": "departure",
  "到着": "arrival",
  "前後のシーケンスとの間隔が詰まっているため、{list}ました":
    "The neighbouring sequences were too close, so it {list}",

  /* 自動 / 手動 */
  "自動": "Auto",
  "手動": "Manual",
  "この先に目的地が無いので、自動にはできません": "There is no destination ahead, so auto is not possible",
  "自動 (行き先に合わせる)": "Auto (matched to the destination)",
  "最終軌道で終えている間は手動のみ": "Manual only while the mission ends on a final orbit",

  /* 打上げ・遠景ビューの読み値 */
  "脱出速度 V∞": "Escape velocity V∞",
  "方位角 α": "Azimuth α",
  "仰角 δ": "Elevation δ",
  "脱出速度 V∞ [km/s]": "Escape velocity V∞ [km/s]",
  "方位角 α [deg]": "Azimuth α [deg]",
  "仰角 δ [deg]": "Elevation δ [deg]",
  "α: 天体が進む向きから / δ: 軌道面からの傾き":
    "α: from the body's direction of travel / δ: tilt out of the orbit plane",

  /* 区間の中の節目 */
  "この区間に近日点・遠日点・交点はありません": "This leg has no perihelion, aphelion, or node",
  "この点に固定する (前後の時刻を変えても追従します)": "Pin to this point (it follows when nearby times change)",
  "固定を解除する": "Unpin",
  "固定中": "pinned",
  "ほか {n} 件": "{n} more",
  "昇交点": "Ascending node",
  "降交点": "Descending node",
  "近日点": "Perihelion",
  "遠日点": "Aphelion",
  "近日点##太陽中心軌道": "Perihelion",

  /* 周回数 */
  "直行": "Direct",
  "{n}周": "{n} rev",
  "太陽をまわらずに直接向かう": "Head straight there without circling the Sun",
  "この区間では{n}周する解が見つかりません": "No solution with {n} revolutions on this leg",
  "{n}周するには最短 {need} 日 (いまは {now} 日)": "{n} revolutions need at least {need} days (now {now})",
  "軌道の取り方": "Which branch",
  "もう一方": "The other one",
  "遠日点 {au} AU": "Aphelion {au} AU",
  "同じ周回数でも軌道の取り方は2通りあります。こちらで行く":
    "With the same number of revolutions there are two ways round. Take this one.",
  "飛行時間": "Flight time",
  "{n} 日": "{n} d",
  "{n}周にするには": "For {n} revolutions",
  "{n} 日以上": "{n} d or more",
  "{n}周に変更": "changed to {n}",
  "{want}周するには日数が足りないので、{use}周として計算しています":
    "There are not enough days for {want} revolutions, so it is computed as {use}",

  /* 小天体との出会い */
  "手前の区間が決まると計算されます": "Computed once the leg before it is set",
  "到着ΔV": "Arrival ΔV",
  "天体に速度を合わせて並んで進むために要る噴射":
    "The burn needed to match the body's velocity and travel alongside it",
  "この先": "After this",
  "天体と一緒に進む": "Stay with the body",
  "「再出発」で次へ向かう": "Use “Departure” to head onward",
  "近づいてくる速さ": "Closing speed",
  "出発ΔV [m/s]": "Departure ΔV [m/s]",
  "必要なΔV": "ΔV needed",
  "0 m/s (噴射なし)": "0 m/s (no burn)",
  "すれ違う速さ": "Passing speed",
  "噴射なし": "no burn",
  "ΔV不要": "no ΔV",
  "現実的": "realistic",
  "重い": "heavy",
  "かなり重い": "very heavy",

  /* 最終軌道 */
  "まだ決まっていません": "Not determined yet",
  "太陽系脱出": "Leaving the solar system",
  "脱出ぎりぎり": "Just barely escaping",
  "太陽周回": "Orbiting the Sun",
  "太陽系を出る速さ": "Speed leaving the solar system",
  "離心率": "Eccentricity",
  "軌道の傾き": "Inclination",
  "1周の時間": "Period",
  "年##単位": "yr",

  /* マヌーバ */
  "どれだけ速度を変えるか": "How much to change the velocity",
  "軌道面の中で、探査機が進む向きを0度として測った角":
    "The angle within the orbit plane, measured from the spacecraft's direction of travel",
  "前後の区間が決まると計算されます": "Computed once the legs on both sides are set",
  "太陽からの距離": "Distance from the Sun",
  "噴射前の速さ": "Speed before the burn",
  "噴射後の速さ": "Speed after the burn",
  "{n} 時間": "{n} h",
  "{n} 年": "{n} yr",

  /* 周回軌道投入 / 軌道脱出 */
  "周回軌道投入 (捕獲)": "Orbit insertion (capture)",
  "軌道脱出 (再出発)": "Orbit departure (setting off again)",
  "減速": "slowing down",
  "加速": "speeding up",
  "近景": "Close",
  "遠景": "Far",
  "天体を選ぶと計算されます": "Computed once you pick a body",
  "直前の「周回軌道投入」と同じ天体からのみ": "Only from the same body as the “Orbit insertion” just before",
  "近点高度 [km]": "Periapsis altitude [km]",
  "いちばん近づく高さ。下限 {km} km (大気や放射線帯を避けるため)":
    "The lowest altitude you reach. Floor {km} km (to stay clear of the atmosphere and radiation belts)",
  "遠点高度 [km]": "Apoapsis altitude [km]",
  "(上限)": "(at the ceiling)",
  "いちばん離れる高さ。上限 {max}。これより遠いと太陽に引っぱられて、周回軌道を保てません":
    "The highest altitude you reach. Ceiling {max}. Beyond that the Sun pulls you away and the orbit does not hold.",
  "上限まで広げたときの投入ΔV {dv} m/s": "Insertion ΔV at the ceiling: {dv} m/s",
  "上限まで広げたときの脱出ΔV {dv} m/s": "Departure ΔV at the ceiling: {dv} m/s",
  "脱出ΔV": "Departure ΔV",
  "手前の区間が決まると計算": "Computed once the leg before it is set",
  "次の目的地が決まると計算": "Computed once the next destination is set",
  "近づく速さ V∞": "Approach speed V∞",
  "遠くから天体に近づいてくるときの速さ。速いほど、捕まるための噴射も重くなる":
    "How fast you come in from far away. The faster it is, the heavier the burn to get captured.",
  "天体の重力を振り切った後に残る速さ": "The speed left after breaking free of the body's gravity",
  "投入ΔV": "Insertion ΔV",
  "軌道のつぶれ具合。0で真円、1に近いほど細長い":
    "How stretched the orbit is. 0 is a perfect circle; closer to 1 is longer and thinner.",

  /* 大気圏突入 */
  "突入角 γ [deg]": "Entry angle γ [deg]",
  "地平線から測った、大気に入るときの傾き (下向きが負)。\n無事に降りられるのは、おおむね {lo} 〜 {hi} 度。\n浅すぎると大気に弾き返されて宇宙へ戻り、深すぎると熱と減速に耐えられない。\n角度を変えても、突入の速さそのものは変わらない。":
    "The tilt on entry, measured from the horizon (downward is negative).\n" +
    "You can get down safely at roughly {lo} to {hi} degrees.\n" +
    "Too shallow and the atmosphere throws you back into space; too steep and the heat and deceleration are too much.\n" +
    "Changing the angle does not change the entry speed itself.",
  "速いほど熱に耐えるのが難しくなります (地球に帰るカプセルでの目安)\n11.2未満: アポロの帰還と同じくらい。すでに実績のある速さ\n12.9未満: スターダスト (人類が経験した最速) まで\n16未満: 土星のあたりから帰る想定で研究されている範囲。機体はまだ無い\n16以上: 研究でも想定されていない速さ":
    "The faster you come in, the harder the heat is to survive (a guide for capsules returning to Earth)\n" +
    "under 11.2: about the same as Apollo's return. A speed already flown.\n" +
    "under 12.9: up to Stardust, the fastest re-entry any human-made object has made\n" +
    "under 16: the range studied for returns from around Saturn. No vehicle exists yet.\n" +
    "16 and above: a speed not even studied",
  "実績あり": "flown",
  "実績内": "within experience",
  "要開発": "needs development",
  "想定外": "beyond study",
  "突入速度": "Entry speed",
  "突入角 γ": "Entry angle γ",
  "浅すぎると弾き返され、深すぎると熱と減速が厳しくなる":
    "Too shallow and you skip back out; too steep and the heat and deceleration get severe",
  "天体の重力に引かれる前の速さ": "The speed before the body's gravity pulls you in",
  "突入高度": "Entry altitude",
  "ここから大気に入ったとみなす高さ": "The altitude taken as the start of the atmosphere",

  /* スイングバイ */
  "(下限)": "(at the floor)",
  "入ってくる V∞": "Incoming V∞",
  "この天体から見た、近づいてくる速さ。曲げられる角度はこれで決まる":
    "How fast you come in, as seen from this body. It sets how far your path can bend.",
  "出ていく V∞": "Outgoing V∞",
  "この天体から見た、離れていく速さ。噴かなければ入りと同じ大きさになる":
    "How fast you leave, as seen from this body. Without a burn it matches the incoming speed.",
  "曲げ角": "Turn angle",
  "重力で進む向きがどれだけ曲がるか": "How far gravity bends your direction of travel",
  "近点高度": "Periapsis altitude",
  "天体の表面からいちばん近づく高さ。低いほど大きく曲がる":
    "The lowest altitude above the surface. Lower means a bigger bend.",
  "重力だけでは足りないぶんを、いちばん近づく点で噴いて補う量":
    "The burn at closest approach that makes up what gravity alone cannot bend",
  "曲げきれない角度": "Bend gravity cannot supply",
  "この高さでは重力だけで曲げきれない角度。噴射で補うので近点ΔVが重くなる":
    "The part of the turn gravity cannot manage at this altitude. A burn covers it, so the periapsis ΔV grows.",
  "次の": "Next ",
  "前後の区間が決まると自動で計算されます": "Computed automatically once the legs on both sides are set",
  "回転角 β [deg]": "Rotation angle β [deg]",
  "天体のどちら側を回り込むか。曲がる向きが変わる":
    "Which side of the body you go around. It changes which way you bend.",
  "下限 {km} km (大気・放射線帯)": "Floor {km} km (atmosphere and radiation belts)",
  "通り過ぎる V∞": "Pass-by V∞",
  "この天体から見た速さ。噴かないので入りと出は同じ大きさで、\n曲げられる角度はこの速さと近点高度だけで決まる":
    "The speed as seen from this body. With no burn, in and out match,\n" +
    "and the bend follows from this speed and the periapsis altitude alone.",
  "天体の中心から測った距離": "Distance measured from the body's centre",

  /* 高度な情報・道具 */
  "高度な情報": "More detail",
  "設計を確かめるときに使う細かい読み取り": "Fine readouts for checking a design",
  "これ以上は戻せません": "Nothing further to undo",
  "やり直せる操作はありません": "Nothing to redo",

  /* 自動調整 */
  "いまの設計を出発点に、残る質量がいちばん多くなるよう\n日付やスイングバイのパラメータを調整します\n(いまの設計の近くだけを探すので、軌道の骨格は変わりません)":
    "Starting from the current design, adjusts dates and swingby settings\n" +
    "so that the mass left is as large as possible\n" +
    "(it only searches nearby, so the shape of the trajectory does not change)",
  "シーケンスが2つ以上あると調整できます": "Tuning needs two or more sequences",
  "調整中…": "Tuning…",
  "調整中 +{pct}%": "Tuning +{pct}%",
  "計算に失敗しました": "The computation failed",
  "調整できませんでした": "Could not tune",
  "成り立つ設計が見つかりませんでした ({reason})": "No workable design was found ({reason})",
  "これ以上は良くなりませんでした": "It could not be improved further",
  "調整した結果を反映できませんでした": "The tuned result could not be applied",
  "総ΔVが {before} → {after} km/s になりました (この設計ではまだ質量が残りません)":
    "Total ΔV went {before} → {after} km/s (this design still leaves no mass)",
  "残る質量が {before} → {after} kg (+{pct}%) になりました": "Mass left went {before} → {after} kg (+{pct}%)",
  "使える設計に直しました (残る質量 {kg} kg)": "Fixed it into a workable design ({kg} kg left)",
  "消したいシーケンスを選んでください": "Pick the sequences you want to delete",
  "出発日と到着日の地図は、次の天体が決まっている自動モードのシーケンスで出せます":
    "The departure/arrival map opens on an auto-mode sequence whose next body is set",

  /* ================================================================
     ロケットの表 (js/core/launchers.js)
     ================================================================ */
  "H3-24形態": "H3-24",
  "H3-22形態": "H3-22",
  "M-V + キックステージ": "M-V + kick stage",
  "イプシロンS + キックステージ": "Epsilon S + kick stage",
  "Ariane 5 (赤緯自由)": "Ariane 5 (free declination)",
  "Atlas V 551 + キックステージ": "Atlas V 551 + kick stage",
  "参考値。C3に対する近似式で、赤緯依存は見ていない":
    "Indicative. A fit against C3; declination is not taken into account.",
  "参考値。固体ロケットM-Vに上段を足した構成。C3に対する近似式":
    "Indicative. The solid-fuel M-V with an upper stage added. A fit against C3.",
  "参考値。小型固体ロケットに上段を足した構成。C3に対する近似式":
    "Indicative. A small solid rocket with an upper stage added. A fit against C3.",
  "クールー射場。Ariane 6ユーザーズマニュアル等に基づく推定値":
    "From Kourou. Estimated from the Ariane 6 user's manual and related sources.",
  "クールー射場。ExoMars検討時にArianespaceからESOCへ提供された値":
    "From Kourou. Figures Arianespace provided to ESOC during the ExoMars studies.",
  "各C3で表の中の物理的な値(>100kg)の最大を取った包絡。赤緯を選べる前提の比較用で、特定の赤緯へ飛ばせることを意味しない":
    "An envelope taking, at each C3, the largest physical entry (>100 kg) in the table. " +
    "For comparison only, assuming a free choice of declination; it does not mean any given declination can be flown.",
  "ケープカナベラル射場": "From Cape Canaveral.",
  "New Horizonsの構成 (上段は固体の Star 48B)。Atlas単体の表と Star 48B のΔVの釣り合いから逆算した推定で、公式の打上げ能力ではない。妥当なのはC3 60〜220 km²/s²の範囲":
    "The New Horizons stack (a solid Star 48B on top). Worked back from the Atlas-only table " +
    "and the Star 48B's ΔV; not an official capability. It holds for C3 between 60 and 220 km²/s².",
  "赤緯依存は表に無く、V∞のみの1次元モデル":
    "The table has no declination dependence; a one-dimensional model in V∞ alone.",
  "バイコヌール射場": "From Baikonur.",
  "使い捨て形態・ケープカナベラル射場。赤緯依存は公表が無く、V∞のみの1次元モデル":
    "Expendable configuration, from Cape Canaveral. No published declination dependence; " +
    "a one-dimensional model in V∞ alone.",

  /* 天体の分類 (data/bodies/*.json が持つ名前) */
  "取り込んだ天体": "Bodies you added",
  "一覧 (消せます)": "The list (you can remove them)",
  "よく使う天体": "Common bodies",
  "すべての天体": "All bodies",
  "探査機が訪れた": "Visited by spacecraft",
  "近づきやすい小惑星": "Easy-to-reach asteroids",
  "これからの目標": "Future targets",
  "ケンタウルス": "Centaurs",
  "準惑星・太陽系外縁天体": "Dwarf planets and trans-Neptunian objects",
  "有名な彗星": "Well-known comets",
  "大きい小惑星": "Large asteroids",
  "木星トロヤ群": "Jupiter Trojans",
  "恒星間天体": "Interstellar objects",
  "地球接近天体": "Near-Earth objects",
  "彗星": "Comets",
  "遠方天体": "Distant objects",
  "名前付き小惑星": "Named asteroids",
  "探査機が訪れた天体や、名前の通った大きな天体":
    "Bodies visited by spacecraft, and large well-known ones",
  "太陽系の外から来た天体。双曲線軌道で二度と戻らない":
    "Bodies from outside the solar system. On hyperbolic orbits, never to return.",
  "地球の軌道に近づく小惑星。到達しやすい目標が多い":
    "Asteroids that come near Earth's orbit. Many are easy to reach.",
  "周期彗星と非周期彗星": "Periodic and non-periodic comets",
  "木星以遠のケンタウルス・太陽系外縁天体・準惑星":
    "Centaurs, trans-Neptunian objects, and dwarf planets beyond Jupiter",
  "上のどれにも入らない、名前の付いた小惑星と大きな小惑星":
    "Named and large asteroids that fall into none of the above",

  /* ================================================================
     天体を追加 (js/ui/body_picker.js)
     ================================================================ */
  "名前・番号・仮符号で検索 (例: Ryugu / 162173 / 1999 JU3)":
    "Search by name, number, or designation (e.g. Ryugu / 162173 / 1999 JU3)",
  "天体を選んでください": "Pick a body",
  "追加": "Add",
  "読み込み中…": "Loading…",
  "{n} 件 ({mb} MB)": "{n} entries ({mb} MB)",
  "軌道要素を入力して追加": "Add by entering orbital elements",
  "掲載されていない天体を、自分で用意した軌道要素から追加する":
    "Add a body that is not listed, from orbital elements you supply",
  "「{name}」を読み込み中… ({mb} MB)": "Loading “{name}”… ({mb} MB)",
  "読み込めませんでした: {why}": "Could not load: {why}",
  "取り込んだ天体はまだありません": "You have not added any bodies yet",
  "該当する天体がありません": "No bodies match",
  "{title} {n} 件": "{title} — {n}",
  "先頭 {n} 件を表示。検索で絞り込めます": "Showing the first {n}. Use the search box to narrow it down.",
  "放物線": "Parabolic",
  "双曲線": "Hyperbolic",
  "{kind}軌道。太陽系を離れるので、次の機会は無い":
    "{kind} orbit. It leaves the solar system, so there is no second chance.",
  "a: 軌道の大きさ / e: 軌道のつぶれ具合 (0で真円) / i: 軌道の傾き":
    "a: size of the orbit / e: how stretched it is (0 is a circle) / i: its tilt",
  "q: 太陽にいちばん近づく距離 / e: 軌道のつぶれ具合 / i: 軌道の傾き":
    "q: closest distance to the Sun / e: how stretched the orbit is / i: its tilt",
  "周期 {n}年": "Period {n} yr",
  "周期 —": "Period —",
  "取り込み済み": "added",
  "外す": "Remove",
  "「{name}」を天体の一覧から外す": "Remove “{name}” from the body list",
  "掲載されていない天体を、軌道要素から直接追加します。元期・近日点通過はユリウス日(JD)で入力してください。":
    "Add a body that is not listed, straight from its orbital elements. " +
    "Give the epoch and perihelion passage as Julian dates (JD).",
  "分類": "Kind",
  "小惑星": "Asteroid",
  "彗星・恒星間天体": "Comet or interstellar object",
  "符号・仮符号": "Designation",
  "例: 2020 XL5": "e.g. 2020 XL5",
  "名前 (任意)": "Name (optional)",
  "例: Ryugu": "e.g. Ryugu",
  "離心率 e": "Eccentricity e",
  "軌道傾斜角 i [deg]": "Inclination i [deg]",
  "昇交点黄経 Ω [deg]": "Longitude of ascending node Ω [deg]",
  "近日点引数 ω [deg]": "Argument of perihelion ω [deg]",
  "軌道長半径 a [AU]": "Semi-major axis a [AU]",
  "平均近点角 M [deg]": "Mean anomaly M [deg]",
  "元期 [JD]": "Epoch [JD]",
  "近日点距離 q [AU]": "Perihelion distance q [AU]",
  "近日点通過 [JD]": "Perihelion passage [JD]",
  "絶対等級 H (任意)": "Absolute magnitude H (optional)",
  "番号 (任意)": "Number (optional)",
  "この内容で追加": "Add with these values",
  "符号・仮符号か番号のどちらかは入力してください": "Enter either a designation or a number",
  "軌道要素が読み取れません。数値が入っていない欄がないか確認してください":
    "The orbital elements cannot be read. Check that no field is left blank.",
  "「{name}」を選びました": "Selected “{name}”",
  "近日点 {au} AU": "Perihelion {au} AU",
  "周期 {n} 年": "Period {n} yr",
  "太陽系を離れる軌道": "An orbit that leaves the solar system",
  " ・ ": " · ",
  "「{name}」を選びました (軌道への取り込みは次の段階)": "Selected “{name}” (adding it to the trajectory comes next)",
  "左から分類を選ぶか、上の欄で検索してください": "Pick a kind on the left, or search in the box above",
  "「{q}」の検索結果": "Results for “{q}”",
  "ほかの天体も読み込んで検索中…": "Loading the other sets and searching…",
  "読み込み中 {name} ({i}/{n})": "Loading {name} ({i}/{n})",
  "天体のデータを読み込めませんでした: {why}": "Could not load the body data: {why}",

  /* ================================================================
     ポークチョップ図 (js/ui/porkchop.js)
     ================================================================ */
  "打上げエネルギー##図の色": "Launch energy",
  "到着の速さ": "Arrival speed",
  "出発と到着の合計": "Departure plus arrival",
  "押すとその日付になります / ドラッグで移動 / ホイールで拡大縮小":
    "Click to take those dates / drag to pan / wheel to zoom",
  "到着 {date}": "Arrival {date}",
  "{days}日": "{days} d",
  "出発日": "Departure date",
  "到着日": "Arrival date",
  "以上": "and up",
  "出発日と到着日の地図": "Departure and arrival map",
  "出発日 (横) と到着日 (縦) の組み合わせを片っ端から解いて、\nどれくらい楽に行けるかを色で塗った地図です。青いところほど楽に行けます。\n軌道設計では「ポークチョップ図」と呼ばれています。":
    "Solves every combination of departure date (across) and arrival date (up),\n" +
    "and colours in how easy each one is. Bluer is easier.\n" +
    "In trajectory design this is called a porkchop plot.",
  "図の色が何を表すかを選びます\n打上げエネルギー: 出発の負担。小さいほど重い探査機を打ち上げられる\n到着の速さ: 目的地に着くときの速さ。小さいほど、着いてからの減速が楽\n出発と到着の合計: 行きと着きの両方をまとめて見たいとき":
    "Choose what the colours show\n" +
    "Launch energy: the cost of leaving. Smaller means a heavier spacecraft can be launched.\n" +
    "Arrival speed: how fast you arrive. Smaller means less slowing down once you get there.\n" +
    "Departure plus arrival: when you want to weigh both ends together.",
  "周回 自動": "Revs: auto",
  "周回 直行": "Revs: direct",
  "周回 1周": "Revs: 1",
  "周回 2周": "Revs: 2",
  "太陽を何周してから着く行き方を見るかを選びます。\n自動: 点ごとに、いちばん安く行ける周回数を採る (点線がその境目)\n固定すると、その周回数だけの地図になります":
    "Choose how many times around the Sun to consider.\n" +
    "Auto: at each point, take whichever number of revolutions is cheapest (the dotted line is the boundary)\n" +
    "Fix it, and the map shows only that number.",
  "日##ポークチョップの単位": "d",
  "出発 ±": "Departure ±",
  "横軸に映す出発日の幅 (真ん中から前後この日数)": "How wide a span of departure dates to show (this many days either side of centre)",
  "到着 ±": "Arrival ±",
  "縦軸に映す到着日の幅 (真ん中から前後この日数)": "How wide a span of arrival dates to show (this many days either side of centre)",
  "粗い": "Coarse",
  "標準": "Normal",
  "細かい": "Fine",
  "図の細かさ。細かいほど計算に時間がかかります": "How fine the grid is. Finer takes longer to compute.",
  "色合わせ": "Rescale colours",
  "いま映っている範囲に合わせて、色を塗り直します。\n拡大しても色の段階はそのままなので、拡大したら一面同じ色になった、\nというときに押してください。":
    "Reassigns the colours to the range now in view.\n" +
    "Zooming keeps the old colour scale, so press this if\n" +
    "zooming in left everything one flat colour.",
  "範囲を戻す": "Reset the range",
  "最初に映していた、行きやすい時期のまわりに戻します": "Back to the easy-to-fly period it started on",
  "{dep} : この天体に着くのが {min} なので、まだ出発できません":
    "{dep} : you only reach this body on {min}, so you cannot leave yet",
  "{dep} → {arr} : この組み合わせでは飛べません": "{dep} → {arr} : this combination cannot be flown",
  "{dep} → {arr} (飛行 {tof}日{rev}) ・ 打上げ {c3} km²/s² ・ 到着 {varr} km/s":
    "{dep} → {arr} ({tof} d in flight{rev}) · launch {c3} km²/s² · arrival {varr} km/s",
  " ・ {n}周": " · {n} rev",
  " ・ 押すとこの日付にします": " · click to take these dates",
  "色は{metric} [{unit}] ・ ◇ いちばん安い点 / 破線 いまの設定 / 灰色 高すぎるところ":
    "Colour is {metric} [{unit}] · ◇ cheapest point / dashed, the current setting / grey, too expensive",
  " / 斜線 まだ出発できないところ": " / hatched, you cannot leave yet",
  "周回数は点ごとにいちばん安いものを採用 (点線がその境目)":
    "At each point the cheapest number of revolutions is used (the dotted line is the boundary)",
  "直行のみ": "Direct only",
  "{n}周のみ": "{n} revolutions only",
  "{cols}×{rows} 点のうち {solved} 点で行き方が見つかりました":
    "A route was found at {solved} of {cols}×{rows} points",
  "計算中…": "Computing…",
  "計算 {ms} ms": "Computed in {ms} ms",

  /* ================================================================
     保存と読込 (js/mission/mission_file.js)
     ================================================================ */
  "保存するシーケンスがありません": "There are no sequences to save",
  "「{name}」を保存しました": "Saved “{name}”",
  "いまのミッション「{name}」はまだ保存されていません。\nこのまま{action}と、ここまでの設計は失われます。":
    "The current mission, “{name}”, has not been saved.\n" +
    "If you {action} now, the design so far will be lost.",
  "保存せずに{action}": "{action} without saving",
  "読み込めませんでした (JSONとして解釈できません)": "Could not load it (it is not readable as JSON)",
  "ファイルを読めませんでした": "Could not read the file",
  "このアプリの保存ファイルではないようです": "This does not look like a save file from this app",
  "新しい版のファイルです。読めない項目があるかもしれません":
    "This file is from a newer version. Some fields may not be readable.",
  "読み込めませんでした (シーケンスが入っていません)": "Could not load it (it contains no sequences)",
  "「{name}」を読み込みました": "Loaded “{name}”",
  "ミッション": "mission",

  /* ================================================================
     共有 (js/mission/share_link.js)
     ================================================================ */
  "共有するシーケンスがありません": "There are no sequences to share",
  "共有リンクをコピーしました": "Copied the share link",
  "コピーできませんでした (アドレス欄からURLを控えてください)":
    "Could not copy (take the URL from the address bar instead)",
  "共有リンクを読み取れませんでした": "Could not read the share link",
  "リンクのミッションを開く": "open the mission from the link",
  "共有リンクのミッションを開けませんでした": "Could not open the mission from the share link",
  "共有リンクからミッションを開きました": "Opened the mission from a share link",
  "#だれでも軌道設計 でミッションを作成しました": "Designed a mission with #AnyoneTrajectoryDesign",
  "Xの投稿画面を開きます": "Opening the post window on X",
  "本文と共有リンクを入れた状態で開きます。\n\n画像はクリップボードにコピーしました。投稿欄で貼り付け (Ctrl+V) してください。":
    "It opens with the text and the share link already filled in.\n\n" +
    "The image has been copied to the clipboard. Paste it into the post (Ctrl+V).",
  "本文と共有リンクを入れた状態で開きます。\n\n画像はコピーできませんでした。付けたいときは「画像で保存」で保存してから、投稿欄に落としてください。":
    "It opens with the text and the share link already filled in.\n\n" +
    "The image could not be copied. If you want one, use “Save as image” and drop the file into the post.",
  "開く": "Open",

  /* ================================================================
     画像で保存 (js/mission/export_image.js)
     ================================================================ */
  "期間 {duration}": "Duration {duration}",
  "画像にするシーケンスがありません": "There are no sequences to draw",
  "太陽系ビューがまだ準備できていません": "The solar-system view is not ready yet",

  /* ================================================================
     自動調整の中身 (js/opt/*)
     ================================================================ */
  "シーケンスが2つ以上ないと調整できません": "Tuning needs two or more sequences",
  "ミッションを複製できませんでした": "Could not duplicate the mission",
  "動かせるところがありません": "There is nothing that can be adjusted",
  "ノードが2つ未満": "fewer than two nodes",
  "総ΔVが求まらない": "the total ΔV cannot be found",
  "打上げのV∞が求まらない": "the launch V∞ cannot be found",
  "{i}番のノードで軌道が繋がっていない": "the trajectory does not connect at node {i}",
  "この脱出速度はロケットの能力を超えている": "this escape velocity is beyond the rocket's capability",
  "最終質量が求まらない": "the final mass cannot be found",

  /* ================================================================
     そのほか
     ================================================================ */
  "見ている時刻": "Time in view",
  "太陽方向": "Toward the Sun",
  "{path} が読めません ({status})": "Cannot read {path} ({status})",
  "知らないまとまり: {name}": "Unknown set: {name}",
  "変更##種別を選ぶ": "Change",
};
