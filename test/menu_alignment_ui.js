/* Runtime regression for the corrected painted-menu geometry. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";

(async function () {
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-menu-align-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 830,
      players: [{ name: "Alignment QA", code: "ENFP", isBot: false }] });
    var p = UI.state.players[0]; p.tu = 999; p.stats.money = 1000;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnBegun = true;
  });
  function boxEq(got, want) { return got.join(",") === want.join(","); }
  async function open(id) {
    return page.evaluate(function (building) {
      var UI = window.PPUI, p = UI.state.players[0];
      if (UI.inScene) document.querySelector("#btn-leave-scene").click();
      p.location = building; p.tu = 999; UI.turnBegun = true;
      document.querySelector(".hotspot[data-id='" + building + "']").click();
    }, id);
  }
  async function buttons() {
    return page.$$eval("#paint-layer .paint-btn", function (nodes) { return nodes.map(function (b) {
      return { id: b.dataset.a, box: [b.style.left, b.style.top, b.style.width, b.style.height] };
    }); });
  }
  function find(rows, id, occurrence) { return rows.filter(function (r) { return r.id === id; })[occurrence || 0]; }

  await open("lowCost");
  var low = await buttons();
  if (low.map(function (r) { return r.id; }).join(",") !== "A001,A002,A003,A004,A005,A006,A007" ||
      !boxEq(find(low, "A007").box, ["72.8%","77.7%","25.5%","17%"])) throw new Error("Low-Cost grid: " + JSON.stringify(low));

  await open("luxury");
  var luxury = await buttons();
  if (luxury.length !== 8 || new Set(luxury.map(function (r) { return r.id; })).size !== 8 ||
      !boxEq(find(luxury, "A015").box, ["75.3%","79%","12.1%","19%"])) throw new Error("Heelton grid: " + JSON.stringify(luxury));

  await open("mall");
  var mall = await buttons(), mallWork = find(mall, "A118");
  if (mall.length !== 7 || !mallWork || !boxEq(mallWork.box, ["75.4%","84.5%","23.4%","15%"])) throw new Error("Mall page 1: " + JSON.stringify(mall));

  await open("university");
  var university = await buttons(), uniWork = find(university, "A075");
  if (university.length !== 7 || !boxEq(uniWork.box, ["75.4%","84.5%","23.4%","14.8%"])) throw new Error("University page 1: " + JSON.stringify(university));

  await open("airport");
  var airport = await buttons(), airportWork = find(airport, "A101");
  if (airport.length !== 7 || !boxEq(airportWork.box, ["75.4%","84.7%","23.4%","14.8%"])) throw new Error("Airport page 1: " + JSON.stringify(airport));

  await open("petShop");
  var pet = await buttons();
  if (pet.length !== 6 || !boxEq(pet[0].box, ["78.3%","12.2%","10.1%","22.3%"])) throw new Error("Pet Shop page 1: " + JSON.stringify(pet));

  await open("debtstreet");
  var debt = await buttons(), debtWork = find(debt, "A092");
  if (!boxEq(debtWork.box, ["68.5%","83%","29.5%","13.5%"])) throw new Error("Debtstreet Work: " + JSON.stringify(debtWork));

  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("MENU ALIGNMENT UI PASS", JSON.stringify({ low: low.length, luxury: luxury.length, mall: mall.length,
    university: university.length, airport: airport.length, pet: pet.length, debt: debt.length }));
})().catch(function (e) { console.error("MENU ALIGNMENT UI FAIL", e.message); process.exit(1); });
