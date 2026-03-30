"""
Agent implementations for each agent type defined in PRD Section 6.

Each agent module exports a specialised handler that extends the base
execution loop with type-specific analysis logic and prompt construction.
"""

from .personal_agent import PersonalAgent
from .team_agent import TeamAgent
from .org_agent import OrgAgent
from .voice_agent import VoiceAgent
from .calendar_agent import CalendarAgent
from .customer_health_agent import CustomerHealthAgent
from .analytics_agent import AnalyticsAgent
from .migration_agent import MigrationAgent

__all__ = [
    "PersonalAgent",
    "TeamAgent",
    "OrgAgent",
    "VoiceAgent",
    "CalendarAgent",
    "CustomerHealthAgent",
    "AnalyticsAgent",
    "MigrationAgent",
]
