# Copyright 2024-2025 The FeynmanCraft ADK Project Developers
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Physics Validator Agent for FeynmanCraft ADK.

This agent acts as a focused physics rule validator. It receives a physics process,
gets particle data from the ParticlePhysics MCP server, then validates the process
against physics rules in the pprules.json database using semantic search.

The agent workflow:
1. Parse natural language physics query to extract particles and processes
2. Use ParticlePhysics MCP to get detailed particle information
3. Search pprules.json for relevant physics rules
4. Validate the process against the identified rules
5. Return a comprehensive validation report

This is a streamlined version focused on rule validation rather than
comprehensive particle analysis.
"""

import logging
from typing import Dict, List, Any

from google.adk.agents import Agent

from ..models import PHYSICS_VALIDATOR_MODEL
from .physics_validator_agent_prompt import PROMPT as PHYSICS_VALIDATOR_AGENT_PROMPT

# Import physics search functionality from tools
from ..tools.physics.search import (
    search_physics_rules,
    search_rules_by_particles,
    search_rules_by_process,
    validate_process_against_rules
)

# Import experimental MCP tools for particle data retrieval
from experimental.particlephysics_mcp import (
    search_particle_experimental,
    list_decays_experimental
)

# Import agent search integration for comprehensive particle analysis


logger = logging.getLogger(__name__)


# --- Wrapper functions for agent tools ---

async def search_physics_rules_wrapper(query: str) -> List[Dict[str, Any]]:
    """
    Wrapper for search_physics_rules with default parameters.
    
    Args:
        query: Natural language query about physics rules
        
    Returns:
        List of relevant physics rules
    """
    try:
        return await search_physics_rules(query, top_k=5)
    except Exception as e:
        logger.error(f"Error in search_physics_rules_wrapper: {e}")
        return [{"error": f"Physics rules search failed: {str(e)}"}]


def search_rules_by_particles_wrapper(particles: str) -> List[Dict[str, Any]]:
    """
    Wrapper for searching rules by particles.
    
    Args:
        particles: Comma-separated list of particle names
        
    Returns:
        List of relevant physics rules
    """
    try:
        particle_list = [p.strip() for p in particles.split(',')]
        return search_rules_by_particles(particle_list, top_k=10)
    except Exception as e:
        logger.error(f"Error in search_rules_by_particles_wrapper: {e}")
        return [{"error": f"Particle rules search failed: {str(e)}"}]


def search_rules_by_process_wrapper(process_description: str) -> List[Dict[str, Any]]:
    """
    Wrapper for searching rules by process description.
    
    Args:
        process_description: Description of the physics process
        
    Returns:
        List of relevant physics rules
    """
    try:
        return search_rules_by_process(process_description, top_k=5)
    except Exception as e:
        logger.error(f"Error in search_rules_by_process_wrapper: {e}")
        return [{"error": f"Process rules search failed: {str(e)}"}]


def validate_process_wrapper(process_description: str, particles: str) -> Dict[str, Any]:
    """
    Wrapper for comprehensive process validation.
    
    Args:
        process_description: Description of the physics process
        particles: Comma-separated list of particles involved
        
    Returns:
        Validation result
    """
    try:
        particle_list = [p.strip() for p in particles.split(',')]
        return validate_process_against_rules(process_description, particle_list)
    except Exception as e:
        logger.error(f"Error in validate_process_wrapper: {e}")
        return {
            "process": process_description,
            "particles": particles,
            "error": str(e),
            "validation_status": "failed"
        }


def parse_natural_language_physics_wrapper(query: str) -> Dict[str, Any]:
    """
    Simple wrapper for parsing physics queries - focuses on extracting particles and processes.
    
    Args:
        query: Natural language physics query
        
    Returns:
        Parsed physics information focusing on particles and processes
    """
    try:
        # Simple extraction of particles and processes from query
        # This is a simplified version that focuses on what we need for rule validation
        import re
        
        # Extract common particle names
        particle_patterns = [
            r'\b(electron|positron|muon|tau|neutrino)\b',
            r'\b(photon|gamma|gluon)\b',
            r'\b(proton|neutron|pion|kaon)\b',
            r'\b(quark|up|down|strange|charm|bottom|top)\b',
            r'\b(W|Z|Higgs)\s*boson\b',
            r'\b[a-zA-Z]+\+\b|\b[a-zA-Z]+\-\b'  # charged particles
        ]
        
        particles = []
        for pattern in particle_patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            particles.extend(matches)
        
        # Extract process indicators
        process_indicators = re.findall(r'\b(decay|scattering|annihilation|production|emission|absorption)\b', query, re.IGNORECASE)
        
        return {
            'status': 'success',
            'particles': list(set(particles)),
            'processes': list(set(process_indicators)),
            'original_query': query
        }
    except Exception as e:
        logger.error(f"Error in parse_natural_language_physics_wrapper: {e}")
        return {
            'status': 'error',
            'message': str(e),
            'original_query': query
        }


# --- MCP Tool Wrappers for Particle Data Retrieval ---

async def search_particle_experimental_wrapper(query: str) -> Dict[str, Any]:
    """Wrapper for experimental MCP particle search."""
    try:
        return await search_particle_experimental(query)
    except Exception as e:
        logger.error(f"Experimental MCP search_particle failed: {e}")
        return {"error": str(e), "status": "failed"}


async def list_decays_experimental_wrapper(particle_name: str) -> Dict[str, Any]:
    """Wrapper for experimental MCP particle decay listing."""
    try:
        return await list_decays_experimental(particle_name)
    except Exception as e:
        logger.error(f"Experimental MCP list_decays failed: {e}")
        return {"error": str(e), "status": "failed"}


# --- Agent Definition ---

PhysicsValidatorAgent = Agent(
    model=PHYSICS_VALIDATOR_MODEL,  # Use gemini-2.5-pro for complex physics validation
    name="physics_validator_agent",
    description="Validates physics processes using particle data from MCP and physics rules from pprules.json. Focused on rule validation after particle data retrieval.",
    instruction=PHYSICS_VALIDATOR_AGENT_PROMPT,
    output_key="physics_validation_report",  # State management: outputs to state.physics_validation_report
    tools=[
        # Physics rules search tools - core functionality for validation
        search_physics_rules_wrapper,
        search_rules_by_particles_wrapper,
        search_rules_by_process_wrapper,
        validate_process_wrapper,
        
        # MCP tools for particle data retrieval
        search_particle_experimental_wrapper,
        list_decays_experimental_wrapper,
        
        # Simple natural language processing for query parsing
        parse_natural_language_physics_wrapper,
    ],
)