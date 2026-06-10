import { useEffect, useState } from "react";
import { api } from "../api.js";

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

function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

function WeeklyChart({ weekly }) {
  const points = (weekly || []).filter((w) => w.avg_rating != null);
  if (points.length < 2) {
    return (
      <p className="text-sm text-gray-400">
        Not enough data yet — the trend appears once feedback spans two weeks.
      </p>
    );
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

function SentimentBar({ label, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs mb-1">
        <span
          className={`px-2 py-0.5 rounded font-medium ${
            SENTIMENT_STYLES[label] || "bg-gray-100 text-gray-600"
          }`}
        >
          {cap(label)}
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

  async function load() {
    setLoading(true);
    try {
      const res = await api.analytics();
      setData(res);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-400">Loading analytics…</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-600">Could not load analytics: {error}</p>
        <button
          onClick={load}
          className="mt-3 px-4 py-2 bg-roche text-white rounded-md text-sm"
        >
          Retry
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

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Feedback Analytics
            </h1>
            <p className="text-sm text-gray-500">
              Roche Scientist Assistant — IT operations view
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 justify-end">
              <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                {data.demo ? "Demo data" : "Live data"}
              </span>
              <button
                onClick={load}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                ↻ Refresh
              </button>
            </div>
            {data.first_date && (
              <p className="text-xs text-gray-400 mt-1.5">
                {fmtDate(data.first_date)} — {fmtDate(data.last_date)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 pb-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total feedback"
            value={total}
            caption={
              langCount
                ? `across ${langCount} languages · ${weekCount} weeks`
                : `over ${weekCount} week${weekCount === 1 ? "" : "s"}`
            }
          />
          <StatCard
            label="Average rating"
            value={data.average_rating ?? "—"}
            suffix={data.average_rating != null ? "/5" : ""}
          >
            {data.average_rating != null && (
              <Stars rating={data.average_rating} />
            )}
          </StatCard>
          <StatCard
            label="Satisfaction"
            value={satisfactionPct}
            suffix="%"
            caption="positive & satisfied replies"
          />
          <StatCard
            label="Needs attention"
            value={data.needs_attention ?? 0}
            caption="confused or frustrated entries"
          />
        </div>

        <SectionTitle>Quality over time</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title="Average rating by week"
            subtitle="Higher is better. Tracks whether answers improve as more SOPs are added."
          >
            <WeeklyChart weekly={data.weekly} />
          </Card>
          <Card
            title="How scientists felt"
            subtitle="Every answer can be rated. This is the tone of the responses we logged."
          >
            {total === 0 ? (
              <p className="text-sm text-gray-400">
                No feedback yet. Try sending a feedback message in the chat
                (e.g. "this process is confusing").
              </p>
            ) : (
              sentimentRows.map((label) => (
                <SentimentBar
                  key={label}
                  label={label}
                  count={bySentiment[label]}
                  total={total}
                />
              ))
            )}
          </Card>
        </div>

        <SectionTitle>Where to focus</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <Card
            title="Top questions"
            subtitle="Most asked topics this period — the gaps where better SOPs would help most."
          >
            {topics.length === 0 ? (
              <p className="text-sm text-gray-400">
                No topic data yet — entries gain a topic via the demo seed or
                future chat tagging.
              </p>
            ) : (
              <ul>
                {topics.slice(0, 5).map((t, i) => (
                  <RankedRow
                    key={t.topic}
                    index={i}
                    title={t.topic}
                    subtitle={t.example ? `e.g. "${t.example}"` : null}
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
            title="Processes causing the most confusion"
            subtitle="Share with the owning department so they can clarify their documentation."
          >
            {confusion.length === 0 ? (
              <p className="text-sm text-gray-400">
                Nothing flagged yet — that's good news.
              </p>
            ) : (
              <ul>
                {confusion.slice(0, 5).map((t, i) => (
                  <RankedRow
                    key={t.topic}
                    index={i}
                    title={t.topic}
                    subtitle={`${t.flagged} of ${t.count} entries flagged`}
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
            <SectionTitle>Why answers get a thumbs down</SectionTitle>
            <Card
              title="Downvote reasons"
              subtitle="Reasons scientists pick when an answer doesn't help."
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
                      count={count}
                      total={reasonTotal}
                    />
                  );
                })}
            </Card>
          </>
        )}

        <SectionTitle>Latest</SectionTitle>
        <Card
          title="Recent feedback"
          subtitle="Newest comments left by scientists."
        >
          {(!data.recent || data.recent.length === 0) && (
            <p className="text-sm text-gray-400">Nothing to show yet.</p>
          )}
          <ul className="divide-y divide-gray-100">
            {(data.recent || []).map((item, i) => (
              <li key={i} className="py-3 flex items-start gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                    SENTIMENT_STYLES[item.sentiment] ||
                    "bg-gray-100 text-gray-600"
                  }`}
                >
                  {cap(item.sentiment)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.message}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[
                      item.topic,
                      item.rating != null ? `${item.rating}/5` : null,
                      fmtDate(item.timestamp),
                      item.reason,
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
        </Card>
      </div>
    </div>
  );
}
