# net.js half of the spectate patch (ui.js already applied). Exact literal anchors.
import io
p = "js/net.js"; s = io.open(p, encoding="utf-8").read()

def swap(old, new, tag):
    global s
    assert old in s, "MISSING net: " + tag
    s = s.replace(old, new)

swap("""  NET.sendIntent = function (kind, payload) {
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
    try { if (NET.conn) NET.conn.send({ t: "bye" }); } catch (e) {}
    try { if (NET.conn) NET.conn.close(); } catch (e) {}
    try { if (NET.isHost) broadcast({ t: "closed" }); } catch (e) {}
    try { if (NET.peer) NET.peer.destroy(); } catch (e) {}
    if (NET._hb) { clearInterval(NET._hb); NET._hb = null; }
    NET.peer = null; NET.conn = null; NET.conns = []; NET.roster = []; NET.isHost = false;
  };""", "net api")

swap("""    if (msg.t === "intent" && UI.state) {""",
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

swap("""    NET.peer.on("open", function () { openLobby(); });""",
"""    NET.peer.on("open", function () {
      openLobby();
      if (NET._hb) clearInterval(NET._hb);
      NET._hb = setInterval(function () {          // prune ghosts that never said bye
        var now = Date.now();
        NET.conns.slice().forEach(function (c) {
          if (c._seen && now - c._seen > 12000) { hostDropGuest(c); try { c.close(); } catch (e) {} }
          else send(c, { t: "hb" });
        });
      }, 4000);
    });""", "heartbeat")

swap("""      c.on("open", function () { NET.conns.push(c); });""",
"""      c.on("open", function () { c._seen = Date.now(); NET.conns.push(c); });""", "conn seen")

swap("""  function guestOnData(msg) {
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
      if (!UI.walker.raf) UI.walker.walkTo(msg.to, msg.from, function () {});
      return;
    }
    if (msg.t === "lobby") { NET.roster = msg.roster; NET.code = msg.code; NET.opts = msg.opts; renderLobby(); }""", "guest handlers")

swap("""        return '<div class="lp"><span>' + (r.slot === 0 ? "\\U0001f451 " : "") + r.name + "</span><span>" +
          (r.code ? DATA.personalities[r.code].name + " (" + r.code + ")" : "picking\\u2026") + "</span></div>";""".replace("\\U0001f451", "\U0001f451").replace("\\u2026", "…"),
"""        var mineRow = NET.isHost ? r.slot === 0 : r.name === myName();
        return '<div class="lp"><span>' + (r.slot === 0 ? "\U0001f451 " : "") + r.name +
          (mineRow ? ' <button class="btn small" id="lobby-rename" title="Change name">✏️</button>' : "") + "</span><span>" +
          (r.code ? DATA.personalities[r.code].name + " (" + r.code + ")" : "picking…") + "</span></div>";""", "rename row")

swap("""    $$("#lobby-body .char-card").forEach(function (c) {""",
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

swap("""  function openLobby() { renderLobby(); document.querySelector("#dlg-lobby").classList.add("show"); }""",
"""  function openLobby() {
    renderLobby();
    var dlg = document.querySelector("#dlg-lobby");
    dlg.classList.add("show");
    dlg.querySelector(".close-x").onclick = function () {   // leaving really leaves
      dlg.classList.remove("show");
      NET.leave();
      UI.toast("Left the room");
    };
  }""", "leave on close")

io.open(p, "w", encoding="utf-8").write(s)
print("net.js patched OK")
