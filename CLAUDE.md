# Personality Panic — working notes

Static browser game, no build step. `index.html` + `js/` + `assets/`. The live
site is https://aollar.github.io/personality-panic/ and deploys from `main`
(GitHub Action "Deploy to GitHub Pages"), so pushing to `main` ships it.

## Source of truth for numbers

`docs/Personality_Panic_Balance_Lock_v7.xlsx` is the spreadsheet every number
comes from, and `docs/Personality_Panic_MVP_Master_Manual_v7.docx` is the
rules manual (PDF copy alongside). The v6-1 files stay in `docs/` for diffing. Both live in this repo so the newest copy can never be lost.

    python scripts/build_data.py      # xlsx -> assets/data/gamedata.js

Never hand-edit `assets/data/gamedata.js`. Change the spreadsheet and re-run.
`js/assumptions.js` holds only what the spreadsheet does NOT define.

## Keep the documents current — this matters

Austin drafts each new spreadsheet/manual version *from the previous one*. Any
rule that lives only in the code is silently dropped the next time a version is
generated. This has already happened twice: v5 was drafted from an old v3 and
undid the hunger/stress penalties, and v6 was drafted from the original v5 and
undid the painted-menu prices.

**So: whenever you change a rule, update the spreadsheet and the manual in the
same commit as the code.**

- A number the sheet defines → change it in the sheet, re-run the build script.
- A rule the sheet does not define → add it to **Section 27 "Build deltas"** in
  the manual and the **Build_Notes** sheet in the workbook.
- Then copy both files into `docs/` and commit them.
- When Austin sends a newer version, diff it against `docs/` first and call out
  anything it reverts before implementing it.

## Testing

    node test/v7_rules.js        # v7 rules (repricing, gates, stakes, efficiency, Biggest Spender)
    node test/v7_cpu_sim.js      # CPU difficulty levels really differ (Easy flounders, bots invest)
    node test/v6_rules.js        # v6 rules (career curve, wages, rent, difficulty…)
    node test/v5_rules.js        # v5 rules (prices, fixtures, investments…)
    node test/kendrick_regressions.js
    node test/weekend.js
    node test/simulate.js 8 100  # full CPU games; check nothing stalls

Browser suites need a server (`python -m http.server 8123`), Chrome and
`npm install --no-save puppeteer-core@23.11.1` (node_modules is gitignored):

    node test/playtest_v5.js                   # 65 checks, drives the real UI
    PP_URL=https://aollar.github.io/personality-panic/index.html node test/playtest_v5.js
    node test/e2e.js  node test/kendrick_ui.js  node test/manual_menu_ui.js
    node test/v7_step2_ui.js   node test/multiplayer.js   # auto-end, clock, free play
    PORT=8123 node test/multiplayer2.js   # stale: fails before its walk step (pre-v7)

Run the browser suites before pushing anything that touches `js/ui.js`,
`assets/data/scene_*.js` or scene art.

## Traps

- **40 Time Units per turn** (Austin's choice) vs the sheet's assumed 6. Any
  "per turn" balance rule is far weaker in play: the v6 Career curve still lets
  Career max around round 8. Lowering Time Units per turn is the lever.
- **T vs B.** T is the stat cap only. B is the economy base every percentage
  resolves against (Short 100 / Medium 250 / Long 350).
- **Painted menus are the UI.** Scene art carries the buttons; hotspots in
  `assets/data/scene_hotspots.js` and `scene_visuals.js` are transparent boxes
  over them. After swapping art, re-measure every box and screenshot it.
- Where art shows a stale price, the game draws a live tag over it
  (`livePriceTags` in `js/ui.js`) rather than trusting the painting. A hotspot's
  `price: { box, style, painted }` works for items and (v7) actions; the tag
  only shows when the live price differs from `painted`. The club menu iframe
  gets its prices by postMessage (`bdcPrices`).
- `test/shots/` holds screenshots from the browser suites — handy for checking
  a menu without opening the game.

## v7 build status

Step 1 (spreadsheet-driven) DONE on `claude/v7-build`: prices, flat gym/flight
points, 0-TU mall and investments, doubled job gates, Host Friends ungated, no
work penalties (incl. Work From Home), Crocodile Sandals purchase trigger, live
price tags on gym / airport / club / mall STYLE + GEAR.
Step 2 DONE (2026-11-08): turn auto-ends at 0 TU after actions AND travel
(`autoEndIfOut` in ui.js; the host does it for online guests in net.js
`hostAutoEnd`); the clock sits above every in-game dialog (z61) and dialogs
reserve its band; the Unlimited timer shows Time Units left, not ∞; free play
(1 human, 0 bots) on the setup screen.
Step 3 DONE (2026-11-08): investment stakes 1x/5x/10x B picked in a dialog
(`needsChoice: "stake"`; guests pick locally), returns a share of the stake
(savings 3%, bonds 4%, stocks +20/+8/-8/-20, crypto +50/+-15/rug pull = whole
stake), holdings + stakes on the HUD chip, efficiency 0.85 at Air One /
Regret Burger / Club (Building_Map column I), money spent tracked
(`p.spent`, engine `spend()`), Biggest Spender +10% of T at final scoring,
Easy flounders / Medium plans one turn / Medium+Hard invest. Debtstreet shows a
"$100+" live tag until its art is redone.
Still to build: step 4 (remove the More menu) — needs the art pass first.
`node test/v7_cpu_sim.js` checks the CPU levels really differ.

## Open decisions

1. Time Units per turn: 40 today; 20 roughly restores the intended pacing.
2. Low Cost Housing art shows a TV and couch that are Luxury-only, so that room
   can never look fully furnished.
3. Mall HOME tab art still shows v4 prices (covered by live tags).
4. v7 art: all menus match v7 as of 2026-11-08 (gym + park repaint, then a
   12-image icon/price pass: Heelton, Low Cost, airport, mall STYLE/GEAR, club,
   Debtstreet, Air One, Pet Shop). Painted prices are Short-game prices; live
   tags cover them only when the price differs (Medium/Long). Next art is tied
   to v7 step 3 (Debtstreet stakes) and step 4 (removing More).
5. Art pending: weekend cards I09/I10.
