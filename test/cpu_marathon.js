/* CPU marathon: 4 bots play a 12-round game in the REAL UI (rent turns 4/8/12
   included — the reported freeze zone). Must reach the podium with no hang. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8125";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-mar-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push("PAGEERROR " + e.message); });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 12, seed: 8, players: [
      { name: "CPU A", code: "ENFP", isBot: true }, { name: "CPU B", code: "INTJ", isBot: true },
      { name: "CPU C", code: "ESTP", isBot: true }, { name: "CPU D", code: "ISFJ", isBot: true }]});
    UI.cfg = { hints: false, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [];
    UI.startGameUI(false);
  });
  var lastTurn = 0, stuckSince = Date.now();
  for (var i = 0; i < 240; i++) {
    await new Promise(function (r) { setTimeout(r, 500); });
    var st = await p.evaluate(function () {
      return { turn: window.PPUI.state.turn, over: window.PPUI.state.over,
               podium: document.querySelector("#screen-podium").classList.contains("show") };
    });
    if (st.turn !== lastTurn) { lastTurn = st.turn; stuckSince = Date.now(); }
    if (st.podium) { console.log("PODIUM reached at turn", st.turn); break; }
    if (Date.now() - stuckSince > 20000) {
      console.error("MARATHON FAIL: stuck at turn", st.turn, "for 20s");
      await p.screenshot({ path: path.join(__dirname, "shots", "marathon-stuck.png") });
      process.exit(1);
    }
  }
  var done = await p.evaluate(function () {
    return document.querySelector("#screen-podium").classList.contains("show");
  });
  if (!done) { console.error("MARATHON FAIL: never reached podium"); process.exit(1); }
  if (errs.length) { console.error("MARATHON errors:", errs); process.exit(1); }
  console.log("CPU MARATHON PASS — 4 bots, 12 rounds incl. rent turns, no freeze, no errors");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
