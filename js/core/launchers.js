// 打上げ機が脱出軌道へ送り込める質量の表と、その補間。
//
// 表データと補間の仕方は pykep の pykep/trajopt/_launchers.py
// (Copyright (c) 2023-2026 Dario Izzo / Advanced Concepts Team, ESA)
// をそのまま移植したもの。SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// 表は「脱出双曲線余剰速度 V∞ [km/s]」と「その向きの赤緯 DLA [deg]」に対して
// 投入できる質量 [kg] を与える。pykep側は kx=ky=1 の RectBivariateSpline
// (=双一次補間) と線形の interp1d を使っているので、こちらも同じ補間にしてある。
// 表の中の極端に小さい値 (1e-3〜10 kg 程度) は「そこへは飛ばせない」ことを
// 表す番兵で、実際の投入能力ではない (元データで負の値だったところ)。

// H3の投入能力は表ではなく、C3 [km^2/s^2] に対する近似式で与える。
//   質量 = A * exp(-(sqrt(C3 + 119.37529) - 10.9259) / 4.39338) - 5012.14
// C3=0 で H3-24形態は 6000 kg、H3-22形態は 4090 kg になる係数。
// 式が0を下回るC3から先は「その機体では届かない」扱いにする。
const H3_B = 5012.14;
const H3_C = 119.37529;
const H3_D = 10.9259;
const H3_E = 4.39338;
const h3_mass = (A) => (c3) => A * Math.exp(-(Math.sqrt(c3 + H3_C) - H3_D) / H3_E) - H3_B;
// 質量が0になるV∞ (上の式をC3について解いたもの)
const h3_vinf_max = (A) => {
  const u = -H3_E * Math.log(H3_B / A) + H3_D;
  return Math.sqrt(Math.max(u * u - H3_C, 0));
};

// --- Atlas V 551 + Star 48B (New Horizonsの構成) ---
// 上段に固体キックステージ Star 48B を積んだ3段構成。New Horizonsはこれで
// C3 = 157.75 km^2/s^2 を出しており、Atlas単体の表 (C3 = 1〜60) だけでは
// 届かない領域に相当する。
//
// 「Atlasが出せるC3」と「Star 48Bが足すΔV」の釣り合いから、探査機質量 m を逆算する。
//   Star 48BのΔV : dv(m) = Isp * g0 * ln((m + mw) / (m + md))
//   噴射前の速度  : v0 = sqrt(C3 + 2mu/r) - dv(m)
//   Atlasが出すC3 : C3pre = v0^2 - 2mu/r
//   釣り合いの条件: atlas551(C3pre) = m + mw + mAux   (探査機 + Star 48B + 付随機器)
// mが増えると dv は減り C3pre は増え、Atlasの能力(左辺)は減る一方で右辺は増えるので、
// 解は一意になる (二分法で挟み込む)。
// Atlas単体の表は外挿しないので、C3preが 1〜60 に収まる範囲でのみ解を認める。
//
// New Horizonsの実績で較正した工学的な代用モデルであって、公式の打上げ能力ではない。
const STAR48B = {
  mw: 2140.5, // Star 48Bのウェット質量 [kg]
  md: 130.6, // 同ドライ質量 [kg]
  isp: 292.1, // 比推力 [s]
  m_aux: 298.03853, // 付随機器 (支持構造など) [kg]
  g0: 0.00980665, // [km/s^2]
  mu: 398600.4418, // 地球の重力定数 [km^3/s^2]
  r: 6378.137 + 320, // 噴射する高度の地心距離 [km]
};
const ATLAS551_C3_MIN = 1; // 元の表の範囲。ここから外へは外挿しない
const ATLAS551_C3_MAX = 60;
const STAR48B_C3_MIN = 60; // この構成で見積もりが妥当な最終C3の範囲
const STAR48B_C3_MAX = 220;
const STAR48B_M_MAX = 20000; // 探査機質量の探索上限 [kg]

// Atlas V 551 単体の能力を C3 で引く (表はV∞に対する線形補間なので√を取る)
function atlas551_at_c3(c3) {
  const L = LAUNCHERS.atlas551;
  const v = locate(L.vinfs, Math.sqrt(c3));
  return lerp(L.data[v.i], L.data[v.i + 1], v.t);
}

// f(lo) と f(hi) の符号が違う区間から f = 0 の点を挟み込む。
// 符号が変わらない (=解が無い) ときは undefined。
function bisect(f, lo, hi, steps = 200) {
  let f_lo = f(lo);
  let f_hi = f(hi);
  if (f_lo === 0) return lo;
  if (f_hi === 0) return hi;
  if (!(f_lo < 0) === !(f_hi < 0)) return undefined; // 同符号
  for (let k = 0; k < steps; k++) {
    const mid = 0.5 * (lo + hi);
    const f_mid = f(mid);
    if (f_mid === 0) return mid;
    if (!(f_mid < 0) === !(f_lo < 0)) {
      lo = mid;
      f_lo = f_mid;
    } else {
      hi = mid;
      f_hi = f_mid;
    }
  }
  return 0.5 * (lo + hi);
}

/**
 * Atlas V 551 + Star 48B が最終C3へ送り込める探査機質量 [kg]。
 * 送り込めない場合は0。
 * @param {number} c3 最終的なC3 [km^2/s^2]
 */
export function atlas551Star48B(c3) {
  if (!isFinite(c3)) return 0;
  const e2 = (2 * STAR48B.mu) / STAR48B.r; // 脱出速度の2乗
  const vf = Math.sqrt(c3 + e2);
  const ve = STAR48B.isp * STAR48B.g0; // 有効排気速度 [km/s]

  // 探査機質量mのときにAtlasが出さねばならないC3 (mについて単調増加)。
  // ΔVが噴射前の速度を上回る (=そもそも成り立たない) 場合は下限外として扱う。
  const c3_pre = (m) => {
    const v0 = vf - ve * Math.log((m + STAR48B.mw) / (m + STAR48B.md));
    return v0 > 0 ? v0 * v0 - e2 : -Infinity;
  };

  // Atlasの表を外挿しない範囲 (C3pre = 1〜60) に対応する質量の窓
  const m_lo =
    c3_pre(0) >= ATLAS551_C3_MIN ? 0 : bisect((m) => c3_pre(m) - ATLAS551_C3_MIN, 0, STAR48B_M_MAX);
  const m_hi =
    c3_pre(STAR48B_M_MAX) <= ATLAS551_C3_MAX
      ? STAR48B_M_MAX
      : bisect((m) => c3_pre(m) - ATLAS551_C3_MAX, 0, STAR48B_M_MAX);
  if (m_lo == undefined || m_hi == undefined || !(m_hi > m_lo)) return 0;

  // 釣り合いの式 (mについて単調減少)
  const balance = (m) => atlas551_at_c3(c3_pre(m)) - (m + STAR48B.mw + STAR48B.m_aux);
  if (balance(m_lo) < 0) return 0; // 一番軽い成立点でも能力が足りない
  if (balance(m_hi) > 0) return m_hi; // 表の範囲(C3pre<=60)で頭打ち。ここまでは確実に積める
  return bisect(balance, m_lo, m_hi) ?? 0;
}

// --- 打上げ機ごとの表 ---
// 2次元の表は decls を持ち、1次元の表 (赤緯依存が公表されていないもの) は持たない。
// formula を持つものは表ではなく近似式で与える。
const LAUNCHERS = {
  h3_24: {
    label: "H3-24形態",
    note: "参考値。C3に対する近似式で、赤緯依存は見ていない",
    formula: h3_mass(11012.14),
    vinf_max: h3_vinf_max(11012.14),
    source_mode: "extrapolated",
    confidence: "reference",
  },
  h3_22: {
    label: "H3-22形態",
    note: "参考値。C3に対する近似式で、赤緯依存は見ていない",
    formula: h3_mass(9102.14),
    vinf_max: h3_vinf_max(9102.14),
    source_mode: "extrapolated",
    confidence: "reference",
  },
  ariane64: {
    label: "Ariane 64",
    note: "クールー射場。Ariane 6ユーザーズマニュアル等に基づく推定値",
    vinfs: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    decls: [-90, -28.5, -20, -10, -5, 0, 5, 10, 20, 28.5, 90],
    // data[赤緯の番号][V∞の番号] [kg]
    data: [
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      [9200, 8900, 8450, 7850, 7200, 6450, 5650, 4800, 4000, 3250, 2600, 2000],
      [9400, 9100, 8700, 8150, 7500, 6750, 5950, 5100, 4300, 3500, 2800, 2200],
      [9550, 9250, 8850, 8300, 7650, 6900, 6100, 5250, 4450, 3650, 2950, 2350],
      [9600, 9300, 8900, 8350, 7700, 6950, 6150, 5300, 4500, 3700, 3000, 2400],
      [9550, 9250, 8850, 8300, 7650, 6900, 6100, 5250, 4450, 3650, 2950, 2350],
      [9400, 9100, 8700, 8150, 7500, 6750, 5950, 5100, 4300, 3500, 2800, 2200],
      [9200, 8900, 8450, 7850, 7200, 6450, 5650, 4800, 4000, 3250, 2600, 2000],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
      [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
    ],
  },
  ariane5: {
    label: "Ariane 5",
    note: "クールー射場。ExoMars検討時にArianespaceからESOCへ提供された値",
    vinfs: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6],
    decls: [-90, -50, -45, -40, -35, -30, -25, -20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 90],
    // data[赤緯の番号][V∞の番号] [kg]
    data: [
      [0.0497870684, 0.0301973834, 0.0183156389, 0.0111089965, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628, 0.000123409804, 4.53999298e-05, 1.67017008e-05, 6.14421235e-06],
      [0.0497870684, 0.0301973834, 0.0183156389, 0.0111089965, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628, 0.000123409804, 4.53999298e-05, 1.67017008e-05, 6.14421235e-06],
      [0.0820849986, 0.0497870684, 0.0301973834, 0.0183156389, 0.0111089965, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628, 0.000123409804, 4.53999298e-05, 1.67017008e-05],
      [0.135335283, 0.0820849986, 0.0497870684, 0.0255785799, 0.0183156389, 0.0111089965, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628, 0.000123409804, 4.53999298e-05],
      [0.22313016, 0.135335283, 0.135335283, 0.0820849986, 0.0497870684, 0.0183156389, 0.0111089965, 0.00408677144, 0.00247875218, 0.000911881966, 0.000335462628, 0.000123409804],
      [0.367879441, 0.263685018, 0.22313016, 0.189001562, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00408677144, 0.00247875218, 0.000911881966, 0.000335462628],
      [0.60653066, 0.513759511, 0.367879441, 0.263685018, 0.189001562, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00408677144, 0.00247875218, 0.000911881966],
      [5006, 4667, 0.60653066, 0.367879441, 0.263685018, 0.189001562, 0.135335283, 0.0497870684, 0.0183156389, 0.0111089965, 0.006737947, 0.00247875218],
      [5474, 5195, 4805, 4316, 0.716770194, 0.513759511, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.0111089965, 0.006737947],
      [5835, 5615, 5291, 4870, 4359, 3774, 3136, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.0183156389],
      [6078, 5910, 5648, 5295, 4856, 4340, 3763, 3141, 0.367879441, 0.22313016, 0.135335283, 0.0497870684],
      [6191, 6059, 5844, 5549, 5180, 4744, 4251, 3714, 3155, 0.60653066, 0.367879441, 0.135335283],
      [6073, 5953, 5749, 5470, 5127, 4729, 4286, 3808, 3304, 2785, 2260, 0.367879441],
      [0.367879441, 0.332871084, 0.301194212, 0.272531793, 0.246596964, 0.22313016, 0.201896518, 0.182683524, 0.165298888, 0.149568619, 0.135335283, 0.122456428],
      [0.135335283, 0.122456428, 0.110803158, 0.100258844, 0.0907179533, 0.0820849986, 0.0742735782, 0.0672055127, 0.0608100626, 0.0550232201, 0.0497870684, 0.0450492024],
      [0.22313016, 0.263685018, 0.367879441, 0.472366553, 0.60653066, 0.778800783, 4081, 3509, 2891, 2244, 0.367879441, 0.135335283],
      [0.367879441, 0.472366553, 0.60653066, 0.778800783, 4874, 4391, 3836, 3220, 2559, 0.367879441, 0.135335283, 0.0497870684],
      [0.60653066, 0.778800783, 5484, 5134, 4693, 4167, 3563, 2897, 2190, 0.22313016, 0.0497870684, 0.0183156389],
      [5773, 5589, 5306, 4924, 4443, 3868, 3210, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947],
      [5650, 5441, 5124, 4697, 4161, 3522, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00247875218],
      [5477, 5239, 4882, 4401, 3795, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00247875218, 0.000911881966],
      [5302, 5021, 4604, 4044, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628],
      [5302, 5021, 4604, 4044, 0.367879441, 0.135335283, 0.0497870684, 0.0183156389, 0.006737947, 0.00247875218, 0.000911881966, 0.000335462628],
    ],
  },
  ariane5_free: {
    label: "Ariane 5 (赤緯自由)",
    note:
      "各C3で表の中の物理的な値(>100kg)の最大を取った包絡。赤緯を選べる前提の比較用で、" +
      "特定の赤緯へ飛ばせることを意味しない",
    formula: (c3) => ariane5FreeDLA(c3),
    vinf_max: 6,
    source_mode: "free-DLA-envelope",
    confidence: "speculative",
  },
  atlas501: {
    label: "Atlas V 501",
    note: "ケープカナベラル射場",
    vinfs: [0, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 5.75, 6],
    decls: [-90, -40, -30, -29, -28.5, -20, -10, 0, 10, 20, 28.5, 29, 30, 40, 90],
    // data[赤緯の番号][V∞の番号] [kg]
    data: [
      [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      [1160, 1160, 1100, 1010, 930, 830, 740, 630, 590, 550],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [2335, 2335, 2195, 2035, 1865, 1675, 1480, 1275, 1175, 1075],
      [1160, 1160, 1100, 1010, 930, 830, 740, 630, 590, 550],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1],
    ],
  },
  atlas551_star48b: {
    label: "Atlas V 551 + Star 48B",
    note:
      "New Horizonsの構成。Atlas単体の表と Star 48B のΔVの釣り合いから逆算した推定で、" +
      "公式の打上げ能力ではない。妥当なのはC3 60〜220 km²/s²の範囲",
    formula: (c3) => atlas551Star48B(c3),
    c3_min: STAR48B_C3_MIN,
    c3_max: STAR48B_C3_MAX,
    vinf_max: Math.sqrt(STAR48B_C3_MAX),
    source_mode: "extrapolated",
    confidence: "reference",
  },
  atlas551: {
    label: "Atlas V 551",
    note: "赤緯依存は表に無く、V∞のみの1次元モデル",
    vinfs: [1, 1.7320508075688772, 2.23606797749979, 2.6457513110645907, 3, 3.3166247903554, 3.605551275463989, 3.872983346207417, 4.123105625617661, 4.358898943540674, 4.58257569495584, 4.795831523312719, 5, 5.196152422706632, 5.385164807134504, 5.5677643628300215, 5.744562646538029, 5.916079783099616, 6.082762530298219, 6.324555320336759, 6.708203932499369, 7.0710678118654755, 7.416198487095663, 7.745966692414834],
    data: [5995, 5780, 5570, 5360, 5160, 4965, 4775, 4585, 4405, 4230, 4055, 3890, 3730, 3570, 3420, 3270, 3130, 2995, 2860, 2670, 2380, 2120, 1900, 1695],
  },
  soyuzf: {
    label: "Soyuz-Fregat",
    note: "バイコヌール射場",
    vinfs: [0, 1, 2, 3, 4, 5],
    decls: [-90, -65, -50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 65, 90],
    // data[赤緯の番号][V∞の番号] [kg]
    data: [
      [0.001, 0.001, 0.001, 0.001, 0.001, 0.001],
      [100, 100, 100, 100, 100, 100],
      [1830.5, 1830.5, 1815.9, 1737.7, 1588, 1344.3],
      [1910.8, 1910.8, 1901.9, 1819, 1636.4, 1369.3],
      [2001.8, 2001.8, 1995.3, 1891.3, 1673.9, 1391.9],
      [2108.8, 2108.8, 2088.6, 1947.9, 1708, 1409.5],
      [2204, 2204, 2167.3, 1995.5, 1734.5, 1419.6],
      [2270.8, 2270.8, 2205.8, 2013.6, 1745.1, 1435.2],
      [2204.7, 2204.7, 2133.6, 1965.4, 1712.8, 1413.6],
      [2087.9, 2087.9, 2060.6, 1917.7, 1681.1, 1392.5],
      [1979.17, 1979.17, 1975.4, 1866.5, 1649, 1371.7],
      [1886.9, 1886.9, 1882.2, 1801, 1614.6, 1350.5],
      [1805.9, 1805.9, 1796, 1722.7, 1571.6, 1327.6],
      [100, 100, 100, 100, 100, 100],
      [0.001, 0.001, 0.001, 0.001, 0.001, 0.001],
    ],
  },
  falcon9: {
    label: "Falcon 9",
    note: "使い捨て形態・ケープカナベラル射場。赤緯依存は公表が無く、V∞のみの1次元モデル",
    vinfs: [0, 1.4142135623730951, 2.23606797749979, 2.8284271247461903, 3.4641016151377544, 4, 4.47213595499958, 5, 5.477225575051661, 6, 6.708203932499369, 7.416198487095663, 8.06225774829855, 8.94427190999916],
    data: [8300, 7600, 6700, 5900, 4020, 3450, 2900, 2350, 1900, 1500, 1050, 750, 550, 350],
  },
};

// 黄道座標から赤道座標へ移すときのX軸まわりの回転角 (地球の赤道傾斜角)
const OBLIQUITY = (23.4392911 * Math.PI) / 180;
const RAD2DEG = 180 / Math.PI;

/** 選べる打上げ機の一覧 [{ id, label, note, needs_decl, vinf_max }] */
export function launcher_list() {
  return Object.entries(LAUNCHERS).map(([id, L]) => ({
    id,
    label: L.label,
    note: L.note,
    needs_decl: L.decls != undefined,
    vinf_max: L.vinfs != undefined ? L.vinfs[L.vinfs.length - 1] : L.vinf_max,
  }));
}

/**
 * 黄道座標系のV∞ベクトルから、地球赤道座標系での赤緯 (DLA) を求める [deg]。
 * 打上げ能力の表はこの赤緯で引くので、黄道面基準のままでは引けない。
 * (この表はいずれも地球からの打上げなので、他の天体からの出発には使えない)
 * @param {number[]} v_inf 太陽中心・黄道座標のV∞ベクトル [km/s]
 */
export function launch_declination(v_inf) {
  if (v_inf == undefined) return 0;
  const n = Math.hypot(v_inf[0], v_inf[1], v_inf[2]);
  if (!(n > 0)) return 0;
  // 黄道 -> 赤道 はX軸まわりの回転。赤緯にはz成分だけあればよい。
  const z_eq = (v_inf[1] * Math.sin(OBLIQUITY) + v_inf[2] * Math.cos(OBLIQUITY)) / n;
  return Math.asin(Math.max(-1, Math.min(1, z_eq))) * RAD2DEG;
}

// x を含む区間の番号と、その中での位置 (0〜1) を返す
function locate(grid, x) {
  let i = 0;
  while (i < grid.length - 2 && x > grid[i + 1]) i++;
  const span = grid[i + 1] - grid[i];
  const t = span === 0 ? 0 : (x - grid[i]) / span;
  return { i, t: Math.min(Math.max(t, 0), 1) };
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

// 表を (C3, 赤緯) で引く。表の範囲内で呼ぶこと (外は locate が端で頭打ちにする)。
function table_at(L, c3, decl = 0) {
  const v = locate(L.vinfs, Math.sqrt(Math.max(c3, 0)));
  if (L.decls == undefined) return lerp(L.data[v.i], L.data[v.i + 1], v.t);
  const ds = L.decls;
  const d = locate(ds, clamp(decl, ds[0], ds[ds.length - 1]));
  const low = L.data[d.i];
  const high = L.data[d.i + 1];
  return lerp(lerp(low[v.i], low[v.i + 1], v.t), lerp(high[v.i], high[v.i + 1], v.t), d.t);
}

// ==================================================================
// 表の外や「作り物の境界」を工学的な近似で埋める (extendedモード)
// ==================================================================
// 元の表は「そこへは飛ばせない」ことを表すのに、負の値を極端に小さい正の値
// (0.001 / 0.1 / 1 / 10 / 100 kg など) に置き換えてある。これをそのまま性能と
// して読むと、実際には可能な打上げが「打ち上げ不可」になってしまう。
// また表の上端を超えたC3で最後の値に張り付かせるのも実態と合わない。
//
// extendedモードでは、信頼できる芯の部分だけ表の値を使い、その外側を埋める。
//   ・低C3側     : 表の最初の2列を使ったC3についての線形外挿
//   ・高C3側     : 表の端に接する指数関数
//   ・芯を外れた赤緯: パーキング軌道経由とみなして赤緯0の性能の90%
// どこから来た値かは sourceMode / confidence で返す。
const PARKING_FACTOR = 0.9;

// 確からしさの順序。組み合わせたときは低い方を採る。
const CONFIDENCE_RANK = { table: 3, reference: 2, speculative: 1 };
const weaker = (a, b) => (CONFIDENCE_RANK[a] <= CONFIDENCE_RANK[b] ? a : b);

const EXTENDED = {
  ariane64: {
    // 芯: 0.25 <= C3 <= 36 かつ |DLA| <= 5度
    c3_core: [0.25, 36],
    dla_core: 5,
    tail: (c3) => 2400 * Math.exp(-0.03965 * (c3 - 36)),
    low: "linear_c3", // 表の最初の2列でC3について線形外挿
    // 90%というパーキング軌道の仮定は ESA EPIG CDF study に記載がある
    parking_confidence: "reference",
  },
  atlas501: {
    // 芯: 0 <= C3 <= 36 かつ |DLA| <= 28.5度
    // (±29 / ±30 / ±40 / ±90 の行は作り物の境界なので extended では使わない)
    c3_core: [0, 36],
    dla_core: 28.5,
    tail: (c3) => 1075 * Math.exp(-0.02925 * (c3 - 36)),
    parking_confidence: "speculative", // こちらは経験則
  },
  soyuzf: {
    // 芯: 0 <= C3 <= 25 かつ |DLA| <= 50度
    // (±65の100kg、±90の0.001kgの行は作り物の境界)
    c3_core: [0, 25],
    dla_core: 50,
    tail: (c3) => 1435.2 * Math.exp(-0.02083 * (c3 - 25)),
    parking_confidence: "speculative",
  },
  atlas551: {
    c3_core: [1, 60],
    tail: (c3) => 1695 * Math.exp(-0.02265 * (c3 - 60)),
    low_fn: (c3) => 6102.5 - 107.5 * c3,
    // これより高いC3は Atlas V 551 + Star 48B の方を使う
  },
  falcon9: {
    c3_core: [0, 80],
    tail: (c3) => 350 * Math.exp(-0.03199 * (c3 - 80)),
    // 元の表自体に推定値が混じっているとコメントされているので、
    // 表の中でも「参考」扱いにする
    raw_confidence: "reference",
  },
  // ariane5 は直接投入の表をそのまま使う。作り物に見える小さい値は
  // 「その赤緯へは直接投入では飛ばせない」という意味を持っているので、
  // 他機のようにまとめてパーキング軌道の近似で置き換えない (ECA上段の事情)。
  // 赤緯を選ばない場合の包絡は ariane5FreeDLA() を参照。
};

// 芯の外を埋めて (mass, sourceMode, confidence) を返す
function extended_mass(id, L, c3, decl) {
  const cfg = EXTENDED[id];
  if (cfg == undefined) {
    return { mass: table_at(L, c3, decl), sourceMode: "raw", confidence: "table" };
  }

  // 呼び出し側はV∞を渡してくるので、C3は2乗の丸めで芯の端をわずかに跨ぐ
  // (例: sqrt(80)^2 = 80.00000000000001)。端ちょうどは芯の中として扱う。
  const EPS = 1e-9;
  const [c3_lo, c3_hi] = cfg.c3_core;
  const off_axis = cfg.dla_core != undefined && Math.abs(decl) > cfg.dla_core + EPS;
  // 芯を外れた赤緯はパーキング軌道経由とみなすので、まず赤緯0で評価する
  const dla = off_axis ? 0 : decl;

  let mass;
  let sourceMode;
  let confidence;
  if (c3 > c3_hi + EPS) {
    mass = cfg.tail(c3);
    sourceMode = "extrapolated";
    confidence = "reference";
  } else if (c3 < c3_lo - EPS) {
    if (cfg.low_fn) mass = cfg.low_fn(c3);
    else if (cfg.low === "linear_c3") {
      // 最初の2列 (C3a, C3b) を通る直線をそのまま下へ延ばす
      const c3a = L.vinfs[0] ** 2;
      const c3b = L.vinfs[1] ** 2;
      const ma = table_at(L, c3a, dla);
      const mb = table_at(L, c3b, dla);
      mass = ma + ((mb - ma) * (c3 - c3a)) / (c3b - c3a);
    } else mass = table_at(L, c3_lo, dla);
    sourceMode = "extrapolated";
    confidence = "reference";
  } else {
    mass = table_at(L, c3, dla);
    sourceMode = "raw";
    confidence = cfg.raw_confidence ?? "table";
  }

  if (off_axis) {
    mass *= PARKING_FACTOR;
    sourceMode = "parking-orbit-surrogate";
    confidence = weaker(confidence, cfg.parking_confidence ?? "speculative");
  }
  return { mass, sourceMode, confidence };
}

/** Ariane 5 の直接投入 (元の表そのまま)。指定した赤緯へ直接飛ばす場合の質量 [kg] */
export function ariane5Direct(c3, decl = 0) {
  const L = LAUNCHERS.ariane5;
  const vs = L.vinfs;
  const c3_min = vs[0] ** 2;
  const c3_max = vs[vs.length - 1] ** 2;
  if (c3 > c3_max) return 0; // 表の上端より先へは伸ばさない
  return table_at(L, Math.max(c3, c3_min), decl);
}

// Ariane 5 で赤緯を選ばない場合の包絡。各C3で「物理的に意味のある値
// (>100 kg) の最大」を取る。境界をまたぐ区間は作り物の値との補間になって
// しまうので、両端とも物理的な行だけを見る。
const ARIANE5_ENVELOPE_C3 = 30.25; // ここから先は表に物理解が無いので指数近似
const ariane5_envelope = (c3) => 2260 * Math.exp(-0.03729 * (c3 - ARIANE5_ENVELOPE_C3));

/** Ariane 5 の赤緯自由包絡 [kg] (比較用) */
export function ariane5FreeDLA(c3) {
  const L = LAUNCHERS.ariane5;
  const vs = L.vinfs;
  const c3_max = vs[vs.length - 1] ** 2;
  if (c3 <= c3_max) {
    const v = locate(vs, Math.sqrt(Math.max(c3, vs[0] ** 2)));
    let best = 0;
    for (const row of L.data) {
      const a = row[v.i];
      const b = row[v.i + 1];
      if (a > 100 && b > 100) best = Math.max(best, lerp(a, b, v.t));
    }
    if (best > 0) return best;
  }
  return c3 > ARIANE5_ENVELOPE_C3 ? ariane5_envelope(c3) : 0;
}

/**
 * 打上げ機が投入できる質量 [kg] とその出どころ。
 *
 * @param {string} id     launcher_list() の id
 * @param {number} vinf   脱出双曲線余剰速度 [km/s]
 * @param {number} [decl] 赤緯 DLA [deg] (1次元の表では無視される)
 * @param {"extended"|"strict"} [mode]
 *   strict   : pykepの表をそのまま再現する (表の外は下限で頭打ち / 上限超えは不可)
 *   extended : 信頼できる範囲は表の値、その外は工学的な近似で埋める (既定)
 * @returns {{mass:number, status:string, sourceMode:string, confidence:string}}
 *   status     : "ok" | "below_table" | "over_vinf" | "outside_range" | "unknown"
 *   sourceMode : "raw" | "extrapolated" | "parking-orbit-surrogate" | "free-DLA-envelope"
 *   confidence : "table" | "reference" | "speculative"
 */
export function launcher_mass(id, vinf, decl = 0, mode = "extended") {
  const L = LAUNCHERS[id];
  if (L == undefined || !isFinite(vinf) || vinf < 0) {
    return { mass: 0, status: "unknown", sourceMode: "raw", confidence: "speculative" };
  }
  const c3 = vinf * vinf;

  // 表ではなく式・逆算で与える機種 (H3, Atlas + Star 48B, Ariane 5の包絡)。
  // モードによらず同じ式を使う (元から表ではないため)。
  if (L.formula != undefined) {
    const mass = L.formula(c3);
    const meta = {
      sourceMode: L.source_mode ?? "extrapolated",
      confidence: L.confidence ?? "reference",
    };
    if (!(mass > 0)) return { mass: 0, status: "over_vinf", ...meta };
    const outside =
      (L.c3_min != undefined && c3 < L.c3_min) || (L.c3_max != undefined && c3 > L.c3_max);
    return {
      mass,
      status: outside ? "outside_range" : "ok",
      sourceMode: meta.sourceMode,
      confidence: outside ? weaker(meta.confidence, "speculative") : meta.confidence,
    };
  }

  // --- strict: pykepの表そのまま ---
  if (mode === "strict") {
    const vs = L.vinfs;
    if (vinf > vs[vs.length - 1]) {
      return { mass: 0, status: "over_vinf", sourceMode: "raw", confidence: "table" };
    }
    const below = vinf < vs[0];
    return {
      mass: table_at(L, Math.max(c3, vs[0] ** 2), decl),
      status: below ? "below_table" : "ok",
      sourceMode: "raw",
      confidence: "table",
    };
  }

  // --- extended: 芯は表、外は近似 ---
  const r = extended_mass(id, L, c3, decl);
  return {
    mass: Math.max(r.mass, 0),
    status: r.mass > 0 ? (r.sourceMode === "raw" ? "ok" : "approx") : "over_vinf",
    sourceMode: r.sourceMode,
    confidence: r.confidence,
  };
}
