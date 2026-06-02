// Tiny API client shared by all pages/components.
// In dev, requests go to "/api/*" which Vite proxies to the FastAPI backend.

const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),

  chat: (message, sessionId, language = null) =>
    request("/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        session_id: sessionId,
        language,
      }),
    }),

  feedback: (sessionId, message, sentiment = "auto", rating = null) =>
    request("/feedback", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        message,
        sentiment,
        rating,
      }),
    }),

  analytics: () => request("/feedback/analytics"),

  createIncident: (sessionId, title, description, category = "general") =>
    request("/incidents", {
      method: "POST",
      body: JSON.stringify({
        session_id: sessionId,
        title,
        description,
        category,
      }),
    }),
};
