/*
 * Balance Lock v6 / Master Manual v6 — engine unit tests.
 * One block per item on the 2026-09-20 playtest list.
 *   node test/v6_rules.js
 */
const assert = require("assert");
const E = require("../js/engine.js");

function game(opts) {
  return E.newGame(Object.assign({ T: 100, seed: 7, maxRounds: 0, weekendMode: "off",
    players: [{ name: "A", code: "ISTJ" }, { name: "B", code: "INTJ" }] }, opts || {}));
}
function rich(p, amt) { p.stats.money = amt == null ? 100000 : amt; p.tu = 999; }
function jobAt(tier, building) { return E.DATA.jobs.filter(j => j.tier === tier && j.building === building)[0]; }
let passed = 0;
function test(name, fn) { fn(); passed++; console.log("  PASS", name); }

console.log("v6 rules");

test("jobs are ordered Low -> Low+ -> Mid -> Mid+ -> High -> Max, and every rung is filled", () => {
  const order = E.DATA.jobProgression.order;
  const ranks = E.DATA.jobs.map(j => order.indexOf(j.tier));
  assert.deepStrictEqual(ranks, ranks.slice().sort((a, b) => a - b), "job list must already be tier-ordered");
  const counts = {};
  E.DATA.jobs.forEach(j => { counts[j.tier] = (counts[j.tier] || 0) + 1; });
  order.forEach(t => assert.ok(counts[t] >= 9, t + " has only " + (counts[t] || 0) + " jobs"));
  assert.ok(!E.DATA.jobs.some(j => j.tier === "Max+"), "the stray Max+ tier is gone");
});

test("career is slower: single source, lower tier values, diminishing returns in a turn", () => {
  // no Career on the Actions_Master Work rows any more
  E.DATA.actions.filter(a => a.name === "Work").forEach(a => {
    assert.ok(!a.gains.some(g => g.stat === "career" || g.stat === "money"), a.id + " Work row still pays");
  });
  assert.deepStrictEqual(E.DATA.jobProgression.order.map(t => E.DATA.jobProgression.tiers[t].careerGain), [2, 2, 3, 3, 4, 5]);
  // course Career halved
  assert.strictEqual(E.DATA.education[0].courses[0].gains.find(g => g.stat === "career").pct, 0.005);
  // 1st click full, 2nd half, 3rd quarter, 4th+ a tenth (min 1)
  const st = game(), p = st.players[0];
  p.job = jobAt("Mid", "debtstreet"); p.jobStartedTurn = 1; p.location = "debtstreet";
  const gains = [];
  for (let i = 0; i < 4; i++) { rich(p); const c = p.stats.career; E.perform(st, "A092"); gains.push(p.stats.career - c); }
  assert.deepStrictEqual(gains, [3, 1, 1, 1], "career per click in one turn: " + gains);
  // resets next turn
  p.ate = true; p.turnsSinceRelax = 0; E.endTurn(st); E.endTurn(st);
  rich(p); p.location = "debtstreet";
  const c2 = p.stats.career; E.perform(st, "A092");
  assert.strictEqual(p.stats.career - c2, 3, "the curve resets each turn");
});

test("Pay Rent is always listed, shows four states, and can be paid early", () => {
  const st = game(), p = st.players[0];
  p.location = "lowCost"; rich(p, 500);
  const listed = () => E.actionsAt(st, p).filter(a => a.id === "X006")[0];
  assert.ok(listed(), "rent must be listed on a non-rent turn");
  assert.strictEqual(E.rentStatus(st, p).state, "early");
  p.stats.money = 10;
  assert.strictEqual(E.rentStatus(st, p).state, "short");
  assert.match(E.rentStatus(st, p).text, /Need \$90 more/);
  p.stats.money = 500;
  assert.ok(E.perform(st, "X006").ok, "pre-paying is allowed");
  assert.strictEqual(p.stats.money, 400);
  assert.strictEqual(E.rentStatus(st, p).state, "paid");
  assert.strictEqual(listed().ok, false, "already paid this cycle");
  // the pre-payment survives into the rent turn instead of being wiped
  while (st.turn < 4) { st.players.forEach(q => { q.ate = true; q.turnsSinceRelax = 0; }); E.endTurn(st); }
  assert.strictEqual(p.rentPaid, true);
  assert.strictEqual(p.homeless, false);
});

test("home exercise is capped and weaker; the gym is stronger and social", () => {
  const st = game(), p = st.players[0];
  p.housing = "lux"; p.location = "luxury"; rich(p);
  const h0 = p.stats.health;
  assert.ok(E.perform(st, "A012").ok);
  const homeGain = p.stats.health - h0;
  assert.ok(E.perform(st, "A012").ok);
  const third = E.perform(st, "A012");
  assert.strictEqual(third.ok, false); assert.match(third.why, /2 per turn/);
  // gym: more health per click, plus Connection
  p.location = "gym"; rich(p);
  const h1 = p.stats.health, c1 = p.stats.connection;
  assert.ok(E.perform(st, "A042").ok, "Cardio Session");
  assert.ok(p.stats.health - h1 > homeGain, "gym cardio must beat home exercise");
  assert.ok(p.stats.connection - c1 > 0, "gym gives Connection now");
  assert.ok(E.ACTIONS.A122, "Group Fitness Class exists");
});

test("Order Fancy Food counts as eating", () => {
  const st = game(), p = st.players[0];
  p.housing = "lux"; p.location = "luxury"; rich(p);
  p.ate = false;
  assert.ok(E.perform(st, "A013").ok);
  assert.strictEqual(p.ate, true);
  p.ate = false; E.endTurn(st); E.endTurn(st);
  assert.ok(!p.weekend.some(c => c.id === "S01") || p.tu === E.DATA.settings.timeUnitsPerTurn, "no hunger card after eating");
});

test("wages rise with distance from the Corporate Soul Exchange", () => {
  const st = game();
  assert.strictEqual(E.DATA.buildingPay.soulExchange, 1);
  assert.strictEqual(E.DATA.buildingPay.airport, 1.35);
  assert.strictEqual(E.DATA.workFromHomePay, 0.85);
  const pay = (building, tier) => {
    const s2 = game(), q = s2.players[0];
    q.job = jobAt(tier, building); q.jobStartedTurn = 1; q.location = building; rich(q, 0);
    const work = E.actionsAt(s2, q).filter(a => a.action.name === "Work")[0];
    E.perform(s2, work.id);
    return q.stats.money;
  };
  const hub = pay("soulExchange", "Low"), far = pay("airport", "Low"), gym = pay("gym", "Low");
  assert.ok(far > gym && gym > hub, "airport " + far + " > gym " + gym + " > corporate " + hub);
});

test("luxury comfort actions need the matching purchase", () => {
  const st = game(), p = st.players[0];
  p.housing = "lux"; p.location = "luxury"; rich(p);
  const why = id => E.actionsAt(st, p).filter(a => a.id === id)[0].why || "";
  assert.match(why("A009"), /bed/i);
  assert.match(why("A010"), /Hot Tub/i);
  assert.match(why("A011"), /Couch/i);
  assert.match(why("A014"), /Fancy Dinnerware/i);
  ["Lumpy Bed", "Hot Tub", "Couch", "Fancy Dinnerware"].forEach(n => p.items.push(n));
  ["A009", "A010", "A011", "A014"].forEach(id => assert.ok(E.actionsAt(st, p).filter(a => a.id === id)[0].ok, id + " should open once bought"));
  // Fancy Dinnerware also pays its own trigger bonus when you host
  const cool = p.stats.coolness;
  E.perform(st, "A014");
  assert.ok(p.stats.coolness - cool >= 1, "dinnerware fires on Host Friends");
});

test("Chest Day gives flat Happiness +1 and Enlightenment -1", () => {
  const st = game(), p = st.players[0];
  p.location = "gym"; rich(p);
  p.stats.happiness = 50; p.stats.enlightenment = 50;
  assert.ok(E.perform(st, "A043").ok);
  assert.strictEqual(p.stats.happiness - 50, 1);
  assert.strictEqual(p.stats.enlightenment - 50, -1);
});

test("CPU difficulty changes bot behaviour and only bots get the gain multiplier", () => {
  const levels = E.DATA.cpuDifficulty;
  assert.deepStrictEqual([levels.easy.gainMult, levels.medium.gainMult, levels.hard.gainMult], [0.85, 1.0, 1.1]);
  // a human is never touched by it
  const st = game({ cpuDifficulty: "hard" }), human = st.players[0];
  human.location = "park"; rich(human);
  const before = human.stats.health;
  E.perform(st, "A018");
  const humanGain = human.stats.health - before;
  const st2 = E.newGame({ T: 100, seed: 7, maxRounds: 0, weekendMode: "off", cpuDifficulty: "hard",
    players: [{ name: "Bot", code: "ISTJ", isBot: true }, { name: "B", code: "INTJ" }] });
  const bot = st2.players[0];
  bot.location = "park"; rich(bot);
  const b0 = bot.stats.health; E.perform(st2, "A018");
  assert.ok(bot.stats.health - b0 >= humanGain, "hard bot gains at least as much as the human");
  assert.strictEqual(bot.difficulty, "hard");
  // and it can be switched off for balance runs
  const st3 = E.newGame({ T: 100, seed: 7, maxRounds: 0, weekendMode: "off", cpuDifficulty: "hard", botMultOff: true,
    players: [{ name: "Bot", code: "ISTJ", isBot: true }, { name: "B", code: "INTJ" }] });
  const bot3 = st3.players[0]; bot3.location = "park"; rich(bot3);
  const c0 = bot3.stats.health; E.perform(st3, "A018");
  assert.strictEqual(bot3.stats.health - c0, humanGain, "debug switch removes the bot multiplier");
});

test("the game ends on the chosen round count, not a hardcoded 15", () => {
  assert.deepStrictEqual(E.DATA.settings.turnsPerGame.options, [10, 15, 20, 30, 50]);
  [10, 20, 30].forEach(limit => {
    const st = E.newGame({ T: 100, seed: 3, maxRounds: limit, weekendMode: "off",
      players: [{ name: "A", code: "ISTJ", isBot: true }, { name: "B", code: "INTJ", isBot: true }] });
    let guard = 5000;
    while (!st.over && guard-- > 0) {
      const p = st.players[st.activeIdx];
      p.stats.connection = 0; p.stats.health = 0; p.stats.career = 0; p.stats.happiness = 0;  // never max out
      p.ate = true; p.turnsSinceRelax = 0; p.rentPaid = true;
      E.endTurn(st);
    }
    assert.strictEqual(st.turn, limit + 1, "limit " + limit + " ended on turn " + st.turn);
  });
  // one turn = one full round for every player
  const st4 = E.newGame({ T: 100, seed: 3, maxRounds: 5, weekendMode: "off",
    players: [1, 2, 3, 4].map(i => ({ name: "P" + i, code: ["ISTJ", "INTJ", "ENFP", "ESFP"][i - 1], isBot: true })) });
  E.endTurn(st4); E.endTurn(st4); E.endTurn(st4);
  assert.strictEqual(st4.turn, 1, "three of four players played: still turn 1");
  E.endTurn(st4);
  assert.strictEqual(st4.turn, 2, "the round ends only when everyone has played");
});

console.log("V6 RULES PASS (" + passed + " checks)");
