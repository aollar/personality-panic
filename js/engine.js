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
  // The synthetic rent / lease actions replace sheet rows A008 / A017, so their
  // prices follow those rows (v5: $100 low, $400 luxury). Moving in also pays a
  // deposit worth ASSUME.depositRentMultiple of that rent.
  (function syncRentCosts() {
    var sheetRent = {};
    DATA.actions.forEach(function (a) { sheetRent[a.id] = a.costPct; });
    var low = sheetRent.A008, lux = sheetRent.A017, dep = 1 + ASSUME.depositRentMultiple;
    if (low == null || lux == null) return;
    if (ACTIONS.X006) ACTIONS.X006.costPct = low;
    if (ACTIONS.X007) ACTIONS.X007.costPct = lux;
    if (ACTIONS.X004) ACTIONS.X004.costPct = low * dep;
    if (ACTIONS.X005) ACTIONS.X005.costPct = low * dep;
    if (ACTIONS.X003) ACTIONS.X003.costPct = lux * dep;
    if (ACTIONS.X009) ACTIONS.X009.costPct = lux * dep;
  })();
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
  // a building's walk node is its ENTRANCE (door on the pavement), not its center
  Object.keys(DATA.buildings).forEach(function (id) {
    var b = DATA.buildings[id];
    NODE_POS[id] = b.entrance || b.pos;
  });
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
  // connect each building's entrance to its authored door node(s) so routes
  // approach along the painted road; fall back to the 2 nearest road nodes.
  // Open zones (the park) may declare MULTIPLE entrance points along their
  // edges: each becomes a mini-node ("park#0"...) tied to its own roads, and
  // the building id is a zero-cost hub behind them — so pathfinding picks the
  // nearest edge and the walker STOPS there instead of crossing to a center.
  var MULTI = {};
  var ENTRANCE_OWNER = {};
  Object.keys(DATA.buildings).forEach(function (id) {
    var b = DATA.buildings[id];
    if (b.entrances && b.entrances.length) {
      MULTI[id] = true;
      b.entrances.forEach(function (pt, k) {
        var nm = id + "#" + k;
        ENTRANCE_OWNER[nm] = id;
        NODE_POS[nm] = pt; ADJ[nm] = [];
        ((b.entranceDoors || [])[k] || []).forEach(function (n) {
          var w = segLen(pt, NODE_POS[n]);
          ADJ[nm].push([n, w]); ADJ[n].push([nm, w]);
        });
        ADJ[id].push([nm, 0.01]); ADJ[nm].push([id, 0.01]);
      });
      return;
    }
    var doors = b.doors;
    if (doors && doors.length) {
      doors.forEach(function (n) {
        var w = segLen(NODE_POS[id], NODE_POS[n]);
        ADJ[id].push([n, w]); ADJ[n].push([id, w]);
      });
      return;
    }
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
      // Buildings are destinations, never roads. In particular, expanding the
      // park's zero-cost hub here would let a route enter one park edge and
      // leave another, drawing a straight shortcut across the lawn.
      if (DATA.buildings[u] && u !== fromId && u !== toId) continue;
      // A location entrance is also an endpoint, not a road junction. It may
      // only be expanded for a trip involving its owner (or when that exact
      // entrance is the route's source).
      var owner = ENTRANCE_OWNER[u];
      if (owner && u !== fromId && owner !== fromId && owner !== toId) continue;
      ADJ[u].forEach(function (vw) {
        if (dist[u] + vw[1] < dist[vw[0]]) { dist[vw[0]] = dist[u] + vw[1]; prev[vw[0]] = u; }
      });
    }
    var path = [], cur = toId;
    while (cur !== undefined) { path.unshift(cur); if (cur === fromId) break; cur = prev[cur]; }
    return { nodes: path, length: dist[toId] === Infinity ? segLen(NODE_POS[fromId], NODE_POS[toId]) : dist[toId] };
  }
  // Every ordinary building has a designated EXIT SPOT on the road (Austin:
  // entrance and exit are different places — you arrive at the red door dot,
  // but you leave FROM the blue road dot). b.exit names it; default = first
  // door. Open zones (park) return null and keep their edge-dot behavior.
  function exitNodeOf(id) {
    var b = DATA.buildings[id];
    if (!b || MULTI[id]) return null;
    if (b.exit && NODE_POS[b.exit]) return b.exit;
    return (b.doors && b.doors[0]) || null;
  }
  var PATHS = {}; // "from|to" -> {nodes,length}
  Object.keys(DATA.buildings).forEach(function (a) {
    // Open zones arrive through whichever entrance is closest, but depart from
    // their canonical entrance so travel cost and animation agree. Ordinary
    // buildings depart from their designated EXIT spot on the road, not the
    // doorway (exitNodeOf returns null for multi-entrance zones, so this never
    // fights the canonical-#0 rule above).
    var src = MULTI[a] ? a + "#0" : (exitNodeOf(a) || a);
    Object.keys(DATA.buildings).forEach(function (b) {
      if (a !== b) PATHS[a + "|" + b] = shortestPath(src, b);
    });
  });
  // multi-entrance zones: the hub node is bookkeeping, not a place — the walk
  // starts/ends at the actual edge point ("park#3"), so she stands where she
  // entered instead of marching to a single canonical spot
  Object.keys(PATHS).forEach(function (k) {
    var n = PATHS[k].nodes;
    if (n.length > 1 && MULTI[n[0]]) n.shift();
    if (n.length > 1 && MULTI[n[n.length - 1]]) n.pop();
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
    // CAR BROKE DOWN (E07): transport counts as Walking for the rest of the turn
    var costs = ASSUME.moveCost[p.forceWalk ? "walk" : transportOf(p)];
    var raw = costs[far ? 1 : 0];
    return { tu: raw === 0 ? 0 : Math.max(1, Math.floor(raw * TU_SCALE)), far: far, path: path };
  }

  // ---------- Two scalars (Balance Lock v4) ----------
  // T = stat cap / endgame threshold ONLY. B = the base every percentage in the
  // sheet resolves against: gains, penalties, prices, rent, pay, card effects.
  function economyBaseFor(T) {
    var L = DATA.settings.gameLengths, EB = DATA.settings.economyBase || {};
    for (var k in L) if (L[k] === T && EB[k]) return EB[k];
    return T;
  }
  function econ(state) { return state.B || economyBaseFor(state.T); }
  // +1e-9: 0.35 x 350 is 122.4999... in floating point; the sheet rounds it to 123
  function pctB(state, pct) { return Math.round(pct * econ(state) + 1e-9); }
  function modeOf(state) {
    var L = DATA.settings.gameLengths;
    for (var k in L) if (L[k] === state.T) return k;
    return "long";
  }

  // ---------- Player / game construction ----------
  function newPlayer(id, name, code, isBot) {
    var stats = {};
    ALL_STATS.forEach(function (s) { stats[s] = 0; });
    return {
      id: id, name: name, code: code, isBot: !!isBot,
      stats: stats, // money lives in stats.money (cash === Money stat; NOT capped at T — see addStat)
      location: "lowCost", housing: "low", homeless: false,
      tu: DATA.settings.timeUnitsPerTurn, tuPenaltyNext: 0,
      ate: false, turnsSinceRelax: 0, sleptThisTurn: false,
      foodSupply: 0, premiumSupply: false, autoAteStored: false, petFoodLeft: 0,
      items: [], pet: null, petDied: false, tombstones: [],
      job: null, jobStartedTurn: null, jobShifts: 0, workedThisTurn: false,
      workClicks: newWorkClicks(),           // v5 Job_Progression: permanent clicks per tier
      edu: { done: [], current: null },      // v5 Education_Paths: completed course ids + course in progress
      degrees: [],                           // display: names of completed education paths
      principal: {},                         // v4 Investments: $ held in each asset
      flags: {}, debts: [], booster: null,
      actionCounts: {}, careerGrants: 0, difficulty: null,   // v6: per-turn limits, career curve, CPU level
      rentPaid: false, warnings: [],
      // Weekend Update system (v3)
      holdings: [], rentMod: 1, forceWalk: false,
      turnFlags: {}, prevTurn: {}, weekend: [], pendingWeekend: []
    };
  }

  function newWorkClicks() {
    var c = {};
    DATA.jobProgression.order.forEach(function (t) { c[t] = 0; });
    return c;
  }
  function weekendModeOf(config) {
    if (config.weekendMode) return config.weekendMode;
    return config.weekendCards === false ? "off" : "full";
  }

  function newGame(config) {
    // config: {T, timerSeconds, maxRounds, players:[{name, code, isBot}], seed}
    var state = {
      T: config.T, B: config.B || economyBaseFor(config.T), timerSeconds: config.timerSeconds || 0,
      maxRounds: (config.maxRounds != null) ? config.maxRounds : ASSUME.maxRoundsDefault,
      seed: (config.seed != null) ? config.seed : Math.floor(Math.random() * 1e9),
      turn: 1, activeIdx: 0, over: false, endAfterRound: false,
      // Weekend Cards: full | essential (no life events) | off (debug: nothing
      // shown, but status penalties and investments still resolve to the log)
      weekendMode: weekendModeOf(config),
      cpuDifficulty: config.cpuDifficulty || "medium",   // v6: Easy / Medium / Hard
      botMultOff: !!config.botMultOff,                   // debug: switch the bot-only multiplier off
      players: config.players.map(function (pl, i) {
        var q = newPlayer(i, pl.name, pl.code, pl.isBot);
        if (pl.isBot) q.difficulty = pl.difficulty || config.cpuDifficulty || "medium";
        return q;
      }),
      log: [], _rngCalls: 0
    };
    state.players.forEach(function (p) {
      p.stats.money = pctB(state, ASSUME.startingMoneyPct);
      (ASSUME.startingItems || []).forEach(function (it) { p.items.push(it); });
    });
    log(state, null, "Game start — " + state.players.map(function (p) { return p.name + " (" + p.code + ")"; }).join(", ") +
      " · T=" + state.T + " · B=" + state.B);
    startTurn(state);
    return state;
  }

  function log(state, p, text, cls) {
    state.log.push({ turn: state.turn, who: p ? p.name : "", text: text, cls: cls || "" });
    if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  }

  function active(state) { return state.players[state.activeIdx]; }
  // v6 Pay Rent display states
  function rentStatus(state, p) {
    if (p.homeless) return { state: "homeless", text: "You're homeless — re-house first" };
    var bill = ACTIONS[p.housing === "lux" ? "X007" : "X006"];
    var cost = Math.round(bill.costPct * econ(state) * (p.rentMod || 1));
    if (p.rentPaid) return { state: "paid", cost: cost, text: "PAID · next due turn " + nextRentTurn(state) };
    if (money(p) < cost) return { state: "short", cost: cost, text: "Need $" + (cost - money(p)) + " more" };
    if (isRentTurn(state)) return { state: "due", cost: cost, text: "RENT DUE — $" + cost };
    return { state: "early", cost: cost, text: "Due turn " + nextRentTurn(state) + " · pay early for $" + cost };
  }
  function nextRentTurn(state) {
    var every = DATA.settings.rentIntervalTurns;
    return (Math.floor(state.turn / every) + 1) * every;
  }
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
    // items now grant flat stat points at purchase (see openShop fx below) —
    // visible and readable — instead of an invisible passive gain multiplier.
    return 1;
  }
  function totalMult(state, p, stat) {
    var m = personalityMult(p, stat) * itemMult(p, stat);
    if (p.booster && (stat === "health" || stat === "coolness")) m *= (1 + ASSUME.booster.gainBonus);
    var cap = DATA.settings.modifiers[stat].cap;
    if (stat === "money") cap = DATA.settings.incomeMultiplierCap;
    return Math.min(m, cap);
  }
  // v6 Career patch: within one turn the 1st Career-granting action pays full,
  // the 2nd half, the 3rd a quarter, the 4th and later a tenth (min 1 point).
  function careerShare(state, p) {
    var curve = DATA.settings.careerDiminishing || [1];
    var i = p.careerGrants || 0;
    return curve[Math.min(i, curve.length - 1)];
  }
  // v6 CPU difficulty: a clearly-labelled BOT-ONLY multiplier on action gains.
  function botGainMult(state, p) {
    if (!p.isBot || state.botMultOff) return 1;
    var d = DATA.cpuDifficulty[p.difficulty || state.cpuDifficulty || "medium"];
    return d ? d.gainMult : 1;
  }
  function gainStat(state, p, stat, pct, flat) {
    var base = (flat != null) ? flat : pct * econ(state);
    var isPet = stat === "petHappiness" || stat === "petHealth";
    var pts = Math.round(isPet ? base : base * totalMult(state, p, stat) * botGainMult(state, p));
    if (stat === "career" && pts > 0) {
      pts = Math.max(1, Math.floor(pts * careerShare(state, p)));
      p.careerGrants = (p.careerGrants || 0) + 1;
    }
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
    // Money is cash, not a 0..T percentage stat — let it accumulate past T so
    // players can save up (e.g. $200 rent, luxury items). Still floors at 0.
    if (stat === "money") p.stats[stat] = Math.max(0, o + pts);
    else p.stats[stat] = Math.max(0, Math.min(state.T, o + pts));
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
        case "rentPayable":
          // v6: Pay Rent is ALWAYS listed. It is only unusable once this cycle is settled.
          if (p.rentPaid) return "Paid — next due turn " + nextRentTurn(state); break;
        case "foodSupply": if (!Number.isFinite(p.foodSupply) || p.foodSupply < 1) return "No groceries at home"; break;
        case "notAte": if (p.ate) return "Already ate this turn"; break;
        case "ownsItem": if (p.items.indexOf(r.item) === -1) return "Need " + r.item; break;
        case "ownsAnyOf":
          if (!ownsAnyOf(p, r.items)) return "Need " + (r.label || r.items.join(" or ")) + " from the Mall"; break;
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
        case "myCamp": if (!p.flags.myCamp) return "Buy My Camp first"; break;
        case "notFlag": if (p.flags[r.flag]) return r.msg || "Already done"; break;
        case "noLoan":
          if (p.debts && p.debts.length) return "Finish repaying your current loan first"; break;
        // --- Weekend Update card requirements ---
        case "ownsAnyTech":
          if (!ownsAnyOf(p, ASSUME.weekend.techItems)) return "Need a tech item"; break;
        case "ownsAnyTechOrAppliance":
          if (!ownsAnyOf(p, ASSUME.weekend.techItems.concat(ASSUME.weekend.applianceItems)))
            return "Need tech or an appliance"; break;
        case "ownsAnyFurnOrTech":
          if (!ownsAnyOf(p, ASSUME.weekend.techItems) &&
              !p.items.some(function (n) { return ITEMS[n] && ITEMS[n].group === "Furniture"; }))
            return "Need furniture or tech"; break;
        case "prevAteRegret": if (!p.prevTurn.ateRegret) return "Didn't eat there last turn"; break;
        case "prevGym": if (!p.prevTurn.gym) return "Didn't hit the gym last turn"; break;
        case "hasHolding":
          if (!p.holdings.length) return "You don't hold any investments"; break;
      }
    }
    return null;
  }
  function ownsAnyOf(p, names) {
    return names.some(function (n) { return p.items.indexOf(n) !== -1; });
  }
  function statName(s) {
    return { connection: "Connection", health: "Health", career: "Career", happiness: "Happiness",
      coolness: "Coolness", critical: "Critical Thinking", enlightenment: "Enlightenment",
      money: "Money", petHappiness: "Pet Happiness", petHealth: "Pet Health" }[s] || s;
  }

  // ---------- Jobs ----------
  // ---------- Education (v5 Education_Paths) ----------
  var COURSES = [], COURSE = {}, PATH = {};
  DATA.education.forEach(function (path) {
    PATH[path.path] = path;
    path.courses.forEach(function (c) { COURSES.push(c); COURSE[c.id] = c; });
  });
  function ensureProgress(p) {
    if (!p.edu || !Array.isArray(p.edu.done)) p.edu = { done: [], current: null };
    if (!p.workClicks) p.workClicks = newWorkClicks();
    if (!p.principal) p.principal = {};
    // saves store a COPY of the job row: rebind it so resumed games get current pay/tier data
    if (p.job) {
      var fresh = DATA.jobs.filter(function (j) { return j.name === p.job.name && j.building === p.job.building; })[0];
      if (fresh) p.job = fresh;
    }
    p.degrees = DATA.education.filter(function (path) { return pathComplete(p, path.path); })
      .map(function (path) { return path.name; });
  }
  function courseDone(p, id) { return !!(p.edu && p.edu.done.indexOf(id) !== -1); }
  function pathComplete(p, n) {
    if (!n) return true;
    return PATH[n].courses.every(function (c) { return courseDone(p, c.id); });
  }
  // Paths and courses unlock strictly in order, so exactly one course is ever
  // available: the first incomplete one in catalogue order.
  function nextCourse(p) {
    for (var i = 0; i < COURSES.length; i++) if (!courseDone(p, COURSES[i].id)) return COURSES[i];
    return null;
  }
  function courseProgress(p, c) {
    var cur = p.edu && p.edu.current;
    return (cur && cur.id === c.id) ? cur : { id: c.id, clicks: 0, paid: false };
  }
  function courseCostDue(state, p, c) {
    return courseProgress(p, c).paid ? 0 : pctB(state, c.costPct);
  }
  function courseCatalog(state, p) {
    var next = nextCourse(p);
    return DATA.education.map(function (path) {
      return { path: path.path, name: path.name, unlocksTier: path.unlocksTier,
        complete: pathComplete(p, path.path),
        courses: path.courses.map(function (c) {
          var status = courseDone(p, c.id) ? "done" : (next && next.id === c.id ? "next" : "locked");
          return { course: c, status: status, clicks: courseProgress(p, c).clicks,
                   cost: pctB(state, c.costPct), costDue: courseCostDue(state, p, c) };
        }) };
    });
  }

  // ---------- Job tiers (v5 Job_Progression) ----------
  // A tier unlocks when BOTH its education path is complete AND one of its
  // work-click routes is met. Clicks count against the tier of the job worked.
  function clickScale(state) {
    var sc = ASSUME.jobClickScale || {};
    return sc[modeOf(state)] != null ? sc[modeOf(state)] : 1;
  }
  function tierGate(state, p, tier) {
    var t = DATA.jobProgression.tiers[tier];
    if (!t) return { ok: true, why: null };
    var clicks = p.workClicks || {}, scale = clickScale(state);
    var pathOk = pathComplete(p, t.path);
    var routes = t.routes.map(function (r) {
      var need = Math.max(1, Math.round(r.clicks * scale));
      return { tier: r.tier, need: need, have: clicks[r.tier] || 0, ok: (clicks[r.tier] || 0) >= need };
    });
    var clicksOk = !routes.length || routes.some(function (r) { return r.ok; });
    var why = null;
    if (!pathOk || !clicksOk) {
      var bits = [];
      if (!pathOk) bits.push("finish Path " + t.path + " (" + PATH[t.path].name + ")");
      if (!clicksOk) bits.push(routes.map(function (r) {
        return r.need + " " + r.tier + " work clicks (" + r.have + "/" + r.need + ")";
      }).join(" or "));
      why = tier + " jobs: " + bits.join(" + ");
    }
    return { ok: pathOk && clicksOk, pathOk: pathOk, clicksOk: clicksOk, routes: routes, path: t.path, why: why };
  }
  function jobReqMet(state, p, job) {
    var q = job.req;
    if (q.clothes && p.items.indexOf(q.clothes) === -1) return "Need " + q.clothes;
    if (q.computer && p.items.indexOf("Computer") === -1) return "Need a Computer";
    for (var i = 0; i < q.stats.length; i++) {
      var s = q.stats[i];
      if ((p.stats[s.stat] || 0) < s.pctT * state.T)
        return "Need " + statName(s.stat) + " " + Math.round(s.pctT * state.T) + "+";
    }
    return null;
  }
  // No promotions and no loyalty requirement (v5): any job whose tier gate and
  // own requirements are met can be taken at any time.
  function jobApplicationWhy(state, p, job) {
    if (p.job && p.job.name === job.name && p.job.building === job.building) return "Current job";
    var gate = tierGate(state, p, job.progressTier || job.tier);
    if (!gate.ok) return gate.why;
    // a job you can't physically reach gets you fired: the club's bouncer
    // enforces its dress code on staff too
    if (job.building === "club") { var dress = clubGate(state, p); if (dress) return dress; }
    return jobReqMet(state, p, job);
  }
  function jobsWithStatus(state, p) {
    return DATA.jobs.map(function (j) {
      return { job: j, why: jobApplicationWhy(state, p, j), current: p.job && p.job.name === j.name && p.job.building === j.building };
    });
  }
  // v6: wages rise with distance from the Corporate Soul Exchange; working from
  // home pays 0.85 because it costs no travel. Money only — never Career.
  function payMultiplier(state, p, actionId) {
    if (actionId === "A015") return DATA.settings.workFromHomePay || 0.85;
    var where = (DATA.buildingPay || {})[p.location];
    return where != null ? where : 1;
  }
  function applyWork(state, p, actionId) {
    var j = p.job, scale = econ(state) / 100;
    var mult = payMultiplier(state, p, actionId);
    var pay = gainStat(state, p, "money", null, j.basePayT100 * scale * mult);
    var car = gainStat(state, p, "career", null, j.careerGainT100 * scale);
    var bits = ["+$" + pay + (mult !== 1 ? " (x" + mult + ")" : ""), "+" + car + " Career"];
    j.effects.forEach(function (e) {
      var d = addStat(state, p, e.stat, Math.round(e.amtT100 * scale));
      if (d) bits.push((d > 0 ? "+" : "") + d + " " + statName(e.stat));
    });
    p.workedThisTurn = true;
    p.jobShifts = (p.jobShifts || 0) + 1;
    if (!p.workClicks) p.workClicks = newWorkClicks();
    var ct = j.progressTier || j.tier;
    p.workClicks[ct] = (p.workClicks[ct] || 0) + 1;
    bits.push(ct + " click " + p.workClicks[ct]);
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
      if (!p.homeless && ((id === "X006" && p.housing === "low") || (id === "X007" && p.housing === "lux")))
        list.push(annotate(state, p, a));
    });
    return list;
  }
  function annotate(state, p, a) {
    var cost = pctB(state, a.costPct);
    // rent-modifier events (E25/E26) scale the PURE rent bills only — the
    // move-in/rehouse bundles include deposits, which landlords can't inflate
    if ((a.id === "X006" || a.id === "X007") && p.rentMod !== 1)
      cost = Math.round(a.costPct * econ(state) * p.rentMod);
    var tu = tuCost(a);
    var why = checkReq(state, p, a.req, a);
    var course = null;
    if (a.fx.some(function (f) { return f.kind === "attendCourse"; })) {
      course = nextCourse(p);
      if (!why && !course) why = "All 30 courses completed";
      if (course) cost = courseCostDue(state, p, course);   // fee charged on the first click only
    }
    // Debtstreet portfolio buys: one holding per asset type (Investments sheet)
    var buy = a.fx.filter(function (f) { return f.kind === "buyAsset"; })[0];
    if (!why && buy && p.holdings.indexOf(buy.asset) !== -1) why = "Already holding " + buy.asset + " (max 1)";
    // v6 per-turn limits (home exercise 2, resume/team building 1)
    if (!why && a.perTurn) {
      var used = (p.actionCounts || {})[a.id] || 0;
      if (used >= a.perTurn) why = "Only " + a.perTurn + " per turn (used " + used + ")";
    }
    if (!why && p.tu < tu) why = "Not enough Time Units";
    if (!why && money(p) < cost) why = "Not enough money ($" + cost + ")";
    return { action: a, id: a.id, name: a.name, tu: tu, cost: cost, ok: !why, why: why, course: course };
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
    // Attend Course: the catalog dialog picks the course (only the next one is
    // ever selectable); bots and repeat clicks study whatever is next.
    if (ann.course) {
      if (!choice) {
        if (!p.isBot) return { ok: true, needsChoice: "course" };
        choice = { course: ann.course.id };
      }
      if (choice.course !== ann.course.id && choice.course !== ann.course.name) {
        var picked = COURSE[choice.course];
        if (picked && courseDone(p, picked.id)) return { ok: false, why: picked.name + " is already completed" };
        return { ok: false, why: "Complete " + ann.course.name + " next" };
      }
    }
    // Cash Out: pick which holding to sell (auto when only one)
    var needsSell = a.fx.some(function (f) { return f.kind === "cashOut"; });
    if (needsSell && !choice) {
      if (p.holdings.length === 1 || p.isBot) choice = { asset: p.holdings.indexOf("crypto") !== -1 ? "crypto" : p.holdings[0] };
      else return { ok: true, needsChoice: "sell", assets: p.holdings.slice() };
    }
    var buyFx = a.fx.filter(function (f) { return f.kind === "buyAsset"; })[0];
    var buysAsset = buyFx ? buyFx.asset : null;

    // pay the bill
    if (!p.actionCounts) p.actionCounts = {};
    p.actionCounts[a.id] = (p.actionCounts[a.id] || 0) + 1;
    p.tu -= ann.tu;
    if (ann.cost) { addStat(state, p, "money", -ann.cost); }

    var summary = [];
    if (ann.cost) summary.push("-$" + ann.cost);

    // Generic "Work" rows are placeholders — the player's actual job from
    // Jobs_Named (canonical) supplies pay/career/effects instead.
    var isGenericWork = (a.name === "Work");

    // stat gains (with modifiers)
    if (!isGenericWork && !buysAsset) a.gains.forEach(function (g) {
      var d = gainStat(state, p, g.stat, g.pct);
      if (d) summary.push("+" + d + " " + statName(g.stat));
    });
    (a.petGains || []).forEach(function (g) {
      var d = gainStat(state, p, g.stat, g.pct);
      if (d) summary.push("+" + d + " " + statName(g.stat));
    });
    if (!isGenericWork) a.penalties.forEach(function (g) {
      var d = addStat(state, p, g.stat, -pctB(state, g.pct));
      if (d) summary.push(d + " " + statName(g.stat));
    });

    // v6 flat point adjustments (Chest Day +1 Happiness / -1 Enlightenment, etc.)
    (a.flat || []).forEach(function (f) {
      var d = addStat(state, p, f.stat, f.pts);
      if (d) summary.push((d > 0 ? "+" : "") + d + " " + statName(f.stat));
    });

    var result = { ok: true, sfx: [], summary: summary };

    // structured effects
    a.fx.forEach(function (f) {
      switch (f.kind) {
        case "eat": p.ate = true; result.sfx.push("eat"); break;
        case "consumeSupply":
          if (!Number.isFinite(p.foodSupply)) p.foodSupply = 0;
          if (typeof p.premiumSupply !== "boolean") p.premiumSupply = false;
          p.foodSupply = Math.max(0, p.foodSupply - 1);
          if (p.premiumSupply) { var d = gainStat(state, p, "health", 0.02); if (d) summary.push("+" + d + " Health"); }
          if (p.foodSupply <= 0) { p.foodSupply = 0; p.premiumSupply = false; }
          break;
        case "relax": p.turnsSinceRelax = 0; break;
        case "foodSupply":
          // The purchase supplies and consumes this week's meal immediately;
          // remaining weeks auto-feed at the start of later player turns.
          if (!Number.isFinite(p.foodSupply)) p.foodSupply = 0;
          if (typeof p.premiumSupply !== "boolean") p.premiumSupply = false;
          p.foodSupply += Math.max(0, f.weeks - 1);
          if (f.premium && f.weeks > 1) p.premiumSupply = true;
          p.ate = true;
          summary.push(f.weeks > 1 ? "this turn fed; " + p.foodSupply + " stored week" + (p.foodSupply === 1 ? "" : "s") : "this turn fed");
          break;
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
                    happiness: Math.round(ASSUME.petStartPct * state.T), fedThisTurn: true, dead: false, missed: 0 };
          log(state, p, "Adopted the " + DATA.personalities[choice.pet].name + " pet!", "good");
          break;
        case "attendCourse": {
          ensureProgress(p);
          var crs = ann.course, prog = courseProgress(p, crs);
          prog.paid = true;               // ann.cost already charged the fee if it was due
          prog.clicks += 1;
          p.edu.current = prog;
          summary.push("📚 " + crs.name + " " + Math.min(prog.clicks, crs.clicks) + "/" + crs.clicks);
          if (prog.clicks >= crs.clicks) {
            p.edu.current = null;
            p.edu.done.push(crs.id);
            crs.gains.forEach(function (g) {
              var cd = gainStat(state, p, g.stat, g.pct);
              if (cd) summary.push("+" + cd + " " + statName(g.stat));
            });
            summary.push("✓ completed");
            if (pathComplete(p, crs.path)) {
              ensureProgress(p);
              log(state, p, "🎓 Completed Path " + crs.path + ": " + PATH[crs.path].name + "! " +
                PATH[crs.path].unlocksTier + " jobs now need only their work clicks.", "good");
            }
          }
          break;
        }
        case "openJobDialog":
          var jb = DATA.jobs.filter(function (j) { return j.name === choice.job && j.building === choice.building; })[0];
          if (!jb) return;
          var whyJ = jobApplicationWhy(state, p, jb);
          if (whyJ) { result.ok = false; result.why = whyJ; return; }
          p.job = jb;
          p.jobStartedTurn = state.turn;
          p.jobShifts = 0;
          p.workedThisTurn = false;
          log(state, p, "Took the job: " + jb.name + " at " + DATA.buildings[jb.building].name, "good");
          break;
        case "quitJob":
          if (p.job) {
            log(state, p, "Quit being a " + p.job.name + ". Freedom (temporarily).", "");
            p.job = null; p.jobStartedTurn = null; p.jobShifts = 0; p.workedThisTurn = false;
          }
          break;
        case "unlock":
          p.flags[f.flag] = true;
          // My Camp is once-per-game (req notFlag) — make the single purchase
          // land hard: bonus stats on top of the sheet's gain (assumptions)
          if (f.flag === "myCamp" && ASSUME.myCampBoost) {
            Object.keys(ASSUME.myCampBoost).forEach(function (s) {
              var d = gainStat(state, p, s, ASSUME.myCampBoost[s]);
              if (d) summary.push("+" + d + " " + statName(s));
            });
          }
          break;
        case "payRent":
          p.rentPaid = true; p.rentMod = 1;
          // v6: paying early covers the next cycle, so the rent-turn reset skips it
          p.rentPaidThrough = isRentTurn(state) ? state.turn : nextRentTurn(state);
          summary.push(isRentTurn(state) ? "rent settled" : "pre-paid through turn " + p.rentPaidThrough);
          result.sfx.push("money");
          break;
        case "rehouse":
          p.homeless = false; p.housing = "low"; p.rentPaid = true;
          log(state, p, "Back on their feet — rented a Low Cost room again.", "good");
          break;
        case "moveIn":
          p.housing = f.tier;
          p.homeless = false;
          p.location = f.tier === "lux" ? "luxury" : "lowCost";
          log(state, p, f.tier === "lux" ? "Moved into Heelton Heights Luxury Apartments! 🏙️" : "Moved back to Low Cost Housing.", "");
          break;
        case "supportCheque":
          var amt = pctB(state, f.pct);
          addStat(state, p, "money", amt);
          summary.push("+$" + amt + " support cheque"); result.sfx.push("money");
          break;
        case "sleepRough": break;
        case "cashOut": {
          var sold = choice.asset;
          var idx = p.holdings.indexOf(sold);
          if (idx === -1) { result.ok = false; result.why = "Not holding " + sold; return; }
          p.holdings.splice(idx, 1);
          var refund = principalOf(state, p, sold);
          if (p.principal) delete p.principal[sold];
          addStat(state, p, "money", refund);
          summary.push("cashed out " + sold + " (+$" + refund + ")");
          log(state, p, "💰 Cashed out their " + sold + " for the full $" + refund + " principal.", "");
          result.sfx.push("money");
          break;
        }
        case "informed":
          if (p.flags.informed) summary.push("already INFORMED");
          else { p.flags.informed = true; summary.push("INFORMED: next big investment loss is downgraded"); }
          break;
        case "loan": {
          // +15%B now (row gain), then f.pct of B at the start of each of the next N turns
          for (var k = 1; k <= f.payments; k++) p.debts.push({ pct: f.pct, dueTurn: state.turn + k, loan: true });
          summary.push("repay $" + pctB(state, f.pct) + " at the start of each of your next " + f.payments + " turns");
          break;
        }
        case "openShop": {
          var it = ITEMS[choice.item];
          if (!it) { result.ok = false; result.why = "Unknown item"; return; }
          var whyI = checkReq(state, p, it.req);
          if (p.items.indexOf(it.name) !== -1) whyI = "Already owned";
          var icost = pctB(state, it.costPct);
          if (!whyI && money(p) < icost) whyI = "Not enough money ($" + icost + ")";
          if (whyI) { result.ok = false; result.why = whyI; return; }
          addStat(state, p, "money", -icost);
          p.items.push(it.name);
          summary.push("bought " + it.name + " (-$" + icost + ")");
          // numeric stat grant: the sheet's bonus % of B lands ONCE as points
          if (it.bonus) {
            var bd = addStat(state, p, it.bonus.stat, pctB(state, it.bonus.pct));
            if (bd) summary.push("+" + bd + " " + statName(it.bonus.stat));
          }
          // v5 one-time purchase bonuses (Fridge, Vacuum) are fixed points
          if (it.trigger && it.trigger.on === "purchase") {
            var td = addStat(state, p, it.trigger.stat, fixturePts(state, it.trigger.pts));
            if (td) summary.push("+" + td + " " + statName(it.trigger.stat));
          }
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
    // Investments: the buy moves the principal into a held asset that draws
    // one outcome card per turn until cashed out (or rug-pulled)
    if (buysAsset) {
      p.holdings.push(buysAsset);
      if (!p.principal) p.principal = {};
      p.principal[buysAsset] = ann.cost;
      summary.push("now holding " + buysAsset);
      log(state, p, "📈 Opened a " + buysAsset + " holding ($" + ann.cost + " principal) — resolves every weekend.", "");
      result.sfx.push("money");
    }
    // v5 home fixtures: flat bonuses when their trigger action happens at home
    fireHomeFixtures(state, p, a, summary);
    // last-weekend memory for event cards (E21 food poisoning, E22 gym gains)
    if (a.building === "regretBurger" && a.fx.some(function (f) { return f.kind === "eat"; }))
      p.turnFlags.ateRegret = true;
    if (p.location === "gym") p.turnFlags.gym = true;
    // Work actions use the player's actual job numbers (Jobs_Named is canonical).
    // v6: Work From Home is a real work click too, paid at 0.85.
    if (a.fx.some(function (f) { return f.kind === "workClick"; }) && p.job) {
      applyWork(state, p, a.id);
      result.sfx.push("money");
    }
    if (a.category === "Food" || a.fx.some(function (f) { return f.kind === "eat"; })) {
      if (a.building === "regretBurger") result.sfx.push("eat");
    }
    if (ann.cost > 0 || a.gains.some(function (g) { return g.stat === "money"; }) ||
        a.penalties.some(function (g) { return g.stat === "money"; }) ||
        summary.some(function (s) { return s.indexOf("$") !== -1; })) result.sfx.push("money");

    if (a.name !== "Work") log(state, p, a.name + (summary.length ? " (" + summary.join(", ") + ")" : ""), "");
    return result;
  }

  function principalOf(state, p, asset) {
    if (p.principal && p.principal[asset] != null) return p.principal[asset];
    var id = Object.keys(ACTIONS).filter(function (k) {
      return ACTIONS[k].fx.some(function (f) { return f.kind === "buyAsset" && f.asset === asset; });
    })[0];
    return id ? pctB(state, ACTIONS[id].costPct) : 0;
  }
  function fixturePts(state, pts) {
    return ASSUME.fixtureBonusScalesWithB ? Math.max(1, Math.round(pts * econ(state) / 100)) : pts;
  }
  // Items a player can USE right now: Luxury-only items sit in storage (no
  // bonus) while the owner lives in Low Cost Housing or is homeless.
  function itemActive(p, name) {
    var it = ITEMS[name];
    if (!it || p.items.indexOf(name) === -1) return false;
    if (it.housing === "lux") return !p.homeless && p.housing === "lux";
    if (it.housing === "home") return !p.homeless;
    return true;
  }
  function homeTriggerOf(p, a) {
    if (p.homeless || p.location !== homeOf(p)) return null;
    var T = ASSUME.homeTriggers || {};
    for (var k in T) if (T[k].indexOf(a.id) !== -1) return k;
    return null;
  }
  function fireHomeFixtures(state, p, a, summary) {
    var kind = homeTriggerOf(p, a);
    if (!kind) return;
    var fixtures = p.items.filter(function (n) {
      var it = ITEMS[n];
      return it && it.trigger && it.trigger.on === kind && itemActive(p, n);
    }).map(function (n) { return ITEMS[n]; });
    // home fixtures all stack (exempt from best-per-slot) — except beds: best one only
    var beds = fixtures.filter(function (it) { return it.slot === "Bed"; })
      .sort(function (x, y) { return y.trigger.pts - x.trigger.pts; });
    fixtures = fixtures.filter(function (it) { return it.slot !== "Bed"; }).concat(beds.slice(0, 1));
    fixtures.forEach(function (it) {
      var d = addStat(state, p, it.trigger.stat, fixturePts(state, it.trigger.pts));
      if (d) summary.push("+" + d + " " + statName(it.trigger.stat) + " (" + it.name + ")");
    });
  }

  // ---------- Movement ----------
  function clubGate(state, p) {
    var missing = (ASSUME.clubEntryItems || []).filter(function (n) {
      return p.items.indexOf(n) === -1;
    });
    if (!missing.length) return null;
    return "Dress code! The bouncer wants: " + missing.join(" + ");
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
  function homeOf(p) {
    if (p.homeless) return "park";
    return p.housing === "lux" ? "luxury" : "lowCost";
  }
  // ---------- Weekend Update cards (v3 §12) ----------
  var WCARDS = {};
  (DATA.weekend.cards || []).forEach(function (c) { WCARDS[c.id] = c; });

  // Standing from the live provisional score; ties break by Money, then turn order.
  function weekendStanding(state, p) {
    var ranked = state.players.slice().sort(function (a, b) {
      var d = score(state, b) - score(state, a);
      if (d) return d;
      if (b.stats.money !== a.stats.money) return b.stats.money - a.stats.money;
      return a.id - b.id;
    });
    var i = ranked.indexOf(p);
    if (i === 0) return "first";
    if (i === ranked.length - 1) return "last";
    return "mid";
  }

  function cardFace(id, extra) {
    var c = WCARDS[id] || { id: id, name: id, type: "event" };
    var face = { id: c.id, name: c.name, type: c.type, polarity: c.polarity,
                 effectText: c.effectText || "", flavor: c.flavor || "" };
    for (var k in (extra || {})) face[k] = extra[k];
    return face;
  }

  // One weighted pick from {key: weight}; deterministic via the shared stream.
  function weightedPick(state, table) {
    var keys = Object.keys(table), total = 0;
    keys.forEach(function (k) { total += table[k]; });
    var r = rand(state) * total, acc = 0;
    for (var i = 0; i < keys.length; i++) { acc += table[keys[i]]; if (r <= acc) return keys[i]; }
    return keys[keys.length - 1];
  }

  function resolveInvestments(state, p) {
    var out = [];
    p.holdings.slice().forEach(function (asset) {
      var odds = DATA.weekend.investOdds[asset], fx = DATA.weekend.investFx[asset];
      var pick, delta, cardId, extra = { asset: asset };
      if (odds === "safe") {
        cardId = fx.pay[0]; delta = pctB(state, fx.pay[1]);
      } else {
        var o = odds[weekendStanding(state, p)];   // [bigGain, smallGain, smallLoss, bigLoss, flat]
        var table = { bigGain: o[0], smallGain: o[1], smallLoss: o[2], bigLoss: o[3] };
        if (o[4] > 0 && fx.flat) table.flat = o[4];
        pick = weightedPick(state, table);
        // INFORMED (Read Tiny Print): the next Big Loss becomes a Small Loss
        if (pick === "bigLoss" && p.flags.informed) {
          pick = "smallLoss"; p.flags.informed = false; extra.informed = true;
          log(state, p, "🔍 INFORMED — you read the tiny print, so the " + asset + " big loss was downgraded.", "good");
        }
        cardId = fx[pick][0]; delta = pctB(state, fx[pick][1]);
        if (fx[pick][2] === "destroy") {           // crypto RUG PULL: the holding and its principal are gone
          var lost = principalOf(state, p, asset);
          p.holdings.splice(p.holdings.indexOf(asset), 1);
          if (p.principal) delete p.principal[asset];
          extra.destroyed = true; extra.detail = "holding destroyed · $" + lost + " principal lost";
        }
      }
      addStat(state, p, "money", delta);
      extra.delta = delta;
      out.push(cardFace(cardId, extra));
      log(state, p, (delta > 0 ? "📈 " : delta < 0 || extra.destroyed ? "📉 " : "➖ ") + WCARDS[cardId].name + " — " + asset +
        (extra.destroyed ? " holding destroyed" : delta ? (delta > 0 ? " +$" : " -$") + Math.abs(delta) : " no change"),
        delta > 0 ? "good" : (delta < 0 || extra.destroyed) ? "bad" : "");
    });
    return out;
  }

  function cardEligible(state, p, c) {
    return !checkReq(state, p, c.req || []);
  }
  function drawEventCard(state, p) {
    var standing = weekendStanding(state, p);
    var weights = DATA.weekend.weights[standing];
    var events = DATA.weekend.cards.filter(function (c) { return c.type === "event"; });
    var cls = weightedPick(state, weights);
    var pool = events.filter(function (c) { return c.cls === cls && cardEligible(state, p, c); });
    if (!pool.length) {   // redraw rule: degrade to same polarity, then anything eligible
      var pos = cls === "majPos" || cls === "minPos";
      pool = events.filter(function (c) {
        return (c.polarity === (pos ? "positive" : "negative")) && cardEligible(state, p, c);
      });
    }
    if (!pool.length) pool = events.filter(function (c) { return cardEligible(state, p, c); });
    if (!pool.length) return null;
    var c = pool[Math.floor(rand(state) * pool.length)];
    // apply: stat deltas land flat (no personality multipliers — windfalls read exactly as printed)
    var bits = [];
    c.stats.forEach(function (s) {
      var d = addStat(state, p, s.stat, pctB(state, s.pct));
      if (d) bits.push((d > 0 ? "+" : "") + d + " " + statName(s.stat));
    });
    (c.fx || []).forEach(function (f) {
      switch (f.kind) {
        case "rentMod":
          p.rentMod = f.mult;
          bits.push(f.mult > 1 ? "next rent +" + Math.round((f.mult - 1) * 100) + "%"
                               : "next rent -" + Math.round((1 - f.mult) * 100) + "%");
          break;
        case "forceWalk": p.forceWalk = true; bits.push("walking this turn"); break;
        case "clearFood":
          if (p.foodSupply > 0) bits.push(p.foodSupply + " wk of groceries spoiled");
          p.foodSupply = 0; p.premiumSupply = false; break;
      }
    });
    log(state, p, "🗞️ " + c.name + (bits.length ? " (" + bits.join(", ") + ")" : ""),
      c.polarity === "positive" ? "good" : "bad");
    return cardFace(c.id, { deck: standing, detail: bits.join(" · ") });
  }

  function startTurn(state) {
    var p = active(state);
    // Save compatibility: an existing job receives one grace week after load.
    if (p.workedThisTurn == null) p.workedThisTurn = false;
    if (p.job && p.jobStartedTurn == null) p.jobStartedTurn = state.turn;
    if (p.jobShifts == null) p.jobShifts = 0;
    ensureProgress(p);
    if (state.weekendMode == null) state.weekendMode = state.weekendOff ? "off" : "full";
    if (!Number.isFinite(p.foodSupply)) p.foodSupply = 0;
    if (typeof p.premiumSupply !== "boolean") p.premiumSupply = false;
    p.autoAteStored = false;
    p.actionCounts = {}; p.careerGrants = 0;   // v6: per-turn limits + career curve
    p.tu = DATA.settings.timeUnitsPerTurn;
    p.location = homeOf(p);   // every turn starts at home (Austin 2026-07-09)
    p.warnings = [];
    p.forceWalk = false;
    p.weekend = [];
    // loan repayments collected at the start of each turn they're due
    p.debts = p.debts.filter(function (d) {
      if (state.turn >= d.dueTurn) {
        var amt = pctB(state, d.pct);
        addStat(state, p, "money", -amt);
        log(state, p, "💸 Lifestyle Loan repayment: -$" + amt, "bad");
        return false;
      }
      return true;
    });
    var showCards = state.weekendMode !== "off";
    // 1) status cards queued by last turn's endTurn (hunger / stress / pet strikes)
    if (showCards) (p.pendingWeekend || []).forEach(function (q) { p.weekend.push(cardFace(q.id, q)); });
    p.pendingWeekend = [];
    if (p.tuPenaltyNext > 0) {
      p.tu = Math.max(DATA.weekend.statusTu.minTu, p.tu - p.tuPenaltyNext);
      p.warnings.push("Lost " + p.tuPenaltyNext + " Time Units (" + p.penaltyReason + ")");
      log(state, p, "Starts the turn with only " + p.tu + " TU (" + p.penaltyReason + ")", "bad");
      p.tuPenaltyNext = 0; p.penaltyReason = "";
    }
    // 2) investment outcomes, one per held asset — ALWAYS resolve (Off only
    // hides the cards)  3) exactly one life-event card in Full mode
    resolveInvestments(state, p).forEach(function (c) { if (showCards) p.weekend.push(c); });
    if (state.weekendMode === "full" && state.turn >= ASSUME.weekend.eventStartTurn) {
      var ev = drawEventCard(state, p);
      if (ev) p.weekend.push(ev);
    }
    // Stored groceries cover this player turn automatically. A four-week
    // purchase feeds its purchase turn immediately, then consumes the three
    // stored meals here on the next three turns. Weekend event E11 resolves
    // first and can intentionally spoil the pantry before this meal.
    if (p.foodSupply > 0) {
      p.foodSupply -= 1;
      p.ate = true;
      p.autoAteStored = true;
      if (p.premiumSupply) gainStat(state, p, "health", 0.02);
      var pantry = p.foodSupply > 0 ? p.foodSupply + " stored week" + (p.foodSupply === 1 ? "" : "s") + " remain" : "pantry now empty";
      log(state, p, "🥕 Ate stored groceries automatically (" + pantry + ").", "good");
      if (p.foodSupply <= 0) { p.foodSupply = 0; p.premiumSupply = false; }
    }
    if (isRentTurn(state) && !p.homeless) p.warnings.push("RENT IS DUE this turn!");
    if (p.homeless) p.warnings.push("You're homeless — recover at the Park / rent a room");
    if (p.pet && !p.pet.dead) {
      var band = petState(state, p);
      if (band !== "Healthy") p.warnings.push("Your pet is " + band + "!");
    }
  }

  // v3 3-strike feeding rule: the label IS the strike count
  function petState(state, p) {
    var m = p.pet.missed || 0;
    if (m <= 0) return "Healthy";
    if (m === 1) return "Sad";
    return "Starving";
  }

  function endTurn(state) {
    var p = active(state), events = [];
    var stu = DATA.weekend.statusTu;
    var baseTU = DATA.settings.timeUnitsPerTurn;
    // Jobs require one completed Work action per player-week. Hiring and
    // promotion weeks are grace periods so a new role cannot fire instantly.
    if (p.job && p.jobStartedTurn != null && p.jobStartedTurn < state.turn && !p.workedThisTurn) {
      var firedFrom = p.job.name;
      p.job = null; p.jobStartedTurn = null; p.jobShifts = 0;
      events.push("💼 " + p.name + " was fired from " + firedFrom + " for missing work all week");
      log(state, p, "💼 Fired from " + firedFrom + " — didn't work a shift this week.", "bad");
    }
    p.workedThisTurn = false;
    // 1) hunger (S01 — announced by a Weekend card at the start of next turn):
    // lose 25% of next turn's Time Units (v2-4, % of the turn)
    if (!p.ate) {
      var hungerTU = Math.max(1, Math.floor(stu.hungerPct * baseTU));
      p.tuPenaltyNext += hungerTU;
      p.penaltyReason = "hunger";
      p.pendingWeekend.push({ id: "S01", detail: "-" + hungerTU + " TU (25%)" });
      events.push(p.name + " didn't eat — will lose " + hungerTU + " TU next turn");
      log(state, p, "Didn't eat this turn! -" + hungerTU + " TU next turn.", "bad");
    }
    p.ate = false;
    // 2) stress (S02): lose 15% of next turn's TU AND some Health + Happiness now
    p.turnsSinceRelax += 1;
    if (p.turnsSinceRelax > 2) {
      var stressTU = Math.max(1, Math.floor(stu.stressPct * baseTU));
      p.tuPenaltyNext += stressTU;
      p.penaltyReason = (p.penaltyReason ? p.penaltyReason + " + " : "") + "stress";
      var hLoss = addStat(state, p, "happiness", -pctB(state, stu.stressHappinessPct || 0));
      var htLoss = addStat(state, p, "health", -pctB(state, stu.stressHealthPct || 0));
      var statBits = [];
      if (hLoss) statBits.push(hLoss + " Happiness");
      if (htLoss) statBits.push(htLoss + " Health");
      p.pendingWeekend.push({ id: "S02", detail: "-" + stressTU + " TU (15%)" + (statBits.length ? " · " + statBits.join(", ") : "") });
      events.push(p.name + " is stressed out — lose " + stressTU + " TU next turn" + (statBits.length ? " + " + statBits.join(", ") : ""));
      log(state, p, "Too stressed (no relaxing for " + p.turnsSinceRelax + " turns). -" + stressTU + " TU" + (statBits.length ? ", " + statBits.join(", ") : ""), "bad");
    }
    // 3) pet upkeep — v3 3-strike feeding rule (Sad -> Starving -> Dead)
    if (p.pet && !p.pet.dead) {
      addStat(state, p, "petHappiness", -pctB(state, ASSUME.petHappinessDecayPct));
      if (p.flags.petToy)   // Buy Pet Toy (pet shop) passive; the mall's Pet Toys now fire on play (v5)
        addStat(state, p, "petHappiness", pctB(state, ASSUME.petToyPassivePct));
      var petName = (ASSUME.petNames || {})[p.pet.code] || "your pet";
      if (p.pet.fedThisTurn) {
        p.pet.missed = 0;
      } else {
        p.pet.missed = (p.pet.missed || 0) + 1;
        if (p.pet.missed === 1) {
          addStat(state, p, "petHappiness", -pctB(state, 0.05));
          p.pendingWeekend.push({ id: "S03", petName: petName });
          events.push("🐾 " + petName + " is SAD (missed a feeding)");
          log(state, p, "🐾 " + petName + " missed a feeding and is Sad.", "bad");
        } else if (p.pet.missed === 2) {
          addStat(state, p, "petHealth", -pctB(state, 0.08));
          addStat(state, p, "petHappiness", -pctB(state, 0.08));
          p.pendingWeekend.push({ id: "S04", petName: petName });
          events.push("⚠️ " + petName + " is STARVING — one more missed feeding is fatal");
          log(state, p, "⚠️ " + petName + " is STARVING. FINAL WARNING.", "bad");
        } else if (p.pet.missed >= 3) {
          p.pet.dead = true; p.petDied = true;
          p.tombstones.push(petName);
          p.pet = null;               // slot opens for re-adoption; the tombstone stays
          p.stats.happiness = 0;
          p.pendingWeekend.push({ id: "S05", petName: petName });
          events.push("💀 " + petName + " DIED. " + p.name + "'s Happiness reset to 0.");
          log(state, p, "💀 " + petName + " died from neglect. A tombstone appears at home. Happiness drops to 0.", "bad");
        }
      }
      if (p.pet) p.pet.fedThisTurn = false;
    }
    // 4) booster crash
    if (p.booster) {
      p.booster.turnsLeft -= 1;
      if (p.booster.turnsLeft <= 0) {
        p.booster = null;
        addStat(state, p, "health", -pctB(state, ASSUME.booster.crashHealthPct));
        log(state, p, "The suspicious test booster wore off. That crash hurt.", "bad");
      }
    }
    // 5) rent resolution for THIS player on rent turns
    if (isRentTurn(state) && !p.homeless && !p.rentPaid) {
      p.homeless = true; p.rentMod = 1;
      addStat(state, p, "happiness", -pctB(state, ASSUME.homelessHappinessHitPct));
      p.location = "park";
      events.push("🏚️ " + p.name + " couldn't pay rent and is now HOMELESS (living at the Park)");
      log(state, p, "🏚️ Evicted! Couldn't pay rent — now living at Almost Fine Park.", "bad");
      // the pet won't tough out park life — it leaves. No extra Happiness hit
      // beyond eviction itself (Austin 2026-07-20); no tombstone, re-adopt later.
      if (p.pet && !p.pet.dead) {
        var petName = (ASSUME.petNames || {})[p.pet.code] || "Their pet";
        p.pet = null;
        events.push("🐾 " + petName + " couldn't handle park life and left.");
        log(state, p, "🐾 " + petName + " left — a pet can't live on a park bench. You can adopt again once you're housed.", "bad");
      }
    }
    // what happened this turn becomes "last turn" for next weekend's event reqs
    p.prevTurn = p.turnFlags; p.turnFlags = {};
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
        log(state, null, "Turn " + state.maxRounds + " of " + state.maxRounds + " played — final scoring!", "good");
      } else if (state.maxRounds > 0 && state.turn === state.maxRounds) {
        log(state, null, "🏁 FINAL ROUND — turn " + state.turn + " of " + state.maxRounds + "!", "bad");
      }
      if (!state.over && isRentTurn(state)) {
        state.players.forEach(function (q) { q.rentPaid = (q.rentPaidThrough || 0) >= state.turn; });
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
  // Cash is uncapped in the wallet, but for SCORING Money counts at most T like
  // every other stat — otherwise v5's dollar economy ($40-$400 per work click)
  // would let hoarded cash swamp the upkeep average (max score stays 6T).
  function scoreStat(state, p, k) { return k === "money" ? Math.min(state.T, p.stats[k]) : p.stats[k]; }
  function upkeepAvg(state, p) {
    return UPKEEP.reduce(function (s, k) { return s + scoreStat(state, p, k); }, 0) / UPKEEP.length;
  }
  function score(state, p) {
    var mains = MAIN.reduce(function (s, k) { return s + p.stats[k]; }, 0);
    var upkeep = upkeepAvg(state, p);
    var pet = (p.pet && !p.pet.dead) ? (p.pet.health + p.pet.happiness) / 2 : 0;
    return Math.round(mains + upkeep + pet);
  }
  function podium(state) {
    return state.players.map(function (p) {
      return { player: p, score: score(state, p),
        breakdown: {
          connection: p.stats.connection, health: p.stats.health, career: p.stats.career,
          happiness: p.stats.happiness,
          upkeepAvg: Math.round(upkeepAvg(state, p)),
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
    weekendStanding: weekendStanding, exitNodeOf: exitNodeOf,
    jobsWithStatus: jobsWithStatus, tierGate: tierGate, statName: statName,
    econ: econ, pctB: pctB, economyBaseFor: economyBaseFor, itemActive: itemActive,
    payMultiplier: payMultiplier, nextRentTurn: nextRentTurn, careerShare: careerShare,
    rentStatus: rentStatus,
    COURSES: COURSES, nextCourse: nextCourse, courseCatalog: courseCatalog, courseCostDue: courseCostDue,
    pathComplete: pathComplete, principalOf: principalOf, homeOf: homeOf,
    personalityMult: personalityMult, totalMult: totalMult, transportOf: transportOf,
    shortestPath: shortestPath, PATHS: PATHS, NODE_POS: NODE_POS, log: log,
    serialize: function (state) { return JSON.stringify(state); },
    deserialize: function (json) { return JSON.parse(json); }
  };
  if (typeof window !== "undefined") window.PPEngine = API;
  if (typeof module !== "undefined") module.exports = API;
})();
