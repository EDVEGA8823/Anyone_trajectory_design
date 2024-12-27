function add_sequence(id) {
  let sequence_elem = document.createElement("div");
  sequence_elem.className = "sequence";
  sequence_elem.title = id + 1 + ".  " + mission_sequence.types[id];
  if (id == selected_sequence) sequence_elem.style.backgroundColor = "lightblue";
  // 内側の span 要素を作成
  const span1 = document.createElement("span");
  if (mission_sequence.planet_nums[id] == -1) span1.textContent = "---";
  else span1.textContent = planet_list[mission_sequence.planet_nums[id]];

  const span2 = document.createElement("span");
  span2.textContent = JulianToDate(mission_sequence.dates[id]).toLocaleDateString();

  span1.id = id;
  span2.id = id;
  sequence_elem.appendChild(span1);
  sequence_elem.appendChild(span2);
  sequence_elem.id = id;

  sequence.appendChild(sequence_elem);

  let add_sequence_elem = document.createElement("div");
  add_sequence_elem.className = "add_sequence";
  add_sequence_elem.id = id + 1;
  add_sequence_elem.textContent = "+ シーケンスを追加";
  sequence.appendChild(add_sequence_elem);
}
function change_sequence() {
  const sequence = document.getElementById("sequence");

  while (sequence.firstChild) {
    sequence.removeChild(sequence.firstChild);
  }
  let add_sequence_elem = document.createElement("div");
  add_sequence_elem.className = "add_sequence";
  add_sequence_elem.id = 0;
  add_sequence_elem.textContent = "+ シーケンスを追加";
  sequence.appendChild(add_sequence_elem);

  for (let i = 0; i < mission_sequence.count; i++) {
    add_sequence(i);
  }
}

function make_launch_propaty() {
  const select = document.getElementById("propaty");
  //   const select = document.querySelector('select[name="propaty"]');

  planet_list.forEach((element) => {
    // option要素を生成
    let option = document.createElement("option");

    // option要素のテキストを設定
    option.text = element;
    // option要素の値を設定
    option.value = element;

    // 生成したoption要素をselect要素に追加
    select.add(option);
  });
  select.selectedIndex = 2;
  select.addEventListener("change", function () {
    mission_sequence.planet_nums[0] = select.selectedIndex;
    change_sequence();
  });
}

function calc() {
  let planet_pos = [planet_num];
  let planet_orbits = [planet_num];
  for (let i = 0; i < planet_num; i++) {
    let elements = get_planet_elements(tmp_date, i);
    planet_elements[i] = elements;
    let orbit = get_orbit(elements);
    let pos = get_planets_pos(elements);
    planet_pos[i] = pos;
    planet_orbits[i] = orbit;
  }
  return [planet_pos, planet_orbits];
}
function update_plot() {
  let [planet_pos, planet_orbits] = calc();
  i = 0;
  update_planets(planet_pos);

  planet_orbits.forEach((orbit) => {
    // createLine(orbit, 0x000000);
    updateLine(orbit_lines[i], orbit);
    i++;
  });
  v = lambert_probrem(MU_SUN, planet_pos[2], planet_pos[3], 86400 * 200);
  par = ic2par(planet_pos[2], v[0], MU_SUN);
  //   console.log(planet_pos[2],v[0])
  //   console.log(par)
  orbit = get_orbit(par);
  //   updateLine(arcs[0], orbit);
}
function make_plot() {
  let [planet_pos, planet_orbits] = calc();
  createPlanets(planet_pos);

  planet_orbits.forEach((orbit) => {
    orbit_lines.push(createLine(orbit, 0x000000));
  });
  points = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
  arcs.push(createLine(points, 0x000000));
  //   console.log(planet_speres);

  //   console.log(orbit_lines);

  //   d = get_data(planet_pos, planet_orbits, planet_list);
  //   Plotly.newPlot("plot", d, layout);
}

make_plot();
updateLayout();

change_sequence();
make_launch_propaty();
