"""
Agent Search Integration for ParticlePhysics MCP.

This module provides a simplified, fast agent search that uses only the experimental
ParticlePhysics MCP server as the single source of truth for all particle information.
"""

import asyncio
import logging
from typing import Dict, Any, List, Optional

# Import experimental MCP tools - the single source of truth
import sys
from pathlib import Path

# Add experimental directory to path
experimental_path = Path(__file__).parent.parent.parent / "experimental"
if str(experimental_path) not in sys.path:
    sys.path.insert(0, str(experimental_path))

from particlephysics_mcp import (
    search_particle_experimental,
    list_decays_experimental
)

logger = logging.getLogger(__name__)


async def enhanced_agent_search_with_particle_info(
    query: str, 
    particles: Optional[List[str]] = None,
    max_kb_results: int = 5,
    max_physics_rules: int = 5
) -> Dict[str, Any]:
    """
    Simplified agent search using only ParticlePhysics MCP as the single source of truth.
    
    This function provides fast, comprehensive particle information directly from the
    ParticlePhysics MCP server without redundant local searches.
    
    Args:
        query: Natural language query or physics process description
        particles: List of particle names to analyze (optional)
        max_kb_results: Ignored (kept for compatibility)
        max_physics_rules: Ignored (kept for compatibility)
        
    Returns:
        Comprehensive particle information from MCP
    """
    try:
        results = {
            "query": query,
            "particles_requested": particles or [],
            "mcp_particle_info": [],
            "status": "success",
            "source": "ParticlePhysics MCP (experimental)"
        }
        
        # If no particles specified, try to extract common particle names from the query
        if not particles:
            particles = extract_particles_from_query(query)
            results["particles_extracted"] = particles
        
        # Get comprehensive particle information from MCP
        if particles:
            logger.info(f"Searching MCP for particles: {particles}")
            
            for particle in particles:
                try:
                    # Get basic particle information
                    particle_info = await search_particle_experimental(particle)
                    
                    # Get decay information  
                    decay_info = await list_decays_experimental(particle)
                    
                    # Combine the information
                    combined_info = {
                        "particle": particle,
                        "search_result": particle_info,
                        "decay_info": decay_info,
                        "valid": "error" not in particle_info,
                        "has_decays": "error" not in decay_info
                    }
                    
                    results["mcp_particle_info"].append(combined_info)
                    
                except Exception as e:
                    logger.error(f"MCP search failed for particle {particle}: {e}")
                    results["mcp_particle_info"].append({
                        "particle": particle,
                        "error": str(e),
                        "valid": False,
                        "has_decays": False
                    })
            
            # Summary statistics
            valid_particles = sum(1 for p in results["mcp_particle_info"] if p.get("valid", False))
            results["summary"] = {
                "total_particles": len(particles),
                "valid_particles": valid_particles,
                "success_rate": valid_particles / len(particles) if particles else 0
            }
            
            logger.info(f"MCP search completed: {valid_particles}/{len(particles)} particles found")
        
        else:
            # No particles to search for
            results["message"] = "No particles specified or extracted from query"
            logger.info("No particles to search for in MCP")
        
        return results
        
    except Exception as e:
        logger.error(f"Enhanced agent search failed: {e}")
        return {
            "query": query,
            "error": str(e),
            "status": "failed",
            "source": "ParticlePhysics MCP (experimental)"
        }


def extract_particles_from_query(query: str) -> List[str]:
    """
    Extract common particle names from a query string.
    Simple keyword-based extraction for common particles.
    """
    query_lower = query.lower()
    
    # Common particles to look for
    particle_keywords = {
        "electron": ["electron", "e-", "e+", "positron"],
        "muon": ["muon", "mu-", "mu+", "antimuon"],
        "tau": ["tau", "tau-", "tau+", "tauon"],
        "neutrino": ["neutrino", "nu_e", "nu_mu", "nu_tau"],
        "photon": ["photon", "gamma", "light"],
        "proton": ["proton", "p"],
        "neutron": ["neutron", "n"],
        "pion": ["pion", "pi+", "pi-", "pi0"],
        "kaon": ["kaon", "k+", "k-", "k0"],
        "quark": ["quark", "up", "down", "charm", "strange", "top", "bottom"],
        "gluon": ["gluon", "g"],
        "w_boson": ["w boson", "w+", "w-"],
        "z_boson": ["z boson", "z0", "z"],
        "higgs": ["higgs", "h"]
    }
    
    found_particles = []
    for particle, keywords in particle_keywords.items():
        if any(keyword in query_lower for keyword in keywords):
            found_particles.append(particle)
    
    return found_particles


async def quick_particle_validation_for_agent(particles: List[str]) -> Dict[str, Any]:
    """
    Quick particle validation using only ParticlePhysics MCP.
    
    This function provides fast validation of particles for agents that need
    to quickly check if particles exist and get basic properties.
    
    Args:
        particles: List of particle names to validate
        
    Returns:
        Quick validation results with essential information
    """
    try:
        results = {
            "particles": [],
            "valid_count": 0,
            "invalid_count": 0,
            "status": "success",
            "source": "ParticlePhysics MCP (experimental)"
        }
        
        for particle in particles:
            try:
                # Quick validation using MCP search
                validation = await search_particle_experimental(particle)
                is_valid = "error" not in validation
                
                particle_result = {
                    "name": particle,
                    "valid": is_valid,
                    "mcp_result": validation,
                    "error": validation.get("error") if not is_valid else None
                }
                
                if is_valid:
                    # Add essential properties if available
                    if "result" in validation and isinstance(validation["result"], str):
                        particle_result["description"] = validation["result"]
                    
                    # Try to get quick decay information
                    try:
                        decay_info = await list_decays_experimental(particle)
                        particle_result["has_decays"] = "error" not in decay_info
                        if particle_result["has_decays"]:
                            particle_result["decay_info"] = decay_info
                    except Exception as decay_e:
                        logger.warning(f"Failed to get decay info for {particle}: {decay_e}")
                        particle_result["has_decays"] = False
                    
                    results["valid_count"] += 1
                else:
                    results["invalid_count"] += 1
                
                results["particles"].append(particle_result)
                
            except Exception as e:
                logger.error(f"MCP validation failed for particle {particle}: {e}")
                results["particles"].append({
                    "name": particle,
                    "valid": False,
                    "error": f"MCP validation error: {str(e)}"
                })
                results["invalid_count"] += 1
        
        results["success_rate"] = results["valid_count"] / len(particles) if particles else 0
        
        logger.info(f"Quick validation completed: {results['valid_count']}/{len(particles)} particles valid")
        return results
        
    except Exception as e:
        logger.error(f"Quick particle validation failed: {e}")
        return {
            "status": "failed",
            "error": str(e),
            "source": "ParticlePhysics MCP (experimental)"
        }


async def get_diagram_relevant_particle_info(particles: List[str]) -> Dict[str, Any]:
    """
    Get particle information specifically relevant for Feynman diagram generation using only MCP.
    
    This function extracts and formats particle information in a way that's
    most useful for agents generating TikZ Feynman diagrams.
    
    Args:
        particles: List of particle names involved in the diagram
        
    Returns:
        Diagram-relevant particle information from MCP
    """
    try:
        diagram_info = {
            "particles": [],
            "total_particles": len(particles),
            "valid_particles": 0,
            "particles_with_decays": 0,
            "diagram_hints": [],
            "source": "ParticlePhysics MCP (experimental)"
        }
        
        # Get comprehensive particle information using MCP
        for particle in particles:
            try:
                # Get particle search and decay information
                search_result = await search_particle_experimental(particle)
                decay_result = await list_decays_experimental(particle)
                
                is_valid = "error" not in search_result
                has_decays = "error" not in decay_result
                
                particle_summary = {
                    "name": particle,
                    "valid": is_valid,
                    "has_decays": has_decays,
                    "mcp_search_result": search_result,
                    "mcp_decay_result": decay_result
                }
                
                # Add description if available
                if is_valid and "result" in search_result:
                    particle_summary["description"] = search_result["result"]
                
                # Add decay information if available
                if has_decays and "result" in decay_result:
                    particle_summary["decay_info"] = decay_result["result"]
                
                diagram_info["particles"].append(particle_summary)
                
                # Update counters
                if is_valid:
                    diagram_info["valid_particles"] += 1
                if has_decays:
                    diagram_info["particles_with_decays"] += 1
                    
            except Exception as e:
                logger.error(f"Failed to get MCP info for particle {particle}: {e}")
                diagram_info["particles"].append({
                    "name": particle,
                    "valid": False,
                    "has_decays": False,
                    "error": str(e)
                })
        
        # Generate diagram hints based on MCP results
        valid_count = diagram_info["valid_particles"]
        decay_count = diagram_info["particles_with_decays"]
        
        if valid_count > 0:
            diagram_info["diagram_hints"].append(
                f"Found complete MCP information for {valid_count}/{len(particles)} particles"
            )
        
        if decay_count > 0:
            diagram_info["diagram_hints"].append(
                f"{decay_count} particles have decay information available"
            )
            
        if valid_count == len(particles):
            diagram_info["diagram_hints"].append("All particles validated - ready for diagram generation")
        elif valid_count > 0:
            diagram_info["diagram_hints"].append("Partial particle information - diagram generation may be limited")
        else:
            diagram_info["diagram_hints"].append("No valid particle information found")
        
        # Add success metrics
        diagram_info["success_rate"] = valid_count / len(particles) if particles else 0
        diagram_info["decay_coverage"] = decay_count / len(particles) if particles else 0
        
        logger.info(f"Diagram info: {valid_count}/{len(particles)} valid, {decay_count} with decays")
        return diagram_info
        
    except Exception as e:
        logger.error(f"Diagram particle info extraction failed: {e}")
        return {
            "error": str(e),
            "source": "ParticlePhysics MCP (experimental)",
            "status": "failed"
        }
