# Living Regret Burger — Fable 5 submission

**Baseline:** `9e04c9b` (current `main`) · **Branch:** `hth/regret-burger-fable` · not deployed, `main` untouched.
**Capture:** `CAPTURE_regret_burger_fable.mp4` (26.5s @ 31.5fps: idle life → Classic → Deluxe → Shame Shake → WORK → settle).

## Integration approach
1. **Composed backdrop, zero hotspot churn.** New `assets/scenes/regret_burger_live.jpg` =
   the prototype's clean diner + the game's painted ORDER REVIEW panel composited on the
   right with a 28px feathered seam. Every existing painted button (A034–A041, incl.
   nuggets & More-drawer items) keeps working **pixel-identical** — ordering UI untouched.
2. **Mascot layer as a module** (`js/regret_scene.js` + `assets/video/regret/manifest.js`).
   All clips, bboxes, durations, positions, and timing knobs live in the manifest
   (Manual §18: swap art with zero code changes). Mounted/unmounted by `openScene`/
   `closeScene`; layer is `pointer-events:none` under the hotspot layer.
3. **The prototype's proven transitions, preserved exactly.**
   - Mona (webm): one `<video>` per clip, all in the DOM and pre-decoded; **hard cut** by
     opacity flip — exactly one visible at any instant, `transition:none`. No crossfade
     (see-through), no residual base layer (ghost), never detached (blank).
   - Item mascots (webp): one visible `<img>`, every variant pre-decoded at mount
     (`Image.decode()`), fresh `src` assignment starts a reaction at frame 0;
     bbox anchoring (`bodyCenterX/bottomY` per clip) keeps characters **planted** across
     canvas-size changes.
4. **Engine-first ordering.** The mascot reacts only after `E.perform` **accepts** the
   action (locked/unaffordable orders → toast, no reaction). A038 nuggets: functional,
   un-animated per spec. Guests validate before sending, so no reaction on rejects.

## Timing parameters (all in `manifest.js → timing`)
| Knob | Value |
|---|---|
| Reaction hold | exact clip length: react 2322ms · big 2844 · swagger 2880 · sip 3200 · Mona flourish `ended`-driven (~5.2s, +700ms fallback) |
| Ambient cadence | burger 12s · fries 14s · shake 16s · Mona 34s — each ±35% jitter; first firing +2.5s stagger |
| Global stagger | **one ambient at a time**, ≥1.6s gap after any reaction ends, each char rests ≥2.5s after reacting |
| Order quiet window | ambients hold off 3.5s after any player order |
| Collisions | player orders are **immediate & never queued**; same-item spam restarts the clip; different-item orders may overlap each other (each is direct feedback); ambient never overlaps a player reaction |

Rationale: Mona's continuous loop anchors the scene; item mascots accent every ~12–16s so
at rest something happens roughly every 4–6s **somewhere**, never twice at once, never
synchronized — "busy little diner", not twitchy. Orders own the stage the moment they're
clicked and cost the player zero waiting.

## How smoothness was verified (`test/rb_smoothness.js` + `test/rb_analyze.py`)
- **Blank/flash detection:** reference screenshot with the mascot layer hidden, then 34-frame
  bursts (70ms apart) across *single order*, *same-item spam (420ms apart)*, and
  *cross-character double order*; every frame's mascot region compared (RMS) against the
  empty background. **0 blank frames, 0 flicker clusters** in all three bursts.
- **Opacity invariant:** 120 samples @50ms during Mona's WORK reaction — **exactly one**
  video layer visible at every sample (0 violations).
- **Positive assertions:** each order verified to start the *mapped* clip; all four
  characters verified back on idle afterward.
- **Regression:** `test/e2e.js`, club (BDC iframe), podium, and the bot simulation all pass;
  **zero console errors**; degradation = manifest `onerror` drops a clip silently (dead idle
  hides the character; the scene and every button keep working).
- Burst frames kept in `test/shots/burst/` for eyeball review; capture spot-checked
  frame-by-frame against the timeline before submission.

## Files touched
`assets/scenes/regret_burger_live.jpg` (new) · `assets/video/regret/*` (13 clips + manifest, new) ·
`js/regret_scene.js` (new) · `js/ui.js` (mount/unmount + accepted-order hook, ~12 lines) ·
`css/style.css` (+8 lines) · `index.html` (2 script tags) · tests: `rb_visual.js`,
`rb_smoothness.js`, `rb_analyze.py`, `rb_capture.js`.
