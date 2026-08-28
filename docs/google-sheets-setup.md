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

## 4. Wire it into the app

Open `data.js` in this repo and paste the URL into:

```js
const SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycb.../exec";
```

Commit the change. From then on, every day that has at least one checked item will add
a new row to the sheet when the 5:00 AM reset happens (open the site once during that
day so the browser is the one sending it — it's not a real backend, so nothing runs
while nobody's tab is open).

## Notes

- Days with nothing checked off are skipped (no empty rows).
- The Web App URL is not secret-proof — anyone who has it could technically POST rows
  to your sheet. Fine for personal tracking; don't reuse this pattern for sensitive data.
- If you ever want to stop logging, just clear `SHEETS_WEBHOOK_URL` back to `""`.
