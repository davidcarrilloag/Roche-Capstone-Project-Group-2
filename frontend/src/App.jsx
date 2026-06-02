import { Link, Route, Routes, useLocation } from "react-router-dom";
import Chat from "./pages/Chat.jsx";
import Dashboard from "./pages/Dashboard.jsx";

function NavLink({ to, children }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-md text-sm font-medium transition ${
        active
          ? "bg-roche text-white"
          : "text-roche hover:bg-roche-light"
      }`}
    >
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔬</span>
          <span className="font-semibold text-gray-800">
            Roche Scientist Assistant
          </span>
        </div>
        <nav className="flex gap-2">
          <NavLink to="/">Chat</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
