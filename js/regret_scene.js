/*
 * PERSONALITY PANIC — living Regret Burger scene.
 * Four mascots over the clean diner backdrop; ordering an item makes the mapped
 * mascot react. Ported from the tuned regret-burger prototype and kept faithful
 * to its ONE proven transition technique:
 *
 *   HARD CUTS ONLY. Mona's clips are separate <video> elements, all in the DOM,
 *   all pre-decoded; exactly one has opacity:1 at any instant (no crossfade =
 *   no see-through, no leftover base layer = no ghost, never detached = no blank).
 *   The webp mascots swap src between pre-decoded animated webps; a fresh src
 *   assignment starts the clip at frame 0, and we cut back to idle after exactly
 *   one full play (manifest dur).
 *
 * Ambient life is arbitrated globally so the scene reads "busy little diner",
 * never "twitchy": one ambient at a time, staggered, and silenced around player
 * orders. All timing knobs live in the manifest.
 *
 * Degradation: any clip that fails to load is dropped silently; a character with
 * no idle is skipped entirely. The scene (and every order button) works regardless.
 */
(function () {
  var M = null;                 // manifest
  var layer = null;             // the mounted layer element
  var chars = {};               // key -> {img | vids{}, cur, busy, restUntil, deadIdle}
  var timers = [];              // every pending timeout (cleared on unmount)
  var lastReactionEnd = 0;      // global: when the most recent reaction finished
  var quietUntil = 0;           // global: ambients hold off until this time
  var playing = null;           // key of the char currently playing an ambient
  var mounted = false;

  function now() { return performance.now(); }
  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  // keep a character planted when cutting between clips with different canvases
  function placement(charKey, clipKey) {
    var c = M.chars[charKey], box = c.box;
    var I = c.clips[c.idle].bb, V = c.clips[clipKey].bb;
    var DW = 1672, DH = 941;
    var sI = (box.width * DW / 100) / I[0];
    var ax = box.left * DW / 100 + I[3] * sI;      // anchor: body center-x …
    var ay = box.top * DH / 100 + I[4] * sI;       // … and body bottom-y of the idle
    var s = (I[2] * sI) / V[2];                    // scale variant so body widths match
    return {
      left: (ax - V[3] * s) / DW * 100,
      top: (ay - V[4] * s) / DH * 100,
      width: V[0] * s / DW * 100
    };
  }

  function makeEl(tag) {
    var el = document.createElement(tag);
    el.className = "regret-anim";
    el.draggable = false;
    if (tag === "video") {
      el.muted = true; el.setAttribute("muted", "");
      el.setAttribute("playsinline", ""); el.preload = "auto";
    }
    return el;
  }
  function position(el, p) {
    el.style.left = p.left + "%"; el.style.top = p.top + "%"; el.style.width = p.width + "%";
  }

  // ---------- building the layer ----------
  function mount(container) {
    if (!window.PP_REGRET_MANIFEST) return;
    unmount();
    M = window.PP_REGRET_MANIFEST;
    layer = document.createElement("div");
    layer.id = "regret-layer";
    container.appendChild(layer);
    mounted = true;

    Object.keys(M.chars).forEach(function (key) {
      var c = M.chars[key];
      var st = chars[key] = { cur: c.idle, busy: false, restUntil: 0, deadClips: {} };
      if (c.video) {
        // one <video> per clip, all present, opacity picks the visible one (hard cut)
        st.vids = {};
        Object.keys(c.clips).forEach(function (clipKey) {
          var clip = c.clips[clipKey];
          var v = makeEl("video");
          v.src = M.base + clip.src;
          v.loop = !!clip.loop;
          v.style.opacity = clipKey === c.idle ? "1" : "0";
          v.style.transition = "none";                       // hard cuts — never fade
          if (clip.loop) { v.autoplay = true; v.play().catch(function () {}); }
          if (c.poster && clipKey === c.idle) v.poster = M.base + c.poster;
          v.addEventListener("error", function () { st.deadClips[clipKey] = true; });
          position(v, placement(key, clipKey));
          layer.appendChild(v);
          st.vids[clipKey] = v;
        });
      } else {
        // one visible <img>; every clip pre-decoded so src swaps are instant
        st.img = makeEl("img");
        st.img.src = M.base + c.clips[c.idle].src;
        st.img.addEventListener("error", function () {
          if (st.cur === c.idle) { st.deadIdle = true; st.img.style.display = "none"; }
        });
        position(st.img, placement(key, c.idle));
        layer.appendChild(st.img);
        Object.keys(c.clips).forEach(function (clipKey) {
          var warm = new Image();
          warm.onerror = function () { st.deadClips[clipKey] = true; };
          warm.src = M.base + c.clips[clipKey].src;
          if (warm.decode) warm.decode().catch(function () {});
        });
      }
      scheduleAmbient(key, true);
    });
  }

  function unmount() {
    timers.forEach(clearTimeout); timers = [];
    if (layer) {
      layer.querySelectorAll("video").forEach(function (v) { try { v.pause(); } catch (e) {} });
      layer.remove();
    }
    layer = null; chars = {}; playing = null; mounted = false;
  }

  // ---------- the hard-cut player ----------
  function cutTo(key, clipKey) {
    var c = M.chars[key], st = chars[key];
    if (c.video) {
      Object.keys(st.vids).forEach(function (v) {
        var el = st.vids[v];
        if (v === clipKey) {
          try { if (!c.clips[v].loop) el.currentTime = 0; } catch (e) {}
          el.style.opacity = "1";
          el.play().catch(function () {});
        } else {
          el.style.opacity = "0";
          if (!c.clips[v].loop) { try { el.pause(); el.currentTime = 0; } catch (e) {} }
        }
      });
    } else {
      var url = M.base + c.clips[clipKey].src;
      // fresh assignment starts the animated webp at frame 0 (cached => instant)
      if (st.img.getAttribute("src") === url) st.img.src = "";
      st.img.src = url;
      position(st.img, placement(key, clipKey));
    }
    st.cur = clipKey;
  }

  // play one reaction fully, then hard-cut home to idle
  function react(key, clipKey, isOrder) {
    var c = M.chars[key], st = chars[key];
    if (!mounted || !c || !c.clips[clipKey]) return;
    if (st.deadIdle || st.deadClips[clipKey]) return;        // degraded: skip silently
    if (st._home) clearTimeout(st._home);
    st.busy = true;
    if (isOrder) quietUntil = Math.max(quietUntil, now() + M.timing.orderQuietMs);
    cutTo(key, clipKey);
    var dur = c.clips[clipKey].dur || 2600;
    var home = function () {
      if (!mounted) return;
      cutTo(key, c.idle);
      st.busy = false;
      st.restUntil = now() + M.timing.charRestMs;
      lastReactionEnd = now();
      if (playing === key) playing = null;
    };
    if (c.video) {
      var el = st.vids[clipKey];
      el.onended = function () { el.onended = null; clearTimeout(st._home); home(); };
      st._home = later(home, dur + 700);                     // fallback if 'ended' misses
    } else {
      st._home = later(home, dur);
    }
  }

  // ---------- ambient life (globally staggered) ----------
  function scheduleAmbient(key, first) {
    var c = M.chars[key];
    if (!c.ambient || !c.ambient.length) return;
    var base = (c.ambientEvery || 12) * 1000;
    var jit = base * M.timing.ambientJitter;
    var delay = Math.max(1200, base - jit + Math.random() * 2 * jit);
    if (first) delay = 2500 + Math.random() * delay;         // opening: settle in staggered
    later(function () { tryAmbient(key); }, delay);
  }
  function tryAmbient(key) {
    if (!mounted) return;
    var st = chars[key], t = now();
    var blocked =
      st.busy || playing !== null ||                          // someone is already reacting
      t < quietUntil ||                                       // a player order owns the moment
      t < st.restUntil ||                                     // this char needs pure idle time
      t < lastReactionEnd + M.timing.globalGapMs;             // global stagger between reactions
    if (blocked) { later(function () { tryAmbient(key); }, 900 + Math.random() * 900); return; }
    var pool = M.chars[key].ambient.filter(function (v) { return !st.deadClips[v]; });
    if (pool.length) {
      playing = key;
      react(key, pool[Math.floor(Math.random() * pool.length)], false);
    }
    scheduleAmbient(key);
  }

  // ---------- the game hook: an order was ACCEPTED by the engine ----------
  function onAction(actionId) {
    if (!mounted || !M) return;
    var map = M.actions[actionId];
    if (!map) return;                                         // e.g. A038 nuggets: no mascot
    react(map.char, map.clip, true);                          // immediate, preempts ambients
  }

  window.PPRegretScene = {
    mount: mount, unmount: unmount, onAction: onAction,
    _debug: function () { return { chars: chars, playing: playing, quietUntil: quietUntil }; }
  };
})();
