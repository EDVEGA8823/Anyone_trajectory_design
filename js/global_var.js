is_change_time = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();


old_time = 0;
old_E = 0;
old_nu = 0;
rev_count = 1;

tmp_date = DateToJulian(new Date());
old_date = tmp_date;
planet_num = 9;
planet_elements = [];

planet_list = ["水星", "金星", "地球", "火星", "木星", "土星", "天王星", "海王星", "冥王星"];
dates = [tmp_date];
planets = [2];
arcs = [];

mission_sequence = new Mission();

selected_planet = 3;
selected_sequence = -1;
is_selected = false;

const User_Mode = {
  None: 0,
  Select: 1,
};
mode = User_Mode.None;

const Sequence_Type = {
  None: "---",
  Launch: "打上げ",
  Swingby: "スイングバイ",
  Flyby: "フライバイ",
  Orbit: "周回軌道投入",
  Rendezvous: "ランデブー",
  Maneuver: "マヌーバ",
};


//plot///////////////////////////////////////////
const orbit_lines = [];
const planet_speres = [];
camera_dist = 7;

// サイズを指定
const width = 630;
const height = 700;