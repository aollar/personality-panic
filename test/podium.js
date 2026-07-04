/* Podium + end-of-game visual check: 1-round game -> podium screenshot. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-e2e-profile"),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });

  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 1, seed: 7, players: [
      { name: "Austin", code: "ENFP", isBot: false },
      { name: "Founder", code: "INTJ", isBot: true },
      { name: "CPU 3", code: "ESTP", isBot: true }
    ]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });
  await page.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  await page.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await new Promise(function (r) { setTimeout(r, 400); });
  await page.evaluate(function () { document.querySelector("#hud-end").click(); });
  // bots finish the round, maxRounds=1 -> game over -> podium
  await page.waitForSelector("#screen-podium.show", { timeout: 30000 });
  await new Promise(function (r) { setTimeout(r, 500); });
  await page.screenshot({ path: path.join(SHOTS, "11-podium.png") });
  var rows = await page.$$eval("#podium-table tr", function (t) { return t.length; });
  console.log("podium rows:", rows, "errors:", errors.length ? errors : "none");
  if (rows !== 4) { console.error("PODIUM FAIL"); process.exit(1); }
  console.log("PODIUM PASS");
  await browser.close();
})().catch(function (e) { console.error("CRASH:", e.message); process.exit(1); });
