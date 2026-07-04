var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
(async function () {
  var b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true, userDataDir: path.join(os.tmpdir(), "pp-e2e-profile"), args: ["--mute-audio"]
  });
  var p = await b.newPage();
  p.on("console", function (m) { console.log("[console:" + m.type() + "]", m.text()); });
  p.on("pageerror", function (e) { console.log("[pageerror]", e.message); });
  await p.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
  console.log("handler attached?", await p.evaluate(function () {
    return { single: typeof document.querySelector("#btn-single").onclick,
             engine: typeof window.PPEngine, ui: typeof window.PPUI,
             data: typeof window.PP_DATA, bots: typeof window.PPBots,
             audio: typeof window.PPAudio, walker: typeof window.PPWalker };
  }));
  await p.evaluate(function () { document.querySelector("#btn-single").click(); });
  await new Promise(function (r) { setTimeout(r, 800); });
  console.log("setup class:", await p.$eval("#screen-setup", function (el) { return el.className; }));
  await b.close();
})().catch(function (e) { console.log("ERR", e.message); process.exit(1); });
