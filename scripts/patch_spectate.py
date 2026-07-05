# Spectate + multiplayer-courtesy patch:
#  - opponents' scenes open on every screen (network view-sync + CPU turns)
#  - walk animations relayed to all clients (+ optimistic guest walk)
#  - Start Turn card only for YOUR turn
#  - lobby: rename, clean leave, heartbeat ghost pruning
import io

# ================= ui.js =================
p = "js/ui.js"; s = io.open(p, encoding="utf-8").read()

def swap(old, new, tag):
    global s
    assert old in s, "MISSING ui: " + tag
    s = s.replace(old, new)

# ---- Start Turn card: only when it's actually YOUR turn ----
swap("""  function turnIntro() {
    var p = activeP();
    if (p.isBot) { renderAll(); maybeRunBot(); startTimer(); return; }
    if (UI.mode !== "guest" || isMyTurn()) openTurnCard();
    renderAll();
  }""",
"""  function turnIntro() {
    var p = activeP();
    if (p.isBot) { renderAll(); maybeRunBot(); startTimer(); return; }
    if (isMyTurn()) openTurnCard();          // spectators just watch the map + feed
    renderAll();
  }""", "turnIntro")

# ---- view sync: my scene opens on everyone else's screen ----
swap("""  function openScene(id) {
    UI.inScene = id;""",
"""  function openScene(id, spectate) {
    if (!spectate && isMyTurn()) window.PPNet && window.PPNet.sendView(id);
    UI.inScene = id;""", "openScene view")
swap("""  function closeScene() {
    UI.inScene = null;""",
"""  function closeScene(spectate) {
    if (!spectate && isMyTurn()) window.PPNet && window.PPNet.sendView(null);
    UI.inScene = null;""", "closeScene view")

# spectator entry point used by net.js and the CPU loop
swap("""  // ---------------- dialogs ----------------""",
"""  // remote/CPU player entered or left a building: mirror it on this screen
  UI.spectateScene = function (id) {
    if (isMyTurn() && UI.mode !== "local") return;   // never override my own play
    if (id && UI.inScene !== id) openScene(id, true);
    else if (!id && UI.inScene) closeScene(true);
  };

  // ---------------- dialogs ----------------""", "spectateScene")

# ---- CPU turns: watch the bot walk in, act inside, walk out ----
swap("""      if (s.type === "move") {
        var from = activeP().location;
        var r = E.moveTo(UI.state, s.to);
        if (!r.ok) { E.endTurn(UI.state); setTimeout(step, stepDelay()); return; }
        renderAll();
        if (UI.botFast) { setTimeout(step, 0); }
        else UI.walker.walkTo(s.to, from, function () { setTimeout(step, 120); });
        return;
      }
      var r2 = E.perform(UI.state, s.id, s.choice);
      if (!r2.ok || r2.needsChoice) { E.endTurn(UI.state); }
      renderAll();
      setTimeout(step, stepDelay());""",
"""      if (s.type === "move") {
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
      setTimeout(step, stepDelay());""", "bot spectate")

# close the spectated scene when the bot's turn ends
swap("""      if (s.type === "end") {
        E.endTurn(UI.state);
        UI._botSteps = 0;
        saveGame();""",
"""      if (s.type === "end") {
        UI.spectateScene(null);
        E.endTurn(UI.state);
        UI._botSteps = 0;
        saveGame();""", "bot end close scene")

# ---- guests: walk before the state snaps them to the destination ----
swap("""  function onHotspot(id) {
    if (!UI.state || UI.state.over) return;
    if (!isMyTurn()) { toast("Not your turn"); return; }
    var p = activeP();
    click();
    if (p.location === id) { openScene(id); return; }
    var mc = E.moveCost(UI.state, p, id);
    if (mc.tu > p.tu) { toast("Not enough Time Units to travel (" + mc.tu + " TU)", "bad"); return; }
    if (UI.mode === "guest") { dispatch("move", { to: id }); return; }""",
"""  function onHotspot(id) {
    if (!UI.state || UI.state.over) return;
    if (!isMyTurn()) { toast("Not your turn"); return; }
    var p = activeP();
    click();
    if (p.location === id) { openScene(id); return; }
    var mc = E.moveCost(UI.state, p, id);
    if (mc.tu > p.tu) { toast("Not enough Time Units to travel (" + mc.tu + " TU)", "bad"); return; }
    if (id === "club") {
      var whyClub = E.clubGate(UI.state, p);
      if (whyClub) { toast("\\ud83d\\udeab " + whyClub, "bad"); return; }
    }
    if (UI.mode === "guest") {
      // optimistic walk so it feels alive; the host's state confirms the arrival
      var fromG = p.location;
      A.startMove(E.transportOf(p));
      UI.walker.walkTo(id, fromG, function () { A.stopMove(); });
      dispatch("move", { to: id });
      return;
    }""", "guest walk")

# host relays every accepted human move to guests
swap("""    var r = dispatchNoRender("move", { to: id });
    if (!r.ok) { toast(r.why, "bad"); return; }
    A.startMove(r.transport);""",
"""    var r = dispatchNoRender("move", { to: id });
    if (!r.ok) { toast(r.why, "bad"); return; }
    if (UI.mode === "host") window.PPNet.relayWalk(r.from, id);
    A.startMove(r.transport);""", "host walk relay")

io.open(p, "w", encoding="utf-8").write(s)

# ================= net.js =================
p = "js/net.js"; s = io.open(p, encoding="utf-8").read()

def swapn(old, new, tag):
    global s
    assert old in s, "MISSING net: " + tag
    s = s.replace(old, new)

# ---- view + walk relays, rename, leave, heartbeat ----
swapn("""  NET.sendIntent = function (kind, payload) {
    if (NET.conn) NET.conn.send({ t: "intent", kind: kind, payload: payload });
  };""",
"""  NET.sendIntent = function (kind, payload) {
    if (NET.conn) NET.conn.send({ t: "intent", kind: kind, payload: payload });
  };
  // scene view sync: my open/close building -> everyone's screen
  NET.sendView = function (scene) {
    if (NET.isHost) broadcast({ t: "view", scene: scene });
    else if (NET.conn) NET.conn.send({ t: "view", scene: scene });
  };
  // walk animation relay (host-authoritative)
  NET.relayWalk = function (from, to) {
    if (NET.isHost) broadcast({ t: "walk", from: from, to: to });
  };
  NET.leave = function () {
    try { if (NET.conn) NET.conn.close(); } catch (e) {}
    try { if (NET.isHost) broadcast({ t: "closed" }); } catch (e) {}
    try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
    if (NET._hb) { clearInterval(NET._hb); NET._hb = null; }
    NET.peer = null; NET.conn = null; NET.conns = []; NET.roster = []; NET.isHost = false;
  };""", "net api")

# host: handle view/walk/rename/bye from guests + heartbeat acks
swapn("""    if (msg.t === "intent" && UI.state) {""",
"""    if (msg.t === "hbAck") { c._seen = Date.now(); }
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
    if (msg.t === "intent" && UI.state) {""", "host handlers")

# heartbeat: prune ghost guests that closed without saying bye (lobby stage)
swapn("""  NET.peer.on("open", function () { openLobby(); });""",
"""  NET.peer.on("open", function () {
      openLobby();
      if (NET._hb) clearInterval(NET._hb);
      NET._hb = setInterval(function () {
        var now = Date.now();
        NET.conns.slice().forEach(function (c) {
          if (c._seen && now - c._seen > 12000) { hostDropGuest(c); try { c.close(); } catch (e) {} }
          else send(c, { t: "hb" });
        });
      }, 4000);
    });""", "heartbeat")
swapn("""      c.on("open", function () { NET.conns.push(c); });""",
"""      c.on("open", function () { c._seen = Date.now(); NET.conns.push(c); });""", "conn seen")

# guests: react to hb/view/walk/closed
swapn("""  function guestOnData(msg) {
    if (msg.t === "lobby") { NET.roster = msg.roster; NET.code = msg.code; NET.opts = msg.opts; renderLobby(); }""",
"""  function guestOnData(msg) {
    if (msg.t === "hb") { if (NET.conn) NET.conn.send({ t: "hbAck" }); return; }
    if (msg.t === "closed") {
      UI.toast("The host closed the room", "bad");
      document.querySelector("#dlg-lobby").classList.remove("show");
      NET.leave(); UI.showScreen("start");
      return;
    }
    if (msg.t === "view") { UI.spectateScene(msg.scene); return; }
    if (msg.t === "walk" && UI.state) {
      // animate the active player's move on this screen too
      if (UI.mySlots.indexOf(UI.state.activeIdx) === -1 || !UI.walker.raf)
        UI.walker.walkTo(msg.to, msg.from, function () {});
      return;
    }
    if (msg.t === "lobby") { NET.roster = msg.roster; NET.code = msg.code; NET.opts = msg.opts; renderLobby(); }""", "guest handlers")

# lobby: rename button + leaving via the X actually leaves
swapn("""      '<div class="lobby-list">' + NET.roster.map(function (r) {
        return '<div class="lp"><span>' + (r.slot === 0 ? "\\ud83d\\udc51 " : "") + r.name + "</span><span>" +
          (r.code ? DATA.personalities[r.code].name + " (" + r.code + ")" : "picking\\u2026") + "</span></div>";
      }).join("") + "</div>" +""",
"""      '<div class="lobby-list">' + NET.roster.map(function (r) {
        var mineRow = NET.isHost ? r.slot === 0 : r.name === myName();
        return '<div class="lp"><span>' + (r.slot === 0 ? "\\ud83d\\udc51 " : "") + r.name +
          (mineRow ? ' <button class="btn small" id="lobby-rename">\\u270f\\ufe0f</button>' : "") + "</span><span>" +
          (r.code ? DATA.personalities[r.code].name + " (" + r.code + ")" : "picking\\u2026") + "</span></div>";
      }).join("") + "</div>" +""", "rename row")
swapn("""    $$("#lobby-body .char-card").forEach(function (c) {""",
"""    var rn = $("#lobby-rename");
    if (rn) rn.onclick = function () {
      var n = prompt("Your name:", myName());
      if (!n) return;
      n = n.slice(0, 14);
      window.PPStore.set("pp_name", n);
      if (NET.isHost) { NET.roster[0].name = n; broadcastLobby(); renderLobby(); }
      else if (NET.conn) NET.conn.send({ t: "rename", name: n });
    };
    $$("#lobby-body .char-card").forEach(function (c) {""", "rename wire")
swapn("""  function openLobby() { renderLobby(); document.querySelector("#dlg-lobby").classList.add("show"); }""",
"""  function openLobby() {
    renderLobby();
    var dlg = document.querySelector("#dlg-lobby");
    dlg.classList.add("show");
    var x = dlg.querySelector(".close-x");
    x.onclick = function () {                          // leaving the lobby really leaves
      dlg.classList.remove("show");
      NET.leave();
      UI.toast("Left the room");
    };
  }""", "leave on close")

io.open(p, "w", encoding="utf-8").write(s)
print("spectate patch applied")
