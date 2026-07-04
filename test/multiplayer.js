/*
 * Multiplayer smoke test: two headless pages — host creates a room over the
 * real PeerJS broker, guest joins with the code, both pick characters, host
 * starts, host ends turn, guest takes a turn. Verifies state sync both ways.
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-mp-profile-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  async function mkPage(name) {
    var p = await browser.newPage();
    await p.setViewport({ width: 1700, height: 1000 });
    p.on("pageerror", function (e) { console.log("[" + name + " pageerror]", e.message); });
    await p.evaluateOnNewDocument(function (nm) {
      window.prompt = function () { return nm; };
      localStorage.clear();
      localStorage.setItem("pp_name", nm);
    }, name);
    await p.goto("http://localhost:8123/index.html", { waitUntil: "networkidle2" });
    return p;
  }
  var host = await mkPage("Austin");
  var guest = await mkPage("Founder");

  // host a room
  await host.bringToFront();
  await host.evaluate(function () { window.PPNet.host(); });
  await host.waitForFunction("window.PPNet.peer && window.PPNet.peer.open === true", { timeout: 20000, polling: 400 });
  var code = await host.evaluate(function () { return window.PPNet.code; });
  console.log("room code:", code);

  // guest joins
  await guest.bringToFront();
  await guest.evaluate(function (c) { window.PPNet.join(c); }, code);
  await host.waitForFunction("window.PPNet.roster.length === 2", { timeout: 20000, polling: 400 });
  console.log("guest joined roster");

  // picks: host ENFP (click own card), guest ESTP
  await host.bringToFront();
  await host.evaluate(function () {
    var el = document.querySelector('#lobby-body .char-card[data-code="ENFP"]'); el.click();
  });
  await guest.waitForFunction("window.PPNet.roster.length === 2", { timeout: 10000, polling: 400 });
  await guest.bringToFront();
  await guest.evaluate(function () {
    var el = document.querySelector('#lobby-body .char-card[data-code="ESTP"]'); el.click();
  });
  await host.waitForFunction(
    "window.PPNet.roster.every(function(r){return r.code})", { timeout: 10000, polling: 400 });
  console.log("both picked");
  await host.screenshot({ path: path.join(SHOTS, "12-mp-lobby.png") });

  // host starts (0 bots)
  await host.bringToFront();
  await host.evaluate(function () { document.querySelector("#lob-start").click(); });
  await host.waitForSelector("#screen-game.show", { timeout: 10000, polling: 400 });
  await guest.waitForSelector("#screen-game.show", { timeout: 15000 });
  console.log("both in game");

  // host takes turn 1 slot 0: begin + end turn
  await host.bringToFront();
  await host.waitForSelector("#dlg-turncard.show", { timeout: 5000 });
  await host.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await host.evaluate(function () { document.querySelector("#hud-end").click(); });

  // guest should now get their turn card
  await guest.bringToFront();
  await guest.waitForSelector("#dlg-turncard.show", { timeout: 15000 });
  console.log("guest got their turn");
  await guest.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await guest.screenshot({ path: path.join(SHOTS, "13-mp-guest-turn.png") });

  // guest performs a real intent: enter lowCost and Relax (A002)
  await guest.evaluate(function () { document.querySelector(".hotspot[data-id='lowCost']").click(); });
  await new Promise(function (r) { setTimeout(r, 800); });
  var actedOK = await guest.evaluate(function () { window.PPUI.doAction("A002"); return true; });
  await new Promise(function (r) { setTimeout(r, 1200); });
  var happiness = await Promise.all([
    host.evaluate(function () { return window.PPUI.state.players[1].stats.happiness; }),
    guest.evaluate(function () { return window.PPUI.state.players[1].stats.happiness; })
  ]);
  console.log("guest happiness after Relax — host sees:", happiness[0], "guest sees:", happiness[1]);
  if (happiness[0] <= 0 || happiness[0] !== happiness[1]) { console.error("MP SYNC FAIL"); process.exit(1); }

  // guest ends turn -> host gets turn 2
  await guest.evaluate(function () { window.PPUI.dispatch("end", {}); });
  await host.bringToFront();
  await host.waitForSelector("#dlg-turncard.show", { timeout: 15000 });
  var t = await host.evaluate(function () { return window.PPUI.state.turn; });
  console.log("host back on turn:", t);
  if (t !== 2) { console.error("MP TURN FAIL"); process.exit(1); }
  console.log("MULTIPLAYER PASS");
  await browser.close();
})().catch(function (e) { console.error("MP CRASH:", e.message); process.exit(1); });
