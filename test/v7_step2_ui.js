/*
 * Balance Lock v7 step 2 — drives the real UI.
 *   1. FREE PLAY: the setup screen accepts 1 human + 0 CPU bots and the game runs
 *   2. AUTO-END after travel that spends the last Time Units (the playtest bug)
 *   3. AUTO-END after an action that spends the last Time Units
 *   4. CLOCK with the Unlimited timer shows Time Units left, never "∞"
 *   5. CLOCK is never covered: it sits above every in-game dialog, and the
 *      dialog boxes end above it (course catalog, job board, weekend cards)
 *
 *   node test/v7_step2_ui.js      (needs the static server on :8123)
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";

var failures = [];
function check(name, cond, detail) {
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail ? "   [" + detail + "]" : ""));
  if (!cond) failures.push(name);
}
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-v7s2-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  await page.setCacheEnabled(false);
  page.on("dialog", function (d) { d.dismiss(); });
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  page.on("console", function (m) {
    if (m.type() === "error" && ((m.location() && m.location().url) || "").indexOf("casey_chip_wide.png") === -1) errors.push(m.text());
  });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    window.__toasts = [];
    new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { window.__toasts.push(n.textContent); }); }); })
      .observe(document.querySelector("#toasts"), { childList: true });
  });

  // ---- 1. free play from the real setup screen ----
  await page.evaluate(function () { document.querySelector("#btn-single").click(); });
  await page.waitForSelector("#screen-setup.show", { timeout: 5000 });
  for (var i = 0; i < 4; i++) {
    await page.evaluate(function () {
      var b = document.querySelector("#setup-options .arrow-btn[data-k='bots'][data-d='-1']");
      if (b) b.click();
    });
    await wait(80);
  }
  var setupInfo = await page.evaluate(function () {
    document.querySelectorAll("#char-grid .char-card")[13].click();
    return { tabs: document.querySelectorAll("#picker-tabs .tab").length };
  });
  await wait(200);
  var setupState = await page.evaluate(function () {
    return { tabs: document.querySelectorAll("#picker-tabs .tab").length,
             disabled: document.querySelector("#btn-start-game").disabled,
             hint: document.querySelector("#setup-hint").textContent };
  });
  check("setup accepts 1 human + 0 CPU bots", setupState.tabs === 1 && !setupState.disabled, JSON.stringify(setupState));
  await page.evaluate(function () { document.querySelector("#btn-start-game").click(); });
  await page.waitForSelector("#screen-game.show", { timeout: 5000 });
  var solo = await page.evaluate(function () {
    var s = window.PPUI.state; return { players: s.players.length, bots: s.players.filter(function (p) { return p.isBot; }).length };
  });
  check("free play game starts with exactly one player and no bots", solo.players === 1 && solo.bots === 0, JSON.stringify(solo));

  // helper: a fresh solo game already past the weekend desk
  async function freshSolo(timer) {
    await wait(1500);
    await page.evaluate(function (timer) {
      var E = window.PPEngine, UI = window.PPUI;
      document.querySelectorAll(".dialog-veil.show").forEach(function (d) { d.classList.remove("show"); });
      if (UI.inScene) document.querySelector("#btn-leave-scene").click();
      UI.state = E.newGame({ T: 100, seed: 3, maxRounds: 0, weekendMode: "off", timerSeconds: timer,
        players: [{ name: "Solo", code: "ISTJ", isBot: false }] });
      UI.cfg = { hints: true, players: UI.state.players }; UI.mode = "local"; UI.mySlots = [0];
      UI.startGameUI(true); UI.turnBegun = true;
    }, timer || 0);
    await wait(400);
  }

  // ---- 2. auto-end after travel ----
  await freshSolo(0);
  var travel = await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI, p = UI.state.players[0];
    var cost = E.moveCost(UI.state, p, "park").tu;
    p.tu = cost; UI.renderAll();
    var turn = UI.state.turn;
    document.querySelector(".hotspot[data-id='park']").click();
    return { cost: cost, turn: turn };
  });
  await wait(6000);
  var afterTravel = await page.evaluate(function () {
    var UI = window.PPUI; return { turn: UI.state.turn, tu: UI.state.players[0].tu, scene: !!UI.inScene,
      toast: window.__toasts.join(" | ") };
  });
  check("travel that spends the last Time Units ends the turn", afterTravel.turn === travel.turn + 1,
    "cost " + travel.cost + " TU, turn " + travel.turn + " -> " + afterTravel.turn);
  check("an 'Out of time' message plays before the hand-off", /Out of time/i.test(afterTravel.toast), afterTravel.toast.slice(0, 120));

  // ---- 3. auto-end after an action ----
  await freshSolo(0);
  var act = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    p.location = "park"; UI.renderAll();
    document.querySelector(".hotspot[data-id='park']").click();
    return { turn: UI.state.turn };
  });
  await page.waitForSelector("#scene-view.show", { timeout: 6000 });
  await wait(600);
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    p.tu = 1; UI.renderAll();
    document.querySelector("#paint-layer .paint-btn[data-a='A018']").click();   // Take a Walk, 1 TU
  });
  await wait(2500);
  var afterAct = await page.evaluate(function () { return { turn: window.PPUI.state.turn }; });
  check("an action that spends the last Time Units ends the turn", afterAct.turn === act.turn + 1, act.turn + " -> " + afterAct.turn);

  // ---- 4. clock label with the Unlimited timer ----
  await freshSolo(0);
  var label = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    p.tu = 27; UI.renderAll();
    return document.querySelector("#turn-clock .pc-label").textContent;
  });
  check("Unlimited timer: clock shows Time Units left, not ∞", label === "27", "label '" + label + "'");

  // ---- 5. clock never covered ----
  async function clockClear(name, veilId, openFn) {
    await page.evaluate(openFn);
    try { await page.waitForSelector("#" + veilId + ".show", { timeout: 6000 }); } catch (e) {}
    await wait(500);
    var r = await page.evaluate(function (veilId) {
      var clock = document.querySelector("#turn-clock"), cr = clock.getBoundingClientRect();
      var veil = document.querySelector("#" + veilId + ".show");
      if (!veil) return { open: false };
      var box = veil.querySelector(".dialog").getBoundingClientRect();
      var overlapX = box.left < cr.right && box.right > cr.left;
      return { open: true, veil: veil.id, clockZ: +getComputedStyle(clock).zIndex, veilZ: +getComputedStyle(veil).zIndex,
               clockTop: Math.round(cr.top), dialogBottom: Math.round(box.bottom), overlapX: overlapX,
               clockVisible: getComputedStyle(clock).display !== "none" && cr.height > 20 };
    }, veilId);
    var ok = r.open && r.clockVisible && r.clockZ > r.veilZ && (!r.overlapX || r.dialogBottom <= r.clockTop + 2);
    check("clock above and clear of the " + name, ok, JSON.stringify(r));
    await page.screenshot({ path: path.join(__dirname, "shots", "v7-clock-" + name.replace(/\s+/g, "-") + ".png") });
    await page.evaluate(function () { document.querySelectorAll(".dialog-veil.show").forEach(function (d) { d.classList.remove("show"); }); });
  }
  await freshSolo(0);
  await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0]; p.stats.money = 5000; p.location = "university"; UI.renderAll();
    document.querySelector(".hotspot[data-id='university']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 6000 });
  await wait(600);
  await clockClear("course catalog", "dlg-shop", function () {
    var b = document.querySelector("#paint-layer .paint-btn[data-a='A120']"); if (b) b.click();
  });
  await clockClear("job board", "dlg-jobs", function () {
    var UI = window.PPUI; if (UI.inScene) document.querySelector("#btn-leave-scene").click();
    UI.state.players[0].location = "soulExchange"; UI.renderAll();
    document.querySelector(".hotspot[data-id='soulExchange']").click();
    setTimeout(function () {
      var b = document.querySelectorAll("#paint-layer .paint-btn[data-a='A076']"); if (b.length) b[0].click();
    }, 900);
  });
  // course bought inside the open catalog: the clock updates live
  await page.evaluate(function () {
    var UI = window.PPUI; if (UI.inScene) document.querySelector("#btn-leave-scene").click();
    UI.state.players[0].location = "university"; UI.state.players[0].tu = 30; UI.renderAll();
    document.querySelector(".hotspot[data-id='university']").click();
  });
  await page.waitForSelector("#scene-view.show", { timeout: 6000 });
  await wait(700);
  await page.evaluate(function () { var b = document.querySelector("#paint-layer .paint-btn[data-a='A120']"); if (b) b.click(); });
  await wait(700);
  var live = await page.evaluate(function () {
    var before = document.querySelector("#turn-clock .pc-label").textContent;
    var row = document.querySelector("#dlg-shop.show .shop-item.course.next:not(:disabled)") ||
              document.querySelector("#dlg-shop.show .shop-item:not(:disabled)");
    if (row) row.click();
    return { before: before, clicked: !!row };
  });
  await wait(600);
  var liveAfter = await page.evaluate(function () {
    return { label: document.querySelector("#turn-clock .pc-label").textContent,
             open: !!document.querySelector("#dlg-shop.show") };
  });
  check("clock updates live while the course dialog is open", live.clicked && liveAfter.label !== live.before,
    live.before + " -> " + liveAfter.label + (liveAfter.open ? " (dialog still open)" : " (dialog closed)"));
  await page.evaluate(function () { document.querySelectorAll(".dialog-veil.show").forEach(function (d) { d.classList.remove("show"); }); });

  // weekend cards (turn intro) in a normal-weekend game
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    if (UI.inScene) document.querySelector("#btn-leave-scene").click();
    UI.state = E.newGame({ T: 100, seed: 3, maxRounds: 0, weekendMode: "full",
      players: [{ name: "Solo", code: "ISTJ", isBot: false }] });
    UI.cfg = { hints: true, players: UI.state.players }; UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
  });
  await wait(2500);
  await clockClear("weekend cards", "dlg-turncard", function () {});

  // free play runs to the turn limit and reaches the podium
  var end = await page.evaluate(function () {
    var E = window.PPEngine;
    var st = E.newGame({ T: 100, seed: 3, maxRounds: 3, weekendMode: "off", players: [{ name: "Solo", code: "ISTJ", isBot: false }] });
    for (var k = 0; k < 10 && !st.over; k++) { st.players[0].ate = true; E.endTurn(st); }
    return { over: st.over, turn: st.turn };
  });
  check("a solo game reaches the end of its turn limit", end.over, JSON.stringify(end));

  await browser.close();
  if (errors.length) { console.log("page errors:", errors.join(" | ")); failures.push("page errors"); }
  if (failures.length) { console.log("V7 STEP 2 UI FAIL (" + failures.length + "): " + failures.join("; ")); process.exit(1); }
  console.log("V7 STEP 2 UI PASS");
})().catch(function (e) { console.error("V7 STEP 2 UI CRASH", e); process.exit(1); });
