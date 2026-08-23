import { State, PlotState } from './state.js';
import { AU } from './trajectory.js';

export let renderer, scene, camera, sun, labelRenderer, controls;

const axis = [];
const xticks0_1 = [], yticks0_1 = [], zticks0_1 = [];
const xticks1 = [], yticks1 = [], zticks1 = [];
const xticks5 = [], yticks5 = [], zticks5 = [];

export function initPlot() {
  const plot_area = document.getElementById("graph-panel");

  renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#plot"),
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(PlotState.width, PlotState.height);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  camera = new THREE.PerspectiveCamera(30, PlotState.width / PlotState.height, 0.01, 50000);
  camera.position.set(0, PlotState.camera_dist, 0);

  const aLight = new THREE.AmbientLight(0xffffff, 1);
  scene.add(aLight);

  const sunGeometry = new THREE.SphereGeometry(0.07, 32, 32);
  const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xeeee22 });
  sun = new THREE.Mesh(sunGeometry, sunMaterial);
  scene.add(sun);

  labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(plot_area.clientWidth, plot_area.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "75px";
  plot_area.appendChild(labelRenderer.domElement);

  controls = new THREE.OrbitControls(camera, labelRenderer.domElement);
  controls.enablePan = false;
  controls.maxDistance = 200;

  axis.push(createLine([new THREE.Vector3(-50, 0, 0), new THREE.Vector3(50, 0, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -50, 0)], 0xaaaaaa));
  axis.push(createLine([new THREE.Vector3(0, 0, -50), new THREE.Vector3(0, 0, 50)], 0xaaaaaa));

  for (let i = -5; i < 5; i = i + 0.1) {
    xticks0_1.push(createLine([new THREE.Vector3(i, 0, -0.05), new THREE.Vector3(i, 0, 0.05)], 0xaaaaaa));
    yticks0_1.push(createLine([new THREE.Vector3(0, i, -0.05), new THREE.Vector3(0, i, 0.05)], 0xaaaaaa));
    zticks0_1.push(createLine([new THREE.Vector3(-0.05, 0, i), new THREE.Vector3(0.05, 0, i)], 0xaaaaaa));
  }
  for (let i = -20; i < 20; i = i + 1) {
    if (i == 0) continue;
    xticks1.push(createLine([new THREE.Vector3(i, 0, -0.2), new THREE.Vector3(i, 0, 0.2)], 0xaaaaaa));
    yticks1.push(createLine([new THREE.Vector3(0, i, -0.2), new THREE.Vector3(0, i, 0.2)], 0xaaaaaa));
    zticks1.push(createLine([new THREE.Vector3(-0.2, 0, i), new THREE.Vector3(0.2, 0, i)], 0xaaaaaa));
  }
  for (let i = -50; i < 50; i = i + 5) {
    if (i == 0) continue;
    xticks5.push(createLine([new THREE.Vector3(i, 0, -1), new THREE.Vector3(i, 0, 1)], 0xaaaaaa));
    yticks5.push(createLine([new THREE.Vector3(0, i, -1), new THREE.Vector3(0, i, 1)], 0xaaaaaa));
    zticks5.push(createLine([new THREE.Vector3(-1, 0, i), new THREE.Vector3(1, 0, i)], 0xaaaaaa));
  }

  for (let i = -50; i < 50; i++) {
    if (i == 0) continue;
    if (i % 5 != 0 && (i < -10 || i > 10)) continue;
    
    const ticks_label_x = document.createElement("div");
    ticks_label_x.className = i % 5 != 0 ? "label_1au_x" : "label_5au_x";
    ticks_label_x.textContent = Math.abs(i) + "AU";
    ticks_label_x.style.backgroundColor = "transparent";
    axis[1].line.layers.enableAll();
    const Label_x = new THREE.CSS2DObject(ticks_label_x);
    Label_x.position.set(i, 0, i % 5 != 0 ? 0.3 : 1.3);
    axis[1].line.add(Label_x);
    Label_x.layers.set(0);

    const ticks_label_y = document.createElement("div");
    ticks_label_y.className = i % 5 != 0 ? "label_1au_y" : "label_5au_y";
    ticks_label_y.textContent = Math.abs(i) + "AU";
    ticks_label_y.style.backgroundColor = "transparent";
    const Label_y = new THREE.CSS2DObject(ticks_label_y);
    Label_y.position.set(0, i % 5 != 0 ? i + 0.04 : i + 0.5, 0);
    axis[1].line.add(Label_y);
    Label_y.layers.set(0);

    const ticks_label_z = document.createElement("div");
    ticks_label_z.className = i % 5 != 0 ? "label_1au_z" : "label_5au_z";
    ticks_label_z.textContent = Math.abs(i) + "AU";
    ticks_label_z.style.backgroundColor = "transparent";
    const Label_z = new THREE.CSS2DObject(ticks_label_z);
    Label_z.position.set(i % 5 != 0 ? 0.3 : 1.3, 0, i);
    axis[1].line.add(Label_z);
    Label_z.layers.set(0);
  }

  for (let i = 0; i < 3; i++) {
    const marker = new THREE.SphereGeometry(0.03, 32, 32);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: i == 1 ? 0x55d8ff : 0x0059b3 });
    const marker_sphere = new THREE.Mesh(marker, markerMaterial);
    marker_sphere.position.set(i, 0, 0);
    marker_sphere.visible = false;
    PlotState.marker_spheres.push(marker_sphere);
    scene.add(marker_sphere);
  }

  controls.addEventListener("change", update_camera);
  window.addEventListener("resize", updateLayout);

  update_camera();
  updateLayout();
  animate();
}

export function createPlanets(planet_pos) {
  const sphereGeometry = new THREE.SphereGeometry(0.02, 32, 32);
  const sphereMaterial = new THREE.MeshStandardMaterial({ color: 0xddaa44 });
  sphereMaterial.transparent = false;

  planet_pos.forEach((pos, i) => {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    const planetDiv = document.createElement("div");
    planetDiv.className = "label_planet";
    planetDiv.textContent = State.planet_list[i];
    planetDiv.style.backgroundColor = "transparent";
    planetDiv.style.marginTop = "-1.2em";
    planetDiv.style.cursor = "pointer";

    const planetLabel = new THREE.CSS2DObject(planetDiv);
    planetLabel.position.set(0, 0, 0);
    sphere.add(planetLabel);
    planetLabel.layers.set(0);

    sphere.position.set(pos[0] / AU, pos[2] / AU, -pos[1] / AU);
    scene.add(sphere);
    PlotState.planet_speres.push(sphere);
    sphere.name = String(i);
  });
}

export function update_planets(planet_pos) {
  planet_pos.forEach((pos, i) => {
    PlotState.planet_speres[i].position.set(pos[0] / AU, pos[2] / AU, -pos[1] / AU);
  });
}

export function createLine(initialPoints, c = 0x0000ff, width = 2) {
  const positions = new Float32Array(initialPoints.length * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  initialPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });

  const material = new THREE.LineBasicMaterial({ color: c, linewidth: width, transparent: true });
  const line = new THREE.Line(geometry, material);
  line.material.depthTest = false;
  scene.add(line);
  return { line, positions, geometry };
}

export function updateLine(lineData, newPoints) {
  const { positions, geometry } = lineData;
  if (newPoints.length > positions.length / 3) {
    console.warn("新しい頂点数が多すぎます。ジオメトリを再生成してください。");
    return;
  }
  newPoints.forEach((point, i) => {
    positions[i * 3] = point.x;
    positions[i * 3 + 1] = point.y;
    positions[i * 3 + 2] = point.z;
  });
  for (let i = newPoints.length * 3; i < positions.length; i++) {
    positions[i] = 0;
  }
  geometry.attributes.position.needsUpdate = true;
}

export function updateLayout() {
  let h = window.innerHeight - 90;
  let w = window.innerWidth / 2;
  if (window.innerWidth < window.innerHeight) {
    h = window.innerWidth - 90;
    w = window.innerWidth;
  }
  if (renderer && labelRenderer && camera) {
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

export function update_camera() {
  if (!camera) return;
  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  PlotState.camera_dist = camera.position.length();

  if (axis.length >= 3) {
    axis[0].line.material.opacity = 1 - Math.abs(direction.x);
    axis[1].line.material.opacity = 1 - Math.abs(direction.y);
    axis[2].line.material.opacity = 1 - Math.abs(direction.z);
  }

  for (let i = 0; i < yticks0_1.length; i++) {
    yticks0_1[i].positions[0] = (-camera.position.z / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[2] = (camera.position.x / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[3] = (camera.position.z / PlotState.camera_dist) * 0.05;
    yticks0_1[i].positions[5] = (-camera.position.x / PlotState.camera_dist) * 0.05;
    yticks0_1[i].geometry.attributes.position.needsUpdate = true;

    xticks0_1[i].line.material.opacity = 1 - Math.abs(direction.x) - PlotState.camera_dist * 0.06;
    yticks0_1[i].line.material.opacity = 1 - Math.abs(direction.y) - PlotState.camera_dist * 0.06;
    zticks0_1[i].line.material.opacity = 1 - Math.abs(direction.z) - PlotState.camera_dist * 0.06;
  }
  for (let i = 0; i < yticks1.length; i++) {
    yticks1[i].positions[0] = (-camera.position.z / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[2] = (camera.position.x / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[3] = (camera.position.z / PlotState.camera_dist) * 0.2;
    yticks1[i].positions[5] = (-camera.position.x / PlotState.camera_dist) * 0.2;
    yticks1[i].geometry.attributes.position.needsUpdate = true;

    xticks1[i].line.material.opacity = 1 - Math.abs(direction.x) - PlotState.camera_dist * 0.02;
    yticks1[i].line.material.opacity = 1 - Math.abs(direction.y) - PlotState.camera_dist * 0.02;
    zticks1[i].line.material.opacity = 1 - Math.abs(direction.z) - PlotState.camera_dist * 0.02;
  }
  for (let i = 0; i < yticks5.length; i++) {
    yticks5[i].positions[0] = -camera.position.z / PlotState.camera_dist;
    yticks5[i].positions[2] = camera.position.x / PlotState.camera_dist;
    yticks5[i].positions[3] = camera.position.z / PlotState.camera_dist;
    yticks5[i].positions[5] = -camera.position.x / PlotState.camera_dist;
    yticks5[i].geometry.attributes.position.needsUpdate = true;

    xticks5[i].line.material.opacity = 1 - Math.abs(direction.x);
    yticks5[i].line.material.opacity = 1 - Math.abs(direction.y);
    zticks5[i].line.material.opacity = 1 - Math.abs(direction.z);
  }

  const au_labels_x = document.getElementsByClassName("label_1au_x");
  const au_labels_y = document.getElementsByClassName("label_1au_y");
  const au_labels_z = document.getElementsByClassName("label_1au_z");
  const au_labels_5_x = document.getElementsByClassName("label_5au_x");
  const au_labels_5_y = document.getElementsByClassName("label_5au_y");
  const au_labels_5_z = document.getElementsByClassName("label_5au_z");

  for (let i = 0; i < au_labels_x.length; i++) au_labels_x[i].style.setProperty("--opacity", -Math.abs(direction.x) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_y.length; i++) au_labels_y[i].style.setProperty("--opacity", -Math.abs(direction.y) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_z.length; i++) au_labels_z[i].style.setProperty("--opacity", -Math.abs(direction.z) - PlotState.camera_dist * 0.02 + 1);
  for (let i = 0; i < au_labels_5_x.length; i++) au_labels_5_x[i].style.setProperty("--opacity", 1 - Math.abs(direction.x));
  for (let i = 0; i < au_labels_5_y.length; i++) au_labels_5_y[i].style.setProperty("--opacity", 1 - Math.abs(direction.y));
  for (let i = 0; i < au_labels_5_z.length; i++) au_labels_5_z[i].style.setProperty("--opacity", 1 - Math.abs(direction.z));

  for (let i = 0; i < PlotState.planet_speres.length; i++) {
    PlotState.planet_speres[i].scale.set(PlotState.camera_dist / 7, PlotState.camera_dist / 7, PlotState.camera_dist / 7);
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
    if (labelRenderer) labelRenderer.render(scene, camera);
  }
}
