# English Fluency Routine

A small static web app that lays out a daily routine for practicing English (listening +
speaking) around an existing schedule, with a checklist you can tick off each day.

## Live demo

Enable **GitHub Pages** for this repo (Settings → Pages → Deploy from branch → `main` / root)
and it will be served at `https://<your-username>.github.io/<repo-name>/`.

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
