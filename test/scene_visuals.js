/* Regression checks for the v3 scene-art manifest. */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const context = vm.createContext({ console, window: {}, module: { exports: {} } });
function load(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  vm.runInContext(source, context, { filename: file });
}

load("assets/data/gamedata.js");
load("assets/data/scene_hotspots.js");
load("assets/data/scene_pages.js");
load("assets/data/scene_visuals.js");

const data = context.PP_DATA;
const hotspots = context.PP_HOTSPOTS;
const pages = context.PP_SCENE_PAGES;
const visuals = context.window.PP_SCENE_VISUALS;

assert.strictEqual(data.buildings.airOne.scene, "v3/air_one.png");
assert.strictEqual(data.buildings.park.scene, "v3/park.png");
assert.strictEqual(data.buildings.petShop.scene, "ethical_pet_shop.jpg", "Ethical Pet Shop stays unchanged");
assert.strictEqual(pages.mall.tabs[0].pages[0].img, "v3/mall_style_page_1.png");
assert.strictEqual(pages.lowCost.tabs[0].pages[0].homeLayer, "lowCost");
assert.strictEqual(pages.luxury.tabs[0].pages.length, 2, "Heelton must expose both rooms");
assert.strictEqual(pages.luxury.tabs[0].pages[0].homeLayer, "luxuryBedroom");
assert.strictEqual(pages.luxury.tabs[0].pages[1].homeLayer, "luxuryLounge");
assert.strictEqual(pages.luxury.tabs[0].pages[0].visibleNextArrow, true);
assert.strictEqual(pages.university.tabs[0].pages.length, 2);
assert.deepStrictEqual(Array.from(pages.university.tabs[0].pages[1].hotspots, h => h.a), ["A073", "A074"]);
assert.strictEqual(pages.airport.tabs[0].pages.length, 2);
assert.deepStrictEqual(Array.from(pages.airport.tabs[0].pages[1].hotspots, h => h.a), ["A099", "A100"]);
assert.deepStrictEqual(Array.from(hotspots.airOne, h => h.a), ["A026", "A027", "A028", "A029", "A031", "A032", "A030", "A033"]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(pages.luxury.tabs[1].pages[0].hotspots[0].aByHousing)),
  { resident: "X007", visitor: "X003" });
assert.ok(visuals.homes.lowCost.layers.some(layer => layer.any.includes("Fridge")));
assert.ok(visuals.homes.luxuryBedroom.layers.some(layer => layer.any.includes("Premium Bed")));
assert.ok(visuals.homes.luxuryLounge.layers.some(layer => layer.any.includes("Hot Tub")));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const v3Files = walk(path.join(root, "assets", "scenes", "v3"))
  .filter(file => file.endsWith(".png") && !path.basename(file).includes("_source"));
assert.strictEqual(v3Files.length, 33, "only deployable scene and transparent overlay assets should be published");
v3Files.forEach(file => {
  const header = fs.readFileSync(file).subarray(0, 24);
  assert.strictEqual(header.toString("ascii", 1, 4), "PNG", `${file} is not a PNG`);
  assert.strictEqual(header.readUInt32BE(16), 1672, `${file} width drifted`);
  assert.strictEqual(header.readUInt32BE(20), 941, `${file} height drifted`);
});
const alphaFiles = v3Files.filter(file => /(?:furniture|pet_)(?!.*_source)/.test(path.basename(file)));
assert.strictEqual(alphaFiles.length, 12, "expected six transparent low-cost and six transparent Heelton overlays");
alphaFiles.forEach(file => {
  const ihdr = fs.readFileSync(file).subarray(0, 26);
  assert.strictEqual(ihdr[25], 6, `${file} must remain RGBA PNG color type 6`);
});

console.log("scene visuals: OK");
