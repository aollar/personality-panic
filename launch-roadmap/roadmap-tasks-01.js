window.ROADMAP_DATA.tasks.push(...[
  {
    "id": "align-success",
    "phase": "foundation",
    "title": "Agree on success, roles, and the decision rules",
    "description": "Define the minimum acceptable launch outcome, the strong outcome, who owns each workstream, and which conditions trigger a delay.",
    "start": "2026-07-20",
    "due": "2026-07-22",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "critical",
    "status": "in-progress",
    "deliverable": "One-page founder agreement added to the repository."
  },
  {
    "id": "full-loop-blockers",
    "phase": "foundation",
    "title": "Finish the remaining full-loop blockers",
    "description": "Add only what is required for a reliable complete match. Defer nonessential content, polish, and new systems.",
    "start": "2026-07-20",
    "due": "2026-07-27",
    "owner": "Both",
    "workstream": "Product",
    "priority": "critical",
    "status": "in-progress",
    "deliverable": "Founders build that starts, plays, scores, and ends without manual intervention."
  },
  {
    "id": "internal-matches",
    "phase": "foundation",
    "title": "Run 10 complete internal matches",
    "description": "Test different character, pet, strategy, bot, and multiplayer combinations. Log confusion, dead systems, exploits, and memorable moments.",
    "start": "2026-07-24",
    "due": "2026-07-30",
    "owner": "Both",
    "workstream": "Playtesting",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "full-loop-blockers"
    ],
    "deliverable": "Internal playtest report with the top five blockers and top five strongest moments."
  },
  {
    "id": "telemetry-feedback",
    "phase": "foundation",
    "title": "Add the minimum testing instrumentation",
    "description": "Capture crashes, match starts, first-turn completion, match completion, session length, selected type/pet, and a simple feedback form.",
    "start": "2026-07-24",
    "due": "2026-07-31",
    "owner": "Kendrick",
    "workstream": "Operations",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "A repeatable report for every Playtest wave."
  },
  {
    "id": "steam-admin-audit",
    "phase": "foundation",
    "title": "Audit Steam setup: base game, Coming Soon page, Playtest, and demo apps",
    "description": "Confirm App IDs, permissions, build branches, key access, review requirements, and who can operate Steamworks.",
    "start": "2026-07-27",
    "due": "2026-08-01",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Steam setup checklist with every missing item assigned."
  },
  {
    "id": "scope-freeze-rule",
    "phase": "foundation",
    "title": "Adopt the no-new-major-systems rule",
    "description": "After this point, additions must solve a measured testing problem or be required for the demo, Steam submission, or release.",
    "start": "2026-08-02",
    "due": "2026-08-02",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "high",
    "status": "not-started",
    "deliverable": "Written rule visible at the top of the backlog."
  },
  {
    "id": "recruit-wave-one",
    "phase": "playtest-one",
    "title": "Recruit 30–50 Wave 1 testers in three batches",
    "description": "Use friends/family for reliability, personality-community contacts for theme accuracy, and less-affiliated target gamers for commercial honesty.",
    "start": "2026-07-27",
    "due": "2026-08-03",
    "owner": "You",
    "workstream": "Playtesting",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Confirmed tester roster, session schedule, Playtest keys, and consent/feedback instructions."
  },
  {
    "id": "batch-a",
    "phase": "playtest-one",
    "title": "Batch A: 8–10 friends and family",
    "description": "Test install flow, multiplayer connections, catastrophic bugs, basic onboarding, and whether a match can finish externally.",
    "start": "2026-08-03",
    "due": "2026-08-06",
    "owner": "Both",
    "workstream": "Playtesting",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "recruit-wave-one",
      "steam-admin-audit"
    ],
    "deliverable": "Batch A notes and a ranked blocker list."
  }
]);
