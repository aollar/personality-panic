/*
 * Headless end-to-end test: drives the real UI in Edge.
 * start -> setup -> pick characters -> start game -> move -> action -> end turn
 * -> bot turn -> reload (save/resume). Captures console errors + screenshots.
 *
 *   node test/e2e.js
 * Requires the static server:  python -m http.server 8123
 */
var puppeteer = require("puppeteer-core");
var path = require("path");

var CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = process.env.SHOT_DIR || path.join(__dirname, "shots");
var URL = "http://localhost:8123/index.html";
var os = require("os");

(async function () {
  var fs = require("fs");
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    // Fresh profile each run so we never test a stale cached copy of the CSS/JS.
    userDataDir: path.join(os.tmpdir(), "pp-e2e-profile-" + Date.now()),
    args: ["--window-size=1700,1000", "--autoplay-policy=no-user-gesture-required", "--mute-audio",
           "--no-first-run", "--disable-features=Translate"]
  });
  var page = await browser.newPage();
  await page.setCacheEnabled(false); // always load current assets, not the HTTP cache
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", function (e) { errors.push("PAGEERROR: " + e.message); });

  async function shot(name) { await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }
  async function domClick(sel) { await page.evaluate(function (s) { document.querySelector(s).click(); }, sel); }
  function fail(msg) { console.error("E2E FAIL:", msg); console.error("console errors:", errors); process.exit(1); }
  // Guard: exactly one .screen may be visibly displayed at a time (catches opaque
  // screens stuck on top of others — the settings-overlay bug that hid the map).
  async function assertOneScreen(expected) {
    var info = await page.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll(".screen"), function (s) {
        return { id: s.id, display: getComputedStyle(s).display };
      });
    });
    var vis = info.filter(function (s) { return s.display !== "none"; }).map(function (s) { return s.id; });
    if (vis.length !== 1 || vis[0] !== "screen-" + expected) {
      fail("expected only #screen-" + expected + " visible, got " + JSON.stringify(vis));
    }
  }

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("#btn-single", { timeout: 10000 });
  await shot("01-start");

  // start screen -> setup
  await domClick("#btn-single");
  await page.waitForSelector("#screen-setup.show", { timeout: 5000 });
  await assertOneScreen("setup");
  await shot("02-setup");

  // pick characters for both slots (P1 + CPU)
  var cards = await page.$$("#char-grid .char-card");
  if (cards.length !== 16) fail("expected 16 character cards, got " + cards.length);
  await page.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[13].click(); }); // Campaigner for P1
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(function () {
    var c = document.querySelectorAll("#char-grid .char-card")[0]; // Daredevil for CPU
    c.click();
  });
  await new Promise(r => setTimeout(r, 300));
  var startDisabled = await page.$eval("#btn-start-game", function (b) { return b.disabled; });
  if (startDisabled) fail("start button still disabled after picking characters");
  await shot("03-setup-picked");

  // start the game
  await domClick("#btn-start-game");
  await page.waitForSelector("#screen-game.show", { timeout: 5000 });
  await page.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  await assertOneScreen("game");
  await shot("04-turncard");
  await domClick("#btn-begin-turn");
  await new Promise(r => setTimeout(r, 500));
  await shot("05-overmap");

  // enter current building (Low Cost Housing)
  await page.evaluate(function () {
    document.querySelector(".hotspot[data-id='lowCost']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 6000 });
  await new Promise(r => setTimeout(r, 700));
  await shot("06-scene-lowcost");

  // click the PAINTED "Bunk Bed Deluxe" button in the art (Sleep in Bunk Bed)
  var paintCount = await page.$$eval("#paint-layer .paint-btn", function (b) { return b.length; });
  if (paintCount < 5) fail("expected painted hotspots at Low Cost Housing, got " + paintCount);
  var acted = await page.evaluate(function () {
    var btn = document.querySelector('.paint-btn[data-a="A001"]');
    if (!btn || btn.classList.contains("locked")) return null;
    btn.click(); return "Sleep in Bunk Bed";
  });
  if (!acted) fail("painted Sleep in Bunk Bed button missing or locked");
  console.log("performed painted action:", acted);
  // the More drawer lists unpainted actions (Eat at Home etc.)
  await domClick("#btn-more");
  await page.waitForSelector("#dlg-more.show", { timeout: 3000 });
  var moreCount = await page.$$eval("#more-list .action-item", function (b) { return b.length; });
  console.log("more-drawer actions:", moreCount);
  await page.evaluate(function () { document.querySelector("#dlg-more .close-x").click(); });
  await new Promise(r => setTimeout(r, 400));
  await shot("07-after-action");

  // back to map, walk somewhere (Regret Burger), eat
  await domClick("#btn-leave-scene");
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(function () {
    document.querySelector(".hotspot[data-id='regretBurger']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 15000 }); // waits for walk animation
  await new Promise(r => setTimeout(r, 500));
  await shot("08-scene-burger");
  var ate = await page.evaluate(function () {
    var btn = document.querySelector('.paint-btn[data-a="A034"]');
    if (!btn || btn.classList.contains("locked")) return null;
    btn.click(); return "Regret Burger Classic";
  });
  if (!ate) fail("painted Regret Burger Classic button missing or locked");
  console.log("ate:", ate);

  // end turn -> CPU turn should auto-run -> back to P1 turn card
  await domClick("#btn-leave-scene");
  await new Promise(r => setTimeout(r, 300));
  await domClick("#hud-end");
  await page.waitForSelector("#dlg-turncard.show", { timeout: 20000 });
  var turnTxt = await page.$eval(".turncard-body h3", function (h) { return h.textContent; });
  console.log("back to:", turnTxt);
  if (turnTxt.indexOf("Turn 2") === -1) fail("expected Turn 2 turn card, got: " + turnTxt);
  await shot("09-turn2");

  // save/resume: reload, Continue Game
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForSelector("#btn-continue", { timeout: 5000 });
  var contVisible = await page.$eval("#btn-continue", function (b) { return b.style.display !== "none"; });
  if (!contVisible) fail("Continue Game button not shown after reload");
  await domClick("#btn-continue");
  await page.waitForSelector("#screen-game.show", { timeout: 5000 });
  await shot("10-resumed");
  console.log("save/resume OK");

  // filter benign console errors (audio autoplay, missing favicon, peerjs offline)
  var real = errors.filter(function (e) {
    return !/autoplay|play\(\)|favicon|net::ERR|peerjs|The AudioContext/i.test(e);
  });
  if (real.length) fail("console errors:\n" + real.join("\n"));
  console.log("E2E PASS — no console errors");
  await browser.close();
  process.exit(0);
})().catch(function (e) { console.error("E2E CRASH:", e.message); process.exit(1); });
