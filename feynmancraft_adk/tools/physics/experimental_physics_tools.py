"""
Experimental Physics Tools for FeynmanCraft ADK.

This module provides enhanced physics calculations and validation functions using the experimental
ParticlePhysics MCP Server with improved particle search and decay analysis capabilities.
"""

import asyncio
from typing import Dict, Any, List, Optional
import logging
import sys
from pathlib import Path

# Add the project root to the path to import experimental modules
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from experimental.particlephysics_mcp import (
    search_particle_experimental,
    list_decays_experimental
)

logger = logging.getLogger(__name__)


async def search_particle_experimental_enhanced(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Enhanced particle search using experimental MCP server with better result formatting."""
    try:
        result = await search_particle_experimental(query)
        
        if "error" in result:
            return result
        
        # Parse the result text and extract particle information
        if "result" in result:
            result_text = result["result"]
            
            # Try to extract structured information from the text response
            particles = []
            if "Found particles:" in result_text:
                lines = result_text.split('\n')
                current_particle = None
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('Name:'):
                        if current_particle:
                            particles.append(current_particle)
                        current_particle = {"name": line.replace('Name:', '').strip()}
                    elif line.startswith('PDG ID:') and current_particle:
                        current_particle["pdg_id"] = line.replace('PDG ID:', '').strip()
                    elif line.startswith('Mass:') and current_particle:
                        current_particle["mass"] = line.replace('Mass:', '').strip()
                    elif line.startswith('Charge:') and current_particle:
                        current_particle["charge"] = line.replace('Charge:', '').strip()
                    elif line.startswith('Spin:') and current_particle:
                        current_particle["spin"] = line.replace('Spin:', '').strip()
                
                if current_particle:
                    particles.append(current_particle)
            
            return {
                "particles": particles[:max_results],
                "total_found": len(particles),
                "raw_result": result_text
            }
        
        return result
        
    except Exception as e:
        logger.error(f"search_particle_experimental_enhanced failed: {e}")
        return {"error": str(e)}


async def get_particle_decays_experimental(particle_name: str, limit: int = 10) -> Dict[str, Any]:
    """Get particle decay modes using experimental MCP server."""
    try:
        result = await list_decays_experimental(particle_name)
        
        if "error" in result:
            return result
        
        # Parse the result text and extract decay information
        if "result" in result:
            result_text = result["result"]
            
            # Try to extract structured decay information
            decays = []
            if "Decay modes:" in result_text:
                lines = result_text.split('\n')
                current_decay = None
                
                for line in lines:
                    line = line.strip()
                    if line.startswith('Mode:'):
                        if current_decay:
                            decays.append(current_decay)
                        current_decay = {"mode": line.replace('Mode:', '').strip()}
                    elif line.startswith('Branching ratio:') and current_decay:
                        current_decay["branching_ratio"] = line.replace('Branching ratio:', '').strip()
                    elif line.startswith('Final state:') and current_decay:
                        current_decay["final_state"] = line.replace('Final state:', '').strip()
                
                if current_decay:
                    decays.append(current_decay)
            
            return {
                "particle": particle_name,
                "decays": decays[:limit],
                "total_found": len(decays),
                "raw_result": result_text
            }
        
        return result
        
    except Exception as e:
        logger.error(f"get_particle_decays_experimental failed: {e}")
        return {"error": str(e)}


async def validate_particle_experimental(particle_name: str) -> Dict[str, Any]:
    """Validate particle existence and get basic properties using experimental MCP server."""
    try:
        # Search for the particle first
        search_result = await search_particle_experimental_enhanced(particle_name, max_results=1)
        
        if "error" in search_result:
            return {"valid": False, "error": search_result["error"]}
        
        particles = search_result.get("particles", [])
        if not particles:
            return {"valid": False, "error": f"Particle '{particle_name}' not found"}
        
        particle = particles[0]
        
        # Get decay information if available
        decay_result = await get_particle_decays_experimental(particle_name, limit=5)
        
        return {
            "valid": True,
            "particle": particle,
            "decays": decay_result.get("decays", []) if "error" not in decay_result else [],
            "search_confidence": 1.0 if len(particles) == 1 else 0.8
        }
        
    except Exception as e:
        logger.error(f"validate_particle_experimental failed: {e}")
        return {"valid": False, "error": str(e)}


async def search_particles_for_agent(particles: List[str]) -> Dict[str, Any]:
    """
    Enhanced particle search function for agent integration.
    
    This function is designed to be called by agents that need particle information
    for physics validation and diagram generation.
    """
    try:
        results = {}
        valid_particles = []
        invalid_particles = []
        
        for particle in particles:
            validation = await validate_particle_experimental(particle)
            
            if validation.get("valid", False):
                valid_particles.append({
                    "name": particle,
                    "properties": validation.get("particle", {}),
                    "decays": validation.get("decays", []),
                    "confidence": validation.get("search_confidence", 1.0)
                })
            else:
                invalid_particles.append({
                    "name": particle,
                    "error": validation.get("error", "Unknown error")
                })
        
        return {
            "valid_particles": valid_particles,
            "invalid_particles": invalid_particles,
            "total_requested": len(particles),
            "total_valid": len(valid_particles),
            "validation_success_rate": len(valid_particles) / len(particles) if particles else 0
        }
        
    except Exception as e:
        logger.error(f"search_particles_for_agent failed: {e}")
        return {"error": str(e)}


async def get_particle_interaction_info(particles: List[str]) -> Dict[str, Any]:
    """
    Get interaction information for a list of particles.
    
    This function extracts particle properties that are relevant for
    Feynman diagram generation and physics validation.
    """
    try:
        particle_info = await search_particles_for_agent(particles)
        
        if "error" in particle_info:
            return particle_info
        
        interactions = []
        for particle_data in particle_info.get("valid_particles", []):
            particle_props = particle_data.get("properties", {})
            
            interaction_info = {
                "name": particle_data["name"],
                "charge": particle_props.get("charge", "unknown"),
                "spin": particle_props.get("spin", "unknown"),
                "mass": particle_props.get("mass", "unknown"),
                "pdg_id": particle_props.get("pdg_id", "unknown"),
                "can_interact_electromagnetic": "unknown",
                "can_interact_weak": "unknown", 
                "can_interact_strong": "unknown",
                "decay_modes": len(particle_data.get("decays", [])),
                "is_stable": len(particle_data.get("decays", [])) == 0
            }
            
            # Infer interaction types based on properties
            charge = particle_props.get("charge", "")
            if "0" not in str(charge) and charge != "unknown":
                interaction_info["can_interact_electromagnetic"] = True
            elif "0" in str(charge):
                interaction_info["can_interact_electromagnetic"] = False
                
            interactions.append(interaction_info)
        
        return {
            "particles": interactions,
            "interaction_summary": {
                "electromagnetic_capable": len([p for p in interactions if p.get("can_interact_electromagnetic") == True]),
                "stable_particles": len([p for p in interactions if p.get("is_stable") == True]),
                "total_particles": len(interactions)
            }
        }
        
    except Exception as e:
        logger.error(f"get_particle_interaction_info failed: {e}")
        return {"error": str(e)}
