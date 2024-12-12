tmp_date = DateToJulian(new Date());
planet_num = 9;

planet_list = [
  "水星",
  "金星",
  "地球",
  "火星",
  "木星",
  "土星",
  "天王星",
  "海王星",
  "冥王星",
];
dates = [tmp_date];
planets = [2];

function make_launch_sequence() {
  const sequence = document.getElementById("sequence");
  sequence.innerHTML =
    `<div class="sequence" title="打上げ"><span>` +
    planet_list[planets[0]] +
    `</span> <span>` +
    JulianToDate(dates[0]).toLocaleDateString() +
    `</span> </div>`;
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
  select.selectedIndex = planets[0];
  select.addEventListener("change", function () {
    planets[0] = select.selectedIndex;
    make_launch_sequence();
  });

  const date_time = document.getElementById("date_time");
  date_time.value = JulianToDate(dates[0])
    .toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replaceAll("/", "-");
}

function calc() {
  let planet_pos = [planet_num];
  let planet_orbits = [planet_num];
  for (let i = 0; i < planet_num; i++) {
    let elements = get_planet_elements(dates[0], i);
    let orbit = get_orbit(elements);
    let pos = change_coordinate(
      get_planets_pos(elements).multiplyScalar(1 / AU)
    );
    planet_pos[i] = pos;
    planet_orbits[i] = orbit;
  }
  return [planet_pos, planet_orbits];
}
function update_plot() {
  let [planet_pos, planet_orbits] = calc();
  i=0;
  planet_orbits.forEach((orbit) => {
    // createLine(orbit, 0x000000);
    updateLine(orbit_lines[i], orbit);
    i++;
  });
//   createPoints(planet_pos);
}
function make_plot() {
  let [planet_pos, planet_orbits] = calc();
  planet_orbits.forEach((orbit) => {
    orbit_lines.push(createLine(orbit, 0x000000));
  });
//   createPoints(planet_pos);
  console.log(orbit_lines);

  //   d = get_data(planet_pos, planet_orbits, planet_list);
  //   Plotly.newPlot("plot", d, layout);
}

make_plot();
updateLayout();

make_launch_sequence();
make_launch_propaty();
