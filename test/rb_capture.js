/*
 * Records the judging capture (~28s): scene at rest with ambient life,
 * then Classic -> Deluxe -> Shame Shake in a row, then WORK (Mona).
 * CDP screencast frames -> test/shots/capture/ -> ffmpeg (run separately).
 */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os"), fs = require("fs");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var OUT = path.join(__dirname, "shots", "capture");
var PORT = process.env.PORT || "8123";

(async function () {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-cap-" + Date.now()),
    args: ["--window-size=1620,940", "--mute-audio", "--no-first-run",
           "--autoplay-policy=no-user-gesture-required"]
  });
  var page = await b.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await page.evaluate(function () {
    localStorage.removeItem("pp_save");
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 30, seed: 42, players: [
      { name: "Austin", code: "ENFP", isBot: false }, { name: "Founder", code: "INTJ", isBot: true }]});
    var p = UI.state.players[0];
    p.location = "regretBurger";
    p.stats.money = 60;
    p.job = window.PP_DATA.jobs.filter(function (j) { return j.building === "regretBurger" && j.tier === "Low"; })[0];
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    UI.state.players[0].tu = 12;
    document.querySelector("#dlg-turncard").classList.remove("show");
    document.querySelector(".hotspot[data-id='regretBurger']").click();
  });
  await new Promise(function (r) { setTimeout(r, 600); });

  // ---- screencast on ----
  var client = await page.target().createCDPSession();
  var n = 0, t0 = Date.now(), times = [];
  client.on("Page.screencastFrame", function (ev) {
    fs.writeFileSync(path.join(OUT, "f" + String(n).padStart(5, "0") + ".jpg"),
      Buffer.from(ev.data, "base64"));
    times.push(Date.now() - t0);
    n++;
    client.send("Page.screencastFrameAck", { sessionId: ev.sessionId }).catch(function () {});
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 82, everyNthFrame: 1 });

  function order(a) {
    return page.evaluate(function (x) {
      document.querySelector('.paint-btn[data-a="' + x + '"]').click();
    }, a);
  }
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  await wait(9000);            // idle-at-rest: ambient reactions fire, staggered
  await order("A034"); await wait(2800);   // Classic -> burger-react plays fully
  await order("A035"); await wait(1400);   // Deluxe  -> burger-big (quick follow-up)
  await order("A036"); await wait(3600);   // Shame Shake -> sip (overlap with big's tail)
  await order("A041"); await wait(6400);   // WORK -> Mona's flourish
  await wait(3200);            // settle back to the idle diner

  await client.send("Page.stopScreencast");
  var dur = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ frames: n, seconds: dur, fps: n / dur }));
  console.log("captured", n, "frames over", dur.toFixed(1) + "s (", (n / dur).toFixed(1), "fps )");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
