/* Visual pass for the TTTTT fixes: card HUD, clock, mall RIDES, CPU skip, feed. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8125";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-tt-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run",
           "--autoplay-policy=no-user-gesture-required"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push("PAGEERROR " + e.message); });
  p.on("console", function (m) {
    if (m.type() !== "error") return;
    var loc = (m.location() && m.location().url) || "";
    if (loc.indexOf("casey_chip_wide.png") !== -1) return;  // intentional art probe
    errs.push(m.text().slice(0, 140));
  });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 20, seed: 77, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU 1", code: "INTJ", isBot: true }]});
    UI.cfg = { hints: true, skipCpu: false, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelector("#dlg-turncard").classList.remove("show");
  });
  await new Promise(function (r) { setTimeout(r, 800); });
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-01-map-hud.png") });

  // spend TU so the clock moves, then check the map
  await p.evaluate(function () {
    document.querySelector(".hotspot[data-id='lowCost']").click();
  });
  await new Promise(function (r) { setTimeout(r, 700); });
  await p.evaluate(function () { document.querySelector('.paint-btn[data-a="A001"]').click(); });
  await new Promise(function (r) { setTimeout(r, 500); });
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-02-scene.png") });
  await p.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });
  await new Promise(function (r) { setTimeout(r, 400); });
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-03-map-clock.png") });

  // mall: RIDES tab
  await p.evaluate(function () {
    window.PPUI.state.players[0].tu = 6;
    document.querySelector(".hotspot[data-id='mall']").click();
  });
  await new Promise(function (r) { setTimeout(r, 3200); });
  await p.evaluate(function () {
    var rt = document.querySelector(".mall-rides-tab");
    if (rt) rt.click();
  });
  await new Promise(function (r) { setTimeout(r, 500); });
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-04-rides.png") });
  var rides = await p.$$eval("#shop-grid .shop-item .s-name", function (els) {
    return els.map(function (e) { return e.textContent; });
  });
  console.log("RIDES items:", rides);

  // club gate: fresh player has coolness 0 -> move must be rejected
  await p.evaluate(function () { document.querySelector("#dlg-shop .close-x").click(); });
  await p.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });
  await new Promise(function (r) { setTimeout(r, 300); });
  var before = await p.evaluate(function () { return window.PPUI.state.players[0].location; });
  await p.evaluate(function () { document.querySelector(".hotspot[data-id='club']").click(); });
  await new Promise(function (r) { setTimeout(r, 600); });
  var after = await p.evaluate(function () { return window.PPUI.state.players[0].location; });
  console.log("club gate: location", before, "->", after, after === before ? "(blocked ✓)" : "(ENTERED — FAIL)");
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-05-club-gate.png") });

  // end turn -> CPU plays visibly (feed toasts) -> skip button visible
  await p.evaluate(function () { document.querySelector("#hud-end").click(); });
  await new Promise(function (r) { setTimeout(r, 2600); });
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-06-cpu-turn.png") });
  var skipVisible = await p.evaluate(function () {
    return document.querySelector("#skip-cpu").style.display !== "none";
  });
  console.log("skip button visible during CPU turn:", skipVisible);
  await p.evaluate(function () { document.querySelector("#skip-cpu").click(); });
  await p.waitForSelector("#dlg-turncard.show", { timeout: 25000 });
  console.log("skip worked — back to human turn card");

  // resume flicker probe: reload + continue, watch HUD mutations for 3s
  await p.reload({ waitUntil: "networkidle2" });
  await p.evaluate(function () { document.querySelector("#btn-continue").click(); });
  await p.waitForSelector("#screen-game.show", { timeout: 5000 });
  var mutations = await p.evaluate(function () {
    return new Promise(function (res) {
      var count = 0;
      var mo = new MutationObserver(function (m) { count += m.length; });
      mo.observe(document.querySelector("#hud"), { childList: true, subtree: true });
      setTimeout(function () { mo.disconnect(); res(count); }, 3000);
    });
  });
  console.log("HUD DOM mutations in 3s after resume:", mutations, mutations < 60 ? "(stable ✓)" : "(CHURNING)");
  await p.screenshot({ path: path.join(__dirname, "shots", "tt-07-resumed.png") });

  var real = errs.filter(function (e) { return !/favicon/.test(e); });
  console.log("console errors:", real.length ? real : "none");
  if (real.length || !skipVisible || after !== before) process.exit(1);
  console.log("TTTTT VISUAL PASS");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
