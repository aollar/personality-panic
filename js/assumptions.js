/*
 * PERSONALITY PANIC — ASSUMED VALUES
 * ==================================
 * Everything in this file is a number or rule the Manual/spreadsheet does NOT
 * define. These are Claude's balancing calls — every one is tunable here and
 * surfaced in the in-game Debug panel. All money/gain "pct" values are % of B
 * (the economy base: Short 100, Medium 250, Long 350); stat THRESHOLDS
 * (pctT, pet start/bands) stay % of the stat cap T.
 *
 * If a value here ever conflicts with the spreadsheet, the spreadsheet wins —
 * move the number there and delete it here.
 */
var PP_ASSUMPTIONS = {
  // --- Economy ---
  startingMoneyPct: 2.0,      // $200 Short: mirrors the v5 Homeless Support Cheque (casual clothes + low rent + meals)
  startingItems: ["Casual Clothes"],  // TTTTT: start dressed; low-tier jobs open from turn 1

  // --- Bad Decisions Club door policy: it's a DRESS CODE now (Austin 2026-07-05) ---
  clubEntryItems: ["Dressy Clothes", "Dress Shoes"],

  // --- Housing deposits: moving in costs deposit + that cycle's rent. Rent comes
  // from the sheet (A008 $100 / A017 $400 in v5); the deposit is this multiple
  // of it, so X003/X004/X005/X009 = 1.5x rent. The engine syncs those prices. ---
  depositRentMultiple: 0.5,

  // --- Upkeep penalties ---
  // v3 locked these in the sheet (Settings "UPKEEP TIME PENALTIES": hunger -4,
  // stress -2, floor 1) — the engine now reads DATA.weekend.statusTu, so the
  // old hungerTuPenalty/stressTuPenalty entries moved out of this file.

  // --- Food supply ("weeks" of groceries vs eat-every-turn) ---
  // RULE: 1 turn = 1 week. Groceries add weeks of supply; "Eat at Home" (free
  // synthetic action, 1 TU, available in any housing) consumes 1 week and
  // counts as eating. Stat gains from groceries land at purchase (per sheet).
  weeksPerTurn: 1,

  // --- Movement (near/far never defined per building pair) ---
  // Path length is measured along the road graph in native map pixels.
  nearPathPx: 620,            // path <= this = "Move nearby" (1 TU), else "Move far" (2 TU)
  moveCost: {                 // [near, far] TU by transport ("slight/faster/fastest" quantified)
    walk: [1, 2],
    "Bus Pass": [1, 1],
    "Bicycle": [1, 1],        // same TU as bus; the bike's +Health item bonus is its edge
    "Car": [0, 1]             // "Fastest movement" — nearby moves are free
  },

  // --- Unquantified action thresholds (also baked into gamedata req rows) ---
  thresholds: {
    vipCoolnessPct: 0.40, myCampMoneyPct: 0.50, innerPeaceEnlightenmentPct: 0.50,
    debateProfessorCriticalPct: 0.30
  },

  // --- Job tier click gates (v5 Job_Progression) ---
  // Balance Lock v5 leaves this as an OPEN DECISION. Option A (default here, as
  // specified): absolute clicks in every mode. Option B scales the gates by
  // mode: set { short: 0.4, medium: 0.7, long: 1 }.
  jobClickScale: { short: 1, medium: 1, long: 1 },

  // --- Home fixtures (v5 flat trigger bonuses) ---
  // Which authored home actions count as each trigger. Bonuses only fire when
  // the action is taken in the player's OWN home.
  homeTriggers: {
    sleep: ["A001", "A009"],               // Sleep in Bunk Bed / Sleep in Fancy Bed
    relax: ["A002", "A010", "A011"],       // Relax in Your Room / Luxury Bath / Relax in Your Suite
    workFromHome: ["A015"],
    playPet: ["A006", "X014"],             // Hang With Pet (low cost) / Play With Pet (Heelton)
    exercise: ["A004", "A012"]             // Exercise in Former Yard / Exercise in Condo Gym
  },
  // Flat points per the sheet. The manual flags B-scaling (x2.5 / x3.5) as the
  // fallback if furniture feels irrelevant in Medium/Long games.
  fixtureBonusScalesWithB: false,

  // --- Pets (decay + food quantity undefined in spec) ---
  petFoodFeedings: 4,         // one Buy Pet Food = 4 uses of "Feed Pet"
  petHealthDecayPct: 0.06,    // per turn NOT fed
  petHappinessDecayPct: 0.02, // per turn (play/toys counteract)
  petToyPassivePct: 0.02,     // per turn passive Pet Happiness if toy owned
  petStateBands: { hungry: 0.6, sick: 0.4, critical: 0.2 }, // fractions of T
  petStartPct: 0.7,           // adopted pets start at 70% health/happiness

  // --- Suspicious Test Booster (temporary modifier undefined) ---
  booster: { turns: 2, gainBonus: 0.10, crashHealthPct: 0.04 },

  // --- Jobs ---
  benefitsTiers: ["High", "Max", "Max+", "Mid+"], // tiers where "benefits unlocked" (Mid+ counts)

  // --- Housing (no "move to Luxury" action exists in the sheet — added here) ---
  luxuryDepositPct: 0.40,     // one-time cost of "Sign Luxury Lease" synthetic action
  homelessHappinessHitPct: 0.10, // immediate Happiness loss when going homeless

  // --- Scoring ---
  // AVG(Pet Happiness, Pet Health) counts as 0 if you never adopt (formula is
  // literal). Pets are close to mandatory for score — intentional per manual.

  // --- Endgame safety ---
  maxRoundsDefault: 0,        // 0 = off; setup can set a cap so a game ALWAYS ends

  // --- Synthetic actions (rules the manual describes but the sheet has no row for) ---
  extraActions: [
    { id: "X001", building: "lowCost", name: "Eat at Home", category: "Food",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "foodSupply" }, { kind: "notAte" }],
      fx: [{ kind: "eat" }, { kind: "consumeSupply" }],
      note: "Eats 1 week of groceries. Premium supply also gives +Health." },
    { id: "X002", building: "luxury", name: "Eat at Home", category: "Food",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "housedLux" }, { kind: "foodSupply" }, { kind: "notAte" }],
      fx: [{ kind: "eat" }, { kind: "consumeSupply" }],
      note: "Eats 1 week of groceries. Premium supply also gives +Health." },
    // the sheet only lets LOW-COST tenants feed their pet at home — luxury
    // tenants would starve theirs. Mirror of A007:
    { id: "X008", building: "luxury", name: "Feed Pet", category: "Pet",
      tu: 1, costPct: 0, gains: [], petGains: [{ stat: "petHealth", pct: 0.08 }], penalties: [],
      req: [{ kind: "housedLux" }, { kind: "hasPet" }, { kind: "petFoodAvailable" }],
      fx: [{ kind: "feedPet" }],
      note: "Prevents the pet warning/death spiral." },
    { id: "X003", building: "luxury", name: "Switch to Luxury Suite", category: "Housing",
      tu: 1, costPct: 6.0, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "notLux" }],
      fx: [{ kind: "moveIn", tier: "lux" }, { kind: "payRent", tier: "lux" }],
      note: "Deposit + first month's rent. Welcome to Heelton Heights." },
    { id: "X004", building: "lowCost", name: "Switch to Low Cost Room", category: "Housing",
      tu: 1, costPct: 1.5, gains: [], petGains: [], penalties: [{ stat: "happiness", pct: 0.03 }],
      req: [{ kind: "isLux" }],
      fx: [{ kind: "moveIn", tier: "low" }, { kind: "payRent", tier: "low" }],
      note: "Deposit + rent. Cheaper, humbler. Luxury-only items go to storage." },
    { id: "X005", building: "anywhere", name: "Re-house: Low Cost Room", category: "Housing",
      tu: 1, costPct: 1.5, gains: [], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }],
      note: "Deposit + rent. Back on your feet — usable anywhere." },
    { id: "X009", building: "anywhere", name: "Re-house: Luxury Suite", category: "Housing",
      tu: 1, costPct: 6.0, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }, { kind: "moveIn", tier: "lux" }],
      note: "Deposit + rent. From park bench to penthouse." },
    { id: "X010", building: "park", name: "Skate the Fountain Edge", category: "Coolness",
      tu: 1, costPct: 0, gains: [{ stat: "coolness", pct: 0.05 }], petGains: [],
      penalties: [{ stat: "health", pct: 0.015 }],
      req: [],
      fx: [],
      note: "Free coolness. Occasional dignity loss." },
    { id: "X011", building: "regretBurger", name: "Order Off-Menu Like a Regular", category: "Coolness",
      // v5: Regret Burger menu repriced ~5x (Classic $15)
      tu: 1, costPct: 0.15, gains: [{ stat: "coolness", pct: 0.04 }, { stat: "happiness", pct: 0.02 }],
      petGains: [], penalties: [],
      req: [],
      fx: [{ kind: "eat" }],
      note: "Fills hunger. The staff pretends to know you." },
    { id: "X012", building: "lowCost", name: "Thrift-Flip Your Outfit", category: "Coolness",
      tu: 1, costPct: 0.10, gains: [{ stat: "coolness", pct: 0.04 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }],
      fx: [],
      note: "Scissors + confidence = fashion." },
    // v6: Pay Rent is ALWAYS listed and never hidden. It shows four states
    // (due / paid / not yet due / can't afford) and may be paid early.
    { id: "X006", building: "lowCost", name: "Pay Rent", category: "Rent",
      tu: 0, costPct: 1.0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "isLow" }, { kind: "rentPayable" }],
      fx: [{ kind: "payRent", tier: "low" }],
      note: "Rent is due every 4 turns. You can pay early." },
    { id: "X007", building: "luxury", name: "Pay Luxury Rent", category: "Rent",
      tu: 0, costPct: 4.0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "isLux" }, { kind: "rentPayable" }],
      fx: [{ kind: "payRent", tier: "lux" }],
      note: "Heelton Heights does not do grace periods. You can pay early." },
    // Heelton tenants had no home "play with pet" action, so the Pet Bed / Pet
    // Toys trigger could never fire there. Mirror of A006 Hang With Pet:
    { id: "X014", building: "luxury", name: "Play With Pet", category: "Pet",
      tu: 1, costPct: 0, gains: [{ stat: "connection", pct: 0.025 }], petGains: [], penalties: [],
      req: [{ kind: "housedLux" }, { kind: "hasPet" }],
      fx: [],
      note: "Pet Bed and Pet Toys add their bonuses here." }
  ],
  // Sheet rent rows replaced by synthetic ones above (A008 dual-purposed poorly):
  removedActions: ["A008", "A017"],

  // University courses now come from the v5 Education_Paths sheet (DATA.education).
  // Buy My Camp is once-per-game; the single purchase hits hard (Austin 2026-07-09):
  myCampBoost: { enlightenment: 0.10, happiness: 0.05 },

  // --- Weekend Update card system: glue the v3 Cards sheet doesn't specify ---
  weekend: {
    eventStartTurn: 2,        // no "weekend" happened before turn 1 — first event card on turn 2
    // "Tech" vs "Appliance" split (Items sheet lumps them in one group):
    techItems: ["Computer", "Mobile Phone", "Camera", "TV", "Blu-ray", "E-reader", "Stereo", "Watch"],
    applianceItems: ["Fridge", "Stove", "Vacuum", "Cold Plunge", "Hot Tub"]
  },
  // Pet display names — canonical: painted on the Adopt pages of the pet shop art
  petNames: {
    ESFJ: "Captain Snuggleton", ENFJ: "King Heartmane", ENFP: "Otter the Explorer",
    ESFP: "Party Piggy", ESTJ: "Chief Pawton", ENTJ: "CEO Gorillionaire",
    ENTP: "Sir Honksworth", ESTP: "Hustle Harry", ISFJ: "Nurse Nibbles",
    INFJ: "Vinnie", INFP: "Fawnie Dreamer", ISFP: "Duchess Meowtilda",
    ISTJ: "Detective Biscuit", ISTP: "Clutch", INTJ: "Professor Beakman",
    INTP: "Orylle Overplan"
  }
};
if (typeof window !== "undefined") window.PP_ASSUMPTIONS = PP_ASSUMPTIONS;
if (typeof module !== "undefined") module.exports = PP_ASSUMPTIONS;
