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
    `<div class="sequence" title="打ち上げ"><span>` +
    planet_list[planets[0]] +
    `</span> <span>` +
    JulianToDate(dates[0]).toLocaleDateString() +
    `</span> </div>`;
}

function make_launch_propaty() {
  //   const propaty = document.getElementById("propaty");
  //   propaty.innerHTML = `
  //   <label for="planet">出発天体</label>
  //     <select id="planet">
  //       <option value="Mercury">水星</option>
  //       <option value="Venus" selected>金星</option>
  //       <option value="Earth" selected>地球</option>
  //     </select>
  //     `;
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
    .toLocaleString()
    .replace(" ", "T")
    .replace("/", "-")
    .replace("/", "-")
    .slice(0, -3);
}

function calc() {
  let planet_pos = [planet_num];
  let planet_orbits = [planet_num];
  for (let i = 0; i < planet_num; i++) {
    let elements = get_planet_elements(dates[0], i);
    let orbit = get_orbit(elements);
    let pos = get_planets_pos(elements).mul(1 / AU);
    planet_pos[i] = pos;
    planet_orbits[i] = orbit;
  }
  return [planet_pos, planet_orbits];
}
function update_plot() {
  let [planet_pos, planet_orbits] = calc();
  d = get_data(planet_pos, planet_orbits, planet_list);
  Plotly.react("plot", d,layout);
}
function make_plot() {
  let [planet_pos, planet_orbits] = calc();
  d = get_data(planet_pos, planet_orbits, planet_list);
  Plotly.newPlot("plot", d,layout);
}

let date_time=document.getElementById("date_time");
date_time.addEventListener("change", function(){
    dates[0] = DateToJulian(new Date(date_time.value));
    update_plot();
    make_launch_sequence();
});

make_plot();
updateLayout();

make_launch_sequence();
make_launch_propaty();
