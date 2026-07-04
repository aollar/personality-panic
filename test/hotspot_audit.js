/* Visits every painted scene with hotspot outlines forced visible, screenshots each. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = path.join(__dirname, "shots", "audit");

(async function () {
  var fs = require("fs");
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-audit-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  await page.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 5, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelector("#btn-begin-turn") && document.querySelector("#dlg-turncard").classList.remove("show");
    // force outlines visible for the audit
    var css = document.createElement("style");
    css.textContent = ".paint-btn{border-color:rgba(0,255,120,.9)!important;box-shadow:inset 0 0 0 2px rgba(0,255,120,.5)!important}" +
                      ".paint-btn.locked{border-color:rgba(255,60,60,.9)!important}" +
                      ".paint-btn .tu-chip{opacity:1!important}";
    document.head.appendChild(css);
  });
  var buildings = await page.evaluate(function () { return Object.keys(window.PP_HOTSPOTS); });
  for (var i = 0; i < buildings.length; i++) {
    var b = buildings[i];
    await page.evaluate(function (id) {
      var UI = window.PPUI;
      UI.state.players[0].location = id;   // teleport for the audit
      UI.walker.jumpTo(id);
      document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
      // reuse internal openScene via hotspot click
      document.querySelector(".hotspot[data-id='" + id + "']").click();
    }, b);
    await new Promise(function (r) { setTimeout(r, 600); });
    await page.screenshot({ path: path.join(SHOTS, "audit-" + b + ".png") });
    await page.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  console.log("AUDIT DONE:", buildings.join(", "));
  await browser.close();
})().catch(function (e) { console.error("AUDIT CRASH:", e.message); process.exit(1); });
