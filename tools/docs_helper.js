// ドキュメント用のスクリーンショットを撮るための手足。
// 画面を実際に操作して作るので、出来上がった図は必ず本物の計算結果になる。
(async () => {
  const S = await import("./js/core/state.js");
  const T = await import("./js/core/trajectory.js");
  const E = await import("./js/ui/event.js");
  const M = await import("./js/main.js");
  const B = await import("./js/core/bodies.js");
  const SB = await import("./js/core/small_bodies.js");
  const P = await import("./js/view/plot.js");
  const I = await import("./js/ui/i18n.js");

  // 台本は日本語の見出しで欄やボタンを指す。英語表示のときは、
  // アプリと同じ対訳表を通していまの言語の言い方に直してから探す。
  //
  // 欄の見出しは「近点高度 [km]」のように単位が付いていて、台本はその前半
  // だけを渡す (含むかどうかで探すため)。対訳表の鍵は単位まで込みなので、
  // 単位を足した形も順に試し、引けたものを使う。
  const UNITS = ["", " [km]", " [deg]", " [km/s]", " [m/s]"];
  window.__ATD_T = (s) => {
    for (const u of UNITS) {
      const got = I.t(s + u);
      if (got !== s + u) return got.replace(/ \[[^\]]+\]$/, "");
    }
    return s;
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const State = S.State;

  const D = {
    S, T, E, M, State,
    wait,
    jd: (iso) => T.DateToJulian(new Date(iso + "T00:00:00Z")),

    async add(n) {
      for (let i = 0; i < n; i++) {
        document.querySelector(".add_sequence").click();
        await wait(300);
      }
    },

    // 保存ファイルの中身をそのまま読み込む。
    // 資料に載せる軌道は、自動調整の結果まで含めて1つのJSONに固めておき、
    // 数字と図の両方をそこから起こす (別々に作り直すと必ず食い違う)。
    async load(data) {
      const MF = await import("./js/mission/mission_file.js");
      if (!MF.loadMissionData(data, data.name || "資料の軌道")) throw new Error("読み込めなかった");
      await wait(1200);
      return D.stat();
    },

    async pick(i) {
      const cards = [...document.querySelectorAll(".sequence")];
      if (!cards[i]) throw new Error("シーケンス " + i + " が無い (" + cards.length + "個)");
      cards[i].click();
      await wait(450);
    },

    async deselect() {
      document.getElementById("deselect_sequence").click();
      await wait(400);
    },

    async body(name) {
      const sel = document.getElementById("propaty");
      // 選択欄の value は日本語のまま (中身の識別に使っている)。
      // 出ている文字ではなく value で探すので、英語表示でもそのまま通る
      let opt = null;
      for (let i = 0; i < 10 && !opt; i++) {
        opt = [...sel.options].find((o) => o.value.includes(name) || o.textContent.includes(name));
        if (!opt) await wait(300);
      }
      if (!opt) throw new Error("天体が無い: " + name);
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(700);
    },

    async type(name) {
      const sel = document.getElementById("sequence_propaty");
      // 天体を変えた直後は、選べる種別の一覧がまだ組み直されていないことがある。
      // 一度で見つからなければ少し待って探し直す
      let opt = null;
      for (let i = 0; i < 10 && !opt; i++) {
        opt = [...sel.options].find((o) => o.value === name);
        if (!opt) await wait(300);
      }
      if (!opt) throw new Error("種別が無い: " + name + " / 選べるのは " + [...sel.options].map((o) => o.value).join(","));
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(800);
    },

    // 日付はまとめて入れる。1つずつだと前後の最小間隔で切り詰められて
    // 順番に結果が左右されるため (Mission.set_dates がその面倒を見る)
    async dates(list) {
      State.mission_sequence.set_dates(list.map((x) => (x == undefined ? undefined : D.jd(x))));
      await wait(500);
      E.updateAfterAdd();
      // updateAfterAdd() だけでは軌道の弧が描き直されず、2回目以降の日付変更で
      // 前の軌道が残ったままになる (成績バーの数字だけ新しくなる)。
      // 画面から日付を触る道は update_plot() を通るので、ここでも呼んでおく。
      M.update_plot();
      await wait(600);
    },

    // 画面に映す時刻を動かす (丸をその日の位置に置く)。
    // 節を選んでいると Update_time がその節の日付を動かしてしまうので、
    // 先に選択を外してから触る。
    async when(iso) {
      document.getElementById("deselect_sequence").click();
      await wait(300);
      State.tmp_date = D.jd(iso);
      E.Update_time();
      await wait(700);
    },

    async mode(auto) {
      const row = [...document.querySelectorAll(".mode-btn")].filter((b) => b.offsetParent !== null);
      const want = window.__ATD_T ? window.__ATD_T(auto ? "自動" : "手動") : (auto ? "自動" : "手動");
      const btn = row.find((b) => b.textContent === want);
      if (!btn) throw new Error("自動/手動のボタンが見当たらない");
      btn.click();
      await wait(900);
    },

    // 手動モードの入力欄 (脱出速度 V∞ / 方位角 α / 仰角 δ など)
    async field(label_part, value) {
      const fields = [...document.querySelectorAll(".param-field")];
      const want = window.__ATD_T ? window.__ATD_T(label_part) : label_part;
      const f = fields.find((x) => x.querySelector("label") && x.querySelector("label").textContent.includes(want));
      if (!f) throw new Error("欄が無い: " + label_part + " / " + fields.map((x) => x.querySelector("label").textContent).join(","));
      const input = f.querySelector("input");
      input.value = String(value);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(700);
    },

    async addBody(set_id, name) {
      const set = await B.loadBodySet(set_id);
      const body = set.find((b) => (b.name || "") === name || (b.desig || "") === name);
      if (!body) throw new Error("天体が見つからない: " + name);
      // 「天体を追加」画面が押されたときと同じ道 (丸と軌道も作られる)
      M.import_small_body(body);
      await wait(800);
      return B.bodyLabel(body);
    },

    // 周回軌道の高さ (近点/遠点高度 [km])
    async orbit(rp_alt, ra_alt) {
      await D.field("近点高度", rp_alt);
      await D.field("遠点高度", ra_alt);
    },

    // 打上げロケットを選ぶ (成績バーの選択欄)
    async launcher(id) {
      const sel = document.getElementById("launcher");
      sel.value = id;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(600);
      return sel.options[sel.selectedIndex].textContent;
    },

    // ポークチョップ図を開く (いま選んでいる節の「出発日と到着日を探す」)
    async porkchop() {
      const btn = [...document.querySelectorAll(".pc-open")].find((b) => !b.disabled && b.offsetParent !== null);
      if (!btn) throw new Error("「出発日と到着日を探す」が押せない");
      btn.click();
      await D.pcWait();
    },

    // ポークチョップ図の計算が終わる (くるくるが消える) まで待つ。
    // 範囲を広げると1万通り解くことになり、決め打ちの待ち時間では
    // 「計算中…」のまま撮れてしまう。
    async pcWait(max_sec = 600) {
      for (let i = 0; i < max_sec; i++) {
        await wait(1000);
        const sp = document.querySelector(".pc-spinner");
        if (sp && getComputedStyle(sp).display === "none") {
          await wait(1200);
          return;
        }
      }
      throw new Error("ポークチョップ図の計算が終わらない");
    },

    // 図の色で塗る量を切り替える
    async pcMetric(label_part) {
      const sel = document.querySelector(".pc-window select");
      const want = window.__ATD_T ? window.__ATD_T(label_part) : label_part;
      const opt = [...sel.options].find((o) => o.textContent.includes(want));
      sel.value = opt.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(1500);
    },

    async pcClose() {
      const b = document.querySelector(".pc-close");
      if (b) b.click();
      await wait(500);
    },

    // 区間の周回数
    async revs(i, n) {
      State.mission_sequence.set_leg_revs(i, n);
      await wait(400);
      E.updateAfterAdd();
      await wait(500);
    },

    async tune() {
      const btn = document.getElementById("tune_btn");
      btn.click();
      for (let i = 0; i < 60; i++) {
        await wait(300);
        if (!btn.disabled) break;
      }
      await wait(500);
    },

    // 黄道面からの高さを見るための Z拡大 (押すと入り、もう一度押すと戻る)
    async zzoom() {
      document.getElementById("z_zoom").click();
      await wait(800);
    },

    // カメラを斜めから。elev は黄道面からの仰角[度]、azim は方位[度]
    async view(elev, dist, azim = 0) {
      const e = (elev * Math.PI) / 180;
      const a = (azim * Math.PI) / 180;
      P.controls.object.position.set(
        dist * Math.cos(e) * Math.sin(a),
        dist * Math.sin(e),
        dist * Math.cos(e) * Math.cos(a)
      );
      P.controls.update();
      P.invalidate();
      await wait(600);
    },

    // 上のバーの「…」を開く (共有まわりの説明で使う)
    async menu() {
      document.querySelector(".topbar-more").click();
      await wait(400);
    },

    async zoom(dist) {
      P.controls.object.position.setLength(dist);
      P.controls.update();
      P.invalidate();
      await wait(400);
    },

    // いまの成績を読む (ドキュメントに書く数字の裏取りに使う)
    stat() {
      const t = (id) => (document.getElementById(id) || {}).textContent;
      const m = State.mission_sequence;
      const nodes = [];
      for (let i = 0; i < m.count; i++) {
        const p = m.planet_num(i);
        const arr = m.leg_arrival_vinf(i);
        nodes.push({
          i,
          "種別": m.type(i),
          "天体": p == -1 ? "-" : State.planet_list[p],
          "日付": T.JulianToDate(m.date(i)).toISOString().slice(0, 10),
          "自動": m.is_auto_mode(i),
          "次のV∞": arr ? +arr.vinf.toFixed(3) : null,
          "DSM": (() => { const d = m.get_dsm_info(i); return d ? +(d.dv * 1000).toFixed(0) : null; })(),
          "投入/脱出ΔV": (() => { const o = m.get_orbit_info(i); return o ? +(o.dv * 1000).toFixed(0) : null; })(),
          "到着ΔV": (() => { const e2 = m.get_encounter_info(i); return e2 ? +(e2.dv * 1000).toFixed(0) : null; })(),
        });
      }
      const sb = [];
      for (let i = 0; i < m.count; i++) {
        const s = m.get_swingby_info(i);
        if (s) sb.push({ i, "高度": s.rp != undefined ? Math.round(s.rp) : null, "曲げ": +(s.delta * 57.2958).toFixed(1), "近点ΔV": +(s.dv_periapsis * 1000).toFixed(1) });
      }
      return {
        "脱出速度": t("v_inf"), "打上げエネルギー": t("C3"), "総ΔV": t("total_dv"),
        "打上げ質量": t("wet_mass"), "残る質量": t("dry_mass"), "期間": t("duration"),
        "節": nodes, "スイングバイ": sb,
      };
    },
  };

  window.__D = D;
  return "ok";
})()
