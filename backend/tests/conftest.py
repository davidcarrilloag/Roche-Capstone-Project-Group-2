import sys
import os

# Add backend/ to sys.path so service imports work when pytest is run from backend/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
