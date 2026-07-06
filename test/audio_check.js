/* Music sanity: (1) fresh profile -> music element playing with volume after a
   click; (2) a POISONED persisted musicMuted:true (the reported "music died
   forever" state) must self-heal on reload now that the flag is session-only. */
var puppeteer = require("puppeteer-core");
var path = require("path"), os = require("os");
var CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
var PORT = process.env.PORT || "8125";

(async function () {
  var b = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    userDataDir: path.join(os.tmpdir(), "pp-audio-" + Date.now()),
    args: ["--mute-audio", "--no-first-run", "--autoplay-policy=no-user-gesture-required"]
  });
  var p = await b.newPage();

  // poison the audio settings the way a stuck mute would have
  await p.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "networkidle2" });
  await p.evaluate(function () {
    localStorage.setItem("pp_audio", JSON.stringify({
      master: 0.8, music: 0.7, sfx: 0.8, muted: false, musicMuted: true, musicMode: "full"
    }));
  });
  await p.reload({ waitUntil: "networkidle2" });
  var st = await p.evaluate(function () {
    var A = window.PPAudio;
    return { musicMuted: A.state.musicMuted, track: A.state.currentTrack };
  });
  console.log("after reload with poisoned mute:", JSON.stringify(st));
  if (st.musicMuted) { console.error("FAIL: stale mute survived reload"); process.exit(1); }

  // user gesture unlocks audio; music must actually be playing with volume
  await p.evaluate(function () { document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  await new Promise(function (r) { setTimeout(r, 800); });
  var music = await p.evaluate(function () {
    var A = window.PPAudio, el = A.state.musicEl;
    return el ? { src: el.src.split("/").pop(), paused: el.paused, volume: el.volume } : null;
  });
  console.log("music element:", JSON.stringify(music));
  if (!music || music.paused || music.volume <= 0) { console.error("FAIL: music not playing"); process.exit(1); }

  // map mute toggles for THIS session only
  await p.evaluate(function () {
    var E = window.PPEngine, UI = window.PPUI;
    UI.state = E.newGame({ T: 100, timerSeconds: 0, maxRounds: 20, seed: 1, players: [
      { name: "A", code: "ENFP" }, { name: "B", code: "INTJ", isBot: true }]});
    UI.cfg = { hints: true, skipCpu: true, players: UI.state.players };
    UI.mode = "local"; UI.mySlots = [0];
    UI.startGameUI(false);
    document.querySelector("#dlg-turncard").classList.remove("show");
    document.querySelector("#music-mute").click();
  });
  var muted = await p.evaluate(function () {
    return { flag: window.PPAudio.state.musicMuted,
             vol: window.PPAudio.state.musicEl ? window.PPAudio.state.musicEl.volume : -1,
             persisted: (localStorage.getItem("pp_audio") || "").indexOf("musicMuted") !== -1 };
  });
  console.log("after mute click:", JSON.stringify(muted));
  if (!muted.flag || muted.vol !== 0) { console.error("FAIL: mute button didn't mute"); process.exit(1); }
  if (muted.persisted) { console.error("FAIL: musicMuted still persisted"); process.exit(1); }
  console.log("AUDIO CHECK PASS");
  await b.close();
})().catch(function (e) { console.error("CRASH", e.message); process.exit(1); });
