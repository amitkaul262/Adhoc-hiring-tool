/**
 * Adhoc Hiring Tool — email + Drive upload relay.
 *
 * This runs entirely inside Google Apps Script, under your own Google
 * account's Gmail/Drive permission (not a password of any kind), and
 * exposes one URL the Next.js app can POST requests to — either "send
 * this email" or "upload this file to Drive".
 *
 * Setup:
 * 1. Project Settings (gear icon) -> Script Properties -> add:
 *    - SHARED_SECRET: any random string you choose (the "password" that
 *      stops strangers from using your deployed URL as you).
 *    - DRIVE_FOLDER_ID: the ID of the Drive folder invoices should be
 *      uploaded into. Open that folder in Drive — the ID is the part of
 *      the URL after /folders/. The script's Google account needs edit
 *      access to this folder (it's automatic if that account owns the
 *      folder; otherwise share the folder with that account first).
 * 2. Deploy -> New deployment (or Manage deployments -> Edit, if you're
 *    updating an existing one) -> type "Web app" -> Execute as "Me" ->
 *    Who has access "Anyone" -> Deploy. Approve both the Gmail AND Drive
 *    permission prompts when they appear.
 * 3. Copy the resulting URL (ends in /exec) into APPS_SCRIPT_URL in the
 *    Next.js app's env vars, and the same secret into APPS_SCRIPT_SECRET
 *    (unchanged if you're updating an existing deployment).
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var expectedSecret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
    if (!expectedSecret || body.secret !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized" });
    }

    if (body.action === "upload_file") {
      return handleUploadFile(body);
    }

    return handleSendEmail(body);
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function handleSendEmail(body) {
  if (!body.to || !body.subject || !body.html) {
    return jsonResponse({ error: "Missing to, subject, or html" });
  }

  var options = {
    htmlBody: body.html,
    name: "FNP Adhoc Hiring",
  };
  if (body.cc) {
    options.cc = Array.isArray(body.cc) ? body.cc.join(",") : body.cc;
  }

  GmailApp.sendEmail(body.to, body.subject, "", options);

  return jsonResponse({ success: true });
}

function handleUploadFile(body) {
  if (!body.fileName || !body.mimeType || !body.fileBase64) {
    return jsonResponse({ error: "Missing fileName, mimeType, or fileBase64" });
  }

  var folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  if (!folderId) {
    return jsonResponse({ error: "DRIVE_FOLDER_ID script property isn't set" });
  }

  var folder = DriveApp.getFolderById(folderId);
  var bytes = Utilities.base64Decode(body.fileBase64);
  var blob = Utilities.newBlob(bytes, body.mimeType, body.fileName);
  var file = folder.createFile(blob);

  // Try to restrict sharing to the FNP Workspace domain — appropriate for
  // financial documents. But this is a SEPARATE permission from creating
  // the file itself, and can be blocked independently by domain sharing
  // policy even when file creation succeeds. Never let a sharing failure
  // undo an upload that already worked — the file still exists and is at
  // least accessible to whoever can already see the destination folder.
  try {
    file.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (sharingErr) {
    // Swallow it — the file is still uploaded and usable.
  }

  return jsonResponse({ success: true, fileId: file.getId(), url: file.getUrl() });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
