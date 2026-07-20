window.ROADMAP_DATA.tasks.push(...[
  {
    "id": "press-kit",
    "phase": "demo-validation",
    "title": "Finish press and creator kit v1",
    "description": "Include concise pitch, screenshots, logos, trailer, gameplay clips, player count, match length, solo/bot details, recording guidance, and contact information.",
    "start": "2026-09-07",
    "due": "2026-09-18",
    "owner": "You",
    "workstream": "Marketing",
    "priority": "high",
    "status": "not-started",
    "deliverable": "One link that gives a creator everything required to decide and record."
  },
  {
    "id": "submission-candidate",
    "phase": "demo-validation",
    "title": "Lock the Steam review candidate",
    "description": "Run clean install, first-launch, controller, display, audio, network, disconnect/rejoin, save, bot, and low-end performance checks.",
    "start": "2026-09-16",
    "due": "2026-09-20",
    "owner": "Both",
    "workstream": "Operations",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Signed-off build and store materials ready for review submission."
  },
  {
    "id": "submit-press-preview",
    "phase": "submission",
    "title": "Submit demo build and store page for Press Preview review",
    "description": "Submit by the official September 21 date, preferably earlier, and track any Steam review feedback immediately.",
    "start": "2026-09-19",
    "due": "2026-09-21",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "submission-candidate"
    ],
    "deliverable": "Steam review submission receipt and owner for every response."
  },
  {
    "id": "feature-freeze",
    "phase": "submission",
    "title": "Begin hard feature freeze",
    "description": "Only fix bugs, onboarding, performance, severe balance outliers, store presentation, localization, and input problems.",
    "start": "2026-09-21",
    "due": "2026-09-21",
    "owner": "Both",
    "workstream": "Product",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Frozen backlog with explicit exceptions."
  },
  {
    "id": "stability-sprint",
    "phase": "submission",
    "title": "Run the demo stability and conversion sprint",
    "description": "Fix the largest drop-off points and polish the capsule, trailer, screenshots, short description, demo ending, wishlist prompt, and feedback path.",
    "start": "2026-09-22",
    "due": "2026-10-04",
    "owner": "Both",
    "workstream": "Demo",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "validate-demo",
      "feature-freeze"
    ],
    "deliverable": "Approved or approval-ready Next Fest build."
  },
  {
    "id": "all-items-due",
    "phase": "submission",
    "title": "Submit every remaining required Next Fest item",
    "description": "Confirm registration, categories, demo, store page, assets, permissions, and festival settings before the official final review date.",
    "start": "2026-10-01",
    "due": "2026-10-05",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "All required items submitted by October 5."
  },
  {
    "id": "pre-preview-qa",
    "phase": "submission",
    "title": "Run final pre-preview clean-room QA",
    "description": "Test from a clean Steam install on multiple machines and accounts without developer shortcuts or founder explanations.",
    "start": "2026-10-05",
    "due": "2026-10-07",
    "owner": "Both",
    "workstream": "Operations",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Pass/fail matrix and rollback build."
  },
  {
    "id": "press-preview-live",
    "phase": "press-preview",
    "title": "Make the demo available for the Press Preview",
    "description": "Opt in, verify availability at 10 a.m. PDT, and send the first concentrated creator/showcase outreach wave.",
    "start": "2026-10-08",
    "due": "2026-10-08",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Press-preview-ready demo and live campaign links."
  }
]);
