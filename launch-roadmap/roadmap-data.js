window.ROADMAP_DATA = {
  "meta": {
    "title": "Personality Panic Launch Command Center",
    "subtitle": "A two-founder critical path from founders build to Steam launch",
    "projectStart": "2026-07-20",
    "targetLaunch": "2026-11-17",
    "launchLabel": "Provisional Steam launch",
    "blackFriday": "2026-11-27",
    "timezone": "America/Los_Angeles",
    "lastVerified": "2026-07-20",
    "repo": "https://github.com/aollar/personality-panic",
    "editDataUrl": "https://github.com/aollar/personality-panic/edit/main/launch-roadmap/roadmap-data.js",
    "pricing": {
      "basePrice": "$19.99",
      "launchDiscount": "15–25% for 14 days",
      "workingWindow": "Nov 17–Dec 1",
      "note": "Use one launch discount through Black Friday; do not plan an immediate second 50% discount."
    }
  },
  "principles": [
    {
      "icon": "🧪",
      "title": "Validate before scaling",
      "text": "The first 30–50 testers exist to improve the game and demo—not to create 10,000 wishlists by themselves."
    },
    {
      "icon": "📣",
      "title": "Borrow audiences",
      "text": "Creators, personality communities, showcase channels, Steam events, and player referrals are the primary reach strategy."
    },
    {
      "icon": "🎯",
      "title": "One CTA at a time",
      "text": "Each campaign moment has one main action: join the Playtest, wishlist, play the demo, or buy at launch."
    },
    {
      "icon": "✂️",
      "title": "Reduce breadth, not the loop",
      "text": "The demo should preserve a complete match and essential buildings while limiting characters, pets, events, and depth."
    }
  ],
  "phases": [
    {
      "id": "foundation",
      "number": "01",
      "name": "Finish the founders build",
      "shortName": "Founders build",
      "start": "2026-07-20",
      "end": "2026-08-02",
      "color": "pink",
      "objective": "Reach a reliable full internal match and stop adding major systems.",
      "exit": "Ten complete internal games, no blocking bugs, analytics selected, and a build ready for external hands."
    },
    {
      "id": "playtest-one",
      "number": "02",
      "name": "Closed Steam Playtest — Wave 1",
      "shortName": "Playtest 1",
      "start": "2026-08-03",
      "end": "2026-08-16",
      "color": "teal",
      "objective": "Find onboarding, multiplayer, pacing, and personality-representation problems with 30–50 invited testers.",
      "exit": "Uncoached external players can install, start, finish, and explain a match."
    },
    {
      "id": "scope-register",
      "number": "03",
      "name": "Lock the demo and register for Next Fest",
      "shortName": "Scope + register",
      "start": "2026-08-17",
      "end": "2026-08-31",
      "color": "gold",
      "objective": "Turn Wave 1 evidence into a fixed consumer-demo specification, public store page, and first trailer.",
      "exit": "Demo scope locked, store page public, marketing materials current, and Next Fest registration submitted."
    },
    {
      "id": "demo-validation",
      "number": "04",
      "name": "Consumer demo + Playtest Wave 2",
      "shortName": "Demo validation",
      "start": "2026-09-01",
      "end": "2026-09-20",
      "color": "purple",
      "objective": "Validate the exact public-facing slice with unfamiliar target players and prepare creator assets.",
      "exit": "Feature-complete demo, healthy early metrics, current trailer, creator list, and review candidate build."
    },
    {
      "id": "submission",
      "number": "05",
      "name": "Steam submission and feature freeze",
      "shortName": "Submit + freeze",
      "start": "2026-09-21",
      "end": "2026-10-07",
      "color": "blue",
      "objective": "Submit early, freeze features, and spend the remaining time on stability, onboarding, and presentation.",
      "exit": "Demo and store materials approved or in review, all required items submitted, and clean-install QA passed."
    },
    {
      "id": "press-preview",
      "number": "06",
      "name": "Press preview and creator activation",
      "shortName": "Press preview",
      "start": "2026-10-08",
      "end": "2026-10-18",
      "color": "orange",
      "objective": "Give press and creators a polished build, organized sessions, and easy-to-use coverage assets.",
      "exit": "Creator sessions booked, coverage calendar visible, and Next Fest operations rehearsed."
    },
    {
      "id": "next-fest",
      "number": "07",
      "name": "Steam Next Fest",
      "shortName": "Next Fest",
      "start": "2026-10-19",
      "end": "2026-10-26",
      "color": "green",
      "objective": "Concentrate players in the public demo, respond quickly, and convert qualified attention into wishlists.",
      "exit": "Daily metrics captured, key issues fixed, creator coverage collected, and a festival retrospective completed."
    },
    {
      "id": "launch-decision",
      "number": "08",
      "name": "Launch go / no-go",
      "shortName": "Go / no-go",
      "start": "2026-10-27",
      "end": "2026-11-02",
      "color": "red",
      "objective": "Decide from product readiness, demo behavior, wishlist momentum, creator commitments, and support capacity.",
      "exit": "A documented launch or delay decision with locked price, discount, scope, and owners."
    },
    {
      "id": "release-candidate",
      "number": "09",
      "name": "Release candidate and launch campaign",
      "shortName": "Release candidate",
      "start": "2026-11-03",
      "end": "2026-11-16",
      "color": "indigo",
      "objective": "Lock the build, complete final QA, distribute keys, and rehearse launch-day support.",
      "exit": "Approved release candidate, rollback build, scheduled campaign assets, and final launch sign-off."
    },
    {
      "id": "launch-window",
      "number": "10",
      "name": "Launch and Black Friday window",
      "shortName": "Launch window",
      "start": "2026-11-17",
      "end": "2026-12-01",
      "color": "pink",
      "objective": "Launch before Black Friday, support players aggressively, and let one launch discount cover the shopping weekend.",
      "exit": "Two-week launch review completed with sales, reviews, crashes, refunds, and acquisition sources documented."
    }
  ],
  "gates": [
    {
      "date": "2026-08-02",
      "title": "External-test readiness",
      "decision": "Open Wave 1 only when a full match reliably starts and ends.",
      "checks": [
        "No known blocker in the normal match loop",
        "External install and key flow prepared",
        "Basic telemetry and feedback path working",
        "No-new-major-systems rule accepted"
      ]
    },
    {
      "date": "2026-08-16",
      "title": "Wave 1 evidence gate",
      "decision": "Move into demo production only when uncoached players can complete and explain the experience.",
      "checks": [
        "At least 30 invited testers across three cohorts",
        "Major install/network blockers identified",
        "Top onboarding and pacing problems ranked",
        "Repeatable personality-driven moments observed"
      ]
    },
    {
      "date": "2026-08-31",
      "title": "Next Fest registration gate",
      "decision": "Register by 11:59 p.m. PDT with a public store page and current marketing materials.",
      "checks": [
        "Store page is published and public",
        "Demo scope is locked",
        "Trailer v1 is presentable",
        "September build plan is credible"
      ]
    },
    {
      "date": "2026-09-08",
      "title": "Stay or withdraw",
      "decision": "Use the one Next Fest opportunity only when the public demo can represent the game well.",
      "checks": [
        "Core loop problems are no longer fundamental",
        "Demo can be feature complete by September 11",
        "First five minutes are understandable",
        "Remaining work fits the team capacity"
      ]
    },
    {
      "date": "2026-09-21",
      "title": "Press Preview submission",
      "decision": "Submit the demo build and store page for review by the official target date.",
      "checks": [
        "Clean-install QA passes",
        "Public-demo metrics are directionally healthy",
        "Wishlist and feedback CTAs work",
        "Feature freeze begins"
      ]
    },
    {
      "date": "2026-10-27",
      "title": "November launch go / no-go",
      "decision": "Wishlist count informs the decision; it does not make the decision alone.",
      "checks": [
        "Full game is stable and releaseable",
        "Demo completion and replay behavior are healthy",
        "Wishlist growth and quality support the conservative case",
        "Meaningful creator coverage is scheduled",
        "Two founders can support launch week"
      ]
    },
    {
      "date": "2026-11-16",
      "title": "Final launch approval",
      "decision": "Launch only with a locked build, rollback, support plan, and zero known blockers.",
      "checks": [
        "Release candidate passed final QA",
        "Price and discount are configured",
        "Store and purchase flow verified",
        "Launch calendar and support shifts confirmed"
      ]
    }
  ],
  "metrics": {
    "product": [
      {
        "label": "Crash-free sessions",
        "target": "99%+",
        "warning": "Below 97%"
      },
      {
        "label": "First-turn completion",
        "target": "80%+",
        "warning": "Below 65%"
      },
      {
        "label": "Full demo-match completion",
        "target": "60%+",
        "warning": "Below 45%"
      },
      {
        "label": "Players wanting another match",
        "target": "70%+",
        "warning": "Below 50%"
      },
      {
        "label": "Second-session return",
        "target": "25%+",
        "warning": "Below 15%"
      },
      {
        "label": "First meaningful/funny consequence",
        "target": "Under 8 min",
        "warning": "Over 15 min"
      }
    ],
    "market": [
      {
        "label": "Demo → wishlist",
        "target": "20%+ healthy",
        "warning": "Below 12%"
      },
      {
        "label": "Creator pieces scheduled for launch",
        "target": "10+ meaningful",
        "warning": "Mostly maybes"
      },
      {
        "label": "Qualified wishlists",
        "target": "5k–8k strong",
        "warning": "Use with other evidence"
      },
      {
        "label": "Breakout wishlist outcome",
        "target": "10k+ stretch",
        "warning": "Not a launch law"
      },
      {
        "label": "Tracking coverage",
        "target": "UTM by campaign",
        "warning": "Unknown sources"
      },
      {
        "label": "Player recommendation language",
        "target": "Specific + spontaneous",
        "warning": "Polite generic praise"
      }
    ]
  },
  "wishlistTargets": [
    {
      "date": "2026-08-31",
      "moment": "Store page + Next Fest registration",
      "working": "250–750",
      "stretch": "1,500+",
      "meaning": "Enough early signal to learn which audiences and messages convert."
    },
    {
      "date": "2026-10-19",
      "moment": "Enter Next Fest",
      "working": "1,000–2,500",
      "stretch": "5,000+",
      "meaning": "A useful foundation for Steam-native discovery rather than expecting the festival to create everything."
    },
    {
      "date": "2026-10-27",
      "moment": "After Next Fest",
      "working": "2,500–5,000",
      "stretch": "8,000+",
      "meaning": "Combine this with demo quality, creator commitments, and full-game readiness."
    },
    {
      "date": "2026-11-17",
      "moment": "Provisional launch",
      "working": "5,000–8,000 strong",
      "stretch": "10,000+",
      "meaning": "Ten thousand is a breakout target, not a reason to ignore strong or weak evidence elsewhere."
    }
  ],
  "demoScope": {
    "rule": "Preserve the complete structure of the experience; reduce breadth and depth.",
    "keep": [
      "One polished map",
      "One complete, satisfying match with a real ending",
      "Every building category required for the core loop",
      "Solo play with bots plus the supported multiplayer experience",
      "Four to eight contrasting playable personality types",
      "All 16 types visible with full-game teasers",
      "Approximately four strategically distinct pets",
      "A curated set of the clearest and funniest events",
      "Full result screen, wishlist button, and feedback path"
    ],
    "limit": [
      "Inventories, activities, and upgrade depth inside buildings",
      "Event-library size",
      "Playable personality roster",
      "Pet roster",
      "Cosmetics and customization",
      "Match variants and long-session options"
    ],
    "exclude": [
      "A second map",
      "Long-term progression",
      "Secondary modes",
      "Most cosmetics",
      "Redundant building variants",
      "The complete 16-pet roster",
      "Anything added only to make the demo feel larger"
    ],
    "caution": "Do not close an essential building merely to create a paywall. Keep the category and reduce the choices inside it."
  },
  "campaigns": [
    {
      "date": "By Aug 24",
      "title": "Steam page reveal",
      "audience": "Existing contacts, Kendrick’s channels, personality community",
      "asset": "Store page + gameplay-first trailer",
      "cta": "Wishlist"
    },
    {
      "date": "Aug 3–Sep 18",
      "title": "Closed Playtest recruitment",
      "audience": "Friends/family, personality contacts, target gamers, selected micro-creators",
      "asset": "Steam Playtest build + honest tester brief",
      "cta": "Play and give feedback"
    },
    {
      "date": "Late Aug / early Sep",
      "title": "Trailer and showcase submissions",
      "audience": "Upcoming-game channels, indie showcases, genre roundups",
      "asset": "Main trailer + short clips + concise pitch",
      "cta": "Wishlist"
    },
    {
      "date": "Oct 8–18",
      "title": "Public demo / Press Preview",
      "audience": "Creators, press, showcases, community partners",
      "asset": "Polished demo + press kit + hosted sessions",
      "cta": "Play the demo"
    },
    {
      "date": "Oct 19–26",
      "title": "Steam Next Fest",
      "audience": "Steam demo players and creator audiences",
      "asset": "Demo + broadcasts + rapid support + social proof",
      "cta": "Wishlist"
    },
    {
      "date": "Nov 3–17",
      "title": "Launch campaign",
      "audience": "Wishlisters, demo players, creators, mailing list, communities",
      "asset": "Release build + reviews/clips + launch offer",
      "cta": "Buy"
    }
  ],
  "decisions": [
    {
      "status": "Channel roles",
      "title": "Steam Playtest → public demo → Next Fest",
      "rationale": "Use invited Playtest waves to fix the product. Then concentrate everyone in the public demo for Next Fest, where the goal shifts to discovery, conversion, creator coverage, and market evidence."
    },
    {
      "status": "Working decision",
      "title": "Target November 17 rather than Black Friday itself",
      "rationale": "Launch ten days earlier, build reviews and support history, then let the same 14-day launch discount remain active through Black Friday and Cyber Monday."
    },
    {
      "status": "Working decision",
      "title": "$19.99 base price; test a 15–25% launch discount",
      "rationale": "Use external testing to determine perceived value. Do not anchor the game at $9.99 with an immediate 50% discount."
    },
    {
      "status": "Not on critical path",
      "title": "Kickstarter for a November 2026 release",
      "rationale": "A crowdfunding campaign would compete with demo production, Steam preparation, and launch execution. Revisit only if launch moves materially later and funding has a specific expansion purpose."
    },
    {
      "status": "Operating model",
      "title": "No daily content-marketing treadmill",
      "rationale": "Create a compact set of excellent reusable assets and distribute them through six campaign moments and other people’s relevant audiences."
    },
    {
      "status": "Current demo hypothesis",
      "title": "One complete map and loop; limited breadth",
      "rationale": "Do not build a second map. Test four to eight playable types, four pets, curated events, and shallow versions of all essential building categories."
    }
  ],
  "sources": [
    {
      "title": "Steam Next Fest: October 2026 — official dates and eligibility",
      "url": "https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026october"
    },
    {
      "title": "Steam Playtest — controlled tester access",
      "url": "https://partner.steamgames.com/doc/features/playtest"
    },
    {
      "title": "Steam discounting rules and cooldowns",
      "url": "https://partner.steamgames.com/doc/marketing/discounts"
    },
    {
      "title": "GitHub Pages publishing-source documentation",
      "url": "https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site"
    }
  ]
};
window.ROADMAP_DATA.tasks = [];
