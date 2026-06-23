// Report generation for the feedback analytics dashboard.
// Builds two downloadable files from the same analytics payload, with no
// external libraries:
//   - downloadReportHtml(data): a Roche-branded, print-ready report (.html).
//     Selva can open it in any browser and "Print → Save as PDF".
//   - downloadReportCsv(data): a flat data table (.csv) that opens in Excel.
// Author: Analytics (Andrea).

const ROCHE_BLUE = "#0066CC";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// --- shared helpers -------------------------------------------------------

function satisfaction(data) {
  const s = data.by_sentiment || {};
  const total = data.total || 0;
  const positive = (s.satisfied || 0) + (s.positive || 0);
  return total ? Math.round((positive / total) * 100) : 0;
}

function triggerDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Free the memory once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- CSV (raw data: one row per feedback entry) ---------------------------

// Wrap a value so commas, quotes and line breaks survive in Excel.
function csvCell(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

// Column order — friendliest / most useful fields first.
const CSV_COLUMNS = [
  "date",
  "time",
  "topic",
  "rating",
  "sentiment",
  "language",
  "reason",
  "comment",
  "message",
  "session_id",
  "message_id",
  "demo",
];

function entryToRow(e) {
  const ts = e.timestamp || "";
  let date = "";
  let time = "";
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      date = d.toISOString().slice(0, 10); // YYYY-MM-DD
      time = d.toISOString().slice(11, 19); // HH:MM:SS (UTC)
    }
  }
  return csvRow([
    date,
    time,
    e.topic,
    e.rating,
    e.sentiment,
    e.language ? String(e.language).toUpperCase() : "",
    e.reason,
    e.comment,
    e.message,
    e.session_id,
    e.message_id,
    e.seed ? "yes" : "no",
  ]);
}

export function buildEntriesCsv(entries) {
  const rows = (entries || [])
    .slice()
    .sort((a, b) =>
      String(b.timestamp || "").localeCompare(String(a.timestamp || ""))
    ) // newest first
    .map(entryToRow);
  // \uFEFF is a BOM so Excel reads accented characters (ü, é, à) correctly.
  return "\uFEFF" + [csvRow(CSV_COLUMNS), ...rows].join("\r\n");
}

export function downloadEntriesCsv(entries) {
  const csv = buildEntriesCsv(entries);
  triggerDownload(csv, `roche-feedback-raw-${today()}.csv`, "text/csv;charset=utf-8");
}

// --- HTML report ----------------------------------------------------------

// Escape user/content strings before dropping them into HTML.
function esc(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rankedList(items, render) {
  if (!items || items.length === 0) {
    return `<p class="muted">Nothing flagged — that's good news.</p>`;
  }
  return `<ol class="ranked">${items.map(render).join("")}</ol>`;
}

export function buildReportHtml(data) {
  const total = data.total || 0;
  const satPct = satisfaction(data);
  const period =
    data.first_date || data.last_date
      ? `${esc(data.first_date || "?")} &ndash; ${esc(data.last_date || "?")}`
      : "All available feedback";

  const confusionList = rankedList(data.confusion || [], (c) => {
    const pct = c.count ? Math.round((c.flagged / c.count) * 100) : 0;
    return `<li><span class="rank-title">${esc(c.topic)}</span>
      <span class="rank-detail">${pct}% flagged &middot; ${c.flagged} of ${c.count} entries</span></li>`;
  });

  const topicsList = (data.topics || []).length
    ? `<ol class="ranked">${(data.topics || [])
        .map(
          (t) =>
            `<li><span class="rank-title">${esc(t.topic)}</span>
             <span class="rank-detail">${t.count} questions${
              t.example ? ` &middot; e.g. &ldquo;${esc(t.example)}&rdquo;` : ""
            }</span></li>`
        )
        .join("")}</ol>`
    : `<p class="muted">No topic data for this period.</p>`;

  const sentimentRows = Object.entries(data.by_sentiment || {})
    .map(([label, count]) => {
      const pct = total ? Math.round((count / total) * 100) : 0;
      return `<tr><td>${esc(label)}</td><td>${count}</td><td>${pct}%</td></tr>`;
    })
    .join("");

  const reasonRows = Object.entries(data.by_reason || {})
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => `<tr><td>${esc(reason)}</td><td>${count}</td></tr>`)
    .join("");

  const languageRows = Object.entries(data.by_language || {})
    .map(([lang, count]) => `<tr><td>${esc(lang.toUpperCase())}</td><td>${count}</td></tr>`)
    .join("");

  const weeklyRows = (data.weekly || [])
    .map(
      (w) =>
        `<tr><td>${esc(w.week)}</td><td>${
          w.avg_rating != null ? `${w.avg_rating}/5` : "&mdash;"
        }</td><td>${w.count || 0}</td></tr>`
    )
    .join("");

  const generated = new Date().toLocaleString("en-GB");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Roche Scientist Assistant — Feedback Report</title>
<style>
  :root { --roche: ${ROCHE_BLUE}; }
  * { box-sizing: border-box; }
  body {
    font-family: Inter, "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; margin: 0; padding: 40px; background: #f8fafc;
    line-height: 1.5;
  }
  .sheet { max-width: 820px; margin: 0 auto; background: #fff;
    border: 1px solid #e5e7eb; border-radius: 12px; padding: 40px; }
  header { border-bottom: 3px solid var(--roche); padding-bottom: 16px; margin-bottom: 24px; }
  h1 { color: var(--roche); font-size: 22px; margin: 0 0 4px; }
  .sub { color: #6b7280; font-size: 13px; margin: 0; }
  .badge { display: inline-block; font-size: 11px; font-weight: 600;
    padding: 3px 10px; border-radius: 999px; background: #eef2ff; color: #4338ca; }
  h2 { font-size: 15px; color: #111827; margin: 28px 0 10px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 8px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; }
  .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
  .kpi .value { font-size: 26px; font-weight: 700; color: #1f2937; }
  .kpi .cap { font-size: 11px; color: #6b7280; }
  ol.ranked { list-style: none; counter-reset: r; margin: 0; padding: 0; }
  ol.ranked li { counter-increment: r; padding: 10px 0; border-bottom: 1px solid #f3f4f6;
    display: flex; flex-direction: column; }
  ol.ranked li::before { content: counter(r, decimal-leading-zero);
    color: #cbd5e1; font-weight: 700; font-size: 12px; }
  .rank-title { font-weight: 600; font-size: 14px; }
  .rank-detail { font-size: 12px; color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  th { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  td:first-child { text-transform: capitalize; }
  .muted { color: #9ca3af; font-size: 13px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  footer { margin-top: 32px; padding-top: 14px; border-top: 1px solid #e5e7eb;
    font-size: 11px; color: #9ca3af; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: none; border-radius: 0; max-width: none; padding: 0; }
    h2 { break-after: avoid; }
    ol.ranked li, tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <h1>Feedback Insight Report</h1>
      <p class="sub">Roche Scientist Assistant &middot; ${period}${
        data.demo ? ` &nbsp; <span class="badge">Demo data</span>` : ""
      }</p>
    </header>

    <div class="kpis">
      <div class="kpi"><div class="label">Total feedback</div>
        <div class="value">${total}</div></div>
      <div class="kpi"><div class="label">Average rating</div>
        <div class="value">${
          data.average_rating != null ? `${data.average_rating}<span style="font-size:14px;color:#9ca3af">/5</span>` : "&mdash;"
        }</div></div>
      <div class="kpi"><div class="label">Satisfaction</div>
        <div class="value">${satPct}<span style="font-size:14px;color:#9ca3af">%</span></div>
        <div class="cap">positive &amp; satisfied</div></div>
      <div class="kpi"><div class="label">Needs attention</div>
        <div class="value">${data.needs_attention || 0}</div>
        <div class="cap">confused or frustrated</div></div>
    </div>

    <h2>Processes causing the most confusion</h2>
    <p class="muted">Share each item with the owning department so they can clarify their documentation.</p>
    ${confusionList}

    <h2>Most asked topics</h2>
    ${topicsList}

    <div class="two-col">
      <div>
        <h2>How scientists felt</h2>
        <table><thead><tr><th>Sentiment</th><th>Count</th><th>Share</th></tr></thead>
          <tbody>${sentimentRows || `<tr><td colspan="3" class="muted">No data</td></tr>`}</tbody></table>
      </div>
      <div>
        <h2>Why answers get a thumbs down</h2>
        <table><thead><tr><th>Reason</th><th>Count</th></tr></thead>
          <tbody>${reasonRows || `<tr><td colspan="2" class="muted">No downvote reasons recorded</td></tr>`}</tbody></table>
      </div>
    </div>

    <div class="two-col">
      <div>
        <h2>By language</h2>
        <table><thead><tr><th>Language</th><th>Count</th></tr></thead>
          <tbody>${languageRows || `<tr><td colspan="2" class="muted">No data</td></tr>`}</tbody></table>
      </div>
      <div>
        <h2>Average rating by week</h2>
        <table><thead><tr><th>Week</th><th>Avg</th><th>Entries</th></tr></thead>
          <tbody>${weeklyRows || `<tr><td colspan="3" class="muted">No data</td></tr>`}</tbody></table>
      </div>
    </div>

    <footer>Generated ${esc(generated)} &middot; Roche Scientist Assistant — Analytics &amp; Feedback</footer>
  </div>
</body>
</html>`;
}

export function downloadReportHtml(data) {
  const html = buildReportHtml(data);
  triggerDownload(html, `roche-feedback-report-${today()}.html`, "text/html;charset=utf-8");
}
