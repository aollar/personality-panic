/* Debug: geometry of the wide chip + a close-up crop. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-chipdbg-" + Date.now()),
    args: ["--window-size=1700,1000", "--mute-audio"]
  });
  var p = await b.newPage();
  await p.setViewport({ width: 1700, height: 1000 });
  await p.goto("http://localhost:8125/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 20, seed: 5, players: [
      { name: "Austin", code: "ENFP" }, { name: "CPU", code: "INTJ", isBot: true }]});
    UI.state.players[0].location = "petShop";
    UI.state.players[0].stats.money = 95;
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelector("#dlg-turncard").classList.remove("show");
    document.querySelector(".hotspot[data-id='petShop']").click();
  });
  await new Promise(function (r) { setTimeout(r, 1200); });
  var info = await p.evaluate(function () {
    function r(el) { if (!el) return null; var b = el.getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; }
    var chip = document.querySelector("#scene-tu");
    return {
      wideActive: !!window.PP_CHIP_WIDE,
      chipClass: chip.className,
      chip: r(chip),
      art: r(chip.querySelector(".wide-chip-art")),
      money: r(chip.querySelector("#wc-money")),
      moneyText: chip.querySelector("#wc-money") && chip.querySelector("#wc-money").textContent,
      children: chip.children.length,
      html0: chip.innerHTML.slice(0, 150)
    };
  });
  console.log(JSON.stringify(info, null, 1));
  var c = info.chip;
  await p.screenshot({ path: path.join(__dirname, "shots", "chip-closeup.png"),
    clip: { x: Math.max(0, c.x - 10), y: Math.max(0, c.y - 40), width: c.w + 60, height: c.h + 60 } });
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
