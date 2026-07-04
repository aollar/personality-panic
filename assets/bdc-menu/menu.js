/* =================================================================
   BDC "Choose Your Bad Decision" — interaction logic.
   CSS handles look/feel; JS only does state, click timing and the
   future-facing animation hooks (robot sprite sheet, result box).
   Public API is exposed on window.BDCMenu at the bottom.
   ================================================================= */
(function () {
  "use strict";

  const stage      = document.getElementById("menuStage");
  const cards      = Array.from(document.querySelectorAll(".decision-card"));
  const workBtn    = document.getElementById("workButton");
  const resultBox  = document.getElementById("resultBox");
  const resultText = document.getElementById("resultText");
  const robot      = document.getElementById("robotContainer");

  const DEFAULT_MSG = "Select a bad decision.";
  const params = new URLSearchParams(window.location.search);
  if (params.get("embed") === "1") {
    document.body.classList.add("embedded-menu");
  }
  if (params.get("cardGlow") === "overlay") {
    document.body.classList.add("card-glow-overlay");
  }

  // per-card hover preview copy (placeholder consequence flavour)
  const PREVIEW = {
    dance:    "Bust a move. It's free. It's foolish.",
    flirt:    "Batting eyelashes at $15 a blink.",
    digits:   "Slide into a stranger's phone. What could go wrong?",
    shots:    "Liquid courage — $25 a round.",
    vip:      "The rope is velvet. Your wallet is lighter.",
    stranger: "Bold. Reckless. Iconic.",
  };

  // WORK "processing" copy, cycled while the (future) result resolves
  const PROCESSING = [
    "Preparing bad decision...",
    "Calculating consequences...",
    "BDC staff recommends poor judgment.",
    "Work now. Regret later.",
  ];

  let selectedId = null;
  let messagesEnabled = true;
  let processingTimer = null;

  /* ---------------- result box ---------------- */
  function setMessage(text, processing) {
    resultText.textContent = text;
    resultBox.classList.add("active");
    resultBox.classList.toggle("processing", !!processing);
  }
  function clearMessage() {
    if (selectedId) return;                    // keep selection context
    resultBox.classList.remove("active", "processing");
    resultText.textContent = DEFAULT_MSG;
  }

  /* ---------------- cards ---------------- */
  function selectCard(id) {
    selectedId = id;
    cards.forEach((c) => c.classList.toggle("selected", c.dataset.card === id));
    const card = cards.find((c) => c.dataset.card === id);
    if (card && messagesEnabled) setMessage(PREVIEW[id] || DEFAULT_MSG, false);
    dispatch("cardselect", { id, cost: card ? Number(card.dataset.cost) : null });
  }

  function pressPulse(el, cls, ms) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  cards.forEach((card) => {
    const id = card.dataset.card;

    card.addEventListener("mouseenter", () => {
      if (messagesEnabled && !card.classList.contains("disabled"))
        setMessage(PREVIEW[id] || DEFAULT_MSG, false);
    });
    card.addEventListener("mouseleave", clearMessage);

    // press-in
    card.addEventListener("pointerdown", () => {
      if (card.classList.contains("disabled")) return;
      card.classList.add("pressed");
    });
    // release -> spring back then select
    const release = () => card.classList.remove("pressed");
    card.addEventListener("pointerup", release);
    card.addEventListener("pointercancel", release);
    card.addEventListener("pointerleave", release);

    card.addEventListener("click", () => {
      if (card.classList.contains("disabled")) return;
      selectCard(id);
    });
  });

  /* ---------------- WORK button ---------------- */
  function runProcessingSequence() {
    let i = 0;
    setMessage(PROCESSING[0], true);
    resultBox.classList.remove("sweep");
    void resultBox.offsetWidth;               // restart sweep animation
    resultBox.classList.add("sweep");
    clearTimeout(processingTimer);
    const step = () => {
      i += 1;
      if (i < PROCESSING.length) {
        setMessage(PROCESSING[i], true);
        processingTimer = setTimeout(step, 700);
      } else {
        // hand back to the (future) result system
        playRobotAnimation("reaction");
        processingTimer = setTimeout(() => {
          resultBox.classList.remove("processing", "sweep");
          if (selectedId) setMessage(PREVIEW[selectedId], false);
          else clearMessage();
        }, 500);
      }
    };
    processingTimer = setTimeout(step, 700);
  }

  workBtn.addEventListener("pointerdown", () => {
    workBtn.classList.remove("spring");
    workBtn.classList.add("pressed", "flare");
  });
  function workRelease() {
    if (!workBtn.classList.contains("pressed")) return;
    workBtn.classList.remove("pressed");
    workBtn.classList.add("spring");
    setTimeout(() => workBtn.classList.remove("flare"), 160);
    setTimeout(() => {
      workBtn.classList.remove("spring");
      if (!prefersReduced()) workBtn.classList.add("glowing");
    }, 340);
  }
  workBtn.addEventListener("pointerup", workRelease);
  workBtn.addEventListener("pointercancel", workRelease);
  workBtn.addEventListener("pointerleave", () =>
    workBtn.classList.remove("pressed", "flare"));

  workBtn.addEventListener("click", () => {
    // the two future-facing hooks the spec asks for:
    playRobotAnimation("work");                 // robot reaction hook
    runProcessingSequence();                     // result-box animation hook
    dispatch("work", { selected: selectedId });
  });

  /* ---------------- robot animation hooks ----------------
     Safe no-ops until a real sprite sheet is wired in. They only
     swap a state class today; replace the bodies with sprite-sheet
     playback later without touching any caller. */
  const ROBOT_STATES = ["idle", "work", "reaction", "approve"];
  function playRobotAnimation(name) {
    if (!ROBOT_STATES.includes(name)) name = "idle";
    const cls = name === "approve" ? "robot-reaction" : "robot-" + name;
    robot.classList.remove("robot-idle", "robot-work", "robot-reaction");
    // force reflow so the same anim can retrigger
    void robot.offsetWidth;
    robot.classList.add(cls);
    dispatch("robot", { name });
    if (name !== "idle") {
      // fall back to idle after the one-shot reaction
      setTimeout(() => {
        robot.classList.remove("robot-work", "robot-reaction");
        robot.classList.add("robot-idle");
      }, 700);
    }
    // NOTE: real sprite sheet frame playback goes here.
  }

  /* ---------------- settings / toggles ---------------- */
  const gear  = document.getElementById("settingsGear");
  const panel = document.getElementById("settingsPanel");
  const debugControls = params.get("debug") === "1" ||
    window.location.hash === "#debug";
  if (debugControls) gear.hidden = false;
  gear.addEventListener("click", () => (panel.hidden = !panel.hidden));

  bindToggle("toggleIdle",     (on) => document.body.classList.toggle("no-idle", !on));
  bindToggle("toggleScanline", (on) => document.body.classList.toggle("no-scanline", !on));
  bindToggle("toggleMessages", (on) => {
    messagesEnabled = on;
    if (!on) { selectedId = null; clearMessage(); }
  });
  bindToggle("toggleReduced",  (on) => {
    document.body.classList.toggle("force-reduced-motion", on);
    workBtn.classList.toggle("glowing", !on && !prefersReduced());
  });
  bindToggle("toggleDisableVip", (on) => setDisabled("vip", on));

  function bindToggle(id, fn) {
    const el = document.getElementById(id);
    if (!el) return;
    fn(el.checked);
    el.addEventListener("change", () => fn(el.checked));
  }

  /* ---------------- helpers / public API ---------------- */
  function prefersReduced() {
    return document.body.classList.contains("force-reduced-motion") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function setDisabled(id, disabled) {
    const c = cards.find((x) => x.dataset.card === id);
    if (!c) return;
    c.classList.toggle("disabled", !!disabled);
    if (disabled && selectedId === id) { selectedId = null; c.classList.remove("selected"); clearMessage(); }
  }
  function dispatch(name, detail) {
    stage.dispatchEvent(new CustomEvent("bdc:" + name, { detail }));
  }
  if (prefersReduced()) workBtn.classList.remove("glowing");
  playRobotAnimation("idle");

  window.BDCMenu = {
    selectCard, setDisabled, playRobotAnimation,
    setIdleAnimations: (on) => document.body.classList.toggle("no-idle", !on),
    setScanline: (on) => document.body.classList.toggle("no-scanline", !on),
    setCardGlowMode: (mode) => document.body.classList.toggle("card-glow-overlay", mode === "overlay"),
    setReducedMotion: (on) => {
      document.body.classList.toggle("force-reduced-motion", !!on);
      workBtn.classList.toggle("glowing", !on && !prefersReduced());
    },
    setMessage: (t) => setMessage(t, false),
    get selected() { return selectedId; },
    /** listen to 'cardselect' | 'work' | 'robot' */
    on: (evt, cb) => stage.addEventListener("bdc:" + evt, (e) => cb(e.detail)),
  };
})();
