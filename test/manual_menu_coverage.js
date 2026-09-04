/* Master Manual v3 Section 8 versus effective painted-menu coverage. */
var HOT = require("../assets/data/scene_hotspots.js");
global.PP_DATA = require("../assets/data/gamedata.js");
global.PP_SCENE_PAGES = require("../assets/data/scene_pages.js").PP_SCENE_PAGES;
require("../assets/data/scene_visuals.js");

var ranges = {
  lowCost: [1, 7], luxury: [9, 16], park: [18, 25], airOne: [26, 33],
  regretBurger: [34, 41], gym: [42, 49], club: [50, 57], temple: [58, 66],
  university: [67, 75], soulExchange: [76, 84], debtstreet: [85, 92],
  airport: [93, 101], petShop: [102, 110], mall: [111, 118]
};
var intentionalMore = {
  park: ["A024", "A025"], club: ["A056"], mall: ["A111", "A116", "A117"]
};
function actionId(n) { return "A" + String(n).padStart(3, "0"); }
function painted(building) {
  if (building === "club") return Object.keys(HOT.PP_BDC_MAP).map(function (k) { return HOT.PP_BDC_MAP[k]; });
  var cfg = global.PP_SCENE_PAGES[building];
  if (cfg) {
    var ids = [];
    cfg.tabs.forEach(function (tab) { tab.pages.forEach(function (page) {
      page.hotspots.forEach(function (h) { ids.push(h.a); });
    }); });
    if (cfg.work) ids.push(cfg.work.a);
    return Array.from(new Set(ids));
  }
  return Array.from(new Set((HOT.PP_HOTSPOTS[building] || []).map(function (h) { return h.a; })));
}

var failures = [];
Object.keys(ranges).forEach(function (building) {
  var range = ranges[building], manual = [];
  for (var n = range[0]; n <= range[1]; n++) manual.push(actionId(n));
  var ids = painted(building);
  var missing = manual.filter(function (id) { return ids.indexOf(id) === -1; }).sort();
  var expected = (intentionalMore[building] || []).slice().sort();
  if (JSON.stringify(missing) !== JSON.stringify(expected)) {
    failures.push(building + " missing " + missing.join(",") + " (expected " + expected.join(",") + ")");
  }
  ids.filter(function (id) { return /^A/.test(id); }).forEach(function (id) {
    if (manual.indexOf(id) === -1) failures.push(building + " has out-of-range painted action " + id);
  });
});

var corporate = HOT.PP_HOTSPOTS.soulExchange.map(function (h) { return h.a; });
if (corporate.indexOf("A084") === -1 || corporate.filter(function (id) { return id === "A076"; }).length !== 1) {
  failures.push("Corporate Ask for Promotion is missing or Get/Change Job is duplicated");
}
var park = HOT.PP_HOTSPOTS.park.map(function (h) { return h.a; });
if (park.length !== 6 || new Set(park).size !== 6) failures.push("Park has a phantom/duplicate hotspot over the blank lower panel");

if (failures.length) {
  failures.forEach(function (msg) { console.error("FAIL", msg); });
  process.exit(1);
}
console.log("MANUAL MENU COVERAGE PASS: only Park A024/A025, Club A056, and Mall A111/A116/A117 remain in More");
