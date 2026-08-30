const STORAGE_KEY = "efr-checklist"; // { [blockId]: true }
const TAB_KEY = "efr-active-tab";
const LAST_DATE_KEY = "efr-last-routine-date";
const SHEETS_URL_KEY = "efr-sheets-webhook-url"; // per-browser override, kept out of the public repo
const SCHEDULE_OVERRIDE_KEY = "efr-schedules-override"; // per-browser edits made via the Edit button, layered on top of data.js
const RESET_HOUR = 1; // the checklist rolls over to a new day at 1:00 AM, not midnight

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
let activeTab = localStorage.getItem(TAB_KEY) || dayKeys[0];
if (!dayKeys.includes(activeTab)) activeTab = dayKeys[0];

// Edit mode: while active, `draftBlocks` holds the working copy of the active
// tab's blocks. Nothing is persisted until Save; Cancel just discards it.
let editMode = false;
let draftBlocks = null;

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
  dayKeys.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.textContent = schedules[key].label;
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
  renderLegend();
  renderTimeline();
  renderEditControls();
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

checkDailyRollover();
renderAll();
renderResources();
renderPriority();

// In case the tab is left open overnight, check every 5 minutes whether
// 5:00 AM has passed so the checklist still clears without a manual refresh.
setInterval(() => {
  if (checkDailyRollover()) renderTimeline();
}, 5 * 60 * 1000);
