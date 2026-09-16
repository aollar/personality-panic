"""
Personality Panic — data pipeline.
Reads Personality_Panic_Balance_Lock_v5.xlsx (single source of truth for numbers)
and emits assets/data/gamedata.js (window.PP_DATA) with normalized, structured
requirements/effects so the engine never parses free text at runtime.

Anything NOT in the spreadsheet lives in js/assumptions.js (hand-written), not here.
Re-run after any spreadsheet change:  python scripts/build_data.py
"""
import json, os, re
import openpyxl

XLSX = r"C:\Users\aloss\OneDrive\Desktop\Personality Panic\Personality_Panic_Balance_Lock_v5.xlsx"
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
    if "requires fridge" in tl or "fridge required" in tl or tl == "fridge": add("fridge")
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
    if "critical thinking threshold" in tl:
        add("statGte", stat="critical", pctT=0.30)
    if action_id in ("A062", "A063"): add("myCamp")   # advanced temple actions gated by My Camp
    if action_id == "A058":  # Buy My Camp: one copy per lifetime of doubt (Austin 2026-07-09)
        add("notFlag", flag="myCamp", msg="You already own My Camp")
    # v5: 1-week groceries need NO fridge; only the 2- and 4-week bulk options do
    # (supersedes the 2026-07-09 "all groceries need a fridge" override).
    if action_id == "A109": add("notFlag", flag="pitaContacted", msg="You already reported the shop (once per game)")
    if action_id == "A090": add("noLoan")
    if action_id == "A119": add("hasHolding")
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
    if "stores 2 weeks of food" in u: add("foodSupply", weeks=2)
    if "better food efficiency at home" in u: add("foodSupply", weeks=2, premium=True)
    if "unlocks pet system" in u: add("adoptPet")
    if "prevents pet hunger warning" in u: add("petFood", feedings=4)  # feedings = ASSUMPTION
    if "passive pet happiness" in u: add("petToy")
    if action_id == "A120": add("attendCourse")   # v5 Education_Paths (engine reads DATA.education)
    if "selects current job tier" in u: add("openJobDialog")
    if "lose job tier until rehired" in u: add("quitJob")
    if "keeps player housed" in u: add("payRent", tier="low")
    if "keeps luxury apartment" in u: add("payRent", tier="lux")
    if "enough for casual clothes" in u: add("supportCheque")
    if "survive turn" in u: add("sleepRough")
    if "unlocks advanced temple actions" in u: add("unlock", flag="myCamp")
    # v4 investment lifecycle (Investments sheet): buys open a held position
    ASSET = {"A085": "savings", "A086": "bonds", "A087": "stocks", "A088": "crypto"}
    if action_id in ASSET: add("buyAsset", asset=ASSET[action_id])
    if action_id == "A119": add("cashOut")
    if action_id == "A089": add("informed")
    if action_id == "A090": add("loan", payments=4)
    if action_id == "A108": add("unlock", flag="bribedInspector")
    if action_id == "A109": add("unlock", flag="pitaContacted")
    if "reduces bad travel event chance" in u: add("unlock", flag="travelInsurance")
    if "see items_mall" in u:
        cat = {"A112": "Transportation", "A113": "Electronics/Appliances",
               "A114": "Furniture", "A115": "Clothing"}[action_id]
        add("openShop", group=cat)
    if "uses owned furniture bonus" in u: pass
    return fx

def num(v):
    if v is None or v == "": return 0.0
    try: return float(v)
    except (TypeError, ValueError): return 0.0

# ---------------------------------------------------------------------------
# Weekend Update card system (v3 Cards sheet).
# Status cards are ENGINE-TRIGGERED (their rows here supply display text);
# investment cards resolve per held asset per turn; exactly 1 event card is
# drawn per turn using the standing weights below. Redraw on unmet requirement.
# ---------------------------------------------------------------------------
CARD_REQ = {
    "none": [],
    "owns car": [{"kind": "ownsItem", "item": "Car"}],
    "owns bicycle": [{"kind": "ownsItem", "item": "Bicycle"}],
    "owns fridge": [{"kind": "ownsItem", "item": "Fridge"}],
    "owns any tech item": [{"kind": "ownsAnyTech"}],
    "owns any tech or appliance": [{"kind": "ownsAnyTechOrAppliance"}],
    "employed": [{"kind": "hasJob"}],
    "not homeless": [{"kind": "notHomeless"}],
    "has living pet": [{"kind": "hasPet"}],
    "has living pet + any furniture or tech": [{"kind": "hasPet"}, {"kind": "ownsAnyFurnOrTech"}],
    "ate at regret burger last turn": [{"kind": "prevAteRegret"}],
    "visited bro science gym last turn": [{"kind": "prevGym"}],
}
# Effects the free text under-specifies, keyed by card ID (parsed stats still apply):
CARD_FX = {
    "E07": [{"kind": "forceWalk"}],          # transport counts as Walking this turn
    "E11": [{"kind": "clearFood"}],          # stored groceries spoiled
    "E25": [{"kind": "rentMod", "mult": 1.25}],
    "E26": [{"kind": "rentMod", "mult": 0.5}],
}
STAT_RE = re.compile(
    r"(Money|Health|Career|Connection|Happiness|Coolness|Critical Thinking|Enlightenment"
    r"|Pet Happiness|Pet Health)\s*(\+/-|[+-])\s*\w+\s*\((\d+(?:\.\d+)?)%[TB]\)")
# v4+ investment cards print effects as "Money +15%B" / "Money +5%B or -5%B"
STAT_RE_B = re.compile(
    r"(Money|Health|Career|Connection|Happiness|Coolness|Critical Thinking|Enlightenment"
    r"|Pet Happiness|Pet Health)\s*([+-])(\d+(?:\.\d+)?)%B")
# The v5 workbook lost E30's row contents (ID only). Restore it from v3 so the
# 30-card event deck stays intact.
CARD_FALLBACK = {
    "E30": ["E30", "NEIGHBORHOOD POTLUCK", "Event", "Positive", "Minor", "Not homeless",
            "Connection +Tiny (2.5%T), Happiness +Tiny (2.5%T)", "You brought napkins and it was enough."],
}

def odds_pct(v):
    """'45%' / '5% (destroys holding)' / 0.45 -> 0.45"""
    if v is None: return 0.0
    if isinstance(v, (int, float)): return float(v) if v <= 1 else float(v) / 100.0
    m = re.match(r"\s*(\d+(?:\.\d+)?)\s*%", str(v))
    return float(m.group(1)) / 100.0 if m else 0.0

def odds_flat(v):
    m = re.search(r"flat\s*(\d+(?:\.\d+)?)\s*%", str(v or ""))
    return float(m.group(1)) / 100.0 if m else 0.0

def parse_weekend(wb):
    ws = wb["Cards"]
    rows = [[c for c in r] for r in ws.iter_rows(values_only=True)]
    cards, weights, invest_odds = [], {}, {}
    STAND_KEY = {"last place": "last", "2nd / 3rd place": "mid", "2nd / 3rd": "mid", "1st place": "first"}
    in_list = False
    for r in rows:
        c0 = str(r[0]).strip() if r[0] is not None else ""
        # standing weights block: Last/2nd/1st rows follow the header row
        if c0.lower() in STAND_KEY and not in_list and r[1] is not None and num(r[1]) <= 1:
            if c0.lower() in ("last place", "2nd / 3rd place", "1st place"):
                weights[STAND_KEY[c0.lower()]] = {
                    "majPos": num(r[1]), "minPos": num(r[2]),
                    "minNeg": num(r[3]), "majNeg": num(r[4])}
                continue
        # investment odds block: Asset | Standing | BG SG SL BL(+ "flat N%")
        # -> [bigGain, smallGain, smallLoss, bigLoss, flat]
        if c0 in ("Crypto", "Stocks") and r[1] is not None:
            key = str(r[1]).strip().lower()
            invest_odds.setdefault(c0.lower(), {})[STAND_KEY.get(key, key)] = [
                odds_pct(r[2]), odds_pct(r[3]), odds_pct(r[4]), odds_pct(r[5]), odds_flat(r[5])]
            continue
        if c0 in ("Bonds", "Savings"):
            invest_odds[c0.lower()] = "safe"
            continue
        if c0 == "ID":
            in_list = True
            continue
        if in_list and re.match(r"^[SIE]\d\d$", c0):
            _id, name, typ, pol, mag, req, eff, flav = [
                ("" if v is None else str(v).strip()) for v in r[:8]]
            if not name and c0 in CARD_FALLBACK:
                _id, name, typ, pol, mag, req, eff, flav = CARD_FALLBACK[c0]
            stats = []
            for m in STAT_RE_B.finditer(eff):
                pct = float(m.group(3)) / 100.0
                stats.append({"stat": STAT[m.group(1)], "pct": pct if m.group(2) == "+" else -pct})
            for m in STAT_RE.finditer(eff):
                pct = float(m.group(3)) / 100.0
                sign = m.group(2)
                if sign == "+/-": sign = "+"   # swing cards: magnitude only, sign from odds
                stats.append({"stat": STAT[m.group(1)], "pct": pct if sign == "+" else -pct})
            card = {
                "id": _id, "name": name, "type": typ.lower(),
                "polarity": pol.lower(), "magnitude": mag.lower() if mag and mag != "—" else "",
                "req": CARD_REQ.get(req.lower(), []) if typ == "Event" else [],
                "stats": stats, "fx": CARD_FX.get(_id, []),
                "flavor": flav, "effectText": eff,
            }
            if typ == "Event":
                cls = ("maj" if card["magnitude"] == "major" else "min") + \
                      ("Pos" if card["polarity"] == "positive" else "Neg")
                card["cls"] = cls
            cards.append(card)
    # Which card face shows for each investment outcome (Investments + Cards
    # sheets, v4): crypto I01 / I03 (+/-) / I02 RUG PULL (destroys the holding,
    # no Money delta); stocks I04 / I06 / I09 flat / I05 / I10 MARKET CRASH.
    # Values are %B.
    by_id = {c["id"]: c for c in cards}
    def mag(cid, sign=1):
        pcts = [s["pct"] for s in by_id[cid]["stats"] if s["stat"] == "money"]
        return abs(pcts[0]) * sign if pcts else 0.0
    invest_fx = {
        "crypto":  {"bigGain": ["I01", mag("I01")], "smallGain": ["I03", mag("I03")],
                    "smallLoss": ["I03", -mag("I03")], "bigLoss": ["I02", 0.0, "destroy"]},
        "stocks":  {"bigGain": ["I04", mag("I04")], "smallGain": ["I06", mag("I06")],
                    "flat": ["I09", 0.0],
                    "smallLoss": ["I05", -mag("I05")], "bigLoss": ["I10", -mag("I10")]},
        "bonds":   {"pay": ["I07", mag("I07")]},
        "savings": {"pay": ["I08", mag("I08")]},
    }
    for k in ("I01", "I03", "I04", "I05", "I06", "I07", "I08", "I10"):
        assert mag(k) > 0, "investment card %s has no Money effect" % k
    # Upkeep penalties (Settings "UPKEEP TIME PENALTIES" block). v2-4: values are
    # FRACTIONS of the turn's Time Units (0.25 = lose 25% of next turn's TU) and
    # stress also costs Health + Happiness. Legacy absolute values (>1) are read
    # as a fraction of a 40-TU turn so an old sheet still loads sanely.
    # The v5 workbook was built from an older v3 copy and still prints the
    # legacy absolute values (Hunger -4 / Stress -2 TU). Those are IGNORED so
    # the harsher v2-4 percentages chosen 2026-07-20 stay in force.
    pen = {"hungerPct": 0.25, "stressPct": 0.15, "stressHappinessPct": 0.05, "stressHealthPct": 0.05}
    for r in wb["Settings"].iter_rows(values_only=True):
        label = str(r[0]) if r[0] else ""
        v = abs(num(r[1]))
        if v > 1: continue                # legacy absolute TU value: keep the v2-4 fraction
        if label.startswith("Hunger"): pen["hungerPct"] = v
        elif label.startswith("Stress Happiness"): pen["stressHappinessPct"] = v
        elif label.startswith("Stress Health"): pen["stressHealthPct"] = v
        elif label.startswith("Stress"): pen["stressPct"] = v
    assert len([c for c in cards if c["type"] == "event"]) == 30, "expected 30 event cards"
    assert len(weights) == 3 and "crypto" in invest_odds, "weights/odds blocks not parsed"
    return {
        "statusTu": dict(pen, minTu=1),
        "weights": weights, "investOdds": invest_odds, "investFx": invest_fx,
        "cards": cards,
    }

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
        "gameLengths": {"short": 100, "medium": 500, "long": 1000},   # T = stat cap / endgame threshold ONLY
        "economyBase": {"short": 100, "medium": 250, "long": 350},    # B = base every %B resolves against (v4)
        "timeUnitsPerTurn": 40,
        "baseTimeUnits": 40,  # costs used AS AUTHORED (1-3 TU): 40 TU/turn = many actions per day (Austin 2026-07-06)
        "rentIntervalTurns": 4,
        "turnTimerOptions": [30, 60, 90, 120, 0],  # 0 = Unlimited
        "maxPlayers": 4, "minParticipants": 2,
        "incomeMultiplierCap": 1.25,
        "modifiers": mods,
        "mainStats": MAIN_STATS, "upkeepStats": UPKEEP_STATS,
    }

    for r in wb["Settings"].iter_rows(values_only=True):
        label = str(r[0] or "")
        for mode in ("Short", "Medium", "Long"):
            if label.startswith(mode + " Game T"): settings["gameLengths"][mode.lower()] = int(num(r[1]))
            if label.startswith(mode + " Game B"): settings["economyBase"][mode.lower()] = int(num(r[1]))

    # ---- Actions_Master ----
    ws = wb["Actions_Master"]
    actions = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not str(row[0]).startswith("A"): continue
        if "REMOVED" in str(row[28] or ""): continue   # v5: Take Class / degrees / Ask for Promotion
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
        if aid_s == "A024":  # support cheque: fx pays the sheet amount; drop row gain to avoid double pay
            cheque_pct = gains[0]["pct"] if gains else 2.0
            gains = []
        if aid_s == "A090":  # Lifestyle Loan: the -5%B penalty is the per-turn repayment, not an instant hit
            loan_pct = pens[0]["pct"] if pens else 0.05
            pens = []
        if aid_s == "A120":  # Attend Course: gains/costs come from Education_Paths per course
            gains = []
        fx = norm_fx(aid_s, str(bld).strip(), str(r[26] or ""), str(cat or "").strip(), str(name).strip())
        for f in fx:
            if f["kind"] == "supportCheque": f["pct"] = cheque_pct
            if f["kind"] == "loan": f["pct"] = loan_pct
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
    hdr = [str(h or "").strip() for h in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]
    col = {h: i for i, h in enumerate(hdr)}
    TRIGGERS = [("one-time on purchase", "purchase"), ("sleep", "sleep"), ("relax", "relax"),
                ("work-from-home", "workFromHome"), ("play-with-pet", "playPet"), ("exercise", "exercise")]
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0] or not re.match(r"^I\d{3}$", str(row[0])): continue
        g = lambda name: row[col[name]] if name in col and col[name] < len(row) else None
        req = str(g("Requirement") or "").strip().lower()
        housing = str(g("Housing Requirement") or "Any").strip().lower()
        reqs = []
        # v4 housing gates: 'Low Cost OK' needs a home; 'Luxury only' needs Heelton Heights
        if housing.startswith("luxury"): reqs.append({"kind": "housedLux"})
        elif housing.startswith("low cost"): reqs.append({"kind": "notHomeless"})
        if "own pet" in req: reqs.append({"kind": "hasPet"})
        if req in ("tv owned", "tv"): reqs.append({"kind": "ownsItem", "item": "TV"})
        if "casual clothes" == req: reqs.append({"kind": "ownsItem", "item": "Casual Clothes"})
        if "smart clothes" == req: reqs.append({"kind": "ownsItem", "item": "Smart Clothes"})
        # v5 flat trigger bonus ("Health +3") fired by a home action; the sheet
        # shifted a couple of rows one column right, so only accept real triggers
        trig_text = str(g("Bonus Trigger (v5)") or "").strip().lower()
        flat_text = str(g("Flat Bonus (Short) (v5)") or "").strip()
        trigger = None
        m = re.match(r"^(.+?)\s*\+(\d+)$", flat_text)
        if m and m.group(1) in STAT:
            for key, kind in TRIGGERS:
                if key in trig_text:
                    trigger = {"on": kind, "stat": STAT[m.group(1)], "pts": int(m.group(2))}
                    break
        bonus_stat = g("Stat Bonus")
        items.append({
            "id": str(row[0]), "group": str(g("Shop / Group")).strip(), "name": str(g("Item")).strip(),
            "slot": str(g("Slot")).strip(), "req": reqs, "costPct": num(g("Cost %B")),
            "housing": "lux" if housing.startswith("luxury") else ("home" if housing.startswith("low cost") else "any"),
            # triggered home fixtures carry no % bonus (v5); everything else keeps its one-time grant
            "bonus": ({"stat": STAT[str(bonus_stat).strip()], "pct": num(g("Bonus %"))}
                      if bonus_stat and str(bonus_stat).strip() in STAT and num(g("Bonus %")) > 0 and not trigger else None),
            "penalty": None,   # v5: every mall stat penalty removed
            "trigger": trigger,
            "effect": str(g("Unlock / Effect") or "").strip(),
            "outfitRank": OUTFIT_ORDER.get(str(g("Item")).strip(), 0),
        })
    assert sum(1 for it in items if it["trigger"]) == 16, "expected 16 v5 trigger bonuses"

    # ---- Jobs_Named ----
    ws = wb["Jobs_Named"]
    jobs = []
    fxre = re.compile(r"([+-]\d+)\s+([A-Za-z ]+?)(?:,|$| bonus)")
    for row in ws.iter_rows(min_row=3, values_only=True):
        if not row[0] or str(row[0]).startswith("CANONICAL"): continue
        bld = str(row[0]).strip()
        if bld not in BUILDING_ID: continue
        if row[1] is None or str(row[1]).strip() == "Tier": continue
        effects = []
        for m in fxre.finditer(str(row[5] or "")):
            sname = m.group(2).strip()
            if sname in STAT: effects.append({"stat": STAT[sname], "amtT100": int(m.group(1))})
        reqtext = str(row[6] or "")
        jreq = {"clothes": None, "computer": "Computer" in reqtext, "degree": None, "stats": []}
        for c in ("Business Clothes", "Smart Clothes", "Dressy Clothes", "Casual Clothes"):
            if c in reqtext: jreq["clothes"] = c; break
        # v5: degrees are replaced by education PATHS (Education_Paths sheet);
        # the path + work-click gate is enforced per tier (Job_Progression).
        pm = re.search(r"Path\s*(\d)", str(row[10] or ""))
        jreq["path"] = int(pm.group(1)) if pm else 0
        for m in re.finditer(r"([A-Za-z ]+?)\s+(\d+)\+", reqtext):
            sname = m.group(1).strip()
            if sname in STAT: jreq["stats"].append({"stat": STAT[sname], "pctT": int(m.group(2)) / 100.0})
        tier = str(row[1]).strip()
        jobs.append({
            "building": BUILDING_ID[bld], "tier": tier, "name": str(row[2]).strip(),
            "progressTier": "Max" if tier == "Max+" else tier,   # Wolf of Debtstreet pays/gates as Max
            "basePayT100": num(row[3]), "careerGainT100": num(row[4]),
            "effects": effects, "req": jreq, "reqText": reqtext.strip(),
        })

    # ---- Education_Paths (v5): 5 paths x 6 courses ----
    ws = wb["Education_Paths"]
    paths = {}
    for row in ws.iter_rows(min_row=3, values_only=True):
        if str(row[0] or "").startswith("PATH TOTALS"): break
        if not isinstance(row[0], (int, float)) or not isinstance(row[2], (int, float)): continue
        n = int(row[0])
        pth = paths.setdefault(n, {"path": n, "name": str(row[1]).strip(), "unlocksTier": str(row[7]).strip(), "courses": []})
        pth["courses"].append({
            "id": "P%dC%d" % (n, int(row[2])), "path": n, "index": int(row[2]),
            "name": str(row[3]).strip(), "costPct": num(row[5]), "clicks": int(num(row[6])),
            "gains": [{"stat": "critical", "pct": num(row[8])}, {"stat": "career", "pct": num(row[9])}],
        })
    education = [paths[k] for k in sorted(paths)]
    assert len(education) == 5 and all(len(p["courses"]) == 6 for p in education), "expected 5 paths x 6 courses"

    # ---- Job_Progression (v5): work clicks per tier + education path ----
    ws = wb["Job_Progression"]
    tiers, order = {}, []
    TIER_NAMES = ("Low", "Low+", "Mid", "Mid+", "High", "Max")
    for row in ws.iter_rows(min_row=2, values_only=True):
        t = str(row[0] or "").strip()
        if t not in TIER_NAMES or t in tiers or not isinstance(row[4], (int, float)): continue
        routes = []
        for cell in (row[1], row[2]):
            m = re.search(r"(\d+)\s*clicks at\s*(Low\+|Low|Mid\+|Mid|High)", str(cell or ""))
            if m: routes.append({"tier": m.group(2), "clicks": int(m.group(1))})
        pm = re.search(r"Path\s*(\d)", str(row[3] or ""))
        tiers[t] = {"tier": t, "routes": routes, "path": int(pm.group(1)) if pm else 0,
                    "payPct": num(row[5])}
        order.append(t)
    assert order == list(TIER_NAMES), "Job_Progression tiers not parsed: %r" % order
    assert tiers["Mid"]["routes"] == [{"tier": "Low+", "clicks": 15}, {"tier": "Low", "clicks": 20}], tiers["Mid"]
    job_progression = {"order": order, "tiers": tiers}

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

    # ---- Buildings + map coords (re-traced 2026-07-19 for Austin's NEW map art,
    # "Game Map (12)": full city redesign — central park roundabout + bottom
    # boulevard + left S-road. Baked fake HUD occupies x 0-19 (real HUD covers it).
    # pos      = building center (map hotspot fallback / labels)
    # entrance = where the DOOR meets the pavement — the walker stands/arrives here
    # doors    = road node(s) the entrance connects to
    buildings = {
        "lowCost": {"name": "Low Cost Housing", "scene": "low_cost_housing.jpg", "pos": [44.5, 72.0],
                    "entrance": [45.4, 81.1], "doors": ["lowFront"], "exit": "lowFront"},
        "luxury": {"name": "Luxury Apartments", "scene": "luxury_apartments.jpg", "pos": [86.5, 15.0],
                   "entrance": [84, 34.8], "doors": ["n7"], "exit": "n7"},
        # the park is the roundabout's island — open entry from any ring stretch
        "park": {"name": "Almost Fine Park", "scene": "park.jpg", "pos": [55.0, 40.0],
                 "entrance": [57.5, 59.5], "doors": ["rS1", "rS2"],
                 "entrances": [[57.5, 59.5], [52, 31.7], [64.7, 33], [64.4, 55.7], [45.6, 57.8], [40.5, 40]],
                 "entranceDoors": [["rS1", "rS2"], ["clubFront", "rNW1b", "rTop"], ["n3", "rNE2"], ["rS1", "rSE2"], ["rSW1", "rSW2"], ["rNW1", "rW2"]]},
        "airOne": {"name": "Air One Supermarket", "scene": "air_one_supermarket.jpg", "pos": [22.3, 33.0],
                   "entrance": [24.6, 47.5], "doors": ["n1"], "exit": "n1"},
        "regretBurger": {"name": "Regret Burger", "scene": "regret_burger.jpg", "pos": [69.0, 73.0],
                         "entrance": [70.4, 84.6], "doors": ["burgerFront"], "exit": "burgerFront"},
        "gym": {"name": "Bro Science Gym", "scene": "bro_science_gym.jpg", "pos": [28.5, 77.0],
                "entrance": [29.9, 92.9], "doors": ["bW1"], "exit": "bW1"},
        "club": {"name": "Bad Decisions Club", "scene": None, "video": "bdc_scene.mp4", "pos": [47.5, 13.0],
                 "entrance": [49.4, 23.6], "doors": ["clubFront"], "exit": "clubFront"},
        "temple": {"name": "Re-Education Temple", "scene": "re_education_temple.jpg", "pos": [26.0, 52.0],
                   "entrance": [28.7, 67.8], "doors": ["n2"], "exit": "n2"},
        "university": {"name": "High IQ University", "scene": "high_iq_university.jpg", "pos": [28.5, 15.0],
                       "entrance": [32, 28.9], "doors": ["uniFront"], "exit": "uniFront"},
        "soulExchange": {"name": "Corporate Soul Exchange", "scene": "corporate_soul_exchange.jpg", "pos": [91.5, 43.0],
                         "entrance": [91.3, 63.6], "doors": ["n17"], "exit": "n17"},
        "debtstreet": {"name": "Debtstreet Capital", "scene": "debtstreet_capital.jpg", "pos": [74.3, 38.0],
                       "entrance": [76.8, 52.9], "doors": ["debtFront"], "exit": "debtFront"},
        "airport": {"name": "Emotional Baggage Airport", "scene": "emotional_baggage_airport.jpg", "pos": [64.5, 12.0],
                    "entrance": [64.5, 25.1], "doors": ["n3", "rNE2", "rTop"], "exit": "n3"},
        "petShop": {"name": "Ethical Pet Shop", "scene": "ethical_pet_shop.jpg", "pos": [82.5, 76.0],
                    "entrance": [83, 88.1], "doors": ["n13"], "exit": "n13"},
        "mall": {"name": "Mall", "scene": "mall.jpg", "pos": [56.0, 72.0],
                 "entrance": [56.5, 82.1], "doors": ["n9"], "exit": "n9"},
    }

    # Road graph for the walking avatar (percent coords on the 1672x941 map).
    # NEW ART: one ring road circles Almost Fine Park; a boulevard runs along the
    # bottom; the left side is an S-road university -> Air One -> temple -> gym.
    roadNodes = {
        "rTop": [56.9, 29.1],
        "rNE2": [68.6, 32.6],
        "rE1": [71.2, 36.5],
        "rE2": [72.5, 43],
        "rSE1": [71.8, 49],
        "rSE2": [68.1, 56.5],
        "rS1": [63.3, 63.1],
        "rS2": [54.6, 64.4],
        "rSW1": [48.2, 63.2],
        "rSW2": [42.1, 60.7],
        "rW1": [38.2, 50.2],
        "rW2": [38.4, 41.3],
        "rNW1": [40.7, 35.8],
        "rNW1b": [43.9, 32.9],
        "clubFront": [51.2, 29],
        "uniFront": [34.1, 35.5],
        "leftRd1": [33.6, 41.7],
        "swC1": [39.8, 64.6],
        "swC2": [38.3, 70.6],
        "swC3": [37.5, 80],
        "bW1": [34.2, 94.8],
        "bJ1": [38.5, 88],
        "lowFront": [44.5, 87.5],
        "b2": [50, 93.9],
        "b3": [62.9, 94.8],
        "burgerFront": [70.1, 90.4],
        "b4": [76.6, 95.4],
        "b5": [89.7, 94.6],
        "bE": [94.9, 89.6],
        "eR1": [96.5, 79.2],
        "eR2": [92.1, 74.2],
        "sW1": [82, 66.2],
        "mE1": [74, 70],
        "debtFront": [74.9, 59.5],
        "dLux1": [74.3, 33.4],
        "n1": [30.8, 46.6],
        "n2": [32.4, 73.5],
        "n3": [63.4, 29.7],
        "n4": [35.5, 50.5],
        "n6": [38.5, 56.9],
        "n7": [80.6, 35.5],
        "n9": [56.1, 88.3],
        "n13": [82.9, 94.6],
        "n14": [71.4, 56.5],
        "n17": [89.9, 69.5],
        "n10": [39.7, 92.7],
        "n12": [69.3, 60.4],
    }
    roadEdges = [
        ["rNE2", "rE1"],
        ["rE1", "rE2"],
        ["rE2", "rSE1"],
        ["rSE1", "rSE2"],
        ["rSE2", "rS1"],
        ["rS1", "rS2"],
        ["rS2", "rSW1"],
        ["rSW1", "rSW2"],
        ["rSW2", "rW1"],
        ["rW1", "rW2"],
        ["rW2", "rNW1"],
        ["rNW1", "rNW1b"],
        ["uniFront", "leftRd1"],
        ["rSW2", "swC1"],
        ["swC1", "swC2"],
        ["swC2", "swC3"],
        ["swC3", "bJ1"],
        ["bW1", "bJ1"],
        ["b5", "bE"],
        ["bE", "eR1"],
        ["eR1", "eR2"],
        ["debtFront", "sW1"],
        ["rNE2", "dLux1"],
        ["uniFront", "rW2"],
        ["n1", "leftRd1"],
        ["swC2", "n2"],
        ["rNW1b", "clubFront"],
        ["clubFront", "rTop"],
        ["n3", "rTop"],
        ["n4", "n1"],
        ["n4", "n6"],
        ["n6", "swC1"],
        ["n1", "rW1"],
        ["bJ1", "lowFront"],
        ["lowFront", "b2"],
        ["b2", "n9"],
        ["debtFront", "n14"],
        ["n14", "rSE1"],
        ["rSE2", "n14"],
        ["n9", "b3"],
        ["b3", "b2"],
        ["b3", "burgerFront"],
        ["b4", "burgerFront"],
        ["b3", "b4"],
        ["b4", "n13"],
        ["n13", "b5"],
        ["rE1", "dLux1"],
        ["n17", "eR2"],
        ["n17", "sW1"],
        ["uniFront", "rW1"],
        ["n4", "uniFront"],
        ["n6", "rW1"],
        ["n1", "rW2"],
        ["n3", "rNE2"],
        ["n7", "dLux1"],
        ["n2", "swC3"],
        ["rSW1", "swC1"],
        ["bJ1", "n10"],
        ["n10", "b2"],
        ["bW1", "n10"],
        ["n10", "lowFront"],
        ["rS1", "n12"],
        ["n12", "debtFront"],
    ]

    data = {
        "settings": settings, "personalities": personalities, "actions": actions,
        "items": items, "jobs": jobs, "pets": pets, "music": music, "sfx": sfx,
        "buildings": buildings, "roadNodes": roadNodes, "roadEdges": roadEdges,
        "weekend": parse_weekend(wb),
        "education": education, "jobProgression": job_progression,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// GENERATED by scripts/build_data.py from Personality_Panic_Balance_Lock_v5.xlsx\n")
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
