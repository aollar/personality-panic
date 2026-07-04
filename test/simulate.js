/*
 * Full-game simulation: 4 CPU bots play complete games.
 * Verifies the loop actually finishes, and reports balance stats
 * (rounds to completion, winner personalities, score spreads).
 *
 *   node test/simulate.js [games] [T]
 */
var E = require("../js/engine.js");
var B = require("../js/bots.js");

var GAMES = parseInt(process.argv[2] || "20", 10);
var T = parseInt(process.argv[3] || "100", 10);
var CODES = Object.keys(E.DATA.personalities);

var winners = {}, rounds = [], failures = 0, allScores = [];

for (var g = 0; g < GAMES; g++) {
  // rotate personalities so every type gets games
  var picks = [];
  for (var i = 0; i < 4; i++) picks.push(CODES[(g * 4 + i) % CODES.length]);
  var state = E.newGame({
    T: T, seed: 1000 + g, maxRounds: 60,
    players: picks.map(function (c, i) { return { name: "Bot" + (i + 1) + "-" + c, code: c, isBot: true }; })
  });
  var safety = 4000;
  while (!state.over && safety-- > 0) B.botTurn(state);
  if (!state.over || safety <= 0) { failures++; console.log("GAME " + g + " DID NOT FINISH"); continue; }
  var pod = E.podium(state);
  var win = pod[0];
  winners[win.player.code] = (winners[win.player.code] || 0) + 1;
  rounds.push(state.turn);
  allScores.push(pod.map(function (e) { return e.score; }));
  var maxedEnd = state.players.some(function (p) {
    return E.DATA.settings.mainStats.every(function (s) { return p.stats[s] >= state.T; });
  });
  console.log("game " + String(g).padStart(2) + ": " + state.turn + " rounds · winner " +
    win.player.code + " " + win.score + " · scores [" + pod.map(function (e) { return e.score; }).join(", ") + "]" +
    (maxedEnd ? "" : " · TURN-CAP END"));
}

console.log("\n==== SUMMARY (" + GAMES + " games, T=" + T + ") ====");
console.log("failures:", failures);
if (rounds.length) {
  rounds.sort(function (a, b) { return a - b; });
  console.log("rounds: min", rounds[0], "median", rounds[Math.floor(rounds.length / 2)], "max", rounds[rounds.length - 1]);
}
console.log("winner distribution:", JSON.stringify(winners));
var flat = [].concat.apply([], allScores);
if (flat.length) {
  var avg = Math.round(flat.reduce(function (a, b) { return a + b; }, 0) / flat.length);
  console.log("avg score:", avg, " max possible:", 6 * T);
}
if (failures > 0) process.exit(1);
