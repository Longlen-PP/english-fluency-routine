const STORAGE_KEY = "efr-checklist"; // { [blockId]: true }
const TAB_KEY = "efr-active-tab";
const LAST_DATE_KEY = "efr-last-routine-date";
const SHEETS_URL_KEY = "efr-sheets-webhook-url"; // per-browser override, kept out of the public repo
const SCHEDULE_OVERRIDE_KEY = "efr-schedules-override"; // per-browser edits made via the Edit button, layered on top of data.js
const DASH_MODE_KEY = "efr-dashboard-mode"; // "activity" | "category", per-browser
const RESET_HOUR = 1; // the checklist rolls over to a new day at 1:00 AM, not midnight
const DASHBOARD_TAB = "dashboard";

function getSheetsWebhookUrl() {
  return localStorage.getItem(SHEETS_URL_KEY) || SHEETS_WEBHOOK_URL || "";
}

function loadScheduleOverride() {
  try {
    const raw = localStorage.getItem(SCHEDULE_OVERRIDE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveScheduleOverride(schedules) {
  localStorage.setItem(SCHEDULE_OVERRIDE_KEY, JSON.stringify(schedules));
}

// SCHEDULES (from data.js) is the shipped default. Edits made via the Edit
// button live only in this browser's localStorage, layered on top.
let scheduleOverride = loadScheduleOverride();
function getSchedules() {
  return scheduleOverride || SCHEDULES;
}

// "Routine date" = calendar date, shifted so the label matches whichever calendar
// day holds most of the routine, not the day the reset instant happens to fall on.
// - RESET_HOUR before noon (e.g. 5am): hours before it still count as the previous
//   day (so staying up late doesn't wipe last night's checklist before bed).
// - RESET_HOUR from noon on (e.g. 10pm): hours at/after it already count as the
//   next day (so what you check off all afternoon still logs under today's date,
//   not yesterday's, when the 10pm reset fires).
function getRoutineDateKey(d = new Date()) {
  const shifted = new Date(d.getTime());
  if (RESET_HOUR < 12) {
    if (shifted.getHours() < RESET_HOUR) shifted.setDate(shifted.getDate() - 1);
  } else {
    if (shifted.getHours() >= RESET_HOUR) shifted.setDate(shifted.getDate() + 1);
  }
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const day = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Called once per load and periodically while the tab stays open.
// Returns true if the day actually rolled over (so the caller knows to re-render).
function checkDailyRollover() {
  const todayKey = getRoutineDateKey();
  const lastKey = localStorage.getItem(LAST_DATE_KEY);
  if (lastKey && lastKey !== todayKey) {
    logCompletionForDay(lastKey, loadChecklist());
    saveChecklist({});
    localStorage.setItem(LAST_DATE_KEY, todayKey);
    return true;
  }
  if (!lastKey) localStorage.setItem(LAST_DATE_KEY, todayKey);
  return false;
}

// Sends one row per completed activity for the day that just closed to the
// Google Sheets webhook configured in data.js (SHEETS_WEBHOOK_URL). No-ops if
// it's empty, or if nothing was checked off that day (skip logging empty days).
// "Locked" blocks (e.g. Sleep) are always counted as completed and included
// alongside whatever was manually checked, but don't by themselves count as
// the day having anything logged — an otherwise-empty day still gets skipped.
function logCompletionForDay(dateKey, checklist) {
  const doneIds = Object.keys(checklist).filter((id) => checklist[id]);
  if (doneIds.length === 0) return;

  const schedules = getSchedules();
  const matchedKey = Object.keys(schedules).find((key) =>
    schedules[key].blocks.some((b) => doneIds.includes(b.id))
  );
  if (!matchedKey) return;

  const schedule = schedules[matchedKey];
  const completed = schedule.blocks.filter((b) => b.locked || doneIds.includes(b.id));

  const payload = {
    date: dateKey,
    dayType: schedule.label,
    activities: completed.map((b) => ({
      time: b.time,
      category: (CATEGORIES[b.category] || {}).label || b.category,
      title: b.title,
    })),
  };

  const webhookUrl = getSheetsWebhookUrl();
  if (!webhookUrl) {
    console.log("[EFR] routine day closed (no webhook configured yet):", payload);
    return;
  }

  // `text/plain` + `no-cors` avoids a CORS preflight that Apps Script Web Apps
  // don't reliably answer — the request still lands in doPost() on the other end.
  fetch(webhookUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify(payload),
  }).catch((err) => console.error("[EFR] failed to log day to Google Sheets:", err));
}

const dayKeys = Object.keys(SCHEDULES);
const viewKeys = [...dayKeys, DASHBOARD_TAB];
let activeTab = localStorage.getItem(TAB_KEY) || dayKeys[0];
if (!viewKeys.includes(activeTab)) activeTab = dayKeys[0];

// Edit mode: while active, `draftBlocks` holds the working copy of the active
// tab's blocks. Nothing is persisted until Save; Cancel just discards it.
let editMode = false;
let draftBlocks = null;

// Dashboard state — rows are fetched once per page load (not on every filter/
// mode change) and cached here; filtering/aggregation re-runs client-side.
let dashboardRows = null; // null = not fetched yet, [] = fetched (possibly empty)
let dashboardLoadError = null; // null | "fetch-failed"
let dashboardMode = localStorage.getItem(DASH_MODE_KEY) || "activity";
let dashboardFrom = null;
let dashboardTo = null;

function loadChecklist() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveChecklist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderTabs() {
  const tabsEl = document.getElementById("tabs");
  tabsEl.classList.toggle("disabled", editMode);
  tabsEl.innerHTML = "";
  const schedules = getSchedules();
  viewKeys.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.textContent = key === DASHBOARD_TAB ? "📊 Dashboard" : schedules[key].label;
    btn.role = "tab";
    btn.setAttribute("aria-selected", key === activeTab ? "true" : "false");
    btn.addEventListener("click", () => {
      if (editMode) return;
      activeTab = key;
      localStorage.setItem(TAB_KEY, activeTab);
      renderAll();
    });
    tabsEl.appendChild(btn);
  });
}

function renderLegend() {
  const legendEl = document.getElementById("legend");
  legendEl.innerHTML = "";
  Object.values(CATEGORIES).forEach((cat) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.style.background = cat.color;
    chip.innerHTML = `<span class="dot"></span>${cat.label}`;
    legendEl.appendChild(chip);
  });
}

function renderTimeline() {
  const schedule = getSchedules()[activeTab];
  const blocks = editMode ? draftBlocks : schedule.blocks;
  const checklist = loadChecklist();
  const timelineEl = document.getElementById("timeline");
  const noteEl = document.getElementById("dayNote");
  noteEl.textContent = editMode ? "" : (schedule.note || "");

  timelineEl.innerHTML = "";
  blocks.forEach((block, index) => {
    const cat = CATEGORIES[block.category] || CATEGORIES.misc;
    const done = block.locked || !!checklist[block.id];

    const li = document.createElement("li");
    li.className = "row" + (editMode ? " editing" : done ? " done" : "");

    const badge = document.createElement("div");
    badge.className = "time-badge";
    badge.style.background = cat.color;

    const card = document.createElement("div");
    card.className = "card" + (editMode ? " editing" : "");
    card.style.borderLeftColor = cat.color;

    if (editMode) {
      const timeInput = document.createElement("input");
      timeInput.className = "edit-input edit-time";
      timeInput.value = block.time;
      timeInput.addEventListener("input", (e) => { draftBlocks[index].time = e.target.value; });
      badge.appendChild(timeInput);

      const body = document.createElement("div");
      body.className = "card-body";

      const titleInput = document.createElement("input");
      titleInput.className = "edit-input edit-title";
      titleInput.value = block.title;
      titleInput.addEventListener("input", (e) => { draftBlocks[index].title = e.target.value; });

      const detailInput = document.createElement("textarea");
      detailInput.className = "edit-input edit-detail";
      detailInput.rows = 2;
      detailInput.placeholder = "Detail (optional)";
      detailInput.value = block.detail || "";
      detailInput.addEventListener("input", (e) => { draftBlocks[index].detail = e.target.value; });

      const catSelect = document.createElement("select");
      catSelect.className = "edit-input edit-category";
      Object.keys(CATEGORIES).forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = CATEGORIES[key].label;
        if (key === block.category) opt.selected = true;
        catSelect.appendChild(opt);
      });
      catSelect.addEventListener("change", (e) => {
        draftBlocks[index].category = e.target.value;
        renderTimeline();
      });

      body.appendChild(titleInput);
      body.appendChild(detailInput);
      body.appendChild(catSelect);
      card.appendChild(body);
    } else {
      badge.textContent = block.time;

      const check = document.createElement("div");
      check.className = "card-check";
      check.style.borderColor = cat.color;
      check.style.background = done ? cat.color : "transparent";
      check.textContent = done ? "✓" : "";

      const body = document.createElement("div");
      body.className = "card-body";
      const titleEl = document.createElement("div");
      titleEl.className = "title";
      titleEl.textContent = block.title;
      body.appendChild(titleEl);
      if (block.detail) {
        const detailEl = document.createElement("div");
        detailEl.className = "detail";
        detailEl.textContent = block.detail;
        body.appendChild(detailEl);
      }

      card.appendChild(check);
      card.appendChild(body);
      if (block.locked) {
        card.classList.add("locked");
        card.title = "Always counted as done";
      } else {
        card.addEventListener("click", () => toggleBlock(block.id));
      }
    }

    li.appendChild(badge);
    li.appendChild(card);
    timelineEl.appendChild(li);
  });

  if (!editMode) updateProgress(schedule, checklist);
}

function toggleBlock(id) {
  const checklist = loadChecklist();
  checklist[id] = !checklist[id];
  saveChecklist(checklist);
  renderTimeline();
}

function updateProgress(schedule, checklist) {
  const total = schedule.blocks.length;
  const done = schedule.blocks.filter((b) => b.locked || checklist[b.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressLabel").textContent = `${done} / ${total} done`;
}

function renderResources() {
  const el = document.getElementById("resources");
  el.innerHTML = "";
  RESOURCES.forEach((r) => {
    const card = document.createElement("div");
    card.className = "resource-card";
    card.innerHTML = `
      <div class="resource-icon" style="background:${r.color}">${r.icon}</div>
      <div class="resource-body">
        <div class="rname">${r.name}</div>
        <div class="rusage">${r.usage}</div>
        ${r.url ? `<a href="${r.url}" target="_blank" rel="noopener">${r.url.replace(/^https?:\/\//, "")}</a>` : ""}
      </div>
      <span class="${r.free ? "tag-free" : "tag-owned"}">${r.free ? "Free" : (r.ownedLabel || "Owned")}</span>
    `;
    el.appendChild(card);
  });
}

// The dashboard matches log rows back to schedule blocks by (dayType, title) —
// always against the shipped SCHEDULES (not a per-browser Edit override), since
// that's what the log's "Day Type"/"Activity" text was written against. Renaming
// a block in data.js orphans its older log rows from this matching.
// Locked blocks (e.g. Sleep) are included too — they always get logged as done
// alongside whatever was checked, so they'll always show 100%, but Ize wants
// them visible in the bars rather than silently excluded.
function buildExpectedActivities() {
  const list = [];
  Object.keys(SCHEDULES).forEach((key) => {
    const schedule = SCHEDULES[key];
    schedule.blocks.forEach((b) => {
      list.push({ dayType: schedule.label, time: b.time, title: b.title, category: b.category });
    });
  });
  return list;
}

// The log stores each row's category as its display LABEL (e.g. "English
// Practice"), not the internal key CATEGORIES is keyed by — this maps back.
const CATEGORY_LABEL_TO_KEY = Object.keys(CATEGORIES).reduce((acc, key) => {
  acc[CATEGORIES[key].label] = key;
  return acc;
}, {});

// Day-type matching is trimmed + dash-normalized before comparing: a row typed
// or pasted straight into the Sheet by hand easily ends up with a plain "-"
// where SCHEDULES' labels use an en dash ("Mon – Thu"), which would otherwise
// silently drop that day from every stat below.
function normalizeDayType(s) {
  return String(s).trim().replace(/[‐‑‒–—―−]/g, "-");
}
const NORMALIZED_DAYTYPE_TO_LABEL = Object.keys(SCHEDULES).reduce((acc, key) => {
  acc[normalizeDayType(SCHEDULES[key].label)] = SCHEDULES[key].label;
  return acc;
}, {});

// Denominator per activity = number of distinct days *of that day type* that
// have any logged row at all (days with zero checked items are never logged,
// so they can't be counted here — see the caveat note in the dashboard section).
function computeDashboardStats(rows) {
  const datesByDayType = {};
  const countByKey = {};
  rows.forEach((r) => {
    const dtKey = normalizeDayType(r.dayType);
    if (!datesByDayType[dtKey]) datesByDayType[dtKey] = new Set();
    datesByDayType[dtKey].add(r.date);
    const key = dtKey + "|||" + r.activity;
    countByKey[key] = (countByKey[key] || 0) + 1;
  });

  const stats = buildExpectedActivities()
    .map((a) => {
      const dtKey = normalizeDayType(a.dayType);
      const denom = (datesByDayType[dtKey] || new Set()).size;
      const done = countByKey[dtKey + "|||" + a.title] || 0;
      return { ...a, done, denom, pct: denom ? Math.round((done / denom) * 100) : null };
    })
    .filter((a) => a.denom > 0)
    .sort((a, b) => a.pct - b.pct);

  const dayTypeCounts = Object.keys(datesByDayType).map((key) => ({
    dayType: NORMALIZED_DAYTYPE_TO_LABEL[key] || key,
    days: datesByDayType[key].size,
  }));

  return { stats, dayTypeCounts };
}

// Composition (not completion rate): of everything actually logged in the
// filtered range, what share belongs to each category — feeds the pie chart
// in Category mode.
function computeCategoryComposition(rows) {
  const counts = {};
  rows.forEach((r) => {
    const key = CATEGORY_LABEL_TO_KEY[r.category] || r.category;
    counts[key] = (counts[key] || 0) + 1;
  });
  const total = rows.length;
  return Object.keys(counts)
    .map((key) => ({
      category: key,
      count: counts[key],
      sharePct: total ? Math.round((counts[key] / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// Same idea as computeCategoryComposition, but one slice per activity title
// instead of per category — feeds the pie chart in Activity mode. Titles are
// shared across both day types for identical blocks (e.g. "Shower"), so those
// naturally merge into one slice; only the couple of day-specific blocks
// (Football practice / Study: making money with AI) stay distinct.
function computeActivityComposition(rows) {
  const counts = {};
  const categoryByActivity = {};
  rows.forEach((r) => {
    counts[r.activity] = (counts[r.activity] || 0) + 1;
    if (!categoryByActivity[r.activity]) {
      categoryByActivity[r.activity] = CATEGORY_LABEL_TO_KEY[r.category] || r.category;
    }
  });
  const total = rows.length;
  return Object.keys(counts)
    .map((title) => ({
      category: categoryByActivity[title], // drives slice color
      label: title, // overrides the category label in the legend
      count: counts[title],
      sharePct: total ? Math.round((counts[title] / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function renderPieHtml(composition) {
  if (composition.length === 0) return "";
  let acc = 0;
  const stops = composition.map((c, i) => {
    const cat = CATEGORIES[c.category] || CATEGORIES.misc;
    const start = acc;
    acc += c.sharePct;
    if (i === composition.length - 1) acc = 100; // absorb rounding drift on the last slice
    return `${cat.color} ${start}% ${acc}%`;
  });
  const legendHtml = composition
    .map((c) => {
      const cat = CATEGORIES[c.category] || CATEGORIES.misc;
      return `<span class="dash-pie-legend-item"><span class="dot" style="background:${cat.color}"></span>${c.label || cat.label} — ${c.sharePct}%</span>`;
    })
    .join("");
  return `
    <div class="dash-pie-wrap">
      <div class="dash-pie" style="background:conic-gradient(${stops.join(", ")})"></div>
      <div class="dash-pie-legend">${legendHtml}</div>
    </div>`;
}

function renderInsight(activityStats) {
  if (activityStats.length === 0) return "";
  const avg = Math.round(activityStats.reduce((sum, a) => sum + a.pct, 0) / activityStats.length);
  const worstText = activityStats
    .slice(0, 3)
    .map((a) => `"${a.title}" (${a.pct}%)`)
    .join(", ");
  return `📌 เฉลี่ยทำได้ ${avg}% ของกิจกรรมทั้งหมดในช่วงนี้ — ที่พลาดบ่อยสุด: ${worstText} ลองโฟกัสเพิ่มตรงนี้ก่อนนะ`;
}

function renderStatsListHtml(list, mode) {
  return list
    .map((a) => {
      const cat = CATEGORIES[a.category] || CATEGORIES.misc;
      const label = mode === "category" ? cat.label : a.title;
      const sub = mode === "category" ? `${a.done} completion${a.done === 1 ? "" : "s"}` : `${a.dayType} · ${a.time}`;
      return `
        <div class="dash-row">
          <div class="dash-meta">
            <span class="dash-title">${label}</span>
            <span class="dash-sub">${sub}</span>
          </div>
          <div class="dash-bar-track">
            <div class="dash-bar-fill" style="width:${a.pct}%;background:${cat.color}"></div>
          </div>
          <span class="dash-pct">${a.pct}%</span>
        </div>`;
    })
    .join("");
}

function getFilteredDashboardRows() {
  return (dashboardRows || []).filter((r) => {
    if (dashboardFrom && r.date < dashboardFrom) return false;
    if (dashboardTo && r.date > dashboardTo) return false;
    return true;
  });
}

// Fetches the log once per page load and caches it in `dashboardRows`;
// subsequent filter/mode changes just re-render from the cache.
async function ensureDashboardData() {
  if (dashboardRows !== null) return;
  const webhookUrl = getSheetsWebhookUrl();
  if (!webhookUrl) {
    dashboardRows = [];
    return;
  }
  try {
    const res = await fetch(webhookUrl, { method: "GET" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    dashboardRows = data.rows || [];
    dashboardLoadError = null;
    if (dashboardRows.length > 0) {
      const dates = dashboardRows.map((r) => r.date).sort();
      const fromEl = document.getElementById("dashFrom");
      const toEl = document.getElementById("dashTo");
      fromEl.min = toEl.min = dates[0];
      fromEl.max = toEl.max = dates[dates.length - 1];
    }
  } catch (err) {
    console.error("[EFR] failed to load dashboard data:", err);
    dashboardRows = [];
    dashboardLoadError = "fetch-failed";
  }
}

function renderDashboardBody() {
  const body = document.getElementById("dashboardBody");

  if (!getSheetsWebhookUrl()) {
    body.innerHTML = `<p class="dash-empty">Set up Google Sheets logging first (see <code>docs/google-sheets-setup.md</code>) — the dashboard reads from that same log.</p>`;
    return;
  }
  if (dashboardLoadError === "fetch-failed") {
    body.innerHTML = `<p class="dash-empty">Couldn't load log data — make sure the Apps Script has been redeployed with <code>doGet</code> (see docs/google-sheets-setup.md), then try again.</p>`;
    return;
  }

  const rows = getFilteredDashboardRows();
  if (rows.length === 0) {
    body.innerHTML = `<p class="dash-empty">No logged days in this range yet.</p>`;
    return;
  }

  const { stats, dayTypeCounts } = computeDashboardStats(rows);
  if (stats.length === 0) {
    body.innerHTML = `<p class="dash-empty">Not enough data yet.</p>`;
    return;
  }

  const summary = dayTypeCounts
    .map((d) => `${d.dayType}: ${d.days} day${d.days === 1 ? "" : "s"} logged`)
    .join(" · ");
  const composition = dashboardMode === "category"
    ? computeCategoryComposition(rows)
    : computeActivityComposition(rows);
  const pieHtml = renderPieHtml(composition);
  const insight = renderInsight(stats);
  // Category mode's list mirrors the pie: each bar is that category's share of
  // everything logged (contribution of the grand total), not a completion
  // rate — a rate mixing Sleep (always done) with rarely-logged blocks like
  // Morning nap in the same category read as an arbitrarily low, confusing %.
  const listStats = dashboardMode === "category"
    ? composition
        .map((c) => ({ category: c.category, done: c.count, pct: Math.round(c.sharePct) }))
        .sort((a, b) => a.pct - b.pct)
    : stats;
  const listHtml = renderStatsListHtml(listStats, dashboardMode);

  body.innerHTML = `
    <p class="dash-summary">${summary}</p>
    ${pieHtml}
    <p class="dash-insight">${insight}</p>
    <div class="dash-list">${listHtml}</div>`;
}

async function renderDashboardView() {
  if (dashboardRows === null) {
    document.getElementById("dashboardBody").innerHTML = `<p class="dash-empty">Loading…</p>`;
  }
  await ensureDashboardData();
  renderDashboardBody();
}

function renderPriority() {
  const el = document.getElementById("priorityList");
  el.innerHTML = "";
  PRIORITY_TIPS.forEach((tip) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${tip.rule}</b> ${tip.text}`;
    el.appendChild(li);
  });
}

function renderEditControls() {
  document.getElementById("resetBtn").hidden = editMode;
  document.getElementById("editBtn").hidden = editMode;
  document.getElementById("editControls").hidden = !editMode;
  if (editMode) {
    document.getElementById("editingLabel").textContent = getSchedules()[activeTab].label;
  }
}

function enterEditMode() {
  draftBlocks = getSchedules()[activeTab].blocks.map((b) => ({ ...b }));
  editMode = true;
  renderTabs();
  renderTimeline();
  renderEditControls();
}

function cancelEditMode() {
  editMode = false;
  draftBlocks = null;
  renderTabs();
  renderTimeline();
  renderEditControls();
}

function saveEditMode() {
  const schedules = { ...getSchedules() };
  schedules[activeTab] = { ...schedules[activeTab], blocks: draftBlocks };
  scheduleOverride = schedules;
  saveScheduleOverride(schedules);
  editMode = false;
  draftBlocks = null;
  renderTabs();
  renderTimeline();
  renderEditControls();
}

function resetScheduleToDefault() {
  const schedules = { ...getSchedules() };
  schedules[activeTab] = JSON.parse(JSON.stringify(SCHEDULES[activeTab]));
  scheduleOverride = schedules;
  saveScheduleOverride(schedules);
  editMode = false;
  draftBlocks = null;
  renderTabs();
  renderTimeline();
  renderEditControls();
}

function renderAll() {
  renderTabs();
  const isDashboard = activeTab === DASHBOARD_TAB;
  document.querySelector(".progress-bar-wrap").hidden = isDashboard;
  document.getElementById("legend").hidden = isDashboard;
  document.getElementById("dayNote").hidden = isDashboard;
  document.getElementById("timeline").hidden = isDashboard;
  document.getElementById("resourcesSection").hidden = isDashboard;
  document.getElementById("priorityBox").hidden = isDashboard;
  document.getElementById("dashboardSection").hidden = !isDashboard;

  if (isDashboard) {
    renderDashboardView();
  } else {
    renderLegend();
    renderTimeline();
    renderEditControls();
  }
}

document.getElementById("resetBtn").addEventListener("click", () => {
  const schedule = getSchedules()[activeTab];
  const checklist = loadChecklist();
  schedule.blocks.forEach((b) => delete checklist[b.id]);
  saveChecklist(checklist);
  renderTimeline();
});
document.getElementById("editBtn").addEventListener("click", enterEditMode);
document.getElementById("cancelEditBtn").addEventListener("click", cancelEditMode);
document.getElementById("saveEditBtn").addEventListener("click", saveEditMode);
document.getElementById("resetDefaultBtn").addEventListener("click", resetScheduleToDefault);

document.getElementById("dashFrom").addEventListener("change", (e) => {
  dashboardFrom = e.target.value || null;
  renderDashboardBody();
});
document.getElementById("dashTo").addEventListener("change", (e) => {
  dashboardTo = e.target.value || null;
  renderDashboardBody();
});
document.getElementById("dashClearFilter").addEventListener("click", () => {
  dashboardFrom = null;
  dashboardTo = null;
  document.getElementById("dashFrom").value = "";
  document.getElementById("dashTo").value = "";
  renderDashboardBody();
});
document.querySelectorAll("#dashModeToggle .dash-mode-btn").forEach((btn) => {
  btn.classList.toggle("active", btn.dataset.mode === dashboardMode);
  btn.addEventListener("click", () => {
    dashboardMode = btn.dataset.mode;
    localStorage.setItem(DASH_MODE_KEY, dashboardMode);
    document.querySelectorAll("#dashModeToggle .dash-mode-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderDashboardBody();
  });
});

checkDailyRollover();
renderAll();
renderResources();
renderPriority();

// In case the tab is left open overnight, check every 5 minutes whether
// 5:00 AM has passed so the checklist still clears without a manual refresh.
setInterval(() => {
  if (checkDailyRollover()) renderTimeline();
}, 5 * 60 * 1000);
