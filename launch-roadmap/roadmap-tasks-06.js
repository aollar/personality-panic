window.ROADMAP_DATA.tasks.push(...[
  {
    "id": "launch-scope-lock",
    "phase": "launch-decision",
    "title": "Lock release scope and the post-launch backlog",
    "description": "Separate launch blockers from week-one fixes, month-one updates, and desirable future content. Park Kickstarter unless the release moves materially later.",
    "start": "2026-10-28",
    "due": "2026-10-30",
    "owner": "Both",
    "workstream": "Product",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Frozen launch scope and prioritized post-launch plan."
  },
  {
    "id": "rc-lock",
    "phase": "release-candidate",
    "title": "Lock the release candidate",
    "description": "No content changes after this date without a documented blocker and rollback plan.",
    "start": "2026-11-03",
    "due": "2026-11-03",
    "owner": "Both",
    "workstream": "Product",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "launch-gate",
      "launch-scope-lock"
    ],
    "deliverable": "Versioned release candidate and separate rollback build."
  },
  {
    "id": "launch-keys",
    "phase": "release-candidate",
    "title": "Distribute launch keys and confirm coverage",
    "description": "Prioritize creators who played or responded during the demo campaign; provide date, embargo, multiplayer-session help, and final assets.",
    "start": "2026-11-03",
    "due": "2026-11-06",
    "owner": "You",
    "workstream": "Creators",
    "priority": "high",
    "status": "not-started",
    "deliverable": "Confirmed launch coverage calendar."
  },
  {
    "id": "final-qa",
    "phase": "release-candidate",
    "title": "Run final release QA and failure drills",
    "description": "Test fresh installs, upgrades, multiplayer, bots, saves, settings, edge cases, release branches, price display, support channels, and rollback/hotfix procedures.",
    "start": "2026-11-03",
    "due": "2026-11-13",
    "owner": "Both",
    "workstream": "Operations",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Signed release checklist with zero known blockers."
  },
  {
    "id": "launch-campaign-schedule",
    "phase": "release-candidate",
    "title": "Schedule the concentrated launch campaign",
    "description": "Prepare Steam announcement, mailing sequence, creator reminders, Kendrick channel videos, showcase follow-ups, community posts, and launch-day clips.",
    "start": "2026-11-05",
    "due": "2026-11-10",
    "owner": "You",
    "workstream": "Marketing",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "One launch calendar with links, copy, assets, owners, and UTMs."
  },
  {
    "id": "final-approval",
    "phase": "release-candidate",
    "title": "Final founder launch approval",
    "description": "Confirm build, store, discount, support, creator calendar, rollback plan, and personal availability for launch week.",
    "start": "2026-11-16",
    "due": "2026-11-16",
    "owner": "Both",
    "workstream": "Strategy",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Written go decision and launch-day command sheet."
  },
  {
    "id": "launch-day",
    "phase": "launch-window",
    "title": "Launch Personality Panic on Steam",
    "description": "Release before the Black Friday noise peak, activate the launch discount, publish the announcement, support creators, and monitor the funnel continuously.",
    "start": "2026-11-17",
    "due": "2026-11-17",
    "owner": "Both",
    "workstream": "Steam",
    "priority": "critical",
    "status": "not-started",
    "dependsOn": [
      "final-approval"
    ],
    "deliverable": "Successful release with verified purchasing, matchmaking, support, and analytics."
  },
  {
    "id": "launch-support",
    "phase": "launch-window",
    "title": "Run daily launch support and evidence-based hotfixes",
    "description": "Track crashes, refunds, review themes, support volume, creator traffic, purchases, and multiplayer health. Fix severe issues without destabilizing the build.",
    "start": "2026-11-17",
    "due": "2026-12-01",
    "owner": "Both",
    "workstream": "Operations",
    "priority": "critical",
    "status": "not-started",
    "deliverable": "Daily launch dashboard and published patch notes when needed."
  }
]);
