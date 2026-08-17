/* Full ownership-state smoke test for the two Heelton apartment canvases. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-overlays-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 15, seed: 11, players: [
      { name: "Overlay Test", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    var p = UI.state.players[0];
    p.housing = "lux"; p.homeless = false; p.location = "luxury";
    p.items = ["Premium Bed", "Stove", "Fridge", "Desk", "Ergonomic Chair", "Computer",
      "Couch", "Plants", "TV", "Bookshelf", "Dining Table", "Mirror", "Hot Tub", "Vacuum"];
    p.pet = { code: "ENFP", health: 100, happiness: 100, fedThisTurn: true, dead: false, missed: 0 };
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true);
  });
  await new Promise(function (resolve) { setTimeout(resolve, 900); });
  await page.evaluate(function () {
    var UI = window.PPUI; UI.turnBegun = true;
    document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
    if (!document.querySelector("#scene-view.show")) document.querySelector(".hotspot[data-id='luxury']").click();
  });
  await new Promise(function (resolve) { setTimeout(resolve, 1800); });
  await page.waitForFunction(function () { return document.querySelector("#scene-backdrop").style.backgroundImage.indexOf("bedroom_complete.png") !== -1; }, { timeout: 10000 });
  async function alphaCount() {
    return page.$eval("#scene-overlays", function (c) {
      var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = 0;
      for (var i = 3; i < d.length; i += 4) if (d[i]) n++;
      return n;
    });
  }
  var bedroomPixels = await alphaCount();
  var bedroomBackdrop = await page.$eval("#scene-backdrop", function (el) { return el.style.backgroundImage; });
  await page.screenshot({ path: path.join(SHOTS, "scene-overlay-heelton-bedroom.png") });
  await page.evaluate(function () { document.querySelector("#paint-layer .nav-btn.next").click(); });
  await new Promise(function (resolve) { setTimeout(resolve, 1100); });
  await page.waitForFunction(function () { return document.querySelector("#scene-backdrop").style.backgroundImage.indexOf("lounge_complete.png") !== -1; }, { timeout: 10000 });
  var loungePixels = await alphaCount();
  var loungeBackdrop = await page.$eval("#scene-backdrop", function (el) { return el.style.backgroundImage; });
  await page.screenshot({ path: path.join(SHOTS, "scene-overlay-heelton-lounge.png") });
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    document.querySelector("#btn-leave-scene").click();
    p.housing = "low"; p.homeless = false; p.location = "lowCost"; p.items = ["Lumpy Bed"]; p.pet = null;
    UI.turnBegun = true; document.querySelector(".hotspot[data-id='lowCost']").click();
  });
  await new Promise(function (resolve) { setTimeout(resolve, 1100); });
  await page.waitForFunction(function () { return document.querySelector("#scene-backdrop").style.backgroundImage.indexOf("unit_empty.png") !== -1; }, { timeout: 10000 });
  var lowCostPixels = await alphaCount();
  var lowCostBackdrop = await page.$eval("#scene-backdrop", function (el) { return el.style.backgroundImage; });
  await page.screenshot({ path: path.join(SHOTS, "scene-overlay-low-cost-lumpy.png") });
  await browser.close();
  if (bedroomPixels < 30000 || loungePixels < 30000 || lowCostPixels < 10000 ||
      bedroomBackdrop.indexOf("bedroom_complete.png") === -1 || loungeBackdrop.indexOf("lounge_complete.png") === -1 ||
      lowCostBackdrop.indexOf("unit_empty.png") === -1 || errors.length) {
    console.error("SCENE OVERLAY FAIL", { bedroomPixels: bedroomPixels, loungePixels: loungePixels,
      lowCostPixels: lowCostPixels, bedroomBackdrop: bedroomBackdrop, loungeBackdrop: loungeBackdrop,
      lowCostBackdrop: lowCostBackdrop, errors: errors });
    process.exit(1);
  }
  console.log("SCENE OVERLAY PASS", { bedroomPixels: bedroomPixels, loungePixels: loungePixels, lowCostPixels: lowCostPixels });
})().catch(function (e) { console.error("SCENE OVERLAY CRASH", e.message); process.exit(1); });
