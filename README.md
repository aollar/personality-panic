# Personality Panic! — Playable MVP

First playable build of the full loop from the **MVP Master Manual v2** +
**Balance Lock v2-2** spreadsheet. Real art, real music, walking Casey on the
overmap, all 14 buildings, 118 actions, 49 named jobs, 41 items, 16 pets,
16 personality cards, CPU bots, save/resume, and internet multiplayer.

## Play it

- **Quickest:** double-click `index.html` (works straight from the file).
- **Nicer:** run `python -m http.server 8123` in this folder and open
  <http://localhost:8123>.
- **Remote with your founder:** put this folder on GitHub Pages (any static
  host works — no backend needed). One of you clicks **Multiplayer → Host a
  Room** and shares the 5-letter code; the other joins with
  **Multiplayer → Join with Code**. It's peer-to-peer (PeerJS): the host's
  browser runs the game, guests are views. If a guest drops, a bot takes over
  until they rejoin with the same name.

## The painted menus ARE the UI

Every scene's action menu is the one painted into the art. Transparent
hotspots are clipped over each painted button (`assets/data/scene_hotspots.js`
holds the per-scene coordinates) — hover for a gold glow + live tooltip with
the real TU/price/effects, red glow + 🔒 when locked (tooltip says why).
Actions that exist in the spreadsheet but not in the art live under the
**✚ More** button. The Bad Decisions Club uses the animated
"Choose Your Bad Decision" side menu (mirrored in `assets/bdc-menu/`), wired
to the engine via postMessage — card clicks perform the real actions and the
robot's result box shows the outcome.

NOTE: some prices painted into the art (e.g. Air One's $40 groceries) predate
the Balance Lock sheet. The tooltips and the engine always use the sheet's
numbers — trust the tooltip, enjoy the art.

## V3 scene visuals and apartment progression

`assets/data/scene_visuals.js` applies the new scene art without editing the
generated Balance Lock data. Game Map and Ethical Pet Shop intentionally keep
their existing visuals. High IQ University now has two painted pages, and
Heelton Heights has two rooms: the added arrow in the bedroom switches to the
lounge, while the lounge's painted arrow switches back.

Low-Cost Housing and Heelton begin with ghosted furniture. The aligned RGBA
overlays in `assets/scenes/v3/low-cost/` and `assets/scenes/v3/heelton/` are
drawn when the active player owns the corresponding item or supported pet.
The wall/floor fragments attached to those overlays are intentional occlusion
patches that cover the ghost silhouettes. The current art supports four pets
(ESFJ dog, ENFJ lion, ENFP otter, ESFP piggy) and the subset of programmed
furniture/appliances listed in the manifest; unmatched items remain a later
art pass.

Bad Decisions Club keeps its animated scene video, but its right-side menu is
temporarily static. The iframe uses the new menu art while retaining the live
action buttons and engine bridge.

Airport now has two painted pages. Page 2 contains Buy Travel Insurance and
Airport Lounge Flex; the painted arrows switch pages without leaving the scene.

## Playtest progression rules

- Jobs require at least one completed shift each player-week after the hiring
  or promotion grace week; missing the full week fires the player.
- Career ladders are sequential. Players apply only to entry roles, complete
  two shifts, then use Ask for Promotion to advance exactly one pay rung.
- The current six university courses are sequential and one-time. Completed
  courses stay greyed out and only the next course is selectable.
- Buying groceries satisfies the current turn's meal and stores only the
  remaining weeks for later Eat at Home actions.
- The HUD's GO LUXURY action is usable from Low-Cost Housing and moves the
  player immediately into Heelton Heights after payment.

## Where the numbers live

| File | What it is |
|---|---|
| `assets/data/gamedata.js` | GENERATED from the Balance Lock spreadsheet. Never hand-edit. |
| `scripts/build_data.py` | Regenerates the above: `python scripts/build_data.py` after any spreadsheet change. |
| `js/assumptions.js` | Every number the spec did NOT define (starting money, hunger/stress penalties, movement costs, pet decay, thresholds…). All tunable. Also visible in-game: **Menu → Balance Debug Panel**. |
| `js/engine.js` | Pure game rules (no UI). Same file drives the browser, the bots, and the tests. |
| `js/bots.js` | CPU bot brain (priority script per Manual §17). |

## Tests

```
python -m http.server 8123        # for the browser tests
node test/simulate.js 20 100      # 20 full bot games at T=100: must all finish
node test/e2e.js                  # drives the real UI headless (screenshots in test/shots/)
node test/podium.js               # end-of-game podium check
node test/multiplayer.js          # host+join over the real PeerJS broker
```

## Balance findings from simulation (for your playtests)

1. **Connection is the slowest main stat.** Club actions sit behind Dressy
   Clothes + money, and per-action gains are small. Bots always plateau there.
   Watch it in real games; if humans feel it too, cheapen Dance/Get Digits or
   raise their gains in the spreadsheet.
2. **Critical Thinking gates the whole economy** (all mid+ jobs). Players who
   skip University get stuck in $8–10 jobs. Probably intended — but brutal.
3. **The Messiah exploit:** it's the only Max-tier job with no clothes
   requirement (Enlightenment 90+, Career 70+). Bots beeline for it.
4. **Games rarely end by stat-max.** The "ends after N turns" setup option
   (default Short=30) guarantees an ending; the podium scores by points.
5. The debug panel logs every game's winner (Manual §6.5 win-rate rule) and
   has a **copy full playtest log** button — paste those logs back to Claude
   for tuning.

## Known gaps / deferred

- Re-Education Temple has no music track (spec gap) — overmap music plays there.
- Newspaper turn-start screen: skipped for MVP by decision (player card shows instead).
- Characters are not composited into scene art (Casey appears as the mascot everywhere).
- Turn timer runs on each client; the host also enforces it.
- Painted menu prices are authored for Short games (T=100); medium/long games
  still rely on live engine values/tooltips when the baked number differs.
- Apartment overlays exist only for the supplied item/pet subset; missing
  ownership visuals remain ghosted until additional aligned art is authored.
- The delivered sound pack has no bus movement cue. Bus Pass movement still
  uses the walking fallback until a bus file is supplied.
- Cram All Night, Debate Professor, and University Work do not yet have unique
  school cues in the delivered pack. Other supplied university actions are mapped.
