const inquirySections = [
  ["Contact", { name: "Name", email: "Email address", phone: "Phone" }],
  ["Event details", {
    occasion: "Event type", date: "Preferred date", flexible: "Date flexibility",
    location: "Location", guests: "Estimated guests", budget: "Event budget",
  }],
  ["In their words", { vision: "Event vision", inspiration: "Inspiration" }],
];

function emailText(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replace(/\r\n?|\n/g, "<br>");
}

export function inquiryEmail(data, visibleFields) {
  const sections = inquirySections.map(([title, labels]) => ({
    title,
    rows: Object.entries(labels).filter(([key]) => visibleFields.has(key)).map(([key, label]) => [label, data[key] || "Not provided"]),
  })).filter(({ rows }) => rows.length);
  const text = sections.map(({ title, rows }) =>
    [title, ...rows.map(([label, value]) => label + ": " + value)].join("\n")
  ).join("\n\n");

  const content = sections.map(({ title, rows }) => `
    <tr><td style="padding:24px 24px 6px">
      <h2 style="margin:0;color:#4a253b;font:normal 24px Georgia,serif">${title}</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;table-layout:fixed">
        ${rows.map(([label, value]) => `<tr>
          <th scope="row" width="38%" align="left" valign="top" style="padding:11px 8px 11px 0;border-bottom:1px solid #e6dcd3;color:#695a61;font:normal 14px/1.5 Arial,sans-serif">${label}</th>
          <td valign="top" style="padding:11px 0;border-bottom:1px solid #e6dcd3;color:#382e33;font:16px/1.5 Arial,sans-serif;overflow-wrap:anywhere;word-break:break-word">${emailText(value)}</td>
        </tr>`).join("")}
      </table>
    </td></tr>`).join("");
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#f8f4ee">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f8f4ee"><tr><td align="center" style="padding:18px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border:1px solid #dfd5cc">
        <tr><td bgcolor="#4a253b" style="padding:26px 24px;border-bottom:3px solid #b79b67">
          <p style="margin:0 0 14px;color:#ead9c2;font:18px Georgia,serif">Events2Luv</p>
          <h1 style="margin:0;color:#fff;font:normal 32px/1.15 Georgia,serif">New consultation request</h1>
        </td></tr>
        ${content}
        ${data.email ? `<tr><td style="padding:20px 24px;color:#695a61;font:14px/1.5 Arial,sans-serif">Reply to this email to contact the requester.</td></tr>` : ""}
      </table>
    </td></tr></table></body></html>`;
  return { text, html };
}
