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
 "A067", "A068", "A069", "A070", "A071", "A072"].forEach(id => {
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

// The HUD-triggered luxury lease is available away from Heelton and moves the player in.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "lowCost";
  assert.ok(E.actionsAt(st, p).some(a => a.id === "X003" && a.ok));
  const r = E.perform(st, "X003"); assert.ok(r.ok);
  assert.strictEqual(p.housing, "lux"); assert.strictEqual(p.location, "luxury");
}

// Courses are one-time and sequential.
{
  const st = game(), p = st.players[0], courses = E.ASSUME.courses; rich(p); p.location = "university";
  assert.strictEqual(E.perform(st, "A067").needsChoice, "course");
  assert.strictEqual(E.perform(st, "A067", { course: courses[1].name }).ok, false);
  courses.forEach((course, i) => {
    rich(p);
    const r = E.perform(st, "A067", { course: course.name });
    assert.ok(r.ok, `course ${i + 1} should unlock in sequence`);
    assert.strictEqual(p.completedCourses[i], course.name);
  });
  rich(p);
  const done = E.actionsAt(st, p).find(a => a.id === "A067");
  assert.strictEqual(done.ok, false); assert.match(done.why, /All courses completed/);
}

// Jobs: direct applications are entry-level only; two shifts unlock one pay step.
{
  const st = game(), p = st.players[0]; rich(p); p.location = "soulExchange";
  let r = E.perform(st, "A076", { job: "Teller", building: "debtstreet" });
  assert.ok(r.ok); assert.strictEqual(p.job.name, "Teller"); assert.strictEqual(p.jobShifts, 0);
  p.items.push("Smart Clothes"); p.stats.critical = 100;
  p.location = "debtstreet"; rich(p); assert.ok(E.perform(st, "A092").ok); assert.strictEqual(p.jobShifts, 1);
  p.location = "debtstreet"; rich(p); assert.ok(E.perform(st, "A092").ok); assert.strictEqual(p.jobShifts, 2);
  assert.strictEqual(E.bestPromotion(st, p).name, "Junior Loan Shark", "promotion must choose next pay step");
  p.location = "soulExchange"; rich(p); r = E.perform(st, "A084");
  assert.ok(r.ok); assert.strictEqual(p.job.name, "Junior Loan Shark"); assert.strictEqual(p.jobShifts, 0);

  p.items.push("Business Clothes"); p.jobShifts = 2; p.location = "soulExchange"; rich(p);
  r = E.perform(st, "A084"); assert.strictEqual(r.ok, false); assert.match(r.why, /one promotion per week/i);

  p.stats.money = 1000; p.stats.critical = 100; p.location = "soulExchange"; p.tu = 999;
  r = E.perform(st, "A076", { job: "Wolf of Debtstreet", building: "debtstreet" });
  assert.strictEqual(r.ok, false); assert.match(r.why, /Promotion track only/);
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
