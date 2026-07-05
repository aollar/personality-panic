# One-shot patch for the TTTTT demo fixes (ui.js). Run once from repo root.
import io, sys

p = "js/ui.js"
s = io.open(p, encoding="utf-8").read()

def swap(old, new, tag):
    global s
    assert old in s, "MISSING: " + tag
    s = s.replace(old, new)

# ---------- 1. renderHud -> build-once card-art HUD, updated in place ----------
start = s.index("  function renderHud() {")
end = s.index("  function renderScoreboard() {")
new_hud = '''  // ---- left panel: the real Casey card art + dynamic overlays (TTTTT 9/10) ----
  // Built ONCE per game, then updated in place - no innerHTML rebuilds, no flicker.
  function dayClock(p) {
    var total = DATA.settings.timeUnitsPerTurn;
    var spent = Math.max(0, Math.min(total, total - p.tu));
    var hour = 9 + spent * (12 / total);           // 6 TU day: 9 AM -> 9 PM
    var h12 = ((Math.round(hour) + 11) % 12) + 1;
    var ampm = hour < 12 ? "AM" : "PM";
    return h12 + ":00 " + ampm;
  }
  function ensureHud() {
    if (UI._hudBuilt) return;
    UI._hudBuilt = true;
    var el = $("#hud");
    var art = window.PP_CARD_TALL || "assets/cards/casey_turncard_tall.jpg";
    el.innerHTML =
      '<img class="hud-card-art" src="' + art + '" alt="">' +
      '<div class="hud-ov hud-turnbox"><div id="hud-turn1"></div><div id="hud-turn2"></div></div>' +
      '<div class="hud-ov hud-moneybox" id="hud-money"></div>' +
      '<div class="hud-flags" id="hud-flags"></div>' +
      ["connection", "health", "career", "happiness"].map(function (stat, i) {
        return '<div class="hud-bar" style="top:' + (63.9 + i * 4.72) + '%">' +
          '<span class="hb-track"><i id="hud-bar-' + stat + '" style="background:' + STAT_META[stat].color + '"></i></span>' +
          '<span class="hb-num" id="hud-num-' + stat + '"></span></div>';
      }).join("") +
      '<div class="hud-coinval" id="hud-val-coolness" style="left:11%"></div>' +
      '<div class="hud-coinval" id="hud-val-critical" style="left:42%"></div>' +
      '<div class="hud-coinval" id="hud-val-enlightenment" style="left:73%"></div>' +
      '<div class="hud-buttons">' +
      '<button class="btn small" id="hud-stats">Stats</button>' +
      '<button class="btn small" id="hud-log">Log</button>' +
      '<button class="btn small" id="hud-menu">Menu</button>' +
      '<button class="btn small danger" id="hud-end">End Turn</button>' +
      "</div>";
    $("#hud-stats").onclick = function () { click(); openStats(); };
    $("#hud-log").onclick = function () { click(); openLog(); };
    $("#hud-menu").onclick = function () { click(); openMenu(); };
    $("#hud-end").onclick = function () { click(); endTurnClicked(); };
  }
  function renderHud() {
    ensureHud();
    var st = UI.state, p = activeP(), T = st.T;
    var maxT = st.maxRounds > 0 ? "/" + st.maxRounds : "";
    $("#hud-turn1").textContent = "TURN " + st.turn + maxT + " \\u00b7 " + p.name.toUpperCase() + (p.isBot ? " (CPU)" : "");
    $("#hud-turn2").textContent = "\\ud83d\\udd50 " + dayClock(p) + " \\u2014 " + p.tu + " TU left";
    $("#hud-money").textContent = "\\ud83d\\udcb5 $" + p.stats.money;
    ["connection", "health", "career", "happiness"].forEach(function (stat) {
      var v = p.stats[stat];
      $("#hud-bar-" + stat).style.width = Math.max(0, Math.min(100, v / T * 100)) + "%";
      $("#hud-num-" + stat).textContent = v;
    });
    ["coolness", "critical", "enlightenment"].forEach(function (stat) {
      $("#hud-val-" + stat).textContent = p.stats[stat];
    });
    // flags: chips over the portrait's bottom edge (incl. rent + pet + job)
    var flags = [];
    if (E.isRentTurn(st) && !p.rentPaid && !p.homeless && isMyTurn())
      flags.push('<button class="flag-chip bad" id="hud-rent">\\ud83c\\udfe0 PAY RENT $' +
        Math.round((p.housing === "lux" ? 0.5 : 0.2) * T) + "</button>");
    if (!p.ate) flags.push('<span class="flag-chip bad">\\ud83c\\udf54 eat!</span>');
    if (p.turnsSinceRelax >= 2) flags.push('<span class="flag-chip bad">\\ud83d\\ude35 stressed</span>');
    if (p.homeless) flags.push('<span class="flag-chip bad">\\ud83c\\udfda homeless</span>');
    if (p.pet && !p.pet.dead) {
      var band = E.petState(st, p);
      flags.push('<span class="flag-chip' + (band === "Healthy" ? "" : " bad") + '">\\ud83d\\udc3e ' + p.pet.health + "/" + p.pet.happiness + "</span>");
    }
    if (p.foodSupply > 0) flags.push('<span class="flag-chip">\\ud83e\\udd55 \\u00d7' + p.foodSupply + "</span>");
    if (p.job) flags.push('<span class="flag-chip">\\ud83d\\udcbc ' + p.job.name + "</span>");
    var fl = $("#hud-flags");
    if (fl._last !== flags.join("")) {   // only touch the DOM when content changed
      fl._last = flags.join("");
      fl.innerHTML = flags.join("");
      var rentBtn = $("#hud-rent");
      if (rentBtn) rentBtn.onclick = function () { click(); doAction(p.housing === "lux" ? "X007" : "X006"); };
    }
    $("#hud-end").style.display = isMyTurn() ? "" : "none";
    $("#skip-cpu").style.display = (p.isBot && UI.mode !== "guest") ? "" : "none";
  }
'''
s = s[:start] + new_hud + s[end:]

# ---------- 2. timer circle doubles as the day clock ----------
swap('''  function renderTimer() {
    var el = $("#turn-timer");
    if (!UI.state.timerSeconds || activeP().isBot) { el.style.display = "none"; return; }
    el.style.display = "";
    el.querySelector(".t").textContent = UI.timerLeft;
    el.classList.toggle("warn", UI.timerLeft <= 5);
  }''',
'''  function renderTimer() {
    var el = $("#turn-timer"), p = activeP();
    if (UI.state.timerSeconds && !p.isBot) {          // real-time countdown wins the clock face
      el.style.display = "";
      el.querySelector(".t").textContent = UI.timerLeft;
      el.querySelector(".lbl").textContent = "seconds";
      el.classList.toggle("warn", UI.timerLeft <= 5);
      return;
    }
    // otherwise the clock face shows the in-game time of day (TTTTT item 2)
    el.style.display = "";
    el.classList.remove("warn");
    el.querySelector(".t").textContent = dayClock(p).replace(":00", "");
    el.querySelector(".lbl").textContent = p.tu + " TU left";
  }''', "renderTimer")

# ---------- 3. bot loop: step cap + reset counter per turn ----------
swap('''    UI.botRunning = true;
    UI.botFast = UI.cfg && UI.cfg.skipCpu;
    var stepDelay = function () { return UI.botFast ? 0 : 650; };
    function step() {''',
'''    UI.botRunning = true;
    UI.botFast = UI.cfg && UI.cfg.skipCpu;
    UI._botSteps = 0;
    var stepDelay = function () { return UI.botFast ? 0 : 650; };
    function step() {
      if (++UI._botSteps > 60) { E.endTurn(UI.state); UI._botSteps = 0; } // hard cap: a bot turn can never hang the game''', "bot cap")
swap('''      if (s.type === "end") {
        E.endTurn(UI.state);
        saveGame();''',
'''      if (s.type === "end") {
        E.endTurn(UI.state);
        UI._botSteps = 0;
        saveGame();''', "bot end reset")

# ---------- 4. spectator action feed ----------
swap('''  function renderAll() {
    if (!UI.state) return;
    renderHud();''',
'''  // ---- spectator feed: everyone SEES what other players / CPUs do (TTTTT 1) ----
  var feedQueue = [], feedTimer = null;
  function drainFeed() {
    if (!feedQueue.length) { feedTimer = null; return; }
    var e = feedQueue.shift();
    toast(e.who + ": " + e.text, e.cls);
    feedTimer = setTimeout(drainFeed, 750);
  }
  function feedFromLog() {
    var st = UI.state;
    if (UI._logSeen == null) UI._logSeen = st.log.length;
    var myNames = UI.mySlots.map(function (i) { return st.players[i] && st.players[i].name; });
    for (var i = UI._logSeen; i < st.log.length; i++) {
      var l = st.log[i];
      if (!l.who || myNames.indexOf(l.who) !== -1) continue;
      if (UI.botFast && UI.botRunning) continue;           // skipped turns toast a summary instead
      feedQueue.push(l);
      if (feedQueue.length > 5) feedQueue.shift();
    }
    UI._logSeen = st.log.length;
    if (feedQueue.length && !feedTimer) drainFeed();
  }
  function renderAll() {
    if (!UI.state) return;
    feedFromLog();
    renderHud();''', "feed")

# ---------- 5. footsteps on Take a Walk ----------
swap('''    if (r.needsChoice === "pet") { openPetChoice(id); return; }
    afterDispatch("action", { id: id }, r);''',
'''    if (r.needsChoice === "pet") { openPetChoice(id); return; }
    if (id === "A018") A.footsteps(1800);          // Take a Walk: audible footsteps
    afterDispatch("action", { id: id }, r);''', "footsteps")

# ---------- 6. bigger hotspots + club door tooltip ----------
swap('''      h.style.setProperty("--w", "11%");
      h.style.setProperty("--h", "17%");''',
'''      h.style.setProperty("--w", "14.5%");
      h.style.setProperty("--h", "21%");''', "hotspot size")
swap('''      var mc = E.moveCost(UI.state, p, id);
      var ok = mc.tu <= p.tu;
      h.dataset.tip = b.name + " — " + (mc.tu === 0 ? "free" : mc.tu + " TU") + (mc.far ? " (far)" : "");
      h.classList.toggle("unreachable", !ok);''',
'''      var mc = E.moveCost(UI.state, p, id);
      var ok = mc.tu <= p.tu;
      var tip = b.name + " — " + (mc.tu === 0 ? "free" : mc.tu + " TU") + (mc.far ? " (far)" : "");
      if (id === "club") {
        var gate = E.clubGate(UI.state, p);
        if (gate) { tip = b.name + " — \\ud83d\\ude0e " + gate; ok = false; }
      }
      h.dataset.tip = tip;
      h.classList.toggle("unreachable", !ok);''', "club tip")

# ---------- 7. mall RIDES tab ----------
swap('''  function buildPaintLayer(id) {
    var layer = $("#paint-layer");
    layer.innerHTML = "";
    if (!id) return;''',
'''  function buildPaintLayer(id) {
    var layer = $("#paint-layer");
    layer.innerHTML = "";
    if (!id) return;
    if (id === "mall") {           // the art has no Transportation tab - add a matching one
      var rides = document.createElement("button");
      rides.className = "mall-rides-tab";
      rides.textContent = "\\ud83d\\ude8c RIDES";
      rides.onclick = function () {
        if (!isMyTurn()) { toast("Not your turn"); return; }
        click(); doAction("A112");
      };
      layer.appendChild(rides);
    }''', "rides tab")

# ---------- 8. per-game HUD rebuild + skip/mute wiring ----------
swap('''  function startGameUI(resumed) {
    show("game");''',
'''  function startGameUI(resumed) {
    UI._hudBuilt = false;          // fresh HUD per game
    UI._logSeen = null;            // spectator feed starts from "now" (no backlog replay)
    UI.botRunning = false;         // never inherit a stuck bot loop across resume
    show("game");''', "startGameUI")
swap('''    $("#btn-leave-scene").onclick = function () { click(); closeScene(); };
    $("#btn-more").onclick = function () { click(); openMore(); };''',
'''    $("#btn-leave-scene").onclick = function () { click(); closeScene(); };
    $("#btn-more").onclick = function () { click(); openMore(); };
    $("#skip-cpu").onclick = function () { click(); UI.botFast = true; };
    var muteB = $("#music-mute");
    function muteIcon() { muteB.textContent = A.state.musicMuted ? "\\ud83d\\udd07" : "\\ud83c\\udfb5"; }
    muteB.onclick = function () { click(); A.set("musicMuted", !A.state.musicMuted); muteIcon(); };
    muteIcon();''', "buttons")

io.open(p, "w", encoding="utf-8").write(s)
print("ui.js patched OK")
