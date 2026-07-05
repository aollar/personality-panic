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

  // --- Bad Decisions Club door policy (TTTTT: bouncer checks Coolness) ---
  clubEntryCoolnessPct: 0.08, // need Coolness >= 8% of T to get in (8 at Short)

  // --- Upkeep penalties (Manual says "lose time", never how much) ---
  hungerTuPenalty: 2,         // TUs lost next turn if you didn't eat this turn
  stressTuPenalty: 1,         // TUs lost per turn while the 2-turn relax rule is lapsed

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
    { id: "X003", building: "luxury", name: "Sign Luxury Lease", category: "Housing",
      tu: 1, costPct: 0.40, gains: [{ stat: "happiness", pct: 0.05 }], petGains: [], penalties: [],
      req: [{ kind: "notHomeless" }, { kind: "notLux" }],
      fx: [{ kind: "moveIn", tier: "lux" }],
      note: "Move up to Heelton Heights. Luxury rent (0.5T) is due every rent cycle." },
    { id: "X004", building: "lowCost", name: "Move Back to Low Cost", category: "Housing",
      tu: 1, costPct: 0, gains: [], petGains: [], penalties: [{ stat: "happiness", pct: 0.03 }],
      req: [{ kind: "isLux" }],
      fx: [{ kind: "moveIn", tier: "low" }],
      note: "Downgrade. Cheaper rent, bruised ego." },
    { id: "X005", building: "lowCost", name: "Rent Low Cost Room", category: "Housing",
      tu: 1, costPct: 0.20, gains: [], petGains: [], penalties: [],
      req: [{ kind: "homeless" }],
      fx: [{ kind: "rehouse" }],
      note: "Recover from homelessness. The Park was never home." },
    { id: "X006", building: "lowCost", name: "Pay Rent", category: "Rent",
      tu: 0, costPct: 0.20, gains: [], petGains: [], penalties: [],
      req: [{ kind: "rentDue" }, { kind: "isLow" }, { kind: "rentUnpaid" }],
      fx: [{ kind: "payRent", tier: "low" }],
      note: "Rent is due every 4 turns." },
    { id: "X007", building: "luxury", name: "Pay Luxury Rent", category: "Rent",
      tu: 0, costPct: 0.50, gains: [], petGains: [], penalties: [],
      req: [{ kind: "rentDue" }, { kind: "isLux" }, { kind: "rentUnpaid" }],
      fx: [{ kind: "payRent", tier: "lux" }],
      note: "Heelton Heights does not do grace periods." }
  ],
  // Sheet rent rows replaced by synthetic ones above (A008 dual-purposed poorly):
  removedActions: ["A008", "A017"]
};
if (typeof window !== "undefined") window.PP_ASSUMPTIONS = PP_ASSUMPTIONS;
if (typeof module !== "undefined") module.exports = PP_ASSUMPTIONS;
