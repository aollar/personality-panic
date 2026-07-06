# Round-3 UI: pet pictures + hover, homeless re-house buttons, numeric shop
# text, wide-chip overlays aligned to the generated card.
import io

def patch(path, pairs):
    s = io.open(path, encoding="utf-8").read()
    for tag, old, new in pairs:
        assert old in s, "MISSING " + path + ": " + tag
        s = s.replace(old, new)
    io.open(path, "w", encoding="utf-8").write(s)
    print(path, "OK")

patch("js/ui.js", [
# ---- pet dialog: picture + hover description ----
("pet dialog",
"""  function openPetChoice(actionId) {
    var p = activeP();
    $("#pet-grid").innerHTML = Object.keys(DATA.pets).map(function (code) {
      var pet = DATA.pets[code], pp = per(code);
      return '<button class="shop-item" data-code="' + code + '">' +
        '<div class="s-name">' + pp.name.replace("The ", "") + " Pet</div>" +
        '<div class="s-fx">boosts ' + E.statName(pet.main) + " & " + E.statName(pet.upkeep) + "</div></button>";
    }).join("");""",
"""  var PET_EMOJI = { ENFP: "\\ud83d\\udc15", ESTP: "\\ud83e\\udd8a", ENTP: "\\ud83e\\udd9c", ESFP: "\\ud83e\\udda9",
    ENFJ: "\\ud83d\\udc2c", ESFJ: "\\ud83d\\udc08", ENTJ: "\\ud83e\\udd85", ESTJ: "\\ud83d\\udc3a",
    INTJ: "\\ud83e\\udd89", ISTJ: "\\ud83d\\udc22", ISFJ: "\\ud83d\\udc30", INFJ: "\\ud83e\\udd8c",
    INFP: "\\ud83e\\udd84", ISFP: "\\ud83d\\udc39", ISTP: "\\ud83e\\udd8e", INTP: "\\ud83d\\udc19" };
  function openPetChoice(actionId) {
    var p = activeP();
    $("#pet-grid").innerHTML = Object.keys(DATA.pets).map(function (code) {
      var pet = DATA.pets[code], pp = per(code);
      // real pet art drops in via assets/pets/<code>.png later; emoji until then
      return '<button class="shop-item pet-card" data-code="' + code + '">' +
        '<div class="pet-pic">' + (PET_EMOJI[code] || "\\ud83d\\udc3e") + "</div>" +
        '<div class="s-name">' + pp.name.replace("The ", "") + " Pet</div>" +
        '<div class="pet-hover">Boosts <b>' + E.statName(pet.main) + "</b> & <b>" + E.statName(pet.upkeep) + "</b>" +
        "<br>+10% on a neutral stat \\u00b7 +5% stacking a strength \\u00b7 halves a matching weakness" +
        '<br><i>\\u201c' + pp.tag + '\\u201d</i></div></button>';
    }).join("");""" ),
# ---- homeless: re-house buttons right in the HUD, usable anywhere ----
("rehouse chips",
"""    if (p.homeless) flags.push('<span class="flag-chip bad">\\ud83c\\udfda homeless</span>');""",
"""    if (p.homeless && isMyTurn()) {
      flags.push('<button class="flag-chip bad" id="hud-rehouse">\\ud83c\\udfda RE-HOUSE $' + Math.round(0.30 * T) + "</button>");
      flags.push('<button class="flag-chip" id="hud-rehouse-lux">\\ud83c\\udfd9 GO LUXURY $' + Math.round(0.75 * T) + "</button>");
    } else if (p.homeless) {
      flags.push('<span class="flag-chip bad">\\ud83c\\udfda homeless</span>');
    }"""),
("rehouse wire",
"""      var rentBtn = $("#hud-rent");
      if (rentBtn) rentBtn.onclick = function () { click(); doAction(p.housing === "lux" ? "X007" : "X006"); };""",
"""      var rentBtn = $("#hud-rent");
      if (rentBtn) rentBtn.onclick = function () { click(); doAction(p.housing === "lux" ? "X007" : "X006"); };
      var rh = $("#hud-rehouse");
      if (rh) rh.onclick = function () { click(); doAction("X005"); };
      var rhl = $("#hud-rehouse-lux");
      if (rhl) rhl.onclick = function () { click(); doAction("X009"); };"""),
# ---- shop: numeric stat text instead of percentages ----
("numeric shop",
"""      var fx = it.bonus ? "+" + Math.round(it.bonus.pct * 100) + "% " + E.statName(it.bonus.stat) + " gains" : "";
      if (it.penalty) fx += " · -" + Math.round(it.penalty.pct * 100) + "% " + E.statName(it.penalty.stat);""",
"""      var fx = it.bonus ? "+" + Math.round(it.bonus.pct * st.T) + " " + E.statName(it.bonus.stat) : "";
      if (it.penalty) fx += " \\u00b7 -" + Math.round(it.penalty.pct * st.T) + " " + E.statName(it.penalty.stat);"""),
# ---- wide chip overlays: align to the generated 720x402 card ----
("wide chip build",
"""      if (!chip._wideBuilt) {
        chip._wideBuilt = true;
        chip.classList.add("wide-chip");
        chip.innerHTML =
          '<img class="wide-chip-art" src="' + window.PP_CHIP_WIDE + '" alt="">' +
          '<div class="wc-money" id="wc-money"></div>' +
          '<div class="wc-tu" id="wc-tu"></div>' +
          mains.map(function (stat, i) {
            var col = i % 2, row = (i / 2) | 0;
            return '<span class="wc-bar" style="left:' + (39 + col * 28.5) + "%;top:" + (30 + row * 14.5) + '%">' +
              '<i id="wc-bar-' + stat + '" style="background:' + STAT_META[stat].color + '"></i></span>';
          }).join("");
      }
      $("#wc-money").textContent = "$" + p.stats.money;
      $("#wc-tu").textContent = p.tu + " TU · " + dayClock(p);
      mains.forEach(function (stat) {
        $("#wc-bar-" + stat).style.width = Math.min(100, p.stats[stat] / st.T * 100) + "%";
      });
      return;""",
"""      if (!chip._wideBuilt) {
        chip._wideBuilt = true;
        chip.classList.add("wide-chip");
        chip.innerHTML =
          '<img class="wide-chip-art" src="' + window.PP_CHIP_WIDE + '" alt="">' +
          '<div class="wc-money" id="wc-money"></div>' +
          '<div class="wc-tu" id="wc-tu"></div>' +
          mains.map(function (stat, i) {
            var col = i % 2, row = (i / 2) | 0;
            return '<span class="wc-bar" style="left:' + (37.2 + col * 29.5) + "%;top:" + (30.6 + row * 13.4) + '%">' +
              '<i id="wc-bar-' + stat + '" style="background:' + STAT_META[stat].color + '"></i></span>';
          }).join("") +
          ["coolness", "critical", "enlightenment"].map(function (stat, i) {
            return '<span class="wc-coin" id="wc-coin-' + stat + '" style="left:' + (43.4 + i * 13.3) + '%"></span>';
          }).join("");
      }
      $("#wc-money").textContent = "\\ud83d\\udcb5 $" + p.stats.money;
      $("#wc-tu").textContent = "\\u23f3 " + p.tu + " TU \\u00b7 " + dayClock(p);
      mains.forEach(function (stat) {
        $("#wc-bar-" + stat).style.width = Math.min(100, p.stats[stat] / st.T * 100) + "%";
      });
      ["coolness", "critical", "enlightenment"].forEach(function (stat) {
        $("#wc-coin-" + stat).textContent = p.stats[stat];
      });
      return;"""),
])

# ---- css: pet cards + aligned wide-chip pieces ----
s = io.open("css/style.css", encoding="utf-8").read()
old = """/* wide Casey chip (activates when assets/cards/casey_chip_wide.png exists) */
.scene-hud-chip.wide-chip { background: none; border: none; box-shadow: none;
  padding: 0; display: block; width: 24%; aspect-ratio: 1.79; }
.wide-chip-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.wc-money { position: absolute; left: 65%; top: 5.5%; width: 27%; height: 17%;
  background: #15270f; border: .12em solid var(--stroke); border-radius: .4em;
  color: #ffe08a; font-weight: 900; font-size: .95em; display: grid; place-items: center; }
.wc-tu { position: absolute; left: 2.5%; top: 80%; width: 34%; height: 15%;
  background: rgba(15,10,6,.85); border-radius: 999px; border: .12em solid var(--gold);
  color: #ffe08a; font-weight: 800; font-size: .7em; display: grid; place-items: center; }
.wc-bar { position: absolute; width: 25.5%; height: 5%; background: #2b2416;
  border-radius: .25em; border: .1em solid var(--stroke); overflow: hidden; }
.wc-bar i { display: block; height: 100%; }"""
new = """/* wide Casey chip (generated card at assets/cards/casey_chip_wide.png) */
.scene-hud-chip.wide-chip { background: none; border: none; box-shadow: none;
  padding: 0; display: block; width: 25%; aspect-ratio: 720 / 402; }
.wide-chip-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.wc-money { position: absolute; left: 65.8%; top: 5.5%; width: 31%; height: 12.5%;
  color: #ffe08a; font-weight: 900; font-size: .95em; display: grid; place-items: center; }
.wc-tu { position: absolute; left: 2.2%; top: 88%; width: 24%; height: 9.5%;
  color: #ffe08a; font-weight: 800; font-size: .68em; display: grid; place-items: center; }
.wc-bar { position: absolute; width: 25.6%; height: 5.4%; overflow: hidden; border-radius: .25em; }
.wc-bar i { display: block; height: 100%; }
.wc-coin { position: absolute; top: 62%; width: 7%; height: 12%;
  background: rgba(15,10,6,.9); border: .12em solid var(--gold); border-radius: 999px;
  color: #ffe08a; font-weight: 900; font-size: .72em; display: grid; place-items: center; }

/* pet adopt cards: picture + hover description */
.pet-card { position: relative; text-align: center; }
.pet-card .pet-pic { font-size: 2.6em; line-height: 1.2; }
.pet-card .pet-hover {
  display: none; position: absolute; left: 50%; bottom: 102%; transform: translateX(-50%);
  width: 15em; background: var(--paper); color: var(--ink); border: .18em solid var(--stroke);
  border-radius: .5em; padding: .5em .7em; font-size: .85em; z-index: 40;
  box-shadow: .25em .3em 0 rgba(0,0,0,.4); pointer-events: none;
}
.pet-card:hover .pet-hover { display: block; }"""
assert old in s, "MISSING css wide chip"
s = s.replace(old, new)
io.open("css/style.css", "w", encoding="utf-8").write(s)
print("css OK")
