import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import ChatWindow from "../components/ChatWindow.jsx";
import DocumentViewer from "../components/DocumentViewer.jsx";
import SettingsPanel from "../components/SettingsPanel.jsx";
import IdentityPicker from "../components/IdentityPicker.jsx";
import TeamSchedule from "../components/TeamSchedule.jsx";
import ColleagueInbox from "../components/ColleagueInbox.jsx";
import { getIdentity } from "../components/IdentityPicker.jsx";
import { listColleagueRequests } from "../api.js";
import rocheLogoWhite from "../assets/Roche_Logo_White.png";
import { generateTitle } from "../api.js";
import { MessageSquare, FileText, Settings, Globe, RotateCcw, Search, Menu, Sun, Moon, ChevronUp, Check, Trash2, CalendarDays, Inbox } from "lucide-react";

function genId() {
  return Math.random().toString(36).slice(2, 11);
}

const BASE_NAV_STYLE = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px 6px 9px",
  borderRadius: 6,
  border: "none",
  cursor: "pointer",
  backgroundColor: "transparent",
  color: "#FFFFFF",
  fontSize: 13,
  fontFamily: "inherit",
  textAlign: "left",
  width: "100%",
  textDecoration: "none",
  lineHeight: "1.4",
};

function NavItem({ icon, label, active, onClick, badge = 0 }) {
  const [hover, setHover] = useState(false);
  const on = active || hover;
  return (
    <button
      style={{
        ...BASE_NAV_STYLE,
        backgroundColor: on ? "rgba(255,255,255,0.15)" : "transparent",
        borderRadius: 6,
        color: on ? "#FFFFFF" : "rgba(255,255,255,0.9)",
        borderLeft: "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span style={{ display: "flex", color: on ? "#FFFFFF" : "rgba(255,255,255,0.9)" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function NavLink({ icon, label, to }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      style={{
        ...BASE_NAV_STYLE,
        display: "flex",
        backgroundColor: hover ? "rgba(255,255,255,0.15)" : "transparent",
        borderRadius: 6,
        color: hover ? "#FFFFFF" : "rgba(255,255,255,0.9)",
        borderLeft: "none",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ display: "flex", color: hover ? "#FFFFFF" : "rgba(255,255,255,0.9)" }}>{icon}</span>
      {label}
    </Link>
  );
}

function TopbarBtn({ children, title, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        border: "none",
        background: hover ? "color-mix(in srgb, var(--bg-card) 60%, transparent)" : "none",
        cursor: "pointer",
        color: hover ? "var(--text-primary)" : "var(--text-secondary)",
        borderRadius: 6,
        padding: 0,
        transition: "color 0.12s, background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Session history ──────────────────────────────────────

function groupByDate(sessions) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const today = [], yesterday = [], earlier = [];
  sessions.forEach((s) => {
    const d = new Date(s.timestamp);
    if (d >= todayStart) today.push(s);
    else if (d >= yesterdayStart) yesterday.push(s);
    else earlier.push(s);
  });

  const groups = [];
  if (today.length) groups.push({ label: "Today", sessions: today });
  if (yesterday.length) groups.push({ label: "Yesterday", sessions: yesterday });
  if (earlier.length) groups.push({ label: "Earlier", sessions: earlier });
  return groups;
}

function SessionItem({ session, active, onClick, onDelete }) {
  const [hover, setHover] = useState(false);
  const [trashHover, setTrashHover] = useState(false);
  const on = active || hover;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={session.title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        width: "100%",
        padding: "5px 6px 5px 9px",
        borderRadius: 6,
        backgroundColor: on ? "rgba(255,255,255,0.15)" : "transparent",
        color: on ? "#FFFFFF" : "rgba(255,255,255,0.9)",
        fontSize: 12,
        fontFamily: "inherit",
        cursor: "pointer",
        lineHeight: "1.6",
        transition: "background-color 0.1s, color 0.1s",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {session.title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onMouseEnter={() => setTrashHover(true)}
        onMouseLeave={() => setTrashHover(false)}
        title="Delete chat"
        aria-label="Delete chat"
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 22,
          height: 22,
          border: "none",
          background: trashHover ? "rgba(255,255,255,0.15)" : "transparent",
          cursor: "pointer",
          borderRadius: 4,
          padding: 0,
          color: trashHover ? "#FFFFFF" : "rgba(255,255,255,0.55)",
          opacity: hover ? 1 : 0,
          transition: "opacity 0.1s, color 0.1s, background-color 0.1s",
        }}
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    </div>
  );
}

// ── Documents ────────────────────────────────────────────

const DOCUMENTS = [
  {
    title: "Chemical Waste Disposal SOP",
    category: "Safety",
    version: "v2.3",
    lastUpdated: "2025-11-14",
    content: [
      { heading: "Purpose", text: "This procedure outlines the requirements for the safe collection, labeling, storage, and disposal of chemical waste generated in Roche laboratory facilities to ensure compliance with environmental regulations and personnel safety." },
      { heading: "Scope", text: "Applicable to all laboratory personnel handling chemical substances in Building A and B research areas, including visiting scientists and contractors." },
      { heading: "Waste Classification & Containers", text: "Halogenated solvents (chloroform, DCM, CCl₄) → Red container\nNon-halogenated solvents (ethanol, acetone, toluene) → Yellow container\nAqueous waste (pH 2–12) → Blue container\nAcids (pH < 2) → White container labeled \"ACID\"\nHeavy metal solutions → White container with hazard label" },
      { heading: "Collection Procedure", text: "1. Use only EHS-approved waste containers — do not reuse reagent bottles.\n2. Label each container with: waste type, date started, your name and lab.\n3. Never mix halogenated and non-halogenated solvents.\n4. Fill containers to no more than 80% capacity to allow for expansion.\n5. Keep containers sealed when not actively adding waste." },
      { heading: "Satellite Accumulation Area (SAA)", text: "Store waste at the SAA nearest to your bench. Maximum accumulation time is 3 days. Keep SAA clean, clearly labeled, and never block emergency exits. Temperature must remain between 15–25 °C away from direct sunlight or ignition sources." },
      { heading: "Requesting Waste Pickup", text: "Submit a Waste Pickup Request via ServiceNow (EHS > Waste Pickup) at least 48 hours before your container reaches capacity. Include: container count, waste type(s), SAA room number, and your contact." },
      { heading: "Spill Response", text: "Spills < 1 L: Use the spill kit located at each lab entrance. Contain, absorb, and place absorbed material in a waste bag labeled \"Contaminated Spill Waste.\"\nSpills > 1 L or unknown substances: Evacuate the area immediately and call EHS Emergency at ext. 7000 (24 h)." },
    ],
  },
  {
    title: "New Employee Onboarding Guide",
    category: "Onboarding",
    version: "v4.1",
    lastUpdated: "2025-09-03",
    content: [
      { heading: "Welcome to Roche", text: "This guide walks new laboratory employees through the steps needed to become fully operational within your first two weeks. Your manager and an assigned onboarding buddy will support you throughout this process." },
      { heading: "Week 1 Checklist", text: "□ Complete HR digital onboarding (MyHR portal) — Day 1\n□ Collect badge from Building Reception — Day 1\n□ Complete mandatory safety training: Lab Safety Basics, Chemical Handling, Emergency Procedures (iLearn platform) — by Day 3\n□ Set up lab notebook (physical or ELN) — Day 2\n□ Attend department introduction meeting — Day 2 or 3\n□ Request IT access for instruments and software — Day 1 (submit via ServiceNow)" },
      { heading: "Week 2 Checklist", text: "□ Complete GxP Awareness training if working in regulated areas\n□ Shadow at least one senior scientist per day\n□ Complete lab-specific SOP readings assigned by your manager\n□ Obtain sign-off on equipment you will operate independently\n□ Schedule 1:1 with your manager for 30-day goals" },
      { heading: "Lab Access & Badges", text: "Standard badge access is provisioned during Day 1 HR onboarding. For additional room access (cold rooms, BSL-2, controlled substance storage), submit an Access Request via ServiceNow with your manager's approval. Processing time: 2–3 business days." },
      { heading: "Required Safety Trainings", text: "Mandatory before independent lab work:\n• Lab Safety Basics (60 min, iLearn)\n• Chemical Waste Handling (30 min, iLearn)\n• Emergency Procedures & Evacuation (45 min, iLearn)\n• Biosafety Level 1 (if applicable, 90 min)\n\nAll trainings renew annually. Late renewals automatically suspend lab access until completion." },
      { heading: "Your Onboarding Buddy", text: "Your buddy is a peer scientist in your group who helps with day-to-day questions. They are not responsible for formal training but can guide you on lab culture, where to find supplies, and common workflows. Contact your manager if no buddy has been assigned." },
    ],
  },
  {
    title: "Equipment Maintenance Procedures",
    category: "Equipment",
    version: "v3.0",
    lastUpdated: "2026-01-22",
    content: [
      { heading: "Purpose", text: "To ensure all laboratory instruments are maintained in calibrated, safe, and reliable condition through a structured preventive maintenance and fault-reporting program." },
      { heading: "Maintenance Schedule", text: "Each instrument has a maintenance schedule logged in the Lab Equipment Management System (LEMS). Schedules are:\n• Daily: visual inspection, cleaning of external surfaces\n• Weekly: functional checks per instrument-specific SOP\n• Monthly: calibration verification by assigned operator\n• Annual: full calibration by certified service engineer (arranged by Facilities)" },
      { heading: "Reporting a Malfunction", text: "1. Place an \"OUT OF SERVICE\" tag on the instrument immediately.\n2. Do not attempt repairs unless you are a certified instrument operator.\n3. Submit an Equipment Fault ticket via ServiceNow (Facilities > Equipment Fault).\n4. Notify your team lead and note the issue in the equipment logbook.\n5. Critical instruments (PCR, centrifuges, biosafety cabinets): also call Facilities at ext. 5500." },
      { heading: "Calibration Records", text: "All calibration records are stored in LEMS. Before use, verify the calibration status label (green = valid, yellow = due soon, red = overdue — do not use). Overdue instruments must not be used and must be reported to Facilities." },
      { heading: "Cleaning Requirements", text: "External surfaces: 70% IPA wipe-down after each use.\nInterior surfaces (where accessible): per instrument SOP.\nBiosafety cabinets: decontaminate with 70% IPA + UV cycle after each session.\nCentrifuge rotors: inspect for corrosion monthly; replace if any pitting is observed." },
      { heading: "Approved Service Providers", text: "Only Facilities-approved vendors may service instruments under warranty or service contract. Using unauthorized technicians voids the warranty. For the current vendor list, check the Facilities SharePoint page or contact ext. 5500." },
    ],
  },
  {
    title: "Lab Consumables Ordering Guide",
    category: "Procurement",
    version: "v2.0",
    lastUpdated: "2025-08-19",
    content: [
      { heading: "Overview", text: "All laboratory consumables (tips, tubes, reagents, gloves, media) must be ordered through the approved procurement channels. Purchasing outside these channels requires prior Procurement approval and may not be reimbursed." },
      { heading: "Standard Ordering (eProcurement)", text: "1. Log in to the eProcurement portal (MyRoche > Procurement).\n2. Search for the item by catalog number or keyword.\n3. Select the approved supplier (highlighted in blue — preferred pricing).\n4. Confirm cost center with your manager before submitting.\n5. Orders under €500 are auto-approved; above €500 requires manager approval in the system." },
      { heading: "Delivery Times", text: "Standard catalog items: 1–3 business days\nSpecialty reagents (cold chain): 3–5 business days\nControlled substances: 5–10 business days + EHS import permit\nInternational suppliers: 7–14 business days\n\nExpedited delivery is available at additional cost — requires manager approval in PO comments." },
      { heading: "Stock Room Items", text: "Commonly used items (nitrile gloves S–XL, 1.5 mL tubes, tips 10–1000 µL, 15 mL and 50 mL conicals) are stocked in the Building A Stock Room (Room A-014, open 08:00–17:00). Scan your badge to log usage — this feeds directly into automatic reorder tracking." },
      { heading: "Out-of-Stock & Substitutions", text: "If an item is out of stock, the system will suggest qualified substitutes. For critical reagents (antibodies, enzymes, standards), do not substitute without consulting your team lead, as lot-to-lot variation may affect experimental validity." },
      { heading: "Returns & Discrepancies", text: "Report damaged or incorrect items within 5 business days of receipt via eProcurement > Order History > Report Issue. Do not discard damaged items before EHS or Procurement review." },
    ],
  },
  {
    title: "Cold Storage Handling Protocol",
    category: "Storage",
    version: "v1.8",
    lastUpdated: "2025-12-01",
    content: [
      { heading: "Purpose", text: "To define the requirements for the proper storage, monitoring, and incident response for biological samples, reagents, and materials requiring controlled temperature environments (+4 °C, −20 °C, −80 °C, and liquid nitrogen)." },
      { heading: "Temperature Zones", text: "+4 °C (refrigerators): short-term sample storage, buffers, antibodies in use\n−20 °C (standard freezers): enzymes, primers, working glycerol stocks, most kits\n−80 °C (ultra-low freezers): long-term cell stocks, irreplaceable samples, mRNA\nLiquid nitrogen (−196 °C): viably frozen cells, long-term biobank storage" },
      { heading: "Storage Rules", text: "• Label all items with: contents, concentration, date, your initials.\n• Never store food or beverages in laboratory refrigerators.\n• Do not overfill units — maintain at least 20% free space for air circulation.\n• Freeze-sensitive items (cells, lentivirus) must never be stored at −20 °C.\n• All −80 °C freezers and LN₂ tanks are monitored 24/7 by the BioAlarm system." },
      { heading: "Temperature Monitoring", text: "BioAlarm sends SMS and email alerts if any unit deviates by ±2 °C from set point for more than 15 minutes. Acknowledge alerts within 30 minutes. If unresolvable, call Facilities at ext. 5500 (24 h) and notify your team lead. Log all alarms in the unit's physical logbook." },
      { heading: "Freezer Failure Response", text: "1. Do NOT open the freezer door unnecessarily — this preserves temperature.\n2. Call Facilities immediately: ext. 5500.\n3. If −80 °C unit fails: a backup unit is reserved in Room B-012. Coordinate with your team lead for emergency transfer.\n4. Document all transferred samples in the Freezer Incident Log (ELN template)." },
      { heading: "Liquid Nitrogen Safety", text: "Always wear: cryogenic gloves, face shield, and lab coat when handling LN₂.\nWork in a well-ventilated area or use the fume hood for transfers.\nNever seal LN₂ in a closed container — pressure build-up can cause explosion.\nAnnual cryogenic safety training is mandatory for all LN₂ users." },
    ],
  },
];

function DocumentCard({ doc, onView }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <FileText size={20} strokeWidth={1.5} color="var(--accent)" style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>{doc.title}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              color: "var(--accent)",
              backgroundColor: "var(--accent-tint)",
              borderRadius: 4,
              padding: "2px 8px",
            }}
          >
            {doc.category}
          </span>
          {doc.version && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{doc.version}</span>
          )}
        </div>
      </div>
      <button
        onClick={onView}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          flexShrink: 0,
          padding: "6px 14px",
          fontSize: 12,
          color: hover ? "#FFFFFF" : "var(--accent)",
          backgroundColor: hover ? "var(--accent)" : "transparent",
          border: "1px solid var(--accent)",
          borderRadius: 6,
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background-color 0.12s, color 0.12s",
        }}
      >
        View
      </button>
    </div>
  );
}

function DocumentsPanel({ language, openDoc, setOpenDoc }) {
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const filtered = DOCUMENTS.filter(
    (d) =>
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  if (openDoc) {
    return (
      <DocumentViewer
        doc={openDoc}
        language={language}
        onBack={() => setOpenDoc(null)}
      />
    );
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", backgroundColor: "var(--bg-card)" }}>
      <div style={{ padding: "32px 40px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 4px" }}>
          Documents
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 24px" }}>
          Browse and search documentation
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${searchFocused ? "var(--border-focus)" : "var(--border-color)"}`,
            borderRadius: 8,
            padding: "0 12px",
            height: 40,
            backgroundColor: "var(--bg-main)",
            marginBottom: 24,
            maxWidth: 480,
            transition: "border-color 0.15s",
          }}
        >
          <Search size={15} strokeWidth={1.5} color="var(--text-muted)" style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search documents..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 13,
              fontFamily: "inherit",
              color: "var(--text-primary)",
              backgroundColor: "transparent",
            }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
          {filtered.length > 0 ? (
            filtered.map((doc) => (
              <DocumentCard key={doc.title} doc={doc} onView={() => setOpenDoc(doc)} />
            ))
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No documents match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeToggle({ darkMode, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <Sun size={12} strokeWidth={1.5} color={!darkMode ? "var(--accent)" : "var(--text-muted)"} />
      <button
        onClick={onToggle}
        title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          position: "relative",
          width: 44,
          height: 24,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          padding: 0,
          backgroundColor: darkMode ? "#0066CC" : "#D1D5DB",
          transition: "background-color 0.25s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: 3,
            width: 18,
            height: 18,
            borderRadius: "50%",
            backgroundColor: "#FFFFFF",
            transform: darkMode ? "translateX(20px)" : "translateX(0)",
            transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            display: "block",
          }}
        />
      </button>
      <Moon size={12} strokeWidth={1.5} color={darkMode ? "var(--accent)" : "var(--text-muted)"} />
    </div>
  );
}

// ── Language selector ────────────────────────────────────

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
];

function SidebarBottomBtn({ icon, label, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 40,
        padding: "0 8px",
        borderRadius: 8,
        border: "none",
        cursor: "pointer",
        backgroundColor: hover ? "rgba(255,255,255,0.08)" : "transparent",
        color: hover ? "#FFFFFF" : "rgba(255,255,255,0.7)",
        fontSize: 13,
        fontFamily: "inherit",
        transition: "background-color 0.12s, color 0.12s",
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LangOption({ lang, isActive, onSelect }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: 40,
        padding: "0 16px",
        gap: 8,
        border: "none",
        cursor: "pointer",
        backgroundColor: hover ? "rgba(0,0,0,0.05)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--text-primary)",
        fontSize: 13,
        fontFamily: "inherit",
        transition: "background-color 0.1s",
      }}
    >
      <span style={{ flex: 1, textAlign: "left" }}>{lang.label}</span>
      <span style={{ fontSize: 11, color: isActive ? "var(--accent)" : "var(--text-secondary)" }}>
        {lang.code.toUpperCase()}
      </span>
      {isActive && <Check size={13} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
    </button>
  );
}

function LanguageSelector({ language, onSelectLanguage }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const [popoverPos, setPopoverPos] = useState(null);
  const btnRef = useRef(null);
  const popoverRef = useRef(null);
  const currentLang = LANGUAGES.find((l) => l.code === language);

  function handleOpen() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.top, left: rect.left, width: rect.width });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          height: 40,
          padding: "0 8px",
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          backgroundColor: hover ? "rgba(255,255,255,0.08)" : "transparent",
          color: hover ? "#FFFFFF" : "rgba(255,255,255,0.7)",
          fontSize: 13,
          fontFamily: "inherit",
          transition: "background-color 0.12s, color 0.12s",
        }}
      >
        <Globe size={15} strokeWidth={1.5} />
        <span style={{ flex: 1, textAlign: "left" }}>{currentLang?.code.toUpperCase()}</span>
        <ChevronUp
          size={14}
          strokeWidth={1.5}
          style={{ transform: open ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
        />
      </button>
      {open && popoverPos && (
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            bottom: window.innerHeight - popoverPos.top + 4,
            left: popoverPos.left,
            width: popoverPos.width,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {LANGUAGES.map((lang) => (
            <LangOption
              key={lang.code}
              lang={lang}
              isActive={language === lang.code}
              onSelect={() => { onSelectLanguage(lang.code); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Root component ───────────────────────────────────────

export default function Chat() {
  const [language, setLanguage] = useState("en");
  const [toastDismissed, setToastDismissed] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(
    () => document.documentElement.getAttribute("data-theme") === "dark"
  );
  const [themeMode, setThemeMode] = useState(() => {
    try { return localStorage.getItem("themeMode") || (darkMode ? "dark" : "light"); }
    catch { return "light"; }
  });
  // openDoc lifted from DocumentsPanel so ChatWindow can navigate to a specific doc.
  const [openDoc, setOpenDoc] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  // Refresh the inbox badge (open questions for the current identity).
  useEffect(() => {
    const me = getIdentity();
    if (!me) {
      setInboxCount(0);
      return;
    }
    listColleagueRequests({ member: me, status: "open" })
      .then((r) => setInboxCount((r || []).length))
      .catch(() => {});
  }, [activeTab]);

  // Voice + ticket preferences (persisted in this browser).
  const [voiceEnabled, setVoiceEnabledState] = useState(() => {
    try { return localStorage.getItem("voiceEnabled") !== "false"; } catch { return true; }
  });
  const [voiceAutoSend, setVoiceAutoSendState] = useState(() => {
    try { return localStorage.getItem("voiceAutoSend") !== "false"; } catch { return true; }
  });
  const [voiceAutoSpeak, setVoiceAutoSpeakState] = useState(() => {
    try { return localStorage.getItem("voiceAutoSpeak") === "true"; } catch { return false; }
  });
  const [ticketCaller, setTicketCallerState] = useState(() => {
    try { return localStorage.getItem("ticketCaller") || ""; } catch { return ""; }
  });

  function persist(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Resolve a theme mode (light/dark/system) to an effective light/dark and apply it.
  function applyTheme(mode) {
    const effective =
      mode === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : mode;
    document.documentElement.setAttribute("data-theme", effective);
    setDarkMode(effective === "dark");
    setThemeMode(mode);
    persist("themeMode", mode);
    persist("theme", effective);
  }

  // Follow the OS theme live while in "system" mode.
  useEffect(() => {
    if (themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
      setDarkMode(e.matches);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [themeMode]);

  function toggleDarkMode() {
    applyTheme(darkMode ? "light" : "dark");
  }

  function setVoiceEnabled(v) {
    setVoiceEnabledState(v);
    persist("voiceEnabled", v ? "true" : "false");
  }
  function setVoiceAutoSend(v) {
    setVoiceAutoSendState(v);
    persist("voiceAutoSend", v ? "true" : "false");
  }
  function setVoiceAutoSpeak(v) {
    setVoiceAutoSpeakState(v);
    persist("voiceAutoSpeak", v ? "true" : "false");
  }
  function setTicketCaller(v) {
    setTicketCallerState(v);
    persist("ticketCaller", v);
  }
  function setDefaultLanguage(code) {
    setLanguage(code);
    persist("defaultLanguage", code);
  }

  function clearChatData() {
    setSessions([]);
    titledSessions.current = new Set();
    setActiveSessionId(genId());
    setActiveTab("chat");
    try { localStorage.removeItem("sa_session_id"); } catch (e) {}
  }

  // Session state — messages are stored here and passed down to ChatWindow
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(() => genId());
  const titledSessions = useRef(new Set());

  useEffect(() => {
    // A saved default wins over browser auto-detection.
    let saved = "";
    try { saved = localStorage.getItem("defaultLanguage") || ""; } catch (e) {}
    if (saved) {
      setLanguage(saved);
      return;
    }
    const browserLang = navigator.language || "";
    if (browserLang.toLowerCase().startsWith("de") && !toastDismissed) {
      setLanguage("de");
      setToastDismissed(true);
    }
  }, []);

  // Generate an AI summary title after the first complete exchange
  useEffect(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || titledSessions.current.has(session.id)) return;

    const hasUser = session.messages.some((m) => m.role === "user" && !m.isSystemDivider);
    const hasAssistant = session.messages.some((m) => m.role === "assistant" && !m.isSystemDivider);
    if (!hasUser || !hasAssistant) return;

    titledSessions.current.add(session.id);

    const payload = session.messages
      .filter((m) => !m.isSystemDivider && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({ role: m.role, text: m.text }));

    generateTitle(payload)
      .then((data) => {
        if (!data.title) return;
        setSessions((prev) => {
          const idx = prev.findIndex((s) => s.id === session.id);
          if (idx < 0) return prev;
          return [...prev.slice(0, idx), { ...prev[idx], title: data.title }, ...prev.slice(idx + 1)];
        });
      })
      .catch(() => {});
  }, [sessions, activeSessionId]);

  function toggleLanguage() {
    // Cycle through all supported languages.
    setLanguage((l) => {
      const idx = LANGUAGES.findIndex((x) => x.code === l);
      return LANGUAGES[(idx + 1) % LANGUAGES.length].code;
    });
  }

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const activeMessages = activeSession?.messages ?? [];

  // Passed to ChatWindow — mirrors the React setState signature
  function setActiveMessages(updater) {
    setSessions((prev) => {
      const current = prev.find((s) => s.id === activeSessionId);
      const currentMsgs = current?.messages ?? [];
      const newMsgs = typeof updater === "function" ? updater(currentMsgs) : updater;

      const firstUser = newMsgs.find((m) => m.role === "user");
      const title = firstUser
        ? firstUser.text.length > 45
          ? firstUser.text.slice(0, 42) + "..."
          : firstUser.text
        : "New chat";

      const updated = {
        id: activeSessionId,
        title,
        messages: newMsgs,
        timestamp: current?.timestamp ?? new Date(),
      };
      const idx = prev.findIndex((s) => s.id === activeSessionId);
      if (idx >= 0) return [...prev.slice(0, idx), updated, ...prev.slice(idx + 1)];
      return [...prev, updated];
    });
  }

  function startNewChat() {
    setActiveSessionId(genId());
    setActiveTab("chat");
  }

  function handleOpenDocument(source) {
    // Switch to the Documents tab and open the matching document if found by title.
    const match = DOCUMENTS.find(
      (d) => d.title.toLowerCase() === (source.title || "").toLowerCase()
    );
    setOpenDoc(match || null);
    setActiveTab("documents");
  }

  function loadSession(sessionId) {
    setActiveSessionId(sessionId);
    setActiveTab("chat");
  }

  function deleteSession(sessionId) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    titledSessions.current.delete(sessionId);
    // If the open chat was deleted, drop into a fresh empty chat.
    if (sessionId === activeSessionId) {
      setActiveSessionId(genId());
      setActiveTab("chat");
    }
  }

  const savedSessions = sessions.filter((s) => s.messages.some((m) => m.role === "user"));
  const sessionGroups = groupByDate(savedSessions);
  const hasHistory = sessionGroups.length > 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* ── Sidebar ───────────────────────────────── */}
      <aside
        className="sidebar"
        style={{
          width: sidebarOpen ? 240 : 0,
          flexShrink: 0,
          background: "var(--bg-sidebar)",
          borderRight: "1px solid rgba(0,26,77,0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.22s ease",
        }}
      >
        {/* Inner wrapper keeps content at full 240px even while animating */}
        <div
          style={{
            width: 240,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "16px 12px",
          }}
        >
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px", marginBottom: 12, flexShrink: 0 }}>
            <img src={rocheLogoWhite} alt="Roche" style={{ height: 22, width: "auto", display: "block", flexShrink: 0 }} />
            <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>Lab Assistant</span>
          </div>

          <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", marginBottom: 8, flexShrink: 0 }} />

          {/* Primary nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
            <NavItem
              icon={<MessageSquare size={16} strokeWidth={1.5} />}
              label="New chat"
              active={activeTab === "chat" && !activeMessages.some((m) => m.role === "user")}
              onClick={startNewChat}
            />
            <NavItem
              icon={<FileText size={16} strokeWidth={1.5} />}
              label="Documents"
              active={activeTab === "documents"}
              onClick={() => setActiveTab("documents")}
            />
            <NavItem
              icon={<CalendarDays size={16} strokeWidth={1.5} />}
              label="Team schedule"
              active={activeTab === "schedule"}
              onClick={() => setActiveTab("schedule")}
            />
            <NavItem
              icon={<Inbox size={16} strokeWidth={1.5} />}
              label="Inbox"
              active={activeTab === "inbox"}
              onClick={() => setActiveTab("inbox")}
              badge={inboxCount}
            />
          </nav>

          {/* Chat history list — scrollable, fills remaining space */}
          {hasHistory && (
            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.2)", margin: "8px 0", flexShrink: 0 }} />
          )}
          <div
            className="chat-scroll"
            style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0 }}
          >
            {sessionGroups.map((group) => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.45)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "8px 12px 3px",
                  }}
                >
                  {group.label}
                </div>
                {group.sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    active={session.id === activeSessionId && activeTab === "chat"}
                    onClick={() => loadSession(session.id)}
                    onDelete={() => deleteSession(session.id)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Bottom nav */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", margin: "8px 0" }} />
            <IdentityPicker />
            <LanguageSelector language={language} onSelectLanguage={setLanguage} />
            <SidebarBottomBtn
              icon={<Settings size={15} strokeWidth={1.5} />}
              label="Settings"
              onClick={() => setSettingsOpen(true)}
            />
          </div>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundColor: "var(--bg-main)",
          minWidth: 0,
        }}
      >
        {/* Topbar */}
        <header
          style={{
            height: 52,
            flexShrink: 0,
            backgroundColor: "var(--bg-main)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 0 0 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TopbarBtn
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setSidebarOpen((o) => !o)}
            >
              <Menu size={16} strokeWidth={1.5} />
            </TopbarBtn>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
              {activeTab === "documents" ? "Documents" : activeTab === "schedule" ? "Team schedule" : activeTab === "inbox" ? "Inbox" : "Chat"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", paddingRight: 20 }}>
            <ThemeToggle darkMode={darkMode} onToggle={toggleDarkMode} />
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeTab === "documents" ? (
            <DocumentsPanel
              language={language}
              openDoc={openDoc}
              setOpenDoc={setOpenDoc}
            />
          ) : activeTab === "schedule" ? (
            <TeamSchedule />
          ) : activeTab === "inbox" ? (
            <ColleagueInbox />
          ) : (
            <ChatWindow
              key={activeSessionId}
              sessionId={activeSessionId}
              language={language}
              messages={activeMessages}
              setMessages={setActiveMessages}
              onOpenDocument={handleOpenDocument}
              darkMode={darkMode}
              voiceEnabled={voiceEnabled}
              voiceAutoSend={voiceAutoSend}
              voiceAutoSpeak={voiceAutoSpeak}
            />
          )}
        </div>
      </main>

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          themeMode={themeMode}
          onSetTheme={applyTheme}
          language={language}
          onSetLanguage={setDefaultLanguage}
          voiceEnabled={voiceEnabled}
          onSetVoiceEnabled={setVoiceEnabled}
          voiceAutoSend={voiceAutoSend}
          onSetVoiceAutoSend={setVoiceAutoSend}
          voiceAutoSpeak={voiceAutoSpeak}
          onSetVoiceAutoSpeak={setVoiceAutoSpeak}
          ticketCaller={ticketCaller}
          onSetTicketCaller={setTicketCaller}
          onClearData={clearChatData}
        />
      )}
    </div>
  );
}
