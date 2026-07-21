/* Focused regression test for the one-shot rent notice and secondary stat rings.
 * Requires a static server; override with PP_URL when needed.
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8125/index.html";
var SHOTS = process.env.SHOT_DIR || path.join(__dirname, "shots");

function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
function assert(ok, msg) { if (!ok) throw new Error(msg); }

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-rent-rings-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("pageerror", function (e) { errors.push("PAGEERROR: " + e.message); });
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });

  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 60, maxRounds: 15, seed: 404,
      players: [{ name: "Casey", code: "ENFP" }, { name: "CPU", code: "INTJ", isBot: true }] });
    UI.state.turn = 4;
    UI.state.players[0].rentPaid = false;
    UI.state.players[0].warnings = ["RENT IS DUE this turn!", "Keep this warning"];
    UI.state.players[0].stats.coolness = 0;
    UI.state.players[0].stats.critical = 48;
    UI.state.players[0].stats.enlightenment = 85;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });

  var splash = await page.evaluate(function () {
    var UI = window.PPUI, b = document.querySelector("#rent-banner");
    return { splash: document.querySelector("#turn-splash").classList.contains("show"),
      rent: b.classList.contains("show"), timer: !!UI.timerId };
  });
  assert(splash.splash && !splash.rent && !splash.timer,
    "rent must stay hidden and timer stopped during the player splash");

  await page.waitForSelector("#dlg-turncard.show", { timeout: 6000 });
  var weekend = await page.evaluate(function () {
    var UI = window.PPUI, body = document.querySelector(".turncard-body").textContent;
    return { rent: document.querySelector("#rent-banner").classList.contains("show"),
      timer: !!UI.timerId, body: body };
  });
  assert(!weekend.rent && !weekend.timer, "rent must stay hidden and timer stopped during Weekend Update");
  assert(weekend.body.indexOf("RENT IS DUE") === -1 && weekend.body.indexOf("Keep this warning") !== -1,
    "Weekend Update should filter only the duplicate rent warning");

  await page.click("#dlg-turncard");
  await page.waitForSelector("#rent-banner.show", { timeout: 2500 });
  var notice = await page.evaluate(function () {
    var UI = window.PPUI, b = document.querySelector("#rent-banner");
    return { text: b.textContent.trim(), nowrap: getComputedStyle(b.querySelector("span")).whiteSpace,
      timer: !!UI.timerId, chip: !!document.querySelector("#hud-rent") };
  });
  assert(notice.text === "🏠 RENT IS DUE!", "rent notice text should be one line with one house");
  assert(notice.nowrap === "nowrap", "rent notice must not wrap");
  assert(!notice.timer && notice.chip, "timer must wait while the persistent pay-rent chip remains available");
  await page.screenshot({ path: path.join(SHOTS, "rent-notice.png") });

  await page.click("#rent-banner");
  await page.waitForFunction(function () {
    return !document.querySelector("#rent-banner").classList.contains("show") && !!window.PPUI.timerId;
  }, { timeout: 2500 });
  var oneShot = await page.evaluate(function () {
    window.PPUI.renderAll(); window.PPUI.renderAll(); window.PPUI.renderAll();
    return { rent: document.querySelector("#rent-banner").classList.contains("show"),
      chip: !!document.querySelector("#hud-rent") };
  });
  assert(!oneShot.rent && oneShot.chip, "HUD rerenders must not resurrect the notice");

  await page.evaluate(function () { document.querySelector(".hotspot[data-id='mall']").click(); });
  await page.waitForSelector("#scene-view.show", { timeout: 15000 });
  await page.waitForSelector("#wc-ring-critical", { timeout: 3000 });
  var rings = await page.evaluate(function () {
    function info(stat) {
      var e = document.querySelector("#wc-ring-" + stat), r = e.getBoundingClientRect();
      var cs = getComputedStyle(e);
      return { progress: e.style.getPropertyValue("--progress"), value: e.dataset.value,
        badge: document.querySelector("#wc-coin-" + stat).textContent,
        w: r.width, h: r.height, background: cs.backgroundImage,
        mask: cs.maskImage || cs.webkitMaskImage };
    }
    return { coolness: info("coolness"), critical: info("critical"), enlightenment: info("enlightenment") };
  });
  [["coolness", "0%", "0"], ["critical", "48%", "48"], ["enlightenment", "85%", "85"]]
    .forEach(function (x) {
      var r = rings[x[0]];
      assert(r.progress === x[1] && r.value === x[2] && r.badge === x[2], x[0] + " progress/value mismatch");
      assert(r.w > 0 && Math.abs(r.w - r.h) < 1, x[0] + " ring must be a nonzero square");
      assert(/conic-gradient/.test(r.background) && /radial-gradient/.test(r.mask), x[0] + " ring masks missing");
    });
  await page.screenshot({ path: path.join(SHOTS, "secondary-rings.png") });
  var playerCard = await page.$("#scene-tu");
  await playerCard.screenshot({ path: path.join(SHOTS, "secondary-rings-close.png") });

  await page.evaluate(function () {
    var p = window.PPUI.state.players[0];
    p.stats.coolness = 25; p.stats.critical = 75; p.stats.enlightenment = 100;
    window.PPUI.renderAll();
  });
  var updated = await page.$$eval(".wc-ring", function (els) {
    return els.map(function (e) { return e.style.getPropertyValue("--progress"); });
  });
  assert(updated.join(",") === "25%,75%,100%", "ring progress must update dynamically");

  await page.evaluate(function () { document.querySelector("#hud-rent").click(); });
  await wait(250);
  var paid = await page.evaluate(function () {
    return { paid: window.PPUI.state.players[0].rentPaid,
      notice: document.querySelector("#rent-banner").classList.contains("show"),
      chip: !!document.querySelector("#hud-rent") };
  });
  assert(paid.paid && !paid.notice && !paid.chip, "paying rent must remove the persistent reminder");

  // A fresh game key must present the alert again, then dismiss it without a tap.
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 60, maxRounds: 15, seed: 405,
      players: [{ name: "Casey", code: "ENFP" }, { name: "CPU", code: "INTJ", isBot: true }] });
    UI.state.turn = 4;
    UI.state.players[0].rentPaid = false;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });
  await page.waitForSelector("#dlg-turncard.show", { timeout: 6000 });
  await page.click("#dlg-turncard");
  await page.waitForSelector("#rent-banner.show", { timeout: 2500 });
  await page.waitForFunction(function () {
    return !document.querySelector("#rent-banner").classList.contains("show") && !!window.PPUI.timerId;
  }, { timeout: 3000 });
  var automatic = await page.evaluate(function () {
    return { notice: document.querySelector("#rent-banner").classList.contains("show"),
      timer: !!window.PPUI.timerId, chip: !!document.querySelector("#hud-rent") };
  });
  assert(!automatic.notice && automatic.timer && automatic.chip,
    "rent notice must auto-dismiss, start the timer, and leave the pay-rent chip available");

  var realErrors = errors.filter(function (e) { return !/favicon|AudioContext|play\(\)|autoplay/i.test(e); });
  assert(!realErrors.length, "browser errors: " + realErrors.join(" | "));
  console.log("RENT + RINGS PASS");
  await browser.close();
})().catch(function (e) { console.error("RENT + RINGS FAIL:", e.message); process.exit(1); });
