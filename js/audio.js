/*
 * PERSONALITY PANIC — audio manager (Manual §15).
 * Music + SFX channels, Master/Music/SFX volumes, Music Mode (Full/Overmap Only),
 * rent-due overmap swap, mutually-exclusive movement SFX, missing files fail silently.
 * Browsers block autoplay until a user gesture: unlock() runs on the first click.
 */
(function () {
  var MUSIC_DIR = "assets/audio/music/", SFX_DIR = "assets/audio/sfx/";
  var st = {
    master: 0.8, music: 0.7, sfx: 0.8, muted: false,
    musicMuted: false,          // map mute button: music only, SFX untouched
    musicMode: "full",          // "full" | "overmapOnly"
    unlocked: false,
    currentTrack: null, musicEl: null,
    walkLoop: null
  };

  function load() {
    try {
      var s = JSON.parse(window.PPStore.get("pp_audio") || "{}");
      // musicMuted intentionally NOT loaded: a persisted mute once killed music silently
      ["master", "music", "sfx", "muted", "musicMode"].forEach(function (k) {
        if (s[k] !== undefined) st[k] = s[k];
      });
    } catch (e) {}
  }
  function save() {
    window.PPStore.set("pp_audio", JSON.stringify({
      master: st.master, music: st.music, sfx: st.sfx, muted: st.muted, musicMode: st.musicMode
    }));
  }
  load();

  function musicVol() { return (st.muted || st.musicMuted) ? 0 : st.master * st.music; }
  function sfxVol() { return st.muted ? 0 : st.master * st.sfx; }

  function playMusic(file) {
    if (!file) return;
    if (st.currentTrack === file && st.musicEl && !st.musicEl.paused) { st.musicEl.volume = musicVol(); return; }
    stopMusic();
    var el = new Audio(MUSIC_DIR + file);
    el.loop = true;
    el.volume = musicVol();
    el.onerror = function () {}; // missing file: fail silently per spec
    st.musicEl = el; st.currentTrack = file;
    if (st.unlocked) el.play().catch(function () {});
  }
  function stopMusic() {
    if (st.musicEl) { try { st.musicEl.pause(); } catch (e) {} }
    st.musicEl = null; st.currentTrack = null;
  }

  // location: "overmap" | building id; rentDue: bool
  function musicFor(location, rentDue) {
    var M = window.PP_DATA.music;
    if (location === "overmap") return rentDue ? M.rentDue : M.overmap;
    if (st.musicMode === "overmapOnly") return rentDue ? M.rentDue : M.overmap;
    var track = M[location];
    if (!track) return rentDue ? M.rentDue : M.overmap; // Temple gap: overmap fallback
    return track;
  }
  function setScene(location, rentDue) { playMusic(musicFor(location, rentDue)); }

  // One-shot SFX play through a small REUSED pool. Creating a fresh `new Audio()`
  // per call meant rapid clicking spawned unbounded elements, which exhausts the
  // browser's audio decoders and stalls the looping music track (the reported
  // "sound cut out for the scene and the map" bug). The pool caps concurrent
  // elements; a short per-sound guard drops machine-gun retriggers.
  var SFX_POOL_MAX = 8;
  var sfxPool = [], sfxIdx = 0, sfxLast = {};
  function sfx(name) {
    var f = window.PP_DATA.sfx[name];
    if (!f || !st.unlocked) return null;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    if (sfxLast[name] && now - sfxLast[name] < 45) return null; // de-dupe rapid retrigger
    sfxLast[name] = now;
    var el;
    if (sfxPool.length < SFX_POOL_MAX) { el = new Audio(); el.onerror = function () {}; sfxPool.push(el); }
    else { el = sfxPool[sfxIdx]; sfxIdx = (sfxIdx + 1) % SFX_POOL_MAX; }
    if (el._f !== f) { el.src = SFX_DIR + f; el._f = f; }
    try { el.pause(); el.currentTime = 0; } catch (e) {}
    el.volume = sfxVol();
    el.play().catch(function () {});
    return el;
  }
  // movement: walking loops; bike/car one-shots — ALL of them stop on arrival
  // (the 2.8s car clip used to keep revving inside the building)
  function startMove(transport) {
    stopMove();
    if (transport === "Bicycle") { st.moveEl = sfx("bike"); return; }
    if (transport === "Car") { st.moveEl = sfx("car"); return; }
    var f = window.PP_DATA.sfx.walk;
    if (!f || !st.unlocked) return;
    var el = new Audio(SFX_DIR + f);
    el.loop = true; el.volume = sfxVol();
    el.onerror = function () {};
    el.play().catch(function () {});
    st.walkLoop = el;
  }
  function stopMove() {
    if (st.walkLoop) { try { st.walkLoop.pause(); } catch (e) {} st.walkLoop = null; }
    if (st.moveEl) { try { st.moveEl.pause(); } catch (e) {} st.moveEl = null; }
  }

  // Fetch + decode every SFX once up front so first plays start instantly
  // (the car sound's "takes a second to run" was cold-load latency).
  function primeSfx() {
    if (st.primed || !window.PP_DATA || !window.PP_DATA.sfx) return;
    st.primed = true;
    Object.keys(window.PP_DATA.sfx).forEach(function (k) {
      var a = new Audio(SFX_DIR + window.PP_DATA.sfx[k]);
      a.preload = "auto";
      a.onerror = function () {};
      try { a.load(); } catch (e) {}
    });
  }

  function unlock() {
    st.unlocked = true;
    primeSfx();
    // Self-heal: if music should be playing but stalled/paused (e.g. after the
    // browser throttled audio), the next click kicks it back on.
    if (st.musicEl && st.musicEl.paused && musicVol() > 0) st.musicEl.play().catch(function () {});
  }
  document.addEventListener("pointerdown", unlock, { once: false });

  function applyVolumes() {
    if (st.musicEl) st.musicEl.volume = musicVol();
    if (st.walkLoop) st.walkLoop.volume = sfxVol();
    save();
  }

  // one-shot footstep burst (e.g. the "Take a Walk" park action)
  function footsteps(ms) {
    var f = window.PP_DATA.sfx.walk;
    if (!f || !st.unlocked) return;
    var el = new Audio(SFX_DIR + f);
    el.loop = true; el.volume = sfxVol();
    el.onerror = function () {};
    el.play().catch(function () {});
    setTimeout(function () { try { el.pause(); } catch (e) {} }, ms || 1600);
  }

  window.PPAudio = {
    footsteps: footsteps,
    state: st, setScene: setScene, playMusic: playMusic, stopMusic: stopMusic,
    sfx: sfx, startMove: startMove, stopMove: stopMove, applyVolumes: applyVolumes,
    set: function (k, v) { st[k] = v; applyVolumes(); }
  };
})();
