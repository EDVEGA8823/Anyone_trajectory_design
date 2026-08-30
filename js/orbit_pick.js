/**
 * 画面上で軌道の線を掴むための当たり判定。
 *
 * 太陽系ビューで天体やノードをドラッグして時刻を変えるとき、どこを指したかを
 * 「太陽から見た方位(真近点角)」で決めていた。円軌道ならそれで問題ないが、
 * 長楕円や双曲線では次の3つが重なって天体が暴れる:
 *
 *   1. 時刻の変化率が dt/dnu = r^2/h なので、遠日点と近日点で ((1+e)/(1-e))^2 倍
 *      ちがう。ハレー彗星(e=0.967)ならカーソル1度が遠日点で3.2年、近日点で8時間
 *   2. 長楕円は画面上で太陽のすぐ横を通るため、そこを横切ると方位が跳ね、
 *      周回数の判定(真近点角の折り返し)が誤爆して1周期ぶん時刻が飛ぶ
 *   3. 軌道面を真横から見ると、レイと軌道面の交点が無限遠へ発散する
 *
 * ここでは代わりに「描かれている折れ線のうち、画面上でカーソルに一番近い点」を
 * 探す。天体が見えている線に吸い付くので上の3つがまとめて消える。
 * 折れ線の刻みは描画と共有する (trajectory.js の orbit_anomalies)。
 */

import { AU, get_planets_pos_E, orbit_anomalies } from './trajectory.js';

// 当たり判定に使う折れ線の細かさ。描画用(100点)より細かくして、
// カーソルに寄せたときの形の誤差を小さくする。区間の中は線形に補間するので、
// 時刻そのものはこの刻みより細かく決まる。
const PICK_SAMPLES = 241;

// 「ほぼ同じ近さ」とみなす画面上の距離 (画面の高さを2とした値なので、
//  0.03 は高さの1.5%)。傾いた軌道を横から見ると画面上で線が交差するため、
//  この範囲に枝が複数あるときは前フレームに近いほうを選んで連続性を保つ。
const TIE_DISTANCE = 0.03;

/**
 * ドラッグ中ずっと使う折れ線を作る。
 *
 * 軌道要素は掴んだ瞬間のものに固定する。時刻を動かすと惑星の接触軌道要素は
 * わずかに変わるが、掴んでいる線が足元で動くと操作感が悪いため。
 *
 * @param {number[]} elements 軌道要素 [a, e, i, W, w, E]
 * @param {Float64Array} [anomalies] 描画側と揃えた近点角の並び
 *   (省略すると天体の軌道と同じ範囲。マヌーバの「未実行時の軌道」は
 *    描く範囲が違うので、呼ぶ側が coast_anomalies を渡す)
 * @returns {{anomalies: Float64Array, pos: THREE.Vector3[], closed: boolean}}
 */
export function buildOrbitSamples(elements, anomalies = orbit_anomalies(elements, PICK_SAMPLES)) {
  const pos = new Array(anomalies.length);
  for (let i = 0; i < anomalies.length; i++) {
    const { r } = get_planets_pos_E(elements, anomalies[i]);
    // 描画座標 (plot.js の drawingPos と同じ並び)。Z軸の拡大は描くときに
    // かかるので、ここでは掛けずに持っておく
    pos[i] = new THREE.Vector3(r[0] / AU, r[2] / AU, -r[1] / AU);
  }
  return { anomalies, pos, closed: elements[1] < 1 };
}

// 世界座標を正規化デバイス座標に直す。camera.position より後ろの点は
// 透視除算で符号が反転して嘘の位置になるので、w で弾けるように自前で持つ。
const _v4 = new THREE.Vector4();
const _mat = new THREE.Matrix4();

/**
 * カーソルに一番近い軌道上の点の近点角を返す。
 *
 * @param {object} samples buildOrbitSamples の戻り値
 * @param {THREE.Vector2} mouse 正規化デバイス座標のカーソル位置
 * @param {THREE.Camera} camera 太陽系ビューのカメラ
 * @param {number} z_scale Z軸の拡大率 (plot.js の getZScale)
 * @param {number} prev 前フレームの近点角 (連続性の基準。折り返しの解消にも使う)
 * @returns {number|null} 近点角。掴める点が画面内に無ければ null
 */
export function pickAnomaly(samples, mouse, camera, z_scale, prev) {
  const n = samples.anomalies.length;
  if (n < 2) return null;

  // 画面上の距離で測りたいので、横は縦横比を掛けて縦に揃える
  const aspect = camera.aspect > 0 ? camera.aspect : 1;
  _mat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

  // 折れ線の各点を、カーソルを原点とした画面座標に直す
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  const ok = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = samples.pos[i];
    _v4.set(p.x, p.y * z_scale, p.z, 1).applyMatrix4(_mat);
    if (!(_v4.w > 1e-6)) continue; // カメラの後ろ
    sx[i] = (_v4.x / _v4.w - mouse.x) * aspect;
    sy[i] = _v4.y / _v4.w - mouse.y;
    ok[i] = 1;
  }

  // 各区間について、カーソルに一番近い点とそこまでの距離を求める
  const dist = new Float64Array(n - 1);
  const frac = new Float64Array(n - 1);
  let best = Infinity;
  for (let i = 0; i < n - 1; i++) {
    dist[i] = Infinity;
    if (!ok[i] || !ok[i + 1]) continue;
    const dx = sx[i + 1] - sx[i];
    const dy = sy[i + 1] - sy[i];
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = -(sx[i] * dx + sy[i] * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
    }
    const qx = sx[i] + t * dx;
    const qy = sy[i] + t * dy;
    dist[i] = Math.hypot(qx, qy);
    frac[i] = t;
    if (dist[i] < best) best = dist[i];
  }
  if (!isFinite(best)) return null;

  // 候補は「近さが谷になっている区間」だけに絞る。
  //
  // 谷を探さずに「近い区間すべて」から前フレームに近いものを選ぶと、同じ枝の
  // 手前側の区間まで候補に入ってしまい、毎フレーム少しずつ後ろへ引っぱられる
  // (地球で1歩3.7日のところ0.66日ぶん遅れた)。谷はひとつの枝につきひとつなので、
  // 谷に絞れば枝の中では常に本当に一番近い点が選ばれ、前フレームとの比較は
  // 「どの枝か」の判断だけに効く。
  const seg = n - 1;
  const limit = best + TIE_DISTANCE;
  let picked = null;
  let picked_gap = Infinity;
  for (let i = 0; i < seg; i++) {
    if (dist[i] > limit) continue;
    // 閉じた軌道では端どうしが隣り合う
    const prev_i = i === 0 ? (samples.closed ? seg - 1 : 1) : i - 1;
    const next_i = i === seg - 1 ? (samples.closed ? 0 : seg - 2) : i + 1;
    if (dist[i] > dist[prev_i] || dist[i] > dist[next_i]) continue;

    const nu = unwrap(
      samples.anomalies[i] + frac[i] * (samples.anomalies[i + 1] - samples.anomalies[i]),
      prev,
      samples.closed
    );
    const gap = Math.abs(nu - prev);
    if (gap < picked_gap) {
      picked_gap = gap;
      picked = nu;
    }
  }
  return picked;
}

// 楕円は近点角が2πで一巡するので、前フレームに一番近い値へ読み替える。
// こうしておくと E をそのまま積み上げられ、何周したかを別に数えなくてよい。
function unwrap(value, prev, closed) {
  if (!closed) return value;
  const turn = 2 * Math.PI;
  return value + turn * Math.round((prev - value) / turn);
}
