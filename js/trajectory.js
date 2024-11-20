// import * as vec from "./lib/vector.js"

//諸定数
const MU_SUN = 1.32712440018e11
const AU = 149597870.7


let element_0 = [
    [57909226.54152438, 0.20563593, 0.12225994793212572, 4.4025986842958265, 1.3518935764250155, 0.8435309954891992],
    [108209474.53737916, 0.00677672, 0.05924827411109566, 3.176134456089366, 2.296896356038777, 1.3383157224083446],
    [149598261.1504425, 0.01671123, -2.6720990848033185e-7, 1.7534375570727851, 1.796601474049171, 0],
    [227943822.42757303, 0.0933941, 0.03228320542488929, -0.07947238153833505, -0.41789517122343994, 0.8649771297497416],
    [778340816.6927108, 0.04838624, 0.02276602153047185, 0.6003311378658575, 0.2570604668470747, 1.7536005259699596],
    [1426666414.179921, 0.05386179, 0.04338874330931084, 0.8718660371588796, 1.6161553101630626, 1.9837835429754038],
    [2870658170.655732, 0.04725744, 0.013485074058964219, 5.467036266405599, 2.9837149917991095, 1.2918390439753027],
    [4498396417.009467, 0.00859048, 0.030893086454925476, -0.9620260018875293, 0.7847831489880195, 2.3000686413544607],
    [5906440596.528804, 0.24882730, 0.29914964427853585, 4.170098397482234, 3.9107403406360577, 1.92516687576987]
]
let element_dot = [
    [55.351212159, 0.00001906, -0.00010380328272943754, 2608.7903050105283, 0.0028008501038607634, -0.0021876098216166338],
    [583.4316957299999, -0.00004107, -0.000013768902468983266, 1021.3285495824113, 0.000046832245285838646, -0.004846677754625787],
    [840.740033334, -0.00004392, -0.00022596219320209946, 628.3075779009216, 0.005642189402906841, 0],
    [2763.072671829, 0.00007882, -0.0001419181320003401, 334.06130168138657, 0.007756433087685417, -0.005106369657353154],
    [-17363.824852149, -0.00013253, -0.00003206414182008862, 52.966311891385956, 0.003709290314332382, 0.0035725329463972646],
    [-187087.09709742, -0.00050991, 0.00003379114511493701, 21.33653878870552, -0.007312443666192486, -0.00503838053087464],
    [-293475.11882443196, -0.00004397, -0.00004240085431502504, 7.4784221716045405, 0.007121865056514843, 0.0007401224027385382],
    [39330.776185737, 0.00005105, 0.000006173578630154342, 3.812836741319127, -0.00562719702463221, -0.00008877861586364437],
    [-47266.943226371994, 0.00005170, 8.40899633610868e-7, 2.534354299461879, -0.0007091171521756345, -0.0002065565753808753]
]

function solve_kepler(e, M) {
    let E = M
    let dE = 1
    while (Math.abs(dE) > 1e-6) {
        dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
        E -= dE
    }
    return E
}

function get_planet_elements(T, n) {
    T_TDB = (T - 2451545.0) / 36525.0
    let X = element_0[n].map((y, i) => y + T_TDB * element_dot[n][i]);

    let a = X[0]
    let e = X[1]
    let i = X[2]
    let w = X[4] - X[5]
    let W = X[5]
    let L = X[3]
    let M = L - X[4]

    let E = solve_kepler(e, M)

    return [a, e, i, W, w, E]
}

function get_orbit(elements) {
    pos = [100]
    for (let i = 0; i < 100; i++) {
        pos[i] = get_planets_pos_E(elements, 2 * Math.PI * i / 99).mul(1 / AU)
    }
    return pos
}
function get_planets_pos(elements) {

    return get_planets_pos_E(elements, elements[5])
}

function get_planets_pos_E(elements, E) {
    let a = elements[0]
    let e = elements[1]
    let i = elements[2]
    let W = elements[3]
    let w = elements[4]
    // console.log(E)

    var P_hat = new Vector(
        Math.cos(w) * Math.cos(W) - Math.sin(w) * Math.sin(W) * Math.cos(i),
        Math.cos(w) * Math.sin(W) + Math.sin(w) * Math.cos(W) * Math.cos(i),
        Math.sin(w) * Math.sin(i)
    );
    var Q_hat = new Vector(
        -Math.sin(w) * Math.cos(W) - Math.cos(w) * Math.sin(W) * Math.cos(i),
        -Math.sin(w) * Math.sin(W) + Math.cos(w) * Math.cos(W) * Math.cos(i),
        Math.cos(w) * Math.sin(i)
    )

    p = a * (1 - e * e)
    r_n = a * (1 - e * Math.cos(E))
    r = Vector.add(P_hat.mul(a * (Math.cos(E) - e)), Q_hat.mul(Math.sqrt(a * p) * Math.sin(E)))

    return r
    // return rotate_x(x, y, i, w, W)

}


function JulianToDate(julianDay) {
    // ユリウス日をミリ秒に変換
    const timestamp = (julianDay - 2440587.5) * 86400000;

    // Date オブジェクトを作成
    return new Date(timestamp);
}
function DateToJulian(date) {
    const time = date.getTime(); // UTCタイムスタンプ（ミリ秒）
    return time / 86400000 + 2440587.5; // ミリ秒を日に変換し、1970年1月1日のJD基準値を加算
}

// 使用例
const julianDay = 2451545; // 2000年1月1日のユリウス日
const date = JulianToDate(julianDay);

console.log(date.toISOString()); // 出力: 2000-01-01T00:00:00.000Z

// console.log(get_planet_elements(julianDay, 0))
// console.log(get_planets_pos(julianDay, 0))










// for (i = 0; i < 8; i++) {
//     element_0[i][0] = element_0[i][0] * AU
//     element_0[i][2] = element_0[i][2] / 180 * Math.PI
//     element_0[i][3] = element_0[i][3] / 180 * Math.PI
//     element_0[i][4] = element_0[i][4] / 180 * Math.PI
//     element_0[i][5] = element_0[i][5] / 180 * Math.PI
//     element_dot[i][0] = element_dot[i][0] * AU
//     element_dot[i][2] = element_dot[i][2] / 180 * Math.PI
//     element_dot[i][3] = element_dot[i][3] / 180 * Math.PI
//     element_dot[i][4] = element_dot[i][4] / 180 * Math.PI
//     element_dot[i][5] = element_dot[i][5] / 180 * Math.PI
// }
// console.log(element_0)
// console.log(element_dot)