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

export function sendMessage(query, language = "en") {
  return request("/chat", {
    method: "POST",
    body: JSON.stringify({ message: query, language }),
  });
}

export function submitFeedback(messageId, rating) {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify({ message_id: messageId, rating }),
  });
}

export function createIncident(description, title = "Support Request") {
  return request("/incidents", {
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
