/* Drives the deployed GitHub Pages site: Settings->Done + game start. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

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
  await p.goto("https://aollar.github.io/personality-panic/", { waitUntil: "networkidle2", timeout: 60000 });
  function dc(sel) { return p.evaluate(function (s) { document.querySelector(s).click(); }, sel); }
  await dc("#btn-settings");
  await p.waitForSelector("#screen-settings.show", { timeout: 4000 });
  await dc("#btn-settings-back");
  await p.waitForSelector("#screen-start.show", { timeout: 4000 });
  console.log("LIVE: Settings -> Done -> Start OK");
  await dc("#btn-single");
  await p.waitForSelector("#screen-setup.show", { timeout: 4000 });
  await p.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[13].click(); });
  await p.evaluate(function () { document.querySelectorAll("#char-grid .char-card")[0].click(); });
  await dc("#btn-start-game");
  await p.waitForSelector("#dlg-turncard.show", { timeout: 8000 });
  console.log("LIVE: game starts OK");
  if (errs.length) { console.error("LIVE errors:", errs); process.exit(1); }
  console.log("LIVE SITE PASS");
  await b.close();
})().catch(function (e) { console.error("LIVE CRASH:", e.message); process.exit(1); });
