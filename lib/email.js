// Sends via the Apps Script relay (apps-script/Code.gs) instead of SMTP —
// no App Password needed, just a Gmail "send email as me" permission grant.
async function sendViaAppsScript({ to, cc, subject, html }) {
  const res = await fetch(process.env.APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: process.env.APPS_SCRIPT_SECRET, to, cc, subject, html }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(`Apps Script email relay error: ${data.error}`);
  }
  return data;
}

function hrList() {
  return (process.env.HR_TEAM_EMAILS || "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

const ROLE_COLORS = {
  Florist: "#2F6B4F",
  Helper: "#D98E2B",
  Rider: "#1C6FA8",
  Chef: "#B4432F",
  Supervisor: "#6B4C9A",
};

function baseTemplate({ heading, intro, rows, ctaLabel, ctaUrl, footerNote }) {
  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 0;color:#5B6B60;font-size:13px;width:170px;">${label}</td>
        <td style="padding:6px 0;color:#16241C;font-size:14px;font-weight:600;">${value}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#F6F8F5;padding:32px 16px;">
    <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE3DB;border-radius:12px;overflow:hidden;">
      <div style="background:#16241C;padding:20px 28px;">
        <span style="color:#F6F8F5;font-size:15px;font-weight:700;letter-spacing:0.02em;">FNP Adhoc Hiring</span>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 8px;color:#16241C;font-size:19px;">${heading}</h2>
        <p style="margin:0 0 20px;color:#5B6B60;font-size:14px;line-height:1.5;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #EDEFEA;border-bottom:1px solid #EDEFEA;margin-bottom:24px;">
          ${rowsHtml}
        </table>
        ${
          ctaUrl
            ? `<a href="${ctaUrl}" style="display:inline-block;background:#2F6B4F;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel}</a>`
            : ""
        }
        ${footerNote ? `<p style="margin:20px 0 0;color:#8A968E;font-size:12px;">${footerNote}</p>` : ""}
      </div>
    </div>
  </div>`;
}

function requisitionRows(req) {
  return [
    ["Requisition ID", req.requisition_id],
    ["Worker type", `<span style="color:${ROLE_COLORS[req.worker_type] || "#16241C"}">${req.worker_type}</span>`],
    ["Number of workers", req.number_of_workers],
    ["Tentative rate", `₹${req.tentative_rate}/day`],
    ["Duration", `${req.from_date} → ${req.to_date}`],
    ["Store", `${req.store_name || "-"} (${req.store_code || "-"})`],
    ["Cost center", req.cost_center || "-"],
    ["Raised by", req.raised_by_email],
  ];
}

function multiRoleTable(requisitions) {
  const rows = requisitions
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #EEF1EE;">
          <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:#fff;background:${ROLE_COLORS[r.worker_type] || "#16241C"};">${r.worker_type}</span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #EEF1EE;font-size:13px;color:#16241C;">${r.requisition_id}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #EEF1EE;font-size:13px;color:#16241C;">${r.number_of_workers}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #EEF1EE;font-size:13px;color:#16241C;">₹${r.tentative_rate}/day</td>
        <td style="padding:8px 0 8px 10px;border-bottom:1px solid #EEF1EE;font-size:13px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/requisitions/${r.requisition_id}" style="color:#2F6B4F;">Review →</a>
        </td>
      </tr>`
    )
    .join("");

  return `
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#8A968E;padding-bottom:8px;">Role</th>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#8A968E;padding-bottom:8px;">Requisition</th>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#8A968E;padding-bottom:8px;">Workers</th>
          <th style="text-align:left;font-size:11px;text-transform:uppercase;color:#8A968E;padding-bottom:8px;">Rate</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// Sent to the HOD when a store manager raises one or more requisitions in
// the same submission. HR is cc'd. Each requisition is still independently
// approvable/rejectable — this is just one notification per batch instead
// of one email per role.
export async function sendRequisitionsRaisedEmail(requisitions) {
  if (!requisitions || requisitions.length === 0) return;
  const first = requisitions[0];
  const multiple = requisitions.length > 1;

  const html = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#F6F8F5;padding:32px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #DDE3DB;border-radius:12px;overflow:hidden;">
      <div style="background:#16241C;padding:20px 28px;">
        <span style="color:#F6F8F5;font-size:15px;font-weight:700;letter-spacing:0.02em;">FNP Adhoc Hiring</span>
      </div>
      <div style="padding:28px;">
        <h2 style="margin:0 0 8px;color:#16241C;font-size:19px;">
          ${multiple ? `${requisitions.length} new requisitions await your approval` : "New adhoc hiring requisition awaiting your approval"}
        </h2>
        <p style="margin:0 0 20px;color:#5B6B60;font-size:14px;line-height:1.5;">
          ${first.raised_by_email} raised ${multiple ? "these requisitions" : "this requisition"} for
          ${first.store_name || "their store"} (${first.from_date} → ${first.to_date}). Each one can be
          approved or rejected on its own.
        </p>
        ${multiple ? multiRoleTable(requisitions) : renderSingleRequisitionRows(first)}
        ${
          !multiple
            ? `<a href="${process.env.NEXT_PUBLIC_APP_URL}/requisitions/${first.requisition_id}" style="display:inline-block;background:#2F6B4F;color:#FFFFFF;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">Review requisition</a>`
            : ""
        }
        <p style="margin:20px 0 0;color:#8A968E;font-size:12px;">The store manager and HR are cc'd on this email for visibility.</p>
      </div>
    </div>
  </div>`;

  await sendViaAppsScript({
    to: first.hod_email,
    cc: [first.raised_by_email, ...hrList()],
    subject: multiple
      ? `Approval needed: ${requisitions.length} requisitions from ${first.store_name || first.raised_by_email}`
      : `Approval needed: ${first.requisition_id} — ${first.worker_type} x${first.number_of_workers}`,
    html,
  });
}

function renderSingleRequisitionRows(req) {
  const rows = requisitionRows(req)
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 0;color:#5B6B60;font-size:13px;width:170px;">${label}</td>
        <td style="padding:6px 0;color:#16241C;font-size:14px;font-weight:600;">${value}</td>
      </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border-top:1px solid #EDEFEA;border-bottom:1px solid #EDEFEA;margin-bottom:24px;">${rows}</table>`;
}

// Sent to the store manager (and HR) once the HOD has acted.
export async function sendRequisitionDecisionEmail(req) {
  const approved = req.status === "approved";
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/requisitions/${req.requisition_id}`;
  const html = baseTemplate({
    heading: approved ? "Your requisition was approved" : "Your requisition was rejected",
    intro: approved
      ? `${req.hod_email} approved your requisition. You can proceed with hiring against it.`
      : `${req.hod_email} rejected your requisition.${req.hod_remarks ? ` Remarks: "${req.hod_remarks}"` : ""}`,
    rows: requisitionRows(req),
    ctaLabel: "View requisition",
    ctaUrl: url,
    footerNote: "HR is cc'd on this update.",
  });

  await sendViaAppsScript({
    to: req.raised_by_email,
    cc: hrList(),
    subject: `${approved ? "Approved" : "Rejected"}: ${req.requisition_id}`,
    html,
  });
}
