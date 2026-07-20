window.ROADMAP_DATA.tasks.push(...[
  {
    "id": "fix-a",
    "phase": "playtest-one",
    "title": "Fix Batch A blockers before expanding access",
    "description": "Prioritize install, connection, save/rejoin, soft-lock, crash, and first-turn comprehension problems.",
    "start": "2026-08-07",
    "due": "2026-08-09",
    "owner": "Both",
    "workstream": "Product",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "batch-a"
    ],
    "deliverable": "Playtest build B."
  },
  {
    "id": "batch-b",
    "phase": "playtest-one",
    "title": "Batch B: 12–15 personality-community testers",
    "description": "Test whether the personalities feel recognizable, distinct, funny, and fair rather than shallow or stereotyped.",
    "start": "2026-08-10",
    "due": "2026-08-12",
    "owner": "Both",
    "workstream": "Playtesting",
    "priority": "high",
    "status": "not-started",
    "dependsOn": [
      "fix-a"
    ],
    "deliverable": "Theme-accuracy report and strongest personality moments."
  },
  {
    "id": "batch-c",
    "phase": "playtest-one",
    "title": "Batch C: 15–25 less-affiliated target gamers",
    "description": "Test uncoached fun, replay interest, price resistance, invitation intent, and whether the hook works without a relationship to the founders.",
    "start": "2026-08-13",
    "due": "2026-08-16",
    "owner": "Both",
    "workstream": "Playtesting",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "batch-b"
    ],
    "deliverable": "Wave 1 dashboard and verbatim player language for the store page."
  },
  {
    "id": "steam-qa-session",
    "phase": "scope-register",
    "title": "Attend or watch the Steam Next Fest Q&A",
    "description": "Use the official August 18 session to resolve registration, demo, trailer, livestream, and press-preview questions.",
    "start": "2026-08-18",
    "due": "2026-08-18",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "high",
    "status": "not-started",
    "deliverable": "Updated Steam checklist with confirmed answers."
  },
  {
    "id": "wave-one-analysis",
    "phase": "scope-register",
    "title": "Turn Wave 1 into a ranked product decision list",
    "description": "Separate foundational problems from polish, balance, content requests, and personal preferences. Preserve the strongest repeatable moments.",
    "start": "2026-08-17",
    "due": "2026-08-19",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "batch-c"
    ],
    "deliverable": "Top 10 changes with evidence and explicit non-goals."
  },
  {
    "id": "lock-demo-scope",
    "phase": "scope-register",
    "title": "Lock the consumer-demo specification",
    "description": "Default hypothesis: one map, one complete match, all essential building categories, 4–8 playable types, four pets, curated events, bots, full result screen, and wishlist/feedback calls to action.",
    "start": "2026-08-19",
    "due": "2026-08-20",
    "owner": "Both",
    "workstream": "Demo",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "wave-one-analysis"
    ],
    "deliverable": "One-page demo contract: what is in, limited, and out."
  },
  {
    "id": "coming-soon-page",
    "phase": "scope-register",
    "title": "Publish the Steam Coming Soon page",
    "description": "Use gameplay-first copy, readable capsule art, strong screenshots, accurate tags, multiplayer/solo clarity, and a trailer that communicates the hook quickly.",
    "start": "2026-08-10",
    "due": "2026-08-24",
    "owner": "You",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Public, approved Steam store page collecting wishlists."
  },
  {
    "id": "next-fest-provisional-gate",
    "phase": "scope-register",
    "title": "Internal Next Fest readiness check",
    "description": "Proceed only if external players are completing matches and the remaining problems are fixable within the September demo schedule.",
    "start": "2026-08-24",
    "due": "2026-08-24",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "lock-demo-scope"
    ],
    "deliverable": "Proceed / register-but-watch / withdraw-later decision."
  }
]);
