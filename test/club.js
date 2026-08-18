/* Bad Decisions Club scene: video + animated side menu iframe wired to engine. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";
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
  await page.goto(URL, { waitUntil: "networkidle2" });

  // boot a game where the player starts rich + dressed, standing at the club
  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 3, players: [
      { name: "Austin", code: "ENFP", isBot: false },
      { name: "CPU", code: "INTJ", isBot: true }
    ]});
    var p = UI.state.players[0];
    p.items.push("Dressy Clothes", "Dress Shoes");
    p.stats.money = 1000; p.stats.coolness = 50;
    p.location = "club";
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });
  await page.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  await page.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await page.waitForFunction(function () { return window.PPUI.turnBegun === true; }, { timeout: 3000 });
  await page.evaluate(function () { document.querySelector(".hotspot[data-id='club']").click(); });
  await page.waitForSelector("#scene-view.show", { timeout: 8000 });
  // iframe menu must load
  await page.waitForFunction(function () {
    var f = document.querySelector("#bdc-frame");
    return f && f.style.display !== "none" && f.contentWindow && f.contentDocument &&
      f.contentDocument.body.classList.contains("static-art") && f.contentDocument.querySelector(".decision-card");
  }, { timeout: 10000, polling: 300 });
  var workCoverage = await page.evaluate(function () {
    var f = document.querySelector("#bdc-frame"), d = f.contentDocument;
    var stage = d.querySelector("#menuStage").getBoundingClientRect();
    var work = d.querySelector("#workButton").getBoundingClientRect();
    return { left: (work.left - stage.left) / stage.width, width: work.width / stage.width };
  });
  if (workCoverage.left > 0.2 || workCoverage.width < 0.78) {
    console.error("CLUB FAIL: WORK hitbox coverage", workCoverage); process.exit(1);
  }
  await new Promise(function (r) { setTimeout(r, 1200); });
  await page.screenshot({ path: path.join(SHOTS, "14-club.png") });

  // Every visible Club control must reach its canonical engine action.
  var controls = [
    ["dance", "Dance"], ["flirt", "Flirt Recklessly"], ["digits", "Get Digits"],
    ["shots", "Order Shots"], ["vip", "VIP Lounge"], ["stranger", "Go Home With Stranger"]
  ];
  var results = [], vip = null;
  for (var ci = 0; ci < controls.length; ci++) {
    var pair = controls[ci];
    var beforeLog = await page.evaluate(function () {
      var UI = window.PPUI, E = window.PPEngine, p = UI.state.players[0];
      p.location = "club"; p.tu = 999; p.stats.money = 1000; p.stats.coolness = 50;
      p.stats.connection = 20; p.stats.health = 80; p.stats.happiness = 50; p.stats.critical = 50;
      p.job = E.DATA.jobs.filter(function (j) { return j.name === "Bouncer" && j.building === "club"; })[0];
      return UI.state.log.length;
    });
    await page.evaluate(function (card) {
      document.querySelector("#bdc-frame").contentDocument.querySelector('.decision-card[data-card="' + card + '"]').click();
    }, pair[0]);
    await page.waitForFunction(function (n) { return window.PPUI.state.log.length > n; }, { timeout: 5000 }, beforeLog);
    var row = await page.evaluate(function () { return window.PPUI.state.log[window.PPUI.state.log.length - 1].text; });
    if (row.indexOf(pair[1]) === -1) throw new Error(pair[0] + " mapped to wrong action: " + row);
    if (pair[0] === "vip") vip = await page.evaluate(function () {
      var p = window.PPUI.state.players[0]; return { money: p.stats.money, coolness: p.stats.coolness, connection: p.stats.connection };
    });
    results.push(pair[0]);
  }
  if (!(vip.money < 1000 && vip.coolness > 50 && vip.connection > 20)) throw new Error("VIP did not apply: " + JSON.stringify(vip));

  // Locked VIP remains clickable and explains its requirement with a toast,
  // rather than silently writing into the intentionally hidden result box.
  var locked = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; p.stats.coolness = 39; p.stats.money = 100; p.tu = 40;
    var n = UI.state.log.length;
    document.querySelector("#bdc-frame").contentDocument.querySelector('.decision-card[data-card="vip"]').click();
    return n;
  });
  await page.waitForFunction(function () {
    return Array.prototype.some.call(document.querySelectorAll("#toasts .toast.bad"), function (t) { return /Coolness 40/.test(t.textContent); });
  }, { timeout: 5000 });
  var unchanged = await page.evaluate(function (n) { return window.PPUI.state.log.length === n; }, locked);
  if (!unchanged) throw new Error("Locked VIP mutated state");

  var beforeWork = await page.evaluate(function () { return window.PPUI.state.log.length; });
  await page.evaluate(function () { document.querySelector("#bdc-frame").contentDocument.querySelector("#workButton").click(); });
  await page.waitForFunction(function (n) { return window.PPUI.state.log.length > n; }, { timeout: 5000 }, beforeWork);
  results.push("work");
  await page.screenshot({ path: path.join(SHOTS, "15-club-danced.png") });
  var real = errors.filter(function (e) { return !/autoplay|play\(\)/i.test(e); });
  if (real.length) { console.error("CLUB FAIL errors:", real); process.exit(1); }
  console.log("CLUB PASS", JSON.stringify({ controls: results, vip: vip, lockedReason: "Need Coolness 40+" }));
  await browser.close();
})().catch(function (e) { console.error("CLUB CRASH:", e.message); process.exit(1); });
