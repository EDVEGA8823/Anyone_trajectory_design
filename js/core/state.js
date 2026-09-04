import { DateToJulian } from './trajectory.js';

export const User_Mode = {
  None: 0,
  Select: 1,
};

export const Sequence_Type = {
  None: "---",
  Launch: "打上げ",
  Swingby: "スイングバイ",
  Flyby: "フライバイ",
  Orbit: "周回軌道投入",
  // 周回軌道投入したあと、同じ天体の周回軌道から再び飛び出す節。
  // サンプルリターンのように「行って、回って、帰る」ミッション用。
  Escape: "軌道脱出",
  // 天体の大気圏に突入してミッションを終える節。地球への試料回収 (帰還) にも、
  // 火星着陸機や金星探査機の突入にも同じ計算が使えるので、天体を選ばない名前にする。
  Entry: "大気圏突入",
  Rendezvous: "ランデブー",
  // ランデブーした天体から再び飛び立つ節。周回軌道投入に対する軌道脱出と同じ
  // 位置づけで、天体に張り付いている状態から次の目的地へ向かうΔVを持つ。
  Departure: "再出発",
  Maneuver: "マヌーバ",
  // 目的地を持たずにミッションを終える節。ここまでで到達した太陽中心軌道
  // (太陽周回軌道や太陽系脱出軌道) そのものが成果になるミッション用。
  End: "最終軌道",
};

export const State = {
  is_change_time: false,
  raycaster: new THREE.Raycaster(),
  mouse: new THREE.Vector2(),

  // ドラッグ中に掴んでいる軌道。掴んだ瞬間に固定して、離すまで使い回す。
  // { elements, base_date, t_base, samples, E_prev } (js/orbit_pick.js)
  drag_orbit: null,

  tmp_date: DateToJulian(new Date()),
  old_date: 0, // will be initialized to tmp_date next
  planet_num: 9,
  planet_elements: [],

  planet_list: ["水星", "金星", "地球", "火星", "木星", "土星", "天王星", "海王星", "冥王星"],
  dates: [],
  planets: [2],
  arcs: [],

  mission_sequence: null, // will be initialized after Mission class is imported

  selected_planet: 3,
  selected_sequence: -1,
  // 投入可能質量を見積もる打上げロケット (js/launchers.js のid)
  launcher: "h3_24",
  // チェックボックスでまとめて操作するために選んでいるノードの番号。
  // 選択中シーケンス(selected_sequence)とは別の概念で、複数を保持する。
  // 添字で持っているので、ノードの増減があったときは clear_checks() で解除する。
  checked: new Set(),
  // B面ビューでマウスで動かせるようにしている手動スイングバイのパラメータ
  // (null | "rp" | "beta")。右側の該当する欄を選ぶと立つ。
  swingby_handle: null,
  // 打上げビューでマウスで動かせるようにしているパラメータ
  // (null | "vinf" | "alpha" | "delta")。
  launch_handle: null,
  // 周回軌道ビューでマウスで動かせるようにしているパラメータ
  // (null | "rp" | "ra")。
  orbit_handle: null,
  // 軌道脱出の遠景ビュー(手動モード)でマウスで動かせるようにしているパラメータ
  // (null | "vinf" | "alpha" | "delta")。打上げビューと同じ流儀。
  escape_handle: null,
  // 再出発ビュー(手動モード)でマウスで動かせるようにしているパラメータ
  // (null | "vinf" | "alpha" | "delta")。軌道脱出と同じ流儀。
  departure_handle: null,
  // 大気圏突入ビューでマウスで動かせるようにしているパラメータ (null | "gamma")。
  entry_handle: null,
  // マヌーバビューでマウスで動かせるようにしているパラメータ
  // (null | "dv" | "alpha" | "delta")。
  dsm_handle: null,
  // 時刻編集の対象ノード。通常は selected_sequence と同じだが、選択中ノードの
  // 前後のマーカーを掴むとそのノードに切り替わる(選択自体は動かさない)。
  editing_sequence: -1,
  is_selected: false,

  mode: User_Mode.None,
};
State.old_date = State.tmp_date;
State.dates = [State.tmp_date];

// Plot related states
export const PlotState = {
  orbit_lines: [],
  planet_speres: [],
  camera_dist: 7,

  width: 630,
  height: 700,

  marker_spheres: [],
  marker_lines: [],
  coast_line: undefined, // マヌーバ未実行時の軌道(赤い破線)
};
