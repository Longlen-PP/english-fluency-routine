/**
 * Paste this into the Apps Script editor attached to your Google Sheet
 * (Extensions → Apps Script), then deploy it as a Web App.
 * See docs/google-sheets-setup.md for the full step-by-step guide.
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Add the header row once, the first time the sheet is empty.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Date", "Day Type", "Time", "Category", "Activity"]);
  }

  const data = JSON.parse(e.postData.contents);
  const activities = data.activities || [];
  activities.forEach(function (a) {
    sheet.appendRow([data.date, data.dayType, a.time, a.category, a.title]);
  });

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Lets the app's dashboard read back everything logged so far, to compute
// which activities get skipped most often.
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var dateVal = r[0];
    // The Date column is a Date object once Sheets auto-detects it, not the
    // original "YYYY-MM-DD" string — normalize back so the dashboard can
    // group rows by calendar day.
    var dateStr = (dateVal instanceof Date)
      ? Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(dateVal);
    rows.push({ date: dateStr, dayType: r[1], time: r[2], category: r[3], activity: r[4] });
  }
  return ContentService
    .createTextOutput(JSON.stringify({ rows: rows }))
    .setMimeType(ContentService.MimeType.JSON);
}
