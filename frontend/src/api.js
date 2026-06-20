const BASE_URL = import.meta.env.VITE_API_URL || "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

// Stable per-browser id so anonymous users don't all collapse into "web"
// (which would pollute the dashboard analytics).
function persistentSessionId() {
  try {
    let id = localStorage.getItem("sa_session_id");
    if (!id) {
      id = "sess-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem("sa_session_id", id);
    }
    return id;
  } catch {
    return "web";
  }
}

export function sendMessage(query, language = "en", sessionId = "", history = []) {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({
      message: query,
      language,
      session_id: sessionId || persistentSessionId(),
      history,
    }),
  });
}

export function submitFeedback(messageId, rating, comment, reason, topic) {
  const body = { message_id: messageId, rating };
  if (comment) body.comment = comment;
  if (reason) body.reason = reason;
  if (topic) body.topic = topic;
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createIncident(description, title = "Support Request", opts = {}) {
  // opts may include: category, urgency (1-3), impact (1-3), caller.
  return request("/incidents", {
    method: "POST",
    body: JSON.stringify({ description, title, ...opts }),
  });
}

// Ask the backend to classify a problem into category + severity (priority).
export function triageIncident(description, title = "") {
  return request("/incidents/triage", {
    method: "POST",
    body: JSON.stringify({ description, title }),
  });
}

export function generateTitle(messages) {
  return request("/title", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

// Lab members (synthetic identity roster)
export function listMembers() {
  return request("/members");
}

export function membersDirectory() {
  return request("/members/directory");
}

export function memberProfile(id) {
  return request(`/members/${id}/profile`);
}

// Announcements (IT → scientists broadcast)
export function listAnnouncements() {
  return request("/announcements");
}
export function createAnnouncement({ title, body, category, author }) {
  return request("/announcements", {
    method: "POST",
    body: JSON.stringify({ title, body, category, author }),
  });
}
export function retireAnnouncement(id) {
  return request(`/announcements/${id}/retire`, { method: "POST" });
}

// Ask a colleague (expert finder + routed questions)
export function suggestExperts(question) {
  return request("/experts/suggest", {
    method: "POST",
    body: JSON.stringify({ question }),
  });
}

export function createColleagueRequest({ to_member, question, from_user }) {
  return request("/colleague-requests", {
    method: "POST",
    body: JSON.stringify({ to_member, question, from_user }),
  });
}

export function listColleagueRequests({ member, from_user, status } = {}) {
  const qs = new URLSearchParams();
  if (member) qs.set("member", member);
  if (from_user) qs.set("from_user", from_user);
  if (status) qs.set("status", status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/colleague-requests${suffix}`);
}

export function answerColleagueRequest(id, answer) {
  return request(`/colleague-requests/${id}/answer`, {
    method: "POST",
    body: JSON.stringify({ answer }),
  });
}

export function scheduleMeeting({ with_member, date, time, duration_minutes, topic, from_user }) {
  return request("/meetings", {
    method: "POST",
    body: JSON.stringify({ with_member, date, time, duration_minutes, topic, from_user }),
  });
}

// Equipment booking
export function listEquipment() {
  return request("/equipment");
}

export function createBooking({ equipment_id, date, time, duration_minutes, user }) {
  return request("/bookings", {
    method: "POST",
    body: JSON.stringify({ equipment_id, date, time, duration_minutes, user }),
  });
}

export function listBookings() {
  return request("/bookings");
}

// Legacy api object — used by Dashboard and any other consumers
export const api = {
  health: () => request("/health"),
  chat: (message, sessionId, language = null) =>
    request("/chat", {
      method: "POST",
      body: JSON.stringify({ message, session_id: sessionId, language }),
    }),
  feedback: (sessionId, message, sentiment = "auto", rating = null) =>
    request("/feedback", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, message, sentiment, rating }),
    }),
  analytics: () => request("/feedback/analytics"),
  createIncident: (sessionId, title, description, category = "general") =>
    request("/incidents", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId, title, description, category }),
    }),
};
