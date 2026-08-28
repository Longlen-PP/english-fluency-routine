const STORAGE_KEY = "efr-checklist"; // { [blockId]: true }
const TAB_KEY = "efr-active-tab";
const LAST_DATE_KEY = "efr-last-routine-date";
const RESET_HOUR = 5; // the checklist rolls over to a new day at 5:00 AM, not midnight

// "Routine date" = calendar date, except 00:00–04:59 still counts as the previous day
// (so staying up late doesn't wipe last night's checklist before you go to sleep).
function getRoutineDateKey(d = new Date()) {
  const shifted = new Date(d.getTime());
  if (shifted.getHours() < RESET_HOUR) shifted.setDate(shifted.getDate() - 1);
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

// Hook: wire this up once a logging backend (Google Sheets / Firebase) is chosen.
// For now it just prints to the console so nothing is silently lost.
function logCompletionForDay(dateKey, checklist) {
  console.log("[EFR] routine day closed:", dateKey, checklist);
}

const dayKeys = Object.keys(SCHEDULES);
let activeTab = localStorage.getItem(TAB_KEY) || dayKeys[0];
if (!dayKeys.includes(activeTab)) activeTab = dayKeys[0];

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
  tabsEl.innerHTML = "";
  dayKeys.forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.textContent = SCHEDULES[key].label;
    btn.role = "tab";
    btn.setAttribute("aria-selected", key === activeTab ? "true" : "false");
    btn.addEventListener("click", () => {
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
  const schedule = SCHEDULES[activeTab];
  const checklist = loadChecklist();
  const timelineEl = document.getElementById("timeline");
  const noteEl = document.getElementById("dayNote");
  noteEl.textContent = schedule.note || "";

  timelineEl.innerHTML = "";
  schedule.blocks.forEach((block) => {
    const cat = CATEGORIES[block.category];
    const done = !!checklist[block.id];

    const li = document.createElement("li");
    li.className = "row" + (done ? " done" : "");

    const badge = document.createElement("div");
    badge.className = "time-badge";
    badge.style.background = cat.color;
    badge.textContent = block.time;

    const card = document.createElement("div");
    card.className = "card";
    card.style.borderLeftColor = cat.color;

    const check = document.createElement("div");
    check.className = "card-check";
    check.style.borderColor = cat.color;
    check.style.background = done ? cat.color : "transparent";
    check.textContent = done ? "✓" : "";

    const body = document.createElement("div");
    body.className = "card-body";
    body.innerHTML = `<div class="title">${block.title}</div>` +
      (block.detail ? `<div class="detail">${block.detail}</div>` : "");

    card.appendChild(check);
    card.appendChild(body);
    card.addEventListener("click", () => toggleBlock(block.id));

    li.appendChild(badge);
    li.appendChild(card);
    timelineEl.appendChild(li);
  });

  updateProgress(schedule, checklist);
}

function toggleBlock(id) {
  const checklist = loadChecklist();
  checklist[id] = !checklist[id];
  saveChecklist(checklist);
  renderTimeline();
}

function updateProgress(schedule, checklist) {
  const total = schedule.blocks.length;
  const done = schedule.blocks.filter((b) => checklist[b.id]).length;
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

function renderAll() {
  renderTabs();
  renderLegend();
  renderTimeline();
}

document.getElementById("resetBtn").addEventListener("click", () => {
  const schedule = SCHEDULES[activeTab];
  const checklist = loadChecklist();
  schedule.blocks.forEach((b) => delete checklist[b.id]);
  saveChecklist(checklist);
  renderTimeline();
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
