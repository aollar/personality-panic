/* Walker follows the road graph: command real walks, sample the avatar's
   position mid-walk, and verify arrival lands on the destination ENTRANCE. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8126";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-walk-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push(e.message); });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 3, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
  });

  var fails = [];
  var trips = [["mall", "debtstreet"], ["university", "petShop"], ["airport", "temple"],
               ["airport", "luxury"], ["club", "park"], ["soulExchange", "park"],
               ["university", "lowCost"], ["university", "temple"]];
  for (var i = 0; i < trips.length; i++) {
    var from = trips[i][0], to = trips[i][1];
    await p.evaluate(function (from) {
      var UI = window.PPUI;
      UI.state.players[0].location = from;
      UI.state.players[0].tu = 40;
      UI.walker.jumpTo(from);
      UI.inScene = null;
      document.querySelector("#scene-view").classList.remove("show");
    }, from);
    await p.evaluate(function (to) {
      document.querySelector(".hotspot[data-id='" + to + "']").click();
    }, to);
    // sample the avatar every 350ms while it walks
    var samples = [];
    for (var s = 0; s < 14; s++) {
      await new Promise(function (r) { setTimeout(r, 350); });
      var st = await p.evaluate(function () {
        var UI = window.PPUI;
        return { pos: UI.walker.pos.slice(), inScene: UI.inScene };
      });
      samples.push(st.pos);
      if (st.inScene) break;
    }
    var end = await p.evaluate(function (to) {
      var E = window.PPEngine, UI = window.PPUI;
      // multi-entrance zones (the park): arriving at ANY declared edge point is correct
      var wants = E.DATA.buildings[to].entrances || [E.NODE_POS[to]];
      return { pos: UI.walker.pos.slice(), wants: wants, inScene: UI.inScene };
    }, to);
    var hit = end.wants.some(function (w) {
      return Math.abs(end.pos[0] - w[0]) <= 0.5 && Math.abs(end.pos[1] - w[1]) <= 0.5;
    });
    if (!hit)
      fails.push(from + "->" + to + ": arrived at " + end.pos + " want one of " + JSON.stringify(end.wants));
    if (end.inScene !== to)
      fails.push(from + "->" + to + ": scene did not open (inScene=" + end.inScene + ")");
    console.log(from + " -> " + to + ": " + samples.length + " samples, arrived", end.pos, "scene:", end.inScene);
    await p.evaluate(function () {
      var btn = document.querySelector("#btn-leave-scene");
      if (btn) btn.click();
    });
  }
  await b.close();
  if (errs.length) fails.push("page errors: " + errs.join(" | "));
  if (fails.length) { console.error("FAIL\n" + fails.join("\n")); process.exit(1); }
  console.log("WALK ROADS PASS — arrivals land on entrances, scenes open");
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
