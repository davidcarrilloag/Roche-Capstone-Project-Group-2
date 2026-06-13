"""
Pydantic request/response models shared across the API.

These schemas define the contract between the frontend and backend.
Owner: PM + backend coordination.

Keep this file dependency-free (only pydantic) so every teammate can import
it without pulling in heavy services.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    """A single user turn sent to the /chat endpoint."""

    message: str = Field(
        ...,
        max_length=4000,
        description="The scientist's message / question.",
    )
    language: Optional[str] = Field(
        default=None,
        description="Preferred ISO-639-1 language code (e.g. 'en', 'de'). "
        "If omitted, the backend auto-detects it.",
    )
    session_id: Optional[str] = Field(
        default=None,
        description="Optional per-user session id so conversations persist "
        "across devices. Defaults to 'web' if omitted.",
    )
    history: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Recent conversation turns [{role: 'user'|'assistant', "
        "text: str}, ...] for follow-up context. Most recent last.",
    )


class ChatResponse(BaseModel):
    """The assistant's answer plus provenance and analysis metadata."""

    answer: str = Field(..., description="Natural-language answer for the user.")
    message_id: str = Field(
        default="",
        description="Unique id for this answer; the frontend echoes it back "
        "with thumbs feedback to correlate per-message ratings.",
    )
    source_doc: str = Field(
        default="",
        description="Filename of the document used to answer (empty if none).",
    )
    source_page: str = Field(
        default="",
        description="Chunk or page reference inside the source document.",
    )
    source_version: str = Field(
        default="",
        description="Version of the source document (from the metadata manifest).",
    )
    source_last_updated: str = Field(
        default="",
        description="Last-updated date of the source document (version awareness).",
    )
    source_date: str = Field(
        default="",
        description="Alias of source_last_updated (the frontend reads this name).",
    )
    detected_language: str = Field(
        default="en",
        description="Language the backend detected for the incoming message.",
    )
    is_feedback: bool = Field(
        default=False,
        description="True when the message was classified as feedback rather "
        "than a knowledge question.",
    )
    sentiment: Optional[str] = Field(
        default=None,
        description="Sentiment label when the message was feedback.",
    )
    confidence: Optional[str] = Field(
        default=None,
        description="Retrieval confidence: 'high' | 'medium' | 'low'.",
    )
    confidence_warning: str = Field(
        default="",
        description="A localized low-confidence note (empty when confident); "
        "the frontend can render it as a distinct banner.",
    )


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------
class FeedbackRequest(BaseModel):
    """
    Feedback from a scientist. Supports two shapes:
    - Chat thumbs:  {message_id, rating}  where rating is +1 (up) or -1 (down).
    - Explicit:     {session_id, message, sentiment, rating(1-5)}.
    All fields are optional so both the chat UI and the Dashboard can post.
    """

    session_id: Optional[str] = Field(default=None, description="Originating session id.")
    message: Optional[str] = Field(default=None, description="The raw feedback text.")
    sentiment: Optional[str] = Field(
        default=None,
        description="Sentiment label, e.g. 'frustrated', 'satisfied'. "
        "Auto-detected if omitted.",
    )
    rating: Optional[int] = Field(
        default=None,
        description="Star rating (1-5) or chat thumbs (+1 up / -1 down).",
    )
    message_id: Optional[str] = Field(
        default=None,
        description="Chat message id the thumbs rating applies to.",
    )
    reason: Optional[str] = Field(
        default=None,
        description="Structured downvote reason chip, e.g. 'Wrong information', "
        "'Source not relevant', 'Answer too vague', 'Wrong language'.",
    )
    comment: Optional[str] = Field(
        default=None,
        description="Free-text comment the scientist typed after a downvote.",
    )
    language: Optional[str] = Field(
        default=None,
        description="ISO-639-1 language of the feedback (en/de/fr/it). "
        "Auto-detected from the text if omitted.",
    )
    topic: Optional[str] = Field(
        default=None,
        description="SOP/document the rated answer was based on, e.g. "
        "'SOP-003 Material Return'. Sent by the chat UI when known.",
    )


class FeedbackResponse(BaseModel):
    """Acknowledgement returned after storing feedback."""

    status: str = Field(default="recorded")
    sentiment: str = Field(...)
    message: str = Field(default="Thank you, your feedback has been logged.")


# ---------------------------------------------------------------------------
# Incidents (ServiceNow)
# ---------------------------------------------------------------------------
class IncidentRequest(BaseModel):
    """Payload used to open a ServiceNow incident."""

    session_id: Optional[str] = Field(default=None, description="Originating session id.")
    title: str = Field(..., description="Short summary of the problem.")
    description: str = Field(..., description="Detailed description.")
    category: Optional[str] = Field(
        default="general",
        description="Incident category, e.g. 'software', 'hardware', 'access'.",
    )


class IncidentResponse(BaseModel):
    """Result of an incident creation attempt."""

    incident_number: str = Field(..., description="e.g. 'INC0012345'.")
    status: str = Field(default="created")
    title: str = Field(...)
    category: str = Field(...)
    mock: bool = Field(
        default=True,
        description="True when produced by the mock ServiceNow client.",
    )


# ---------------------------------------------------------------------------
# Title generation
# ---------------------------------------------------------------------------
class TitleRequest(BaseModel):
    messages: List[Dict[str, Any]] = Field(
        ..., description="List of {role, text} message dicts from the conversation."
    )


class TitleResponse(BaseModel):
    title: str = Field(..., description="Short generated title for the conversation.")


# ---------------------------------------------------------------------------
# Misc
# ---------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: str = Field(default="ok")
    service: str = Field(default="scientist-assistant-backend")
