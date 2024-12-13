const orbit_lines = [];
const planet_speres = [];

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
camera.position.set(0, 1.5, 0);
const lines = [];
// 光源------------------
const aLight = new THREE.AmbientLight(0xffffff, 1); // 環境光源
scene.add(aLight);

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
function createPlanets(planet_pos) {
    const sphereGeometry = new THREE.SphereGeometry(0.02, 32, 32); // 半径0.5の球
    const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
    planet_pos.forEach((pos) => {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(pos.x, pos.y, pos.z);
      scene.add(sphere);
      planet_speres.push(sphere);
    });
}
function update_planets(planet_pos) {
    planet_pos.forEach((pos, i) => {
        planet_speres[i].position.set(pos.x, pos.y, pos.z);
    });
    }

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

const plot_area = document.getElementById("graph-panel");

const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(plot_area.clientWidth, plot_area.clientHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "75px";
plot_area.appendChild(labelRenderer.domElement);
const controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
controls.enablePan = false;
controls.maxDistance = 100;
// 描画ループ

const axis = [
  createLine(
    [new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)],
    0xaaaaaa
  ),
  createLine(
    [new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -50, 0)],
    0xaaaaaa
  ),
  createLine(
    [new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 0, 50)],
    0xaaaaaa
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
      0xaaaaaa
    )
  );
  yticks0_1.push(
    createLine(
      [new THREE.Vector3(0, i, -0.05), new THREE.Vector3(0, i, 0.05)],
      0xaaaaaa
    )
  );
  zticks0_1.push(
    createLine(
      [new THREE.Vector3(-0.05, 0, i), new THREE.Vector3(0.05, 0, i)],
      0xaaaaaa
    )
  );
}
for (let i = -20; i < 20; i = i + 1) {
  if (i == 0) continue;

  xticks1.push(
    createLine(
      [new THREE.Vector3(i, 0, -0.2), new THREE.Vector3(i, 0, 0.2)],
      0xaaaaaa
    )
  );
  yticks1.push(
    createLine(
      [new THREE.Vector3(0, i, -0.2), new THREE.Vector3(0, i, 0.2)],
      0xaaaaaa
    )
  );
  zticks1.push(
    createLine(
      [new THREE.Vector3(-0.2, 0, i), new THREE.Vector3(0.2, 0, i)],
      0xaaaaaa
    )
  );
}
for (let i = -50; i < 50; i = i + 5) {
  if (i == 0) continue;
  xticks5.push(
    createLine(
      [new THREE.Vector3(i, 0, -1), new THREE.Vector3(i, 0, 1)],
      0xaaaaaa
    )
  );
  yticks5.push(
    createLine(
      [new THREE.Vector3(0, i, -1), new THREE.Vector3(0, i, 1)],
      0xaaaaaa
    )
  );
  zticks5.push(
    createLine(
      [new THREE.Vector3(-1, 0, i), new THREE.Vector3(1, 0, i)],
      0xaaaaaa
    )
  );
}
const ticks_labels = [];
for (let i = -50; i < 50; i++) {
  if (i == 0) continue;
  if (i % 5 != 0 && (i < -10 || i > 10)) continue;
  const ticks_label_x = document.createElement("div");

  if (i % 5 != 0) ticks_label_x.className = "label_1au_x";
  else ticks_label_x.className = "label_5au_x";
  ticks_label_x.textContent = Math.abs(i) + "AU";
  ticks_label_x.style.backgroundColor = "transparent";

  axis[1].line.layers.enableAll();
  const Label_x = new THREE.CSS2DObject(ticks_label_x);
  if (i % 5 != 0) Label_x.position.set(i, 0, 0.3);
  else Label_x.position.set(i, 0, 1.3);

  axis[1].line.add(Label_x);
  Label_x.layers.set(0);

  const ticks_label_y = document.createElement("div");

  if (i % 5 != 0) ticks_label_y.className = "label_1au_y";
  else ticks_label_y.className = "label_5au_y";
  ticks_label_y.textContent = Math.abs(i) + "AU";
  ticks_label_y.style.backgroundColor = "transparent";

  axis[1].line.layers.enableAll();
  const Label_y = new THREE.CSS2DObject(ticks_label_y);
  if (i % 5 != 0) Label_y.position.set(0, i + 0.04, 0);
  else Label_y.position.set(0, i + 0.5, 0);

  axis[1].line.add(Label_y);
  Label_y.layers.set(0);

  const ticks_label_z = document.createElement("div");

  if (i % 5 != 0) ticks_label_z.className = "label_1au_z";
  else ticks_label_z.className = "label_5au_z";
  ticks_label_z.textContent = Math.abs(i) + "AU";
  ticks_label_z.style.backgroundColor = "transparent";

  axis[1].line.layers.enableAll();
  const Label_z = new THREE.CSS2DObject(ticks_label_z);
  if (i % 5 != 0) Label_z.position.set(0.3, 0, i);
  else Label_z.position.set(1.3, 0, i);

  axis[1].line.add(Label_z);
  Label_z.layers.set(0);


}

function updateLayout() {
  h = window.innerHeight - 90;
  w = window.innerWidth / 2;
  if (window.innerWidth < window.innerHeight) {
    h = window.innerWidth - 90;
    w = window.innerWidth;
  }
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
  renderer.render(scene, camera); // レンダリング
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function update_camera() {
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  dist = camera.position.length();
  axis[0].line.material.opacity = 1-Math.abs(direction.x) ;
  axis[1].line.material.opacity = 1-Math.abs(direction.y) ;
  axis[2].line.material.opacity = 1-Math.abs(direction.z) ;

  for (let i = 0; i < yticks0_1.length; i++) {
    yticks0_1[i].positions[0] = (-camera.position.z / dist) * 0.05;
    yticks0_1[i].positions[2] = (camera.position.x / dist) * 0.05;

    yticks0_1[i].positions[3] = (camera.position.z / dist) * 0.05;
    yticks0_1[i].positions[5] = (-camera.position.x / dist) * 0.05;
    yticks0_1[i].geometry.attributes.position.needsUpdate = true;

    xticks0_1[i].line.material.opacity = 1-Math.abs(direction.x)  - dist * 0.3;
    yticks0_1[i].line.material.opacity = 1-Math.abs(direction.y)  - dist * 0.3;
    zticks0_1[i].line.material.opacity = 1-Math.abs(direction.z)  - dist * 0.3;
  }
  for (let i = 0; i < yticks1.length; i++) {
    yticks1[i].positions[0] = (-camera.position.z / dist) * 0.2;
    yticks1[i].positions[2] = (camera.position.x / dist) * 0.2;

    yticks1[i].positions[3] = (camera.position.z / dist) * 0.2;
    yticks1[i].positions[5] = (-camera.position.x / dist) * 0.2;
    yticks1[i].geometry.attributes.position.needsUpdate = true;

    xticks1[i].line.material.opacity = 1-Math.abs(direction.x)  - dist * 0.06;
    yticks1[i].line.material.opacity = 1-Math.abs(direction.y)  - dist * 0.06;
    zticks1[i].line.material.opacity = 1-Math.abs(direction.z)  - dist * 0.06;
  }
  for (let i = 0; i < yticks5.length; i++) {
    yticks5[i].positions[0] = -camera.position.z / dist;
    yticks5[i].positions[2] = camera.position.x / dist;

    yticks5[i].positions[3] = camera.position.z / dist;
    yticks5[i].positions[5] = -camera.position.x / dist;
    yticks5[i].geometry.attributes.position.needsUpdate = true;

    xticks5[i].line.material.opacity = 1-Math.abs(direction.x) ;
    yticks5[i].line.material.opacity = 1-Math.abs(direction.y) ;
    zticks5[i].line.material.opacity = 1-Math.abs(direction.z) ;
  }
  au_labels_x = document.getElementsByClassName("label_1au_x");
  au_labels_y = document.getElementsByClassName("label_1au_y");
  au_labels_z = document.getElementsByClassName("label_1au_z");

  au_labels_5_x = document.getElementsByClassName("label_5au_x");
  au_labels_5_y = document.getElementsByClassName("label_5au_y");
  au_labels_5_z = document.getElementsByClassName("label_5au_z");
  for (let i = 0; i < au_labels_x.length; i++) {
    const au_label = au_labels_x[i];
    au_label.style.setProperty(
      "--opacity",
      -Math.abs(direction.x) - dist * 0.04 +1
    );
  }
  for (let i = 0; i < au_labels_y.length; i++) {
    const au_label = au_labels_y[i];
    au_label.style.setProperty(
      "--opacity",
      -Math.abs(direction.y) - dist * 0.04 +1
    );
  }
  for (let i = 0; i < au_labels_z.length; i++) {
    const au_label = au_labels_z[i];
    au_label.style.setProperty(
      "--opacity",
      -Math.abs(direction.z) - dist * 0.04 +1
    );
  }
  for (let i = 0; i < au_labels_5_x.length; i++) {
    const au_label_5 = au_labels_5_x[i];    
    au_label_5.style.setProperty(
        "--opacity",
        1-Math.abs(direction.x) 
      );
  }
  for (let i = 0; i < au_labels_5_y.length; i++) {
    const au_label_5 = au_labels_5_y[i];
    au_label_5.style.setProperty(
      "--opacity",
      1-Math.abs(direction.y) 
    );
  }

  for (let i = 0; i < au_labels_5_z.length; i++) {
    const au_label_5 = au_labels_5_z[i];
    au_label_5.style.setProperty(
      "--opacity",
      1-Math.abs(direction.z) 
    );
  }
  for(i=0;i<planet_speres.length;i++){
    planet_speres[i].scale.set(dist/1.5,dist/1.5,dist/1.5);
  }
}
controls.addEventListener("change", update_camera);

// // // 初回のレイアウト更新
update_camera()
// // // ウィンドウリサイズに対応
window.addEventListener("resize", updateLayout);
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();