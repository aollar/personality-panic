/*
 * Balance Lock v7 / Master Manual v7 — engine unit tests.
 * Step 1: the spreadsheet-driven changes from the 2026-10-25 playtest.
 *   node test/v7_rules.js
 */
const assert = require("assert");
const E = require("../js/engine.js");

function game(opts) {
  return E.newGame(Object.assign({ T: 100, seed: 7, maxRounds: 0, weekendMode: "off",
    players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] }, opts || {}));
}
function rich(p, amt) { p.stats.money = amt == null ? 100000 : amt; p.tu = 999; }
function buy(st, p, item) {
  const group = E.ITEMS[item].group;
  const id = { Transportation: "A112", "Electronics/Appliances": "A113", Furniture: "A114", Clothing: "A115" }[group];
  p.location = "mall";
  return E.perform(st, id, { item });
}
// run one action with every stat parked at 50 and report the change per stat
function delta(id, setup) {
  const st = game(), p = st.players[0]; rich(p);
  Object.keys(p.stats).forEach(s => { if (s !== "money") p.stats[s] = 50; });
  p.location = E.ACTIONS[id].building;
  if (setup) setup(st, p);
  const before = Object.assign({}, p.stats), tu = p.tu;
  const r = E.perform(st, id);
  assert.ok(r.ok, id + ": " + r.why);
  const d = {};
  Object.keys(p.stats).forEach(s => { if (s !== "money" && p.stats[s] !== before[s]) d[s] = p.stats[s] - before[s]; });
  return { d, spent: before.money - p.stats.money, tu: tu - p.tu };
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  PASS", name); }

console.log("v7 rules");

test("mall repricing: Luxury Watch $2000, Earrings $1500, Bracelet $1000, Rings $500, High Heels $400, Cap $30, Durag $20, Crocs $25", () => {
  const st = game();
  const list = { I011: 2000, I034: 1500, I035: 1000, I036: 500, I038: 400, I041: 30, I040: 20, I039: 25 };
  Object.keys(list).forEach(id => {
    const it = E.DATA.items.find(i => i.id === id);
    assert.strictEqual(E.pctB(st, it.costPct), list[id], it.name);
  });
  assert.ok(E.ITEMS["Luxury Watch"], "Watch renamed Luxury Watch");
});

test("Crocodile Sandals: the one mall exception, Happiness +5 and Coolness -5 on purchase", () => {
  const st = game(), p = st.players[0]; rich(p);
  p.stats.happiness = 50; p.stats.coolness = 50;
  assert.ok(buy(st, p, "Crocodile Sandals").ok);
  assert.strictEqual(p.stats.happiness, 55);
  assert.strictEqual(p.stats.coolness, 45);
});

test("mall purchases and investments cost 0 Time Units", () => {
  ["A112", "A113", "A114", "A115", "A085", "A086", "A087", "A088", "A119"].forEach(id =>
    assert.strictEqual(E.ACTIONS[id].tu, 0, id));
  const st = game(), p = st.players[0]; rich(p);
  const tu = p.tu;
  assert.ok(buy(st, p, "Sunglasses").ok);
  p.location = "debtstreet";
  assert.ok(E.perform(st, "A086").ok);
  assert.ok(E.perform(st, "A119", { asset: "bonds" }).ok);
  assert.strictEqual(p.tu, tu);
});

test("gym: flat points, Apartment Gym max Health +1", () => {
  assert.strictEqual(delta("A004").d.health, 1);                           // Low Cost yard workout (keeps its sheet Happiness -1%B)
  assert.deepStrictEqual(delta("A012", (st, p) => { p.housing = "lux"; }).d, { health: 1 }); // Condo Gym
  assert.deepStrictEqual(delta("A042").d.health, 2);                       // Basic Workout
  const tb = delta("A044"); assert.strictEqual(tb.d.health, 4); assert.strictEqual(tb.spent, 100); // Terminator Bootcamp
  const pb = delta("A048"); assert.strictEqual(pb.spent, 250);                                     // Personal Best
  assert.deepStrictEqual({ h: pb.d.health, c: pb.d.coolness, ha: pb.d.happiness, ct: pb.d.critical },
    { h: 5, c: 5, ha: 1, ct: -1 });
  const tbst = delta("A045"); assert.strictEqual(tbst.spent, 50);                                  // Test Booster
  assert.deepStrictEqual({ ha: tbst.d.happiness, c: tbst.d.coolness, h: tbst.d.health }, { ha: 5, c: 3, h: -5 });
  const leg = delta("A047");                                                                       // Skip Leg Day
  assert.deepStrictEqual({ h: leg.d.health, c: leg.d.coolness, ct: leg.d.critical }, { h: 1, c: 2, ct: -1 });
});

test("Chest Day no longer costs Happiness", () => {
  const cd = delta("A043");
  assert.ok(!(cd.d.happiness < 0), "no Happiness loss: " + JSON.stringify(cd.d));
});

test("flights: Hawaii $500, France $800, Japan $1000, Australia $1500, Backpacking $5000 / 10 TU", () => {
  const f = id => delta(id);
  const hi = f("A093"); assert.strictEqual(hi.spent, 500); assert.deepStrictEqual(hi.d, { happiness: 3 });
  const fr = f("A095"); assert.strictEqual(fr.spent, 800); assert.deepStrictEqual(fr.d, { happiness: 3, coolness: 2 });
  const jp = f("A094"); assert.strictEqual(jp.spent, 1000); assert.deepStrictEqual(jp.d, { happiness: 4, critical: 2 });
  const au = f("A096"); assert.strictEqual(au.spent, 1500); assert.deepStrictEqual(au.d, { happiness: 5, coolness: 3 });
  const bp = f("A097"); assert.strictEqual(bp.spent, 5000); assert.strictEqual(E.ACTIONS.A097.tu, 10);
  ["happiness", "coolness", "critical", "enlightenment"].forEach(s => assert.strictEqual(bp.d[s], 5, "Backpacking " + s));
});

test("club: VIP Lounge $500, Get Digits and Flirt Recklessly free", () => {
  const st = game();
  assert.strictEqual(E.pctB(st, E.ACTIONS.A054.costPct), 500);
  assert.strictEqual(E.pctB(st, E.ACTIONS.A052.costPct), 0);
  assert.strictEqual(E.pctB(st, E.ACTIONS.A051.costPct), 0);
});

test("Host Friends needs no Fancy Dinnerware", () => {
  assert.ok(!E.ACTIONS.A014.req.some(r => r.item === "Fancy Dinnerware"));
  delta("A014", (st, p) => { p.housing = "lux"; p.location = "luxury"; });
});

test("work actions carry no stat penalties", () => {
  E.DATA.actions.filter(a => a.fx.some(f => f.kind === "workClick"))
    .forEach(a => assert.deepStrictEqual(a.penalties, [], a.id + " " + a.name));
});

test("job gates doubled: 20 / 30 (or 40 Low) / 40 / 50 (or 60 Mid) / 80", () => {
  const t = E.DATA.jobProgression.tiers;
  assert.deepStrictEqual(t["Low+"].routes, [{ tier: "Low", clicks: 20 }]);
  assert.deepStrictEqual(t.Mid.routes, [{ tier: "Low+", clicks: 30 }, { tier: "Low", clicks: 40 }]);
  assert.deepStrictEqual(t["Mid+"].routes, [{ tier: "Mid", clicks: 40 }]);
  assert.deepStrictEqual(t.High.routes, [{ tier: "Mid+", clicks: 50 }, { tier: "Mid", clicks: 60 }]);
  assert.deepStrictEqual(t.Max.routes, [{ tier: "High", clicks: 80 }]);
});

console.log(passed + " passed");
