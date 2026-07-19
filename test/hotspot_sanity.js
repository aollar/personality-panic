/* Post-remeasure sanity: map hotspots use PP_MAP_BOXES, every scene builds its
   paint layer with valid action ids, and the lowCost rent tab has live X006
   buttons (A008 was a dead removed-action id). */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8126";

(async function () {
  var browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-hs-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  page.on("pageerror", function (e) { errs.push(e.message); });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 7, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
  });

  var fails = [];
  // 1) map hotspots follow PP_MAP_BOXES
  var map = await page.evaluate(function () {
    var mv = document.querySelector("#map-view"), r = mv.getBoundingClientRect();
    var out = { n: 0, bad: [] };
    Object.keys(window.PP_MAP_BOXES).forEach(function (id) {
      var h = document.querySelector(".hotspot[data-id='" + id + "']");
      if (!h) { out.bad.push(id + ": missing"); return; }
      out.n++;
      var b = window.PP_MAP_BOXES[id], hr = h.getBoundingClientRect();
      var x = (hr.left - r.left) / r.width * 100, y = (hr.top - r.top) / r.height * 100;
      var w = hr.width / r.width * 100, hh = hr.height / r.height * 100;
      if (Math.abs(x - b[0]) > 0.6 || Math.abs(y - b[1]) > 0.6 ||
          Math.abs(w - b[2]) > 0.6 || Math.abs(hh - b[3]) > 0.6)
        out.bad.push(id + ": got " + [x, y, w, hh].map(function (v) { return v.toFixed(1); }).join(",") +
                     " want " + b.join(","));
    });
    return out;
  });
  if (map.n !== 14 || map.bad.length) fails.push("map: n=" + map.n + " " + map.bad.join(" | "));

  // 2) every painted scene builds valid buttons
  var scenes = await page.evaluate(function () {
    return Object.keys(window.PP_HOTSPOTS).concat(Object.keys(window.PP_SCENE_PAGES))
      .filter(function (v, i, a) { return a.indexOf(v) === i && v !== "club"; });
  });
  for (var i = 0; i < scenes.length; i++) {
    var id = scenes[i];
    var res = await page.evaluate(function (id) {
      var UI = window.PPUI, E = window.PPEngine;
      UI.state.players[0].location = id;
      UI.walker.jumpTo(id);
      document.querySelector(".hotspot[data-id='" + id + "']").click();
      var btns = Array.prototype.slice.call(document.querySelectorAll(".paint-btn"));
      var badIds = btns.map(function (b) { return b.dataset.a; })
        .filter(function (a) { return !E.ACTIONS[a]; });
      return { n: btns.length, badIds: badIds };
    }, id);
    if (!res.n || res.badIds.length)
      fails.push(id + ": " + res.n + " buttons, dead ids: " + res.badIds.join(","));
    await page.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });
  }

  // 3) lowCost rent tab -> two live X006 buttons
  var rent = await page.evaluate(function () {
    var UI = window.PPUI;
    UI.state.players[0].location = "lowCost";
    document.querySelector(".hotspot[data-id='lowCost']").click();
    var tabs = document.querySelectorAll("#paint-layer .nav-btn.tab");
    tabs[1].click();
    var btns = Array.prototype.slice.call(document.querySelectorAll(".paint-btn[data-a='X006']"));
    return { tabs: tabs.length, x006: btns.length };
  });
  if (rent.tabs !== 2 || rent.x006 !== 2) fails.push("lowCost rent: " + JSON.stringify(rent));
  await page.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });

  // 4) Heelton's painted PAY RENT tab pays the active tenant's real bill.
  // This covers both a canonical luxury bill and a low-cost tenant visiting
  // Heelton (rent is intentionally payable anywhere).
  var luxRent = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    UI.state.turn = 4; p.location = "luxury"; p.housing = "lux";
    p.homeless = false; p.rentPaid = false; p.stats.money = 100;
    UI.walker.jumpTo("luxury"); UI.renderAll();
    document.querySelector(".hotspot[data-id='luxury']").click();
    var btn = document.querySelector(".paint-btn[data-a='X007']");
    var unlocked = btn && !btn.classList.contains("locked");
    if (btn) btn.click();
    return { count: document.querySelectorAll(".paint-btn[data-a='X007']").length,
      unlocked: unlocked, money: p.stats.money, paid: p.rentPaid };
  });
  if (luxRent.count !== 1 || !luxRent.unlocked || luxRent.money !== 50 || !luxRent.paid)
    fails.push("luxury rent: " + JSON.stringify(luxRent));
  await page.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });

  var visitingRent = await page.evaluate(function () {
    var UI = window.PPUI, p = UI.state.players[0];
    UI.state.turn = 4; p.location = "luxury"; p.housing = "low";
    p.homeless = false; p.rentPaid = false; p.stats.money = 100;
    UI.walker.jumpTo("luxury"); UI.renderAll();
    document.querySelector(".hotspot[data-id='luxury']").click();
    var btn = document.querySelector(".paint-btn[data-a='X007']");
    var unlocked = btn && !btn.classList.contains("locked");
    var cost = btn && btn.querySelector(".tu-chip").textContent;
    if (btn) btn.click();
    return { unlocked: unlocked, cost: cost, money: p.stats.money, paid: p.rentPaid };
  });
  if (!visitingRent.unlocked || visitingRent.cost.indexOf("$20") === -1 ||
      visitingRent.money !== 80 || !visitingRent.paid)
    fails.push("Heelton visiting rent: " + JSON.stringify(visitingRent));
  await page.evaluate(function () { document.querySelector("#btn-leave-scene").click(); });

  await browser.close();
  if (errs.length) fails.push("page errors: " + errs.join(" | "));
  if (fails.length) { console.error("FAIL\n" + fails.join("\n")); process.exit(1); }
  console.log("HOTSPOT SANITY PASS — map boxes live, " + scenes.length + " scenes valid, rent paths fixed");
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
