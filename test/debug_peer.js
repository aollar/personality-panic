var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
(async function () {
  var b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true, userDataDir: path.join(os.tmpdir(), "pp-mp-profile2"), args: ["--mute-audio"]
  });
  var p = await b.newPage();
  await p.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    window.__ev = [];
    var pr = new Peer("pp-panic-room-TESTQ");
    pr.on("open", function (id) { window.__ev.push("open:" + id + " openprop:" + pr.open); });
    pr.on("error", function (e) { window.__ev.push("err:" + e.type); });
  });
  await new Promise(function (r) { setTimeout(r, 8000); });
  console.log("events:", await p.evaluate(function () { return window.__ev; }));
  await b.close();
})().catch(function (e) { console.log("ERR", e.message); process.exit(1); });
