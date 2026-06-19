import { useEffect, useState } from "react";
import { createIncident, triageIncident } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";

const CATEGORIES = [
  { value: "software", label: "Software" },
  { value: "hardware", label: "Hardware" },
  { value: "network", label: "Network" },
  { value: "access", label: "Access / Login" },
  { value: "inquiry", label: "Other / Inquiry" },
];

const URGENCIES = [
  { value: "1", label: "High" },
  { value: "2", label: "Medium" },
  { value: "3", label: "Low" },
];

const fieldClass =
  "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent";

export default function IncidentForm({
  initialTitle = "",
  initialDescription = "",
  onClose,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState("");
  const [urgency, setUrgency] = useState("");
  const [impact, setImpact] = useState(null); // from triage; sent with the ticket
  const [caller, setCaller] = useState(() => {
    try { return getIdentity() || localStorage.getItem("ticketCaller") || ""; } catch { return ""; }
  });
  const [suggestion, setSuggestion] = useState(null); // { priority_label }
  const [triaging, setTriaging] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function runTriage(desc, ttl) {
    if (!desc || !desc.trim()) return;
    setTriaging(true);
    try {
      const t = await triageIncident(desc.trim(), (ttl || "").trim());
      // Pre-fill only fields the user hasn't already chosen.
      setCategory((c) => c || t.category);
      setUrgency((u) => u || String(t.urgency));
      setImpact(t.impact);
      setSuggestion({ priority_label: t.priority_label });
    } catch {
      /* triage is best-effort */
    } finally {
      setTriaging(false);
    }
  }

  // Analyse the pre-filled description from the chat when the form opens.
  useEffect(() => {
    if (initialDescription) runTriage(initialDescription, initialTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !category || !urgency) return;
    setBusy(true);
    setError("");
    try {
      const res = await createIncident(description.trim(), title.trim(), {
        category,
        urgency: Number(urgency),
        impact: impact || undefined,
        caller: caller.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="incident-surface bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            Create Support Ticket
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">
          {result ? (
            <div className="text-center py-10 px-6">
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-tint)",
                  border: "1px solid var(--accent-tint-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                  color: "#16A34A",
                  fontSize: 18,
                }}
              >
                ✓
              </div>
              <p className="font-medium text-gray-800 mb-1">Ticket submitted!</p>
              {result.incident_number && (
                <p className="text-2xl font-mono font-bold text-roche my-3">
                  {result.incident_number}
                </p>
              )}
              {result.priority && (
                <p className="text-sm text-gray-600 mb-1">
                  Priority: <span className="font-medium">{result.priority}</span>
                </p>
              )}
              <p className="text-xs text-gray-400 mb-8">
                {result.mock
                  ? "Test environment · mock ServiceNow response"
                  : "Your ticket has been logged in ServiceNow"}
              </p>
              <button
                onClick={onClose}
                className="min-h-[44px] px-10 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={fieldClass}
                  placeholder="Short summary of the issue"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => runTriage(e.target.value, title)}
                  className={`${fieldClass} resize-none`}
                  placeholder="What happened? When? Which system or equipment?"
                />
              </div>

              {/* AI triage suggestion */}
              {(suggestion || triaging) && (
                <div
                  className="text-xs rounded-xl px-3 py-2"
                  style={{
                    background: "var(--accent-tint, #EBF3FB)",
                    color: "var(--text-secondary, #4B5563)",
                  }}
                >
                  {triaging
                    ? "🤖 Analysing the issue…"
                    : `🤖 Suggested priority: ${suggestion.priority_label} · category pre-filled below. Adjust if needed.`}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Urgency <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    {URGENCIES.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Your name or email <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  value={caller}
                  onChange={(e) => setCaller(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. jane.doe@roche.com"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {busy ? "Submitting…" : "Submit ticket"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
