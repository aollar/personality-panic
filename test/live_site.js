/* Drives the deployed GitHub Pages site: Settings->Done + game start.
 *
 * Hardened: after every navigation it asserts that EXACTLY ONE .screen is actually
 * visible (computed display !== none). The old version only clicked DOM nodes and
 * checked the .show class, so it passed even when the opaque Settings screen was
 * stuck on top of the title/setup screens and no human could reach the map. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = process.env.CHROME || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "https://aollar.github.io/personality-panic/";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-live-" + Date.now()),
    args: ["--mute-audio", "--no-first-run"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push(e.message); });
  await p.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });

  function dc(sel) { return p.evaluate(function (s) { document.querySelector(s).click(); }, sel); }

  // The guard that would have caught the settings-overlay bug:
  async function assertOneScreen(expected) {
    var info = await p.evaluate(function () {
      return Array.prototype.map.call(document.querySelectorAll(".screen"), function (s) {
        return { id: s.id, display: getComputedStyle(s).display };
      });
    });
    var visibleIds = info.filter(function (s) { return s.display !== "none"; }).map(function (s) { return s.id; });
    if (visibleIds.length !== 1 || visibleIds[0] !== "screen-" + expected) {
      throw new Error("VISIBILITY: expected only #screen-" + expected +
        " visible, got " + JSON.stringify(visibleIds) + " (full: " + JSON.stringify(info) + ")");
    }
  }

  await assertOneScreen("start");
  await dc("#btn-settings");
  await p.waitForSelector("#screen-settings.show", { timeout: 4000 });
  await assertOneScreen("settings");
  await dc("#btn-settings-back");
  await p.waitForSelector("#screen-start.show", { timeout: 4000 });
  await assertOneScreen("start");
  console.log("LIVE: Settings -> Done -> Start OK (title actually visible)");

  await dc("#btn-single");
  await p.waitForSelector("#screen-setup.show", { timeout: 4000 });
  await assertOneScreen("setup"); // <-- catches Settings covering the setup screen
  console.log("LIVE: Single Player -> setup actually visible");

  await p.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[13].click(); });
  await p.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[0].click(); });
  await dc("#btn-start-game");
  await p.waitForSelector("#screen-game.show", { timeout: 8000 });
  await p.waitForSelector("#dlg-turncard.show", { timeout: 8000 });
  await assertOneScreen("game"); // <-- the map screen is the one visible screen
  console.log("LIVE: game starts OK (map screen visible)");

  if (errs.length) { console.error("LIVE errors:", errs); process.exit(1); }
  console.log("LIVE SITE PASS");
  await b.close();
})().catch(function (e) { console.error("LIVE CRASH:", e.message); process.exit(1); });
