# Personality Panic Launch Command Center

A framework-free, responsive GitHub Pages roadmap for the path from the founders build through Steam Next Fest and the provisional November 17, 2026 launch.

## What is included

- Executive launch summary and dynamic countdowns
- Visual critical-path timeline
- Filterable workboard with suggested owners, dependencies, statuses, and deliverables
- Go / no-go decision gates
- Consumer-demo scope recommendation
- Product and market metrics
- Wishlist planning targets
- Six concentrated low-budget campaign moments
- Pricing, Kickstarter, content-marketing, and launch-timing decisions
- Downloadable `.ics` calendar of key dates
- Print-friendly layout

## Update the shared plan

Edit `roadmap-data.js`. Most ongoing updates require changing only:

- `status`: `not-started`, `in-progress`, `done`, `at-risk`, or `blocked`
- `owner`: `You`, `Kendrick`, or `Both`
- task dates, descriptions, and deliverables
- the provisional launch date and pricing decision
- targets and decision-gate checks

The page calculates the current phase, countdowns, calendar progress, overdue tasks, and task progress automatically.

## Preview locally

From this directory:

```bash
python -m http.server 8123
```

Then open `http://localhost:8123`.

## Publish with GitHub Pages

This roadmap lives at `launch-roadmap/`, beside the existing browser game, so publishing it does not replace the game’s root page.

1. Merge the roadmap pull request into `main`.
2. If GitHub Pages is already publishing the repository’s `main` branch from `/(root)`, the roadmap will appear automatically at `https://aollar.github.io/personality-panic/launch-roadmap/`.
3. If Pages is not enabled, open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/(root)`.
4. Save and allow the first deployment to finish.

The roadmap has no build step or third-party runtime dependency.

## Date sources

Official Steam dates were checked on July 20, 2026 against:

- Steam Next Fest: October 2026
- Steam Playtest documentation
- Steam discounting documentation

These links are included in the page footer. Recheck official dates and rules whenever the plan materially changes.
