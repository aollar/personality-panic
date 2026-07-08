/*
 * PERSONALITY PANIC — remote multiplayer (peer-to-peer via PeerJS).
 * Host-authoritative per Manual §17: the host's browser runs the engine;
 * guests are views that send intents. Works over the internet with a room
 * code — no server of ours needed (PeerJS public broker + WebRTC).
 * If a guest disconnects, a CPU bot takes over until they rejoin (same name).
 */
(function () {
  var UI = window.PPUI;
  var NET = {
    peer: null, conns: [],       // host: DataConnections
    conn: null,                  // guest: connection to host
    code: null, isHost: false,
    roster: [],                  // lobby: [{name, code(personality), slot, connId}]
    mySlot: 0, opts: { length: "short", timer: 0, bots: 0, maxRounds: 15, skipCpu: true, hints: true }
  };
  window.PPNet = NET;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var E = window.PPEngine, DATA = window.PP_DATA;

  function peerId(code) { return "pp-panic-room-" + code; }
  function makeCode() {
    var abc = "ABCDEFGHJKMNPQRSTUVWXYZ", out = "";
    for (var i = 0; i < 5; i++) out += abc[Math.floor(Math.random() * abc.length)];
    return out;
  }
  function needPeerJS() {
    if (typeof Peer === "undefined") {
      UI.toast("Multiplayer needs an internet connection (PeerJS failed to load)", "bad");
      return true;
    }
    return false;
  }

  // ---------------- HOST ----------------
  NET.host = function () {
    if (needPeerJS()) return;
    NET.isHost = true;
    NET.code = makeCode();
    NET.roster = [{ name: myName(), code: null, slot: 0, connId: "host" }];
    NET.peer = new Peer(peerId(NET.code));
    NET.peer.on("open", function () {
      openLobby();
      if (NET._hb) clearInterval(NET._hb);
      NET._hb = setInterval(function () {          // prune ghosts that never said bye
        var now = Date.now();
        NET.conns.slice().forEach(function (c) {
          if (c._seen && now - c._seen > 12000) { hostDropGuest(c); try { c.close(); } catch (e) {} }
          else send(c, { t: "hb" });
        });
      }, 4000);
    });
    NET.peer.on("error", function (e) {
      if (String(e).indexOf("unavailable-id") !== -1) { NET.code = makeCode(); NET.peer = null; NET.host(); }
      else UI.toast("Network error: " + e.type, "bad");
    });
    NET.peer.on("connection", function (c) {
      c.on("open", function () { c._seen = Date.now(); NET.conns.push(c); });
      c.on("data", function (msg) { hostOnData(c, msg); });
      c.on("close", function () { hostDropGuest(c); });
    });
  };
  function myName() {
    var n = window.PPStore.get("pp_name") || "";
    if (!n) { n = prompt("Your name:", "Player 1") || "Player 1"; window.PPStore.set("pp_name", n.slice(0, 14)); }
    return window.PPStore.get("pp_name") || "Player 1";
  }
  function hostOnData(c, msg) {
    if (msg.t === "hello") {
      // rejoin? a bot slot with the same name gets handed back
      if (UI.state) {
        var back = UI.state.players.findIndex(function (p) { return p.isBot && p.rejoinName === msg.name; });
        if (back >= 0) {
          UI.state.players[back].isBot = false;
          c.slotIdx = back;
          send(c, { t: "start", state: E.serialize(UI.state), slot: back,
                    opts: NET.opts });
          UI.toast(msg.name + " reconnected!", "good");
          NET.broadcastState();
          return;
        }
        send(c, { t: "full" }); return;
      }
      if (NET.roster.length >= 4) { send(c, { t: "full" }); return; }
      var slot = NET.roster.length;
      NET.roster.push({ name: msg.name.slice(0, 14), code: null, slot: slot, connId: c.peer });
      c.slotIdx = slot;
      broadcastLobby();
      renderLobby();
    }
    if (msg.t === "pick") {
      var r = NET.roster.filter(function (x) { return x.connId === c.peer; })[0];
      if (r && !NET.roster.some(function (x) { return x.code === msg.code && x !== r; })) r.code = msg.code;
      broadcastLobby(); renderLobby();
    }
    if (msg.t === "hbAck") { c._seen = Date.now(); }
    if (msg.t === "bye") { hostDropGuest(c); try { c.close(); } catch (e) {} return; }
    if (msg.t === "rename") {
      var rr = NET.roster.filter(function (x) { return x.connId === c.peer; })[0];
      if (rr) { rr.name = String(msg.name || "").slice(0, 14) || rr.name; broadcastLobby(); renderLobby(); }
      return;
    }
    if (msg.t === "view" && UI.state) {
      if (c.slotIdx !== UI.state.activeIdx) return;
      UI.spectateScene(msg.scene);                       // host mirrors it too
      NET.conns.forEach(function (o) { if (o !== c) send(o, { t: "view", scene: msg.scene }); });
      return;
    }
    if (msg.t === "begin" && UI.state) {
      // active player pressed "Start Turn": sync every spectator's countdown
      if (c.slotIdx !== UI.state.activeIdx) return;
      UI.syncTimerStart();
      NET.conns.forEach(function (o) { if (o !== c) send(o, { t: "begin" }); });
      return;
    }
    if (msg.t === "intent" && UI.state) {
      if (c.slotIdx !== UI.state.activeIdx) return; // not their turn
      if (msg.kind === "move") E.moveTo(UI.state, msg.payload.to);
      else if (msg.kind === "action") {
        var r2 = E.perform(UI.state, msg.payload.id, msg.payload.choice);
        if (r2 && r2.needsChoice) { send(c, { t: "choice", need: r2.needsChoice, group: r2.group, actionId: msg.payload.id }); return; }
      }
      else if (msg.kind === "end") {
        E.endTurn(UI.state);
        NET.broadcastState();
        if (UI.state.over) { UI.openPodium(); return; }
        UI.turnIntro();     // restarts the host's clock for whoever is next (incl. bots)
        return;
      }
      NET.broadcastState();
      UI.renderAll();
      if (UI.state.over) UI.openPodium();
      else UI.maybeRunBot();
    }
  }
  function hostDropGuest(c) {
    NET.conns = NET.conns.filter(function (x) { return x !== c; });
    if (UI.state && c.slotIdx != null) {
      var p = UI.state.players[c.slotIdx];
      if (p && !p.isBot) {
        p.isBot = true; p.rejoinName = p.name;
        UI.toast(p.name + " disconnected — a bot takes over (they can rejoin with the code)", "bad");
        NET.broadcastState();
        UI.maybeRunBot();
      }
    } else {
      NET.roster = NET.roster.filter(function (r) { return r.connId !== c.peer; });
      NET.roster.forEach(function (r, i) { r.slot = i; });
      broadcastLobby(); renderLobby();
    }
  }
  function send(c, obj) { try { c.send(obj); } catch (e) {} }
  function broadcast(obj) { NET.conns.forEach(function (c) { send(c, obj); }); }
  function broadcastLobby() { broadcast({ t: "lobby", roster: NET.roster, code: NET.code, opts: NET.opts }); }
  NET.broadcastState = function () {
    if (!NET.isHost || !UI.state) return;
    broadcast({ t: "state", state: E.serialize(UI.state) });
  };
  NET.hostSlots = function () { return [0]; };

  // ---------------- GUEST ----------------
  NET.join = function (code) {
    if (needPeerJS()) return;
    NET.isHost = false;
    NET.code = code;
    NET.peer = new Peer();
    NET.peer.on("open", function () {
      NET.conn = NET.peer.connect(peerId(code), { reliable: true });
      NET.conn.on("open", function () { NET.conn.send({ t: "hello", name: myName() }); openLobby(); });
      NET.conn.on("data", guestOnData);
      NET.conn.on("close", function () { UI.toast("Lost connection to the host", "bad"); UI.showScreen("start"); });
    });
    NET.peer.on("error", function (e) {
      UI.toast(String(e.type) === "peer-unavailable" ? "Room not found — check the code" : "Network error", "bad");
    });
  };
  function guestOnData(msg) {
    if (msg.t === "hb") { if (NET.conn) NET.conn.send({ t: "hbAck" }); return; }
    if (msg.t === "closed") {
      UI.toast("The host closed the room", "bad");
      document.querySelector("#dlg-lobby").classList.remove("show");
      NET.leave(); UI.showScreen("start");
      return;
    }
    if (msg.t === "view") { UI.spectateScene(msg.scene); return; }
    if (msg.t === "walk" && UI.state) {
      if (!UI.walker.raf) {
        window.PPAudio.startMove(msg.transport || "walk");
        UI.walker.walkTo(msg.to, msg.from, function () { window.PPAudio.stopMove(); });
      }
      return;
    }
    if (msg.t === "lobby") { NET.roster = msg.roster; NET.code = msg.code; NET.opts = msg.opts; renderLobby(); }
    if (msg.t === "full") { UI.toast("Room is full / game already running", "bad"); }
    if (msg.t === "start") {
      UI.state = E.deserialize(msg.state);
      UI.mode = "guest";
      UI.mySlots = [msg.slot];
      UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
      document.querySelector("#dlg-lobby").classList.remove("show");
      UI.startGameUI(false);
    }
    if (msg.t === "begin") { UI.syncTimerStart(); return; }   // active player started their turn
    if (msg.t === "state") {
      var wasMyTurn = UI.state && UI.mySlots.indexOf(UI.state.activeIdx) !== -1;
      var prevActive = UI.state ? UI.state.activeIdx : -1;
      UI.state = E.deserialize(msg.state);
      if (UI.state.over) { UI.openPodium(); return; }
      UI.renderAll();
      // keep every client's music in sync with the rent cycle (TTTTT item 4)
      window.PPAudio.setScene(UI.inScene || "overmap", E.isRentTurn(UI.state));
      var nowMyTurn = UI.mySlots.indexOf(UI.state.activeIdx) !== -1;
      if (nowMyTurn && !wasMyTurn) UI.turnIntro();
      else if (UI.state.activeIdx !== prevActive) UI.spectateTurnChange();  // fresh clock for their turn
    }
    if (msg.t === "choice") {
      // host bounced a choice-action back: open the right picker
      if (msg.need === "shop") UI.doActionShopRemote(msg.group, msg.actionId);
      if (msg.need === "course") UI.doActionCourseRemote(msg.actionId);
    }
  }
  NET.sendIntent = function (kind, payload) {
    if (NET.conn) NET.conn.send({ t: "intent", kind: kind, payload: payload });
  };
  // "Start Turn" pressed: let every other client restart its spectator clock
  NET.sendBegin = function () {
    if (NET.isHost) broadcast({ t: "begin" });
    else if (NET.conn) NET.conn.send({ t: "begin" });
  };
  // scene view sync: my open/close building -> everyone's screen
  NET.sendView = function (scene) {
    if (NET.isHost) broadcast({ t: "view", scene: scene });
    else if (NET.conn) NET.conn.send({ t: "view", scene: scene });
  };
  // walk animation relay (host-authoritative); transport lets spectators HEAR it
  NET.relayWalk = function (from, to, transport) {
    if (NET.isHost) broadcast({ t: "walk", from: from, to: to, transport: transport || "walk" });
  };
  NET.leave = function () {
    try { if (NET.conn) NET.conn.send({ t: "bye" }); } catch (e) {}
    try { if (NET.conn) NET.conn.close(); } catch (e) {}
    try { if (NET.isHost) broadcast({ t: "closed" }); } catch (e) {}
    try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
    if (NET._hb) { clearInterval(NET._hb); NET._hb = null; }
    NET.peer = null; NET.conn = null; NET.conns = []; NET.roster = []; NET.isHost = false;
  };

  // ---------------- LOBBY UI (shared) ----------------
  function openLobby() {
    renderLobby();
    var dlg = document.querySelector("#dlg-lobby");
    dlg.classList.add("show");
    dlg.querySelector(".close-x").onclick = function () {   // leaving really leaves
      dlg.classList.remove("show");
      NET.leave();
      UI.toast("Left the room");
    };
  }
  function renderLobby() {
    var el = $("#lobby-body");
    if (!el) return;
    var mine = NET.isHost ? NET.roster[0] : NET.roster.filter(function (r) { return !NET.isHost && r.name === myName(); })[0];
    var taken = NET.roster.map(function (r) { return r.code; });
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:1em;flex-wrap:wrap">' +
      '<span class="room-code-chip">' + (NET.code || "…") + "</span>" +
      "<div><b>Share this room code.</b><br><span style='font-size:.85em'>Friends: Multiplayer → Join with Code. Works over the internet.</span></div></div>" +
      '<div class="lobby-list">' + NET.roster.map(function (r) {
        var mineRow = NET.isHost ? r.slot === 0 : r.name === myName();
        return '<div class="lp"><span>' + (r.slot === 0 ? "👑 " : "") + r.name +
          (mineRow ? ' <button class="btn small" id="lobby-rename" title="Change name">✏️</button>' : "") + "</span><span>" +
          (r.code ? DATA.personalities[r.code].name + " (" + r.code + ")" : "picking…") + "</span></div>";
      }).join("") + "</div>" +
      '<div style="font-weight:900;margin:.3em 0">Pick your character:</div>' +
      '<div class="char-grid" style="grid-template-columns:repeat(8,1fr)">' +
      Object.keys(DATA.personalities).map(function (code) {
        var pp = DATA.personalities[code];
        var isMine = mine && mine.code === code;
        var isTaken = taken.indexOf(code) !== -1 && !isMine;
        return '<div class="char-card ' + (isMine ? "selected" : "") + (isTaken ? " taken" : "") + '" data-code="' + code + '">' +
          '<img src="assets/cards/' + pp.card + '" loading="lazy"></div>';
      }).join("") + "</div>" +
      (NET.isHost ? hostOptsHtml() : '<div style="margin-top:.5em;font-weight:800">Waiting for the host to start…</div>');
    var rn = $("#lobby-rename");
    if (rn) rn.onclick = function () {
      var n = prompt("Your name:", myName());
      if (!n) return;
      n = n.slice(0, 14);
      window.PPStore.set("pp_name", n);
      if (NET.isHost) { NET.roster[0].name = n; broadcastLobby(); renderLobby(); }
      else if (NET.conn) NET.conn.send({ t: "rename", name: n });
    };
    $$("#lobby-body .char-card").forEach(function (c) {
      c.onclick = function () {
        var code = c.dataset.code;
        if (NET.isHost) {
          if (NET.roster.some(function (r) { return r.code === code && r.slot !== 0; })) return;
          NET.roster[0].code = code;
          broadcastLobby(); renderLobby();
        } else {
          NET.conn.send({ t: "pick", code: code });
        }
      };
    });
    if (NET.isHost) wireHostOpts();
  }
  function hostOptsHtml() {
    var o = NET.opts;
    return '<div style="margin-top:.6em;display:flex;gap:.5em;flex-wrap:wrap;align-items:center">' +
      '<label>Length <select id="lob-length"><option value="short">Short (T=100)</option><option value="medium">Medium (T=500)</option><option value="long">Long (T=1000)</option></select></label>' +
      '<label>Timer <select id="lob-timer"><option value="0">Unlimited</option><option>30</option><option>60</option><option>90</option><option>120</option></select></label>' +
      '<label>Bots <select id="lob-bots"><option>0</option><option>1</option><option>2</option><option>3</option></select></label>' +
      '<label>Ends after <select id="lob-max"><option value="0">stat max only</option><option>20</option><option selected>30</option><option>40</option><option>60</option></select> turns</label>' +
      '<button class="btn" id="lob-start">Start Game ▶</button></div>';
  }
  function wireHostOpts() {
    ["length", "timer", "bots", "max"].forEach(function (k) {
      var el = $("#lob-" + k); if (!el) return;
      el.value = { length: NET.opts.length, timer: NET.opts.timer, bots: NET.opts.bots, max: NET.opts.maxRounds }[k];
      el.onchange = function () {
        if (k === "length") NET.opts.length = el.value;
        if (k === "timer") NET.opts.timer = +el.value;
        if (k === "bots") NET.opts.bots = +el.value;
        if (k === "max") NET.opts.maxRounds = +el.value;
        broadcastLobby();
      };
    });
    var st = $("#lob-start");
    if (st) st.onclick = function () {
      var total = NET.roster.length + NET.opts.bots;
      if (NET.roster.some(function (r) { return !r.code; })) { UI.toast("Everyone needs to pick a character", "bad"); return; }
      if (total < 2) { UI.toast("Need at least 2 participants — add a bot", "bad"); return; }
      startHosted();
    };
  }
  function startHosted() {
    var used = NET.roster.map(function (r) { return r.code; });
    var free = Object.keys(DATA.personalities).filter(function (c) { return used.indexOf(c) === -1; });
    var players = NET.roster.map(function (r) { return { name: r.name, code: r.code, isBot: false }; });
    for (var i = 0; i < NET.opts.bots && players.length < 4; i++)
      players.push({ name: "CPU " + (i + 1), code: free[i], isBot: true });
    UI.cfg = { T: DATA.settings.gameLengths[NET.opts.length], timerSeconds: NET.opts.timer,
               maxRounds: NET.opts.maxRounds, hints: true, skipCpu: true, players: players };
    UI.state = E.newGame(UI.cfg);
    UI.mode = "host";
    UI.mySlots = [0];
    // tell each guest their slot
    NET.conns.forEach(function (c) {
      send(c, { t: "start", state: E.serialize(UI.state), slot: c.slotIdx, opts: NET.opts });
    });
    document.querySelector("#dlg-lobby").classList.remove("show");
    UI.startGameUI(false);
  }

  // guest remote shop picker (host bounced needsChoice back)
  UI.doActionShopRemote = function (group, actionId) {
    var items = DATA.items.filter(function (i) { return i.group === group; });
    var st = UI.state, p = st.players[st.activeIdx];
    $("#shop-title").textContent = group;
    $("#shop-grid").innerHTML = items.map(function (it, i) {
      var cost = Math.round(it.costPct * st.T);
      var owned = p.items.indexOf(it.name) !== -1;
      return '<button class="shop-item ' + (owned ? "owned" : "") + '" data-i="' + i + '" ' + (owned || p.stats.money < cost ? "disabled" : "") + ">" +
        '<div class="s-name">' + it.name + '</div><div class="s-cost">$' + cost + "</div></button>";
    }).join("");
    document.querySelector("#dlg-shop").classList.add("show");
    $$("#shop-grid .shop-item").forEach(function (b) {
      b.onclick = function () {
        document.querySelector("#dlg-shop").classList.remove("show");
        NET.sendIntent("action", { id: actionId, choice: { item: items[+b.dataset.i].name } });
      };
    });
  };
  // guest remote course picker (host bounced needsChoice back)
  UI.doActionCourseRemote = function (actionId) {
    var courses = (window.PP_ASSUMPTIONS && window.PP_ASSUMPTIONS.courses) || [];
    $("#shop-title").textContent = "📚 Course Catalog";
    $("#shop-grid").innerHTML = courses.map(function (c, i) {
      return '<button class="shop-item" data-i="' + i + '">' +
        '<div class="s-name">' + c.name + "</div><div class='s-cost'>" + c.blurb + "</div></button>";
    }).join("");
    document.querySelector("#dlg-shop").classList.add("show");
    $$("#shop-grid .shop-item").forEach(function (b) {
      b.onclick = function () {
        document.querySelector("#dlg-shop").classList.remove("show");
        NET.sendIntent("action", { id: actionId, choice: { course: courses[+b.dataset.i].name } });
      };
    });
  };
})();
