"""
ServiceNow incident creation endpoint.

Owner: Backend / routes & ServiceNow client.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from models.schemas import IncidentRequest, IncidentResponse
from services.servicenow import ServiceNowClient, get_servicenow_client

logger = logging.getLogger(__name__)
router = APIRouter(tags=["incidents"])


@router.post("/incidents", response_model=IncidentResponse)
async def create_incident(
    request: IncidentRequest,
    client: ServiceNowClient = Depends(get_servicenow_client),
) -> IncidentResponse:
    result = client.create_incident(
        title=request.title,
        description=request.description,
        category=request.category or "general",
    )
    return IncidentResponse(**result)
