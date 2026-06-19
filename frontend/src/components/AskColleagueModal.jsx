import { useEffect, useState } from "react";
import { suggestExperts, createColleagueRequest } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import { Users, Check } from "lucide-react";

export default function AskColleagueModal({ question = "", onClose }) {
  const [experts, setExperts] = useState([]);
  const [selected, setSelected] = useState("");
  const [text, setText] = useState(question);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    suggestExperts(question)
      .then((list) => {
        setExperts(list || []);
        if (list && list[0]) setSelected(list[0].name);
      })
      .catch(() => setError("Couldn't load experts."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    if (!selected || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createColleagueRequest({
        to_member: selected,
        question: text.trim(),
        from_user: getIdentity() || undefined,
      });
      setSent(selected);
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
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users size={17} strokeWidth={1.75} /> Ask a colleague
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {sent ? (
            <div className="text-center py-8">
              <div
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-tint-border)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 12px", color: "#16A34A", fontSize: 18,
                }}
              >
                ✓
              </div>
              <p className="font-medium text-gray-800 mb-1">Question sent to {sent}</p>
              <p className="text-xs text-gray-400 mb-8">
                They'll see it in their inbox and can reply.
              </p>
              <button
                onClick={onClose}
                className="min-h-[44px] px-10 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Your question</label>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent mb-4"
              />

              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Suggested colleagues
              </label>
              {loading && <p className="text-sm text-gray-400 py-2">Finding the right expert…</p>}
              {!loading && experts.length === 0 && (
                <p className="text-sm text-gray-500 py-2">
                  No specific expert matched — pick anyone from the roster via the sidebar identity, or refine your question.
                </p>
              )}
              <div className="space-y-2">
                {experts.map((ex) => {
                  const active = selected === ex.name;
                  return (
                    <button
                      key={ex.name}
                      onClick={() => setSelected(ex.name)}
                      className="w-full text-left rounded-xl px-3 py-2.5 transition flex items-center gap-3"
                      style={{
                        border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                        backgroundColor: active ? "var(--accent-tint)" : "transparent",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-medium text-gray-900">{ex.name}</div>
                        <div className="text-xs text-gray-500">
                          {ex.role} · {ex.team} — {ex.expertise}
                        </div>
                        {ex.matched_on && (
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>
                            matches: {ex.matched_on}
                          </div>
                        )}
                      </div>
                      {active && <Check size={15} strokeWidth={2.5} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl mt-4">{error}</p>}

              <button
                onClick={send}
                disabled={busy || !selected || !text.trim()}
                className="w-full min-h-[44px] mt-5 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {busy ? "Sending…" : selected ? `Send to ${selected}` : "Select a colleague"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
