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
    var B = E.econ(state);
    if (ann.cost > 0 && (p.stats.money - ann.cost) < reserveOf(state)) return -1;
    if (a.name === "Work" && p.job) {
      var scale = B / 100;
      v += p.job.basePayT100 * scale * statWeight(state, p, "money");
      v += p.job.careerGainT100 * scale * statWeight(state, p, "career");
      p.job.effects.forEach(function (e) { v += e.amtT100 * scale * statWeight(state, p, e.stat); });
    } else {
      a.gains.forEach(function (g) {
        v += g.pct * B * E.totalMult(state, p, g.stat) * statWeight(state, p, g.stat);
      });
      (a.petGains || []).forEach(function (g) { v += g.pct * B * statWeight(state, p, g.stat); });
      a.penalties.forEach(function (g) { v -= g.pct * B * statWeight(state, p, g.stat) * 1.1; });
    }
    v -= ann.cost * 0.35 / (1 + p.stats.money / (5 * B)); // spending hurts more when broke
    // upkeep nudges
    if (!p.ate && a.fx.some(function (f) { return f.kind === "eat"; })) v += B * 0.08;
    if (p.turnsSinceRelax >= 1 && a.fx.some(function (f) { return f.kind === "relax"; })) v += B * 0.05 * p.turnsSinceRelax;
    var tu = ann.tu + (extraTu || 0);
    return v / Math.max(1, tu);
  }

  // cash kept back for rent + a meal before optional spending (v5 low rent is 1.0 B)
  function reserveOf(state, p) { return Math.round(1.2 * E.econ(state)); }

  function cheapestFood(state, p) {
    // candidate food actions across buildings, including travel cost
    var best = null;
    Object.keys(E.ACTIONS).forEach(function (id) {
      var a = E.ACTIONS[id];
      if (!a.fx.some(function (f) { return f.kind === "eat"; })) return;
      var mc = a.building === p.location ? { tu: 0 } : E.moveCost(state, p, a.building === "anywhere" ? p.location : a.building);
      var totalTu = E.tuCost(a) + mc.tu, cost = E.pctB(state, a.costPct);
      if (totalTu > p.tu || cost > p.stats.money) return;
      // requirements that don't depend on being there yet
      var fake = Object.assign({}, p, { location: a.building });
      var sim = { s: state, p: fake };
      var why = null;
      try { why = E.actionsAt(state, fake).filter(function (x) { return x.id === id; })[0]; } catch (e) { return; }
      if (!why || !why.ok) return;
      var score = cost / 5 + totalTu * 2 + (a.penalties || []).reduce(function (s, x) { return s + (x.stat === "health" ? E.pctB(state, x.pct) : 0); }, 0);
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
    var T = state.T, B = E.econ(state), cash = p.stats.money;
    var wants = [];
    function owns(n) { return p.items.indexOf(n) !== -1; }
    if (!owns("Casual Clothes")) wants.push("Casual Clothes");
    if (!owns("Lumpy Bed") && !p.homeless) wants.push("Lumpy Bed");   // $50 sleep fixture
    if (!owns("Plants") && !p.homeless) wants.push("Plants");         // $20 relax fixture
    if (!owns("Fridge") && !p.homeless) wants.push("Fridge");         // unlocks 2/4-week groceries
    if (!p.pet) wants.push("__adopt__");
    if (p.pet && !p.pet.dead && !p.flags.petToy && !owns("Pet Toys")) wants.push("Pet Toys");
    if (!owns("Smart Clothes") && p.stats.career > 0.10 * T) wants.push("Smart Clothes");
    if (!owns("Dressy Clothes") && p.stats.connection < 0.8 * T) wants.push("Dressy Clothes");
    if (owns("Dressy Clothes") && !owns("Dress Shoes") && p.stats.connection < 0.8 * T) wants.push("Dress Shoes");
    if (!owns("Business Clothes") && p.stats.career > 0.25 * T) wants.push("Business Clothes");
    if (!owns("Bicycle")) wants.push("Bicycle");
    if (!owns("Computer") && p.stats.career > 0.4 * T) wants.push("Computer");
    if (!wants.length) return null;
    var reserve = reserveOf(state, p);
    function costOf(w) {
      var adopt = E.ACTIONS.A102, food = E.ACTIONS.A103;
      if (w === "__adopt__") return E.pctB(state, adopt ? adopt.costPct : 0.2) + E.pctB(state, food ? food.costPct : 0.04);
      return E.pctB(state, E.ITEMS[w].costPct);
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
    var p = E.active(state), T = state.T, B = E.econ(state);
    if (p.tu <= 0) return { type: "end" };
    var here = E.actionsAt(state, p);
    function findHere(pred) { return here.filter(function (x) { return x.ok && pred(x); })[0]; }

    // 0) a Sad/Starving pet outranks everything — strike 3 is fatal AND zeroes
    // Happiness, so a bot never knowingly eats strike 2
    if (p.pet && !p.pet.dead && !p.pet.fedThisTurn) {
      var band0 = E.petState(state, p);
      if (band0 === "Sad" || band0 === "Starving") {
        var feedNow = findHere(function (x) { return (x.id === "A007" || x.id === "A105" || x.id === "X008") && x.ok; });
        if (feedNow) return { type: "perform", id: feedNow.id };
        var dest0 = (p.petFoodLeft > 0 && !p.homeless) ? (p.housing === "lux" ? "luxury" : "lowCost") : "petShop";
        if (p.location !== dest0 && E.moveCost(state, p, dest0).tu + Math.round(E.TU_SCALE) <= p.tu) return { type: "move", to: dest0 };
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
      // X005 re-house works anywhere now — no trip needed
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
    // (1-week groceries store nothing — v5 bulk storage needs a Fridge)
    if (!p.homeless && p.foodSupply < 1 && p.items.indexOf("Fridge") !== -1 &&
        p.stats.money >= E.pctB(state, 1.3) + reserveOf(state, p)) {
      if (p.location === "airOne") {
        var bulk = findHere(function (x) { return x.id === "A028" || x.id === "A121"; }); // 4 or 2 weeks
        if (bulk) return { type: "perform", id: bulk.id };
      } else if (E.moveCost(state, p, "airOne").tu + Math.round(E.TU_SCALE) <= p.tu) {
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
      if (p.petFoodLeft < 2 && p.stats.money > reserveOf(state, p)) {
        var buyFood = findHere(function (x) { return x.id === "A103" && x.ok; });
        if (buyFood) return { type: "perform", id: buyFood.id };
      }
      var band = E.petState(state, p);
      var needTrip = (!p.pet.fedThisTurn && band !== "Healthy");
      if (needTrip && p.location !== "petShop" && p.location !== "lowCost") {
        var dest = p.petFoodLeft > 0 && !p.homeless ? "lowCost" : "petShop";
        if (E.moveCost(state, p, dest).tu + Math.round(E.TU_SCALE) <= p.tu) return { type: "move", to: dest };
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
    // 4d) employment is a weekly obligation: complete this week's shift before
    // optional progression errands. (v5: no promotions — see step 5.)
    if (p.job) {
      if (!p.workedThisTurn) {
        if (p.location === p.job.building) {
          var weeklyWork = findHere(function (x) { return x.name === "Work" && x.ok; });
          if (weeklyWork) return { type: "perform", id: weeklyWork.id };
        } else if (E.moveCost(state, p, p.job.building).tu + Math.round(2 * E.TU_SCALE) <= p.tu) {
          return { type: "move", to: p.job.building };
        }
      }
    }
    // 4b) education: the next job tier needs the next path. Study when the
    // player's current tier clicks are nearly there (or the course is paid for),
    // and only with cash to spare after rent + food.
    var course = E.nextCourse(p);
    if (course) {
      var due = E.courseCostDue(state, p, course);
      var gate = E.tierGate(state, p, DATA.education[course.path - 1].unlocksTier);
      var clicksClose = gate.routes.some(function (r) { return r.have >= r.need * 0.5; }) || !gate.routes.length;
      if ((due === 0 || clicksClose) && p.stats.money >= due + reserveOf(state, p)) {
        if (p.location === "university") {
          var cls = findHere(function (x) { return x.id === "A120" && x.ok; });
          if (cls) return { type: "perform", id: cls.id, choice: { course: course.id } };
        } else if (E.moveCost(state, p, "university").tu + course.clicks <= p.tu) {
          return { type: "move", to: "university" };
        }
      }
    }
    // 5) get a (better) job: none yet, or a higher tier is now unlocked
    var betterJob = bestJobChoice(state, p);
    var wantJob = !p.job || (betterJob && betterJob.basePayT100 > p.job.basePayT100);
    if (wantJob && betterJob) {
      if (p.location !== "soulExchange") {
        if (E.moveCost(state, p, "soulExchange").tu + Math.round(E.TU_SCALE) <= p.tu) return { type: "move", to: "soulExchange" };
      } else {
        var getJob = findHere(function (x) { return x.id === "A076"; });
        if (getJob) return { type: "perform", id: getJob.id, choice: { job: betterJob.name, building: betterJob.building } };
      }
    }
    // 5b) work when cash is low OR the next purchase goal needs funding
    var goal = shoppingGoal(state, p);
    var nextFee = course ? E.courseCostDue(state, p, course) : 0;
    var needCash = p.stats.money < 4 * B || (goal && !goal.affordable) || p.stats.money < nextFee + reserveOf(state, p) ||
      (p.job && Object.keys(DATA.jobProgression.tiers).some(function (t) {   // keep earning tier clicks
        var g = E.tierGate(state, p, t); return g.pathOk && !g.clicksOk;
      }));
    if (p.job && needCash) {
      if (p.location === p.job.building) {
        var work = findHere(function (x) { return x.name === "Work"; });
        if (work && work.ok) return { type: "perform", id: work.id };
      } else if (E.moveCost(state, p, p.job.building).tu + Math.round(2 * E.TU_SCALE) <= p.tu) {
        return { type: "move", to: p.job.building };
      }
    }
    // 6) shopping goals (clothes chain / pet / fridge)
    if (goal && goal.affordable) {
      if (goal.adopt) {
        if (p.location !== "petShop") {
          if (E.moveCost(state, p, "petShop").tu + Math.round(E.TU_SCALE) <= p.tu) return { type: "move", to: "petShop" };
        } else {
          var adopt = findHere(function (x) { return x.id === "A102"; });
          if (adopt) return { type: "perform", id: adopt.id, choice: { pet: pickPet(p) } };
        }
      } else {
        if (p.location !== "mall") {
          if (E.moveCost(state, p, "mall").tu + Math.round(E.TU_SCALE) <= p.tu) return { type: "move", to: "mall" };
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
      if (b === "club" && E.clubGate(state, p)) return;   // bouncer would turn the bot away
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
    var steps = [], guard = maxSteps || 90;
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
