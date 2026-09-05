"""docs/ に載せる図を、実際にアプリを操作して撮る。

  python tools/docs_shots.py <url> <シナリオ名> [--shots]

url はローカルに立てた静的サーバのもの (例: http://127.0.0.1:8421/index.html)。
画面を実際に操作して撮るので、載る図は必ず本物の計算結果になる。

--shots を付けると docs/img/ に PNG を書き出す。付けなければ数字だけ出す
(日付合わせの段階では、まず数字が妥当かを見たい)。
"""
import base64, json, os, subprocess, sys, time, urllib.request
import websocket

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)  # tools/ の1つ上
IMG = os.path.join(REPO, "docs", "img")


class Tab:
    def __init__(self, port):
        self.id = 0
        info = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list").read())
        page = next(t for t in info if t["type"] == "page")
        # ポークチョップ図のように、1手順が数分かかるものがある
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=900)

    def call(self, method, **params):
        self.id += 1
        self.ws.send(json.dumps({"id": self.id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.id:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result", {})

    def ev(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
        if r.get("exceptionDetails"):
            d = r["exceptionDetails"]
            msg = (d.get("exception") or {}).get("description") or json.dumps(d, ensure_ascii=False)
            raise RuntimeError(msg[:600])
        return r["result"].get("value")


def launch(port, w, h):
    prof = os.path.join(HERE, f"cdpprof_{port}")
    p = subprocess.Popen(
        [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars",
         f"--remote-debugging-port={port}", "--remote-allow-origins=*",
         f"--user-data-dir={prof}", f"--window-size={w},{h}",
         "--no-first-run", "--no-default-browser-check", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1)
            return p
        except Exception:
            time.sleep(0.2)
    raise RuntimeError("Edge が起動しない")


from docs_scenarios import SCENARIOS


def main():
    url = sys.argv[1]
    name = sys.argv[2]
    shots = "--shots" in sys.argv
    steps = SCENARIOS[name]()

    port = 9357
    proc = launch(port, 1500, 950)
    try:
        tab = Tab(port)
        tab.call("Page.enable")
        tab.call("Runtime.enable")
        tab.call("Emulation.setDeviceMetricsOverride", width=1500, height=950,
                 deviceScaleFactor=1, mobile=False)
        tab.call("Page.navigate", url=url)
        time.sleep(4.5)
        tab.ev(open(os.path.join(HERE, "docs_helper.js"), encoding="utf-8").read())

        def capture(shot, sel):
            os.makedirs(IMG, exist_ok=True)
            args = {"format": "png"}
            if sel:
                r = tab.ev("(() => { const e = document.querySelector(%s);"
                           "const b = e.getBoundingClientRect();"
                           "return {x:b.x,y:b.y,width:b.width,height:b.height}; })()" % json.dumps(sel))
                args["clip"] = {"x": max(r["x"] - 8, 0), "y": max(r["y"] - 8, 0),
                                "width": r["width"] + 16, "height": r["height"] + 16, "scale": 1}
            img = tab.call("Page.captureScreenshot", **args)
            with open(os.path.join(IMG, shot + ".png"), "wb") as f:
                f.write(base64.b64decode(img["data"]))

        log = []
        for step in steps:
            desc, js, shot, sel = step
            try:
                tab.ev(js)
            except Exception as ex:
                log.append({"手順": desc, "失敗": str(ex)})
                print(json.dumps(log, ensure_ascii=False, indent=1))
                return
            time.sleep(0.7)
            log.append({"手順": desc, "図": shot})
            if shots and shot:
                capture(shot, sel)

        tab.ev("__D.deselect()")
        time.sleep(0.8)
        print(json.dumps({"手順": log, "できあがり": tab.ev("__D.stat()")}, ensure_ascii=False, indent=1))
    finally:
        proc.terminate()


main()
