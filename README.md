# English Fluency Routine

A small static web app that lays out a daily routine for practicing English (listening +
speaking) around an existing schedule, with a checklist you can tick off each day.

## Live demo

https://longlen-pp.github.io/english-fluency-routine/

(Served via **GitHub Pages** — Settings → Pages → Deploy from branch → `main` / root.)

## Structure

- `index.html` — page markup
- `style.css` — styling (light/dark aware)
- `script.js` — renders the schedule, handles tabs and the checklist (saved in `localStorage`)
- `data.js` — **edit this file** to change times, activities, categories, or resources

No build step — just open `index.html` in a browser, or serve the folder with any static
file server.

## Customizing

All content lives in `data.js`:

- `CATEGORIES` — the color-coded activity types shown in the legend
- `SCHEDULES` — the two day groups (`mon-thu`, `fri-sun`) and their time blocks
- `RESOURCES` — the learning resources listed at the bottom
- `PRIORITY_TIPS` — the "short on time, cut in this order" guidance

Each schedule block needs a unique `id` (used as the checklist key in `localStorage`).

## Daily reset & logging

- The checklist auto-resets at **5:00 AM** each day (not midnight) — see `RESET_HOUR` in
  `script.js`. This only fires when the page is actually open (on load, or every 5 minutes
  while a tab stays open) since it's a static site with no server running in the background.
- Right before resetting, if anything was checked off, it can log a one-row summary
  (date, completed count, list of activities) to a Google Sheet. Disabled by default —
  see [`docs/google-sheets-setup.md`](docs/google-sheets-setup.md) to enable it.
