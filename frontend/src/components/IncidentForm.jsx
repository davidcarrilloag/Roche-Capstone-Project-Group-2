import { useState } from "react";
import { api } from "../api.js";

// Modal-ish form to raise a ServiceNow incident. Pre-fills the title from the
// chat context when provided (e.g. "My virtual session keeps crashing").
export default function IncidentForm({ sessionId, initialTitle = "", onClose }) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("software");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await api.createIncident(sessionId, title, description, category);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Create IT Incident
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-700">Incident created:</p>
            <p className="text-2xl font-mono font-bold text-roche my-2">
              {result.incident_number}
            </p>
            <p className="text-xs text-gray-400">
              {result.mock ? "(mock ServiceNow response)" : "live ServiceNow"}
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-roche text-white rounded-md text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Title
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-roche"
                placeholder="Short summary of the problem"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Description
              </label>
              <textarea
                required
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-roche"
                placeholder="What happened? When? Which application?"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-roche"
              >
                <option value="software">Software</option>
                <option value="hardware">Hardware</option>
                <option value="access">Access</option>
                <option value="network">Network</option>
                <option value="general">General</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-roche hover:bg-roche-dark text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create incident"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
