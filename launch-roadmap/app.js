(() => {
  "use strict";

  const data = window.ROADMAP_DATA;
  if (!data) {
    document.body.innerHTML = "<p style='padding:2rem'>Roadmap data failed to load.</p>";
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const STATUS_LABELS = {
    "not-started": "Not started",
    "in-progress": "In progress",
    "done": "Done",
    "at-risk": "At risk",
    "blocked": "Blocked"
  };

  const COLORS = {
    pink: { solid: "#ff6c9d", soft: "rgba(255,108,157,.16)" },
    teal: { solid: "#51dfc0", soft: "rgba(81,223,192,.16)" },
    gold: { solid: "#ffc85b", soft: "rgba(255,200,91,.16)" },
    purple: { solid: "#a98bff", soft: "rgba(169,139,255,.16)" },
    blue: { solid: "#78b7ff", soft: "rgba(120,183,255,.16)" },
    orange: { solid: "#ff9b61", soft: "rgba(255,155,97,.16)" },
    green: { solid: "#7ce07c", soft: "rgba(124,224,124,.16)" },
    red: { solid: "#ff7777", soft: "rgba(255,119,119,.16)" },
    indigo: { solid: "#7f90ff", soft: "rgba(127,144,255,.16)" }
  };

  const now = new Date();
  const projectStart = parseDate(data.meta.projectStart);
  const projectEnd = parseDate("2026-12-01");
  const launchDate = parseDate(data.meta.targetLaunch);
  const nextFestStart = new Date("2026-10-19T10:00:00-07:00");

  function parseDate(value) {
    return new Date(`${value}T12:00:00-07:00`);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function daysUntil(date) {
    const diff = date.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / 86400000));
  }

  function dateProgress(date, start = projectStart, end = projectEnd) {
    return clamp((date.getTime() - start.getTime()) / (end.getTime() - start.getTime()), 0, 1);
  }

  function formatDate(value, options = {}) {
    const date = typeof value === "string" ? parseDate(value) : value;
    return new Intl.DateTimeFormat("en-US", {
      month: options.month ?? "short",
      day: options.day ?? "numeric",
      year: options.year ?? undefined,
      timeZone: data.meta.timezone
    }).format(date);
  }

  function formatDateLong(value) {
    const date = typeof value === "string" ? parseDate(value) : value;
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: data.meta.timezone
    }).format(date);
  }

  function formatRange(start, end) {
    const a = parseDate(start);
    const b = parseDate(end);
    const sameMonth = a.getMonth() === b.getMonth();
    if (sameMonth) {
      return `${formatDate(a)}–${new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: data.meta.timezone }).format(b)}`;
    }
    return `${formatDate(a)}–${formatDate(b)}`;
  }

  function phaseState(phase) {
    const start = parseDate(phase.start);
    const end = new Date(`${phase.end}T23:59:59-07:00`);
    if (now < start) return "upcoming";
    if (now > end) return "past";
    return "current";
  }

  function getCurrentPhase() {
    const current = data.phases.find((phase) => phaseState(phase) === "current");
    if (current) return current;
    if (now < projectStart) return data.phases[0];
    return data.phases[data.phases.length - 1];
  }

  function phaseById(id) {
    return data.phases.find((phase) => phase.id === id);
  }

  function taskById(id) {
    return data.tasks.find((task) => task.id === id);
  }

  function setPhaseVariables(element, phase) {
    const palette = COLORS[phase.color] ?? COLORS.pink;
    element.classList.add(`color-${phase.color}`);
    element.style.setProperty("--phase-color", palette.solid);
    element.style.setProperty("--phase-soft", palette.soft);
  }

  function renderHero() {
    const currentPhase = getCurrentPhase();
    const state = phaseState(currentPhase);
    const currentStatus = $("#current-phase-status");
    const currentName = $("#current-phase-name");
    const currentObjective = $("#current-phase-objective");

    currentStatus.textContent = state === "past" ? "Launch window" : state;
    currentName.textContent = currentPhase.name;
    currentObjective.textContent = currentPhase.objective;

    $("#days-to-nextfest").textContent = daysUntil(nextFestStart).toLocaleString();
    $("#days-to-launch").textContent = daysUntil(launchDate).toLocaleString();

    const progress = dateProgress(now);
    $("#calendar-progress").style.width = `${Math.round(progress * 100)}%`;
    $("#calendar-progress-label").textContent = `${Math.round(progress * 100)}%`;

    const milestones = [
      { date: "2026-08-31", label: "Next Fest registration deadline" },
      { date: "2026-09-07", label: "Steam trailer pull" },
      { date: "2026-09-21", label: "Press Preview submission target" },
      { date: "2026-10-05", label: "All Next Fest items due" },
      { date: "2026-10-08", label: "Press Preview begins" },
      { date: "2026-10-19", label: "Steam Next Fest begins" },
      { date: "2026-10-27", label: "Launch go / no-go" },
      { date: data.meta.targetLaunch, label: data.meta.launchLabel }
    ];
    const next = milestones.find((item) => parseDate(item.date) >= now) ?? milestones[milestones.length - 1];
    $("#next-deadline").innerHTML = `<strong>Next: ${escapeHtml(next.label)}</strong>${escapeHtml(formatDateLong(next.date))} · ${daysUntil(parseDate(next.date))} days`;

    $("#edit-plan-link").href = data.meta.editDataUrl;
    $("#footer-edit-link").href = data.meta.editDataUrl;
    $("#footer-launch-date").textContent = formatDateLong(data.meta.targetLaunch);
    $("#verified-date").textContent = formatDateLong(data.meta.lastVerified);
  }

  function renderSummary() {
    const items = [
      {
        label: "Official deadline",
        value: "Aug 31",
        note: "Next Fest registration · 11:59 p.m. PDT"
      },
      {
        label: "Official target",
        value: "Sep 21",
        note: "Demo + store review for Press Preview"
      },
      {
        label: "Official event",
        value: "Oct 19–26",
        note: "Steam Next Fest"
      },
      {
        label: "Provisional launch",
        value: "Nov 17",
        note: "Go / no-go decision on Oct 27"
      },
      {
        label: "Working price",
        value: data.meta.pricing.basePrice,
        note: data.meta.pricing.launchDiscount
      }
    ];

    $("#summary-grid").innerHTML = items.map((item) => `
      <div class="summary-item">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
        <small>${escapeHtml(item.note)}</small>
      </div>
    `).join("");
  }

  function renderPrinciples() {
    $("#principle-grid").innerHTML = data.principles.map((item) => `
      <article class="principle-card">
        <div class="icon" aria-hidden="true">${escapeHtml(item.icon)}</div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.text)}</p>
      </article>
    `).join("");
  }

  function renderGantt() {
    const gantt = $("#gantt");
    const totalMs = projectEnd.getTime() - projectStart.getTime();
    const monthStarts = [
      { date: "2026-07-20", label: "Jul" },
      { date: "2026-08-01", label: "Aug" },
      { date: "2026-09-01", label: "Sep" },
      { date: "2026-10-01", label: "Oct" },
      { date: "2026-11-01", label: "Nov" },
      { date: "2026-12-01", label: "Dec" }
    ];

    const axis = document.createElement("div");
    axis.className = "gantt-axis";
    axis.innerHTML = `
      <div class="gantt-axis-label">Phase</div>
      <div class="gantt-months">
        ${monthStarts.map((month) => {
          const left = dateProgress(parseDate(month.date)) * 100;
          return `<span class="gantt-month" style="left:${left}%">${month.label}</span>`;
        }).join("")}
      </div>
    `;
    gantt.appendChild(axis);

    data.phases.forEach((phase) => {
      const row = document.createElement("div");
      const state = phaseState(phase);
      row.className = `gantt-row color-${phase.color} is-${state}`;
      setPhaseVariables(row, phase);

      const start = parseDate(phase.start);
      const end = new Date(`${phase.end}T23:59:59-07:00`);
      const left = clamp((start.getTime() - projectStart.getTime()) / totalMs, 0, 1) * 100;
      const right = clamp((end.getTime() - projectStart.getTime()) / totalMs, 0, 1) * 100;
      const width = Math.max(1.25, right - left);

      row.innerHTML = `
        <div class="gantt-row-label">
          <strong>${escapeHtml(phase.shortName)}</strong>
          <span>${escapeHtml(formatRange(phase.start, phase.end))}</span>
        </div>
        <div class="gantt-track">
          <div class="gantt-bar" style="left:${left}%;width:${width}%" title="${escapeHtml(phase.name)}: ${escapeHtml(formatRange(phase.start, phase.end))}"></div>
        </div>
      `;
      gantt.appendChild(row);
    });

    const todayProgress = dateProgress(now);
    if (now >= projectStart && now <= projectEnd) {
      const layer = document.createElement("div");
      layer.className = "gantt-today-layer";

      const marker = document.createElement("div");
      marker.className = "gantt-today";
      marker.style.left = `${todayProgress * 100}%`;

      layer.appendChild(marker);
      gantt.appendChild(layer);
    }
  }

  function renderPhaseCards() {
    const container = $("#phase-cards");
    data.phases.forEach((phase) => {
      const state = phaseState(phase);
      const card = document.createElement("article");
      card.className = `phase-card color-${phase.color} is-${state}`;
      setPhaseVariables(card, phase);
      card.innerHTML = `
        <div class="phase-number">${escapeHtml(phase.number)}</div>
        <div>
          <div class="phase-card-top">
            <h3>${escapeHtml(phase.name)}</h3>
            <span class="phase-dates">${escapeHtml(formatRange(phase.start, phase.end))}</span>
          </div>
          <p>${escapeHtml(phase.objective)}</p>
          <div class="phase-exit"><strong>Exit:</strong> ${escapeHtml(phase.exit)}</div>
          <a class="phase-task-link" href="#workboard" data-phase-jump="${escapeHtml(phase.id)}">View this phase’s tasks →</a>
        </div>
      `;
      container.appendChild(card);
    });

    $$('[data-phase-jump]').forEach((link) => {
      link.addEventListener("click", () => {
        const phaseFilter = $("#phase-filter");
        phaseFilter.value = link.dataset.phaseJump;
        renderTasks();
      });
    });
  }

  function populateFilters() {
    const addOptions = (select, values, formatter = (v) => v) => {
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = formatter(value);
        select.appendChild(option);
      });
    };

    addOptions($("#phase-filter"), data.phases.map((phase) => phase.id), (id) => phaseById(id).shortName);
    addOptions($("#owner-filter"), [...new Set(data.tasks.map((task) => task.owner))].sort());
    addOptions($("#workstream-filter"), [...new Set(data.tasks.map((task) => task.workstream))].sort());
    addOptions($("#status-filter"), [...new Set(data.tasks.map((task) => task.status))], (status) => STATUS_LABELS[status] ?? status);

    ["#task-search", "#phase-filter", "#owner-filter", "#workstream-filter", "#status-filter", "#critical-filter"].forEach((selector) => {
      $(selector).addEventListener(selector === "#task-search" ? "input" : "change", renderTasks);
    });

    $("#reset-filters").addEventListener("click", () => {
      $("#task-search").value = "";
      $("#phase-filter").value = "all";
      $("#owner-filter").value = "all";
      $("#workstream-filter").value = "all";
      $("#status-filter").value = "all";
      $("#critical-filter").checked = false;
      renderTasks();
    });
  }

  function renderTasks() {
    const search = $("#task-search").value.trim().toLowerCase();
    const phaseValue = $("#phase-filter").value;
    const owner = $("#owner-filter").value;
    const workstream = $("#workstream-filter").value;
    const status = $("#status-filter").value;
    const criticalOnly = $("#critical-filter").checked;

    const filtered = data.tasks.filter((task) => {
      const haystack = [task.title, task.description, task.deliverable, task.owner, task.workstream]
        .join(" ")
        .toLowerCase();
      return (!search || haystack.includes(search))
        && (phaseValue === "all" || task.phase === phaseValue)
        && (owner === "all" || task.owner === owner)
        && (workstream === "all" || task.workstream === workstream)
        && (status === "all" || task.status === status)
        && (!criticalOnly || task.priority === "critical");
    });

    const groups = $("#task-groups");
    groups.innerHTML = "";

    data.phases.forEach((phase) => {
      const tasks = filtered.filter((task) => task.phase === phase.id);
      if (!tasks.length) return;

      const group = document.createElement("section");
      group.className = `task-group color-${phase.color}`;
      setPhaseVariables(group, phase);
      group.innerHTML = `
        <div class="task-group-header">
          <div class="task-group-title">
            <span class="task-group-index">${escapeHtml(phase.number)}</span>
            <h3>${escapeHtml(phase.name)}</h3>
          </div>
          <span class="task-group-count">${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}</span>
        </div>
        <div class="task-list"></div>
      `;

      const list = $(".task-list", group);
      tasks.forEach((task) => list.appendChild(renderTaskCard(task, phase)));
      groups.appendChild(group);
    });

    $("#results-line").textContent = `Showing ${filtered.length} of ${data.tasks.length} tasks`;
    $("#empty-state").hidden = filtered.length !== 0;
  }

  function renderTaskCard(task, phase) {
    const card = document.createElement("article");
    const due = parseDate(task.due);
    const isOverdue = due < now && task.status !== "done";
    card.className = `task-card priority-${task.priority}`;

    const dependencies = (task.dependsOn ?? [])
      .map((id) => taskById(id)?.title)
      .filter(Boolean);

    card.innerHTML = `
      <div class="task-date">
        Due
        <strong>${escapeHtml(formatDate(task.due))}${isOverdue ? " · overdue" : ""}</strong>
        ${task.start !== task.due ? `<span>${escapeHtml(formatRange(task.start, task.due))}</span>` : ""}
      </div>
      <div class="task-main">
        <div class="task-title-line">
          <h4>${escapeHtml(task.title)}</h4>
          ${task.priority === "critical" ? `<span class="task-priority">Critical</span>` : ""}
        </div>
        <p>${escapeHtml(task.description)}</p>
        <div class="task-deliverable"><strong>Deliverable:</strong> ${escapeHtml(task.deliverable)}</div>
        ${dependencies.length ? `<div class="task-dependencies">Depends on: ${escapeHtml(dependencies.join(" · "))}</div>` : ""}
      </div>
      <div class="task-meta">
        <div class="task-meta-row"><span>Owner</span><strong>${escapeHtml(task.owner)}</strong></div>
        <div class="task-meta-row"><span>Workstream</span><strong>${escapeHtml(task.workstream)}</strong></div>
        <div class="task-meta-row"><span>Status</span><span class="task-status status-${escapeHtml(task.status)}">${escapeHtml(STATUS_LABELS[task.status] ?? task.status)}</span></div>
      </div>
    `;
    return card;
  }

  function renderTaskCompletion() {
    const score = data.tasks.reduce((sum, task) => {
      if (task.status === "done") return sum + 1;
      if (task.status === "in-progress") return sum + 0.5;
      return sum;
    }, 0);
    const percent = Math.round((score / data.tasks.length) * 100);
    $("#task-completion").textContent = `${percent}%`;
  }

  function renderGates() {
    $("#gate-grid").innerHTML = data.gates.map((gate) => `
      <article class="gate-card">
        <time class="gate-date" datetime="${escapeHtml(gate.date)}">${escapeHtml(formatDateLong(gate.date))}</time>
        <h3>${escapeHtml(gate.title)}</h3>
        <p>${escapeHtml(gate.decision)}</p>
        <ul>${gate.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>
      </article>
    `).join("");
  }

  function renderDemo() {
    $("#demo-rule").textContent = data.demoScope.rule;
    const renderList = (selector, items) => {
      $(selector).innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
    };
    renderList("#demo-keep", data.demoScope.keep);
    renderList("#demo-limit", data.demoScope.limit);
    renderList("#demo-exclude", data.demoScope.exclude);
    $("#demo-caution").textContent = data.demoScope.caution;
  }

  function renderMetrics() {
    const renderMetricList = (selector, items) => {
      $(selector).innerHTML = items.map((item) => `
        <div class="metric-row">
          <span>${escapeHtml(item.label)}</span>
          <strong class="metric-target">${escapeHtml(item.target)}</strong>
          <strong class="metric-warning">${escapeHtml(item.warning)}</strong>
        </div>
      `).join("");
    };
    renderMetricList("#product-metrics", data.metrics.product);
    renderMetricList("#market-metrics", data.metrics.market);

    $("#wishlist-steps").innerHTML = data.wishlistTargets.map((item) => `
      <article class="wishlist-step">
        <time datetime="${escapeHtml(item.date)}">${escapeHtml(formatDate(item.date, { year: "numeric" }))}</time>
        <h4>${escapeHtml(item.moment)}</h4>
        <strong class="wishlist-number">${escapeHtml(item.working)}</strong>
        <span class="wishlist-stretch">Stretch: ${escapeHtml(item.stretch)}</span>
        <p>${escapeHtml(item.meaning)}</p>
      </article>
    `).join("");
  }

  function renderCampaigns() {
    $("#campaign-body").innerHTML = data.campaigns.map((item) => `
      <tr>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.audience)}</td>
        <td>${escapeHtml(item.asset)}</td>
        <td>${escapeHtml(item.cta)}</td>
      </tr>
    `).join("");
  }

  function renderDecisions() {
    $("#decision-list").innerHTML = data.decisions.map((item) => `
      <article class="decision-item">
        <span class="decision-status">${escapeHtml(item.status)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.rationale)}</p>
      </article>
    `).join("");
  }

  function renderSources() {
    $("#source-list").innerHTML = data.sources.map((source) => `
      <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title)} ↗</a></li>
    `).join("");
  }

  function addInteractiveBehavior() {
    $("#print-button").addEventListener("click", () => window.print());

    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        $("#task-search").focus();
      }
    });
  }

  function initialize() {
    renderHero();
    renderSummary();
    renderPrinciples();
    renderGantt();
    renderPhaseCards();
    populateFilters();
    renderTasks();
    renderTaskCompletion();
    renderGates();
    renderDemo();
    renderMetrics();
    renderCampaigns();
    renderDecisions();
    renderSources();
    addInteractiveBehavior();
  }

  initialize();
})();
