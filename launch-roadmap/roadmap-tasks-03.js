window.ROADMAP_DATA.tasks.push(...[
  {
    "id": "trailer-v1",
    "phase": "scope-register",
    "title": "Finish gameplay trailer v1",
    "description": "Open on gameplay, show a personality-driven choice, a funny consequence, and player competition. Avoid slow logos and lore-first framing.",
    "start": "2026-08-17",
    "due": "2026-08-28",
    "owner": "Kendrick",
    "workstream": "Marketing",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Steam-ready trailer plus 30-second and vertical cutdowns."
  },
  {
    "id": "register-next-fest",
    "phase": "scope-register",
    "title": "Register the base game for October Next Fest",
    "description": "Submit registration before the official deadline and make sure marketing materials are current for possible official inclusion.",
    "start": "2026-08-24",
    "due": "2026-08-31",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "coming-soon-page",
      "next-fest-provisional-gate"
    ],
    "deliverable": "Confirmed October Next Fest registration before 11:59 p.m. PDT."
  },
  {
    "id": "trailer-final-pull",
    "phase": "demo-validation",
    "title": "Put the strongest current trailer on the base-game page",
    "description": "Steam plans to pull trailers on September 7 for official Next Fest trailer consideration.",
    "start": "2026-09-01",
    "due": "2026-09-06",
    "owner": "Kendrick",
    "workstream": "Marketing",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "trailer-v1"
    ],
    "deliverable": "Current trailer live before the September 7 pull."
  },
  {
    "id": "recruit-wave-two",
    "phase": "demo-validation",
    "title": "Recruit 30–75 unfamiliar Wave 2 testers",
    "description": "Prioritize digital board-game, party-game, life-sim, social-sim, and personality-community players who do not know the founders.",
    "start": "2026-08-24",
    "due": "2026-09-03",
    "owner": "You",
    "workstream": "Playtesting",
    "priority": "high",
    "status": "not-started",
    "deliverable": "Wave 2 roster with source attribution."
  },
  {
    "id": "stay-withdraw-gate",
    "phase": "demo-validation",
    "title": "Final stay-or-withdraw decision for October Next Fest",
    "description": "Stay only if the demo path is clear, the core loop is understood, and the largest remaining risks are polish rather than fundamental design.",
    "start": "2026-09-08",
    "due": "2026-09-08",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Documented decision; withdrawal preserves a future Next Fest opportunity if eligibility remains."
  },
  {
    "id": "demo-feature-complete",
    "phase": "demo-validation",
    "title": "Reach consumer-demo feature complete",
    "description": "No new demo features after this point. Remaining work is bugs, onboarding, pacing, UI, performance, and content curation.",
    "start": "2026-09-01",
    "due": "2026-09-11",
    "owner": "Both",
    "workstream": "Demo",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "lock-demo-scope"
    ],
    "deliverable": "Public-demo release candidate 0.1."
  },
  {
    "id": "validate-demo",
    "phase": "demo-validation",
    "title": "Test the exact public-demo experience",
    "description": "Observe the first five minutes without coaching; measure first-turn completion, match completion, replay intent, and demo-to-wishlist behavior.",
    "start": "2026-09-09",
    "due": "2026-09-18",
    "owner": "Both",
    "workstream": "Playtesting",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "demo-feature-complete",
      "recruit-wave-two"
    ],
    "deliverable": "Consumer-demo metrics report with go/fix findings."
  },
  {
    "id": "creator-database",
    "phase": "demo-validation",
    "title": "Build the segmented creator and showcase database",
    "description": "Target 200–300 relevant contacts across personality, party/board game, life/social sim, micro-streamer, upcoming-game, and indie-showcase channels.",
    "start": "2026-08-24",
    "due": "2026-09-16",
    "owner": "You",
    "workstream": "Creators",
    "priority": "high",
    "status": "not-started",
    "deliverable": "Ranked CRM with fit, reach, contact, pitch angle, status, and UTM link."
  }
]);
