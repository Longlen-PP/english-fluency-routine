/**
 * Paste this into the Apps Script editor attached to your Google Sheet
 * (Extensions → Apps Script), then deploy it as a Web App.
 * See docs/google-sheets-setup.md for the full step-by-step guide.
 */
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Add the header row once, the first time the sheet is empty.
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Date",
      "Day Type",
      "Completed",
      "Total",
      "Percent",
      "Completed Activities",
    ]);
  }

  const data = JSON.parse(e.postData.contents);
  sheet.appendRow([
    data.date,
    data.dayType,
    data.completed,
    data.total,
    data.percent + "%",
    data.completedTitles,
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}
