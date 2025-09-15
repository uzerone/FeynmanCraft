"""
External Service Integrations for FeynmanCraft ADK.

This module contains integrations with external services and protocols.
"""

# Agent search integration for enhanced particle information using experimental MCP
from .agent_search_integration import (
    enhanced_agent_search_with_particle_info,
    quick_particle_validation_for_agent,
    get_diagram_relevant_particle_info
)

__all__ = [
    # Agent search integration with experimental MCP
    'enhanced_agent_search_with_particle_info',
    'quick_particle_validation_for_agent',
    'get_diagram_relevant_particle_info'
] 