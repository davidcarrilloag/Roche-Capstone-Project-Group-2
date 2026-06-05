// Renders a single chat message. User messages are right-aligned; assistant
// messages are left-aligned and may show a source citation + confidence.

export default function MessageBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-roche text-white rounded-br-sm"
            : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
        }`}
      >
        <div>{message.text}</div>

        {/* Source citation (assistant + RAG answers only) */}
        {!isUser && message.source_doc && (
          <div className="mt-2 text-xs text-gray-500 border-t border-gray-100 pt-1">
            📄 Source: <span className="font-medium">{message.source_doc}</span>
            {message.source_page !== "" && message.source_page != null
              ? ` (ref ${message.source_page})`
              : ""}
            {message.source_last_updated
              ? ` · updated ${message.source_last_updated}`
              : ""}
            {message.source_version
              ? ` · v${message.source_version}`
              : ""}
            {message.confidence && (
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                  message.confidence === "high"
                    ? "bg-green-100 text-green-700"
                    : message.confidence === "medium"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {message.confidence}
              </span>
            )}
          </div>
        )}

        {/* Feedback acknowledgement marker */}
        {!isUser && message.is_feedback && (
          <div className="mt-2 text-xs text-purple-600">
            💬 Logged as feedback{message.sentiment ? ` · ${message.sentiment}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
