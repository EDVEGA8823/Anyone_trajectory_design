// function get_line_data(data){
//     data.forEach(line => {

//     });
// }
// ３次元散布図を描画
function get_data(pos, lines, p_list) {
  let data_x = [],
    data_y = [],
    data_z = [];
  for (let i = 0; i < pos.length; i++) {
    data_x.push(pos[i][0]);
    data_y.push(pos[i][1]);
    data_z.push(pos[i][2]);
  }
  var data = [
    {
      x: [0, 0],
      y: [0, 0],
      z: [-max, max],
      mode: "maekers",
      type: "scatter3d",
      marker: {
        color: "rgba(0, 0, 0,0)",
      },
    },
    {
      x: [0],
      y: [0],
      z: [0],
      mode: "maekers",
      type: "scatter3d",
      marker: {
        color: "orange",
        size: 5,
      },
    },
  ];

  data2 = lines.map(function (line, index) {
    // 各線のx, y, zを抽出
    var x = line.map((point) => point[0]);
    var y = line.map((point) => point[1]);
    var z = line.map((point) => point[2]);

    return {
      x: x,
      y: y,
      z: z,
      mode: "lines",
      type: "scatter3d",
      name: "Line " + (index + 1), // 線の名前
      line: {
        width: 5, // 線の太さ
        // color: "rgb(200, 200, 200)", // 線の色
      },
    };
  });
  data = data2.concat(data);
  data = data.concat({
    x: data_x,
    y: data_y,
    z: data_z,
    mode: "markers+text",
    type: "scatter3d",
    marker: {
      size: 3,
      color: "rgb(50, 50, 50)",
    },
    textfont: {
      color: "black",
      size: 20,
    },
    text: p_list,
  });
  return data;
}

// data=data2
// data.concat( );
// console.log(data)
// console.log(data2)

max=50
var layout = {
  scene: {
    camera: {
      eye: { x: 0, y: -0.0001, z: 0.04 }, // カメラの位置（ズームを調整）
    },
    xaxis: {
      // nticks: max*2,
      range: [-max, max],
      showspikes: false,
    },
    yaxis: {
      // nticks: max*2,
      range: [-max, max],
      showspikes: false,
    },
    zaxis: {
      // nticks: 48,
      // range: [-max, max],
      showspikes: false,
    },
  },
  aspectratio: {
    x: 1,
    y: 1,
    z: 1,
  },
  height: 630,
  width: 700,
  margin: {
    l: 20, // 左余白 (default: 80)
    r: 20, // 右余白 (default: 80)
    t: 0, // 上余白 (default: 100)
    b: 0, // 下余白 (default: 80)
  },
  showlegend: false,
  hovermode: false,
};

function updateLayout() {
  h = window.innerHeight - 90;
  w = window.innerWidth / 2;
  if (window.innerWidth < window.innerHeight) {
    h = window.innerWidth - 90;
    w = window.innerWidth;
  }
  const layout = {
    width: w, // ウィンドウ幅の半分
    height: h, // ウィンドウの高さ
  };

  // レイアウトのみを更新
  Plotly.relayout("plot", layout);
}

// 初回のレイアウト更新

// ウィンドウリサイズに対応
window.addEventListener("resize", updateLayout);

// データの設定
// var data = [
//     {
//       x: [1, 2, 3, 4, 5],
//       y: [10, 15, 13, 17, 14],
//       z: [5, 6, 7, 8, 9],
//       mode: 'markers',
//       type: 'scatter3d'
//     }
//   ];

//   // カメラの設定
//   var layout = {
//     scene: {
//       camera: {
//         eye: { x: 1, y: 1, z: 0 } // カメラの位置（ズームを調整）
//       },
//       xaxis: { range: [0, 6] },
//       yaxis: { range: [10, 20] },
//       zaxis: { range: [4, 10] }
//     }
//   };

//   // プロットを作成
//   Plotly.newPlot('myDiv', data, layout);
