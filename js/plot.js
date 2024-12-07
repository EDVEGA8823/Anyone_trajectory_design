// // // function get_line_data(data){
// // //     data.forEach(line => {

// // //     });
// // // }
// // // ３次元散布図を描画
// // function get_data(pos, lines, p_list) {
// //   let data_x = [],
// //     data_y = [],
// //     data_z = [];
// //   for (let i = 0; i < pos.length; i++) {
// //     data_x.push(pos[i][0]);
// //     data_y.push(pos[i][1]);
// //     data_z.push(pos[i][2]);
// //   }
// //   var data = [
// //     {
// //       x: [0, 0],
// //       y: [0, 0],
// //       z: [-max, max],
// //       mode: "maekers",
// //       type: "scatter3d",
// //       marker: {
// //         color: "rgba(0, 0, 0,0)",
// //       },
// //     },
// //     {
// //       x: [0],
// //       y: [0],
// //       z: [0],
// //       mode: "maekers",
// //       type: "scatter3d",
// //       marker: {
// //         color: "orange",
// //         size: 5,
// //       },
// //     },
// //   ];

// //   data2 = lines.map(function (line, index) {
// //     // 各線のx, y, zを抽出
// //     var x = line.map((point) => point[0]);
// //     var y = line.map((point) => point[1]);
// //     var z = line.map((point) => point[2]);

// //     return {
// //       x: x,
// //       y: y,
// //       z: z,
// //       mode: "lines",
// //       type: "scatter3d",
// //       name: "Line " + (index + 1), // 線の名前
// //       line: {
// //         width: 5, // 線の太さ
// //         // color: "rgb(200, 200, 200)", // 線の色
// //       },
// //     };
// //   });
// //   data = data2.concat(data);
// //   data = data.concat({
// //     x: data_x,
// //     y: data_y,
// //     z: data_z,
// //     mode: "markers+text",
// //     type: "scatter3d",
// //     marker: {
// //       size: 3,
// //       color: "rgb(50, 50, 50)",
// //     },
// //     textfont: {
// //       color: "black",
// //       size: 20,
// //     },
// //     text: p_list,
// //   });
// //   return data;
// // }

// // // data=data2
// // // data.concat( );
// // // console.log(data)
// // // console.log(data2)

// // max=50
// // var layout = {
// //   scene: {
// //     camera: {
// //       eye: { x: 0, y: -0.0001, z: 0.04 }, // カメラの位置（ズームを調整）
// //     },
// //     xaxis: {
// //       // nticks: max*2,
// //       range: [-max, max],
// //       showspikes: false,
// //     },
// //     yaxis: {
// //       // nticks: max*2,
// //       range: [-max, max],
// //       showspikes: false,
// //     },
// //     zaxis: {
// //       // nticks: 48,
// //       // range: [-max, max],
// //       showspikes: false,
// //     },
// //   },
// //   aspectratio: {
// //     x: 1,
// //     y: 1,
// //     z: 1,
// //   },
// //   height: 630,
// //   width: 700,
// //   margin: {
// //     l: 20, // 左余白 (default: 80)
// //     r: 20, // 右余白 (default: 80)
// //     t: 0, // 上余白 (default: 100)
// //     b: 0, // 下余白 (default: 80)
// //   },
// //   showlegend: false,
// //   hovermode: false,
// // };
// // import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// // import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


// // // データの設定
// // // var data = [
// // //     {
// // //       x: [1, 2, 3, 4, 5],
// // //       y: [10, 15, 13, 17, 14],
// // //       z: [5, 6, 7, 8, 9],
// // //       mode: 'markers',
// // //       type: 'scatter3d'
// // //     }
// // //   ];

// // //   // カメラの設定
// // //   var layout = {
// // //     scene: {
// // //       camera: {
// // //         eye: { x: 1, y: 1, z: 0 } // カメラの位置（ズームを調整）
// // //       },
// // //       xaxis: { range: [0, 6] },
// // //       yaxis: { range: [10, 20] },
// // //       zaxis: { range: [4, 10] }
// // //     }
// // //   };

// // //   // プロットを作成
// // //   Plotly.newPlot('myDiv', data, layout);
// // import * as THREE from "three";



// // シーンを作成
// const scene = new THREE.Scene();

// // カメラを作成
// const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 500 );
// camera.position.set( 0, 0, 100 );
// camera.lookAt( 0, 0, 0 );

// const material = new THREE.LineBasicMaterial( { color: 0xffffff } );

// const geometry = new THREE.BufferGeometry();
// const positions = new Float32Array(100 * 3); // 頂点データ用の配列
// geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));



// const points = [];
// points.push( new THREE.Vector3( - 10, 0, 0 ) );
// points.push( new THREE.Vector3( 0, 10, 0 ) );
// points.push( new THREE.Vector3( 10, 0, 0 ) );
// // const geometry = new THREE.BufferGeometry().setFromPoints( points );
// const line = new THREE.Line( geometry, material );
// scene.add(line);
// renderer.render(scene, camera); // レンダリング


// // アニメーション処理
// function animate(){
//   requestAnimationFrame(animate);
//   controls.update();  //制御の更新処理
//   renderer.render(scene, camera);
// }
// animate();


// renderer.setSize(window.innerWidth, window.innerHeight);
// document.body.appendChild(renderer.domElement);


// サイズを指定
const width = 630;
const height = 700;

// レンダラーを作成
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#plot"),
  antialias: true
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

// 複数の線を管理する配列
// 基本設定
const scene = new THREE.Scene();
// テクスチャローダーを作成して画像を読み込む
const loader = new THREE.TextureLoader();
loader.setCrossOrigin('anonymous'); // クロスオリジン設定

const backgroundTexture =loader.load('./textures/hipp8.jpg');



// 背景に設定
scene.background = backgroundTexture;
const camera = new THREE.PerspectiveCamera(15, 1, 0.1, 1000);
camera.position.z = 5;
const lines = [];

// 線を作成する関数
function createLine(initialPoints, color = 0x0000ff) {
    const positions = new Float32Array(initialPoints.length * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // 初期データを設定
    initialPoints.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
    });

    const material = new THREE.LineBasicMaterial({ color });
    const line = new THREE.Line(geometry, material);

    // シーンに追加
    scene.add(line);

    // 管理配列に追加
    lines.push({ line, positions, geometry });
}

// 線を更新する関数
function updateLine(index, newPoints) {
    const lineData = lines[index];
    if (!lineData) {
        console.warn(`線 ${index} が見つかりません`);
        return;
    }

    const { positions, geometry } = lineData;

    if (newPoints.length > positions.length / 3) {
        console.warn('新しい頂点数が多すぎます。ジオメトリを再生成してください。');
        return;
    }

    // 頂点データを更新
    newPoints.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
    });

    // 残りのデータをクリア（線が短くなった場合に不要なデータを無効化）
    for (let i = newPoints.length * 3; i < positions.length; i++) {
        positions[i] = 0;
    }

    // 更新通知
    geometry.attributes.position.needsUpdate = true;
}
const controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.enablePan=false;
controls.maxDistance = 500;
// 描画ループ
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
animate();

// 例：線を作成
createLine([
    new THREE.Vector3(-50, 0, 0),
    new THREE.Vector3(50, 0, 0)
], 0xffffff);

createLine([
    new THREE.Vector3(0, 50, 0),
    new THREE.Vector3(0, -50, 0)
], 0x00ff00);
createLine([
    new THREE.Vector3(0, 0, -50),
    new THREE.Vector3(0, 0, 50)
], 0x00ff00);

function updateLayout() {
    h = window.innerHeight - 90;
    w = window.innerWidth / 2;
    if (window.innerWidth < window.innerHeight) {
      h = window.innerWidth - 90;
      w = window.innerWidth;
    }
    renderer.setSize(w, h);
    renderer.render(scene, camera); // レンダリング
  
  }
  
  // // // 初回のレイアウト更新
  
  // // // ウィンドウリサイズに対応
  window.addEventListener("resize", updateLayout);
// // 例：線を動的に更新
// setTimeout(() => {
//     updateLine(0, [
//         new THREE.Vector3(0, 0, 0),
//         new THREE.Vector3(2, 0, 0)
//     ]);
// }, 2000);

// setTimeout(() => {
//     updateLine(1, [
//         new THREE.Vector3(0, 0, 0),
//         new THREE.Vector3(-2, -2, 0)
//     ]);
// }, 4000);
