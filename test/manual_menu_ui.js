/* Browser regression for updated manual-card hotspots and conditional More drawer. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";

(async function () {
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-manual-menu-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 828,
      players: [{ name: "Menu QA", code: "ENFP", isBot: false }] });
    var p = UI.state.players[0]; p.stats.money = 1000; p.tu = 999;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnBegun = true;
  });
  async function inspect(building) {
    return page.evaluate(function (id) {
      var UI = window.PPUI, p = UI.state.players[0];
      if (UI.inScene) document.querySelector("#btn-leave-scene").click();
      p.location = id; p.tu = 999; UI.turnBegun = true;
      document.querySelector(".hotspot[data-id='" + id + "']").click();
      return {
        ids: Array.prototype.map.call(document.querySelectorAll("#paint-layer .paint-btn"), function (b) { return b.dataset.a; }),
        moreVisible: getComputedStyle(document.querySelector("#btn-more")).display !== "none",
        moreText: document.querySelector("#btn-more").textContent
      };
    }, building);
  }
  var checks = {
    park: { ids: ["A018","A019","A020","A021","A022","A023"], more: true },
    regretBurger: { ids: ["A034","A035","A036","A037","A038","A040","A039","A041"], more: true },
    gym: { ids: ["A042","A043","A044","A045","A046","A047","A048","A049"], more: false },
    temple: { ids: ["A058","A059","A060","A061","A062","A063","A064","A065","A066"], more: false },
    soulExchange: { ids: ["A076","A078","A079","A080","A081","A082","A083","A084","A077"], more: false },
    airOne: { ids: ["A026","A027","A028","A029","A031","A032","A030","A033"], more: false }
  };
  var results = {};
  for (var id of Object.keys(checks)) {
    results[id] = await inspect(id);
    if (results[id].ids.join(",") !== checks[id].ids.join(",")) throw new Error(id + " ids " + results[id].ids.join(","));
    if (results[id].moreVisible !== checks[id].more) throw new Error(id + " More state " + JSON.stringify(results[id]));
  }
  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("MANUAL MENU UI PASS", JSON.stringify(results));
})().catch(function (e) { console.error("MANUAL MENU UI FAIL", e.message); process.exit(1); });
