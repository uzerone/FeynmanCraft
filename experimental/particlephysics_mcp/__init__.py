"""
Experimental ParticlePhysics MCP Server Module

This module contains the latest version of the ParticlePhysics MCP Server
and a client to connect to it for particle physics operations.
"""

from .client import (
    ExperimentalParticlePhysicsMCPClient,
    get_experimental_mcp_client,
    search_particle_experimental,
    list_decays_experimental
)

__all__ = [
    'ExperimentalParticlePhysicsMCPClient',
    'get_experimental_mcp_client', 
    'search_particle_experimental',
    'list_decays_experimental'
]
