import { useEffect, useMemo, useState } from "react";
import { listEquipment, createBooking } from "../api.js";
import { getIdentity } from "./IdentityPicker.jsx";

const fieldClass =
  "w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-roche focus:border-transparent";

const TIMES = [];
for (let h = 8; h <= 18; h++) TIMES.push(`${String(h).padStart(2, "0")}:00`);

const DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

// Keyword → resource id, used to pre-select from the chat request.
const KEYWORDS = [
  [["centrifuge"], "centrifuge-01"],
  [["freezer", "-80", "cold storage"], "freezer-80"],
  [["pcr", "thermocycler", "thermal cycler"], "thermocycler-01"],
  [["microscope", "confocal"], "confocal-01"],
  [["plate reader", "plate-reader"], "platereader-01"],
  [["fume hood", "fumehood"], "fumehood-02"],
  [["autoclave"], "autoclave-01"],
  [["mass spec", "spectrometer"], "massspec-01"],
  // Rooms & facilities
  [["bsl-2", "bsl2", "biosafety"], "room-bsl2-c105"],
  [["cell culture suite", "culture suite"], "room-cellculture-a108"],
  [["tissue culture", "tissue room"], "room-tissue-a112"],
  [["meeting room"], "room-meeting-a200"],
  [["conference room", "conference"], "room-conference-g01"],
  [["dark room", "darkroom", "imaging room"], "room-darkroom-c118"],
];

// Local (not UTC) ISO date so we never shift a day across timezones.
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return isoLocal(d);
}

function guessEquipment(text) {
  const t = (text || "").toLowerCase();
  for (const [words, id] of KEYWORDS) {
    if (words.some((w) => t.includes(w))) return id;
  }
  return "";
}

const WEEKDAYS = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6,
};

function nextWeekday(from, dow) {
  const d = new Date(from);
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return d;
}

// Best-effort: pull a date + an on-the-hour time out of natural language.
function parseDateTime(text) {
  const t = (text || "").toLowerCase();
  let date = null;
  let time = null;

  // Time — "3pm", "3 pm", "3:30pm", "15:00", "at 2"
  const ampm = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  const h24 = t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (ampm[3] === "pm") h += 12;
    time = `${String(h).padStart(2, "0")}:00`;
  } else if (h24) {
    time = `${String(parseInt(h24[1], 10)).padStart(2, "0")}:00`;
  }

  // Date — explicit ISO wins, then today/tomorrow, then weekday names.
  const iso = t.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const today = new Date();
  if (iso) {
    date = iso[1];
  } else if (t.includes("today") || t.includes("hoy")) {
    date = isoLocal(today);
  } else if (t.includes("tomorrow") || t.includes("mañana") || t.includes("manana") || t.includes("domani") || t.includes("demain") || t.includes("morgen")) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    date = isoLocal(d);
  } else {
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      if (new RegExp(`\\b${name}\\b`).test(t)) {
        date = isoLocal(nextWeekday(today, dow));
        break;
      }
    }
  }
  return { date, time };
}

export default function BookingForm({ initialText = "", onClose }) {
  const parsed = parseDateTime(initialText);
  const [equipment, setEquipment] = useState([]);
  const [equipmentId, setEquipmentId] = useState("");
  const [date, setDate] = useState(parsed.date || tomorrowISO());
  const [time, setTime] = useState(TIMES.includes(parsed.time) ? parsed.time : "09:00");
  const [duration, setDuration] = useState(60);
  const [user, setUser] = useState(() => {
    try { return getIdentity() || localStorage.getItem("ticketCaller") || ""; } catch { return ""; }
  });
  const [result, setResult] = useState(null); // BookingResponse
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const guessedId = useMemo(() => guessEquipment(initialText), [initialText]);

  useEffect(() => {
    listEquipment()
      .then((list) => {
        setEquipment(list);
        setEquipmentId((cur) => cur || guessedId || (list[0]?.id ?? ""));
      })
      .catch(() => setError("Couldn't load the equipment list."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!equipmentId || !date || !time) return;
    setBusy(true);
    setError("");
    try {
      const res = await createBooking({
        equipment_id: equipmentId,
        date,
        time,
        duration_minutes: Number(duration),
        user: user.trim() || undefined,
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const confirmed = result && result.status === "confirmed";
  const conflict = result && result.status === "conflict";

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="incident-surface bg-white w-full sm:rounded-2xl sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Reserve a resource</h2>
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
          {confirmed ? (
            <div className="text-center py-10 px-6">
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
              <p className="font-medium text-gray-800 mb-1">Booking confirmed!</p>
              <p className="text-2xl font-mono font-bold text-roche my-3">{result.reference}</p>
              <p className="text-sm text-gray-600 mb-1">{result.equipment_name}</p>
              <p className="text-sm text-gray-600 mb-1">
                {result.date} · {result.time} · {result.duration_minutes} min
              </p>
              <p className="text-xs text-gray-400 mb-4">{result.location}</p>
              {result.calendar_link && (
                <a
                  href={result.calendar_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-roche font-medium mb-6 hover:underline"
                >
                  📅 View in Google Calendar
                </a>
              )}
              <div>
                <button
                  onClick={onClose}
                  className="min-h-[44px] px-10 bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Equipment or room <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={equipmentId}
                  onChange={(e) => setEquipmentId(e.target.value)}
                  className={fieldClass}
                >
                  {equipment.length === 0 && <option value="">Loading…</option>}
                  <optgroup label="Equipment">
                    {equipment.filter((eq) => eq.type !== "room").map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} — {eq.location}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Rooms & facilities">
                    {equipment.filter((eq) => eq.type === "room").map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} — {eq.location}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Start <span className="text-red-400">*</span>
                  </label>
                  <select
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={fieldClass}
                  >
                    {TIMES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Duration</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={fieldClass}
                  >
                    {DURATIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Your name <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    className={fieldClass}
                    placeholder="e.g. jane.doe"
                  />
                </div>
              </div>

              {conflict && (
                <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">
                  ⚠️ {result.message}
                </p>
              )}
              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
              )}

              <button
                type="submit"
                disabled={busy || !equipmentId}
                className="w-full min-h-[44px] bg-roche hover:bg-roche-dark text-white rounded-xl text-sm font-medium transition disabled:opacity-50"
              >
                {busy ? "Booking…" : "Confirm booking"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
