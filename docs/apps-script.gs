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
