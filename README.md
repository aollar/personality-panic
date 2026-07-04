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
