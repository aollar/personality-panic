/*
 * Balance Lock v5 / Master Manual v5 rules — engine unit tests.
 * Mirrors the manual's §25 QA checklist items that the engine owns.
 *   node test/v5_rules.js
 */
const assert = require("assert");
const E = require("../js/engine.js");

function game(T, opts) {
  return E.newGame(Object.assign({ T: T || 100, seed: 5, maxRounds: 0, weekendMode: "off",
    players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] }, opts || {}));
}
function rich(p, amt) { p.stats.money = amt == null ? 100000 : amt; p.tu = 999; }
function buy(st, p, item) {
  const group = E.ITEMS[item].group;
  const id = { Transportation: "A112", "Electronics/Appliances": "A113", Furniture: "A114", Clothing: "A115" }[group];
  p.location = "mall";
  return E.perform(st, id, { item });
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  PASS", name); }

console.log("v5 rules");

test("two scalars: T is the stat cap, B the economy base (100/250/350)", () => {
  assert.deepStrictEqual([game(100).B, game(500).B, game(1000).B], [100, 250, 350]);
  const st = game(500), p = st.players[0]; rich(p); p.location = "park";
  const before = p.stats.health;
  E.perform(st, "A018");   // Take a Walk: Health 2.5% -> 2.5% of B, not of T
  assert.ok(p.stats.health - before <= Math.ceil(0.025 * 250 * 1.45) && p.stats.health - before >= 5);
});

test("mall prices match the manual's §16.3 list and scale x2.5 / x3.5", () => {
  const list = { "Casual Clothes": 50, "Smart Clothes": 400, "Business Clothes": 500, "Dressy Clothes": 300,
    "Dress Shoes": 200, "Sunglasses": 100, "Bus Pass": 100, "Bicycle": 750, "Car": 2000, "Mobile Phone": 500,
    "Computer": 1000, "Camera": 800, "TV": 500, "Blu-ray": 300, "E-reader": 100, "Stereo": 200, "Lumpy Bed": 50,
    "Nice Bed": 500, "Premium Bed": 900, "Couch": 650, "Bookshelf": 80, "Plants": 20, "Desk": 350,
    "Ergonomic Chair": 600, "Pet Bed": 150, "Pet Toys": 35, "Dining Table": 450, "Mirror": 90, "Fridge": 950,
    "Stove": 650, "Vacuum": 250, "Cold Plunge": 200, "Hot Tub": 850 };
  Object.keys(list).forEach(name => {
    assert.strictEqual(E.pctB(game(100), E.ITEMS[name].costPct), list[name], name + " Short");
    assert.strictEqual(E.pctB(game(500), E.ITEMS[name].costPct), Math.round(list[name] * 2.5), name + " Medium");
    assert.strictEqual(E.pctB(game(1000), E.ITEMS[name].costPct), Math.round(list[name] * 3.5), name + " Long");
  });
});

test("no mall item carries a stat penalty (Durag, Crocodile Sandals)", () => {
  E.DATA.items.forEach(it => assert.strictEqual(it.penalty, null, it.name));
  const st = game(), p = st.players[0]; rich(p);
  const before = Object.assign({}, p.stats);
  assert.ok(buy(st, p, "Durag").ok); assert.ok(buy(st, p, "Crocodile Sandals").ok);
  ["critical", "coolness", "happiness", "health"].forEach(s => assert.ok(p.stats[s] >= before[s], s));
});

test("Luxury-only items: unbuyable in Low Cost Housing, storage (no bonus) after moving down", () => {
  const st = game(), p = st.players[0]; rich(p);
  const r = buy(st, p, "Hot Tub");
  assert.strictEqual(r.ok, false); assert.match(r.why, /Luxury/);
  p.housing = "lux"; p.location = "luxury";
  assert.ok(buy(st, p, "Hot Tub").ok);
  p.location = "luxury"; rich(p);
  let hap = p.stats.happiness; E.perform(st, "A011");
  const withTub = p.stats.happiness - hap;
  // move down: tub stays owned but in storage
  p.housing = "low"; p.location = "lowCost"; rich(p);
  assert.ok(p.items.includes("Hot Tub") && !E.itemActive(p, "Hot Tub"));
  hap = p.stats.happiness; E.perform(st, "A002");
  const log = st.log[st.log.length - 1].text;
  assert.ok(!/Hot Tub/.test(log), "stored hot tub must not fire: " + log);
  assert.ok(withTub > 0);
});

test("home fixtures stack on relax; bookshelf + plants + mirror + stove fire together at home", () => {
  const st = game(), p = st.players[0]; rich(p);
  ["Bookshelf", "Plants", "Mirror", "Stove"].forEach(n => assert.ok(buy(st, p, n).ok, n));
  p.location = "lowCost"; rich(p);
  const before = Object.assign({}, p.stats);
  const r = E.perform(st, "A002");   // Relax in Your Room
  assert.ok(r.ok);
  const last = st.log[st.log.length - 1].text;
  ["Bookshelf", "Plants", "Mirror", "Stove"].forEach(n => assert.ok(last.includes(n), n + " fired: " + last));
  assert.strictEqual(p.stats.critical - before.critical, 1);
  assert.strictEqual(p.stats.enlightenment - before.enlightenment, 1);
  assert.strictEqual(p.stats.coolness - before.coolness, 1);
  // relaxing somewhere that is NOT home fires nothing
  p.location = "park"; rich(p);
  E.perform(st, "A022");
  assert.ok(!/Bookshelf/.test(st.log[st.log.length - 1].text));
});

test("only the best bed counts on sleep", () => {
  const st = game(), p = st.players[0]; rich(p);
  assert.ok(buy(st, p, "Lumpy Bed").ok); assert.ok(buy(st, p, "Nice Bed").ok);
  p.location = "lowCost"; rich(p);
  E.perform(st, "A001");
  const last = st.log[st.log.length - 1].text;
  assert.ok(last.includes("Nice Bed") && !last.includes("Lumpy Bed"), last);
});

test("desk / pet toys / cold plunge triggers; fridge + vacuum one-time Health +3", () => {
  const st = game(), p = st.players[0]; rich(p);
  let h = p.stats.health; assert.ok(buy(st, p, "Fridge").ok); assert.strictEqual(p.stats.health - h, 3);
  h = p.stats.health; assert.ok(buy(st, p, "Vacuum").ok); assert.strictEqual(p.stats.health - h, 3);
  p.pet = { code: "ENTP", health: 50, happiness: 50, fedThisTurn: true, dead: false, missed: 0 };
  assert.ok(buy(st, p, "Pet Toys").ok); assert.ok(buy(st, p, "Pet Bed").ok);
  p.location = "lowCost"; rich(p);
  const petHap = p.pet.happiness, petHp = p.pet.health;
  E.perform(st, "A006");
  const playLog = st.log[st.log.length - 1].text;
  assert.ok(/Pet Toys/.test(playLog) && /Pet Bed/.test(playLog), playLog);
  assert.ok(p.pet.health - petHp >= 1 && p.pet.happiness - petHap >= 1);
  p.housing = "lux"; p.location = "luxury"; rich(p);
  assert.ok(buy(st, p, "Cold Plunge").ok);
  p.location = "luxury"; rich(p);
  E.perform(st, "A012");
  assert.ok(st.log[st.log.length - 1].text.includes("Cold Plunge"));
  assert.ok(buy(st, p, "Desk").ok && buy(st, p, "Computer").ok);
  p.location = "luxury"; rich(p);
  p.job = E.DATA.jobs.find(j => j.name === "Teller"); p.jobStartedTurn = 1;
  const c = p.stats.critical; E.perform(st, "A015");
  assert.ok(p.stats.critical - c >= 1, "desk fires on work-from-home");
});

test("fridge gates 2- and 4-week groceries; 1-week needs no fridge", () => {
  const st = game(), p = st.players[0]; rich(p); p.location = "airOne";
  const here = () => E.actionsAt(st, p).reduce((m, a) => (m[a.id] = a, m), {});
  let a = here();
  assert.ok(a.A026.ok, "1 week without fridge");
  assert.ok(!a.A121.ok && !a.A028.ok, "2/4 week locked without fridge");
  assert.deepStrictEqual([a.A026.cost, a.A121.cost, a.A028.cost, a.A027.cost], [40, 70, 130, 70]);
  p.items.push("Fridge");
  a = here();
  assert.ok(a.A121.ok && a.A028.ok);
  assert.ok(E.perform(st, "A121").ok); assert.strictEqual(p.foodSupply, 1);
});

test("rent $100 / $400, homeless cheque $200 covers rent + casual clothes + food", () => {
  const st = game(), p = st.players[0];
  assert.strictEqual(E.pctB(st, E.ACTIONS.X006.costPct), 100);
  assert.strictEqual(E.pctB(st, E.ACTIONS.X007.costPct), 400);
  const cheque = E.ACTIONS.A024.fx.find(f => f.kind === "supportCheque");
  assert.strictEqual(E.pctB(st, cheque.pct), 200);
  assert.ok(200 - 100 - 50 >= 3 * 15, "rent + clothes + three Regret Burger meals fit in the cheque");
});

test("investments: principal, no free money, one per type, all four at once, cash out 100%", () => {
  const st = game(), p = st.players[0]; rich(p, 1000); p.location = "debtstreet";
  ["A085", "A086", "A087", "A088"].forEach(id => assert.ok(E.perform(st, id).ok, id));
  assert.strictEqual(p.stats.money, 1000 - 10 - 15 - 20 - 25);
  assert.deepStrictEqual(p.holdings.slice().sort(), ["bonds", "crypto", "savings", "stocks"]);
  assert.strictEqual(E.perform(st, "A085").ok, false);
  assert.ok(E.perform(st, "A119", { asset: "stocks" }).ok);
  assert.strictEqual(p.stats.money, 1000 - 10 - 15 - 25);
});

test("INFORMED downgrades the next big loss and is consumed; rug pull destroys crypto", () => {
  let destroyed = 0, saved = 0;
  for (let i = 0; i < 400; i++) {
    const st = game(100, { seed: 900 + i }), p = st.players[0];
    p.holdings = ["crypto"]; p.principal = { crypto: 25 };
    p.stats.happiness = 90;                       // first place: 45% rug pull
    p.flags.informed = i % 2 === 0;
    const informed = p.flags.informed;
    E.endTurn(st); E.endTurn(st);
    if (!p.holdings.includes("crypto")) { destroyed++; assert.ok(!informed, "informed player must not be rug-pulled"); }
    if (informed && !p.flags.informed) saved++;
  }
  assert.ok(destroyed > 40, "uninformed leaders get rug-pulled (" + destroyed + ")");
  assert.ok(saved > 40, "INFORMED was consumed on big losses (" + saved + ")");
});

test("lifestyle loan: +15%B now, -5%B at the start of each of the next 4 turns, one at a time", () => {
  const st = game(), p = st.players[0]; rich(p, 100); p.location = "debtstreet";
  assert.ok(E.perform(st, "A090").ok);
  assert.ok(p.stats.money >= 115 && p.stats.money <= 117, "got " + p.stats.money);
  assert.strictEqual(E.perform(st, "A090").ok, false, "one loan at a time");
  const start = p.stats.money;
  for (let k = 1; k <= 5; k++) { p.ate = true; p.turnsSinceRelax = 0; E.endTurn(st); p.rentPaid = true; E.endTurn(st); }
  assert.strictEqual(start - p.stats.money, 20, "four payments of $5");
  assert.strictEqual(p.debts.length, 0);
});

test("Bribe Inspector costs money + Critical Thinking; Contact P.I.T.A. once per game", () => {
  const st = game(), p = st.players[0]; rich(p, 500); p.location = "petShop";
  const c = p.stats.critical;
  assert.ok(E.perform(st, "A108").ok);
  assert.strictEqual(p.stats.money, 490); assert.ok(p.stats.critical > c);
  assert.ok(E.perform(st, "A109").ok);
  assert.strictEqual(E.perform(st, "A109").ok, false);
});

test("final score counts Money at most T (max score 6T)", () => {
  const st = game(), p = st.players[0];
  ["connection", "health", "career", "happiness", "coolness", "critical", "enlightenment"].forEach(s => { p.stats[s] = 100; });
  p.stats.money = 99999;
  assert.strictEqual(E.score(st, p), 500);
});

test("bots can play full games in all three lengths", () => {
  const B = require("../js/bots.js");
  [100, 500, 1000].forEach(T => {
    const st = E.newGame({ T, seed: 42, maxRounds: 25, players: ["ENTJ", "ISFP", "ESTJ"].map((c, i) => ({ name: "Bot" + i, code: c, isBot: true })) });
    let guard = 3000;
    while (!st.over && guard-- > 0) B.botTurn(st);
    assert.ok(st.over, "T=" + T + " finished");
  });
});

console.log("V5 RULES PASS (" + passed + " checks)");
