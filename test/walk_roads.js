/* Walker follows the road graph: command real walks, sample the avatar's
   position mid-walk, and verify arrival lands on the destination ENTRANCE. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var Engine = require("../js/engine.js");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8126";

var AR_X = 1672 / 100, AR_Y = 941 / 100;
var authoredSegments = [];
function addSegment(a, b) { authoredSegments.push([Engine.NODE_POS[a], Engine.NODE_POS[b]]); }
Engine.DATA.roadEdges.forEach(function (edge) { addSegment(edge[0], edge[1]); });
Object.keys(Engine.DATA.buildings).forEach(function (id) {
  var building = Engine.DATA.buildings[id];
  if (building.entrances && building.entrances.length) {
    building.entrances.forEach(function (_pt, i) {
      ((building.entranceDoors || [])[i] || []).forEach(function (door) {
        addSegment(id + "#" + i, door);
      });
    });
  } else {
    (building.doors || []).forEach(function (door) { addSegment(id, door); });
  }
});
function distanceToSegment(point, segment) {
  var px = point[0] * AR_X, py = point[1] * AR_Y;
  var ax = segment[0][0] * AR_X, ay = segment[0][1] * AR_Y;
  var bx = segment[1][0] * AR_X, by = segment[1][1] * AR_Y;
  var dx = bx - ax, dy = by - ay;
  var t = dx || dy ? ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy) : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distanceToAuthoredPath(point) {
  return Math.min.apply(null, authoredSegments.map(function (segment) {
    return distanceToSegment(point, segment);
  }));
}

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-walk-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  var errs = [];
  p.on("pageerror", function (e) { errs.push(e.message); });
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 3, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "CPU", code: "INTJ", isBot: true }
    ]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelectorAll(".dialog-veil").forEach(function (d) { d.classList.remove("show"); });
  });

  var fails = [];
  var trips = [["mall", "debtstreet"], ["university", "petShop"], ["temple", "airport"],
               ["airport", "temple"],
               ["airport", "luxury"], ["club", "park"], ["soulExchange", "park"],
               ["park", "airport"],
               ["university", "lowCost"], ["university", "temple"]];
  for (var i = 0; i < trips.length; i++) {
    var from = trips[i][0], to = trips[i][1];
    await p.evaluate(function (from) {
      var E = window.PPEngine, UI = window.PPUI;
      UI.state.players[0].location = from;
      UI.state.players[0].tu = 40;
      UI.walker.jumpTo(from);
      // A stale/noncanonical park position must snap to the canonical departure
      // entrance instead of animating a direct line across the lawn.
      if (from === "park") UI.walker.setPos(E.DATA.buildings.park.entrances[4][0], E.DATA.buildings.park.entrances[4][1]);
      UI.inScene = null;
      document.querySelector("#scene-view").classList.remove("show");
    }, from);
    await p.evaluate(function (to) {
      document.querySelector(".hotspot[data-id='" + to + "']").click();
    }, to);
    // sample the avatar every 350ms while it walks
    var samples = [];
    for (var s = 0; s < 14; s++) {
      await new Promise(function (r) { setTimeout(r, 350); });
      var st = await p.evaluate(function () {
        var UI = window.PPUI;
        return { pos: UI.walker.pos.slice(), inScene: UI.inScene };
      });
      samples.push(st.pos);
      if (st.inScene) break;
    }
    var end = await p.evaluate(function (to) {
      var E = window.PPEngine, UI = window.PPUI;
      // multi-entrance zones (the park): arriving at ANY declared edge point is correct.
      // Ordinary buildings: she arrives at the door (entrance), but any render
      // after that quietly parks her at the EXIT road dot (Austin's ask — she
      // stands outside on the road, not glued to the doorstep) — both count.
      var wants = E.DATA.buildings[to].entrances || [E.NODE_POS[to]];
      var ex = E.exitNodeOf && E.exitNodeOf(to);
      if (ex) wants = wants.concat([E.NODE_POS[ex]]);
      return { pos: UI.walker.pos.slice(), wants: wants, inScene: UI.inScene };
    }, to);
    var hit = end.wants.some(function (w) {
      return Math.abs(end.pos[0] - w[0]) <= 0.5 && Math.abs(end.pos[1] - w[1]) <= 0.5;
    });
    if (!hit)
      fails.push(from + "->" + to + ": arrived at " + end.pos + " want one of " + JSON.stringify(end.wants));
    if (end.inScene !== to)
      fails.push(from + "->" + to + ": scene did not open (inScene=" + end.inScene + ")");
    var offPath = samples.map(distanceToAuthoredPath).filter(function (distance) { return distance > 5; });
    if (offPath.length)
      fails.push(from + "->" + to + ": walker left the authored paths by up to " +
        Math.max.apply(null, offPath).toFixed(1) + "px");
    console.log(from + " -> " + to + ": " + samples.length + " samples, arrived", end.pos, "scene:", end.inScene);
    await p.evaluate(function () {
      var btn = document.querySelector("#btn-leave-scene");
      if (btn) btn.click();
    });
  }

  // Reproduce the watched-bot ordering: state/render move to the destination
  // before the animation starts. walkTo must restore the authored source node.
  var watchedStart = await p.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI, player = UI.state.players[0];
    player.location = "park"; player.tu = 40;
    UI.walker.jumpTo("park");
    UI.walker.setPos(E.DATA.buildings.park.entrances[4][0], E.DATA.buildings.park.entrances[4][1]);
    E.moveTo(UI.state, "airport");
    UI.renderAll();
    window.__watchedWalkDone = false;
    UI.walker.walkTo("airport", "park", function () { window.__watchedWalkDone = true; });
    return { pos: UI.walker.pos.slice(), want: E.DATA.buildings.park.entrances[0] };
  });
  if (Math.abs(watchedStart.pos[0] - watchedStart.want[0]) > 0.01 ||
      Math.abs(watchedStart.pos[1] - watchedStart.want[1]) > 0.01)
    fails.push("watched park bot: animation did not restore the canonical source entrance");
  var watchedSamples = [];
  for (var w = 0; w < 12; w++) {
    await new Promise(function (r) { setTimeout(r, 200); });
    var watched = await p.evaluate(function () {
      return { pos: window.PPUI.walker.pos.slice(), done: window.__watchedWalkDone };
    });
    watchedSamples.push(watched.pos);
    if (watched.done) break;
  }
  var watchedOffPath = watchedSamples.map(distanceToAuthoredPath)
    .filter(function (distance) { return distance > 5; });
  if (watchedOffPath.length)
    fails.push("watched park bot: walker left the authored paths by up to " +
      Math.max.apply(null, watchedOffPath).toFixed(1) + "px");
  if (!(await p.evaluate(function () { return window.__watchedWalkDone; })))
    fails.push("watched park bot: animation did not finish");

  await b.close();
  if (errs.length) fails.push("page errors: " + errs.join(" | "));
  if (fails.length) { console.error("FAIL\n" + fails.join("\n")); process.exit(1); }
  console.log("WALK ROADS PASS — sampled walks stay on authored paths, arrivals land on entrances, scenes open");
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
