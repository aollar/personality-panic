"""
Personality Panic — data pipeline.
Reads Personality_Panic_Balance_Lock_v2-2.xlsx (single source of truth for numbers)
and emits assets/data/gamedata.js (window.PP_DATA) with normalized, structured
requirements/effects so the engine never parses free text at runtime.

Anything NOT in the spreadsheet lives in js/assumptions.js (hand-written), not here.
Re-run after any spreadsheet change:  python scripts/build_data.py
"""
import json, os, re
import openpyxl

XLSX = r"C:\Users\aloss\OneDrive\Desktop\Personality Panic\Personality_Panic_Balance_Lock_v2-2.xlsx"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "data", "gamedata.js")

STAT = {
    "Connection": "connection", "Health": "health", "Career": "career",
    "Happiness": "happiness", "Coolness Factor": "coolness", "Coolness": "coolness",
    "Critical Thinking": "critical", "Enlightenment": "enlightenment", "Money": "money",
    "Pet Happiness": "petHappiness", "Pet Health": "petHealth",
}
MAIN_STATS = ["connection", "health", "career", "happiness"]
UPKEEP_STATS = ["coolness", "critical", "enlightenment", "money"]

BUILDING_ID = {
    "Low Cost Housing": "lowCost", "Luxury Apartments": "luxury", "Park": "park",
    "Air One Supermarket": "airOne", "Regret Burger": "regretBurger",
    "Bro Science Gym": "gym", "Bad Decisions Club": "club",
    "Re-Education Temple": "temple", "High IQ University": "university",
    "Corporate Soul Exchange": "soulExchange", "Debtstreet Capital": "debtstreet",
    "Emotional Baggage Airport": "airport", "Ethical Pet Shop": "petShop", "Mall": "mall",
}

# Archetype cards (art is authoritative: codes read off the card sheets)
ARCHETYPES = {
    "ESTP": {"name": "The Daredevil", "card": "card_00.jpg", "tag": "What could go wrong? Don't answer that."},
    "INFJ": {"name": "The Oracle", "card": "card_01.jpg", "tag": "Booked, blessed, and quietly overwhelmed."},
    "ENTJ": {"name": "The Overlord", "card": "card_02.jpg", "tag": "A five-year plan for your weekend."},
    "ISFP": {"name": "The Vibe Curator", "card": "card_03.jpg", "tag": "Aesthetic first. Consequences later."},
    "ESFP": {"name": "The Showstopper", "card": "card_04.jpg", "tag": "If it's extra, it's correct."},
    "ENFJ": {"name": "The Mentor", "card": "card_05.jpg", "tag": "Part pep talk, part life strategy."},
    "ISTJ": {"name": "The Auditor", "card": "card_06.jpg", "tag": "Calm, correct, and fully itemized."},
    "ISTP": {"name": "The Fixer", "card": "card_07.jpg", "tag": "If it works, it works."},
    "ENTP": {"name": "The Provocateur", "card": "card_08.jpg", "tag": "I'm not arguing. I'm upgrading your side."},
    "ISFJ": {"name": "The Guardian", "card": "card_09.jpg", "tag": "Keeping everyone alive and on time."},
    "ESTJ": {"name": "The Taskmaster", "card": "card_10.jpg", "tag": "Fun has been allocated 3:15pm."},
    "INFP": {"name": "The Dreamer", "card": "card_11.jpg", "tag": "Emotionally booked."},
    "INTP": {"name": "The Architect", "card": "card_12.jpg", "tag": "Overthinking is thinking, twice."},
    "ENFP": {"name": "The Campaigner", "card": "card_13.jpg", "tag": "What if... everything?"},
    "INTJ": {"name": "The Strategist", "card": "card_14.jpg", "tag": "Just a simple plan. 47 steps."},
    "ESFJ": {"name": "The Caregiver", "card": "card_15.jpg", "tag": "Your hype person."},
}

# ---------------------------------------------------------------------------
# Requirement normalization: free text -> structured predicate list (AND).
# Leaf kinds the engine understands:
#   housedLow / housedLux / housedAny / homeless / notHomeless
#   ownsItem:<Item Name> / hasPet / noPet / petFoodAvailable / furnitureOwned
#   fridge / stove / rentDue / hasJob / jobInBuilding / benefitsUnlocked
#   statGte:{stat,pctT} / degree:<Undergrad|Masters|PhD> / degreeProgress:<n>
#   myCamp (temple unlock) / foodSupply
# "Money available" is implicit: engine always checks money >= cost.
def norm_req(action_id, building, text):
    t = (text or "").strip()
    reqs = []
    tl = t.lower()
    def add(kind, **kw): reqs.append(dict(kind=kind, **kw))

    if "must be housed here" in tl: add("housedLow")
    if tl.startswith("luxury apartment") or "luxury apartment +" in tl or tl == "luxury apartment":
        add("housedLux")
    if "own a pet" in tl or "own pet" in tl or tl.startswith("owns pet"):
        if "or volunteer" not in tl: add("hasPet")
    if "no pet owned" in tl: add("noPet")
    if "pet food" in tl: add("petFoodAvailable")
    if "furniture owned" in tl: add("furnitureOwned")
    if "homeless" in tl and "rent cycle" in tl: add("homeless"); add("rentDue")
    elif tl == "homeless": add("homeless")
    if tl == "rent cycle": add("rentDue")
    if "rent cycle + luxury" in tl: add("rentDue"); add("housedLux")
    if "requires fridge" in tl or tl == "fridge": add("fridge")
    if "fridge + stove" in tl: add("fridge"); add("stove")
    if "dressy clothes" in tl: add("ownsItem", item="Dressy Clothes")
    if "job assigned at corporate soul exchange" in tl: add("jobInBuilding")
    if tl.startswith("current job"): add("hasJob")
    if "benefits unlocked" in tl: add("benefitsUnlocked")
    if "computer recommended" in tl: pass  # recommendation only
    # thresholds (VALUES ARE ASSUMPTIONS — see js/assumptions.js)
    if "coolness threshold" in tl: add("statGte", stat="coolness", pctT=0.40)
    if "money threshold" in tl: add("statGte", stat="money", pctT=0.50)
    if "enlightenment threshold" in tl: add("statGte", stat="enlightenment", pctT=0.50)
    if "critical thinking threshold" in tl and action_id != "A084":
        add("statGte", stat="critical", pctT=0.30)
    if action_id == "A084":  # Ask for Promotion: must meet next-tier job reqs (engine-side)
        add("promotionEligible")
    if action_id == "A070": add("degreeProgress", n=3)
    if action_id == "A071": add("degree", degree="Undergrad"); add("degreeProgress", n=6)
    if action_id == "A072": add("degree", degree="Masters"); add("degreeProgress", n=10)
    if action_id in ("A062", "A063"): add("myCamp")   # advanced temple actions gated by My Camp
    if action_id == "A076": pass  # Get/Change Job: dialog filters individual jobs
    return reqs

# Effect normalization from the Unlock/Effect + notes columns.
def norm_fx(action_id, building, unlock, category, name):
    u = (unlock or "").lower(); fx = []
    def add(kind, **kw): fx.append(dict(kind=kind, **kw))
    if "fills hunger" in u or category == "Food" and building == "Regret Burger": add("eat")
    if "fills hunger" not in u and name in ("Buy $22 Smoothie",): pass
    if "counts as relaxing" in u or "counts as major relaxation" in u or "counts as mini-relax" in u:
        add("relax")
    if "reduces stress" in u: add("relax")
    if "ends hunger penalty" in u: pass
    if "adds 1 week food supply" in u: add("foodSupply", weeks=1)
    if "adds premium food supply" in u: add("foodSupply", weeks=1, premium=True)
    if "adds 4 weeks food supply" in u: add("foodSupply", weeks=4)
    if "better food efficiency at home" in u: add("foodSupply", weeks=2, premium=True)
    if "unlocks pet system" in u: add("adoptPet")
    if "prevents pet hunger warning" in u: add("petFood", feedings=4)  # feedings = ASSUMPTION
    if "passive pet happiness" in u: add("petToy")
    if "degree progress" in u: add("degreeProgress")
    if "unlocks mid-tier jobs" in u: add("grantDegree", degree="Undergrad")
    if "unlocks high-tier jobs" in u: add("grantDegree", degree="Masters")
    if "unlocks elite jobs" in u: add("grantDegree", degree="PhD")
    if "selects current job tier" in u: add("openJobDialog")
    if "upgrade job tier" in u: add("promote")
    if "lose job tier until rehired" in u: add("quitJob")
    if "keeps player housed" in u: add("payRent", tier="low")
    if "keeps luxury apartment" in u: add("payRent", tier="lux")
    if "enough for casual clothes" in u: add("supportCheque")
    if "survive turn" in u: add("sleepRough")
    if "unlocks advanced temple actions" in u: add("unlock", flag="myCamp")
    if "low risk" in u: add("invest", risk="low")
    if "medium risk" in u: add("invest", risk="medium")
    if "high risk" in u: add("invest", risk="high")
    if "reduces bad finance event chance" in u: add("unlock", flag="tinyPrint")
    if "future debt penalty" in u: add("loan")
    if "reduces bad travel event chance" in u: add("unlock", flag="travelInsurance")
    if "see items_mall" in u:
        cat = {"A112": "Transportation", "A113": "Electronics/Appliances",
               "A114": "Furniture", "A115": "Clothing"}[action_id]
        add("openShop", group=cat)
    if "avoids bad pet shop consequences" in u or "possible pet shop penalty" in u: pass  # flavor for MVP
    if "uses owned furniture bonus" in u: pass
    return fx

def num(v):
    if v is None or v == "": return 0.0
    try: return float(v)
    except (TypeError, ValueError): return 0.0

def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)

    # ---- Personalities ----
    ws = wb["Personalities"]
    personalities = {}
    for row in list(ws.iter_rows(min_row=2, values_only=True)):
        if not row[0]: continue
        code = str(row[0]).strip()
        personalities[code] = {
            "code": code,
            "mainStrength": STAT[row[1].strip()], "upkeepStrength": STAT[row[2].strip()],
            "mainWeakness": STAT[row[3].strip()], "upkeepWeakness": STAT[row[4].strip()],
            "engine": bool(row[5] and "Engine" in str(row[5])),
            **ARCHETYPES[code],
        }

    # ---- Settings / modifiers ----
    mods = {  # from Settings sheet, PERSONALITY MODIFIERS v2 block
        "connection": {"strength": 0.20, "weakness": -0.10, "cap": 1.45},
        "health":     {"strength": 0.20, "weakness": -0.10, "cap": 1.45},
        "happiness":  {"strength": 0.20, "weakness": -0.10, "cap": 1.45},
        "career":     {"strength": 0.10, "weakness": -0.10, "cap": 1.25},
        "coolness":   {"strength": 0.15, "weakness": -0.08, "cap": 1.35},
        "critical":   {"strength": 0.15, "weakness": -0.08, "cap": 1.35},
        "enlightenment": {"strength": 0.15, "weakness": -0.08, "cap": 1.35},
        "money":      {"strength": 0.10, "weakness": -0.08, "cap": 1.25},
    }
    settings = {
        "gameLengths": {"short": 100, "medium": 500, "long": 1000},
        "timeUnitsPerTurn": 40,
        "baseTimeUnits": 40,  # costs used AS AUTHORED (1-3 TU): 40 TU/turn = many actions per day (Austin 2026-07-06)
        "rentIntervalTurns": 4,
        "turnTimerOptions": [30, 60, 90, 120, 0],  # 0 = Unlimited
        "maxPlayers": 4, "minParticipants": 2,
        "incomeMultiplierCap": 1.25,
        "modifiers": mods,
        "mainStats": MAIN_STATS, "upkeepStats": UPKEEP_STATS,
    }

    # ---- Actions_Master ----
    ws = wb["Actions_Master"]
    actions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not str(row[0]).startswith("A"): continue
        (aid, bld, name, cat, req, tu, costPct, *_rest) = row[:7] + (None,)
        r = row
        gains = []
        if r[10]: gains.append({"stat": STAT[str(r[10]).strip()], "pct": num(r[11])})
        if r[15]: gains.append({"stat": STAT[str(r[15]).strip()], "pct": num(r[16])})
        petGain = {"stat": STAT[str(r[20]).strip()], "pct": num(r[21])} if r[20] else None
        pens = []
        petGains = [petGain] if petGain else []
        if r[22]: pens.append({"stat": STAT[str(r[22]).strip()], "pct": num(r[23])})
        if r[24] and str(r[24]).strip() in STAT:
            s2 = STAT[str(r[24]).strip()]
            if s2.startswith("petH"):  # sheet quirk (A106): 2nd pet GAIN parked in penalty column
                petGains.append({"stat": s2, "pct": num(r[25])})
            else:
                pens.append({"stat": s2, "pct": num(r[25])})
        # per-ID overrides where free text under-specifies
        aid_s = str(aid)
        reqs = norm_req(aid_s, str(bld).strip(), str(req or ""))
        if aid_s == "A015":  # Work From Home: "computer + desk + job" part of the text
            reqs += [{"kind": "ownsItem", "item": "Computer"}, {"kind": "ownsItem", "item": "Desk"}, {"kind": "hasJob"}]
        if aid_s == "A077":  # CSE Work still requires your job to BE at CSE
            reqs = [{"kind": "jobInBuilding"}]
        if aid_s == "A024":  # support cheque: fx pays it flat; drop row gain to avoid double pay
            gains = []
        fx = norm_fx(aid_s, str(bld).strip(), str(r[26] or ""), str(cat or "").strip(), str(name).strip())
        if aid_s in ("A007", "A105"):  # feeding must mark the pet fed (A007 also consumes pet food)
            fx.append({"kind": "feedPet"})
        actions.append({
            "id": aid_s, "building": BUILDING_ID[str(bld).strip()], "name": str(name).strip(),
            "category": str(cat or "").strip(), "tu": int(num(tu)), "costPct": num(costPct),
            "gains": gains, "petGains": petGains, "penalties": pens,
            "req": reqs,
            "fx": fx,
            "note": str(r[26] or "").strip(),
        })

    # ---- Items_Mall ----
    ws = wb["Items_Mall"]
    items = []
    OUTFIT_ORDER = {"Casual Clothes": 1, "Dressy Clothes": 1, "Smart Clothes": 2, "Business Clothes": 3}
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not str(row[0]).startswith("I"): continue
        req = str(row[4] or "").strip().lower()
        reqs = []
        if "luxury apartment" in req and "recommended" not in req: reqs.append({"kind": "housedLux"})
        if req == "housing": reqs.append({"kind": "notHomeless"})
        if "own pet" in req: reqs.append({"kind": "hasPet"})
        if "casual clothes" == req: reqs.append({"kind": "ownsItem", "item": "Casual Clothes"})
        if "smart clothes" == req: reqs.append({"kind": "ownsItem", "item": "Smart Clothes"})
        items.append({
            "id": str(row[0]), "group": str(row[1]).strip(), "name": str(row[2]).strip(),
            "slot": str(row[3]).strip(), "req": reqs, "costPct": num(row[5]),
            "bonus": ({"stat": STAT[str(row[9]).strip()], "pct": num(row[10])} if row[9] else None),
            "penalty": ({"stat": STAT[str(row[11]).strip()], "pct": num(row[12])} if row[11] else None),
            "effect": str(row[13] or "").strip(),
            "outfitRank": OUTFIT_ORDER.get(str(row[2]).strip(), 0),
        })

    # ---- Jobs_Named ----
    ws = wb["Jobs_Named"]
    jobs = []
    fxre = re.compile(r"([+-]\d+)\s+([A-Za-z ]+?)(?:,|$| bonus)")
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row[0] or str(row[0]).startswith("CANONICAL"): continue
        bld = str(row[0]).strip()
        if bld not in BUILDING_ID: continue
        effects = []
        for m in fxre.finditer(str(row[5] or "")):
            sname = m.group(2).strip()
            if sname in STAT: effects.append({"stat": STAT[sname], "amtT100": int(m.group(1))})
        reqtext = str(row[6] or "")
        jreq = {"clothes": None, "computer": "Computer" in reqtext, "degree": None, "stats": []}
        for c in ("Business Clothes", "Smart Clothes", "Dressy Clothes", "Casual Clothes"):
            if c in reqtext: jreq["clothes"] = c; break
        for d, key in (("Undergrad", "Undergrad"), ("Master's", "Masters"), ("PhD", "PhD")):
            if d in reqtext: jreq["degree"] = key
        for m in re.finditer(r"([A-Za-z ]+?)\s+(\d+)\+", reqtext):
            sname = m.group(1).strip()
            if sname in STAT: jreq["stats"].append({"stat": STAT[sname], "pctT": int(m.group(2)) / 100.0})
        jobs.append({
            "building": BUILDING_ID[bld], "tier": str(row[1]).strip(), "name": str(row[2]).strip(),
            "basePayT100": num(row[3]), "careerGainT100": num(row[4]),
            "effects": effects, "req": jreq, "reqText": reqtext.strip(),
        })

    # ---- Pets ----
    ws = wb["Pets"]
    pets = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        t = str(row[0] or "")
        if not t.endswith(" Pet"): continue
        code = t.replace(" Pet", "").strip()
        pets[code] = {"main": STAT[str(row[1]).strip()], "upkeep": STAT[str(row[2]).strip()]}

    # ---- Audio ----
    music = {
        "overmap": "PP-Overmap.mp3", "rentDue": "PP-OverMapRentisDue.mp3",
        "airOne": "PP-AirOneSuperMarket.mp3", "soulExchange": "PP-CorporateSoulExchangeOffice.mp3",
        "university": "PP-HighIQUniversity.mp3", "petShop": "PP-EthicalPetShop.mp3",
        "regretBurger": "PP-RegretBurger.mp3", "gym": "PP-BroScienceGym.mp3",
        "park": "PP-Park.mp3", "airport": "PP-EmotionalBaggageAirport.mp3",
        "debtstreet": "PP-DebtStreetCapital.mp3", "club": "PP-BadDecisionsClub.mp3",
        "luxury": "PP-LuxuryApartment.mp3", "lowCost": "PP-LowCostHousing.mp3",
        "mall": "PP-Mall.mp3", "temple": "PP-Temple.mp3",  # track delivered 2026-07 (gap closed)
    }
    sfx = {
        "walk": "PP-Walking.wav", "bike": "PP-BicycleBell.mp3", "car": "PP-CarAcceleration.mp3",
        "click": "PP-MenuButtonClicked.wav", "eat": "PP-EatingFastFood.mp3", "money": "PP-Money.mp3",
    }

    # ---- Buildings + map coords (positions eyeballed off the new overmap art) ----
    # pos      = building center (map hotspot fallback / labels)
    # entrance = where the DOOR meets the pavement — the walker stands/arrives here
    # doors    = road node(s) the entrance connects to (short doorstep connector);
    #            keeps the avatar on painted roads instead of cutting cross-country
    buildings = {
        "lowCost": {"name": "Low Cost Housing", "scene": "low_cost_housing.jpg", "pos": [47.3, 74.0],
                    "entrance": [48.8, 82.5], "doors": ["bvdLow"]},
        "luxury": {"name": "Luxury Apartments", "scene": "luxury_apartments.jpg", "pos": [87.3, 19.0],
                   "entrance": [86.5, 35.0], "doors": ["luxPlaza"]},
        # the park is open on all sides — walk up from any nearby stretch of the
        # ring and cross the lawn; she ends up on the fountain path
        "park": {"name": "Almost Fine Park", "scene": "park.jpg", "pos": [57.7, 44.0],
                 "entrance": [56.0, 48.0], "doors": ["parkPath", "ringSW1", "nwJoin"]},
        "airOne": {"name": "Air One Supermarket", "scene": "air_one_supermarket.jpg", "pos": [24.5, 37.0],
                   "entrance": [31.2, 40.0], "doors": ["aoFront"]},
        "regretBurger": {"name": "Regret Burger", "scene": "regret_burger.jpg", "pos": [72.7, 74.5],
                         "entrance": [74.5, 88.0], "doors": ["burgerFront"]},
        "gym": {"name": "Bro Science Gym", "scene": "bro_science_gym.jpg", "pos": [32.0, 78.0],
                "entrance": [39.2, 82.3], "doors": ["gymFront"]},
        "club": {"name": "Bad Decisions Club", "scene": None, "video": "bdc_scene.mp4", "pos": [51.7, 16.0],
                 "entrance": [62.8, 28.3], "doors": ["clubFront"]},
        "temple": {"name": "Re-Education Temple", "scene": "re_education_temple.jpg", "pos": [30.0, 57.0],
                   "entrance": [29.8, 67.5], "doors": ["templeFront"]},
        "university": {"name": "High IQ University", "scene": "high_iq_university.jpg", "pos": [33.3, 19.0],
                       "entrance": [35.2, 33.9], "doors": ["uniFront"]},
        "soulExchange": {"name": "Corporate Soul Exchange", "scene": "corporate_soul_exchange.jpg", "pos": [92.5, 51.0],
                         "entrance": [90.3, 68.3], "doors": ["soulFront"]},
        "debtstreet": {"name": "Debtstreet Capital", "scene": "debtstreet_capital.jpg", "pos": [79.7, 41.0],
                       "entrance": [76.8, 55.3], "doors": ["seTaxi"]},
        "airport": {"name": "Emotional Baggage Airport", "scene": "emotional_baggage_airport.jpg", "pos": [67.3, 14.0],
                    "entrance": [67.4, 26.5], "doors": ["airportFront"]},
        "petShop": {"name": "Ethical Pet Shop", "scene": "ethical_pet_shop.jpg", "pos": [85.7, 75.5],
                    "entrance": [84.7, 87.0], "doors": ["petFront"]},
        "mall": {"name": "Mall", "scene": "mall.jpg", "pos": [58.7, 71.5],
                 "entrance": [58.4, 86.8], "doors": ["mallFront"]},
    }

    # Road graph for the walking avatar (percent coords on the 1672x941 map).
    # The ring around the park is the OUTER gray road (color-probed radially from
    # the fountain, 2026-07-07); the tan circles inside are park footpaths. Its
    # bottom arc passes BEHIND the mall roof and the baked-in alarm-clock art.
    roadNodes = {
        # ring road (24-gon, clockwise from the top). The bottom arc rides the
        # road's visible upper edge where the mall/burger roofs overlap it.
        "ringTop": [58.0, 29.0], "clubFront": [62.9, 29.4], "airportFront": [67.0, 30.4],
        "neJunction": [70.4, 30.9], "ringNE2": [71.7, 34.5], "ringE1": [73.6, 38.6],
        "ringE2": [74.2, 43.5], "ringE3": [73.5, 48.4], "ringSE1": [72.0, 52.7],
        "seTaxi": [70.0, 56.5], "ringSE2": [67.0, 58.3], "ringSE3": [63.0, 59.8],
        "ringS": [58.8, 60.2], "ringSW1": [54.0, 60.3], "ringSW2": [48.2, 59.7],
        "ringSW3": [44.6, 57.6], "ringW1": [42.1, 54.0], "ringW2": [41.0, 49.8],
        "ringW3": [40.2, 44.3], "ringNW1": [41.2, 39.0], "ringNW2": [43.5, 34.6],
        "ringNW3": [46.2, 30.9], "nwJoin": [50.0, 31.2], "ringN0": [53.8, 29.8],
        # north-west spur from the top edge + the road past the university steps
        "nwFork": [43.8, 22.5], "nwRoad1": [45.3, 25.3], "nwRoad2": [47.6, 28.6],
        "uniRoad1": [41.8, 25.5], "uniRoad2": [39.5, 30.5], "uniFront": [36.4, 34.8],
        # west road: university -> Air One -> temple -> around the gym to the boulevard
        # the west vertical road rides the lane NEAREST THE PARK: it merges with
        # the ring at ~(42,54) and continues straight down between the gym and
        # Low Cost Housing. The temple is reached by looping back up its little
        # doorstep lane from the gym side (the through-lane dashes that grazed
        # the temple dome were stray art, patched out of overmap.jpg).
        "aoFront": [34.3, 40.3],
        "vRoad1": [38.0, 39.5], "vRoad2": [38.2, 43.0], "vRoad3": [38.1, 46.3],
        "vMerge": [39.4, 51.5],
        "swRoad1": [40.3, 58.5], "swRoad2": [40.3, 63.0], "swRoad3": [39.8, 68.0],
        "swRoad4": [39.3, 73.5],
        "templeFront": [32.8, 65.5],
        "gymBend1": [34.5, 70.8], "gymBend2": [37.0, 74.5], "gymFront": [42.0, 81.0],
        "gymCorner": [41.3, 88.1],
        # west connector road + the park's tan gate path (west side)
        "parkPath": [44.8, 45.5],
        # bottom boulevard (partly behind the baked-in alarm-clock art + HUD buttons)
        "bvdLow": [47.5, 87.8], "bvdClock": [52.5, 88.0], "bvdJoin": [56.0, 88.6],
        "mallFront": [58.3, 89.3], "bvdMid1": [64.5, 90.8], "burgerFront": [74.8, 90.8],
        "bvdMid2": [78.5, 91.3], "petFront": [84.8, 90.3], "bvdEast": [88.2, 85.7],
        # Luxury's approach: the road that climbs from the NE crosswalk and slips
        # BEHIND Debtstreet's rooftop sign into the Heelton Heights forecourt
        "luxRoad1": [72.8, 28.8], "luxRoad2": [75.5, 26.0], "luxRoad3": [79.5, 26.8],
        "luxPlaza": [83.5, 30.0],
        # east road: ring (taxi corner) -> Soul Exchange -> down past the Pet Shop
        "eRoad1": [76.0, 57.9], "eRoad2": [77.5, 60.5], "eRoad3": [80.2, 60.9],
        "eRoad4": [84.9, 63.2], "soulFront": [88.8, 67.0],
        "petRight1": [93.0, 72.0], "petRight2": [93.3, 75.5], "petRight3": [92.3, 79.5],
        "petRight4": [89.7, 83.3],
    }
    _ring = ["ringTop", "clubFront", "airportFront", "neJunction", "ringNE2", "ringE1",
             "ringE2", "ringE3", "ringSE1", "seTaxi", "ringSE2", "ringSE3", "ringS",
             "ringSW1", "ringSW2", "ringSW3", "ringW1", "ringW2", "ringW3", "ringNW1",
             "ringNW2", "ringNW3", "nwJoin", "ringN0", "ringTop"]
    roadEdges = [[_ring[i], _ring[i + 1]] for i in range(len(_ring) - 1)] + [
        # NW spur + university/west road
        ["nwFork", "nwRoad1"], ["nwRoad1", "nwRoad2"], ["nwRoad2", "nwJoin"],
        ["nwFork", "uniRoad1"], ["uniRoad1", "uniRoad2"], ["uniRoad2", "uniFront"],
        ["uniFront", "vRoad1"], ["vRoad1", "aoFront"], ["aoFront", "vRoad2"],
        ["vRoad1", "vRoad2"], ["vRoad2", "vRoad3"], ["vRoad3", "vMerge"],
        ["vMerge", "ringW1"],
        ["ringW1", "swRoad1"], ["swRoad1", "swRoad2"], ["swRoad2", "swRoad3"],
        ["swRoad3", "swRoad4"], ["swRoad4", "gymFront"],
        ["templeFront", "gymBend1"], ["gymBend1", "gymBend2"], ["gymBend2", "gymFront"],
        ["gymFront", "gymCorner"], ["gymCorner", "bvdLow"],
        ["vRoad3", "ringW3"], ["ringW3", "parkPath"],
        # bottom boulevard
        ["bvdLow", "bvdClock"], ["bvdClock", "bvdJoin"], ["bvdJoin", "mallFront"],
        ["mallFront", "bvdMid1"], ["bvdMid1", "burgerFront"], ["burgerFront", "bvdMid2"],
        ["bvdMid2", "petFront"], ["petFront", "bvdEast"],
        # Luxury road (behind Debtstreet's roof), east road, pet-shop right road
        ["neJunction", "luxRoad1"], ["luxRoad1", "luxRoad2"], ["luxRoad2", "luxRoad3"],
        ["luxRoad3", "luxPlaza"],
        ["seTaxi", "eRoad1"], ["eRoad1", "eRoad2"], ["eRoad2", "eRoad3"], ["eRoad3", "eRoad4"],
        ["eRoad4", "soulFront"], ["soulFront", "petRight1"], ["petRight1", "petRight2"],
        ["petRight2", "petRight3"], ["petRight3", "petRight4"], ["petRight4", "bvdEast"],
    ]

    data = {
        "settings": settings, "personalities": personalities, "actions": actions,
        "items": items, "jobs": jobs, "pets": pets, "music": music, "sfx": sfx,
        "buildings": buildings, "roadNodes": roadNodes, "roadEdges": roadEdges,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// GENERATED by scripts/build_data.py from Personality_Panic_Balance_Lock_v2-2.xlsx\n")
        f.write("// Do not hand-edit numbers here; edit the spreadsheet and re-run the script.\n")
        f.write("var PP_DATA = ")
        f.write(json.dumps(data, indent=1))
        f.write(";\nif (typeof window !== 'undefined') window.PP_DATA = PP_DATA;\n")
        f.write("if (typeof module !== 'undefined') module.exports = PP_DATA;\n")
    print("actions:", len(actions), "items:", len(items), "jobs:", len(jobs),
          "pets:", len(pets), "personalities:", len(personalities))
    print("wrote", os.path.abspath(OUT))

if __name__ == "__main__":
    main()
