import { useEffect, useState } from "react";
import { suggestExperts, createColleagueRequest, scheduleMeeting } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";
import { Users, Check, MessageSquare, CalendarPlus } from "lucide-react";

const TIMES = [];
for (let h = 8; h <= 18; h++) TIMES.push(`${String(h).padStart(2, "0")}:00`);

const DURATIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
];

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const fieldClass =
  "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent";

export default function AskColleagueModal({ question = "", onClose, lockedMember = "", initialMode = "ask" }) {
  const [mode, setMode] = useState(initialMode); // ask | meet
  const [experts, setExperts] = useState([]);
  const [selected, setSelected] = useState(lockedMember || "");
  const [text, setText] = useState(question);
  const [date, setDate] = useState(tomorrowISO());
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { kind, ... }
  const [error, setError] = useState("");

  useEffect(() => {
    if (lockedMember) {
      setSelected(lockedMember);
      setLoading(false);
      return;
    }
    suggestExperts(question)
      .then((list) => {
        setExperts(list || []);
        if (list && list[0]) setSelected(list[0].name);
      })
      .catch(() => setError("Couldn't load experts."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendQuestion() {
    if (!selected || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createColleagueRequest({ to_member: selected, question: text.trim(), from_user: getIdentity() || undefined });
      setResult({ kind: "asked", who: selected });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function bookMeeting() {
    if (!selected || !date || !time) return;
    setBusy(true);
    setError("");
    try {
      const res = await scheduleMeeting({
        with_member: selected,
        date,
        time,
        duration_minutes: Number(duration),
        topic: text.trim() || undefined,
        from_user: getIdentity() || undefined,
      });
      setResult({ kind: "met", who: selected, ...res });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function Tab({ id, icon: Icon, label }) {
    const active = mode === id;
    return (
      <button
        onClick={() => setMode(id)}
        style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px", borderRadius: 7, border: "none", cursor: "pointer", fontFamily: "inherit",
          fontSize: 12.5, fontWeight: 500,
          backgroundColor: active ? "var(--bg-card)" : "transparent",
          color: active ? "var(--accent)" : "var(--text-secondary)",
          boxShadow: active ? "var(--shadow-card)" : "none",
        }}
      >
        <Icon size={14} /> {label}
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="incident-surface bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users size={17} strokeWidth={1.75} /> Ask a colleague
          </h2>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100 transition" aria-label="Close">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          {result ? (
            <div className="text-center py-8">
              <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: "var(--accent-tint)", border: "1px solid var(--accent-tint-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#16A34A", fontSize: 18 }}>✓</div>
              {result.kind === "asked" ? (
                <>
                  <p className="font-medium text-gray-800 mb-1">Question sent to {result.who}</p>
                  <p className="text-xs text-gray-400 mb-8">They'll see it in their inbox and can reply.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-800 mb-1">Meeting scheduled with {result.who}</p>
                  <p className="text-sm text-gray-600 mb-1">{result.date} · {result.time} · {result.duration_minutes} min</p>
                  {result.calendar_link ? (
                    <a href={result.calendar_link} target="_blank" rel="noreferrer" className="inline-block text-sm text-roche font-medium mb-8 hover:underline">📅 View in Google Calendar</a>
                  ) : (
                    <p className="text-xs text-gray-400 mb-8">(Calendar not configured — the meeting wasn't added to a calendar.)</p>
                  )}
                </>
              )}
              <div>
                <button onClick={onClose} className="min-h-[44px] px-10 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition">Done</button>
              </div>
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 9, backgroundColor: "var(--bg-main)", border: "1px solid var(--border-color)", marginBottom: 16 }}>
                <Tab id="ask" icon={MessageSquare} label="Ask a question" />
                <Tab id="meet" icon={CalendarPlus} label="Schedule a meeting" />
              </div>

              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {mode === "ask" ? "Your question" : "Topic"}
              </label>
              <textarea
                rows={mode === "ask" ? 3 : 2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={mode === "ask" ? "" : "What's the meeting about?"}
                className={`${fieldClass} resize-none mb-4`}
              />

              {/* Meeting time pickers */}
              {mode === "meet" && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Time</label>
                    <select value={time} onChange={(e) => setTime(e.target.value)} className={fieldClass}>
                      {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Length</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className={fieldClass}>
                      {DURATIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                {lockedMember ? "To" : mode === "ask" ? "Suggested colleagues" : "Meet with"}
              </label>
              {lockedMember && (
                <div className="rounded-xl px-3 py-2.5 text-sm font-medium text-gray-900" style={{ border: "1px solid var(--accent)", backgroundColor: "var(--accent-tint)" }}>
                  {lockedMember}
                </div>
              )}
              {!lockedMember && loading && <p className="text-sm text-gray-400 py-2">Finding the right expert…</p>}
              {!lockedMember && !loading && experts.length === 0 && (
                <p className="text-sm text-gray-500 py-2">No specific expert matched — refine your question or pick anyone.</p>
              )}
              <div className="space-y-2">
                {!lockedMember && experts.map((ex) => {
                  const active = selected === ex.name;
                  return (
                    <button key={ex.name} onClick={() => setSelected(ex.name)} className="w-full text-left rounded-xl px-3 py-2.5 transition flex items-center gap-3" style={{ border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`, backgroundColor: active ? "var(--accent-tint)" : "transparent" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-sm font-medium text-gray-900">{ex.name}</div>
                        <div className="text-xs text-gray-500">{ex.role} · {ex.team} — {ex.expertise}</div>
                        {ex.matched_on && <div className="text-[11px] mt-0.5" style={{ color: "var(--accent)" }}>matches: {ex.matched_on}</div>}
                      </div>
                      {active && <Check size={15} strokeWidth={2.5} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl mt-4">{error}</p>}

              {mode === "ask" ? (
                <button onClick={sendQuestion} disabled={busy || !selected || !text.trim()} className="w-full min-h-[44px] mt-5 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50">
                  {busy ? "Sending…" : selected ? `Send to ${selected}` : "Select a colleague"}
                </button>
              ) : (
                <button onClick={bookMeeting} disabled={busy || !selected} className="w-full min-h-[44px] mt-5 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50">
                  {busy ? "Scheduling…" : selected ? `Schedule with ${selected}` : "Select a colleague"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
