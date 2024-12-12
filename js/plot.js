const orbit_lines = [];
// サイズを指定
const width = 630;
const height = 700;

// レンダラーを作成
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector("#plot"),
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);

// 複数の線を管理する配列
// 基本設定
const scene = new THREE.Scene();

scene.background = new THREE.Color(0xffffff);
// テクスチャローダーを作成して画像を読み込む
const loader = new THREE.TextureLoader();
loader.setCrossOrigin("anonymous"); // クロスオリジン設定

const backgroundTexture = loader.load("./textures/hipp8.jpg");

// const camera = new THREE.PerspectiveCamera(15, 1, 1, 1000);
// camera.position.z = 5;
const camera = new THREE.PerspectiveCamera(90, width / height, 0.1, 50000);
camera.position.set(0, 1, 0);
const lines = [];
// 光源------------------
const aLight = new THREE.AmbientLight(0xffffff, 1); // 環境光源
scene.add(aLight);

const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';

// document.body.appendChild(labelRenderer.domElement);
//球体
// const sphere = new THREE.Mesh(
//     new THREE.IcosahedronGeometry( 25000, 30 ),
//     new THREE.MeshPhongMaterial({
//       map: backgroundTexture
//     }),
//   );
//   sphere.geometry.scale(-1, 1, 1); //表面を内側に向ける
//   sphere.rotation.z = -Math.PI/2; //反転
//   scene.add(sphere);
// 線を作成する関数
function createLine(initialPoints, c = 0x0000ff) {
  const positions = new Float32Array(initialPoints.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // 初期データを設定
  initialPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });

  const material = new THREE.LineBasicMaterial({
    color: c,
    transparent: true,
  });
  const line = new THREE.Line(geometry, material);

  // シーンに追加
  scene.add(line);

  // 管理配列に追加
  return { line, positions, geometry };
}

// 線を更新する関数
function updateLine(lineData, newPoints) {
  const { positions, geometry } = lineData;
  if (newPoints.length > positions.length / 3) {
    console.warn("新しい頂点数が多すぎます。ジオメトリを再生成してください。");
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

// 点を管理する配列
const pointsArray = [];

function createPlanets(){

}

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.maxDistance = 100;
// 描画ループ
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

const axis = [
  createLine(
    [new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)],
    0xcccccc
  ),
  createLine(
    [new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -50, 0)],
    0xcccccc
  ),
  createLine(
    [new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 0, 50)],
    0xcccccc
  ),
];
const xticks0_1 = [];
const yticks0_1 = [];
const zticks0_1 = [];

const xticks1 = [];
const yticks1 = [];
const zticks1 = [];

const xticks5 = [];
const yticks5 = [];
const zticks5 = [];

for (let i = -5; i < 5; i = i + 0.1) {
  xticks0_1.push(
    createLine(
      [new THREE.Vector3(i, 0, -0.05), new THREE.Vector3(i, 0, 0.05)],
      0xcccccc
    )
  );
  yticks0_1.push(
    createLine(
      [new THREE.Vector3(0, i, -0.05), new THREE.Vector3(0, i, 0.05)],
      0xcccccc
    )
  );
  zticks0_1.push(
    createLine(
      [new THREE.Vector3(-0.05, 0, i), new THREE.Vector3(0.05, 0, i)],
      0xcccccc
    )
  );
}
for (let i = -20; i < 20; i = i + 1) {
  if (i == 0) continue;

  xticks1.push(
    createLine(
      [new THREE.Vector3(i, 0, -0.2), new THREE.Vector3(i, 0, 0.2)],
      0xcccccc
    )
  );
  yticks1.push(
    createLine(
      [new THREE.Vector3(0, i, -0.2), new THREE.Vector3(0, i, 0.2)],
      0xcccccc
    )
  );
  zticks1.push(
    createLine(
      [new THREE.Vector3(-0.2, 0, i), new THREE.Vector3(0.2, 0, i)],
      0xcccccc
    )
  );
}
for (let i = -50; i < 50; i = i + 5) {
  if (i == 0) continue;
  xticks5.push(
    createLine(
      [new THREE.Vector3(i, 0, -1), new THREE.Vector3(i, 0, 1)],
      0xcccccc
    )
  );
  yticks5.push(
    createLine(
      [new THREE.Vector3(0, i, -1), new THREE.Vector3(0, i, 1)],
      0xcccccc
    )
  );
  zticks5.push(
    createLine(
      [new THREE.Vector3(-1, 0, i), new THREE.Vector3(1, 0, i)],
      0xcccccc
    )
  );
}
console.log(axis);

function updateLayout() {
  // const angle = cameraDirection.angleTo(lineDirection);

  h = window.innerHeight - 90;
  w = window.innerWidth / 2;
  if (window.innerWidth < window.innerHeight) {
    h = window.innerWidth - 90;
    w = window.innerWidth;
  }
  renderer.setSize(w, h);
  renderer.render(scene, camera); // レンダリング
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function update_camera() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  dist = camera.position.length();
  axis[1].line.material.opacity = Math.cos(direction.y * 1.5);

  //   ang=Math.atan2(camera.position.z,camera.position.x)
  for (let i = 0; i < yticks0_1.length; i++) {
    // xticks[i].positions[2]=dist*0.1;
    // xticks[i].geometry.attributes.position.needsUpdate = true;
    yticks0_1[i].positions[0] = (-camera.position.z / dist) * 0.05;
    yticks0_1[i].positions[2] = (camera.position.x / dist) * 0.05;

    yticks0_1[i].positions[3] = (camera.position.z / dist) * 0.05;
    yticks0_1[i].positions[5] = (-camera.position.x / dist) * 0.05;
    yticks0_1[i].geometry.attributes.position.needsUpdate = true;

    xticks0_1[i].line.material.opacity = 1 - dist * 0.3;
    yticks0_1[i].line.material.opacity =
      Math.cos(direction.y * 1.5) - dist * 0.3;
    zticks0_1[i].line.material.opacity = 1 - dist * 0.3;
  }
  for (let i = 0; i < yticks1.length; i++) {
    yticks1[i].positions[0] = (-camera.position.z / dist) * 0.2;
    yticks1[i].positions[2] = (camera.position.x / dist) * 0.2;

    yticks1[i].positions[3] = (camera.position.z / dist) * 0.2;
    yticks1[i].positions[5] = (-camera.position.x / dist) * 0.2;
    yticks1[i].geometry.attributes.position.needsUpdate = true;

    xticks1[i].line.material.opacity = 1 - dist * 0.06;
    yticks1[i].line.material.opacity =
      Math.cos(direction.y * 1.5) - dist * 0.06;
    zticks1[i].line.material.opacity = 1 - dist * 0.06;
  }
  for (let i = 0; i < yticks5.length; i++) {
    yticks5[i].positions[0] = -camera.position.z / dist;
    yticks5[i].positions[2] = camera.position.x / dist;

    yticks5[i].positions[3] = camera.position.z / dist;
    yticks5[i].positions[5] = -camera.position.x / dist;
    yticks5[i].line.material.opacity = Math.cos(direction.y * 1.5);
    yticks5[i].geometry.attributes.position.needsUpdate = true;
  }
  // console.log(direction);
}
controls.addEventListener("change", update_camera);

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

