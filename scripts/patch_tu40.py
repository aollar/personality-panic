# 40 Time Units per turn — every TU cost scales uniformly (base design = 6/turn),
# so the economy and balance stay identical; the day just has finer time slices.
import io

# ---- generator: turn size 40 (+ keep the design base for scaling) ----
p = "scripts/build_data.py"; s = io.open(p, encoding="utf-8").read()
old = '        "timeUnitsPerTurn": 6,'
new = '        "timeUnitsPerTurn": 40,\n        "baseTimeUnits": 6,  # design base: all sheet TU costs are in sixths of a day'
assert old in s; s = s.replace(old, new)
io.open(p, "w", encoding="utf-8").write(s)

# ---- engine: single scaling point ----
p = "js/engine.js"; s = io.open(p, encoding="utf-8").read()

old = """  var MAIN = DATA.settings.mainStats, UPKEEP = DATA.settings.upkeepStats;"""
new = """  var MAIN = DATA.settings.mainStats, UPKEEP = DATA.settings.upkeepStats;
  // All sheet TU costs are authored against a 6-TU day; the playable turn is
  // now 40 TU, so every cost scales by the same factor (economy unchanged).
  var TU_SCALE = DATA.settings.timeUnitsPerTurn / (DATA.settings.baseTimeUnits || 6);
  function tuCost(a) { return Math.round(a.tu * TU_SCALE); }"""
assert old in s; s = s.replace(old, new)

old = """    var costs = ASSUME.moveCost[transportOf(p)];
    return { tu: costs[far ? 1 : 0], far: far, path: path };"""
new = """    var costs = ASSUME.moveCost[transportOf(p)];
    return { tu: Math.round(costs[far ? 1 : 0] * TU_SCALE), far: far, path: path };"""
assert old in s; s = s.replace(old, new)

old = """    var cost = Math.round(a.costPct * state.T);
    var why = checkReq(state, p, a.req, a);
    if (!why && p.tu < a.tu) why = "Not enough Time Units";
    if (!why && money(p) < cost) why = "Not enough money ($" + cost + ")";
    return { action: a, id: a.id, name: a.name, tu: a.tu, cost: cost, ok: !why, why: why };"""
new = """    var cost = Math.round(a.costPct * state.T);
    var tu = tuCost(a);
    var why = checkReq(state, p, a.req, a);
    if (!why && p.tu < tu) why = "Not enough Time Units";
    if (!why && money(p) < cost) why = "Not enough money ($" + cost + ")";
    return { action: a, id: a.id, name: a.name, tu: tu, cost: cost, ok: !why, why: why };"""
assert old in s; s = s.replace(old, new)

old = """    // pay the bill
    p.tu -= a.tu;"""
new = """    // pay the bill
    p.tu -= ann.tu;"""
assert old in s; s = s.replace(old, new)

old = """    if (!result.ok) { // refund a failed choice-action (job req failed etc.)
      p.tu += a.tu; if (ann.cost) addStat(state, p, "money", ann.cost);"""
new = """    if (!result.ok) { // refund a failed choice-action (job req failed etc.)
      p.tu += ann.tu; if (ann.cost) addStat(state, p, "money", ann.cost);"""
assert old in s; s = s.replace(old, new)

old = """    if (p.tuPenaltyNext > 0) {
      p.tu = Math.max(1, p.tu - p.tuPenaltyNext);"""
new = """    if (p.tuPenaltyNext > 0) {
      p.tu = Math.max(Math.round(TU_SCALE), p.tu - p.tuPenaltyNext);"""
assert old in s; s = s.replace(old, new)

old = """    if (!p.ate) {
      p.tuPenaltyNext += ASSUME.hungerTuPenalty;"""
new = """    if (!p.ate) {
      p.tuPenaltyNext += Math.round(ASSUME.hungerTuPenalty * TU_SCALE);"""
assert old in s; s = s.replace(old, new)

old = """    if (p.turnsSinceRelax > 2) {
      p.tuPenaltyNext += ASSUME.stressTuPenalty;"""
new = """    if (p.turnsSinceRelax > 2) {
      p.tuPenaltyNext += Math.round(ASSUME.stressTuPenalty * TU_SCALE);"""
assert old in s; s = s.replace(old, new)

old = """  var API = {
    DATA: DATA, ASSUME: ASSUME, ACTIONS: ACTIONS, ITEMS: ITEMS,"""
new = """  var API = {
    DATA: DATA, ASSUME: ASSUME, ACTIONS: ACTIONS, ITEMS: ITEMS,
    TU_SCALE: TU_SCALE, tuCost: tuCost,"""
assert old in s; s = s.replace(old, new)
io.open(p, "w", encoding="utf-8").write(s)

# ---- bots: use scaled costs everywhere ----
p = "js/bots.js"; s = io.open(p, encoding="utf-8").read()
old = """    v -= ann.cost * 0.35 / (1 + p.stats.money / state.T); // spending hurts more when broke"""
assert old in s
old2 = """    var tu = a.tu + (extraTu || 0);
    return v / Math.max(1, tu);"""
new2 = """    var tu = ann.tu + (extraTu || 0);
    return v / Math.max(1, tu);"""
assert old2 in s; s = s.replace(old2, new2)
old = """      var mc = a.building === p.location ? { tu: 0 } : E.moveCost(state, p, a.building === "anywhere" ? p.location : a.building);
      var totalTu = a.tu + mc.tu, cost = Math.round(a.costPct * state.T);"""
new = """      var mc = a.building === p.location ? { tu: 0 } : E.moveCost(state, p, a.building === "anywhere" ? p.location : a.building);
      var totalTu = E.tuCost(a) + mc.tu, cost = Math.round(a.costPct * state.T);"""
assert old in s; s = s.replace(old, new)
# "+1"/"+2" TU headroom guesses -> scaled units
s = s.replace(".tu + 1 <= p.tu", ".tu + Math.round(E.TU_SCALE) <= p.tu")
s = s.replace(".tu + 2 <= p.tu", ".tu + Math.round(2 * E.TU_SCALE) <= p.tu")
io.open(p, "w", encoding="utf-8").write(s)

# ---- ui: finer clock (18-minute slices), rounded to 5 min ----
p = "js/ui.js"; s = io.open(p, encoding="utf-8").read()
old = """  function dayClock(p) {
    var total = DATA.settings.timeUnitsPerTurn;
    var spent = Math.max(0, Math.min(total, total - p.tu));
    var hour = 9 + spent * (12 / total);           // 6 TU day: 9 AM -> 9 PM
    var h12 = ((Math.round(hour) + 11) % 12) + 1;
    var ampm = hour < 12 ? "AM" : "PM";
    return h12 + ":00 " + ampm;
  }"""
new = """  function dayClock(p) {
    var total = DATA.settings.timeUnitsPerTurn;
    var spent = Math.max(0, Math.min(total, total - p.tu));
    var mins = Math.round(spent * (12 * 60 / total) / 5) * 5;   // day = 9 AM -> 9 PM
    var h24 = 9 + Math.floor(mins / 60), m = mins % 60;
    var h12 = ((h24 + 11) % 12) + 1;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + (h24 < 12 ? "AM" : "PM");
  }"""
assert old in s; s = s.replace(old, new)
old = '''      el.querySelector(".t").textContent = dayClock(p).replace(":00", "");'''
new = '''      var tod = dayClock(p);
      el.querySelector(".t").textContent = tod.replace(":00 ", " ").replace(" AM", "AM").replace(" PM", "PM");
      el.querySelector(".t").style.fontSize = tod.indexOf(":00") === -1 ? "1.7em" : "2.6em";'''
assert old in s; s = s.replace(old, new)
io.open(p, "w", encoding="utf-8").write(s)
print("TU40 patch applied")
