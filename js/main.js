function add_sequence(id) {
  let sequence_elem = document.createElement("div");
  sequence_elem.className = "sequence";
  sequence_elem.title = id + 1 + ".  " + mission_sequence.type(id);
  if (id == selected_sequence) sequence_elem.style.backgroundColor = "lightblue";
  // 内側の span 要素を作成
  const span1 = document.createElement("span");
  if (mission_sequence.planet_num(id) == -1) span1.textContent = "---";
  else span1.textContent = planet_list[mission_sequence.planet_num(id)];

  const span2 = document.createElement("span");
  span2.textContent = JulianToDate(mission_sequence.date(id)).toLocaleDateString();

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
  v=mission_sequence.get_v_inf(selected_sequence)
  v_inf.textContent=v.toFixed(2);
  C3.textContent=(v*v).toFixed(2);
}

function change_sequence_propaty() {
  const select = document.getElementById("propaty");
  while (select.firstChild) {
    select.removeChild(select.firstChild);
  }
  let option0 = document.createElement("option");
  option0.text = "---";
  option0.value = "default";
  option0.hidden = true; // hidden 属性を設定
  option0.selected = true; // 初期選択状態に設定
  select.add(option0);

  planet_list.forEach((element) => {
    let option = document.createElement("option");
    option.text = element;
    option.value = element;
    select.add(option);
  });
  select.selectedIndex = mission_sequence.planet_num(selected_sequence) + 1;
  select.onchange = function () {
    mission_sequence.set_planet_num(selected_sequence, select.selectedIndex - 1);
    change_sequence();
    update_plot();
  };

  const sequence_propaty = document.getElementById("sequence_propaty");
  while (sequence_propaty.firstChild) {
    sequence_propaty.removeChild(sequence_propaty.firstChild);
  }

  if (selected_sequence != 0) {
    let option1 = document.createElement("option");
    option1.text = "変更";
    option1.value = "default";
    option1.hidden = true; // hidden 属性を設定
    option1.selected = true; // 初期選択状態に設定
    sequence_propaty.add(option1);

    Object.values(Sequence_Type).forEach((value, i) => {
      let option = document.createElement("option");
      option.text = value;
      option.value = value;
      if (i > 1) {
        if (mission_sequence.planet_num(selected_sequence) < 10) {
          //惑星の場合
          if (value != Sequence_Type.Flyby && value != Sequence_Type.Rendezvous) {
            sequence_propaty.add(option);
          }
        } else {
          if (value != Sequence_Type.Swingby && value != Sequence_Type.Orbit) {
            //小天体の場合
            sequence_propaty.add(option);
          }
        }
      }
    });
  }
  const sequence_type = document.getElementById("sequence_type");

  sequence_propaty.onchange = function () {
    mission_sequence.set_type(selected_sequence, sequence_propaty.value);
    change_sequence();
    sequence_propaty.selectedIndex = 0;
    sequence_type.textContent = mission_sequence.type(selected_sequence);
  };

  sequence_type.textContent = mission_sequence.type(selected_sequence);
}

function calc() {
  let planet_pos = [planet_num];
  let planet_orbits = [planet_num];
  for (let i = 0; i < planet_num; i++) {
    let elements = get_planet_elements(tmp_date, i);
    planet_elements[i] = elements;
    let orbit = get_orbit(elements);
    let {r,v} = get_planets_pos(elements);
    planet_pos[i] = r;
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
// console.log(mission_sequence)
//   orbit = mission_sequence.get_trajectory(0)
if(mission_sequence.get_trajectory(0).length!=0){
    // console.log(mission_sequence.get_trajectory(0))
updateLine(arcs[0], mission_sequence.get_trajectory(0));
}
  return
  v = lambert_probrem(MU_SUN, planet_pos[2], planet_pos[3], 86400 * 200);
  par = ic2par(planet_pos[2], v[0], MU_SUN);
  //   console.log(planet_pos[2],v[0])
  //   console.log(par)
  //   updateLine(arcs[0], orbit);
}
function make_plot() {
  let [planet_pos, planet_orbits] = calc();
  createPlanets(planet_pos);

  planet_orbits.forEach((orbit) => {
    orbit_lines.push(createLine(orbit, 0x000000));
  });
  points = Array.from({ length: 100 }, () => new THREE.Vector3(0, 0, 0));
  arcs.push(createLine(points, 0x0000ff));
  //   console.log(planet_speres);

  //   console.log(orbit_lines);

  //   d = get_data(planet_pos, planet_orbits, planet_list);
  //   Plotly.newPlot("plot", d, layout);
}

make_plot();
updateLayout();

change_sequence();
change_sequence_propaty();
