/*
 * v7 step 3: CPU difficulty really differs. Plays full CPU-only games at each
 * level and checks Easy flounders (no studying, no investing, lower scores),
 * Medium keeps money safe, Hard plays investments by standing, nothing stalls.
 *   node test/v7_cpu_sim.js [games per level]
 */
const assert = require("assert");
const E = require("../js/engine.js");
const B = require("../js/bots.js");

const GAMES = parseInt(process.argv[2] || "6", 10);
const CODES = ["ENFP", "ISTJ", "INTJ", "ESFP"];

function play(level, seed) {
  const st = E.newGame({ T: 100, seed: seed, maxRounds: 20, weekendMode: "full", cpuDifficulty: level,
    players: CODES.map((c, i) => ({ name: "CPU" + i, code: c, isBot: true })) });
  const seen = { courses: 0, buys: {}, rounds: 0 };
  let guard = 0;
  while (!st.over && guard++ < 400) {
    const p = E.active(st);
    B.botTurn(st);
    seen.courses = Math.max(seen.courses, ...st.players.map(q => q.edu.done.length));
    st.players.forEach(q => (q.holdings || []).forEach(h => { seen.buys[h] = (seen.buys[h] || 0) + 1; }));
  }
  assert.ok(st.over, level + " game " + seed + " never finished (stall)");
  seen.rounds = st.turn;
  seen.avg = st.players.reduce((t, q) => t + E.score(st, q), 0) / st.players.length;
  seen.spentTop = Math.max(...st.players.map(q => q.spent || 0));
  return seen;
}

const out = {};
["easy", "medium", "hard"].forEach(level => {
  const runs = [];
  for (let g = 0; g < GAMES; g++) runs.push(play(level, 100 + g));
  out[level] = {
    avgScore: Math.round(runs.reduce((t, r) => t + r.avg, 0) / runs.length),
    maxCourses: Math.max(...runs.map(r => r.courses)),
    holdings: runs.reduce((acc, r) => { Object.keys(r.buys).forEach(k => { acc[k] = (acc[k] || 0) + r.buys[k]; }); return acc; }, {}),
    rounds: runs.map(r => r.rounds).join(","),
  };
  console.log(level.padEnd(7), JSON.stringify(out[level]));
});

assert.strictEqual(out.easy.maxCourses, 0, "Easy never studies");
assert.deepStrictEqual(out.easy.holdings, {}, "Easy never invests");
assert.ok(Object.keys(out.medium.holdings).every(h => h === "savings" || h === "bonds"), "Medium invests safe only");
assert.ok(Object.keys(out.medium.holdings).length > 0, "Medium invests");
assert.ok(Object.keys(out.hard.holdings).length > 0, "Hard invests");
assert.ok(out.easy.avgScore < out.medium.avgScore, "Easy scores below Medium");
assert.ok(out.medium.avgScore <= out.hard.avgScore + 15, "Medium does not clearly beat Hard");
console.log("V7 CPU SIM PASS");
