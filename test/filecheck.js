/* Confirms the game boots when opened directly as a file (no local server). */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
(async function () {
  var b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true, userDataDir: path.join(os.tmpdir(), "pp-file-" + Date.now()),
    args: ["--mute-audio", "--allow-file-access-from-files"]
  });
  var p = await b.newPage();
  var errs = [];
  p.on("pageerror", function (e) { errs.push(e.message); });
  var url = "file:///" + path.resolve(__dirname, "..", "index.html").replace(/\\/g, "/");
  await p.goto(url, { waitUntil: "networkidle2" });
  await p.evaluate(function () { document.querySelector("#btn-single").click(); });
  await p.waitForSelector("#screen-setup.show", { timeout: 5000 });
  var cards = await p.$$eval("#char-grid .char-card", function (c) { return c.length; });
  console.log("file:// boot OK — cards:", cards, "errors:", errs.length ? errs : "none");
  if (cards !== 16 || errs.length) process.exit(1);
  await b.close();
})().catch(function (e) { console.error("FILECHECK FAIL:", e.message); process.exit(1); });
