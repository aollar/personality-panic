/*
 * Multiplayer round 2: verifies every reported issue over the real PeerJS broker.
 *  1. rename in lobby propagates to the host roster
 *  2. leaving the lobby removes the ghost from the roster
 *  3. spectators do NOT get a "Start Turn" card on someone else's turn
 *  4. view sync: host opens a building -> guest's screen shows that scene
 *  5. walk relay: host walks -> guest's walker animates
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8125";

(async function () {
  // one browser PER player: separate profiles (own localStorage) and every
  // page stays visible — exactly like real players on their own machines.
  var browsers = [];
  async function mkPage(name) {
    var browser = await puppeteer.launch({
      executablePath: CHROME, headless: true,
      userDataDir: path.join(os.tmpdir(), "pp-mp2-" + name + "-" + Date.now()),
      args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
    });
    browsers.push(browser);
    var p = await browser.newPage();
    await p.setViewport({ width: 1700, height: 1000 });
    p.on("pageerror", function (e) { console.log("[" + name + " pageerror]", e.message); });
    await p.evaluateOnNewDocument(function (nm) {
      window.prompt = function () { return window.__nextPrompt || nm; };
      try { localStorage.clear(); localStorage.setItem("pp_name", nm); } catch (e) {}
    }, name);
    await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
    return p;
  }
  var host = await mkPage("Austin");
  var guest = await mkPage("Founder");
  var ghost = await mkPage("Ghosty");

  await host.bringToFront();
  await host.evaluate(function () { window.PPNet.host(); });
  await host.waitForFunction("window.PPNet.peer && window.PPNet.peer.open === true", { timeout: 20000, polling: 400 });
  var code = await host.evaluate(function () { return window.PPNet.code; });
  console.log("room:", code);

  await guest.bringToFront();
  await guest.evaluate(function (c) { window.PPNet.join(c); }, code);
  await ghost.bringToFront();
  await ghost.evaluate(function (c) { window.PPNet.join(c); }, code);
  await host.waitForFunction("window.PPNet.roster.length === 3", { timeout: 20000, polling: 400 });
  console.log("3 in lobby");

  // 1. rename: Founder -> Fonder2000
  await guest.bringToFront();
  await guest.evaluate(function () {
    window.__nextPrompt = "Founder2000";
    document.querySelector("#lobby-rename").click();
  });
  await host.waitForFunction(
    "window.PPNet.roster.some(function(r){return r.name==='Founder2000'})", { timeout: 10000, polling: 400 });
  console.log("rename propagated ✓");

  // 2. ghost leaves via the X -> roster shrinks on host
  await ghost.bringToFront();
  await ghost.evaluate(function () { document.querySelector("#dlg-lobby .close-x").click(); });
  await host.waitForFunction("window.PPNet.roster.length === 2", { timeout: 15000, polling: 400 });
  console.log("leaver pruned from roster ✓");

  // picks + start (host ENFP, guest ESTP)
  await host.bringToFront();
  await host.evaluate(function () { document.querySelector('#lobby-body .char-card[data-code="ENFP"]').click(); });
  await guest.bringToFront();
  await guest.evaluate(function () { document.querySelector('#lobby-body .char-card[data-code="ESTP"]').click(); });
  await host.waitForFunction("window.PPNet.roster.every(function(r){return r.code})", { timeout: 10000, polling: 400 });
  await host.bringToFront();
  await host.evaluate(function () { document.querySelector("#lob-start").click(); });
  await host.waitForSelector("#screen-game.show", { timeout: 10000 });
  await guest.waitForSelector("#screen-game.show", { timeout: 15000 });
  console.log("game started");

  // 3. spectator must NOT see a turn card during host's turn
  await new Promise(function (r) { setTimeout(r, 1200); });
  var guestCard = await guest.evaluate(function () {
    return document.querySelector("#dlg-turncard").classList.contains("show");
  });
  console.log("guest sees Start Turn card on host's turn:", guestCard, guestCard ? "(FAIL)" : "(correct ✓)");

  // host begins + walks to the park: guest should see the walk animate
  await host.bringToFront();
  await host.evaluate(function () { document.querySelector("#btn-begin-turn").click(); });
  await host.evaluate(function () { document.querySelector(".hotspot[data-id='park']").click(); });
  await guest.bringToFront();
  var animated = await guest.evaluate(function () {
    return new Promise(function (res) {
      var t0 = Date.now();
      (function poll() {
        if (window.PPUI.walker.raf) return res(true);
        if (Date.now() - t0 > 6000) return res(false);
        setTimeout(poll, 100);
      })();
    });
  });
  console.log("guest saw walk animation:", animated, animated ? "✓" : "(FAIL)");

  // 4. host enters the park -> guest's screen shows the park scene
  await host.bringToFront();
  await host.waitForSelector("#scene-view.show", { timeout: 10000 });
  await guest.waitForSelector("#scene-view.show", { timeout: 10000 });
  var guestScene = await guest.evaluate(function () { return window.PPUI.inScene; });
  console.log("guest spectates scene:", guestScene, guestScene === "park" ? "✓" : "(FAIL)");

  // host performs an action; guest sees the feed toast
  await host.evaluate(function () { document.querySelector('.paint-btn[data-a="A019"]').click(); });
  await new Promise(function (r) { setTimeout(r, 1400); });
  var guestToast = await guest.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll(".toast"), function (t) { return t.textContent; }).join(" | ");
  });
  console.log("guest feed:", guestToast || "(none)");

  // host leaves the scene -> guest's scene closes
  await host.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });
  await guest.waitForFunction("window.PPUI.inScene === null", { timeout: 8000, polling: 300 });
  console.log("guest scene closed with host's ✓");

  var pass = !guestCard && animated && guestScene === "park";
  console.log(pass ? "MULTIPLAYER-2 PASS" : "MULTIPLAYER-2 FAIL");
  for (var i = 0; i < browsers.length; i++) await browsers[i].close();
  process.exit(pass ? 0 : 1);
})().catch(function (e) { console.error("MP2 CRASH:", e.message); process.exit(1); });
