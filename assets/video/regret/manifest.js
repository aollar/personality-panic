/*
 * Regret Burger living-scene manifest.
 * All clips live in this folder; the scene module (js/regret_scene.js) reads ONLY
 * this file, so swapping art = editing this manifest (Manual §18 manifest rule).
 *
 * bb = [canvasW, canvasH, bodyW, bodyCenterX, bodyBottomY] per clip — used to keep a
 * character PLANTED when hard-cutting between clips whose canvases differ.
 * dur = one full play of the reaction in ms (revert to idle happens exactly then).
 * Values ported from the tuned regret-burger prototype.
 */
var PP_REGRET_MANIFEST = {
  base: "assets/video/regret/",
  chars: {
    mona: {
      video: true,                                     // webm/VP9-alpha clips
      idle: "mona-loop",
      poster: "mona-loop-still.png",
      box: { left: 21.0, top: -2.0, width: 31.0 },     // % of the 1672x941 scene
      clips: {
        "mona-loop":   { src: "mona-loop.webm",   bb: [480, 521, 472, 239, 521], loop: true },
        "mona-video1": { src: "mona-video1.webm", bb: [480, 515, 462, 236, 515], dur: 5200 },
        "mona-video2": { src: "mona-video2.webm", bb: [480, 512, 456, 232, 512], dur: 5200 }
      },
      ambient: ["mona-video2"], ambientEvery: 34       // rare — Mona's loop is the anchor
    },
    burger: {
      idle: "burger-idle",
      box: { left: 5.995, top: 45.402, width: 16.658 },
      clips: {
        "burger-idle":  { src: "burger-idle.webp",  bb: [281, 341, 228, 140, 314] },
        "burger-react": { src: "burger-react.webp", bb: [285, 301, 232, 142, 274], dur: 2322 },
        "burger-big":   { src: "burger-big.webp",   bb: [359, 352, 216, 176, 318], dur: 2844 },
        "burger-talk":  { src: "burger-talk.webp",  bb: [286, 308, 237, 142, 283], dur: 2600 }
      },
      ambient: ["burger-talk", "burger-react"], ambientEvery: 12
    },
    fries: {
      idle: "crispy-coping-idle",
      box: { left: 20.441, top: 48.507, width: 17.928 },
      clips: {
        "crispy-coping-idle":    { src: "crispy-coping-idle.webp",    bb: [447, 552, 334, 224, 495] },
        "crispy-coping-swagger": { src: "crispy-coping-swagger.webp", bb: [340, 350, 196, 167, 316], dur: 2880 },
        "crispy-coping-combo":   { src: "crispy-coping-combo.webp",   bb: [423, 418, 249, 204, 384], dur: 2688 }
      },
      ambient: ["crispy-coping-combo"], ambientEvery: 14
    },
    shake: {
      idle: "shame-shake-idle",
      box: { left: 34.821, top: 46.161, width: 14.713 },
      clips: {
        "shame-shake-idle": { src: "shame-shake-idle.webp", bb: [340, 544, 236, 173, 492] },
        "shame-shake-sip":  { src: "shame-shake-sip.webp",  bb: [297, 392, 176, 147, 358], dur: 3200 }
      },
      ambient: ["shame-shake-sip"], ambientEvery: 16
    }
  },
  // engine action id -> which character does what
  actions: {
    A034: { char: "burger", clip: "burger-react" },          // Regret Burger Classic
    A035: { char: "burger", clip: "burger-big" },            // Double Regret Deluxe
    A036: { char: "shake",  clip: "shame-shake-sip" },       // Shame Shake
    A037: { char: "fries",  clip: "crispy-coping-swagger" }, // Doomscroll Fries
    A041: { char: "mona",   clip: "mona-video1" }            // WORK — Mona's flourish
    // A038 Emotional Support Nuggets: intentionally no mascot (per spec)
  },
  timing: {
    ambientJitter: 0.35,      // every = base ±35%
    globalGapMs: 1600,        // min gap after ANY reaction ends before an ambient starts
    charRestMs: 2500,         // a character rests this long after any reaction
    orderQuietMs: 3500        // after a player order, ambients hold off this long
  }
};
if (typeof window !== "undefined") window.PP_REGRET_MANIFEST = PP_REGRET_MANIFEST;
