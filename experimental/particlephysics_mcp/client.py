"""
ParticlePhysics MCP Client for Experimental Server
Connects to the experimental ParticlePhysics MCP Server located in this directory
Uses the standard MCP protocol for communication
"""

import json
import asyncio
import subprocess
from typing import Dict, Any, List, Optional
from pathlib import Path
import logging
import os
import math

logger = logging.getLogger(__name__)


def sanitize_for_json(obj: Any) -> Any:
    """Recursively sanitize an object to be JSON-serializable."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isinf(obj):
            return "infinity" if obj > 0 else "-infinity"
        elif math.isnan(obj):
            return "NaN"
        else:
            return obj
    else:
        return obj


class ExperimentalParticlePhysicsMCPClient:
    """Client for the Experimental ParticlePhysics MCP Server using standard MCP protocol."""
    
    def __init__(self):
        """Initialize the MCP client."""
        self.process = None
        self._reader = None
        self._writer = None
        self._request_id = 0
        self._connected = False
        self._lock = asyncio.Lock()
        
    async def connect(self):
        """Connect to the MCP server."""
        async with self._lock:
            if self._connected and self.process and self.process.returncode is None:
                return True
                
            try:
                # Get the path to the experimental server
                server_path = Path(__file__).parent / "particlephysics_mcp_server"
                
                # Start the MCP server process using the experimental version
                # Use the current Python interpreter (works in local, conda, and Docker environments)
                import sys
                python_path = sys.executable

                cmd = [
                    python_path, "-m", "particlephysics_mcp_server"
                ]
                
                logger.info(f"Starting experimental MCP server with command: {' '.join(cmd)}")
                
                self.process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env={**os.environ, "PYTHONUNBUFFERED": "1"},
                    cwd=str(server_path.parent)  # Set working directory
                )
                
                self._reader = self.process.stdout
                self._writer = self.process.stdin
                
                # Wait a moment for server to start
                await asyncio.sleep(1)
                
                # Initialize connection
                await self._initialize()
                
                self._connected = True
                logger.info("Connected to Experimental ParticlePhysics MCP Server")
                return True
                
            except Exception as e:
                logger.error(f"Failed to connect to experimental MCP server: {e}")
                await self.disconnect()
                return False
    
    async def _initialize(self):
        """Initialize the MCP connection."""
        # Send initialize request with correct protocol version
        init_request = {
            "jsonrpc": "2.0",
            "id": self._get_next_id(),
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "clientInfo": {
                    "name": "feynmancraft-adk-experimental",
                    "version": "1.0.0"
                }
            }
        }
        
        logger.debug(f"Sending initialize request: {init_request}")
        response = await self._send_request(init_request)
        
        if not response:
            raise Exception("No response to initialize request")
        
        if "error" in response:
            raise Exception(f"Initialize error: {response['error']}")
            
        logger.debug(f"Initialize response: {response}")
        
        # Send initialized notification
        initialized = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        
        await self._send_notification(initialized)
        logger.info("Experimental MCP initialization complete")
    
    def _get_next_id(self) -> int:
        """Get next request ID."""
        self._request_id += 1
        return self._request_id
    
    async def _send_notification(self, notification: Dict[str, Any]):
        """Send a notification (no response expected)."""
        if not self._writer:
            return
            
        try:
            notification_str = json.dumps(notification) + '\n'
            self._writer.write(notification_str.encode())
            await self._writer.drain()
        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
    
    async def _send_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Send a request and wait for response."""
        if not self._writer or not self._reader:
            return None
            
        try:
            # Send request
            request_str = json.dumps(request) + '\n'
            self._writer.write(request_str.encode())
            await self._writer.drain()
            
            # Read response with timeout
            try:
                response_line = await asyncio.wait_for(
                    self._reader.readline(), 
                    timeout=10.0
                )
                if response_line:
                    response = json.loads(response_line.decode())
                    logger.debug(f"Received response: {response}")
                    return response
                else:
                    logger.error("Empty response from server")
                    
            except asyncio.TimeoutError:
                logger.error("Timeout waiting for server response")
                
        except Exception as e:
            logger.error(f"Request failed: {e}")
            self._connected = False
            
        return None
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a tool on the MCP server."""
        # Ensure connected
        if not self._connected:
            success = await self.connect()
            if not success:
                return {"error": "Failed to connect to experimental MCP server"}
        
        request = {
            "jsonrpc": "2.0",
            "id": self._get_next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        logger.debug(f"Calling tool {tool_name} with args: {arguments}")
        response = await self._send_request(request)
        
        if not response:
            return {"error": "No response from server"}
        
        if "error" in response:
            logger.error(f"Tool call error: {response['error']}")
            return {"error": response["error"]}
        
        # Extract content from result
        result = response.get("result", {})
        if "content" in result:
            content = result["content"]
            if isinstance(content, list) and len(content) > 0:
                # Extract text from the first content item
                first_content = content[0]
                if isinstance(first_content, dict) and "text" in first_content:
                    try:
                        # Try to parse as JSON if it looks like structured data
                        text = first_content["text"]
                        if text.strip().startswith('{') or text.strip().startswith('['):
                            return json.loads(text)
                        else:
                            return {"result": text}
                    except json.JSONDecodeError:
                        return {"result": first_content["text"]}
        
        return result
    
    async def search_particle(self, query: str) -> Dict[str, Any]:
        """Search for particles using the experimental MCP server."""
        return await self.call_tool("search_particle", {"query": query})
    
    async def list_decays(self, particle_id: str) -> Dict[str, Any]:
        """List decay modes for a specific particle using the experimental MCP server."""
        return await self.call_tool("list_decays", {"particle_id": particle_id})
    
    async def disconnect(self):
        """Disconnect from the MCP server."""
        async with self._lock:
            self._connected = False
            
            if self._writer:
                try:
                    self._writer.close()
                    await self._writer.wait_closed()
                except Exception as e:
                    logger.error(f"Error closing writer: {e}")
                self._writer = None
            
            self._reader = None
            
            if self.process:
                try:
                    self.process.terminate()
                    await asyncio.wait_for(self.process.wait(), timeout=5.0)
                except asyncio.TimeoutError:
                    try:
                        self.process.kill()
                        await self.process.wait()
                    except Exception as e:
                        logger.error(f"Error killing process: {e}")
                except Exception as e:
                    logger.error(f"Error terminating process: {e}")
                self.process = None
            
            logger.info("Disconnected from experimental ParticlePhysics MCP Server")


# Global client instance
_experimental_client = None


async def get_experimental_mcp_client() -> ExperimentalParticlePhysicsMCPClient:
    """Get the global experimental MCP client instance."""
    global _experimental_client
    if _experimental_client is None:
        _experimental_client = ExperimentalParticlePhysicsMCPClient()
    return _experimental_client


async def search_particle_experimental(query: str, **kwargs) -> Dict[str, Any]:
    """Search for particles using the experimental MCP server."""
    try:
        client = await get_experimental_mcp_client()
        result = await client.search_particle(query)
        
        # Handle the response format
        if isinstance(result, dict) and "error" not in result:
            return result
        else:
            return result
            
    except Exception as e:
        logger.error(f"search_particle_experimental failed: {e}")
        return {"error": str(e)}


async def list_decays_experimental(particle_id: str, **kwargs) -> Dict[str, Any]:
    """List decay modes for a particle using the experimental MCP server."""
    try:
        client = await get_experimental_mcp_client()
        result = await client.list_decays(particle_id)
        
        # Handle the response format
        if isinstance(result, dict) and "error" not in result:
            return result
        else:
            return result
            
    except Exception as e:
        logger.error(f"list_decays_experimental failed: {e}")
        return {"error": str(e)}
