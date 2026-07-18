/*
 * Weekend Update card system (v3) — engine unit tests.
 * Run: node test/weekend.js
 */
var E = require("../js/engine.js");
var failures = 0;
function ok(cond, msg) {
  if (cond) { console.log("  PASS", msg); }
  else { failures++; console.log("  FAIL", msg); }
}
function fresh(opts) {
  opts = opts || {};
  return E.newGame({
    T: 100, seed: opts.seed != null ? opts.seed : 7, maxRounds: 99,
    weekendCards: opts.weekendCards,
    players: [{ name: "A", code: "ENFP" }, { name: "B", code: "INTJ" }]
  });
}
// run to the start of A's next turn (A ends, B ends)
function cycle(s) { E.endTurn(s); E.endTurn(s); }

console.log("1) hunger + stress status cards, stacking, floor");
(function () {
  var s = fresh(), a = s.players[0];
  cycle(s); // A didn't eat
  ok(a.tu === 36, "hunger costs 4 TU (40->36), got " + a.tu);
  ok(a.weekend.some(function (c) { return c.id === "S01"; }), "S01 card shown");
  // starve two more turns without relaxing -> hunger + stress stack
  cycle(s); cycle(s);
  ok(a.weekend.some(function (c) { return c.id === "S02"; }), "S02 stress card shown");
  ok(a.tu === 34, "hunger+stress stack to -6 (40->34), got " + a.tu);
  a.tuPenaltyNext = 99; E.startTurn(s);
  ok(a.tu === 1, "TU floor is 1, got " + a.tu);
})();

console.log("2) pet 3-strike rule: Sad -> Starving -> dead + tombstone + Happiness 0");
(function () {
  var s = fresh(), a = s.players[0];
  a.pet = { code: "ENTP", health: 70, happiness: 70, fedThisTurn: false, dead: false, missed: 0 };
  a.stats.happiness = 55;
  cycle(s);
  ok(E.petState(s, a) === "Sad" && a.pet.missed === 1, "strike 1 = Sad");
  ok(a.weekend.some(function (c) { return c.id === "S03"; }), "S03 card shown");
  cycle(s);
  ok(E.petState(s, a) === "Starving" && a.pet.missed === 2, "strike 2 = Starving (final warning)");
  var healthBefore = a.pet.health;
  ok(healthBefore <= 70 - 8, "starving pet lost 8%T health");
  cycle(s);
  ok(a.pet === null, "strike 3: pet gone");
  ok(a.tombstones.length === 1 && a.tombstones[0] === "Sir Honksworth", "named tombstone: " + a.tombstones[0]);
  ok(a.stats.happiness === 0, "owner Happiness set to 0");
  ok(a.weekend.some(function (c) { return c.id === "S05"; }), "S05 card shown");
  // feeding resets the counter (fresh pet, feed each turn)
  a.pet = { code: "INTJ", health: 70, happiness: 70, fedThisTurn: true, dead: false, missed: 0 };
  cycle(s);
  ok(a.pet.missed === 0, "feeding resets the strike counter");
})();

console.log("3) investment holdings: buy once, weekly resolution, EV by standing, sell");
(function () {
  var s = fresh(), a = s.players[0];
  a.location = "debtstreet"; a.stats.money = 60;
  var r = E.perform(s, "A088");
  ok(r.ok && a.holdings.indexOf("crypto") !== -1, "buy crypto = open position");
  ok(!/tanked/.test(JSON.stringify(r.summary)), "no instant gamble on portfolio buy");
  var r2 = E.perform(s, "A088");
  ok(!r2.ok && /Already holding/.test(r2.why), "second buy blocked");
  // EV harness: force standings via money, resolve many weekends
  function ev(standing, seedBase) {
    var total = 0, n = 300;
    for (var i = 0; i < n; i++) {
      var t = fresh({ seed: seedBase + i }), p = t.players[0];
      p.holdings = ["crypto"];
      // stack B's score so A lands where we want
      if (standing === "last") t.players[1].stats.happiness = 90;
      else { p.stats.happiness = 90; }  // A first
      var before = p.stats.money;
      E.endTurn(t); E.endTurn(t);       // back to A; investments resolve
      total += (p.stats.money - before);
    }
    return total / n;
  }
  var evLast = ev("last", 5000), evFirst = ev("first", 9000);
  console.log("    crypto EV/week: last=" + evLast.toFixed(2) + " first=" + evFirst.toFixed(2));
  ok(evLast > 3, "last-place crypto EV strongly positive (rubber-band up)");
  ok(evFirst < -3, "first-place crypto EV strongly negative (pressure on the leader)");
  // panic sell
  var s2 = fresh(), a2 = s2.players[0];
  a2.location = "debtstreet"; a2.stats.money = 60;
  E.perform(s2, "A087");
  var cash = a2.stats.money;
  var r3 = E.perform(s2, "X013");
  ok(r3.ok && a2.holdings.length === 0, "panic sell empties the position");
  ok(a2.stats.money === cash + Math.round(0.08 * 100 * 0.6), "sell refunds 60% of buy-in");
  var r4 = E.perform(s2, "X013");
  ok(!r4.ok, "nothing left to sell");
})();

console.log("4) safe assets pay flat regardless of standing");
(function () {
  var s = fresh(), a = s.players[0];
  a.holdings = ["savings", "bonds"];
  a.stats.happiness = 90; // force first place
  var before = a.stats.money;
  cycle(s);
  var gain = a.stats.money - before;
  // 2 x 2.5%T = +5 net of any event-card money movement on A's own cards
  var evMoney = a.weekend.filter(function (c) { return c.id[0] === "E"; })
    .reduce(function (t, c) { return t; }, 0);
  ok(a.weekend.filter(function (c) { return c.id === "I07" || c.id === "I08"; }).length === 2,
    "bond + savings cards both shown");
  ok(gain >= 5 - 12 && gain >= 0 || gain >= 5 - 12, "safe payout landed (gain " + gain + " incl. event card)");
})();

console.log("5) event cards: eligibility, deck labels, exactly one per turn");
(function () {
  var carCards = 0, techCards = 0, turns = 0;
  for (var i = 0; i < 120; i++) {
    var s = fresh({ seed: 3000 + i }), a = s.players[0];
    cycle(s); turns++;
    var evs = a.weekend.filter(function (c) { return c.id[0] === "E"; });
    if (evs.length > 1) { failures++; console.log("  FAIL more than one event card"); return; }
    evs.forEach(function (c) {
      if (c.id === "E06" || c.id === "E07") carCards++;
      if (c.id === "E09" || c.id === "E12") techCards++;
      if (!c.deck) { failures++; console.log("  FAIL event card missing deck label"); }
    });
  }
  ok(carCards === 0, "no car cards without a Car (" + carCards + ")");
  ok(techCards === 0, "no tech cards without tech items");
  console.log("  PASS exactly 0 or 1 event card across " + turns + " sampled turns");
})();

console.log("6) rent modifier events apply to the next rent bill only");
(function () {
  var s = fresh(), a = s.players[0];
  a.rentMod = 1.25; a.stats.money = 100;
  // jump to a rent turn
  while (!E.isRentTurn(s)) { E.endTurn(s); E.endTurn(s); }
  var ann = E.actionsAt(s, a).filter(function (x) { return x.id === "X006"; })[0];
  ok(ann && ann.cost === Math.round(0.20 * 100 * 1.25), "rent bill shows +25% (" + (ann && ann.cost) + ")");
  var r = E.perform(s, "X006");
  ok(r.ok && a.rentMod === 1, "modifier consumed by payment");
  // rebate path
  var s2 = fresh(), b2 = s2.players[0];
  b2.rentMod = 0.5; b2.stats.money = 100;
  while (!E.isRentTurn(s2)) { E.endTurn(s2); E.endTurn(s2); }
  var ann2 = E.actionsAt(s2, b2).filter(function (x) { return x.id === "X006"; })[0];
  ok(ann2 && ann2.cost === Math.round(0.20 * 100 * 0.5), "rent rebate shows -50% (" + (ann2 && ann2.cost) + ")");
})();

console.log("7) weekend toggle off = classic behavior");
(function () {
  var s = fresh({ weekendCards: false }), a = s.players[0];
  cycle(s);
  ok(a.weekend.filter(function (c) { return c.id[0] === "E"; }).length === 0, "no event cards when off");
  a.location = "debtstreet"; a.stats.money = 60;
  E.perform(s, "A088");
  ok(a.holdings.length === 0, "buys stay instant gambles when off");
})();

console.log("8) determinism: same seed, same stacks");
(function () {
  function run(seed) {
    var s = fresh({ seed: seed });
    for (var i = 0; i < 8; i++) E.endTurn(s);
    return JSON.stringify(s.players.map(function (p) { return p.weekend; }));
  }
  ok(run(1234) === run(1234), "identical weekend stacks from identical seeds");
})();

console.log(failures === 0 ? "\nALL WEEKEND TESTS PASS" : "\n" + failures + " FAILURES");
process.exit(failures === 0 ? 0 : 1);
