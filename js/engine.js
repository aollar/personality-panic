/*
 * PERSONALITY PANIC — GAME ENGINE
 * ===============================
 * Pure game logic. No DOM, no audio, no network — the UI, bots, the Node
 * simulation test, and the multiplayer host all drive this same file.
 *
 * Numbers come from PP_DATA (generated from the Balance Lock spreadsheet).
 * Rules the spec never quantified come from PP_ASSUMPTIONS (js/assumptions.js).
 */
(function () {
  var DATA = (typeof window !== "undefined") ? window.PP_DATA : require("../assets/data/gamedata.js");
  var ASSUME = (typeof window !== "undefined") ? window.PP_ASSUMPTIONS : require("./assumptions.js");

  // ---------- Seeded RNG (deterministic games for tests + multiplayer) ----------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rand(state) { // one shared stream stored in state
    state._rngCalls = (state._rngCalls || 0) + 1;
    var r = mulberry32((state.seed + state._rngCalls * 2654435761) >>> 0)();
    return r;
  }

  // ---------- Static lookups ----------
  var ACTIONS = {};
  DATA.actions.concat(ASSUME.extraActions).forEach(function (a) {
    if (ASSUME.removedActions.indexOf(a.id) === -1) ACTIONS[a.id] = a;
  });
  var ITEMS = {}; DATA.items.forEach(function (i) { ITEMS[i.name] = i; });
  var MAIN = DATA.settings.mainStats, UPKEEP = DATA.settings.upkeepStats;
  // All sheet TU costs are authored against a 6-TU day; the playable turn is
  // now 40 TU, so every cost scales by the same factor (economy unchanged).
  var TU_SCALE = DATA.settings.timeUnitsPerTurn / (DATA.settings.baseTimeUnits || 6);
  function tuCost(a) { return a.tu === 0 ? 0 : Math.max(1, Math.floor(a.tu * TU_SCALE)); }
  var ALL_STATS = MAIN.concat(UPKEEP);

  // ---------- Road graph: pairwise building walk distances ----------
  var NODE_POS = {};
  Object.keys(DATA.roadNodes).forEach(function (k) { NODE_POS[k] = DATA.roadNodes[k]; });
  Object.keys(DATA.buildings).forEach(function (id) { NODE_POS[id] = DATA.buildings[id].pos; });
  var AR_X = 1672 / 100, AR_Y = 941 / 100;
  function segLen(a, b) {
    return Math.hypot((a[0] - b[0]) * AR_X, (a[1] - b[1]) * AR_Y);
  }
  var ADJ = {};
  Object.keys(NODE_POS).forEach(function (k) { ADJ[k] = []; });
  DATA.roadEdges.forEach(function (e) {
    var w = segLen(NODE_POS[e[0]], NODE_POS[e[1]]);
    ADJ[e[0]].push([e[1], w]); ADJ[e[1]].push([e[0], w]);
  });
  // connect each building to its 2 nearest road nodes
  Object.keys(DATA.buildings).forEach(function (id) {
    var dists = Object.keys(DATA.roadNodes).map(function (n) {
      return [n, segLen(NODE_POS[id], NODE_POS[n])];
    }).sort(function (a, b) { return a[1] - b[1]; });
    for (var i = 0; i < 2 && i < dists.length; i++) {
      ADJ[id].push([dists[i][0], dists[i][1]]);
      ADJ[dists[i][0]].push([id, dists[i][1]]);
    }
  });
  function shortestPath(fromId, toId) {
    var dist = {}, prev = {}, seen = {};
    Object.keys(NODE_POS).forEach(function (k) { dist[k] = Infinity; });
    dist[fromId] = 0;
    while (true) {
      var u = null, ud = Infinity;
      for (var k in dist) if (!seen[k] && dist[k] < ud) { ud = dist[k]; u = k; }
      if (u === null || u === toId) break;
      seen[u] = true;
      ADJ[u].forEach(function (vw) {
        if (dist[u] + vw[1] < dist[vw[0]]) { dist[vw[0]] = dist[u] + vw[1]; prev[vw[0]] = u; }
      });
    }
    var path = [], cur = toId;
    while (cur !== undefined) { path.unshift(cur); if (cur === fromId) break; cur = prev[cur]; }
    return { nodes: path, length: dist[toId] === Infinity ? segLen(NODE_POS[fromId], NODE_POS[toId]) : dist[toId] };
  }
  var PATHS = {}; // "from|to" -> {nodes,length}
  Object.keys(DATA.buildings).forEach(function (a) {
    Object.keys(DATA.buildings).forEach(function (b) {
      if (a !== b) PATHS[a + "|" + b] = shortestPath(a, b);
    });
  });

  function transportOf(p) {
    if (p.items.indexOf("Car") !== -1) return "Car";
    if (p.items.indexOf("Bicycle") !== -1) return "Bicycle";
    if (p.items.indexOf("Bus Pass") !== -1) return "Bus Pass";
    return "walk";
  }
  function moveCost(state, p, toId) {
    if (p.location === toId) return { tu: 0, far: false, path: null };
    var path = PATHS[p.location + "|" + toId];
    var far = path.length > ASSUME.nearPathPx;
    var costs = ASSUME.moveCost[transportOf(p)];
    var raw = costs[far ? 1 : 0];
    return { tu: raw === 0 ? 0 : Math.max(1, Math.floor(raw * TU_SCALE)), far: far, path: path };
  }

  // ---------- Player / game construction ----------
  function newPlayer(id, name, code, isBot) {
    var stats = {};
    ALL_STATS.forEach(function (s) { stats[s] = 0; });
    return {
      id: id, name: name, code: code, isBot: !!isBot,
      stats: stats, // money lives in stats.money (cash === Money stat, capped at T)
      location: "lowCost", housing: "low", homeless: false,
      tu: DATA.settings.timeUnitsPerTurn, tuPenaltyNext: 0,
      ate: false, turnsSinceRelax: 0, sleptThisTurn: false,
      foodSupply: 0, premiumSupply: false, petFoodLeft: 0,
      items: [], pet: null, petDied: false,
      job: null, degrees: [], degreeProgress: 0,
      flags: {}, debts: [], booster: null,
      rentPaid: false, warnings: []
    };
  }

  function newGame(config) {
    // config: {T, timerSeconds, maxRounds, players:[{name, code, isBot}], seed}
    var state = {
      T: config.T, timerSeconds: config.timerSeconds || 0,
      maxRounds: (config.maxRounds != null) ? config.maxRounds : ASSUME.maxRoundsDefault,
      seed: (config.seed != null) ? config.seed : Math.floor(Math.random() * 1e9),
      turn: 1, activeIdx: 0, over: false, endAfterRound: false,
      players: config.players.map(function (pl, i) { return newPlayer(i, pl.name, pl.code, pl.isBot); }),
      log: [], _rngCalls: 0
    };
    state.players.forEach(function (p) {
      p.stats.money = Math.round(ASSUME.startingMoneyPct * state.T);
      (ASSUME.startingItems || []).forEach(function (it) { p.items.push(it); });
    });
    log(state, null, "Game start — " + state.players.map(function (p) { return p.name + " (" + p.code + ")"; }).join(", ") +
      " · T=" + state.T);
    startTurn(state);
    return state;
  }

  function log(state, p, text, cls) {
    state.log.push({ turn: state.turn, who: p ? p.name : "", text: text, cls: cls || "" });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }

  function active(state) { return state.players[state.activeIdx]; }
  function isRentTurn(state) { return state.turn % DATA.settings.rentIntervalTurns === 0; }

  // ---------- Modifier math (Manual §6.4) ----------
  function personalityMult(p, stat) {
    var per = DATA.personalities[p.code], mods = DATA.settings.modifiers[stat];
    var m = 1, pet = p.pet && !p.pet.dead ? DATA.pets[p.pet.code] : null;
    var petCovers = pet && (pet.main === stat || pet.upkeep === stat);
    if (per.mainStrength === stat || per.upkeepStrength === stat) {
      m += mods.strength;
      if (petCovers) m += 0.05;               // pet stacking a strength: +5%
    } else if (per.mainWeakness === stat || per.upkeepWeakness === stat) {
      m += petCovers ? mods.weakness / 2 : mods.weakness; // pet halves a weakness
    } else if (petCovers) {
      m += 0.10;                              // pet boosting a neutral stat: +10%
    }
    return m;
  }
  function itemMult(p, stat) {
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
  }
  function totalMult(state, p, stat) {
    var m = personalityMult(p, stat) * itemMult(p, stat);
    if (p.booster && (stat === "health" || stat === "coolness")) m *= (1 + ASSUME.booster.gainBonus);
    var cap = DATA.settings.modifiers[stat].cap;
    if (stat === "money") cap = DATA.settings.incomeMultiplierCap;
    return Math.min(m, cap);
  }
  function gainStat(state, p, stat, pct, flat) {
    var base = (flat != null) ? flat : pct * state.T;
    var isPet = stat === "petHappiness" || stat === "petHealth";
    var pts = Math.round(isPet ? base : base * totalMult(state, p, stat));
    if (base > 0 && pts < 1) pts = 1;
    return addStat(state, p, stat, pts);
  }
  function addStat(state, p, stat, pts) {
    var isPet = stat === "petHappiness" || stat === "petHealth";
    if (isPet) {
      if (!p.pet || p.pet.dead) return 0;
      var key = stat === "petHappiness" ? "happiness" : "health";
      var old = p.pet[key];
      p.pet[key] = Math.max(0, Math.min(state.T, old + pts));
      return p.pet[key] - old;
    }
    var o = p.stats[stat];
    p.stats[stat] = Math.max(0, Math.min(state.T, o + pts));
    return p.stats[stat] - o;
  }
  function money(p) { return p.stats.money; }

  // ---------- Requirements ----------
  function checkReq(state, p, req, action) {
    for (var i = 0; i < req.length; i++) {
      var r = req[i];
      switch (r.kind) {
        case "housedLow": if (p.homeless || p.housing !== "low") return "Need to live at Low Cost Housing"; break;
        case "housedLux": if (p.homeless || p.housing !== "lux") return "Need a Luxury Apartment"; break;
        case "notHomeless": if (p.homeless) return "You're homeless right now"; break;
        case "homeless": if (!p.homeless) return "Only while homeless"; break;
        case "isLux": if (p.housing !== "lux" || p.homeless) return "Luxury tenants only"; break;
        case "isLow": if (p.housing !== "low" || p.homeless) return "Low Cost tenants only"; break;
        case "notLux": if (p.housing === "lux" && !p.homeless) return "Already living in luxury"; break;
        case "rentDue": if (!isRentTurn(state)) return "Rent isn't due"; break;
        case "rentUnpaid": if (p.rentPaid) return "Rent already paid"; break;
        case "foodSupply": if (p.foodSupply < 1) return "No groceries at home"; break;
        case "ownsItem": if (p.items.indexOf(r.item) === -1) return "Need " + r.item; break;
        case "hasPet": if (!p.pet || p.pet.dead) return "Need a pet"; break;
        case "noPet": if (p.pet && !p.pet.dead) return "You already have a pet"; break;
        case "petFoodAvailable": if (p.petFoodLeft < 1) return "Need pet food (Ethical Pet Shop)"; break;
        case "furnitureOwned":
          if (!p.items.some(function (n) { return ITEMS[n] && (ITEMS[n].group === "Furniture"); }))
            return "Need furniture from the Mall"; break;
        case "fridge": if (p.items.indexOf("Fridge") === -1) return "Need a Fridge"; break;
        case "stove": if (p.items.indexOf("Stove") === -1) return "Need a Stove"; break;
        case "jobInBuilding":
          if (!p.job) return "Get a job at Corporate Soul Exchange first";
          if (p.job.building !== p.location) return "Your job is at " + DATA.buildings[p.job.building].name; break;
        case "hasJob": if (!p.job) return "Need a job"; break;
        case "benefitsUnlocked":
          if (!p.job || ASSUME.benefitsTiers.indexOf(p.job.tier) === -1) return "Need a job with benefits"; break;
        case "statGte":
          if ((p.stats[r.stat] || 0) < r.pctT * state.T)
            return "Need " + statName(r.stat) + " " + Math.round(r.pctT * state.T) + "+"; break;
        case "degree": if (p.degrees.indexOf(r.degree) === -1) return "Need " + r.degree + " first"; break;
        case "degreeProgress":
          if (p.degreeProgress < r.n) return "Study more first (" + p.degreeProgress + "/" + r.n + " progress)"; break;
        case "myCamp": if (!p.flags.myCamp) return "Buy My Camp first"; break;
        case "promotionEligible":
          if (!p.job) return "Need a job";
          if (!bestPromotion(state, p)) return "No promotion available yet"; break;
      }
    }
    return null;
  }
  function statName(s) {
    return { connection: "Connection", health: "Health", career: "Career", happiness: "Happiness",
      coolness: "Coolness", critical: "Critical Thinking", enlightenment: "Enlightenment",
      money: "Money", petHappiness: "Pet Happiness", petHealth: "Pet Health" }[s] || s;
  }

  // ---------- Jobs ----------
  function jobReqMet(state, p, job) {
    var q = job.req;
    if (q.clothes && p.items.indexOf(q.clothes) === -1) return "Need " + q.clothes;
    if (q.computer && p.items.indexOf("Computer") === -1) return "Need a Computer";
    if (q.degree && p.degrees.indexOf(q.degree) === -1) return "Need " + q.degree;
    for (var i = 0; i < q.stats.length; i++) {
      var s = q.stats[i];
      if ((p.stats[s.stat] || 0) < s.pctT * state.T)
        return "Need " + statName(s.stat) + " " + Math.round(s.pctT * state.T) + "+";
    }
    return null;
  }
  function jobsWithStatus(state, p) {
    return DATA.jobs.map(function (j) {
      return { job: j, why: jobReqMet(state, p, j), current: p.job && p.job.name === j.name && p.job.building === j.building };
    });
  }
  function bestPromotion(state, p) {
    if (!p.job) return null;
    var best = null;
    DATA.jobs.forEach(function (j) {
      if (j.building !== p.job.building) return;
      if (j.basePayT100 <= p.job.basePayT100) return;
      if (jobReqMet(state, p, j)) return;
      if (!best || j.basePayT100 > best.basePayT100) best = j;
    });
    return best;
  }
  function applyWork(state, p) {
    var j = p.job, scale = state.T / 100;
    var pay = gainStat(state, p, "money", null, j.basePayT100 * scale);
    var car = gainStat(state, p, "career", null, j.careerGainT100 * scale);
    var bits = ["+$" + pay, "+" + car + " Career"];
    j.effects.forEach(function (e) {
      var d = addStat(state, p, e.stat, Math.round(e.amtT100 * scale));
      if (d) bits.push((d > 0 ? "+" : "") + d + " " + statName(e.stat));
    });
    log(state, p, "Worked as " + j.name + " (" + bits.join(", ") + ")", "work");
    return { pay: pay };
  }

  // ---------- Actions ----------
  function actionsAt(state, p) {
    var list = [];
    Object.keys(ACTIONS).forEach(function (id) {
      var a = ACTIONS[id];
      if (a.building !== p.location && a.building !== "anywhere") return;
      list.push(annotate(state, p, a));
    });
    // rent bills are payable anywhere (see assumptions: no forced trip home)
    ["X006", "X007"].forEach(function (id) {
      var a = ACTIONS[id];
      if (a.building === p.location) return; // already listed
      if (isRentTurn(state) && !p.rentPaid && !p.homeless &&
          ((id === "X006" && p.housing === "low") || (id === "X007" && p.housing === "lux")))
        list.push(annotate(state, p, a));
    });
    return list;
  }
  function annotate(state, p, a) {
    var cost = Math.round(a.costPct * state.T);
    var tu = tuCost(a);
    var why = checkReq(state, p, a.req, a);
    if (!why && p.tu < tu) why = "Not enough Time Units";
    if (!why && money(p) < cost) why = "Not enough money ($" + cost + ")";
    return { action: a, id: a.id, name: a.name, tu: tu, cost: cost, ok: !why, why: why };
  }

  function perform(state, actionId, choice) {
    var p = active(state), a = ACTIONS[actionId];
    if (state.over) return { ok: false, why: "Game over" };
    if (!a) return { ok: false, why: "Unknown action" };
    var ann = annotate(state, p, a);
    if (!ann.ok) return { ok: false, why: ann.why };

    // choice-dependent actions surface a dialog first
    var needsShop = a.fx.some(function (f) { return f.kind === "openShop"; });
    var needsJob = a.fx.some(function (f) { return f.kind === "openJobDialog"; });
    var needsPet = a.fx.some(function (f) { return f.kind === "adoptPet"; });
    if (needsShop && !choice) {
      var grp = a.fx.filter(function (f) { return f.kind === "openShop"; })[0].group;
      return { ok: true, needsChoice: "shop", group: grp };
    }
    if (needsJob && !choice) return { ok: true, needsChoice: "job" };
    if (needsPet && !choice) return { ok: true, needsChoice: "pet" };

    // pay the bill
    p.tu -= ann.tu;
    if (ann.cost) { addStat(state, p, "money", -ann.cost); }

    var summary = [];
    if (ann.cost) summary.push("-$" + ann.cost);

    // Generic "Work" rows are placeholders — the player's actual job from
    // Jobs_Named (canonical) supplies pay/career/effects instead.
    var isGenericWork = (a.name === "Work");

    // stat gains (with modifiers)
    if (!isGenericWork) a.gains.forEach(function (g) {
      var d = gainStat(state, p, g.stat, g.pct);
      if (d) summary.push("+" + d + " " + statName(g.stat));
    });
    (a.petGains || []).forEach(function (g) {
      var d = gainStat(state, p, g.stat, g.pct);
      if (d) summary.push("+" + d + " " + statName(g.stat));
    });
    if (!isGenericWork) a.penalties.forEach(function (g) {
      var d = addStat(state, p, g.stat, -Math.round(g.pct * state.T));
      if (d) summary.push(d + " " + statName(g.stat));
    });

    var result = { ok: true, sfx: [], summary: summary };

    // structured effects
    a.fx.forEach(function (f) {
      switch (f.kind) {
        case "eat": p.ate = true; result.sfx.push("eat"); break;
        case "consumeSupply":
          p.foodSupply -= 1;
          if (p.premiumSupply) { var d = gainStat(state, p, "health", 0.02); if (d) summary.push("+" + d + " Health"); }
          if (p.foodSupply <= 0) { p.foodSupply = 0; p.premiumSupply = false; }
          break;
        case "relax": p.turnsSinceRelax = 0; break;
        case "foodSupply":
          p.foodSupply += f.weeks; if (f.premium) p.premiumSupply = true; break;
        case "petFood": p.petFoodLeft += f.feedings; break;
        case "feedPet":
          if (p.pet && !p.pet.dead) {
            p.pet.fedThisTurn = true;
            if (a.id !== "A105") p.petFoodLeft = Math.max(0, p.petFoodLeft - 1); // Feed Animals ($) uses shop food
          }
          break;
        case "petToy": p.flags.petToy = true; break;
        case "adoptPet":
          p.pet = { code: choice.pet, health: Math.round(ASSUME.petStartPct * state.T),
                    happiness: Math.round(ASSUME.petStartPct * state.T), fedThisTurn: true, dead: false };
          log(state, p, "Adopted the " + DATA.personalities[choice.pet].name + " pet!", "good");
          break;
        case "degreeProgress": p.degreeProgress += 1; break;
        case "grantDegree":
          if (p.degrees.indexOf(f.degree) === -1) {
            p.degrees.push(f.degree);
            log(state, p, "🎓 Earned " + (f.degree === "Undergrad" ? "an Undergrad degree" : f.degree === "Masters" ? "a Master's" : "a PhD") + "!", "good");
          }
          break;
        case "openJobDialog":
          var jb = DATA.jobs.filter(function (j) { return j.name === choice.job && j.building === choice.building; })[0];
          if (!jb) return;
          var whyJ = jobReqMet(state, p, jb);
          if (whyJ) { result.ok = false; result.why = whyJ; return; }
          p.job = jb;
          log(state, p, "Took the job: " + jb.name + " at " + DATA.buildings[jb.building].name, "good");
          break;
        case "promote":
          var promo = bestPromotion(state, p);
          if (promo) { p.job = promo; log(state, p, "🎉 Promoted to " + promo.name + "!", "good"); }
          break;
        case "quitJob":
          if (p.job) { log(state, p, "Quit being a " + p.job.name + ". Freedom (temporarily).", ""); p.job = null; }
          break;
        case "unlock": p.flags[f.flag] = true; break;
        case "payRent": p.rentPaid = true; result.sfx.push("money"); break;
        case "rehouse":
          p.homeless = false; p.housing = "low"; p.rentPaid = true;
          log(state, p, "Back on their feet — rented a Low Cost room again.", "good");
          break;
        case "moveIn":
          p.housing = f.tier;
          log(state, p, f.tier === "lux" ? "Moved into Heelton Heights Luxury Apartments! 🏙️" : "Moved back to Low Cost Housing.", "");
          break;
        case "supportCheque":
          var amt = Math.round(0.30 * state.T);
          addStat(state, p, "money", amt);
          summary.push("+$" + amt + " support cheque"); result.sfx.push("money");
          break;
        case "sleepRough": break;
        case "invest": {
          var odds = ASSUME.invest[f.risk];
          var win = odds.win + (p.flags.tinyPrint ? ASSUME.tinyPrintBonus : 0);
          if (f.risk !== "low" && rand(state) > win) {
            var loss = Math.round(odds.lossPct * state.T);
            addStat(state, p, "money", -loss);
            // the listed money gain already applied above — claw it back on a bust
            var listed = a.gains.filter(function (g) { return g.stat === "money"; })[0];
            if (listed) addStat(state, p, "money", -Math.round(listed.pct * state.T));
            summary.push("📉 investment tanked (-$" + loss + ")");
            log(state, p, a.name + " went badly. -$" + loss, "bad");
          }
          break;
        }
        case "loan": {
          var due = state.turn + (DATA.settings.rentIntervalTurns - (state.turn % DATA.settings.rentIntervalTurns));
          p.debts.push({ pct: 0.2, dueTurn: due });
          summary.push("loan due turn " + due);
          break;
        }
        case "openShop": {
          var it = ITEMS[choice.item];
          if (!it) { result.ok = false; result.why = "Unknown item"; return; }
          var whyI = checkReq(state, p, it.req);
          if (p.items.indexOf(it.name) !== -1) whyI = "Already owned";
          var icost = Math.round(it.costPct * state.T);
          if (!whyI && money(p) < icost) whyI = "Not enough money ($" + icost + ")";
          if (whyI) { result.ok = false; result.why = whyI; return; }
          addStat(state, p, "money", -icost);
          p.items.push(it.name);
          summary.push("bought " + it.name + " (-$" + icost + ")");
          result.sfx.push("money");
          log(state, p, "Bought " + it.name + " for $" + icost, "");
          break;
        }
      }
    });
    if (!result.ok) { // refund a failed choice-action (job req failed etc.)
      p.tu += ann.tu; if (ann.cost) addStat(state, p, "money", ann.cost);
      return result;
    }

    // booster special-case: temporary modifier with a crash later
    if (a.id === "A045") p.booster = { turnsLeft: ASSUME.booster.turns };
    // Work actions use the player's actual job numbers (Jobs_Named is canonical)
    if (a.name === "Work" && p.job) { applyWork(state, p); result.sfx.push("money"); }
    if (a.category === "Food" || a.fx.some(function (f) { return f.kind === "eat"; })) {
      if (a.building === "regretBurger") result.sfx.push("eat");
    }
    if (ann.cost > 0 || summary.some(function (s) { return s.indexOf("$") !== -1; })) result.sfx.push("money");

    if (a.name !== "Work") log(state, p, a.name + (summary.length ? " (" + summary.join(", ") + ")" : ""), "");
    return result;
  }

  // ---------- Movement ----------
  function clubGate(state, p) {
    var need = Math.round((ASSUME.clubEntryCoolnessPct || 0) * state.T);
    if (p.stats.coolness >= need) return null;
    return "The bouncer looks you over… need Coolness " + need + "+ to get in";
  }
  function moveTo(state, toId) {
    var p = active(state);
    if (state.over) return { ok: false, why: "Game over" };
    if (!DATA.buildings[toId]) return { ok: false, why: "Unknown place" };
    if (toId === "club") {
      var whyC = clubGate(state, p);
      if (whyC) return { ok: false, why: whyC };
    }
    var mc = moveCost(state, p, toId);
    if (mc.tu > p.tu) return { ok: false, why: "Not enough Time Units to travel" };
    p.tu -= mc.tu;
    var from = p.location;
    p.location = toId;
    return { ok: true, tu: mc.tu, far: mc.far, from: from, transport: transportOf(p), path: mc.path };
  }

  // ---------- Turn / round flow ----------
  function startTurn(state) {
    var p = active(state);
    p.tu = DATA.settings.timeUnitsPerTurn;
    p.warnings = [];
    // debts collected at the start of the turn they're due
    p.debts = p.debts.filter(function (d) {
      if (state.turn >= d.dueTurn) {
        var amt = Math.round(d.pct * state.T);
        addStat(state, p, "money", -amt);
        log(state, p, "💸 Lifestyle Loan came due: -$" + amt, "bad");
        return false;
      }
      return true;
    });
    if (p.tuPenaltyNext > 0) {
      p.tu = Math.max(Math.floor(TU_SCALE), p.tu - p.tuPenaltyNext);
      p.warnings.push("Lost " + p.tuPenaltyNext + " Time Units (" + p.penaltyReason + ")");
      log(state, p, "Starts the turn with only " + p.tu + " TU (" + p.penaltyReason + ")", "bad");
      p.tuPenaltyNext = 0; p.penaltyReason = "";
    }
    if (isRentTurn(state) && !p.homeless) p.warnings.push("RENT IS DUE this turn!");
    if (p.homeless) p.warnings.push("You're homeless — recover at the Park / rent a room");
    if (p.pet && !p.pet.dead) {
      var band = petState(state, p);
      if (band !== "Healthy") p.warnings.push("Your pet is " + band + "!");
    }
  }

  function petState(state, p) {
    var f = p.pet.health / state.T, b = ASSUME.petStateBands;
    if (f >= b.hungry) return "Healthy";
    if (f >= b.sick) return "Hungry";
    if (f >= b.critical) return "Sick";
    if (p.pet.health > 0) return "Critical";
    return "Dead";
  }

  function endTurn(state) {
    var p = active(state), events = [];
    // 1) hunger
    if (!p.ate) {
      p.tuPenaltyNext += Math.floor(ASSUME.hungerTuPenalty * TU_SCALE);
      p.penaltyReason = "hunger";
      events.push(p.name + " didn't eat — will lose " + ASSUME.hungerTuPenalty + " TU next turn");
      log(state, p, "Didn't eat this turn! Hunger penalty next turn.", "bad");
    }
    p.ate = false;
    // 2) stress
    p.turnsSinceRelax += 1;
    if (p.turnsSinceRelax > 2) {
      p.tuPenaltyNext += Math.floor(ASSUME.stressTuPenalty * TU_SCALE);
      p.penaltyReason = (p.penaltyReason ? p.penaltyReason + " + " : "") + "stress";
      events.push(p.name + " is stressed out — will lose " + ASSUME.stressTuPenalty + " TU next turn");
      log(state, p, "Too stressed (no relaxing for " + p.turnsSinceRelax + " turns).", "bad");
    }
    // 3) pet upkeep
    if (p.pet && !p.pet.dead) {
      if (!p.pet.fedThisTurn) addStat(state, p, "petHealth", -Math.round(ASSUME.petHealthDecayPct * state.T));
      addStat(state, p, "petHappiness", -Math.round(ASSUME.petHappinessDecayPct * state.T));
      if (p.flags.petToy || p.items.indexOf("Pet Toys") !== -1)
        addStat(state, p, "petHappiness", Math.round(ASSUME.petToyPassivePct * state.T));
      p.pet.fedThisTurn = false;
      var band = petState(state, p);
      if (band === "Dead") {
        p.pet.dead = true; p.petDied = true;
        p.stats.happiness = 0;
        events.push("💀 " + p.name + "'s pet DIED. Happiness reset to 0.");
        log(state, p, "💀 Their pet died from neglect. Happiness drops to 0.", "bad");
      } else if (band !== "Healthy") {
        events.push(p.name + "'s pet is " + band);
      }
    }
    // 4) booster crash
    if (p.booster) {
      p.booster.turnsLeft -= 1;
      if (p.booster.turnsLeft <= 0) {
        p.booster = null;
        addStat(state, p, "health", -Math.round(ASSUME.booster.crashHealthPct * state.T));
        log(state, p, "The suspicious test booster wore off. That crash hurt.", "bad");
      }
    }
    // 5) rent resolution for THIS player on rent turns
    if (isRentTurn(state) && !p.homeless && !p.rentPaid) {
      p.homeless = true;
      addStat(state, p, "happiness", -Math.round(ASSUME.homelessHappinessHitPct * state.T));
      p.location = "park";
      events.push("🏚️ " + p.name + " couldn't pay rent and is now HOMELESS (living at the Park)");
      log(state, p, "🏚️ Evicted! Couldn't pay rent — now living at Almost Fine Park.", "bad");
    }
    // 6) endgame trigger
    var maxed = MAIN.every(function (s) { return p.stats[s] >= state.T; });
    if (maxed && !state.endAfterRound) {
      state.endAfterRound = true;
      events.push("🏁 " + p.name + " maxed all four main stats! Final round in progress.");
      log(state, p, "🏁 Maxed all main stats — the game ends after this round!", "good");
    }
    // advance
    state.activeIdx += 1;
    if (state.activeIdx >= state.players.length) {
      state.activeIdx = 0;
      state.turn += 1;
      if (state.endAfterRound) { state.over = true; }
      if (state.maxRounds > 0 && state.turn > state.maxRounds) {
        state.over = true;
        log(state, null, "Turn limit reached — final scoring!", "good");
      }
      if (!state.over && isRentTurn(state)) {
        state.players.forEach(function (q) { q.rentPaid = false; });
        log(state, null, "📯 Turn " + state.turn + ": RENT IS DUE for everyone!", "bad");
      }
    }
    if (state.over) {
      log(state, null, "🏆 Final standings: " + podium(state).map(function (e, i) {
        return (i + 1) + ". " + e.player.name + " (" + e.score + ")";
      }).join("  "), "good");
    } else {
      startTurn(state);
    }
    return events;
  }

  // ---------- Scoring ----------
  function score(state, p) {
    var mains = MAIN.reduce(function (s, k) { return s + p.stats[k]; }, 0);
    var upkeep = UPKEEP.reduce(function (s, k) { return s + p.stats[k]; }, 0) / UPKEEP.length;
    var pet = (p.pet && !p.pet.dead) ? (p.pet.health + p.pet.happiness) / 2 : 0;
    return Math.round(mains + upkeep + pet);
  }
  function podium(state) {
    return state.players.map(function (p) {
      return { player: p, score: score(state, p),
        breakdown: {
          connection: p.stats.connection, health: p.stats.health, career: p.stats.career,
          happiness: p.stats.happiness,
          upkeepAvg: Math.round(UPKEEP.reduce(function (s, k) { return s + p.stats[k]; }, 0) / UPKEEP.length),
          petAvg: (p.pet && !p.pet.dead) ? Math.round((p.pet.health + p.pet.happiness) / 2) : 0
        } };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  // ---------- Public API ----------
  var API = {
    DATA: DATA, ASSUME: ASSUME, ACTIONS: ACTIONS, ITEMS: ITEMS,
    TU_SCALE: TU_SCALE, tuCost: tuCost,
    newGame: newGame, active: active, actionsAt: actionsAt, perform: perform,
    moveTo: moveTo, moveCost: moveCost, endTurn: endTurn, startTurn: startTurn,
    score: score, podium: podium, isRentTurn: isRentTurn, petState: petState, clubGate: clubGate,
    jobsWithStatus: jobsWithStatus, bestPromotion: bestPromotion, statName: statName,
    personalityMult: personalityMult, totalMult: totalMult, transportOf: transportOf,
    shortestPath: shortestPath, PATHS: PATHS, NODE_POS: NODE_POS, log: log,
    serialize: function (state) { return JSON.stringify(state); },
    deserialize: function (json) { return JSON.parse(json); }
  };
  if (typeof window !== "undefined") window.PPEngine = API;
  if (typeof module !== "undefined") module.exports = API;
})();
