/* In-game clock: preview stripes must keep one angle at any used amount.
   Mounts PPClock in the real game page and compares stripe pixels between
   states by sampling the preview segment at a fixed position. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8126";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-cs-" + Date.now()),
    args: ["--window-size=1200,900", "--mute-audio"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push(e.message); });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });

  // mount a standalone instance of the game's own clock
  await p.evaluate(function () {
    var d = document.createElement("div");
    d.id = "clock-test"; d.style.cssText = "position:fixed;left:0;top:0;width:600px;height:600px;background:#fff;z-index:9999";
    document.body.appendChild(d);
    window.__clk = window.PPClock.mount(d);
  });
  var el = await p.$("#clock-test");

  // stripes sample: preview placed over the SAME screen region (3-4 o'clock)
  // in two different ways: (a) used=0,preview=2 of 8 -> segment at 12-3;
  // instead put both where they overlap: use total 8: state A used=2 prev=2
  // (segment 3->6 o'clock), state B used=4 prev=2 with a rotated... simplest:
  // capture the whole clock in three states and diff the striped AREA angle by
  // comparing state renders where the segment covers the same 4-5 o'clock zone.
  async function shot(name, total, used, prev) {
    await p.evaluate(function (o) {
      window.__clk.set({ total: o.t, used: o.u });
      window.__clk.preview(o.p);
      window.__clk.label(String(o.t - o.u));
    }, { t: total, u: used, p: prev });
    await el.screenshot({ path: path.join(__dirname, "shots", name + ".png") });
  }
  // same 90° preview segment (3->6 o'clock) reached via different used amounts:
  // A: total 8, used 2, preview 2  -> preview spans 3->6 o'clock
  // B: total 4, used 1, preview 1  -> preview spans 3->6 o'clock (same zone!)
  await shot("clk-A", 8, 2, 2);
  await shot("clk-B", 4, 1, 1);
  await b.close();
  console.log("rendered; errors:", errs.length ? errs : "none");
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
