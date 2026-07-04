/*
 * PERSONALITY PANIC — CPU BOTS
 * Priority script per Manual §17: eat if hungry -> relax if stress pending ->
 * pay rent if due -> otherwise the highest-value affordable action for this
 * personality's strengths. One decision per call; the UI/sim loops until "end".
 */
(function () {
  var E = (typeof window !== "undefined") ? window.PPEngine : require("./engine.js");
  var DATA = E.DATA, ASSUME = E.ASSUME;

  // value of one point toward each stat for this bot (mains dominate score)
  function statWeight(state, p, stat) {
    if (stat === "petHappiness" || stat === "petHealth") return (p.pet && !p.pet.dead) ? 0.5 : 0;
    var isMain = DATA.settings.mainStats.indexOf(stat) !== -1;
    var cur = p.stats[stat], deficit = Math.max(0, state.T - cur) / state.T;
    if (deficit <= 0) return 0;
    var w = isMain ? 1.0 : 0.5;
    if (stat === "money") w = 0.35; // cash is also fuel, don't hoard for score alone
    // Critical Thinking gates every mid+ job — treat it as near-main until unlocked
    if (stat === "critical" && cur < 0.35 * state.T) w = 0.85;
    return w * (0.4 + 0.6 * deficit);
  }

  function actionValue(state, p, ann, extraTu) {
    if (!ann.ok) return -1;
    var a = ann.action, v = 0;
    // keep a small rent reserve: generic actions must not drain the wallet dry
    if (ann.cost > 0 && (p.stats.money - ann.cost) < 0.12 * state.T) return -1;
    if (a.name === "Work" && p.job) {
      var scale = state.T / 100;
      v += p.job.basePayT100 * scale * statWeight(state, p, "money");
      v += p.job.careerGainT100 * scale * statWeight(state, p, "career");
      p.job.effects.forEach(function (e) { v += e.amtT100 * scale * statWeight(state, p, e.stat); });
    } else {
      a.gains.forEach(function (g) {
        v += g.pct * state.T * E.totalMult(state, p, g.stat) * statWeight(state, p, g.stat);
      });
      (a.petGains || []).forEach(function (g) { v += g.pct * state.T * statWeight(state, p, g.stat); });
      a.penalties.forEach(function (g) { v -= g.pct * state.T * statWeight(state, p, g.stat) * 1.1; });
    }
    v -= ann.cost * 0.35 / (1 + p.stats.money / state.T); // spending hurts more when broke
    // upkeep nudges
    if (!p.ate && a.fx.some(function (f) { return f.kind === "eat"; })) v += state.T * 0.08;
    if (p.turnsSinceRelax >= 1 && a.fx.some(function (f) { return f.kind === "relax"; })) v += state.T * 0.05 * p.turnsSinceRelax;
    if (a.fx.some(function (f) { return f.kind === "degreeProgress" || f.kind === "grantDegree"; })) v += state.T * 0.03;
    var tu = a.tu + (extraTu || 0);
    return v / Math.max(1, tu);
  }

  function cheapestFood(state, p) {
    // candidate food actions across buildings, including travel cost
    var best = null;
    Object.keys(E.ACTIONS).forEach(function (id) {
      var a = E.ACTIONS[id];
      if (!a.fx.some(function (f) { return f.kind === "eat"; })) return;
      var mc = a.building === p.location ? { tu: 0 } : E.moveCost(state, p, a.building === "anywhere" ? p.location : a.building);
      var totalTu = a.tu + mc.tu, cost = Math.round(a.costPct * state.T);
      if (totalTu > p.tu || cost > p.stats.money) return;
      // requirements that don't depend on being there yet
      var fake = Object.assign({}, p, { location: a.building });
      var sim = { s: state, p: fake };
      var why = null;
      try { why = E.actionsAt(state, fake).filter(function (x) { return x.id === id; })[0]; } catch (e) { return; }
      if (!why || !why.ok) return;
      var score = cost + totalTu * 2 + (a.penalties || []).reduce(function (s, x) { return s + (x.stat === "health" ? x.pct * state.T : 0); }, 0);
      if (!best || score < best.score) best = { id: id, building: a.building, score: score };
    });
    return best;
  }

  function pickPet(p) {
    // pick the pet that covers this personality's weaknesses
    var per = DATA.personalities[p.code], best = null;
    Object.keys(DATA.pets).forEach(function (code) {
      var pet = DATA.pets[code], s = 0;
      if (pet.main === per.mainWeakness || pet.upkeep === per.mainWeakness) s += 2;
      if (pet.main === per.upkeepWeakness || pet.upkeep === per.upkeepWeakness) s += 1;
      if (!best || s > best.s) best = { code: code, s: s };
    });
    return best.code;
  }

  function bestJobChoice(state, p) {
    var best = null;
    E.jobsWithStatus(state, p).forEach(function (e) {
      if (e.why) return;
      if (p.job && e.job.basePayT100 <= p.job.basePayT100) return;
      if (!best || e.job.basePayT100 > best.basePayT100) best = e.job;
    });
    return best;
  }

  // What the bot still needs to buy, in priority order.
  // Returns {item|adopt, cost, affordable} — an unaffordable goal is a reason to WORK.
  function shoppingGoal(state, p) {
    var T = state.T, cash = p.stats.money;
    var wants = [];
    function owns(n) { return p.items.indexOf(n) !== -1; }
    if (!owns("Casual Clothes")) wants.push("Casual Clothes");
    if (!owns("Fridge")) wants.push("Fridge"); // food engine first: kills the daily grocery run
    if (!p.pet) wants.push("__adopt__");
    if (p.pet && !p.pet.dead && !p.flags.petToy && !owns("Pet Toys")) wants.push("Pet Toys");
    if (!owns("Smart Clothes") && p.stats.career > 0.10 * T) wants.push("Smart Clothes");
    if (!owns("Dressy Clothes") && p.stats.connection < 0.8 * T) wants.push("Dressy Clothes");
    if (!owns("Business Clothes") && p.stats.career > 0.25 * T) wants.push("Business Clothes");
    if (!owns("Bicycle")) wants.push("Bicycle");
    if (!owns("Computer") && p.stats.career > 0.4 * T) wants.push("Computer");
    if (!wants.length) return null;
    var reserve = Math.round(0.12 * T);
    function costOf(w) {
      if (w === "__adopt__") return Math.round(0.12 * T) + Math.round(0.04 * T); // adoption + first food
      return Math.round(E.ITEMS[w].costPct * T);
    }
    // buy the first goal we can actually afford; otherwise earn toward the top one
    for (var i = 0; i < wants.length; i++) {
      var c = costOf(wants[i]);
      if (cash >= c + reserve) {
        return wants[i] === "__adopt__" ? { adopt: true, cost: c, affordable: true }
                                        : { item: wants[i], cost: c, affordable: true };
      }
    }
    return { item: wants[0] === "__adopt__" ? null : wants[0], adopt: wants[0] === "__adopt__",
             cost: costOf(wants[0]), affordable: false };
  }

  // Decide ONE step. Returns {type:"perform",id,choice} | {type:"move",to} | {type:"end"}
  function botStep(state) {
    var p = E.active(state), T = state.T;
    if (p.tu <= 0) return { type: "end" };
    var here = E.actionsAt(state, p);
    function findHere(pred) { return here.filter(function (x) { return x.ok && pred(x); })[0]; }

    // 0) a Sick/Critical pet outranks everything — the death penalty is brutal
    if (p.pet && !p.pet.dead && !p.pet.fedThisTurn) {
      var band0 = E.petState(state, p);
      if (band0 === "Sick" || band0 === "Critical") {
        var feedNow = findHere(function (x) { return (x.id === "A007" || x.id === "A105" || x.id === "X008") && x.ok; });
        if (feedNow) return { type: "perform", id: feedNow.id };
        var dest0 = (p.petFoodLeft > 0 && !p.homeless) ? (p.housing === "lux" ? "luxury" : "lowCost") : "petShop";
        if (p.location !== dest0 && E.moveCost(state, p, dest0).tu + 1 <= p.tu) return { type: "move", to: dest0 };
      }
    }
    // 1) rent due -> pay it (payable anywhere)
    var rent = findHere(function (x) { return x.action.fx.some(function (f) { return f.kind === "payRent"; }); });
    if (rent) return { type: "perform", id: rent.id };
    // homeless recovery: cheque, then re-house
    if (p.homeless) {
      var cheque = findHere(function (x) { return x.id === "A024"; });
      if (cheque) return { type: "perform", id: cheque.id };
      var rehouse = findHere(function (x) { return x.id === "X005"; });
      if (rehouse) return { type: "perform", id: rehouse.id };
      if (p.stats.money >= 0.2 * T && p.location !== "lowCost" && E.moveCost(state, p, "lowCost").tu <= p.tu)
        return { type: "move", to: "lowCost" };
      if (E.isRentTurn(state) && p.location !== "park" && E.moveCost(state, p, "park").tu <= p.tu)
        return { type: "move", to: "park" };
    }
    // 2) eat — prefer groceries at home over the Regret Burger health treadmill
    if (!p.ate) {
      var food = cheapestFood(state, p);
      if (food) {
        if (food.building !== p.location && food.building !== "anywhere") return { type: "move", to: food.building };
        return { type: "perform", id: food.id };
      }
    }
    // 2b) keep the fridge stocked: groceries are health-positive food
    if (!p.homeless && p.foodSupply < 1 && p.stats.money >= Math.round(0.08 * T) + Math.round(0.2 * T)) {
      if (p.location === "airOne") {
        var bulk = findHere(function (x) { return x.id === "A028"; }); // 4 weeks (needs fridge)
        if (bulk && p.stats.money >= Math.round(0.28 * T) + Math.round(0.2 * T)) return { type: "perform", id: bulk.id };
        var wk = findHere(function (x) { return x.id === "A026"; });
        if (wk) return { type: "perform", id: wk.id };
      } else if (E.moveCost(state, p, "airOne").tu + 1 <= p.tu) {
        return { type: "move", to: "airOne" };
      }
    }
    // 3) relax before the stress penalty lands
    if (p.turnsSinceRelax >= 2) {
      var relax = findHere(function (x) { return x.action.fx.some(function (f) { return f.kind === "relax"; }); });
      if (relax) return { type: "perform", id: relax.id };
      if (p.location !== "park" && E.moveCost(state, p, "park").tu < p.tu) return { type: "move", to: "park" };
    }
    // 4) pet care — feed every turn it's possible; never let the death spiral start
    if (p.pet && !p.pet.dead) {
      if (!p.pet.fedThisTurn) {
        var feed = findHere(function (x) { return (x.id === "A007" || x.id === "A105" || x.id === "X008") && x.ok; });
        if (feed) return { type: "perform", id: feed.id };
      }
      if (p.petFoodLeft < 2 && p.stats.money > 0.12 * T) {
        var buyFood = findHere(function (x) { return x.id === "A103" && x.ok; });
        if (buyFood) return { type: "perform", id: buyFood.id };
      }
      var band = E.petState(state, p);
      var needTrip = (!p.pet.fedThisTurn && (band === "Hungry" || band === "Sick" || band === "Critical"));
      if (needTrip && p.location !== "petShop" && p.location !== "lowCost") {
        var dest = p.petFoodLeft > 0 && !p.homeless ? "lowCost" : "petShop";
        if (E.moveCost(state, p, dest).tu + 1 <= p.tu) return { type: "move", to: dest };
      }
      if (p.pet.happiness < 0.5 * T && p.location === "petShop") {
        var play = findHere(function (x) { return x.id === "A107" && x.ok; });
        if (play) return { type: "perform", id: play.id };
      }
    }
    // 4c) home pet bonding only when the pet is really glum (it's also +Connection)
    if (p.pet && !p.pet.dead && p.pet.happiness < 0.35 * T && p.location === "lowCost") {
      var hang = findHere(function (x) { return x.id === "A006" && x.ok; });
      if (hang) return { type: "perform", id: hang.id };
    }
    // 4b) education: Critical Thinking gates all good jobs; degrees are milestones
    var reserve = Math.round(0.12 * T);
    var degreeMilestone = findHere(function (x) {
      return (x.id === "A070" || x.id === "A071") && x.ok;
    });
    if (degreeMilestone) return { type: "perform", id: degreeMilestone.id };
    if (p.stats.critical < 0.30 * T && p.stats.money >= Math.round(0.08 * T) + reserve) {
      if (p.location === "university") {
        var cls = findHere(function (x) { return x.id === "A067" && x.ok; });
        if (cls) return { type: "perform", id: cls.id };
      } else if (E.moveCost(state, p, "university").tu + 2 <= p.tu) {
        return { type: "move", to: "university" };
      }
    }
    // 5) get a (better) job: none yet, or a 30%+ raise is on the table
    var betterJob = bestJobChoice(state, p);
    var wantJob = !p.job || (betterJob && betterJob.basePayT100 >= p.job.basePayT100 * 1.3);
    if (wantJob && betterJob) {
      if (p.location !== "soulExchange") {
        if (E.moveCost(state, p, "soulExchange").tu + 1 <= p.tu) return { type: "move", to: "soulExchange" };
      } else {
        var getJob = findHere(function (x) { return x.id === "A076"; });
        if (getJob) return { type: "perform", id: getJob.id, choice: { job: betterJob.name, building: betterJob.building } };
      }
    }
    // 5b) work when cash is low OR the next purchase goal needs funding
    var goal = shoppingGoal(state, p);
    var needCash = p.stats.money < 0.40 * T || (goal && !goal.affordable);
    if (p.job && needCash) {
      if (p.location === p.job.building) {
        var work = findHere(function (x) { return x.name === "Work"; });
        if (work && work.ok) return { type: "perform", id: work.id };
      } else if (E.moveCost(state, p, p.job.building).tu + 2 <= p.tu) {
        return { type: "move", to: p.job.building };
      }
    }
    // 6) shopping goals (clothes chain / pet / fridge)
    if (goal && goal.affordable) {
      if (goal.adopt) {
        if (p.location !== "petShop") {
          if (E.moveCost(state, p, "petShop").tu + 1 <= p.tu) return { type: "move", to: "petShop" };
        } else {
          var adopt = findHere(function (x) { return x.id === "A102"; });
          if (adopt) return { type: "perform", id: adopt.id, choice: { pet: pickPet(p) } };
        }
      } else {
        if (p.location !== "mall") {
          if (E.moveCost(state, p, "mall").tu + 1 <= p.tu) return { type: "move", to: "mall" };
        } else {
          var it = E.ITEMS[goal.item];
          var shopAction = { "Transportation": "A112", "Electronics/Appliances": "A113",
                             "Furniture": "A114", "Clothing": "A115" }[it.group];
          var shop = findHere(function (x) { return x.id === shopAction; });
          if (shop) return { type: "perform", id: shop.id, choice: { item: goal.item } };
        }
      }
    }
    // 7) best-value action: here, or one move away
    var best = null;
    here.forEach(function (ann) {
      if (ann.action.fx.some(function (f) { return f.kind === "openShop" || f.kind === "openJobDialog" || f.kind === "adoptPet"; })) return;
      var v = actionValue(state, p, ann, 0);
      if (v > 0 && (!best || v > best.v)) best = { v: v, step: { type: "perform", id: ann.id } };
    });
    Object.keys(DATA.buildings).forEach(function (b) {
      if (b === p.location) return;
      var mc = E.moveCost(state, p, b);
      if (mc.tu >= p.tu) return;
      var fake = Object.assign({}, p, { location: b, tu: p.tu - mc.tu });
      E.actionsAt(state, fake).forEach(function (ann) {
        if (!ann.ok) return;
        if (ann.action.fx.some(function (f) { return f.kind === "openShop" || f.kind === "openJobDialog" || f.kind === "adoptPet"; })) return;
        var v = actionValue(state, fake, ann, mc.tu);
        if (v > 0 && (!best || v > best.v)) best = { v: v, step: { type: "move", to: b } };
      });
    });
    if (best) return best.step;
    return { type: "end" };
  }

  // Run a whole bot turn (used by sim + "skip" button). Returns step log.
  function botTurn(state, maxSteps) {
    var steps = [], guard = maxSteps || 30;
    while (guard-- > 0 && !state.over) {
      var s = botStep(state);
      steps.push(s);
      if (s.type === "end") { E.endTurn(state); break; }
      var r = s.type === "move" ? E.moveTo(state, s.to) : E.perform(state, s.id, s.choice);
      if (!r.ok || r.needsChoice) { E.endTurn(state); steps.push({ type: "end", forced: true }); break; }
    }
    if (guard <= 0 && !state.over) E.endTurn(state);
    return steps;
  }

  var API = { botStep: botStep, botTurn: botTurn, pickPet: pickPet, bestJobChoice: bestJobChoice };
  if (typeof window !== "undefined") window.PPBots = API;
  if (typeof module !== "undefined") module.exports = API;
})();
