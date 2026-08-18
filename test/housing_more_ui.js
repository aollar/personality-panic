/* Housing/rent actions live at housing offices and never create a generic More drawer. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";

(async function () {
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-housing-more-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 829,
      players: [{ name: "Housing QA", code: "ENFP", isBot: false }] });
    var p = UI.state.players[0]; p.stats.money = 1000; p.tu = 999;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnBegun = true;
  });

  async function open(building, housing, homeless, rentTab) {
    return page.evaluate(function (args) {
      var UI = window.PPUI, p = UI.state.players[0];
      if (UI.inScene) document.querySelector("#btn-leave-scene").click();
      p.location = args.building; p.housing = args.housing; p.homeless = args.homeless;
      p.tu = 999; p.stats.money = 1000; UI.turnBegun = true;
      document.querySelector(".hotspot[data-id='" + args.building + "']").click();
      if (args.rentTab) document.querySelectorAll("#paint-layer .nav-btn.tab")[1].click();
      return {
        ids: Array.prototype.map.call(document.querySelectorAll("#paint-layer .paint-btn"), function (b) { return b.dataset.a; }),
        more: getComputedStyle(document.querySelector("#btn-more")).display !== "none",
        moreText: document.querySelector("#btn-more").textContent
      };
    }, { building: building, housing: housing, homeless: homeless, rentTab: rentTab });
  }

  // Rent due away from home and global re-housing offers must not create More.
  await page.evaluate(function () { window.PPUI.state.turn = 4; window.PPUI.state.players[0].rentPaid = false; });
  var awayRent = await open("airOne", "low", false, false);
  if (awayRent.more) throw new Error("rent-only More should be hidden: " + JSON.stringify(awayRent));
  var awayHomeless = await open("airOne", "low", true, false);
  if (awayHomeless.more) throw new Error("rehouse-only More should be hidden: " + JSON.stringify(awayHomeless));

  // The same actions remain reachable from the correct rent-office art.
  var lowResident = await open("lowCost", "low", false, true);
  var lowVisitor = await open("lowCost", "lux", false, true);
  var lowHomeless = await open("lowCost", "low", true, true);
  var luxResident = await open("luxury", "lux", false, true);
  var luxVisitor = await open("luxury", "low", false, true);
  var luxHomeless = await open("luxury", "low", true, true);
  if (!lowResident.ids.every(function (id) { return id === "X006"; })) throw new Error("Low resident office: " + JSON.stringify(lowResident));
  if (!lowVisitor.ids.every(function (id) { return id === "X004"; })) throw new Error("Low visitor office: " + JSON.stringify(lowVisitor));
  if (!lowHomeless.ids.every(function (id) { return id === "X005"; })) throw new Error("Low homeless office: " + JSON.stringify(lowHomeless));
  if (luxResident.ids.join(",") !== "X007") throw new Error("Luxury resident office: " + JSON.stringify(luxResident));
  if (luxVisitor.ids.join(",") !== "X003") throw new Error("Luxury visitor office: " + JSON.stringify(luxVisitor));
  if (luxHomeless.ids.join(",") !== "X009") throw new Error("Luxury homeless office: " + JSON.stringify(luxHomeless));

  // Real unpainted location actions still keep More available.
  var park = await open("park", "low", false, false);
  if (!park.more) throw new Error("Park real extras lost their More drawer: " + JSON.stringify(park));

  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("HOUSING MORE UI PASS", JSON.stringify({ awayRent: awayRent, awayHomeless: awayHomeless,
    low: [lowResident.ids, lowVisitor.ids, lowHomeless.ids], lux: [luxResident.ids, luxVisitor.ids, luxHomeless.ids], park: park }));
})().catch(function (e) { console.error("HOUSING MORE UI FAIL", e.message); process.exit(1); });
