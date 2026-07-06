# Round-3 fixes: numeric items, club dress code, coolness actions,
# housing recovery/switching, pet pictures, homeless re-house buttons.
import io

def patch(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    for tag, old, new in pairs:
        assert old in s, "MISSING " + path + ": " + tag
        s = s.replace(old, new)
    io.open(path, "w", encoding="utf-8").write(s)
    print(path, "OK")

# ================= engine.js =================
patch("js/engine.js", [
# items: flat numeric grant on purchase instead of a passive gain multiplier
("itemMult",
"""  function itemMult(p, stat) {
    // per slot only the best item counts; for a stat take the strongest bonus/penalty
    var bySlot = {};
    p.items.forEach(function (n) {
      var it = ITEMS[n]; if (!it) return;
      var cur = bySlot[it.slot];
      var pw = it.bonus ? it.bonus.pct : 0;
      if (!cur || pw > (cur.bonus ? cur.bonus.pct : 0)) bySlot[it.slot] = it;
    });
    var bonus = 0, penalty = 0;
    Object.keys(bySlot).forEach(function (s) {
      var it = bySlot[s];
      if (it.bonus && it.bonus.stat === stat) bonus = Math.max(bonus, it.bonus.pct);
      if (it.penalty && it.penalty.stat === stat) penalty = Math.max(penalty, it.penalty.pct);
    });
    return (1 + bonus) * (1 - penalty);
  }""",
"""  function itemMult(p, stat) {
    // items now grant flat stat points at purchase (see openShop fx below) —
    // visible and readable — instead of an invisible passive gain multiplier.
    return 1;
  }"""),
("shop grant",
"""          addStat(state, p, "money", -icost);
          p.items.push(it.name);
          summary.push("bought " + it.name + " (-$" + icost + ")");""",
"""          addStat(state, p, "money", -icost);
          p.items.push(it.name);
          summary.push("bought " + it.name + " (-$" + icost + ")");
          // numeric stat grant: the sheet's bonus % of T lands ONCE as points
          if (it.bonus) {
            var bpts = Math.round(it.bonus.pct * state.T);
            var bd = addStat(state, p, it.bonus.stat, bpts);
            if (bd) summary.push("+" + bd + " " + statName(it.bonus.stat));
          }
          if (it.penalty) {
            var ppts = Math.round(it.penalty.pct * state.T);
            var pd = addStat(state, p, it.penalty.stat, -ppts);
            if (pd) summary.push(pd + " " + statName(it.penalty.stat));
          }"""),
# club: dress code instead of coolness
("clubGate",
"""  function clubGate(state, p) {
    var need = Math.round((ASSUME.clubEntryCoolnessPct || 0) * state.T);
    if (p.stats.coolness >= need) return null;
    return "The bouncer looks you over… need Coolness " + need + "+ to get in";
  }""",
"""  function clubGate(state, p) {
    var missing = (ASSUME.clubEntryItems || []).filter(function (n) {
      return p.items.indexOf(n) === -1;
    });
    if (!missing.length) return null;
    return "Dress code! The bouncer wants: " + missing.join(" + ");
  }"""),
])

# ================= assumptions.js =================
patch("js/assumptions.js", [
("club items",
"""  // --- Bad Decisions Club door policy (TTTTT: bouncer checks Coolness) ---
  clubEntryCoolnessPct: 0.08, // need Coolness >= 8% of T to get in (8 at Short)""",
"""  // --- Bad Decisions Club door policy: it's a DRESS CODE now (Austin 2026-07-05) ---
  clubEntryItems: ["Dressy Clothes", "Dress Shoes"],

  // --- Housing deposits (switching / recovering costs deposit + that cycle's rent) ---
  lowDepositPct: 0.10,
  luxDepositPct: 0.25,"""),
("extra actions",
"""    { id: "X005", building: "lowCost", name: "Rent Low Cost Room", category: "Housing",
      tu: 1, costPct: 0.20, gains: [], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }],
      note: "Recover from homelessness. The Park was never home." },""",
"""    { id: "X005", building: "anywhere", name: "Re-house: Low Cost Room", category: "Housing",
      tu: 1, costPct: 0.30, gains: [], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }],
      note: "Deposit $10 + rent $20 (Short). Back on your feet — usable anywhere." },
    { id: "X009", building: "anywhere", name: "Re-house: Luxury Suite", category: "Housing",
      tu: 1, costPct: 0.75, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }, { kind: "moveIn", tier: "lux" }],
      note: "Deposit $25 + rent $50 (Short). From park bench to penthouse." },
    { id: "X010", building: "park", name: "Skate the Fountain Edge", category: "Coolness",
      tu: 1, costPct: 0, gains: [{ stat: "coolness", pct: 0.05 }], petGains: [],
      penalties: [{ stat: "health", pct: 0.015 }],
      req: [],
      fx: [],
      note: "Free coolness. Occasional dignity loss." },
    { id: "X011", building: "regretBurger", name: "Order Off-Menu Like a Regular", category: "Coolness",
      tu: 1, costPct: 0.03, gains: [{ stat: "coolness", pct: 0.04 }, { stat: "happiness", pct: 0.02 }],
      petGains: [], penalties: [],
      req: [],
      fx: [{ kind: "eat" }],
      note: "Fills hunger. The staff pretends to know you." },
    { id: "X012", building: "lowCost", name: "Thrift-Flip Your Outfit", category: "Coolness",
      tu: 1, costPct: 0.02, gains: [{ stat: "coolness", pct: 0.04 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }],
      fx: [],
      note: "Scissors + confidence = fashion." },"""),
("lux lease cost",
"""    { id: "X003", building: "luxury", name: "Sign Luxury Lease", category: "Housing",
      tu: 1, costPct: 0.40, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "notLux" }],
      fx: [{ kind: "moveIn", tier: "lux" }],
      note: "Move up to Heelton Heights. Luxury rent (0.5T) is due every rent cycle." },""",
"""    { id: "X003", building: "luxury", name: "Switch to Luxury Suite", category: "Housing",
      tu: 1, costPct: 0.75, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "notLux" }],
      fx: [{ kind: "moveIn", tier: "lux" }, { kind: "payRent", tier: "lux" }],
      note: "Deposit $25 + first rent $50 (Short). Welcome to Heelton Heights." },"""),
("low switch cost",
"""    { id: "X004", building: "lowCost", name: "Move Back to Low Cost", category: "Housing",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [{ stat: "happiness", pct: 0.03 }],
      req: [{ kind: "isLux" }],
      fx: [{ kind: "moveIn", tier: "low" }],
      note: "Downgrade. Cheaper rent, bruised ego." },""",
"""    { id: "X004", building: "lowCost", name: "Switch to Low Cost Room", category: "Housing",
      tu: 1, costPct: 0.30, gains: [], petGains: [], penalties: [{ stat: "happiness", pct: 0.03 }],
      req: [{ kind: "isLux" }],
      fx: [{ kind: "moveIn", tier: "low" }, { kind: "payRent", tier: "low" }],
      note: "Deposit $10 + rent $20 (Short). Cheaper, humbler." },"""),
])

# ================= bots.js =================
patch("js/bots.js", [
("shoes goal",
"""    if (!owns("Dressy Clothes") && p.stats.connection < 0.8 * T) wants.push("Dressy Clothes");""",
"""    if (!owns("Dressy Clothes") && p.stats.connection < 0.8 * T) wants.push("Dressy Clothes");
    if (owns("Dressy Clothes") && !owns("Dress Shoes") && p.stats.connection < 0.8 * T) wants.push("Dress Shoes");"""),
("rehouse cash check",
"""      if (p.stats.money >= 0.2 * T && p.location !== "lowCost" && E.moveCost(state, p, "lowCost").tu <= p.tu)
        return { type: "move", to: "lowCost" };""",
"""      // X005 re-house works anywhere now — no trip needed""" ),
])

print("round3 core patches done")
