/* Living Regret Burger: idle + reaction screenshots for placement review. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8124";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-rb-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run",
           "--autoplay-policy=no-user-gesture-required"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push("PAGEERROR " + e.message); });
  p.on("console", function (m) { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 11, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }]});
    UI.state.players[0].location = "regretBurger";
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelector("#dlg-turncard").classList.remove("show");
    document.querySelector(".hotspot[data-id='regretBurger']").click();
  });
  await new Promise(function (r) { setTimeout(r, 2500); });
  await p.screenshot({ path: path.join(__dirname, "shots", "rb-live-idle.png") });
  await p.evaluate(function () { document.querySelector('.paint-btn[data-a="A034"]').click(); });
  await new Promise(function (r) { setTimeout(r, 900); });
  await p.screenshot({ path: path.join(__dirname, "shots", "rb-live-react.png") });
  console.log("mascots:", await p.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll("#regret-layer .regret-anim"), function (el) {
      return el.tagName + ":" + (el.src || "").split("/").pop().slice(0, 28) + " op=" + (el.style.opacity || "1");
    });
  }));
  console.log("errors:", errs.length ? errs : "none");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
