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
    // Heelton tenant: Dining Table is Luxury-only since Balance Lock v4
    var p = UI.state.players[0]; p.stats.money = 5000; p.tu = 999; p.location = "mall"; p.housing = "lux";
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

  // v5 course catalog: every painted class/degree button opens it; exactly one
  // next course; completed courses grey out; multi-click progress shows in place.
  var uniButtons = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "university"; p.tu = 999; p.stats.money = 5000; p.edu = { done: [], current: null }; UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='university']").click();
    return Array.prototype.map.call(document.querySelectorAll("#paint-layer .paint-btn"), function (b) { return b.dataset.a; });
  });
  if (uniButtons.filter(function (id) { return id === "A120"; }).length !== 5 || uniButtons.some(function (id) { return /A06[7]|A07[012]/.test(id); }))
    throw new Error("University painted buttons: " + uniButtons.join(","));
  await page.evaluate(function () { document.querySelectorAll("#paint-layer .paint-btn[data-a='A120']")[3].click(); });
  await page.waitForSelector("#dlg-shop.show", { timeout: 5000 });
  var catalog = await page.$$eval("#shop-grid .shop-item.course", function (buttons) {
    return { total: buttons.length, enabled: buttons.filter(function (b) { return !b.disabled; }).map(function (b) { return b.dataset.id; }) };
  });
  if (catalog.total !== 30 || catalog.enabled.join(",") !== "P1C1") throw new Error("Catalog state: " + JSON.stringify(catalog));
  await page.click("#shop-grid .shop-item.course:not([disabled])");
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var courseState = await page.evaluate(function () {
    var q = function (id) { return document.querySelector("#shop-grid .shop-item[data-id='" + id + "']"); };
    return { open: document.querySelector("#dlg-shop").classList.contains("show"),
      c1: { disabled: q("P1C1").disabled, done: q("P1C1").classList.contains("done") },
      c2: { disabled: q("P1C2").disabled, next: q("P1C2").classList.contains("next") },
      money: window.PPUI.state.players[0].stats.money };
  });
  if (!courseState.open || !courseState.c1.disabled || !courseState.c1.done || courseState.c2.disabled || !courseState.c2.next || courseState.money !== 4950)
    throw new Error("Sequential course state failed: " + JSON.stringify(courseState));
  // finish path 1, then one click into a 2-click Path 2 course shows partial progress
  await page.evaluate(function () {
    var p = window.PPUI.state.players[0];
    ["P1C2", "P1C3", "P1C4", "P1C5", "P1C6"].forEach(function (id) { p.edu.done.push(id); });
    document.querySelector("#dlg-shop").classList.remove("show");
    document.querySelectorAll("#paint-layer .paint-btn[data-a='A120']")[0].click();
  });
  await page.waitForSelector("#dlg-shop.show", { timeout: 5000 });
  await page.click("#shop-grid .shop-item[data-id='P2C1']");
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var partial = await page.evaluate(function () {
    var b = document.querySelector("#shop-grid .shop-item[data-id='P2C1']");
    return { disabled: b.disabled, label: b.querySelector(".s-cost").textContent,
      pathDone: document.querySelector(".course-path").classList.contains("complete") };
  });
  if (partial.disabled || !/1\/2 clicks/.test(partial.label) || !partial.pathDone) throw new Error("Partial course UI: " + JSON.stringify(partial));
  await page.screenshot({ path: path.join(SHOTS, "v5-course-catalog.png") });
  await page.evaluate(function () { document.querySelector("#dlg-shop").classList.remove("show"); });

  // v5 job board: painted ASK FOR PROMOTION opens the job board with tier progress chips.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "soulExchange"; p.tu = 999; UI.turnBegun = true;
    p.workClicks = { Low: 12, "Low+": 0, Mid: 0, "Mid+": 0, High: 0, Max: 0 };
    document.querySelector(".hotspot[data-id='soulExchange']").click();
    var promo = document.querySelectorAll("#paint-layer .paint-btn[data-a='A076']");
    promo[promo.length - 1].click();
  });
  await page.waitForSelector("#dlg-jobs.show", { timeout: 5000 });
  var board = await page.evaluate(function () {
    return { chips: Array.prototype.map.call(document.querySelectorAll("#job-list .tier-chip"), function (c) { return c.textContent; }),
      openable: document.querySelectorAll("#job-list .job-row:not([disabled])").length };
  });
  if (board.chips.length !== 6 || !/✓ Low\+ · 0 clicks/.test(board.chips[1]) || board.openable < 10)
    throw new Error("Job board: " + JSON.stringify(board));
  await page.screenshot({ path: path.join(SHOTS, "v5-job-board.png") });
  await page.evaluate(function () { document.querySelector("#dlg-jobs").classList.remove("show"); });

  // Static Club menu must be the top parent layer over the animated video.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "club"; p.items.push("Dressy Clothes", "Dress Shoes"); UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='club']").click();
  });
  await page.waitForFunction(function () {
    var f = document.querySelector("#bdc-frame");
    var robot = document.querySelector("#bdc-robot");
    return f && f.contentDocument && f.contentDocument.body.classList.contains("static-ready") &&
      robot && robot.style.display !== "none" && robot.complete && robot.naturalWidth;
  }, { timeout: 10000 });
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var stack = await page.evaluate(function () {
    var frame = document.querySelector("#bdc-frame"), video = document.querySelector("#scene-video"), r = frame.getBoundingClientRect();
    var top = document.elementFromPoint(r.left + r.width * 0.5, r.top + r.height * 0.35);
    var robot = document.querySelector("#bdc-robot"), rr = robot.getBoundingClientRect();
    return { frameZ: Number(getComputedStyle(frame).zIndex), videoZ: Number(getComputedStyle(video).zIndex), topId: top && top.id,
      frameBg: getComputedStyle(frame).backgroundColor, robotZ: Number(getComputedStyle(robot).zIndex),
      robotBox: [rr.left / innerWidth, rr.top / innerHeight, rr.width / innerWidth, rr.height / innerHeight],
      resultHidden: getComputedStyle(frame.contentDocument.querySelector("#resultBox")).display === "none" };
  });
  if (!(stack.frameZ > stack.videoZ) || stack.topId !== "bdc-frame" || stack.frameBg === "rgba(0, 0, 0, 0)" ||
      !(stack.robotZ > stack.frameZ) || !stack.resultHidden)
    throw new Error("BDC stacking failed: " + JSON.stringify(stack));
  await page.screenshot({ path: path.join(SHOTS, "kendrick-bdc-front.png") });

  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("KENDRICK UI PASS", JSON.stringify({ owned: owned, airportIds: airportIds, catalog: catalog, partial: partial, board: board, stack: stack }));
})().catch(function (e) { console.error("KENDRICK UI FAIL", e.message); process.exit(1); });
