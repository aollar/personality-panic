/* Browser regression for the illustrated beginning-of-turn Weekend Update cards. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var URL = process.env.PP_URL || "http://localhost:8123/index.html";
var SHOTS = path.join(__dirname, "shots");

(async function () {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  var browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-weekend-art-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio", "--no-first-run"] });
  var page = await browser.newPage(); await page.setViewport({ width: 1700, height: 1000 });
  var errors = []; page.on("pageerror", function (e) { errors.push(e.message); });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 60000 });
  await page.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 827,
      players: [{ name: "Card Art QA", code: "ENFP", isBot: false }] });
    var cards = window.PP_DATA.weekend.cards;
    function card(id) { return JSON.parse(JSON.stringify(cards.filter(function (c) { return c.id === id; })[0])); }
    var p = UI.state.players[0];
    p.weekend = [card("S01"), card("I01"), card("E20")];
    p.weekend[1].delta = 12; p.weekend[1].asset = "crypto";
    p.weekend[2].deck = "mid";
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0]; UI.startGameUI(true); UI.turnIntro();
  });
  await page.waitForSelector("#dlg-turncard.show .wk-art img", { timeout: 10000 });
  await page.waitForFunction(function () {
    return Array.prototype.every.call(document.querySelectorAll(".wk-art img"), function (img) { return img.complete && img.naturalWidth; });
  }, { timeout: 10000 });
  var result = await page.evaluate(function () {
    var cards = Array.prototype.map.call(document.querySelectorAll(".wknd-card"), function (card) {
      var img = card.querySelector(".wk-art img"), box = card.getBoundingClientRect();
      return { title: card.querySelector(".wk-name").textContent, effect: card.querySelector(".wk-eff").textContent,
        src: img.getAttribute("src"), natural: [img.naturalWidth, img.naturalHeight], fit: getComputedStyle(img).objectFit,
        visible: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight };
    });
    return { cards: cards, deck: document.querySelectorAll(".wk-deck").length };
  });
  if (result.cards.length !== 3) throw new Error("expected 3 illustrated cards: " + JSON.stringify(result));
  result.cards.forEach(function (card) {
    if (card.natural.join("x") !== "960x720" || card.fit !== "contain" || !card.visible || !card.effect) {
      throw new Error("bad illustrated card: " + JSON.stringify(card));
    }
  });
  if (result.deck !== 1) throw new Error("live deck label missing");
  await page.screenshot({ path: path.join(SHOTS, "weekend-card-art.png") });
  await browser.close();
  if (errors.length) throw new Error("Page errors: " + errors.join(" | "));
  console.log("WEEKEND ART UI PASS", JSON.stringify(result));
})().catch(function (e) { console.error("WEEKEND ART UI FAIL", e.message); process.exit(1); });
