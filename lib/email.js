import nodemailer from "nodemailer";

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  return transporter;
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

// Sent to the HOD when a store manager raises a requisition. HR is CC'd.
export async function sendRequisitionRaisedEmail(req) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/requisitions/${req.requisition_id}`;
  const html = baseTemplate({
    heading: "New adhoc hiring requisition awaiting your approval",
    intro: `${req.raised_by_email} has raised a new requisition. Please review and approve or reject it from your dashboard.`,
    rows: requisitionRows(req),
    ctaLabel: "Review requisition",
    ctaUrl: url,
    footerNote: "HR is cc'd on this requisition for visibility.",
  });

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: req.hod_email,
    cc: hrList(),
    subject: `Approval needed: ${req.requisition_id} — ${req.worker_type} x${req.number_of_workers}`,
    html,
  });
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

  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: req.raised_by_email,
    cc: hrList(),
    subject: `${approved ? "Approved" : "Rejected"}: ${req.requisition_id}`,
    html,
  });
}
