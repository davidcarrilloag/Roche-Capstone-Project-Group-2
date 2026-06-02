import { useEffect, useState } from "react";
import { api } from "../api.js";

// Simple feedback analytics dashboard for IT teams.
// Reads aggregated data from GET /feedback/analytics.

const SENTIMENT_STYLES = {
  positive: "bg-green-100 text-green-700",
  satisfied: "bg-green-100 text-green-700",
  neutral: "bg-gray-100 text-gray-600",
  confused: "bg-yellow-100 text-yellow-700",
  frustrated: "bg-orange-100 text-orange-700",
  negative: "bg-red-100 text-red-700",
};

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}

function SentimentBar({ label, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span
          className={`px-2 py-0.5 rounded ${
            SENTIMENT_STYLES[label] || "bg-gray-100 text-gray-600"
          }`}
        >
          {label}
        </span>
        <span className="text-gray-500">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-roche"
          style={{ width: `${pct}%` }}
        />
      </div>
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

  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-800">
          Feedback Analytics
        </h1>
        <button
          onClick={load}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total feedback" value={total} />
        <StatCard
          label="Avg rating"
          value={data.average_rating ?? "—"}
        />
        <StatCard
          label="Distinct sentiments"
          value={Object.keys(bySentiment).length}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Sentiment breakdown
        </h2>
        {total === 0 ? (
          <p className="text-sm text-gray-400">
            No feedback yet. Try sending a feedback message in the chat (e.g.
            "this process is confusing").
          </p>
        ) : (
          Object.entries(bySentiment).map(([label, count]) => (
            <SentimentBar
              key={label}
              label={label}
              count={count}
              total={total}
            />
          ))
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Recent feedback
        </h2>
        {(!data.recent || data.recent.length === 0) && (
          <p className="text-sm text-gray-400">Nothing to show yet.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {(data.recent || []).map((item, i) => (
            <li key={i} className="py-2 flex items-start gap-3">
              <span
                className={`px-2 py-0.5 rounded text-xs shrink-0 ${
                  SENTIMENT_STYLES[item.sentiment] || "bg-gray-100 text-gray-600"
                }`}
              >
                {item.sentiment}
              </span>
              <div className="flex-1">
                <p className="text-sm text-gray-700">{item.message}</p>
                <p className="text-[11px] text-gray-400">
                  {item.timestamp}
                  {item.rating ? ` · rating ${item.rating}/5` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
