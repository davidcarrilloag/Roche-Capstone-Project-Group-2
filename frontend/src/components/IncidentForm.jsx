import { useState } from "react";
import { createIncident } from "../api.js";

export default function IncidentForm({
  initialTitle = "",
  initialDescription = "",
  onClose,
}) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await createIncident(description.trim(), title.trim());
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
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
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
                  backgroundColor: "#F0FAF0",
                  border: "1px solid #BBF7D0",
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
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent"
                  placeholder="Short summary of the issue"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Description <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent resize-none"
                  placeholder="What happened? When? Which system or equipment?"
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
