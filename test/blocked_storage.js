/*
 * Repro of the reported bug: browser blocks localStorage on file:// pages
 * (privacy settings / extensions) — any access THROWS. Settings "Done" was
 * dead because init crashed mid-wiring. Verifies the whole flow now works
 * with storage blocked, loaded over file:// exactly like the user did.
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-blocked-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  // make EVERY localStorage access throw, like a blocking browser does
  await page.evaluateOnNewDocument(function () {
    Object.defineProperty(window, "localStorage", {
      get: function () { throw new DOMException("Access is denied for this document.", "SecurityError"); }
    });
  });
  var url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  await page.goto(url, { waitUntil: "networkidle2" });

  async function domClick(sel) { await page.evaluate(function (s) { document.querySelector(s).click(); }, sel); }

  // Settings -> Done must return to start
  await domClick("#btn-settings");
  await page.waitForSelector("#screen-settings.show", { timeout: 3000 });
  await domClick("#btn-settings-back");
  await page.waitForSelector("#screen-start.show", { timeout: 3000 });
  console.log("Settings -> Done -> Start: OK");

  // and a game still starts
  await domClick("#btn-single");
  await page.waitForSelector("#screen-setup.show", { timeout: 3000 });
  await page.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[13].click(); });
  await page.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[0].click(); });
  await domClick("#btn-start-game");
  await page.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  console.log("Game starts with storage blocked: OK");

  var real = errors.filter(function (e) { return !/autoplay|play\(\)/i.test(e); });
  if (real.length) { console.error("BLOCKED-STORAGE FAIL:", real); process.exit(1); }
  console.log("BLOCKED-STORAGE PASS");
  await browser.close();
})().catch(function (e) { console.error("CRASH:", e.message); process.exit(1); });
