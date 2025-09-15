"""ParticlePhysics MCP client for FeynmanCraft ADK."""

import asyncio
import logging
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add the experimental directory to the path
experimental_path = Path(__file__).parent.parent.parent.parent / "experimental"
sys.path.insert(0, str(experimental_path))

try:
    from particlephysics_mcp import (
        search_particle_experimental,
        list_decays_experimental,
        get_experimental_mcp_client
    )
except ImportError as e:
    logging.warning(f"Could not import experimental ParticlePhysics MCP: {e}")
    # Fallback implementations
    async def search_particle_experimental(name: str) -> Dict[str, Any]:
        return {"result": f"Particle search for '{name}' (experimental MCP unavailable)"}
    
    async def list_decays_experimental(particle: str) -> Dict[str, Any]:
        return {"result": f"Decay listing for '{particle}' (experimental MCP unavailable)"}
    
    async def get_experimental_mcp_client():
        return None

logger = logging.getLogger(__name__)

async def search_particle_mcp(name: str) -> Optional[Dict[str, Any]]:
    """Search for particle information using MCP.
    
    Args:
        name: Name or symbol of the particle to search for
        
    Returns:
        Particle information dictionary or None if failed
    """
    try:
        logger.info(f"Searching for particle: {name}")
        result = await search_particle_experimental(name)
        return result
    except Exception as e:
        logger.error(f"Error searching particle '{name}': {e}")
        return None

async def get_particle_properties_mcp(name: str) -> Optional[Dict[str, Any]]:
    """Get detailed properties of a particle using MCP.
    
    Args:
        name: Name or symbol of the particle
        
    Returns:
        Particle properties dictionary or None if failed
    """
    try:
        logger.info(f"Getting properties for particle: {name}")
        result = await search_particle_experimental(name)
        return result
    except Exception as e:
        logger.error(f"Error getting properties for particle '{name}': {e}")
        return None

async def validate_quantum_numbers_mcp(particle_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Validate quantum numbers of a particle using MCP.
    
    Args:
        particle_data: Dictionary containing particle information
        
    Returns:
        Validation result dictionary or None if failed
    """
    try:
        logger.info("Validating quantum numbers")
        # For now, return a simple validation
        return {
            "valid": True,
            "message": "Quantum numbers validation (MCP integration pending)"
        }
    except Exception as e:
        logger.error(f"Error validating quantum numbers: {e}")
        return None

async def get_branching_fractions_mcp(particle: str) -> Optional[Dict[str, Any]]:
    """Get branching fractions for particle decays using MCP.
    
    Args:
        particle: Name or symbol of the particle
        
    Returns:
        Branching fractions dictionary or None if failed
    """
    try:
        logger.info(f"Getting branching fractions for: {particle}")
        result = await list_decays_experimental(particle)
        return result
    except Exception as e:
        logger.error(f"Error getting branching fractions for '{particle}': {e}")
        return None

async def compare_particles_mcp(particle1: str, particle2: str) -> Optional[Dict[str, Any]]:
    """Compare two particles using MCP.
    
    Args:
        particle1: First particle name or symbol
        particle2: Second particle name or symbol
        
    Returns:
        Comparison result dictionary or None if failed
    """
    try:
        logger.info(f"Comparing particles: {particle1} vs {particle2}")
        
        # Get both particle data
        data1 = await search_particle_experimental(particle1)
        data2 = await search_particle_experimental(particle2)
        
        return {
            "particle1": data1,
            "particle2": data2,
            "comparison": "Detailed comparison (MCP integration pending)"
        }
    except Exception as e:
        logger.error(f"Error comparing particles '{particle1}' and '{particle2}': {e}")
        return None

async def convert_units_mcp(value: float, from_unit: str, to_unit: str) -> Optional[Dict[str, Any]]:
    """Convert units using MCP.
    
    Args:
        value: Value to convert
        from_unit: Source unit
        to_unit: Target unit
        
    Returns:
        Conversion result dictionary or None if failed
    """
    try:
        logger.info(f"Converting {value} from {from_unit} to {to_unit}")
        
        # Basic conversion logic (can be enhanced with MCP)
        return {
            "original_value": value,
            "original_unit": from_unit,
            "converted_value": value,  # Placeholder
            "converted_unit": to_unit,
            "message": "Unit conversion (MCP integration pending)"
        }
    except Exception as e:
        logger.error(f"Error converting units: {e}")
        return None

async def check_particle_properties_mcp(particle: str, property_name: str) -> Optional[Dict[str, Any]]:
    """Check specific property of a particle using MCP.
    
    Args:
        particle: Name or symbol of the particle
        property_name: Name of the property to check
        
    Returns:
        Property information dictionary or None if failed
    """
    try:
        logger.info(f"Checking property '{property_name}' for particle: {particle}")
        
        # Get particle data and extract specific property
        particle_data = await search_particle_experimental(particle)
        
        return {
            "particle": particle,
            "property": property_name,
            "data": particle_data,
            "message": f"Property check for {property_name} (MCP integration)"
        }
    except Exception as e:
        logger.error(f"Error checking property '{property_name}' for particle '{particle}': {e}")
        return None