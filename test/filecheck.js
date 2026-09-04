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
  await p.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 15, seed: 9, players: [
      { name: "File Test", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    UI.state.players[0].items.push("Lumpy Bed");
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(false); UI.turnBegun = true;
    document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
    document.querySelector(".hotspot[data-id='lowCost']").click();
  });
  await new Promise(function (resolve) { setTimeout(resolve, 1300); });
  var overlayPixels = await p.$eval("#scene-overlays", function (c) {
    var d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data, n = 0;
    for (var i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  console.log("file:// boot OK — cards:", cards, "overlay pixels:", overlayPixels, "errors:", errs.length ? errs : "none");
  if (cards !== 16 || overlayPixels < 1000 || errs.length) process.exit(1);
  await b.close();
})().catch(function (e) { console.error("FILECHECK FAIL:", e.message); process.exit(1); });
