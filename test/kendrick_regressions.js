/* Regression coverage for Kendrick's 2026-08-17 playtest notes. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const E = require("../js/engine.js");
const SFX = require("../assets/data/sfx_map.js");

function game() {
  return E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 117,
    players: [{ name: "Tester", code: "ENFP", isBot: false }] });
}
function rich(p) { p.stats.money = 1000; p.tu = 999; }

// Delivered action cues exist for the reported missing park/housing/school sounds.
["A003", "A018", "A019", "A020", "A021", "A022", "A023", "A025",
 "A120", "A068", "A069"].forEach(id => {
  assert.ok(SFX.actions[id], `${id} should have a cue`);
  assert.ok(fs.existsSync(path.join(__dirname, "..", "assets", "audio", "sfx", SFX.actions[id])), `${id} cue file missing`);
});

// Buying groceries counts as eating now while preserving future food supply.
{
  const st = game(), p = st.players[0]; rich(p); p.items.push("Fridge"); p.location = "airOne";
  const r = E.perform(st, "A026");
  assert.ok(r.ok); assert.strictEqual(p.ate, true); assert.strictEqual(p.foodSupply, 0);
  E.endTurn(st);
  assert.ok(!p.weekend.some(card => card.id === "S01"), "grocery purchase must prevent hunger card");
}
{
  const st = game(), p = st.players[0]; rich(p); p.items.push("Fridge"); p.location = "airOne";
  assert.ok(E.perform(st, "A028").ok); assert.strictEqual(p.ate, true); assert.strictEqual(p.foodSupply, 3);
}

// Four-week groceries cover the purchase turn plus the next three turns
// automatically; hunger returns only after all four covered turns have passed.
{
  const st = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 118,
    weekendMode: "essential", players: [{ name: "Food Tester", code: "ENFP", isBot: false }] });
  const p = st.players[0]; rich(p); p.items.push("Fridge"); p.location = "airOne";
  assert.ok(E.perform(st, "A028").ok);
  assert.deepStrictEqual([p.ate, p.foodSupply], [true, 3], "purchase turn is meal 1 of 4");
  for (let remaining = 2; remaining >= 0; remaining--) {
    E.endTurn(st);
    assert.strictEqual(p.ate, true, `stored meal should feed turn ${st.turn}`);
    assert.strictEqual(p.autoAteStored, true, `turn ${st.turn} should identify its automatic stored meal`);
    assert.strictEqual(p.foodSupply, remaining, `turn ${st.turn} pantry count`);
    assert.ok(!p.weekend.some(card => card.id === "S01"), `no hunger card on covered turn ${st.turn}`);
  }
  E.endTurn(st);
  assert.strictEqual(p.ate, false, "turn 5 is the first uncovered turn");
  assert.strictEqual(p.autoAteStored, false, "turn 5 must not look covered");
  assert.strictEqual(p.foodSupply, 0);
  E.endTurn(st);
  assert.ok(p.weekend.some(card => card.id === "S01"), "skipping food on the first uncovered turn restores hunger");
}

// Older resumed saves without a pantry counter must not produce NaN.
{
  const st = game(), p = st.players[0]; rich(p); p.items.push("Fridge"); p.location = "airOne";
  delete p.foodSupply; delete p.premiumSupply;
  assert.ok(E.perform(st, "A028").ok);
  assert.strictEqual(p.foodSupply, 3); assert.strictEqual(p.premiumSupply, false);
}

// The luxury lease is available only after traveling to Heelton and moves the player in.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "lowCost";
  assert.ok(!E.actionsAt(st, p).some(a => a.id === "X003"));
  p.location = "luxury";
  assert.ok(E.actionsAt(st, p).some(a => a.id === "X003" && a.ok));
  const r = E.perform(st, "X003"); assert.ok(r.ok);
  assert.strictEqual(p.housing, "lux"); assert.strictEqual(p.location, "luxury");
}

// v5 courses: 30 courses in 5 paths, strictly sequential, one-time, fee on
// the first click only, multi-click courses keep partial progress.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "university";
  st.maxRounds = 0;   // this walk spans ~60 turns of partial progress
  assert.strictEqual(E.perform(st, "A120").needsChoice, "course");
  assert.strictEqual(E.perform(st, "A120", { course: "P1C2" }).ok, false, "course 2 locked until course 1");
  assert.strictEqual(E.perform(st, "A120", { course: "P2C1" }).ok, false, "path 2 locked until path 1");
  E.COURSES.forEach((course) => {
    for (let k = 0; k < course.clicks; k++) {
      rich(p);
      const before = p.stats.money;
      const r = E.perform(st, "A120", { course: course.id });
      assert.ok(r.ok, `course ${course.id} click ${k + 1} should be available in sequence`);
      const expectedFee = k === 0 ? Math.round(course.costPct * 100) : 0;
      assert.strictEqual(before - p.stats.money, expectedFee, `${course.id} fee charged on first click only`);
      if (k < course.clicks - 1) {
        assert.ok(!p.edu.done.includes(course.id), `${course.id} not complete after ${k + 1} clicks`);
        E.endTurn(st); p.location = "university";   // partial progress persists between turns
        assert.strictEqual(p.edu.current.clicks, k + 1, `${course.id} progress kept across turns`);
      }
    }
    assert.ok(p.edu.done.includes(course.id), `${course.id} completed after ${course.clicks} clicks`);
    rich(p);
    const again = E.perform(st, "A120", { course: course.id });
    assert.strictEqual(again.ok, false, `${course.id} cannot be repeated`);
  });
  assert.deepStrictEqual(p.degrees, ["Technical Certification", "College Diploma", "College Degree", "Master's Degree", "PhD"]);
  rich(p);
  const done = E.actionsAt(st, p).find(a => a.id === "A120");
  assert.strictEqual(done.ok, false); assert.match(done.why, /All 30 courses completed/);
  assert.deepStrictEqual(E.COURSES.map(c => Math.round(c.costPct * 100)).filter((v, i, a) => a.indexOf(v) === i), [50, 100, 150, 200, 250]);
  assert.deepStrictEqual(E.COURSES.map(c => c.clicks).filter((v, i, a) => a.indexOf(v) === i), [1, 2, 3, 4, 5]);
}

// v5 jobs: no promotion action, no loyalty requirement; tiers open on work
// clicks + the matching education path.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "soulExchange";
  assert.ok(!E.ACTIONS.A084, "Ask for Promotion removed");
  let r = E.perform(st, "A076", { job: "Teller", building: "debtstreet" });
  assert.ok(r.ok); assert.strictEqual(p.job.name, "Teller");
  p.items.push("Smart Clothes", "Business Clothes", "Computer"); p.stats.critical = 100; p.stats.career = 100;
  for (let i = 0; i < 20; i++) { p.location = "debtstreet"; rich(p); assert.ok(E.perform(st, "A092").ok); }
  assert.strictEqual(p.workClicks.Low, 20);
  p.location = "soulExchange"; rich(p);
  r = E.perform(st, "A076", { job: "Junior Loan Shark", building: "debtstreet" });
  assert.strictEqual(r.ok, false, "Mid needs Path 2 even with 20 Low clicks"); assert.match(r.why, /Path 2/);
  E.COURSES.filter(c => c.path <= 2).forEach(c => { p.edu.done.push(c.id); });
  r = E.perform(st, "A076", { job: "Junior Loan Shark", building: "debtstreet" });
  assert.ok(r.ok, "Mid unlocked by 20 Low clicks + Path 2 (alternate route)"); assert.strictEqual(p.job.name, "Junior Loan Shark");
  // switch straight back to an entry job and back again: no minimum time in a job
  r = E.perform(st, "A076", { job: "Teller", building: "debtstreet" }); assert.ok(r.ok);
  r = E.perform(st, "A076", { job: "Junior Loan Shark", building: "debtstreet" }); assert.ok(r.ok);
  // Low+ gate: 10 Low clicks + Path 1 (have both)
  assert.ok(E.tierGate(st, p, "Low+").ok);
  // High needs 25 Mid+ OR 30 Mid clicks + Path 4
  E.COURSES.filter(c => c.path <= 4).forEach(c => { if (!p.edu.done.includes(c.id)) p.edu.done.push(c.id); });
  r = E.perform(st, "A076", { job: "Mortgage Broker", building: "debtstreet" });
  assert.strictEqual(r.ok, false); assert.match(r.why, /30 Mid work clicks \(0\/30\)/);
  p.workClicks.Mid = 30;
  r = E.perform(st, "A076", { job: "Mortgage Broker", building: "debtstreet" });
  assert.ok(r.ok, "High unlocked via 30 Mid clicks + Path 4");
  // Max needs 40 High clicks + Path 5
  r = E.perform(st, "A076", { job: "Chief Financial Officer", building: "debtstreet" });
  assert.strictEqual(r.ok, false); assert.match(r.why, /Path 5/);
  // pay is set by tier: $40 Low ... $400 Max at B=100
  const pay = {}; E.DATA.jobs.forEach(j => { pay[j.progressTier] = j.basePayT100; });
  assert.deepStrictEqual(pay, { Low: 40, "Low+": 65, Mid: 110, "Mid+": 170, High: 260, Max: 400 });
}

// Missing every shift after the grace week fires the player.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "soulExchange";
  assert.ok(E.perform(st, "A076", { job: "Teller", building: "debtstreet" }).ok);
  p.ate = true; E.endTurn(st); // hiring week grace
  assert.ok(p.job); p.ate = true; E.endTurn(st);
  assert.strictEqual(p.job, null);
  assert.ok(st.log.some(row => /Fired from Teller/.test(row.text)));
}

// Work From Home counts toward attendance without paying a duplicate salary.
{
  const st = game(), p = st.players[0]; rich(p);
  p.job = E.DATA.jobs.find(j => j.name === "Teller" && j.building === "debtstreet");
  p.jobStartedTurn = 1; p.jobShifts = 0; st.turn = 2; p.location = "luxury"; p.housing = "lux"; p.items.push("Computer", "Desk");
  const before = p.stats.money; const r = E.perform(st, "A015");
  assert.ok(r.ok); assert.strictEqual(p.workedThisTurn, true); assert.strictEqual(p.jobShifts, 1);
  assert.ok(p.stats.money >= before, "remote action keeps its sheet-authored effects");
  p.ate = true; E.endTurn(st); assert.ok(p.job, "remote work should retain job");
}

// Loose change now has both its delivered cue and generic money signal.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "park";
  const r = E.perform(st, "A023"); assert.ok(r.ok); assert.ok(r.sfx.includes("money"));
}

console.log("KENDRICK REGRESSIONS PASS");
