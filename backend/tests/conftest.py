import os
import sys
import tempfile

# Add backend/ to sys.path so service imports work when pytest is run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# Deterministic, key-free test environment.
#
# These are set BEFORE any backend module (config/db/services) is imported, so
# the whole app runs in pure-heuristic mode against an isolated SQLite file:
#   - MOCK_MODE=true       → ServiceNow returns deterministic mock incidents
#   - GOOGLE_API_KEY=""    → has_google=False, so triage/RAG never call Gemini
#   - DATABASE_URL=temp    → the dev app.db (and the user's seeded world) is
#                            never touched or wiped by the test run
# config.py calls load_dotenv(override=False), so pre-setting these here means a
# local .env can never re-enable a real key or point at the real database.
# ---------------------------------------------------------------------------
os.environ["MOCK_MODE"] = "true"
os.environ["GOOGLE_API_KEY"] = ""
os.environ.setdefault(
    "DATABASE_URL",
    "sqlite:///" + os.path.join(tempfile.gettempdir(), "roche_test_app.db").replace("\\", "/"),
)

# Start every run from a clean DB file so seeding is deterministic.
_db_url = os.environ["DATABASE_URL"]
if _db_url.startswith("sqlite:///"):
    _db_path = _db_url[len("sqlite:///"):]
    try:
        if os.path.exists(_db_path):
            os.remove(_db_path)
    except OSError:
        pass

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    """A TestClient with the app's startup run once (seeds the demo world)."""
    from main import app

    with TestClient(app) as c:
        yield c
