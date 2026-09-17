/*
 * v5 playtest: drives the REAL UI in a browser and checks Austin's test list.
 * Clicks painted menu buttons, reads the on-screen chips, the action log and
 * the HUD — no engine shortcuts except where an outcome is random or spans
 * several turns (those are marked "engine").
 *
 *   node test/playtest_v5.js                 (local: http://localhost:8123)
 *   PP_URL=https://aollar.github.io/personality-panic/index.html node test/playtest_v5.js
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";
var SHOTS = path.join(__dirname, "shots");

var results = [];
function check(name, cond, detail) {
  results.push({ name: name, ok: !!cond, detail: detail });
  console.log((cond ? "  PASS " : "  FAIL ") + name + (detail ? "   [" + detail + "]" : ""));
}

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-playtest-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage();
  await page.setViewport({ width: 1700, height: 1000 });
  await page.setCacheEnabled(false);
  var errors = [];
  page.on("pageerror", function (e) { errors.push(e.message); });
  page.on("console", function (m) { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });

  // ---------- harness ----------
  async function newGame(opts) {
    await page.evaluate(function (opts) {
      var E = window.PPEngine, UI = window.PPUI;
      UI.state = E.newGame(Object.assign({ T: 100, seed: 11, maxRounds: 0,
        players: [{ name: "Casey", code: "ISTJ", isBot: false }] }, opts || {}));
      UI.cfg = { hints: true, players: UI.state.players };
      UI.mode = "local"; UI.mySlots = [0];
      UI.startGameUI(true); UI.turnBegun = true;
    }, opts || {});
  }
  // mutate the active player, then re-render
  async function set(fn) { await page.evaluate("(" + fn + ")(window.PPUI.state.players[0], window.PPUI.state, window.PPEngine); window.PPUI.renderAll && window.PPUI.renderAll();"); }
  async function openScene(id) {
    await page.evaluate(function (id) {
      var UI = window.PPUI;
      if (document.querySelector("#scene-view.show")) document.querySelector("#btn-leave-scene").click();
      UI.state.players[0].location = id; UI.turnBegun = true;
      document.querySelector(".hotspot[data-id='" + id + "']").click();
    }, id);
    await page.waitForSelector("#scene-view.show", { timeout: 8000 });
    await new Promise(function (r) { setTimeout(r, 700); });
  }
  async function tabPage(tabIdx, pageIdx) {
    await page.evaluate(function (t, pg) {
      if (t != null) document.querySelectorAll("#paint-layer .nav-btn.tab")[t].click();
      for (var i = 0; i < (pg || 0); i++) document.querySelector("#paint-layer .nav-btn.next").click();
    }, tabIdx, pageIdx);
    await new Promise(function (r) { setTimeout(r, 700); });
  }
  async function clickAction(id) {
    await page.evaluate(function (id) { document.querySelector("#paint-layer .paint-btn[data-a='" + id + "']").click(); }, id);
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  async function clickItem(item) {
    await page.evaluate(function (item) {
      var b = Array.prototype.find.call(document.querySelectorAll("#paint-layer .paint-btn"), function (x) { return x._choice && x._choice.item === item; });
      if (!b) throw new Error("no card for " + item);
      b.click();
    }, item);
    await new Promise(function (r) { setTimeout(r, 250); });
  }
  // actions with no painted button live in the More drawer
  async function clickMore(name) {
    await page.evaluate(function () { document.querySelector("#btn-more").click(); });
    await new Promise(function (r) { setTimeout(r, 300); });
    await page.evaluate(function (name) {
      var b = Array.prototype.find.call(document.querySelectorAll("#more-list .action-item"), function (x) { return x.querySelector(".a-name").textContent === name; });
      if (!b) throw new Error("no More action " + name);
      b.click();
    }, name);
    await new Promise(function (r) { setTimeout(r, 300); });
  }
  function stats() { return page.evaluate(function () { var p = window.PPUI.state.players[0]; return { s: Object.assign({}, p.stats), pet: p.pet && { h: p.pet.health, ha: p.pet.happiness }, tu: p.tu, items: p.items.slice(), holdings: p.holdings.slice(), housing: p.housing, homeless: p.homeless, food: p.foodSupply }; }); }
  function lastLog(n) { return page.evaluate(function (n) { return window.PPUI.state.log.slice(-n).map(function (l) { return l.text; }); }, n || 1); }
  function chip(id) { return page.evaluate(function (id) { var b = document.querySelector("#paint-layer .paint-btn[data-a='" + id + "']"); return b && { tu: b.querySelector(".tu-chip").textContent, locked: b.classList.contains("locked") }; }, id); }
  function itemChip(item) {
    return page.evaluate(function (item) {
      var b = Array.prototype.find.call(document.querySelectorAll("#paint-layer .paint-btn"), function (x) { return x._choice && x._choice.item === item; });
      return b && { tu: b.querySelector(".tu-chip").textContent, locked: b.classList.contains("locked") };
    }, item);
  }
  function priceOf(id) { return page.evaluate(function (id) { return window.PPEngine.pctB(window.PPUI.state, window.PPEngine.ACTIONS[id].costPct); }, id); }
  function hudFlags() { return page.$eval("#hud-flags", function (e) { return e.innerText.replace(/\n/g, " | "); }); }

  console.log("\n=== HOME BONUSES ===");
  await newGame();
  // fully furnished low-cost flat
  await set("function (p) { p.stats.money = 99999; p.tu = 40; ['Lumpy Bed','Nice Bed','Bookshelf','Plants','Mirror','Stove','Fridge','Desk','Computer','Pet Bed','Pet Toys'].forEach(function (n) { p.items.push(n); }); p.pet = { code: 'ENTP', health: 50, happiness: 50, fedThisTurn: true, dead: false, missed: 0 }; }");
  await openScene("lowCost");
  var before = await stats();
  await clickAction("A001");                       // Sleep in Bunk Bed
  var after = await stats(), log = (await lastLog(1))[0];
  check("sleep at home: best bed only (Nice Bed +2, not Lumpy)",
    /Nice Bed/.test(log) && !/Lumpy Bed/.test(log), log);
  await set("function (p) { p.tu = 40; }");
  before = await stats();
  await clickAction("A002");                       // Relax in Your Room
  after = await stats(); log = (await lastLog(1))[0];
  check("relax at home fires Bookshelf +1 Critical Thinking", after.s.critical - before.s.critical === 1, log);
  check("relax at home fires Plants +1 Enlightenment", after.s.enlightenment - before.s.enlightenment === 1);
  check("relax at home fires Mirror +1 Coolness", after.s.coolness - before.s.coolness === 1);
  check("relax at home fires Stove +1 Health", /Stove/.test(log), log);
  before = await stats();
  await clickAction("A006");                       // Hang With Pet
  after = await stats(); log = (await lastLog(1))[0];
  check("play with pet at home: Pet Bed +1 Pet Health", /Pet Bed/.test(log) && after.pet.h > before.pet.h, log);
  check("play with pet at home: Pet Toys +1 Pet Happiness", /Pet Toys/.test(log) && after.pet.ha > before.pet.ha);

  // away from home fires nothing
  await set("function (p) { p.tu = 40; }");
  await openScene("park");
  await clickAction("A022");                       // Nap on Park Bench
  log = (await lastLog(1))[0];
  check("same action away from home fires no fixtures", !/Bed|Bookshelf|Plants|Mirror|Stove/.test(log), log);

  // luxury: hot tub / dining table / cold plunge / ergonomic chair / desk / play with pet
  await set("function (p) { p.housing = 'lux'; p.tu = 40; ['Hot Tub','Dining Table','Cold Plunge','Ergonomic Chair','Premium Bed'].forEach(function (n) { p.items.push(n); }); }");
  await openScene("luxury");
  before = await stats();
  await clickAction("A011");                       // Relax in Your Suite
  after = await stats(); log = (await lastLog(1))[0];
  check("luxury relax fires Hot Tub + Dining Table", /Hot Tub/.test(log) && /Dining Table/.test(log), log);
  await set("function (p) { p.tu = 40; }");
  before = await stats();
  await clickAction("A012");                       // Exercise in Condo Gym
  after = await stats(); log = (await lastLog(1))[0];
  check("exercise at home fires Cold Plunge +1 Health", /Cold Plunge/.test(log), log);
  await set("function (p, s, E) { p.tu = 40; p.job = E.DATA.jobs.filter(function (j) { return j.name === 'Teller'; })[0]; p.jobStartedTurn = 1; }");
  before = await stats();
  await clickAction("A015");                       // Work From Home
  after = await stats(); log = (await lastLog(2)).join(" / ");
  check("work from home fires Desk + Ergonomic Chair",
    after.s.critical - before.s.critical >= 1 && /Desk/.test(log) && /Ergonomic Chair/.test(log), log);
  await set("function (p) { p.tu = 40; }");
  before = await stats();
  var heeltonPainted = await page.evaluate(function () { return !!document.querySelector("#paint-layer .paint-btn[data-a='X014']"); });
  await clickMore("Play With Pet");                // Heelton: only in the More drawer (not painted)
  after = await stats(); log = (await lastLog(1))[0];
  check("Heelton Play With Pet fires pet fixtures", /Pet Bed/.test(log) && /Pet Toys/.test(log), log);
  check("NOTE: Heelton Play With Pet has no painted button (More drawer only)", !heeltonPainted, "art item");
  await openScene("luxury");
  await clickAction("A009");                       // Sleep in Fancy Bed
  log = (await lastLog(1))[0];
  check("luxury sleep uses Premium Bed (+3) only", /Premium Bed/.test(log) && !/Nice Bed/.test(log), log);

  // storage rule
  await set("function (p) { p.housing = 'low'; p.tu = 40; }");
  await openScene("lowCost");
  await clickAction("A002");
  log = (await lastLog(1))[0];
  check("luxury items go to storage after moving down (no Hot Tub bonus)", !/Hot Tub|Dining Table/.test(log), log);

  console.log("\n=== FRIDGE + FOOD PRICES ===");
  await newGame();
  await set("function (p) { p.stats.money = 99999; p.tu = 40; }");
  await openScene("airOne");
  var wk1 = await chip("A026"), wk2 = await chip("A121"), wk4 = await chip("A028"), org = await chip("A027");
  check("1 week groceries $40 and buyable without a fridge", /\$40/.test(wk1.tu) && !wk1.locked, wk1.tu);
  check("2 weeks $70 locked without a fridge", /\$70/.test(wk2.tu) && wk2.locked, wk2.tu);
  check("4 weeks $130 locked without a fridge", /\$130/.test(wk4.tu) && wk4.locked, wk4.tu);
  check("organic 1 week $70", /\$70/.test(org.tu), org.tu);
  await set("function (p) { p.items.push('Fridge'); p.tu = 40; }");
  await openScene("airOne");
  wk2 = await chip("A121"); wk4 = await chip("A028");
  check("fridge unlocks the 2- and 4-week options", !wk2.locked && !wk4.locked);
  before = await stats();
  await clickAction("A121");
  after = await stats();
  check("buying 2 weeks costs $70 and stores 1 extra week", before.s.money - after.s.money === 70 && after.food === 1,
    "-$" + (before.s.money - after.s.money) + ", stored " + after.food);

  console.log("\n=== REGRET BURGER PRICES ===");
  await set("function (p) { p.tu = 40; p.ate = false; }");
  await openScene("regretBurger");
  var burgers = { A034: 15, A035: 22, A036: 18, A037: 15, A038: 20, A040: 25, A039: 8 };
  for (var id in burgers) {
    var c = await chip(id);
    check("Regret Burger " + id + " costs $" + burgers[id], c && c.tu.indexOf("$" + burgers[id]) !== -1, c && c.tu);
  }

  console.log("\n=== RENT, HEELTON, GYM, PET SHOP ===");
  check("low-cost rent $100", (await priceOf("X006")) === 100);
  check("Heelton rent $400", (await priceOf("X007")) === 400);
  check("re-house low $150 / luxury $600", (await priceOf("X005")) === 150 && (await priceOf("X009")) === 600);
  await set("function (p, s) { p.stats.money = 99999; p.tu = 40; p.housing = 'lux'; }");
  await openScene("luxury");
  var bath = await chip("A010"), fancy = await chip("A013"), host = await chip("A014"), spa = await chip("A016");
  check("Heelton bath $20", /\$20/.test(bath.tu), bath.tu);
  check("Heelton fancy food $80", /\$80/.test(fancy.tu), fancy.tu);
  check("Heelton host friends $60", /\$60/.test(host.tu), host.tu);
  check("Heelton pet spa $80", /\$80/.test(spa.tu), spa.tu);
  await set("function (p) { p.housing = 'low'; p.tu = 40; }");
  await openScene("gym");
  var gym = { A042: 5, A043: 10, A044: 25, A045: 40, A048: 15 };
  for (var g in gym) { var gc = await chip(g); check("Gym " + g + " costs $" + gym[g], gc && gc.tu.indexOf("$" + gym[g]) !== -1, gc && gc.tu); }
  await set("function (p) { p.tu = 40; p.pet = { code: 'ENTP', health: 50, happiness: 50, fedThisTurn: true, dead: false, missed: 0 }; }");
  await openScene("petShop");
  await tabPage(1, 0);   // CARE tab
  var pet = { A103: 20, A104: 25, A105: 5, A106: 10 };
  for (var k in pet) { var pc = await chip(k); check("Pet Shop " + k + " costs $" + pet[k], pc && pc.tu.indexOf("$" + pet[k]) !== -1, pc && pc.tu); }
  await tabPage(2, 0);   // BRIBES tab
  var bribe = await chip("A108");
  check("Bribe Inspector $10 (manual price; art still shows $50)", bribe && /\$10/.test(bribe.tu), bribe && bribe.tu);

  console.log("\n=== RENT WARNING CHIP + HOMELESS ===");
  await newGame();
  await set("function (p, s) { s.turn = 3; p.stats.money = 500; p.tu = 40; }");
  var flags = await hudFlags();
  check("rent chip warns the week before rent", /RENT \$100 NEXT WEEK/i.test(flags), flags);
  await set("function (p) { p.stats.money = 20; }");
  var redFlag = await page.$eval("#hud-flags", function (e) {
    var c = Array.prototype.find.call(e.querySelectorAll(".flag-chip"), function (x) { return /NEXT WEEK/i.test(x.textContent); });
    return c && c.className;
  });
  check("rent chip turns red when you can't cover it", /bad/.test(redFlag || ""), redFlag);
  await set("function (p, s) { p.homeless = true; p.housing = 'low'; p.stats.money = 0; p.tu = 40; s.turn = 4; p.rentPaid = false; }");
  await openScene("park");
  before = await stats();
  await clickMore("Homeless Support Cheque");        // Park: lives in the More drawer by design
  after = await stats();
  check("homeless cheque pays $200", after.s.money - before.s.money === 200, "+$" + (after.s.money - before.s.money));

  console.log("\n=== DEBTSTREET ===");
  await newGame();
  await set("function (p) { p.stats.money = 1000; p.tu = 40; }");
  await openScene("debtstreet");
  before = await stats();
  await clickAction("A085"); await clickAction("A086"); await clickAction("A087"); await clickAction("A088");
  after = await stats();
  check("all four investments cost $10/$15/$20/$25 and pay nothing back",
    before.s.money - after.s.money === 70 && after.holdings.length === 4, "-$" + (before.s.money - after.s.money) + " " + after.holdings.join(","));
  var dup = await chip("A085");
  check("one holding per asset type", dup.locked, dup.tu);
  before = await stats();
  await clickAction("A119");                        // Cash Out -> pick-a-holding dialog
  var sellChoices = await page.evaluate(function () {
    return Array.prototype.map.call(document.querySelectorAll("#dlg-shop.show #shop-grid .shop-item"), function (b) { return b.dataset.a + ":" + b.querySelector(".s-cost").textContent; });
  });
  check("Cash Out asks which holding to sell, showing each payout",
    sellChoices.length === 4 && sellChoices.join(",").indexOf("crypto:get back $25") !== -1, sellChoices.join(" "));
  await page.evaluate(function () {
    Array.prototype.find.call(document.querySelectorAll("#dlg-shop #shop-grid .shop-item"), function (b) { return b.dataset.a === "crypto"; }).click();
  });
  await new Promise(function (r) { setTimeout(r, 300); });
  after = await stats();
  check("Cash Out returns the full principal", after.s.money - before.s.money === 25 && after.holdings.indexOf("crypto") === -1,
    "+$" + (after.s.money - before.s.money));
  // loan (engine: spans 4 turns)
  var loan = await page.evaluate(function () {
    var E = window.PPEngine, st = E.newGame({ T: 100, seed: 5, maxRounds: 0, weekendMode: "off", players: [{ name: "A", code: "ISTJ" }] });
    var p = st.players[0]; p.location = "debtstreet"; p.stats.money = 100; p.tu = 40;
    var r1 = E.perform(st, "A090"), afterLoan = p.stats.money;
    var r2 = E.perform(st, "A090");
    var payments = [];
    for (var i = 0; i < 5; i++) { p.ate = true; p.turnsSinceRelax = 0; p.rentPaid = true; var m = p.stats.money; E.endTurn(st); payments.push(m - p.stats.money); }
    return { ok1: r1.ok, gain: afterLoan - 100, second: r2.ok, payments: payments, left: p.debts.length };
  });
  // 15%B, then the personality's Money modifier like any other action gain
  check("loan pays about +$15 now (personality modifier applies)", loan.ok1 && loan.gain >= 15 && loan.gain <= 19, "+$" + loan.gain);
  check("only one loan at a time", loan.second === false);
  check("loan repays $5 on each of the next 4 turns", JSON.stringify(loan.payments.slice(0, 4)) === "[5,5,5,5]" && loan.left === 0, JSON.stringify(loan.payments));
  // rug pull vs crash (engine: random, sampled)
  var risk = await page.evaluate(function () {
    var E = window.PPEngine, destroyed = 0, crashKept = 0, crashes = 0;
    for (var i = 0; i < 300; i++) {
      var st = E.newGame({ T: 100, seed: 700 + i, maxRounds: 0, weekendMode: "full", players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] });
      var p = st.players[0];
      p.holdings = ["crypto", "stocks"]; p.principal = { crypto: 25, stocks: 20 };
      p.stats.happiness = 90; p.ate = true; p.turnsSinceRelax = 0;
      E.endTurn(st); E.endTurn(st);
      if (!p.holdings.includes("crypto")) destroyed++;
      var crash = p.weekend.filter(function (c) { return c.id === "I10"; })[0];
      if (crash) { crashes++; if (p.holdings.includes("stocks")) crashKept++; }
    }
    return { destroyed: destroyed, crashes: crashes, crashKept: crashKept };
  });
  check("crypto RUG PULL destroys the holding", risk.destroyed > 20, risk.destroyed + "/300 leaders rug-pulled");
  check("stocks MARKET CRASH keeps the holding", risk.crashes > 0 && risk.crashes === risk.crashKept, risk.crashKept + "/" + risk.crashes + " crashes kept the stock");
  var informed = await page.evaluate(function () {
    var E = window.PPEngine, saved = 0, consumed = 0;
    for (var i = 0; i < 300; i++) {
      var st = E.newGame({ T: 100, seed: 400 + i, maxRounds: 0, weekendMode: "full", players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] });
      var p = st.players[0];
      p.holdings = ["crypto"]; p.principal = { crypto: 25 }; p.flags.informed = true;
      p.stats.happiness = 90; p.ate = true; p.turnsSinceRelax = 0;
      E.endTurn(st); E.endTurn(st);
      if (p.holdings.includes("crypto")) saved++;
      if (!p.flags.informed) consumed++;
    }
    return { saved: saved, consumed: consumed };
  });
  check("Read Tiny Print saves you from a big loss once", informed.saved === 300 && informed.consumed > 20,
    informed.saved + "/300 kept the holding, INFORMED consumed " + informed.consumed + " times");

  console.log("\n=== WEEKEND CARDS OFF + SCORE CAP ===");
  var off = await page.evaluate(function () {
    var E = window.PPEngine;
    var st = E.newGame({ T: 100, seed: 9, maxRounds: 0, weekendMode: "off", players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] });
    var p = st.players[0];
    p.holdings = ["bonds"]; p.principal = { bonds: 15 };
    var money = p.stats.money;
    p.ate = false;                                  // skip a meal: hunger penalty should still bite
    E.endTurn(st); E.endTurn(st);
    return { cards: p.weekend.length, gained: p.stats.money - money, tu: p.tu,
      log: st.log.filter(function (l) { return /BOND COUPON|FORGOT TO EAT|Didn't eat/i.test(l.text); }).map(function (l) { return l.text; }) };
  });
  check("cards Off shows no cards", off.cards === 0);
  check("cards Off still pays investments (+$2 bonds)", off.gained >= 2, "+$" + off.gained);
  check("cards Off still applies the hunger penalty", off.tu < 40, off.tu + " TU");
  check("cards Off writes results to the log", off.log.length >= 1, off.log.join(" | "));
  var score = await page.evaluate(function () {
    var E = window.PPEngine, st = E.newGame({ T: 100, seed: 2, maxRounds: 0, players: [{ name: "A", code: "ISTJ" }] });
    var p = st.players[0];
    ["connection", "health", "career", "happiness", "coolness", "critical", "enlightenment"].forEach(function (s) { p.stats[s] = 100; });
    p.stats.money = 50000;
    var noPet = E.score(st, p);
    p.pet = { code: "ENTP", health: 100, happiness: 100, fedThisTurn: true, dead: false, missed: 0 };
    return { noPet: noPet, withPet: E.score(st, p) };
  });
  check("max score stays 600 in Short (hoarded cash can't inflate it)", score.withPet === 600,
    "perfect run with pet = " + score.withPet + ", without a pet = " + score.noPet);

  await page.screenshot({ path: path.join(SHOTS, "playtest-final.png") });
  check("no console errors during the playtest", errors.length === 0, errors.slice(0, 3).join(" | "));

  var failed = results.filter(function (r) { return !r.ok; });
  console.log("\n==== " + (results.length - failed.length) + "/" + results.length + " checks passed ====");
  failed.forEach(function (f) { console.log("FAILED: " + f.name + "  [" + (f.detail || "") + "]"); });
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch(function (e) { console.error("PLAYTEST CRASH:", e.message); process.exit(1); });
