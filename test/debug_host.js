var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
(async function () {
  var b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true, userDataDir: path.join(os.tmpdir(), "pp-mp-profile3"), args: ["--mute-audio"]
  });
  var p = await b.newPage();
  p.on("console", function (m) { console.log("[c]", m.text().slice(0, 160)); });
  p.on("pageerror", function (e) { console.log("[pe]", e.message.slice(0, 300)); });
  await p.evaluateOnNewDocument(function () {
    window.prompt = function () { return "Austin"; };
    try { localStorage.setItem("pp_name", "Austin"); } catch (e) {}
  });
  await p.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () { window.PPNet.host(); });
  for (var i = 0; i < 8; i++) {
    await new Promise(function (r) { setTimeout(r, 1500); });
    var s = await p.evaluate(function () {
      var N = window.PPNet;
      return { code: N.code, hasPeer: !!N.peer, open: N.peer ? N.peer.open : null,
               destroyed: N.peer ? N.peer.destroyed : null, disconnected: N.peer ? N.peer.disconnected : null,
               lobbyShown: document.querySelector("#dlg-lobby").classList.contains("show") };
    });
    console.log(i, JSON.stringify(s));
    if (s.open) break;
  }
  await b.close();
})().catch(function (e) { console.log("ERR", e.message); process.exit(1); });
