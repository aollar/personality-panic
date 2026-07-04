/* Bad Decisions Club scene: video + animated side menu iframe wired to engine. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-club-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run",
           "--autoplay-policy=no-user-gesture-required"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });

  // boot a game where the player starts rich + dressed, standing at the club
  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 3, players: [
      { name: "Austin", code: "ENFP", isBot: false },
      { name: "CPU", code: "INTJ", isBot: true }
    ]});
    var p = UI.state.players[0];
    p.items.push("Dressy Clothes");
    p.stats.money = 90;
    p.location = "club";
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });
  await page.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  await page.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await page.evaluate(function () { document.querySelector(".hotspot[data-id='club']").click(); });
  await page.waitForSelector("#scene-view.show", { timeout: 8000 });
  // iframe menu must load
  await page.waitForFunction(function () {
    var f = document.querySelector("#bdc-frame");
    return f && f.style.display !== "none" && f.contentWindow && f.contentDocument &&
      f.contentDocument.querySelector(".decision-card");
  }, { timeout: 10000, polling: 300 });
  await new Promise(function (r) { setTimeout(r, 1200); });
  await page.screenshot({ path: path.join(SHOTS, "14-club.png") });

  // click the Dance card inside the iframe -> engine A050 should fire
  var before = await page.evaluate(function () { return window.PPUI.state.players[0].stats.connection; });
  await page.evaluate(function () {
    var f = document.querySelector("#bdc-frame");
    f.contentDocument.querySelector('.decision-card[data-card="dance"]').click();
  });
  await new Promise(function (r) { setTimeout(r, 800); });
  var after = await page.evaluate(function () { return window.PPUI.state.players[0].stats.connection; });
  console.log("connection before/after Dance:", before, "->", after);
  await page.screenshot({ path: path.join(SHOTS, "15-club-danced.png") });
  if (after <= before) { console.error("CLUB FAIL: Dance did not apply"); process.exit(1); }
  var real = errors.filter(function (e) { return !/autoplay|play\(\)/i.test(e); });
  if (real.length) { console.error("CLUB FAIL errors:", real); process.exit(1); }
  console.log("CLUB PASS");
  await browser.close();
})().catch(function (e) { console.error("CLUB CRASH:", e.message); process.exit(1); });
