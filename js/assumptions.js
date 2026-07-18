/*
 * PERSONALITY PANIC — ASSUMED VALUES
 * ==================================
 * Everything in this file is a number or rule the Manual/spreadsheet does NOT
 * define. These are Claude's balancing calls — every one is tunable here and
 * surfaced in the in-game Debug panel. All "pct" values are % of T.
 *
 * If a value here ever conflicts with the spreadsheet, the spreadsheet wins —
 * move the number there and delete it here.
 */
var PP_ASSUMPTIONS = {
  // --- Economy ---
  startingMoneyPct: 0.30,     // mirrors the Homeless Support Cheque (casual clothes + low rent)
  startingItems: ["Casual Clothes"],  // TTTTT: start dressed; low-tier jobs open from turn 1

  // --- Bad Decisions Club door policy: it's a DRESS CODE now (Austin 2026-07-05) ---
  clubEntryItems: ["Dressy Clothes", "Dress Shoes"],

  // --- Housing deposits (switching / recovering costs deposit + that cycle's rent) ---
  lowDepositPct: 0.10,
  luxDepositPct: 0.25,

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

  // --- Degrees ("degree progress" actions: Take Class / Study Group / Cram) ---
  degreeProgressNeeded: { Undergrad: 3, Masters: 6, PhD: 10 }, // cumulative study actions

  // --- Pets (decay + food quantity undefined in spec) ---
  petFoodFeedings: 4,         // one Buy Pet Food = 4 uses of "Feed Pet"
  petHealthDecayPct: 0.06,    // per turn NOT fed
  petHappinessDecayPct: 0.02, // per turn (play/toys counteract)
  petToyPassivePct: 0.02,     // per turn passive Pet Happiness if toy owned
  petStateBands: { hungry: 0.6, sick: 0.4, critical: 0.2 }, // fractions of T
  petStartPct: 0.7,           // adopted pets start at 70% health/happiness

  // --- Investments ("risk event possible" — odds undefined) ---
  invest: {
    low:    { win: 1.00, lossPct: 0.00 },   // bonds always pay the listed gain
    medium: { win: 0.65, lossPct: 0.06 },   // stocks: else lose extra 6% T
    high:   { win: 0.50, lossPct: 0.10 }    // crypto: else lose extra 10% T
  },
  tinyPrintBonus: 0.10,       // Read Tiny Print: +10pp win chance (persistent)

  // --- Lifestyle Loan (sheet: +0.15T now, -0.2T "later") ---
  loanDueNextRentCycle: true,

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
      req: [{ kind: "notHomeless" }, { kind: "foodSupply" }],
      fx: [{ kind: "eat" }, { kind: "consumeSupply" }],
      note: "Eats 1 week of groceries. Premium supply also gives +Health." },
    { id: "X002", building: "luxury", name: "Eat at Home", category: "Food",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "housedLux" }, { kind: "foodSupply" }],
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
      tu: 1, costPct: 0.75, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "notLux" }],
      fx: [{ kind: "moveIn", tier: "lux" }, { kind: "payRent", tier: "lux" }],
      note: "Deposit $25 + first rent $50 (Short). Welcome to Heelton Heights." },
    { id: "X004", building: "lowCost", name: "Switch to Low Cost Room", category: "Housing",
      tu: 1, costPct: 0.30, gains: [], petGains: [], penalties: [{ stat: "happiness", pct: 0.03 }],
      req: [{ kind: "isLux" }],
      fx: [{ kind: "moveIn", tier: "low" }, { kind: "payRent", tier: "low" }],
      note: "Deposit $10 + rent $20 (Short). Cheaper, humbler." },
    { id: "X005", building: "anywhere", name: "Re-house: Low Cost Room", category: "Housing",
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
      note: "Scissors + confidence = fashion." },
    { id: "X006", building: "lowCost", name: "Pay Rent", category: "Rent",
      tu: 0, costPct: 0.20, gains: [], petGains: [], penalties: [],
      req: [{ kind: "rentDue" }, { kind: "isLow" }, { kind: "rentUnpaid" }],
      fx: [{ kind: "payRent", tier: "low" }],
      note: "Rent is due every 4 turns." },
    { id: "X007", building: "luxury", name: "Pay Luxury Rent", category: "Rent",
      tu: 0, costPct: 0.50, gains: [], petGains: [], penalties: [],
      req: [{ kind: "rentDue" }, { kind: "isLux" }, { kind: "rentUnpaid" }],
      fx: [{ kind: "payRent", tier: "lux" }],
      note: "Heelton Heights does not do grace periods." },
    { id: "X013", building: "debtstreet", name: "Panic Sell", category: "Money",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [],
      req: [{ kind: "hasHolding" }],
      fx: [{ kind: "panicSell" }],
      note: "Dump a position for 60% of what you paid. Dignity not included." }
  ],
  // Sheet rent rows replaced by synthetic ones above (A008 dual-purposed poorly):
  removedActions: ["A008", "A017"],

  // University course catalog for "Take Class" (Austin 2026-07-09: show + choose
  // courses). Names riff on the scene art (book spines / whiteboard). Every
  // course = the sheet's A067 (same TU/cost, +1 degree progress) plus this
  // INVENTED mini-bonus so the pick matters:
  courses: [
    { name: "Philosophy 101", stat: "enlightenment", pct: 0.02, blurb: "Think about thinking. Regret both." },
    { name: "Quantum Confusion", stat: "critical", pct: 0.02, blurb: "The answer is yes, no, and maybe — simultaneously." },
    { name: "Memory of Maybe", stat: "critical", pct: 0.02, blurb: "Remember things that almost happened." },
    { name: "Intro to Panic", stat: "happiness", pct: 0.02, blurb: "Prerequisites: none. You're already enrolled." },
    { name: "The Overthinking Equation", stat: "enlightenment", pct: 0.02, blurb: "1 + 1 = 11. Show your work." },
    { name: "Group Project Survival", stat: "connection", pct: 0.02, blurb: "Carry the team. Emotionally." }
  ],
  // Buy My Camp is once-per-game; the single purchase hits hard (Austin 2026-07-09):
  myCampBoost: { enlightenment: 0.10, happiness: 0.05 },

  // --- Weekend Update card system: glue the v3 Cards sheet doesn't specify ---
  weekend: {
    eventStartTurn: 2,        // no "weekend" happened before turn 1 — first event card on turn 2
    sellRefundPct: 0.6,       // Panic Sell (X013): recover 60% of the asset's buy-in
    tinyPrintShiftPp: 0.05,   // Read Tiny Print: 5pp moved from your worst outcome to your best
    // "Tech" vs "Appliance" split (Items sheet lumps them in one group):
    techItems: ["Computer", "Mobile Phone", "Camera", "TV", "Blu-ray", "E-reader", "Stereo", "Watch"],
    applianceItems: ["Fridge", "Stove", "Vacuum", "Cold Plunge", "Hot Tub"],
    // what each Debtstreet buy action holds, and what that position cost (%T):
    assets: { A085: "savings", A086: "bonds", A087: "stocks", A088: "crypto" },
    assetCostPct: { savings: 0, bonds: 0.05, stocks: 0.08, crypto: 0.12 }
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
