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

There are two ways to change the schedule content (time, title, detail, category):

- **In the browser** — click **Edit** above the checklist, change any block's fields
  inline, then **Save**. This only changes what you see in that browser (stored in
  `localStorage`, layered on top of the defaults below) — it doesn't touch the repo, so
  it won't survive clearing site data and won't show up on another device. **Reset to
  default** in the edit bar discards your local edits for the active day and restores
  what's shipped in `data.js`.
- **In `data.js`** — the shipped default everyone starts from. Edit this when you want a
  change to actually be committed/deployed, or to add/remove blocks (the Edit UI can only
  change existing blocks, not add or delete them):
  - `CATEGORIES` — the color-coded activity types shown in the legend
  - `SCHEDULES` — the two day groups (`mon-thu`, `fri-sun`) and their time blocks
  - `RESOURCES` — the learning resources listed at the bottom
  - `PRIORITY_TIPS` — the "short on time, cut in this order" guidance

  Each schedule block needs a unique `id` (used as the checklist key in `localStorage`).

## Daily reset & logging

- The checklist auto-resets at **5:00 AM** each day (not midnight) — see `RESET_HOUR` in
  `script.js`. This only fires when the page is actually open (on load, or every 5 minutes
  while a tab stays open) since it's a static site with no server running in the background.
- Right before resetting, if anything was checked off, it can log one row per completed
  activity (date, day type, time, category, activity) to a Google Sheet. Disabled by
  default — see [`docs/google-sheets-setup.md`](docs/google-sheets-setup.md) to enable it.
