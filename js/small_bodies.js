import { State } from './state.js';
import { AU, PLANET_COUNT, setSmallBodyProvider, setBodyConstants } from './trajectory.js';
import { bodyConic, bodyLabel } from './bodies.js';

// 取り込んだ小天体の置き場。
//
// アプリ全体は天体を「番号」で扱う (State.planet_list の添字。0=水星 … 8=冥王星)。
// 取り込んだ小天体はその続きに番号を振る。こうすると、天体の一覧・軌道の描画・
// シーケンスの割り当てといった既存の仕組みが、そのままの形で小天体にも効く。
//
// 軌道要素は trajectory.js に「口」を登録して渡す (setSmallBodyProvider)。
// 物理量 (重力定数・半径) は番号で引く表に足す (setBodyConstants)。

// --- 大きさと重さの見積もり ---
// MPCが配るのは絶対等級 H だけなので、直径と質量は仮定を置いて見積もる。
// 探査の当たりを付けるための桁合わせで、実際の値とは倍半分ずれうる。
const DEFAULT_ALBEDO = 0.15; // 岩石質の小惑星のよくある値
const DEFAULT_DENSITY = 2000; // [kg/m^3] 空隙の多いラブルパイルを想定
const COMET_DIAMETER_KM = 2; // 彗星のHは全光度 (コマ込み) なので核の大きさは出せない
const UNKNOWN_DIAMETER_KM = 1;
const G = 6.674e-20; // [km^3 kg^-1 s^-2]

const registered = []; // 番号 - PLANET_COUNT の順に並ぶ

/** 絶対等級から直径 [km] を見積もる */
export function estimateDiameterKm(body) {
  if (body.kind !== "asteroid") return COMET_DIAMETER_KM;
  if (body.H == null) return UNKNOWN_DIAMETER_KM;
  return (1329 / Math.sqrt(DEFAULT_ALBEDO)) * Math.pow(10, -0.2 * body.H);
}

/** 直径 [km] から重力定数 mu [km^3/s^2] を見積もる */
export function estimateMu(diameter_km) {
  const volume_m3 = (Math.PI / 6) * Math.pow(diameter_km * 1000, 3);
  return G * DEFAULT_DENSITY * volume_m3;
}

export function smallBodyBase() {
  return PLANET_COUNT;
}

export function isSmallBody(n) {
  return typeof n === "number" && n >= PLANET_COUNT;
}

/** 天体番号から、取り込んだ小天体を引く (惑星なら null) */
export function smallBody(n) {
  return isSmallBody(n) ? registered[n - PLANET_COUNT] ?? null : null;
}

export function smallBodies() {
  return registered.slice();
}

/** 取り込み済みの天体を id で探す。番号を返す (無ければ -1) */
export function smallBodyNumber(id) {
  const i = registered.findIndex((b) => b.id === id);
  return i < 0 ? -1 : PLANET_COUNT + i;
}

/**
 * 小天体を取り込んで天体番号を返す。
 * すでに入っているものは番号をそのまま返す (二重には入れない)。
 *
 * @param {object} body js/bodies.js が返す天体
 * @returns {{num: number, added: boolean}}
 */
export function addSmallBody(body) {
  const exist = smallBodyNumber(body.id);
  if (exist >= 0) return { num: exist, added: false };

  const num = PLANET_COUNT + registered.length;
  const diameter = estimateDiameterKm(body);
  const radius = diameter / 2;

  registered.push({
    id: body.id,
    kind: body.kind,
    label: bodyLabel(body),
    body,
    conic: bodyConic(body), // {q[km], e, i, node, peri, tp}
    diameter,
    mu: estimateMu(diameter),
  });

  State.planet_list[num] = bodyLabel(body);
  State.planet_num = State.planet_list.length;
  setBodyConstants(num, {
    mu: estimateMu(diameter),
    radius,
    // 表面すれすれは現実的でないので、半径の1割か1kmの大きい方を最低高度にする
    min_altitude: Math.max(radius * 0.1, 1),
    entry_altitude: 0, // 大気は無い
  });
  return { num, added: true };
}

/** すべて取り込み直す (ミッションを読み込んだとき用)。天体番号は並び順で決まる */
export function resetSmallBodies(list) {
  registered.length = 0;
  State.planet_list.length = PLANET_COUNT;
  State.planet_num = PLANET_COUNT;
  for (const b of list || []) addSmallBody(b);
}

/** 保存用の素の値 (天体の中身をそのまま持たせる) */
export function smallBodiesForSave() {
  return registered.map((r) => r.body);
}

// 軌道要素を trajectory.js に渡す口。天体番号で引かれる
setSmallBodyProvider((n) => {
  const b = smallBody(n);
  return b ? b.conic : null;
});
