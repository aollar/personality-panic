/* Air One painted-menu alignment, grocery HUD, and Heelton lease routing. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-airone-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 826,
      players: [{ name: "Air One QA", code: "ENFP", isBot: false }] });
    var p = UI.state.players[0]; p.stats.money = 1000; p.tu = 999; p.location = "airOne"; p.items.push("Fridge");
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnBegun = true;
    var css = document.createElement("style");
    css.textContent = ".paint-btn{border-color:rgba(0,255,120,.95)!important;background:rgba(0,255,120,.06)!important}";
    document.head.appendChild(css);
    document.querySelector(".hotspot[data-id='airOne']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 8000 });
  var buttons = await page.$$eval("#paint-layer .paint-btn", function (nodes) {
    return nodes.map(function (b) { return { id: b.dataset.a, box: [b.style.left, b.style.top, b.style.width, b.style.height] }; });
  });
  var ids = buttons.map(function (b) { return b.id; });
  var expectedIds = ["A026", "A027", "A028", "A029", "A031", "A032", "A030", "A033"];
  if (ids.join(",") !== expectedIds.join(",")) throw new Error("Air One ids: " + ids.join(","));
  var expectedBoxes = {
    A026: ["70.6%", "11.5%", "12.9%", "18.9%"], A027: ["83.9%", "11.5%", "14.9%", "18.9%"],
    A028: ["70.6%", "32.2%", "12.9%", "18.8%"], A029: ["83.9%", "32.2%", "14.9%", "18.8%"],
    A031: ["70.6%", "53.8%", "12.9%", "15.3%"], A032: ["83.9%", "53.8%", "14.9%", "15.3%"],
    A030: ["70.6%", "71.7%", "28.2%", "8.3%"], A033: ["77.2%", "84%", "21.6%", "11.8%"]
  };
  buttons.forEach(function (b) {
    if (b.box.join(",") !== expectedBoxes[b.id].join(",")) throw new Error("Air One box " + b.id + ": " + b.box.join(","));
  });
  await page.screenshot({ path: path.join(SHOTS, "airone-hotspots-fixed.png") });

  await page.evaluate(function () { document.querySelector("#paint-layer .paint-btn[data-a='A028']").click(); });
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var food = await page.evaluate(function () {
    var p = window.PPUI.state.players[0], flags = document.querySelector("#hud-flags");
    return { ate: p.ate, supply: p.foodSupply, flags: flags.textContent, html: flags.innerHTML };
  });
  if (!food.ate || food.supply !== 3 || /eat!/i.test(food.flags)) throw new Error("Grocery HUD failed: " + JSON.stringify(food));

  // The next player turn consumes one stored week automatically: no hidden
  // Eat at Home click and no contradictory EAT warning.
  var nextTurnFood = await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI; UI.state.weekendOff = true;
    E.endTurn(UI.state); UI.renderAll();
    var p = UI.state.players[0], flags = document.querySelector("#hud-flags");
    return { turn: UI.state.turn, ate: p.ate, supply: p.foodSupply, flags: flags.textContent };
  });
  if (!nextTurnFood.ate || nextTurnFood.supply !== 2 || /eat!/i.test(nextTurnFood.flags))
    throw new Error("Automatic stored meal failed: " + JSON.stringify(nextTurnFood));

  // Leasing is intentionally located at Heelton, not Low-Cost/HUD.
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; document.querySelector("#btn-leave-scene").click();
    p.location = "luxury"; p.housing = "low"; p.homeless = false; p.stats.money = 1000; p.tu = 999; UI.turnBegun = true;
    document.querySelector(".hotspot[data-id='luxury']").click();
    document.querySelectorAll("#paint-layer .nav-btn.tab")[1].click();
  });
  var leaseId = await page.$eval("#paint-layer .paint-btn", function (b) { return b.dataset.a; });
  if (leaseId !== "X003") throw new Error("Heelton visitor lease button is " + leaseId);
  await page.click("#paint-layer .paint-btn");
  await new Promise(function (resolve) { setTimeout(resolve, 250); });
  var lease = await page.evaluate(function () {
    var p = window.PPUI.state.players[0]; return { housing: p.housing, location: p.location, sceneOpen: !!window.PPUI.inScene };
  });
  if (lease.housing !== "lux" || lease.location !== "luxury" || !lease.sceneOpen) throw new Error("Heelton lease failed: " + JSON.stringify(lease));

  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("AIR ONE UI PASS", JSON.stringify({ ids: ids, food: food, nextTurnFood: nextTurnFood, lease: lease }));
})().catch(function (e) { console.error("AIR ONE UI FAIL", e.message); process.exit(1); });
