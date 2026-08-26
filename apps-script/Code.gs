/**
 * Adhoc Hiring Tool — email relay.
 *
 * This runs entirely inside Google Apps Script, under your own Google
 * account's Gmail permission (not a password of any kind), and just
 * exposes one URL the Next.js app can POST an email request to.
 *
 * Setup:
 * 1. Project Settings (gear icon) -> Script Properties -> add a property
 *    named SHARED_SECRET with any random string you choose. This is the
 *    "password" that stops random people on the internet from using your
 *    deployed URL to send mail as you.
 * 2. Deploy -> New deployment -> type "Web app" -> Execute as "Me" ->
 *    Who has access "Anyone" -> Deploy. Approve the Gmail permission
 *    prompt when it appears — that's the actual authorization step.
 * 3. Copy the resulting URL (ends in /exec) into APPS_SCRIPT_URL in the
 *    Next.js app's env vars, and the same secret into APPS_SCRIPT_SECRET.
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var expectedSecret = PropertiesService.getScriptProperties().getProperty("SHARED_SECRET");
    if (!expectedSecret || body.secret !== expectedSecret) {
      return jsonResponse({ error: "Unauthorized" });
    }
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
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
