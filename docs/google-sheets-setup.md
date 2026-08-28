# Logging daily completion to Google Sheets

Every day at 5:00 AM the checklist resets, and right before it clears, the app sends a
one-row summary of what got checked off to a Google Sheet — if you've set one up. This
is a one-time, ~5 minute setup done entirely in your own Google account.

## 1. Create the sheet

1. Go to [sheets.new](https://sheets.new) — creates a blank Google Sheet.
2. Rename it to something like `English Routine Log`.

## 2. Add the script

1. In the sheet, go to **Extensions → Apps Script**.
2. Delete any placeholder code in the editor.
3. Copy the contents of [`apps-script.gs`](apps-script.gs) in this repo and paste it in.
4. Click the **Save** icon (or Ctrl+S).

## 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Click **Deploy**.
5. Google will ask you to **authorize** the script — this is your own script running
   under your own account, so it's expected. Click through (Advanced → Go to project
   (unsafe) is normal for your own unpublished scripts).
6. Copy the **Web app URL** it gives you (looks like
   `https://script.google.com/macros/s/AKfycb.../exec`).

## 4. Wire it into the app — in your browser, not in the code

**Do not paste the URL into `data.js`.** This repo is public, so anything committed
there is visible to anyone — including the URL, which would let a stranger POST junk
rows into your sheet.

Instead, set it once in the browser you actually use the site on:

1. Open https://longlen-pp.github.io/english-fluency-routine/
2. Open DevTools console (F12, or right-click → Inspect → Console tab)
3. Run:
   ```js
   localStorage.setItem("efr-sheets-webhook-url", "https://script.google.com/macros/s/AKfycb.../exec")
   ```
4. Reload the page.

This is stored only in that browser's local storage — it's never sent anywhere except
straight to your own Apps Script, and it's not part of the code anyone else can see.
If you use the site from another device too, repeat this step there.

From then on, every day that has at least one checked item adds a new row to the sheet
when the 5:00 AM reset happens (the site has to actually be open around/after that time
for the browser to send it — it's not a real backend, so nothing runs while no tab is
open).

## Notes

- Days with nothing checked off are skipped (no empty rows).
- The Web App URL is not secret-proof even kept client-side — anyone who somehow
  obtains it could technically POST rows to your sheet. Fine for personal tracking;
  don't reuse this pattern for sensitive data.
- To stop logging on a given browser: `localStorage.removeItem("efr-sheets-webhook-url")`.
