/* Browser regressions for Airport page 2, Mall owned chips, and BDC stacking. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-kendrick-ui-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run", "--autoplay-policy=no-user-gesture-required"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 817,
      players: [{ name: "Kendrick QA", code: "ENFP", isBot: false }] });
    var p = UI.state.players[0]; p.stats.money = 1000; p.tu = 999; p.location = "mall";
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='mall']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 8000 });
  await page.evaluate(function () {
    document.querySelectorAll("#paint-layer .nav-btn.tab")[2].click();
    document.querySelector("#paint-layer .nav-btn.next").click();
  });
  async function clickItem(name) {
    await page.evaluate(function (itemName) {
      var btn = Array.prototype.find.call(document.querySelectorAll("#paint-layer .paint-btn"), function (b) {
        return b._choice && b._choice.item === itemName;
      });
      if (!btn) throw new Error("Missing item hotspot: " + itemName);
      btn.click();
    }, name);
    await new Promise(function (resolve) { setTimeout(resolve, 200); });
  }
  await clickItem("Dining Table"); await clickItem("Mirror");
  var owned = await page.evaluate(function () {
    return ["Dining Table", "Mirror"].map(function (name) {
      var btn = Array.prototype.find.call(document.querySelectorAll("#paint-layer .paint-btn"), function (b) {
        return b._choice && b._choice.item === name;
      });
      var chip = btn && btn.querySelector(".lock-chip");
      return { name: name, owned: !!btn && btn.classList.contains("owned"), visible: !!chip && chip.style.display !== "none", text: chip && chip.textContent };
    });
  });
  owned.forEach(function (row) {
    if (!row.owned || !row.visible || row.text !== "✓ OWNED") throw new Error("Owned chip failed: " + JSON.stringify(row));
  });

  // Airport page 1 -> page 2.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "airport"; p.tu = 999; UI.turnBegun = true; document.querySelector(".hotspot[data-id='airport']").click();
  });
  await page.waitForFunction(function () { return document.querySelectorAll("#paint-layer .paint-btn").length === 7; }, { timeout: 8000 });
  await page.evaluate(function () { document.querySelector("#paint-layer .nav-btn.next").click(); });
  await page.waitForFunction(function () {
    return document.querySelector("#scene-backdrop").style.backgroundImage.indexOf("airport_page_2.png") !== -1;
  }, { timeout: 10000 });
  var airportIds = await page.$$eval("#paint-layer .paint-btn", function (buttons) { return buttons.map(function (b) { return b.dataset.a; }); });
  if (airportIds.join(",") !== "A099,A100,A101") throw new Error("Airport page 2 ids: " + airportIds.join(","));
  await page.screenshot({ path: path.join(SHOTS, "kendrick-airport-page-2.png") });

  // Course catalog: exactly one next course; completed course stays greyed out.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "university"; p.tu = 999; p.stats.money = 1000; p.completedCourses = []; UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='university']").click();
    document.querySelector("#paint-layer .paint-btn[data-a='A067']").click();
  });
  await page.waitForSelector("#dlg-shop.show", { timeout: 5000 });
  var enabledCourses = await page.$$eval("#shop-grid .shop-item:not([disabled])", function (buttons) { return buttons.length; });
  if (enabledCourses !== 1) throw new Error("Expected one available first course, got " + enabledCourses);
  await page.click("#shop-grid .shop-item:not([disabled])");
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  await page.evaluate(function () { document.querySelector("#paint-layer .paint-btn[data-a='A067']").click(); });
  await page.waitForSelector("#dlg-shop.show", { timeout: 5000 });
  var courseState = await page.$$eval("#shop-grid .shop-item", function (buttons) {
    return buttons.map(function (b) { return { disabled: b.disabled, owned: b.classList.contains("owned") }; });
  });
  if (!courseState[0].disabled || !courseState[0].owned || courseState[1].disabled)
    throw new Error("Sequential course state failed: " + JSON.stringify(courseState.slice(0, 3)));
  await page.evaluate(function () { document.querySelector("#dlg-shop").classList.remove("show"); });

  // Static Club menu must be the top parent layer over the animated video.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "club"; p.items.push("Dressy Clothes", "Dress Shoes"); UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='club']").click();
  });
  await page.waitForFunction(function () {
    var f = document.querySelector("#bdc-frame");
    return f && f.contentDocument && f.contentDocument.body.classList.contains("static-ready");
  }, { timeout: 10000 });
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var stack = await page.evaluate(function () {
    var frame = document.querySelector("#bdc-frame"), video = document.querySelector("#scene-video"), r = frame.getBoundingClientRect();
    var top = document.elementFromPoint(r.left + r.width * 0.5, r.top + r.height * 0.35);
    return { frameZ: Number(getComputedStyle(frame).zIndex), videoZ: Number(getComputedStyle(video).zIndex), topId: top && top.id,
      frameBg: getComputedStyle(frame).backgroundColor };
  });
  if (!(stack.frameZ > stack.videoZ) || stack.topId !== "bdc-frame" || stack.frameBg === "rgba(0, 0, 0, 0)")
    throw new Error("BDC stacking failed: " + JSON.stringify(stack));
  await page.screenshot({ path: path.join(SHOTS, "kendrick-bdc-front.png") });

  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("KENDRICK UI PASS", JSON.stringify({ owned: owned, airportIds: airportIds, stack: stack }));
})().catch(function (e) { console.error("KENDRICK UI FAIL", e.message); process.exit(1); });
