/*
 * PERSONALITY PANIC — UI controller.
 * Screens: start -> setup/lobby -> game (overmap + scenes) -> podium.
 * Drives PPEngine locally (single/host) or mirrors state as a multiplayer guest.
 */
(function () {
  var E = window.PPEngine, B = window.PPBots, A = window.PPAudio;
  var DATA = window.PP_DATA, ASSUME = window.PP_ASSUMPTIONS;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var UI = {
    state: null,             // engine game state (authoritative on local/host)
    mode: "local",           // "local" | "host" | "guest"
    mySlots: [],             // player indexes controlled on this machine
    inScene: null,           // building id currently open
    walker: null,
    timerId: null, timerLeft: 0,
    botRunning: false, botFast: false,
    cfg: null
  };
  window.PPUI = UI;

  var PLAYER_COLORS = ["#ffc83d", "#37b8ff", "#ff4fa3", "#62e266"];
  var STAT_META = {
    connection: { label: "Connection", icon: "❤️", color: "#ff4fa3" },
    health: { label: "Health", icon: "➕", color: "#62e266" },
    career: { label: "Career", icon: "💼", color: "#37b8ff" },
    happiness: { label: "Happiness", icon: "😊", color: "#ffc83d" },
    coolness: { label: "Coolness", icon: "😎", color: "#9b55ff" },
    critical: { label: "Critical Th.", icon: "🧠", color: "#b46bff" },
    enlightenment: { label: "Enlighten.", icon: "🪷", color: "#ffb46b" },
    money: { label: "Money", icon: "💵", color: "#7ddf82" }
  };

  // ---------------- helpers ----------------
  function show(screen) {
    $$(".screen").forEach(function (s) { s.classList.remove("show"); });
    $("#screen-" + screen).classList.add("show");
  }
  function toast(text, cls) {
    var t = document.createElement("div");
    t.className = "toast " + (cls || "");
    t.textContent = text;
    $("#toasts").appendChild(t);
    setTimeout(function () { t.remove(); }, 3400);
  }
  function click() { A.sfx("click"); }
  function per(code) { return DATA.personalities[code]; }
  function cardSrc(code) { return "assets/cards/" + per(code).card; }
  function isMyTurn() {
    if (!UI.state) return false;
    return UI.mySlots.indexOf(UI.state.activeIdx) !== -1;
  }
  function activeP() { return UI.state.players[UI.state.activeIdx]; }

  // dispatch: local/host apply to engine; guest sends intent
  function dispatch(kind, payload, after) {
    if (UI.mode === "guest") { window.PPNet.sendIntent(kind, payload); return; }
    var st = UI.state, r = null;
    if (kind === "move") r = E.moveTo(st, payload.to);
    else if (kind === "action") r = E.perform(st, payload.id, payload.choice);
    else if (kind === "end") { r = { ok: true, events: E.endTurn(st) }; }
    afterDispatch(kind, payload, r, after);
    return r;
  }
  function afterDispatch(kind, payload, r, after) {
    if (r && r.sfx) r.sfx.forEach(function (s) { A.sfx(s); });
    saveGame();
    if (UI.mode === "host") window.PPNet.broadcastState();
    if (UI.state.over) { renderAll(); openPodium(); return; }
    if (after) after(r);
    renderAll();
    maybeRunBot();
  }

  // ---------------- save / resume ----------------
  function saveGame() {
    if (UI.mode === "guest" || !UI.state) return;
    try {
      window.PPStore.set("pp_save", JSON.stringify({ state: UI.state, cfg: UI.cfg, mode: UI.mode }));
    } catch (e) {}
  }
  function clearSave() { window.PPStore.remove("pp_save"); }
  function loadSave() {
    try { return JSON.parse(window.PPStore.get("pp_save") || "null"); } catch (e) { return null; }
  }

  // ---------------- START SCREEN ----------------
  function initStart() {
    var save = loadSave();
    $("#btn-continue").style.display = (save && !save.state.over) ? "" : "none";
    $("#btn-continue").onclick = function () {
      click();
      var s = loadSave(); if (!s) return;
      UI.state = s.state; UI.cfg = s.cfg; UI.mode = "local";
      UI.mySlots = s.state.players.map(function (p, i) { return p.isBot ? -1 : i; }).filter(function (i) { return i >= 0; });
      startGameUI(true);
    };
    $("#btn-single").onclick = function () { click(); openSetup("single"); };
    $("#btn-multi").onclick = function () { click(); openMultiMenu(); };
    A.setScene("overmap", false);
  }

  // ---------------- SETUP ----------------
  var setup = null;
  function openSetup(mode) {
    setup = {
      mode: mode, humans: mode === "single" ? 1 : 2, bots: 1,
      length: "short", timer: 0, hints: true, skipCpu: true, maxRounds: 30,
      picks: [], activeSlot: 0
    };
    rebuildSlots();
    renderSetup();
    show("setup");
  }
  function rebuildSlots() {
    var total = Math.min(4, setup.humans + setup.bots);
    var old = setup.picks;
    setup.picks = [];
    for (var i = 0; i < total; i++) {
      var isBot = i >= setup.humans;
      var prev = old[i];
      setup.picks.push({
        name: prev && !prev.auto ? prev.name : (isBot ? "CPU " + (i + 1) : "Player " + (i + 1)),
        auto: prev ? prev.auto : true,
        code: prev ? prev.code : null, isBot: isBot
      });
    }
    if (setup.activeSlot >= total) setup.activeSlot = 0;
  }
  function lengthT() { return DATA.settings.gameLengths[setup.length]; }
  function renderSetup() {
    var el = $("#setup-options");
    var timerLabel = setup.timer === 0 ? "Unlimited" : setup.timer + "s";
    var rows = [
      ["Humans", setup.humans, "humans", setup.mode === "single" ? null : [1, 4]],
      ["CPU Bots", setup.bots, "bots", [0, 3]],
      ["Game Length", setup.length.toUpperCase() + " (T=" + lengthT() + ")", "length"],
      ["Turn Timer", timerLabel, "timer"],
      ["Map", "Personality Panic City", "map"],
      ["Hints", setup.hints ? "On" : "Off", "hints"],
      ["Skip CPU Turns", setup.skipCpu ? "On" : "Off", "skipCpu"],
      ["Game ends after", setup.maxRounds === 0 ? "— (only stat max)" : setup.maxRounds + " turns", "maxRounds"]
    ];
    el.innerHTML = rows.map(function (r) {
      return '<div class="opt-row"><label>' + r[0] + '</label><div class="value">' +
        '<button class="arrow-btn" data-k="' + r[2] + '" data-d="-1">◀</button><span>' + r[1] + "</span>" +
        '<button class="arrow-btn" data-k="' + r[2] + '" data-d="1">▶</button></div></div>';
    }).join("");
    $$("#setup-options .arrow-btn").forEach(function (b) {
      b.onclick = function () { click(); bumpSetup(b.dataset.k, +b.dataset.d); };
    });

    // participant tabs
    var tabs = $("#picker-tabs");
    tabs.innerHTML = setup.picks.map(function (p, i) {
      return '<button class="tab ' + (i === setup.activeSlot ? "active" : "") + (p.isBot ? " bot" : "") + '" data-i="' + i + '">' +
        (p.code ? per(p.code).name.replace("The ", "") + " · " : "") + p.name + "</button>";
    }).join("");
    $$("#picker-tabs .tab").forEach(function (t) {
      t.onclick = function () {
        click();
        var i = +t.dataset.i;
        if (setup.activeSlot === i && !setup.picks[i].isBot) {
          var n = prompt("Player name:", setup.picks[i].name);
          if (n) { setup.picks[i].name = n.slice(0, 14); setup.picks[i].auto = false; }
        }
        setup.activeSlot = i;
        renderSetup();
      };
    });

    // character cards
    var taken = setup.picks.map(function (p) { return p.code; });
    var grid = $("#char-grid");
    grid.innerHTML = Object.keys(DATA.personalities).map(function (code) {
      var pp = per(code);
      var byWho = setup.picks.map(function (p, i) { return p.code === code ? i : -1; }).filter(function (i) { return i >= 0; })[0];
      var takenBy = byWho !== undefined && byWho !== setup.activeSlot;
      var sel = setup.picks[setup.activeSlot] && setup.picks[setup.activeSlot].code === code;
      return '<div class="char-card ' + (sel ? "selected" : "") + (takenBy ? " taken" : "") + '" data-code="' + code + '" title="' + pp.tag + '">' +
        '<img src="' + cardSrc(code) + '" alt="' + pp.name + '" loading="lazy">' +
        (byWho !== undefined ? '<div class="who">' + setup.picks[byWho].name + "</div>" : "") + "</div>";
    }).join("");
    $$("#char-grid .char-card").forEach(function (c) {
      c.onclick = function () {
        var code = c.dataset.code;
        var takenBy = setup.picks.map(function (p, i) { return p.code === code ? i : -1; }).filter(function (i) { return i >= 0; })[0];
        if (takenBy !== undefined && takenBy !== setup.activeSlot) return;
        click();
        setup.picks[setup.activeSlot].code = code;
        // auto-advance to next unpicked slot
        var next = setup.picks.findIndex(function (p) { return !p.code; });
        if (next >= 0) setup.activeSlot = next;
        renderSetup();
      };
    });

    var ready = setup.picks.length >= 2 && setup.picks.every(function (p) { return p.code; });
    $("#btn-start-game").disabled = !ready;
    $("#setup-hint").textContent = ready ? "" :
      "Pick a character for every participant (tap a tab, then a card). Min 2 participants.";
  }
  function bumpSetup(k, d) {
    if (k === "humans") {
      setup.humans = Math.max(setup.mode === "single" ? 1 : 1, Math.min(4, setup.humans + d));
      if (setup.mode === "single") setup.humans = 1;
      if (setup.humans + setup.bots > 4) setup.bots = 4 - setup.humans;
      if (setup.humans + setup.bots < 2) setup.bots = 2 - setup.humans;
    }
    if (k === "bots") {
      setup.bots = Math.max(0, Math.min(3, setup.bots + d));
      if (setup.humans + setup.bots > 4) setup.humans = Math.max(1, 4 - setup.bots);
      if (setup.humans + setup.bots < 2) setup.bots = 2 - setup.humans;
    }
    if (k === "length") {
      var L = ["short", "medium", "long"], i = (L.indexOf(setup.length) + d + 3) % 3;
      setup.length = L[i];
      setup.maxRounds = { short: 30, medium: 40, long: 50 }[setup.length];
    }
    if (k === "timer") {
      var T = [0, 30, 60, 90, 120], j = (T.indexOf(setup.timer) + d + T.length) % T.length;
      setup.timer = T[j];
    }
    if (k === "hints") setup.hints = !setup.hints;
    if (k === "skipCpu") setup.skipCpu = !setup.skipCpu;
    if (k === "maxRounds") {
      var opts = [0, 20, 25, 30, 35, 40, 50, 60, 80];
      var idx = opts.indexOf(setup.maxRounds); if (idx < 0) idx = 3;
      setup.maxRounds = opts[(idx + d + opts.length) % opts.length];
    }
    rebuildSlots(); renderSetup();
  }

  function startLocalGame() {
    var players = setup.picks.map(function (p) { return { name: p.name, code: p.code, isBot: p.isBot }; });
    UI.cfg = { T: lengthT(), timerSeconds: setup.timer, maxRounds: setup.maxRounds,
               hints: setup.hints, skipCpu: setup.skipCpu, players: players };
    UI.state = E.newGame(UI.cfg);
    UI.mode = (setup.mode === "host") ? "host" : "local";
    UI.mySlots = players.map(function (p, i) { return p.isBot ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (UI.mode === "host") UI.mySlots = window.PPNet.hostSlots();
    startGameUI(false);
  }

  // ---------------- GAME UI ----------------
  function startGameUI(resumed) {
    UI._hudBuilt = false;          // fresh HUD per game
    UI._logSeen = null;            // spectator feed starts from "now" (no backlog replay)
    UI.botRunning = false;         // never inherit a stuck bot loop across resume
    show("game");
    if (!UI.walker) UI.walker = new window.PPWalker($("#map-view"));
    buildHotspots();
    UI.inScene = null;
    closeAllDialogs();
    $("#scene-view").classList.remove("show");
    UI.walker.jumpTo(activeP().location);
    renderAll();
    A.setScene("overmap", E.isRentTurn(UI.state));
    if (!resumed) turnIntro();
    else { toast("Game resumed — turn " + UI.state.turn, "good"); startTimer(); maybeRunBot(); }
  }

  function buildHotspots() {
    var mv = $("#map-view");
    $$(".hotspot").forEach(function (h) { h.remove(); });
    Object.keys(DATA.buildings).forEach(function (id) {
      var b = DATA.buildings[id];
      var h = document.createElement("button");
      h.className = "hotspot";
      h.style.left = b.pos[0] + "%";
      h.style.top = (b.pos[1] - 4) + "%";
      h.style.setProperty("--w", "14.5%");
      h.style.setProperty("--h", "21%");
      h.dataset.id = id;
      mv.appendChild(h);
      h.onclick = function () { onHotspot(id); };
    });
  }
  function onHotspot(id) {
    if (!UI.state || UI.state.over) return;
    if (!isMyTurn()) { toast("Not your turn"); return; }
    var p = activeP();
    click();
    if (p.location === id) { openScene(id); return; }
    var mc = E.moveCost(UI.state, p, id);
    if (mc.tu > p.tu) { toast("Not enough Time Units to travel (" + mc.tu + " TU)", "bad"); return; }
    if (id === "club") {
      var whyClub = E.clubGate(UI.state, p);
      if (whyClub) { toast("\ud83d\udeab " + whyClub, "bad"); return; }
    }
    if (UI.mode === "guest") {
      // optimistic walk so it feels alive; the host's state confirms the arrival
      var fromG = p.location;
      A.startMove(E.transportOf(p));
      UI.walker.walkTo(id, fromG, function () { A.stopMove(); });
      dispatch("move", { to: id });
      return;
    }
    var from = p.location;
    var r = dispatchNoRender("move", { to: id });
    if (!r.ok) { toast(r.why, "bad"); return; }
    if (UI.mode === "host") window.PPNet.relayWalk(r.from, id);
    A.startMove(r.transport);
    renderHud();
    UI.walker.walkTo(id, from, function () {
      A.stopMove();
      saveGame();
      if (UI.mode === "host") window.PPNet.broadcastState();
      openScene(id);
      renderAll();
    });
  }
  function dispatchNoRender(kind, payload) {
    var st = UI.state;
    if (kind === "move") return E.moveTo(st, payload.to);
    return null;
  }

  function updateHotspotStates() {
    if (!UI.state) return;
    var p = activeP();
    $$(".hotspot").forEach(function (h) {
      var id = h.dataset.id, b = DATA.buildings[id];
      if (id === p.location) { h.dataset.tip = b.name + " — you are here (click to enter)"; h.classList.remove("unreachable"); return; }
      var mc = E.moveCost(UI.state, p, id);
      var ok = mc.tu <= p.tu;
      var tip = b.name + " — " + (mc.tu === 0 ? "free" : mc.tu + " TU") + (mc.far ? " (far)" : "");
      if (id === "club") {
        var gate = E.clubGate(UI.state, p);
        if (gate) { tip = b.name + " — \ud83d\ude0e " + gate; ok = false; }
      }
      h.dataset.tip = tip;
      h.classList.toggle("unreachable", !ok);
    });
  }

  // ---------------- rendering ----------------
  // ---- spectator feed: everyone SEES what other players / CPUs do (TTTTT 1) ----
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
    renderHud();
    renderScoreboard();
    updateHotspotStates();
    renderTimer();
    if (UI.inScene) renderSceneUI();
    // guests / non-walking updates: keep avatar on the active player's building
    if (!UI.walker.raf) UI.walker.jumpTo(activeP().location);
    UI.walker.setName(activeP().name, PLAYER_COLORS[UI.state.activeIdx % 4]);
  }

  function statRow(stat, val, T) {
    var m = STAT_META[stat];
    var pctW = Math.max(0, Math.min(100, (val / T) * 100));
    return '<div class="stat-row"><span>' + m.icon + '</span><span>' + m.label + '</span>' +
      '<span class="bar"><i style="width:' + pctW + '%;background:' + m.color + '"></i></span>' +
      '<span class="num">' + val + "</span></div>";
  }
  // ---- left panel: the real Casey card art + dynamic overlays (TTTTT 9/10) ----
  // Built ONCE per game, then updated in place - no innerHTML rebuilds, no flicker.
  function dayClock(p) {
    var total = DATA.settings.timeUnitsPerTurn;
    var spent = Math.max(0, Math.min(total, total - p.tu));
    var mins = Math.round(spent * (12 * 60 / total) / 5) * 5;   // day = 9 AM -> 9 PM
    var h24 = 9 + Math.floor(mins / 60), m = mins % 60;
    var h12 = ((h24 + 11) % 12) + 1;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + (h24 < 12 ? "AM" : "PM");
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
    $("#hud-turn1").textContent = "TURN " + st.turn + maxT + " \u00b7 " + p.name.toUpperCase() + (p.isBot ? " (CPU)" : "");
    $("#hud-turn2").textContent = "\ud83d\udd50 " + dayClock(p) + " \u2014 " + p.tu + " TU left";
    $("#hud-money").textContent = "\ud83d\udcb5 $" + p.stats.money;
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
      flags.push('<button class="flag-chip bad" id="hud-rent">\ud83c\udfe0 PAY RENT $' +
        Math.round((p.housing === "lux" ? 0.5 : 0.2) * T) + "</button>");
    if (!p.ate) flags.push('<span class="flag-chip bad">\ud83c\udf54 eat!</span>');
    if (p.turnsSinceRelax >= 2) flags.push('<span class="flag-chip bad">\ud83d\ude35 stressed</span>');
    if (p.homeless && isMyTurn()) {
      flags.push('<button class="flag-chip bad" id="hud-rehouse">\ud83c\udfda RE-HOUSE $' + Math.round(0.30 * T) + "</button>");
      flags.push('<button class="flag-chip" id="hud-rehouse-lux">\ud83c\udfd9 GO LUXURY $' + Math.round(0.75 * T) + "</button>");
    } else if (p.homeless) {
      flags.push('<span class="flag-chip bad">\ud83c\udfda homeless</span>');
    }
    if (p.pet && !p.pet.dead) {
      var band = E.petState(st, p);
      flags.push('<span class="flag-chip' + (band === "Healthy" ? "" : " bad") + '">\ud83d\udc3e ' + p.pet.health + "/" + p.pet.happiness + "</span>");
    }
    if (p.foodSupply > 0) flags.push('<span class="flag-chip">\ud83e\udd55 \u00d7' + p.foodSupply + "</span>");
    if (p.job) flags.push('<span class="flag-chip">\ud83d\udcbc ' + p.job.name + "</span>");
    var fl = $("#hud-flags");
    if (fl._last !== flags.join("")) {   // only touch the DOM when content changed
      fl._last = flags.join("");
      fl.innerHTML = flags.join("");
      var rentBtn = $("#hud-rent");
      if (rentBtn) rentBtn.onclick = function () { click(); doAction(p.housing === "lux" ? "X007" : "X006"); };
      var rh = $("#hud-rehouse");
      if (rh) rh.onclick = function () { click(); doAction("X005"); };
      var rhl = $("#hud-rehouse-lux");
      if (rhl) rhl.onclick = function () { click(); doAction("X009"); };
    }
    $("#hud-end").style.display = isMyTurn() ? "" : "none";
    $("#skip-cpu").style.display = (p.isBot && UI.mode !== "guest") ? "" : "none";
  }
  function renderScoreboard() {
    var st = UI.state;
    $("#scoreboard").innerHTML = st.players.map(function (p, i) {
      var mains = ["connection", "health", "career", "happiness"];
      return '<div class="paper-card score-chip ' + (i === st.activeIdx ? "active-player" : "") + '">' +
        '<div class="n"><span>' + p.name + '</span><span>' + E.score(st, p) + "</span></div>" +
        '<div class="mini-bars">' + mains.map(function (s) {
          return "<i><b style='width:" + Math.min(100, p.stats[s] / st.T * 100) + "%;background:" + STAT_META[s].color + "'></b></i>";
        }).join("") + "</div></div>";
    }).join("");
  }

  // ---------------- timer ----------------
  function startTimer() {
    stopTimer();
    var secs = UI.state.timerSeconds;
    $("#turn-timer").style.display = secs ? "" : "none";
    if (!secs || activeP().isBot) return;
    UI.timerLeft = secs;
    renderTimer();
    UI.timerId = setInterval(function () {
      UI.timerLeft--;
      renderTimer();
      if (UI.timerLeft <= 5 && UI.timerLeft > 0 && window.PPStore.get("pp_timerwarn") !== "off") A.sfx("click");
      if (UI.timerLeft <= 0) {
        stopTimer();
        toast("⏰ Time's up!", "bad");
        if (isMyTurn() || UI.mode !== "guest") endTurnClicked(true);
      }
    }, 1000);
  }
  function stopTimer() { if (UI.timerId) { clearInterval(UI.timerId); UI.timerId = null; } }
  function renderTimer() {
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
    var tod = dayClock(p);
    el.querySelector(".t").textContent = tod.replace(" AM", "").replace(" PM", "");
    el.querySelector(".t").style.fontSize = "1.9em";
    el.querySelector(".lbl").textContent = (tod.indexOf("AM") !== -1 ? "AM" : "PM") + " · " + p.tu + " TU";
  }

  // ---------------- turn flow ----------------
  function turnIntro() {
    var p = activeP();
    if (p.isBot) { renderAll(); maybeRunBot(); startTimer(); return; }
    if (isMyTurn()) openTurnCard();          // spectators just watch the map + feed
    renderAll();
  }
  function openTurnCard() {
    var p = activeP();
    var d = $("#dlg-turncard");
    d.querySelector(".turncard-body").innerHTML =
      '<div class="turncard-wrap"><img src="' + cardSrc(p.code) + '" alt="">' +
      '<div class="turncard-info"><h3>' + p.name + " — Turn " + UI.state.turn + "</h3>" +
      "<div>" + per(p.code).name + " (" + p.code + ") · " + per(p.code).tag + "</div>" +
      '<div style="margin-top:.4em">💪 ' + E.statName(per(p.code).mainStrength) + " & " + E.statName(per(p.code).upkeepStrength) +
      " &nbsp; 😬 " + E.statName(per(p.code).mainWeakness) + " & " + E.statName(per(p.code).upkeepWeakness) + "</div>" +
      '<div class="warnings">' + p.warnings.map(function (w) { return "<div>⚠️ " + w + "</div>"; }).join("") + "</div>" +
      '<div style="margin-top:.8em"><button class="btn" id="btn-begin-turn">Start Turn ▶</button></div>' +
      "</div></div>";
    openDialog("turncard");
    $("#btn-begin-turn").onclick = function () {
      click(); closeDialog("turncard"); startTimer();
    };
  }
  function endTurnClicked(auto) {
    if (UI.state.over) return;
    stopTimer();
    if (UI.inScene) closeScene();
    dispatch("end", {}, function () {
      if (!UI.state.over) {
        A.setScene(UI.inScene || "overmap", E.isRentTurn(UI.state));
        turnIntro();
      }
    });
  }

  // ---------------- bots in UI ----------------
  function maybeRunBot() {
    if (UI.mode === "guest") return;
    if (!UI.state || UI.state.over || UI.botRunning) return;
    var p = activeP();
    if (!p.isBot) return;
    UI.botRunning = true;
    UI.botFast = UI.cfg && UI.cfg.skipCpu;
    UI._botSteps = 0;
    var stepDelay = function () { return UI.botFast ? 0 : 650; };
    function step() {
      if (++UI._botSteps > 60) { E.endTurn(UI.state); UI._botSteps = 0; } // hard cap: a bot turn can never hang the game
      if (UI.state.over) { UI.botRunning = false; renderAll(); openPodium(); return; }
      var cur = activeP();
      if (!cur.isBot) { UI.botRunning = false; saveGame(); renderAll(); turnIntro(); return; }
      var s = B.botStep(UI.state);
      if (s.type === "end") {
        UI.spectateScene(null);
        E.endTurn(UI.state);
        UI._botSteps = 0;
        saveGame();
        if (UI.mode === "host") window.PPNet.broadcastState();
        renderAll();
        A.setScene("overmap", E.isRentTurn(UI.state));
        setTimeout(step, stepDelay());
        return;
      }
      if (s.type === "move") {
        var from = activeP().location;
        var r = E.moveTo(UI.state, s.to);
        if (!r.ok) { E.endTurn(UI.state); setTimeout(step, stepDelay()); return; }
        if (!UI.botFast) UI.spectateScene(null);            // step outside to walk
        if (UI.mode === "host") window.PPNet.relayWalk(from, s.to);
        renderAll();
        if (UI.botFast) { setTimeout(step, 0); }
        else UI.walker.walkTo(s.to, from, function () { setTimeout(step, 120); });
        return;
      }
      // watching mode: open the building the bot is acting in
      if (!UI.botFast) {
        var loc = activeP().location;
        var a2 = E.ACTIONS[s.id];
        if (a2 && a2.building !== "anywhere" && UI.inScene !== loc) UI.spectateScene(loc);
      }
      var r2 = E.perform(UI.state, s.id, s.choice);
      if (!r2.ok || r2.needsChoice) { E.endTurn(UI.state); }
      renderAll();
      setTimeout(step, stepDelay());
    }
    step();
  }

  // ---------------- scenes: the painted art menus ARE the UI ----------------
  var PAINT = window.PP_HOTSPOTS || {};
  var BDC_MAP = window.PP_BDC_MAP || {};

  function paintedActionIds(id) {
    if (id === "club") return Object.keys(BDC_MAP).map(function (k) { return BDC_MAP[k]; });
    return (PAINT[id] || []).map(function (h) { return h.a; });
  }

  function openScene(id, spectate) {
    if (!spectate && isMyTurn()) window.PPNet && window.PPNet.sendView(id);
    UI.inScene = id;
    var b = DATA.buildings[id];
    var sv = $("#scene-view");
    var bd = $("#scene-backdrop"), vid = $("#scene-video"), frame = $("#bdc-frame");
    var painted = !!PAINT[id];
    if (b.video) {
      bd.style.display = "none";
      vid.style.display = "";
      if (!vid.src || vid.src.indexOf(b.video) === -1) vid.src = "assets/video/" + b.video;
      vid.play().catch(function () {});
      frame.style.display = "";
      if (!frame.src) frame.src = "assets/bdc-menu/index.html?embed=1";
    } else {
      vid.pause(); vid.style.display = "none";
      frame.style.display = "none";
      bd.style.display = "";
      bd.style.backgroundImage = "url('assets/scenes/" + b.scene + "')";
    }
    $("#scene-title").textContent = b.name;
    $("#fallback-panel").style.display = (painted || b.video) ? "none" : "";
    buildPaintLayer(painted ? id : null);
    sv.classList.add("show");
    A.setScene(id, E.isRentTurn(UI.state));
    renderSceneUI();
  }
  function closeScene(spectate) {
    if (!spectate && isMyTurn()) window.PPNet && window.PPNet.sendView(null);
    UI.inScene = null;
    $("#scene-video").pause();
    $("#scene-view").classList.remove("show");
    hideTip();
    A.setScene("overmap", E.isRentTurn(UI.state));
    renderAll();
  }
  function fxSummary(a) {
    var bits = [];
    a.gains.forEach(function (g) { bits.push("+" + Math.round(g.pct * UI.state.T) + " " + E.statName(g.stat)); });
    (a.petGains || []).forEach(function (g) { bits.push("+" + Math.round(g.pct * UI.state.T) + " " + E.statName(g.stat)); });
    a.penalties.forEach(function (g) { bits.push("-" + Math.round(g.pct * UI.state.T) + " " + E.statName(g.stat)); });
    return bits.join(", ");
  }

  // transparent buttons clipped over the painted menu buttons
  function buildPaintLayer(id) {
    var layer = $("#paint-layer");
    layer.innerHTML = "";
    if (!id) return;
    if (id === "mall") {           // the art has no Transportation tab - add a matching one
      var rides = document.createElement("button");
      rides.className = "mall-rides-tab";
      rides.textContent = "\ud83d\ude8c RIDES";
      rides.onclick = function () {
        if (!isMyTurn()) { toast("Not your turn"); return; }
        click(); doAction("A112");
      };
      layer.appendChild(rides);
    }
    PAINT[id].forEach(function (h) {
      var btn = document.createElement("button");
      btn.className = "paint-btn";
      btn.dataset.a = h.a;
      btn.style.left = h.box[0] + "%";
      btn.style.top = h.box[1] + "%";
      btn.style.width = h.box[2] + "%";
      btn.style.height = h.box[3] + "%";
      btn.innerHTML = '<span class="tu-chip"></span><span class="lock-chip" style="display:none">🔒</span>';
      btn.onmouseenter = function () { showTip(btn, h); };
      btn.onmouseleave = hideTip;
      btn.onclick = function () {
        if (!isMyTurn()) { toast("Not your turn"); return; }
        click();
        hideTip();
        doAction(h.a);
      };
      layer.appendChild(btn);
    });
  }
  function annFor(actionId) {
    var st = UI.state, p = activeP();
    var list = E.actionsAt(st, p);
    return list.filter(function (x) { return x.id === actionId; })[0] || null;
  }
  function showTip(btn, h) {
    var ann = annFor(h.a);
    var tip = $("#paint-tip");
    if (!ann) { hideTip(); return; }
    var a = ann.action, costBits = [];
    if (ann.tu) costBits.push("⏳ " + ann.tu + " TU");
    if (ann.cost) costBits.push("💵 $" + ann.cost);
    tip.innerHTML =
      '<div class="t-name">' + a.name + '</div>' +
      '<div class="t-cost">' + (costBits.join(" · ") || "Free") + "</div>" +
      (fxSummary(a) ? '<div class="t-fx">' + fxSummary(a) + "</div>" : "") +
      (!ann.ok ? '<div class="t-why">🔒 ' + ann.why + "</div>" : "") +
      ((UI.cfg && UI.cfg.hints && a.note) ? '<div class="t-note">💡 ' + a.note + "</div>" : "");
    tip.style.display = "";
    // place the tip just left of the painted panel, level with the button
    tip.style.right = (100 - h.box[0] + 1) + "%";
    tip.style.left = "auto";
    tip.style.top = Math.min(h.box[1], 78) + "%";
  }
  function hideTip() { $("#paint-tip").style.display = "none"; }

  function renderSceneUI() {
    var st = UI.state, p = activeP();
    var here = p.location === UI.inScene;
    // lock states on painted buttons
    $$("#paint-layer .paint-btn").forEach(function (btn) {
      var ann = here ? annFor(btn.dataset.a) : null;
      var locked = !ann || !ann.ok;
      btn.classList.toggle("locked", locked);
      btn.querySelector(".lock-chip").style.display = locked ? "" : "none";
      var tc = btn.querySelector(".tu-chip");
      if (ann) tc.textContent = ann.tu + " TU" + (ann.cost ? " · $" + ann.cost : "");
    });
    // fallback panel (buildings without painted menus — should be none)
    if ($("#fallback-panel").style.display !== "none") renderFallbackPanel();
    // "More" drawer count: real actions not painted into the art
    var extra = here ? extraActions() : [];
    var okCount = extra.filter(function (x) { return x.ok; }).length;
    $("#btn-more").textContent = "✚ More (" + okCount + ")";
    $("#btn-more").style.display = extra.length ? "" : "none";
    // live player chip covering the baked mockup chip
    var mains = ["connection", "health", "career", "happiness"];
    var chip = $("#scene-tu");
    if (window.PP_CHIP_WIDE) {
      // Austin's wide card art with live overlays (TUNE the % boxes to the art)
      if (!chip._wideBuilt) {
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
      $("#wc-money").textContent = "\ud83d\udcb5 $" + p.stats.money;
      $("#wc-tu").textContent = "\u23f3 " + p.tu + " TU \u00b7 " + dayClock(p);
      mains.forEach(function (stat) {
        $("#wc-bar-" + stat).style.width = Math.min(100, p.stats[stat] / st.T * 100) + "%";
      });
      ["coolness", "critical", "enlightenment"].forEach(function (stat) {
        $("#wc-coin-" + stat).textContent = p.stats[stat];
      });
      return;
    }
    chip.innerHTML =
      '<img src="' + cardSrc(p.code) + '" alt="">' +
      '<div><div class="n1">' + p.name + " · 💵 $" + p.stats.money + '</div>' +
      '<div class="n2">⏳ ' + p.tu + " TU · " + per(p.code).name + "</div></div>" +
      '<div class="mini-bars">' + mains.map(function (s) {
        return "<i><b style='width:" + Math.min(100, p.stats[s] / st.T * 100) + "%;background:" + STAT_META[s].color + "'></b></i>";
      }).join("") + "</div>";
  }
  function extraActions() {
    var st = UI.state, p = activeP();
    var painted = paintedActionIds(UI.inScene);
    return E.actionsAt(st, p).filter(function (x) { return painted.indexOf(x.id) === -1; });
  }
  function actionItemsHtml(actions, mine) {
    return actions.map(function (x, i) {
      var a = x.action, fx = fxSummary(a), costBits = [];
      if (x.tu) costBits.push(x.tu + " TU");
      if (x.cost) costBits.push("$" + x.cost);
      return '<button class="action-item" data-i="' + i + '" ' + ((!mine || !x.ok) ? "disabled" : "") + ">" +
        '<span class="a-name">' + a.name + '</span>' +
        '<span class="a-cost">' + (costBits.join("<br>") || "free") + '</span>' +
        (fx ? '<span class="a-fx">' + fx + "</span>" : "") +
        ((UI.cfg && UI.cfg.hints && a.note) ? '<span class="a-fx">💡 ' + a.note + "</span>" : "") +
        (!x.ok ? '<span class="a-why">' + x.why + "</span>" : "") +
        "</button>";
    }).join("") || '<div style="font-weight:800;padding:.6em">Nothing extra here.</div>';
  }
  function openMore() {
    var actions = extraActions();
    $("#more-title").textContent = DATA.buildings[UI.inScene].name + " — More Actions";
    $("#more-list").innerHTML = actionItemsHtml(actions, isMyTurn());
    $$("#more-list .action-item").forEach(function (btn) {
      btn.onclick = function () {
        click(); closeDialog("more");
        doAction(actions[+btn.dataset.i].id);
      };
    });
    openDialog("more");
  }
  function renderFallbackPanel() {
    var st = UI.state, p = activeP();
    var actions = E.actionsAt(st, p);
    $("#action-list").innerHTML = actionItemsHtml(actions, isMyTurn());
    $$("#action-list .action-item").forEach(function (btn) {
      btn.onclick = function () { click(); doAction(actions[+btn.dataset.i].id); };
    });
  }

  // ---- BDC animated side menu (iframe) -> engine actions ----
  window.addEventListener("message", function (ev) {
    var m = ev.data;
    if (!m || m.pp !== "bdc" || UI.inScene !== "club") return;
    var aid = m.type === "work" ? BDC_MAP.work : BDC_MAP[m.card];
    if (!aid) return;
    if (!isMyTurn()) { bdcSay("Not your turn!"); return; }
    var ann = annFor(aid);
    if (!ann) return;
    if (!ann.ok) { bdcSay("🔒 " + ann.why); return; }
    doAction(aid);
    var last = UI.state.log[UI.state.log.length - 1];
    if (last && UI.mode !== "guest") bdcSay(last.text.slice(0, 90));
  });
  function bdcSay(text) {
    var f = $("#bdc-frame");
    if (f && f.contentWindow) f.contentWindow.postMessage({ pp: "bdc-ctl", op: "setMessage", text: text }, "*");
  }

  function doAction(id, choice) {
    if (UI.mode === "guest") {
      // guests open choice dialogs locally, then send the completed intent
      var a = E.ACTIONS[id];
      if (a && !choice) {
        var shopFx = a.fx.filter(function (f) { return f.kind === "openShop"; })[0];
        if (shopFx) { openShop(shopFx.group, id); return; }
        if (a.fx.some(function (f) { return f.kind === "openJobDialog"; })) { openJobs(id); return; }
        if (a.fx.some(function (f) { return f.kind === "adoptPet"; })) { openPetChoice(id); return; }
      }
      dispatch("action", { id: id, choice: choice }); return;
    }
    var r = E.perform(UI.state, id, choice);
    if (!r.ok) { toast(r.why, "bad"); return; }
    if (r.needsChoice === "shop") { openShop(r.group, id); return; }
    if (r.needsChoice === "job") { openJobs(id); return; }
    if (r.needsChoice === "pet") { openPetChoice(id); return; }
    if (id === "A018") A.footsteps(1800);          // Take a Walk: audible footsteps
    afterDispatch("action", { id: id }, r);
    var last = UI.state.log[UI.state.log.length - 1];
    if (last && last.who === activeP().name) toast(last.text, last.cls);
  }

  // remote/CPU player entered or left a building: mirror it on this screen
  UI.spectateScene = function (id) {
    if (isMyTurn() && UI.mode !== "local") return;   // never override my own play
    if (id && UI.inScene !== id) openScene(id, true);
    else if (!id && UI.inScene) closeScene(true);
  };

  // ---------------- dialogs ----------------
  function openDialog(name) { $("#dlg-" + name).classList.add("show"); }
  function closeDialog(name) { $("#dlg-" + name).classList.remove("show"); }
  function closeAllDialogs() { $$(".dialog-veil").forEach(function (d) { d.classList.remove("show"); }); }

  function openShop(group, actionId) {
    var st = UI.state, p = activeP();
    var items = DATA.items.filter(function (i) { return i.group === group; });
    $("#shop-title").textContent = group;
    $("#shop-grid").innerHTML = items.map(function (it, i) {
      var cost = Math.round(it.costPct * st.T);
      var owned = p.items.indexOf(it.name) !== -1;
      var why = owned ? "Owned" : null;
      if (!why && p.stats.money < cost) why = "Not enough money";
      var fx = it.bonus ? "+" + Math.round(it.bonus.pct * st.T) + " " + E.statName(it.bonus.stat) : "";
      if (it.penalty) fx += " \u00b7 -" + Math.round(it.penalty.pct * st.T) + " " + E.statName(it.penalty.stat);
      return '<button class="shop-item ' + (owned ? "owned" : "") + '" data-i="' + i + '" ' + (why ? "disabled" : "") + ">" +
        '<div class="s-name">' + it.name + '</div>' +
        '<div class="s-fx">' + (fx || it.effect || "") + '</div>' +
        '<div class="s-cost">$' + cost + (why ? " — " + why : "") + "</div></button>";
    }).join("");
    openDialog("shop");
    $$("#shop-grid .shop-item").forEach(function (b) {
      b.onclick = function () {
        click();
        closeDialog("shop");
        doAction(actionId, { item: items[+b.dataset.i].name });
      };
    });
  }

  function openJobs(actionId) {
    var st = UI.state, p = activeP();
    var rows = E.jobsWithStatus(st, p);
    $("#job-list").innerHTML = rows.map(function (r, i) {
      var j = r.job, pay = Math.round(j.basePayT100 * st.T / 100);
      return '<button class="job-row ' + (r.current ? "current" : "") + '" data-i="' + i + '" ' + (r.why ? "disabled" : "") + ">" +
        '<span class="j-name">' + j.name + " · " + DATA.buildings[j.building].name + "</span>" +
        "<span>$" + pay + "/shift</span><span>" + j.tier + "</span>" +
        '<span class="j-req ' + (r.why ? "blocked" : "") + '">' + (r.why ? "🔒 " + r.why : (j.reqText || "No requirements")) + "</span>" +
        "</button>";
    }).join("");
    openDialog("jobs");
    $$("#job-list .job-row").forEach(function (b) {
      b.onclick = function () {
        click();
        var r = rows[+b.dataset.i];
        closeDialog("jobs");
        doAction(actionId, { job: r.job.name, building: r.job.building });
      };
    });
  }

  var PET_EMOJI = { ENFP: "\ud83d\udc15", ESTP: "\ud83e\udd8a", ENTP: "\ud83e\udd9c", ESFP: "\ud83e\udda9",
    ENFJ: "\ud83d\udc2c", ESFJ: "\ud83d\udc08", ENTJ: "\ud83e\udd85", ESTJ: "\ud83d\udc3a",
    INTJ: "\ud83e\udd89", ISTJ: "\ud83d\udc22", ISFJ: "\ud83d\udc30", INFJ: "\ud83e\udd8c",
    INFP: "\ud83e\udd84", ISFP: "\ud83d\udc39", ISTP: "\ud83e\udd8e", INTP: "\ud83d\udc19" };
  function openPetChoice(actionId) {
    var p = activeP();
    $("#pet-grid").innerHTML = Object.keys(DATA.pets).map(function (code) {
      var pet = DATA.pets[code], pp = per(code);
      // real pet art drops in via assets/pets/<code>.png later; emoji until then
      return '<button class="shop-item pet-card" data-code="' + code + '">' +
        '<div class="pet-pic">' + (PET_EMOJI[code] || "\ud83d\udc3e") + "</div>" +
        '<div class="s-name">' + pp.name.replace("The ", "") + " Pet</div>" +
        '<div class="pet-hover">Boosts <b>' + E.statName(pet.main) + "</b> & <b>" + E.statName(pet.upkeep) + "</b>" +
        "<br>+10% on a neutral stat \u00b7 +5% stacking a strength \u00b7 halves a matching weakness" +
        '<br><i>\u201c' + pp.tag + '\u201d</i></div></button>';
    }).join("");
    openDialog("pets");
    $$("#pet-grid .shop-item").forEach(function (b) {
      b.onclick = function () {
        click(); closeDialog("pets");
        doAction(actionId, { pet: b.dataset.code });
      };
    });
  }

  function openStats() {
    var st = UI.state;
    $("#stats-body").innerHTML = st.players.map(function (p) {
      var petTxt = p.pet ? (p.pet.dead ? "💀 dead" : E.petState(st, p) + " (" + p.pet.health + "/" + p.pet.happiness + ")") : "—";
      return '<div class="paper-card" style="padding:.6em .8em;margin-bottom:.5em">' +
        "<b>" + p.name + "</b> · " + per(p.code).name + " · Score " + E.score(st, p) +
        '<div class="stat-rows" style="margin-top:.3em">' +
        Object.keys(STAT_META).map(function (s) { return statRow(s, p.stats[s], st.T); }).join("") +
        "</div><div style='font-size:.85em;margin-top:.3em'>🐾 " + petTxt +
        " · 💼 " + (p.job ? p.job.name : "none") + " · 🎓 " + (p.degrees.join(", ") || "none") +
        " · 🎒 " + (p.items.join(", ") || "no items") + "</div></div>";
    }).join("");
    openDialog("stats");
  }
  function openLog() {
    $("#log-body").innerHTML = '<div class="log-lines">' +
      UI.state.log.slice(-120).reverse().map(function (l) {
        return '<div class="ll ' + l.cls + '"><b>T' + l.turn + "</b>" + (l.who ? "<b>" + l.who + "</b>" : "") + l.text + "</div>";
      }).join("") + "</div>";
    openDialog("log");
  }
  function openMenu() {
    $("#menu-body").innerHTML =
      '<div style="display:flex;flex-direction:column;gap:.5em">' +
      '<button class="btn" id="m-resume">Back to Game</button>' +
      '<button class="btn secondary" id="m-settings">Settings</button>' +
      '<button class="btn secondary" id="m-debug">Balance Debug Panel</button>' +
      '<button class="btn danger" id="m-quit">Quit to Title</button></div>';
    openDialog("menu");
    $("#m-resume").onclick = function () { click(); closeDialog("menu"); };
    $("#m-settings").onclick = function () { click(); closeDialog("menu"); show("settings"); };
    $("#m-debug").onclick = function () { click(); closeDialog("menu"); openDebug(); };
    $("#m-quit").onclick = function () {
      click();
      if (!confirm("Quit to title? The game is saved and can be continued.")) return;
      closeAllDialogs(); stopTimer(); show("start"); initStart();
    };
  }
  function openDebug() {
    var winners = JSON.parse(window.PPStore.get("pp_winners") || "[]");
    var txt = "SEED: " + UI.state.seed + "   T: " + UI.state.T + "   TURN: " + UI.state.turn +
      "\n\nWINNER HISTORY (" + winners.length + " games):\n" +
      winners.map(function (w) { return w.date + "  " + w.winner + "  score " + w.score + "  rounds " + w.rounds; }).join("\n") +
      "\n\nBALANCE WATCH: Connection is the slowest main stat in simulation — club actions are " +
      "gated behind Dressy Clothes + money.\n\nASSUMED VALUES (js/assumptions.js):\n" +
      JSON.stringify(ASSUME, function (k, v) { return k === "extraActions" ? undefined : v; }, 1);
    $("#debug-body").textContent = txt;
    openDialog("debug");
    $("#btn-copy-log").onclick = function () {
      click();
      var payload = JSON.stringify({ seed: UI.state.seed, T: UI.state.T, turn: UI.state.turn,
        players: UI.state.players, log: UI.state.log, winners: winners }, null, 1);
      navigator.clipboard.writeText(payload).then(function () { toast("Playtest log copied!", "good"); });
    };
  }

  // ---------------- podium ----------------
  function openPodium() {
    stopTimer();
    clearSave();
    var st = UI.state, pod = E.podium(st);
    // winner history for the balance rule in Manual §6.5
    try {
      var winners = JSON.parse(window.PPStore.get("pp_winners") || "[]");
      winners.push({ date: new Date().toISOString().slice(0, 10), winner: pod[0].player.code,
        score: pod[0].score, rounds: st.turn, T: st.T });
      window.PPStore.set("pp_winners", JSON.stringify(winners));
    } catch (e) {}
    var order = [1, 0, 2, 3].filter(function (i) { return i < pod.length; }); // 2nd,1st,3rd,4th visual
    var hts = { 0: "7em", 1: "4.5em", 2: "3em", 3: "1.8em" };
    $("#podium-row").innerHTML = order.map(function (i) {
      var e = pod[i];
      return '<div class="podium-slot">' +
        '<div class="place">' + ["🥇", "🥈", "🥉", "4th"][i] + "</div>" +
        '<img src="' + cardSrc(e.player.code) + '">' +
        '<div style="font-weight:900">' + e.player.name + "</div>" +
        '<div style="font-size:.8em">' + per(e.player.code).name + "</div>" +
        '<div class="p-score">' + e.score + "</div>" +
        '<div class="pedestal" style="height:' + hts[i] + '"></div></div>';
    }).join("");
    $("#podium-table").innerHTML =
      "<tr><th>Player</th><th>Connection</th><th>Health</th><th>Career</th><th>Happiness</th><th>Upkeep avg</th><th>Pet avg</th><th>Total</th></tr>" +
      pod.map(function (e) {
        var b = e.breakdown;
        return "<tr><td><b>" + e.player.name + "</b></td><td>" + b.connection + "</td><td>" + b.health +
          "</td><td>" + b.career + "</td><td>" + b.happiness + "</td><td>" + b.upkeepAvg +
          "</td><td>" + b.petAvg + "</td><td><b>" + e.score + "</b></td></tr>";
      }).join("");
    show("podium");
    A.playMusic(DATA.music.overmap);
  }

  // ---------------- settings screen ----------------
  function initSettings() {
    var s = A.state;
    $("#set-master").value = s.master * 100;
    $("#set-music").value = s.music * 100;
    $("#set-sfx").value = s.sfx * 100;
    $("#set-mode").value = s.musicMode;
    $("#set-mute").checked = s.muted;
    $("#set-timerwarn").checked = window.PPStore.get("pp_timerwarn") !== "off";
    $("#set-master").oninput = function () { A.set("master", this.value / 100); };
    $("#set-music").oninput = function () { A.set("music", this.value / 100); };
    $("#set-sfx").oninput = function () { A.set("sfx", this.value / 100); };
    $("#set-mode").onchange = function () { A.set("musicMode", this.value); if (UI.state) A.setScene(UI.inScene || "overmap", E.isRentTurn(UI.state)); };
    $("#set-mute").onchange = function () { A.set("muted", this.checked); };
    $("#set-timerwarn").onchange = function () { window.PPStore.set("pp_timerwarn", this.checked ? "on" : "off"); };
    $("#set-fullscreen").onclick = function () {
      click();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(function () {});
    };
  }

  // ---------------- multiplayer menus (flows live in net.js) ----------------
  function openMultiMenu() {
    $("#multi-body").innerHTML =
      '<div style="display:flex;flex-direction:column;gap:.6em">' +
      '<button class="btn" id="mm-host">Host a Room</button>' +
      '<button class="btn secondary" id="mm-join">Join with Code</button>' +
      '<div style="font-size:.85em;opacity:.8">Host + join works over the internet (peer-to-peer). ' +
      "The host's browser runs the game; if the host closes the tab, the game ends for everyone.</div></div>";
    openDialog("multi");
    $("#mm-host").onclick = function () { click(); closeDialog("multi"); window.PPNet.host(); };
    $("#mm-join").onclick = function () {
      click();
      var code = prompt("Room code (5 letters):", "");
      if (!code) return;
      closeDialog("multi");
      window.PPNet.join(code.trim().toUpperCase());
    };
  }

  // resize: keep 1em ≈ 1% of stage width
  function fitStage() {
    var el = $("#stage");
    el.style.setProperty("--stage-w", el.clientWidth + "px");
  }
  window.addEventListener("resize", fitStage);

  // Pure screen-navigation wiring. Runs FIRST and touches no state at all, so
  // these buttons can never be dead — whatever else fails during init.
  function wireNavigation() {
    $("#btn-settings-back").onclick = function () {
      try { click(); } catch (e) {}
      show(UI.state && !UI.state.over ? "game" : "start");
    };
    $("#btn-setup-back").onclick = function () { try { click(); } catch (e) {} show("start"); };
    $("#btn-back-title").onclick = function () { try { click(); } catch (e) {} show("start"); try { initStart(); } catch (e) {} };
    $("#btn-settings").onclick = function () { try { click(); } catch (e) {} show("settings"); };
    $$(".dialog-veil .close-x").forEach(function (x) {
      x.onclick = function () { try { click(); } catch (e) {} x.closest(".dialog-veil").classList.remove("show"); };
    });
  }

  // Austin's wide Casey chip art (building HUD): auto-used the moment the file exists.
  (function probeWideChip() {
    var img = new Image();
    img.onload = function () { window.PP_CHIP_WIDE = img.src; };
    img.src = "assets/cards/casey_chip_wide.png";
  })();

  // wire static buttons
  function init() {
    function safe(fn, name) {
      try { fn(); } catch (e) { console.error("init failed:", name, e); }
    }
    safe(wireNavigation, "wireNavigation");
    safe(fitStage, "fitStage");
    safe(initStart, "initStart");
    safe(initSettings, "initSettings");
    $("#btn-start-game").onclick = function () {
      click();
      if (setup.mode === "host") window.PPNet.startHostedGame(setup);
      else startLocalGame();
    };
    $("#btn-leave-scene").onclick = function () { click(); closeScene(); };
    $("#btn-more").onclick = function () { click(); openMore(); };
    $("#skip-cpu").onclick = function () { click(); UI.botFast = true; };
    var muteB = $("#music-mute");
    function muteIcon() { muteB.textContent = A.state.musicMuted ? "\ud83d\udd07" : "\ud83c\udfb5"; }
    muteB.onclick = function () { click(); A.set("musicMuted", !A.state.musicMuted); muteIcon(); };
    muteIcon();
    $("#btn-rematch").onclick = function () {
      click();
      if (UI.cfg) { UI.state = E.newGame(UI.cfg); UI.mySlots = UI.cfg.players.map(function (p, i) { return p.isBot ? -1 : i; }).filter(function (i) { return i >= 0; }); startGameUI(false); }
    };
    $("#btn-back-setup").onclick = function () { click(); openSetup(setup ? setup.mode : "single"); };
    show("start");
  }
  document.addEventListener("DOMContentLoaded", init);

  // exports for net.js
  UI.renderAll = renderAll;
  UI.startGameUI = startGameUI;
  UI.turnIntro = turnIntro;
  UI.openSetup = openSetup;
  UI.setSetup = function (s) { setup = s; };
  UI.getSetup = function () { return setup; };
  UI.startLocalGame = startLocalGame;
  UI.toast = toast;
  UI.showScreen = show;
  UI.openPodium = openPodium;
  UI.renderSetup = renderSetup;
  UI.dispatch = dispatch;
  UI.doAction = doAction;
  UI.maybeRunBot = maybeRunBot;
})();
