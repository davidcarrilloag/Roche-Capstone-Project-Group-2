import { useEffect, useState } from "react";
import { api } from "../api.js";
import { downloadReportHtml, downloadEntriesCsv } from "../lib/report.js";
import { dt } from "../dashboardI18n.js";

// Feedback analytics dashboard for IT teams.
// Reads aggregated data from GET /feedback/analytics.
// Original version by David; extended by Analytics (Andrea) with weekly
// rating trend, topic insights, confusion ranking and downvote reasons.

const SENTIMENT_STYLES = {
  positive: "bg-green-100 text-green-700",
  satisfied: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
  confused: "bg-yellow-100 text-yellow-700",
  frustrated: "bg-orange-100 text-orange-700",
  negative: "bg-red-100 text-red-700",
};

const SENTIMENT_ORDER = [
  "satisfied",
  "positive",
  "neutral",
  "confused",
  "frustrated",
  "negative",
];

// Data-source filter for the header dropdown.
const SOURCE_OPTIONS = [
  { key: "all", label: "All data" },
  { key: "live", label: "Live data" },
  { key: "demo", label: "Demo data" },
];
const SOURCE_LABELS = Object.fromEntries(
  SOURCE_OPTIONS.map((o) => [o.key, o.label])
);

// Display-language switcher for feedback text. "original" = as written.
const LANG_OPTIONS = [
  { key: "original", label: "Original" },
  { key: "en", label: "English" },
  { key: "de", label: "Deutsch" },
  { key: "fr", label: "Français" },
  { key: "it", label: "Italiano" },
];
const LANG_LABELS = Object.fromEntries(LANG_OPTIONS.map((o) => [o.key, o.label]));

// Pick the feedback text to show: the chosen language's translation when
// available, otherwise the original message (e.g. live feedback isn't
// translated). Always falls back gracefully so nothing ever shows blank.
function displayText(item, viewLang) {
  if (viewLang === "original") return item.message;
  return (item.translations && item.translations[viewLang]) || item.message;
}

// Compact dropdown for the attribute filters (type / team / person). Styled to
// match the period pills; "all" reads as neutral, a real choice turns blue.
function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) || options[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm px-3 py-1 rounded-full border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
      >
        <span className="text-gray-400">{label}:</span>
        <span className={value !== "all" ? "text-roche font-medium" : "text-gray-700"}>
          {current?.label}
        </span>
        <span className="text-[9px] leading-none text-gray-400">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 w-48 max-h-72 overflow-y-auto bg-white border border-gray-200 rounded-md shadow-lg z-20">
            {options.map((opt, idx) => (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between text-left text-sm px-4 py-2 hover:bg-gray-50 ${
                  idx > 0 ? "border-t border-gray-100" : ""
                } ${value === opt.key ? "text-roche font-medium" : "text-gray-700"}`}
              >
                {opt.label}
                {value === opt.key && <span>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Turn the selected filter into a {start, end} date range (YYYY-MM-DD).
// "all" -> {} (no limit). "custom" -> whatever dates the user picked.
function computeRange(range, customStart, customEnd) {
  if (range === "all") return {};
  if (range === "custom") {
    const r = {};
    if (customStart) r.start = customStart;
    if (customEnd) r.end = customEnd;
    return r;
  }
  const end = new Date();
  const start = new Date();
  if (range === "week") start.setDate(end.getDate() - 7);
  else if (range === "month") start.setDate(end.getDate() - 30);
  else if (range === "year") start.setFullYear(end.getFullYear() - 1);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function StatCard({ label, value, suffix, caption, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-3xl font-bold text-gray-800">
        {value}
        {suffix && (
          <span className="text-lg font-medium text-gray-400">{suffix}</span>
        )}
      </div>
      {children}
      {caption && <div className="text-xs text-gray-500 mt-2">{caption}</div>}
    </div>
  );
}

function Stars({ rating }) {
  const full = Math.round(rating || 0);
  return (
    <div className="text-roche text-sm mt-1" aria-label={`${rating} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? "text-roche" : "text-gray-300"}>
          ★
        </span>
      ))}
    </div>
  );
}

function WeeklyChart({ weekly, emptyText }) {
  const points = (weekly || []).filter((w) => w.avg_rating != null);
  if (points.length < 2) {
    return <p className="text-sm text-gray-400">{emptyText}</p>;
  }
  const W = 560;
  const H = 180;
  const padL = 28;
  const padB = 24;
  const x = (i) => padL + (i * (W - padL - 10)) / (points.length - 1);
  const y = (r) => ((5 - r) * (H - padB - 10)) / 4 + 10;
  const line = points
    .map((p, i) => `${x(i).toFixed(1)},${y(p.avg_rating).toFixed(1)}`)
    .join(" ");
  const area = `${padL},${H - padB} ${line} ${x(points.length - 1).toFixed(
    1
  )},${H - padB}`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Average rating by week"
    >
      {[1, 2, 3, 4, 5].map((r) => (
        <g key={r}>
          <line
            x1={padL}
            x2={W - 10}
            y1={y(r)}
            y2={y(r)}
            stroke="#E5E7EB"
            strokeWidth="1"
          />
          <text x={padL - 8} y={y(r) + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">
            {r}
          </text>
        </g>
      ))}
      <polygon points={area} fill="#0066CC" opacity="0.08" />
      <polyline
        points={line}
        fill="none"
        stroke="#0066CC"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {points.map((p, i) => (
        <circle
          key={p.week}
          cx={x(i)}
          cy={y(p.avg_rating)}
          r="4"
          fill="white"
          stroke="#0066CC"
          strokeWidth="2"
        >
          <title>{`${p.week}: ${p.avg_rating} avg (${p.count} entries)`}</title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text
          key={`l-${p.week}`}
          x={x(i)}
          y={H - 6}
          fontSize="10"
          fill="#9CA3AF"
          textAnchor="middle"
        >
          {`W${i + 1}`}
        </text>
      ))}
    </svg>
  );
}

function SentimentBar({ label, count, total, display }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs mb-1">
        <span
          className={`px-2 py-0.5 rounded font-medium ${
            SENTIMENT_STYLES[label] || "bg-gray-100 text-gray-600"
          }`}
        >
          {display ?? cap(label)}
        </span>
        <span className="text-gray-500">
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-roche" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RankedRow({ index, title, subtitle, right }) {
  return (
    <li className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-300 font-semibold w-6">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{title}</div>
        {subtitle && (
          <div className="text-xs text-gray-500 truncate">{subtitle}</div>
        )}
      </div>
      {right}
    </li>
  );
}

function MiniBar({ pct }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-roche rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-bold text-gray-800 w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 mt-8 mb-3">
      {children}
    </h2>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [range, setRange] = useState("all"); // all | week | month | year | custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [source, setSource] = useState("all"); // all | live | demo
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  // Display language for feedback text: "original" shows it as written, a
  // language code shows the stored translation. Purely client-side (no refetch).
  const [viewLang, setViewLang] = useState("original");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  // Attribute filters: feedback type (sentiment), person and team. Collapsed
  // behind a "Filters" toggle by default to keep the header quiet.
  const [sentiment, setSentiment] = useState("all");
  const [author, setAuthor] = useState("all");
  const [team, setTeam] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Full feedback list (newest first) + how many rows are shown in "Recent
  // feedback". Starts collapsed at 10 and grows by 10 each "Show more".
  const [allFeedback, setAllFeedback] = useState([]);
  const [visibleCount, setVisibleCount] = useState(10);

  // The whole dashboard follows the language switcher; "original" keeps the
  // chrome in English while each comment shows as written.
  const uiLang = viewLang === "original" ? "en" : viewLang;
  const T = (k, fb) => dt(uiLang, k, fb);
  const sentLabel = (s) => dt(uiLang, "s." + s, cap(s));
  const reasonLabel = (r) => (r ? dt(uiLang, "r." + r, r) : r);
  const topicLabel = (tp) => (tp ? dt(uiLang, "t." + tp, tp) : tp);

  async function load() {
    setLoading(true);
    try {
      const params = {
        ...computeRange(range, customStart, customEnd),
        source, sentiment, author, team,
      };
      // Pull the aggregates and the full raw feedback in parallel; the raw
      // list powers the expandable "Recent feedback" section.
      const [res, entries] = await Promise.all([
        api.analytics(params),
        api.entries(params),
      ]);
      setData(res);
      setAllFeedback([...(entries || [])].reverse()); // newest first
      setVisibleCount(10); // re-collapse whenever the period changes
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Reload whenever any filter changes (and on mount).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd, source, sentiment, author, team]);

  async function downloadCsv() {
    try {
      const entries = await api.entries({
        ...computeRange(range, customStart, customEnd),
        source, sentiment, author, team,
      });
      downloadEntriesCsv(entries);
    } catch (e) {
      alert("Could not export raw feedback: " + e.message);
    }
  }

  if (loading && !data) {
    return <div className="p-8 text-gray-400">{T("loading")}</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">{T("error")} {error}</p>
        <button
          onClick={load}
          className="mt-3 px-4 py-2 bg-roche text-white rounded-md text-sm"
        >
          {T("retry")}
        </button>
      </div>
    );
  }

  const bySentiment = data.by_sentiment || {};
  const total = data.total || 0;
  const satisfied =
    (bySentiment.satisfied || 0) + (bySentiment.positive || 0);
  const satisfactionPct = total ? Math.round((satisfied / total) * 100) : 0;
  const langCount = Object.keys(data.by_language || {}).length;
  const weekCount = (data.weekly || []).length;
  const sentimentRows = SENTIMENT_ORDER.filter((s) => bySentiment[s]).concat(
    Object.keys(bySentiment).filter((s) => !SENTIMENT_ORDER.includes(s))
  );
  const topics = data.topics || [];
  const confusion = data.confusion || [];
  const activeFilterCount = [
    range !== "all",
    sentiment !== "all",
    author !== "all",
    team !== "all",
  ].filter(Boolean).length;

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {T("title")}
            </h1>
            <p className="text-sm text-gray-500">
              {T("subtitle")}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              {/* Data-source dropdown — All / Live / Demo. Lets IT inspect the
                  real feedback, the demo set, or both, without visual clutter. */}
              <div className="relative">
                <button
                  onClick={() => setSourceMenuOpen((o) => !o)}
                  title="Choose which data to show"
                  className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 flex items-center gap-1.5"
                >
                  {T("src_" + source)}
                  <span className="text-[9px] leading-none">▾</span>
                </button>
                {sourceMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setSourceMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 overflow-hidden">
                      {SOURCE_OPTIONS.map((opt, idx) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setSource(opt.key);
                            setSourceMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between text-left text-sm px-4 py-2.5 hover:bg-gray-50 ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          } ${
                            source === opt.key
                              ? "text-roche font-medium"
                              : "text-gray-700"
                          }`}
                        >
                          {T("src_" + opt.key)}
                          {source === opt.key && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Display-language switcher — translate all feedback text to the
                  chosen language (original-language badge is kept on each row). */}
              <div className="relative">
                <button
                  onClick={() => setLangMenuOpen((o) => !o)}
                  title="Show feedback in this language"
                  className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium hover:bg-gray-200 flex items-center gap-1.5"
                >
                  <span>🌐</span>
                  <span className={viewLang !== "original" ? "text-roche" : ""}>
                    {viewLang === "original" ? T("original") : LANG_LABELS[viewLang]}
                  </span>
                  <span className="text-[9px] leading-none">▾</span>
                </button>
                {langMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setLangMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-20 overflow-hidden">
                      {LANG_OPTIONS.map((opt, idx) => (
                        <button
                          key={opt.key}
                          onClick={() => {
                            setViewLang(opt.key);
                            setLangMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between text-left text-sm px-4 py-2.5 hover:bg-gray-50 ${
                            idx > 0 ? "border-t border-gray-100" : ""
                          } ${
                            viewLang === opt.key
                              ? "text-roche font-medium"
                              : "text-gray-700"
                          }`}
                        >
                          {opt.key === "original" ? T("original") : opt.label}
                          {viewLang === opt.key && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {total > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    title="Download the report or the raw data"
                    className="text-sm px-3 py-1.5 bg-roche text-white rounded-md hover:opacity-90 flex items-center gap-1.5"
                  >
                    ↓ {T("download")}
                    <span className="text-[10px] leading-none">▾</span>
                  </button>
                  {menuOpen && (
                    <>
                      {/* invisible layer: clicking outside closes the menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                      />
                      <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-20 overflow-hidden">
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            downloadReportHtml(data);
                          }}
                          className="block w-full text-left text-sm px-4 py-2.5 text-gray-700 hover:bg-gray-50"
                        >
                          {T("downloadReport")}
                        </button>
                        <button
                          onClick={() => {
                            setMenuOpen(false);
                            downloadCsv();
                          }}
                          className="block w-full text-left text-sm px-4 py-2.5 text-gray-700 hover:bg-gray-50 border-t border-gray-100"
                        >
                          {T("downloadCsv")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={load}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                ↻ {T("refresh")}
              </button>
            </div>
            {data.first_date && (
              <p className="text-xs text-gray-400 mt-1.5">
                <span className="text-gray-500 font-medium">{T("data")}</span>{" "}
                {fmtDate(data.first_date)} — {fmtDate(data.last_date)}
              </p>
            )}
          </div>
        </div>

        {/* All filters (period + attributes) collapsed behind one toggle. */}
        <div className="max-w-5xl mx-auto mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="text-sm px-3 py-1 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <span>{T("filters")}</span>
            {activeFilterCount > 0 && (
              <span className="text-xs bg-roche text-white rounded-full px-1.5 leading-5">
                {activeFilterCount}
              </span>
            )}
            <span className="text-[9px] leading-none text-gray-400">
              {filtersOpen ? "▴" : "▾"}
            </span>
          </button>
          {filtersOpen && (
            <>
              <FilterSelect
                label={T("lbl_period")}
                value={range}
                onChange={setRange}
                options={[
                  { key: "all", label: T("period_all") },
                  { key: "week", label: T("period_week") },
                  { key: "month", label: T("period_month") },
                  { key: "year", label: T("period_year") },
                  { key: "custom", label: T("period_custom") },
                ]}
              />
              {range === "custom" && (
                <div className="flex items-center gap-2 ml-1">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-300 rounded-md text-gray-700"
                  />
                  <span className="text-gray-400 text-sm">→</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="text-sm px-2 py-1 border border-gray-300 rounded-md text-gray-700"
                  />
                </div>
              )}
              <FilterSelect
                label={T("lbl_type")}
                value={sentiment}
                onChange={setSentiment}
                options={[
                  { key: "all", label: T("all_types") },
                  ...SENTIMENT_ORDER.map((s) => ({ key: s, label: sentLabel(s) })),
                ]}
              />
              <FilterSelect
                label={T("lbl_team")}
                value={team}
                onChange={setTeam}
                options={[
                  { key: "all", label: T("all_teams") },
                  ...(data.teams || []).map((tm) => ({ key: tm, label: tm })),
                ]}
              />
              <FilterSelect
                label={T("lbl_person")}
                value={author}
                onChange={setAuthor}
                options={[
                  { key: "all", label: T("all_people") },
                  ...(data.authors || []).map((a) => ({ key: a, label: a })),
                ]}
              />
              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setRange("all");
                    setCustomStart("");
                    setCustomEnd("");
                    setSentiment("all");
                    setTeam("all");
                    setAuthor("all");
                  }}
                  className="text-sm px-3 py-1 rounded-full text-gray-500 hover:text-roche hover:underline"
                >
                  {T("clear")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label={T("kpi_total")}
            value={total}
            caption={
              langCount
                ? `${T("across")} ${langCount} ${T("languages")} · ${weekCount} ${T("weeks")}`
                : `${T("over")} ${weekCount} ${weekCount === 1 ? T("week") : T("weeks")}`
            }
          />
          <StatCard
            label={T("kpi_avg")}
            value={data.average_rating ?? "—"}
            suffix={data.average_rating != null ? "/5" : ""}
          >
            {data.average_rating != null && (
              <Stars rating={data.average_rating} />
            )}
          </StatCard>
          <StatCard
            label={T("kpi_sat")}
            value={satisfactionPct}
            suffix="%"
            caption={T("kpi_sat_caption")}
          />
          <StatCard
            label={T("kpi_attn")}
            value={data.needs_attention ?? 0}
            caption={T("kpi_attn_caption")}
          />
        </div>

        <SectionTitle>{T("sec_quality")}</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title={T("card_weekly")}
            subtitle={T("card_weekly_sub")}
          >
            <WeeklyChart weekly={data.weekly} emptyText={T("weekly_insufficient")} />
          </Card>
          <Card
            title={T("card_felt")}
            subtitle={T("card_felt_sub")}
          >
            {total === 0 ? (
              <p className="text-sm text-gray-400">{T("empty_felt")}</p>
            ) : (
              sentimentRows.map((label) => (
                <SentimentBar
                  key={label}
                  label={label}
                  display={sentLabel(label)}
                  count={bySentiment[label]}
                  total={total}
                />
              ))
            )}
          </Card>
        </div>

        <SectionTitle>{T("sec_focus")}</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title={T("card_top")}
            subtitle={T("card_top_sub")}
          >
            {topics.length === 0 ? (
              <p className="text-sm text-gray-400">{T("empty_topics")}</p>
            ) : (
              <ul>
                {topics.slice(0, 5).map((t, i) => (
                  <RankedRow
                    key={t.topic}
                    index={i}
                    title={topicLabel(t.topic)}
                    subtitle={t.example ? `${T("eg")} "${t.example}"` : null}
                    right={
                      <span className="text-base font-bold text-gray-800">
                        {t.count}
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
          <Card
            title={T("card_conf")}
            subtitle={T("card_conf_sub")}
          >
            {confusion.length === 0 ? (
              <p className="text-sm text-gray-400">{T("empty_conf")}</p>
            ) : (
              <ul>
                {confusion.slice(0, 5).map((t, i) => (
                  <RankedRow
                    key={t.topic}
                    index={i}
                    title={topicLabel(t.topic)}
                    subtitle={`${t.flagged}/${t.count} ${T("flagged")}`}
                    right={
                      <MiniBar pct={Math.round((t.flagged / t.count) * 100)} />
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>

        {data.by_reason && Object.keys(data.by_reason).length > 0 && (
          <>
            <SectionTitle>{T("sec_why")}</SectionTitle>
            <Card
              title={T("card_reasons")}
              subtitle={T("card_reasons_sub")}
            >
              {Object.entries(data.by_reason)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => {
                  const reasonTotal = Object.values(data.by_reason).reduce(
                    (a, b) => a + b,
                    0
                  );
                  return (
                    <SentimentBar
                      key={reason}
                      label={reason}
                      display={reasonLabel(reason)}
                      count={count}
                      total={reasonTotal}
                    />
                  );
                })}
            </Card>
          </>
        )}

        <SectionTitle>{T("sec_latest")}</SectionTitle>
        <Card
          title={T("card_recent")}
          subtitle={T("card_recent_sub")}
        >
          {allFeedback.length === 0 && (
            <p className="text-sm text-gray-400">{T("empty_recent")}</p>
          )}
          <ul className="divide-y divide-gray-100">
            {allFeedback.slice(0, visibleCount).map((item, i) => (
              <li key={i} className="py-3 flex items-start gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                    SENTIMENT_STYLES[item.sentiment] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {sentLabel(item.sentiment)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{displayText(item, viewLang)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[
                      topicLabel(item.topic),
                      item.rating != null ? `${item.rating}/5` : null,
                      fmtDate(item.timestamp),
                      // The reason already headlines the row when it's the
                      // message text, so don't repeat it in the meta line.
                      item.reason !== item.message ? reasonLabel(item.reason) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {item.language && (
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium uppercase shrink-0">
                    {item.language}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {allFeedback.length > 10 && (
            <div className="pt-3 mt-1 border-t border-gray-100 flex justify-center gap-5">
              {visibleCount < allFeedback.length && (
                <button
                  onClick={() => setVisibleCount((c) => c + 10)}
                  className="text-sm text-roche font-medium hover:underline"
                >
                  {T("show_more")} (+{allFeedback.length - visibleCount})
                </button>
              )}
              {visibleCount > 10 && (
                <button
                  onClick={() => setVisibleCount(10)}
                  className="text-sm text-gray-500 font-medium hover:underline"
                >
                  {T("show_less")}
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
