"""
ServiceNow incident creation + AI triage.

Owner: Backend / routes & ServiceNow client (Marcos).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from models.schemas import (
    IncidentRequest,
    IncidentResponse,
    TriageRequest,
    TriageResponse,
)
from services.servicenow import ServiceNowClient, get_servicenow_client
from services.triage import TriageService, get_triage_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["incidents"])


@router.post("/incidents/triage", response_model=TriageResponse)
def triage_incident(
    request: TriageRequest,
    triage: TriageService = Depends(get_triage_service),
) -> TriageResponse:
    """Classify a problem description into category + severity (impact/urgency)."""
    result = triage.classify(request.title or "", request.description)
    return TriageResponse(**result)


@router.post("/incidents", response_model=IncidentResponse)
def create_incident(
    request: IncidentRequest,
    client: ServiceNowClient = Depends(get_servicenow_client),
    triage: TriageService = Depends(get_triage_service),
) -> IncidentResponse:
    category = request.category or "general"
    urgency, impact = request.urgency, request.impact

    # Auto-triage severity (and category, if unspecified) from the description.
    if urgency is None or impact is None:
        t = triage.classify(request.title, request.description)
        urgency = urgency or t["urgency"]
        impact = impact or t["impact"]
        if category in (None, "", "general"):
            category = t["category"]

    result = client.create_incident(
        title=request.title,
        description=request.description,
        category=category,
        urgency=urgency,
        impact=impact,
        caller=request.caller,
        contact_type=request.contact_type,
    )
    return IncidentResponse(**result)
