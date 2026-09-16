/* Turn-start Weekend Update artwork coverage and integration checks. */
var fs = require("fs");
var path = require("path");
var DATA = require("../assets/data/gamedata.js");

var dir = path.join(__dirname, "..", "assets", "cards", "weekend");
// v4 added I09 SIDEWAYS MARKET + I10 MARKET CRASH; their art has not been painted yet
var PENDING = ["I09", "I10"];
var all = DATA.weekend.cards.map(function (c) { return c.id; });
var expected = all.filter(function (id) { return PENDING.indexOf(id) === -1; }).sort();
var actual = fs.readdirSync(dir).filter(function (name) { return /\.webp$/i.test(name); })
  .map(function (name) { return path.basename(name, ".webp"); }).sort();
var failures = [];

if (all.length !== 45 || expected.length !== 43) failures.push("expected 45 game cards (43 painted), found " + all.length);
if (!/WKND_ART_PENDING = \["I09", "I10"\]/.test(require("fs").readFileSync(require("path").join(__dirname, "..", "js", "ui.js"), "utf8")))
  failures.push("UI must render I09/I10 icon-only until their art arrives");
if (JSON.stringify(actual) !== JSON.stringify(expected)) {
  failures.push("art IDs do not exactly match game card IDs");
}
expected.forEach(function (id) {
  var file = path.join(dir, id + ".webp");
  if (!fs.existsSync(file) || fs.statSync(file).size < 50000) failures.push(id + " artwork is missing or truncated");
});

var ui = fs.readFileSync(path.join(__dirname, "..", "js", "ui.js"), "utf8");
var css = fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8");
if (!/WKND_ART\[card\.id\].*assets\/cards\/weekend/.test(ui)) failures.push("UI art manifest is not data-driven");
if (!/class=\"wk-art\"/.test(ui) || !/width=\"960\" height=\"720\"/.test(ui)) failures.push("Weekend card art element is incomplete");
if (!/\.wknd-card \.wk-art[\s\S]*?aspect-ratio:\s*4\s*\/\s*3/.test(css)) failures.push("Weekend art pane is not locked to 4:3");
if (!/\.wknd-card \.wk-art img[\s\S]*?object-fit:\s*contain/.test(css)) failures.push("Weekend artwork can be cropped or distorted");

if (failures.length) {
  failures.forEach(function (msg) { console.error("FAIL", msg); });
  process.exit(1);
}
console.log("WEEKEND ART PASS: 43/43 painted cards have optimized, uncropped 4:3 artwork (I09/I10 art pending)");
