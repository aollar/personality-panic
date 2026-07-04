/*
 * Smoothness verification for the living Regret Burger scene.
 *
 * 1. BLANK-FRAME check: reference shot with the mascot layer hidden; during a
 *    reaction burst, no frame's mascot region may match the empty background
 *    (a blank/flash frame would). Runs across: single order, same-item spam,
 *    cross-character double order.
 * 2. OPACITY INVARIANT (Mona/videos): at every 50 ms sample during the WORK
 *    reaction, EXACTLY ONE of Mona's <video> layers has opacity 1.
 * 3. Return-to-idle: after each reaction's dur, the character is back on idle.
 * Saves burst frames to test/shots/burst/ for eyeball review.
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var PNG_DIR = path.join(__dirname, "shots", "burst");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8124";

(async function () {
  if (!fs.existsSync(PNG_DIR)) fs.mkdirSync(PNG_DIR, { recursive: true });
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-rbs-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run",
           "--autoplay-policy=no-user-gesture-required"]
  });
  var page = await b.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  page.on("pageerror", function (e) { errs.push("PAGEERROR " + e.message); });
  page.on("console", function (m) { if (m.type() === "error") errs.push(m.text().slice(0, 140)); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });

  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 21, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }]});
    var p = UI.state.players[0];
    p.location = "regretBurger";
    p.stats.money = 90;
    // give a Regret Burger job so WORK (A041) is performable
    p.job = window.PP_DATA.jobs.filter(function (j) { return j.building === "regretBurger"; })[0];
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    UI.state.players[0].tu = 30;  // plenty of Time Units so every burst order is ACCEPTED
    document.querySelector("#dlg-turncard").classList.remove("show");
    document.querySelector(".hotspot[data-id='regretBurger']").click();
  });
  await new Promise(function (r) { setTimeout(r, 1800); });

  // mascot regions in viewport px (stage is 1684 wide at x≈8): scene % -> px
  function regionOf(box) { // [x%, y%, w%, h%] of the 1672x941 scene
    var sx = 10, sw = 1684, sh = sw * 941 / 1672, sy = (1000 - sh) / 2;
    return { x: Math.round(sx + box[0] / 100 * sw), y: Math.round(sy + box[1] / 100 * sh),
             width: Math.round(box[2] / 100 * sw), height: Math.round(box[3] / 100 * sh) };
  }
  var REGIONS = {
    burger: regionOf([6, 45, 17, 40]),
    shake: regionOf([34.8, 46, 15, 40]),
    mona: regionOf([24, 5, 26, 55])
  };

  // reference: the empty background (mascot layer hidden)
  await page.evaluate(function () {
    document.getElementById("regret-layer").style.visibility = "hidden";
    // silence ambients during measurement so bursts are deterministic
    window.PPRegretScene._quiet = true;
  });
  await new Promise(function (r) { setTimeout(r, 250); });
  var refs = {};
  for (var k in REGIONS) refs[k] = await page.screenshot({ clip: REGIONS[k] });
  await page.evaluate(function () { document.getElementById("regret-layer").style.visibility = ""; });
  await new Promise(function (r) { setTimeout(r, 400); });

  // pixel compare (rough): PNG byte-length + sampled bytes; robust enough to
  // distinguish "empty background" from "mascot present" — refined in Python below.
  function saveBuf(name, buf) { fs.writeFileSync(path.join(PNG_DIR, name + ".png"), buf); }
  for (var k2 in refs) saveBuf("ref-" + k2, refs[k2]);

  async function burst(tag, regionKey, actionId, opts) {
    opts = opts || {};
    var frames = [];
    var clickAt = 4; // click on frame #4 so we capture pre-click idle too
    for (var i = 0; i < (opts.frames || 34); i++) {
      if (i === clickAt) {
        await page.evaluate(function (a) {
          document.querySelector('.paint-btn[data-a="' + a + '"]').click();
        }, actionId);
        var cur = await page.evaluate(function () {
          var d = window.PPRegretScene._debug().chars;
          return Object.keys(d).map(function (k) { return k + ":" + d[k].cur; }).join(" ");
        });
        console.log("  after click:", cur);
        if (cur.indexOf(opts.expect || "") === -1) { console.error("FAIL: expected reaction " + opts.expect + " to be playing"); process.exit(1); }
      }
      if (opts.secondClickAt && i === opts.secondClickAt)
        await page.evaluate(function (a) {
          document.querySelector('.paint-btn[data-a="' + a + '"]').click();
        }, opts.secondAction || actionId);
      var shot = await page.screenshot({ clip: REGIONS[regionKey] });
      frames.push(shot);
      saveBuf(tag + "-" + String(i).padStart(2, "0"), shot);
      await new Promise(function (r) { setTimeout(r, 70); });
    }
    return frames.length;
  }

  console.log("burst 1: single order (Classic -> burger)…");
  await burst("order-burger", "burger", "A034", { expect: "burger:burger-react" });
  await new Promise(function (r) { setTimeout(r, 1500); });
  console.log("burst 2: same-item spam (Classic x2, 420ms apart)…");
  await burst("spam-burger", "burger", "A034", { secondClickAt: 10, expect: "burger:burger-react" });
  await new Promise(function (r) { setTimeout(r, 1500); });
  console.log("burst 3: cross-order (Deluxe then Shake)…");
  await burst("cross-shake", "shake", "A035", { secondClickAt: 7, secondAction: "A036", expect: "burger:burger-big" });
  await new Promise(function (r) { setTimeout(r, 1500); });

  // ---- WORK: opacity invariant on Mona's video stack, sampled every 50ms ----
  console.log("burst 4: WORK (Mona) + opacity sampling…");
  var opacityLog = await page.evaluate(async function () {
    var vids = Array.prototype.slice.call(
      document.querySelectorAll("#regret-layer video"));
    var log = [];
    document.querySelector('.paint-btn[data-a="A041"]').click();
    window.__monaCur = window.PPRegretScene._debug().chars.mona.cur;
    for (var i = 0; i < 120; i++) {
      log.push(vids.map(function (v) { return v.style.opacity === "1" ? 1 : 0; }).join(""));
      await new Promise(function (r) { setTimeout(r, 50); });
    }
    return log;
  });
  var badSamples = opacityLog.filter(function (s) {
    return s.split("").reduce(function (a, c) { return a + (+c); }, 0) !== 1;
  });
  console.log("opacity samples:", opacityLog.length, "violations:", badSamples.length);
  var monaCur = await page.evaluate(function () { return window.__monaCur; });
  console.log("mona reaction at WORK click:", monaCur);
  if (monaCur !== "mona-video1") { console.error("FAIL: Mona did not react to WORK"); process.exit(1); }

  // ---- return-to-idle checks ----
  await new Promise(function (r) { setTimeout(r, 800); });
  var idleState = await page.evaluate(function () {
    var d = window.PPRegretScene._debug().chars;
    return Object.keys(d).map(function (k) { return k + ":" + d[k].cur + (d[k].busy ? "(busy)" : ""); });
  });
  console.log("state after all reactions:", idleState);

  var realErrs = errs.filter(function (e) { return !/favicon/.test(e); });
  fs.writeFileSync(path.join(PNG_DIR, "meta.json"), JSON.stringify({
    regions: REGIONS, opacityViolations: badSamples.length, idleState: idleState, errors: realErrs
  }, null, 1));
  if (badSamples.length) { console.error("FAIL: opacity invariant violated"); process.exit(1); }
  if (realErrs.length) { console.error("FAIL console errors:", realErrs); process.exit(1); }
  console.log("JS-side checks PASS — run rb_analyze.py for the blank-frame verdict");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
