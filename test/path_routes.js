/* Static routing invariants: every building-to-building trip must use the
   authored road graph and must never cut through a third location. */
var E = require("../js/engine.js");

var fails = [];
var buildings = Object.keys(E.DATA.buildings);
var allowed = {};

function edgeKey(a, b) { return a < b ? a + "|" + b : b + "|" + a; }
function allow(a, b) { allowed[edgeKey(a, b)] = true; }
function segLen(a, b) {
  return Math.hypot((a[0] - b[0]) * (1672 / 100), (a[1] - b[1]) * (941 / 100));
}

E.DATA.roadEdges.forEach(function (edge) { allow(edge[0], edge[1]); });
buildings.forEach(function (id) {
  var b = E.DATA.buildings[id];
  if (b.entrances && b.entrances.length) {
    b.entrances.forEach(function (_pt, i) {
      var entrance = id + "#" + i;
      ((b.entranceDoors || [])[i] || []).forEach(function (door) { allow(entrance, door); });
    });
    return;
  }
  if (b.doors && b.doors.length) {
    b.doors.forEach(function (door) { allow(id, door); });
    return;
  }
  Object.keys(E.DATA.roadNodes).map(function (node) {
    return [node, segLen(E.NODE_POS[id], E.NODE_POS[node])];
  }).sort(function (a, b2) { return a[1] - b2[1]; }).slice(0, 2)
    .forEach(function (entry) { allow(id, entry[0]); });
});

buildings.forEach(function (from) {
  buildings.forEach(function (to) {
    if (from === to) return;
    var key = from + "|" + to;
    var route = E.PATHS[key];
    if (!route || !Number.isFinite(route.length) || route.nodes.length < 2) {
      fails.push(key + ": missing a connected authored route");
      return;
    }
    var fromIsMulti = E.DATA.buildings[from].entrances && E.DATA.buildings[from].entrances.length;
    var toIsMulti = E.DATA.buildings[to].entrances && E.DATA.buildings[to].entrances.length;
    if (fromIsMulti && route.nodes[0] !== from + "#0")
      fails.push(key + ": does not begin at canonical entrance " + from + "#0");
    if (toIsMulti && route.nodes[route.nodes.length - 1].indexOf(to + "#") !== 0)
      fails.push(key + ": does not end at a physical " + to + " entrance");
    if (!toIsMulti && route.nodes[route.nodes.length - 1] !== to)
      fails.push(key + ": does not end at " + to);
    route.nodes.forEach(function (node, i) {
      if (!E.NODE_POS[node]) fails.push(key + ": unknown node " + node);
      if (E.DATA.buildings[node] && node !== from && node !== to)
        fails.push(key + ": crosses location hub " + node);
      var hash = node.indexOf("#");
      var owner = hash === -1 ? null : node.slice(0, hash);
      if (owner && E.DATA.buildings[owner] && owner !== from && owner !== to)
        fails.push(key + ": crosses an entrance of " + owner);
      if (i && !allowed[edgeKey(route.nodes[i - 1], node)])
        fails.push(key + ": segment " + route.nodes[i - 1] + " -> " + node + " is not authored");
    });
  });
});

var entranceRouteCount = 0;
buildings.forEach(function (from) {
  var b = E.DATA.buildings[from];
  if (!b.entrances || !b.entrances.length) return;
  b.entrances.forEach(function (_pt, i) {
    buildings.forEach(function (to) {
      if (from === to) return;
      entranceRouteCount++;
      var key = from + "#" + i + "|" + to;
      var route = E.shortestPath(from + "#" + i, to);
      if (!route || !Number.isFinite(route.length) || route.nodes.length < 2) {
        fails.push(key + ": missing an authored exit route");
        return;
      }
      route.nodes.forEach(function (node, j) {
        if (E.DATA.buildings[node] && node !== to)
          fails.push(key + ": crosses location hub " + node);
        var hash = node.indexOf("#");
        var owner = hash === -1 ? null : node.slice(0, hash);
        if (owner && E.DATA.buildings[owner] && node !== from + "#" + i && owner !== to)
          fails.push(key + ": crosses an entrance of " + owner);
        if (j && !allowed[edgeKey(route.nodes[j - 1], node)])
          fails.push(key + ": segment " + route.nodes[j - 1] + " -> " + node + " is not authored");
      });
    });
  });
});

["temple|airport", "airport|temple"].forEach(function (key) {
  var route = E.PATHS[key];
  if (route.nodes.some(function (node) { return node === "park" || node.indexOf("park#") === 0; }))
    fails.push(key + ": still shortcuts through the park: " + route.nodes.join(" -> "));
});

if (fails.length) {
  console.error("PATH ROUTES FAIL\n" + fails.join("\n"));
  process.exit(1);
}
console.log("PATH ROUTES PASS - " + (buildings.length * (buildings.length - 1)) +
  " trips and " + entranceRouteCount + " open-zone exits stay on authored roads");
console.log("Temple -> Airport: " + E.PATHS["temple|airport"].nodes.join(" -> "));
