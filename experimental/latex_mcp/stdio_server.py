#!/usr/bin/env python3
"""
LaTeX MCP Server - stdio version
Provides LaTeX compilation services via MCP stdio protocol
"""

import asyncio
import json
import sys
import logging
from typing import Dict, Any
from pathlib import Path

# Import existing compilation logic
from compiler import compile_tikz
from schemas import CompileRequest

# Configure logging to stderr (stdio MCP servers should use stderr for logging)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

class StdioMCPServer:
    """Stdio MCP Server for LaTeX compilation"""
    
    def __init__(self):
        self.tools = {
            "latex_compile": {
                "description": "Compile LaTeX TikZ code to PDF, SVG, and PNG",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "tikz": {
                            "type": "string",
                            "description": "TikZ code to compile"
                        },
                        "engine": {
                            "type": "string", 
                            "description": "LaTeX engine (pdflatex or lualatex)",
                            "default": "lualatex"
                        },
                        "format": {
                            "type": "string",
                            "description": "Output format (pdf, svg, png, or all)",
                            "default": "all"
                        }
                    },
                    "required": ["tikz"]
                }
            }
        }
    
    async def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle incoming MCP request"""
        try:
            method = request.get("method")
            params = request.get("params", {})
            
            if method == "tools/list":
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "tools": [
                            {
                                "name": name,
                                "description": tool["description"],
                                "inputSchema": tool["inputSchema"]
                            }
                            for name, tool in self.tools.items()
                        ]
                    }
                }
            
            elif method == "tools/call":
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                
                if tool_name == "latex_compile":
                    result = await self.latex_compile_tool(arguments)
                    return {
                        "jsonrpc": "2.0",
                        "id": request.get("id"),
                        "result": result
                    }
                else:
                    return {
                        "jsonrpc": "2.0",
                        "id": request.get("id"),
                        "error": {
                            "code": -32601,
                            "message": f"Unknown tool: {tool_name}"
                        }
                    }
            
            elif method == "initialize":
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "serverInfo": {
                            "name": "latex-mcp-server",
                            "version": "1.0.0"
                        }
                    }
                }
            
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "error": {
                        "code": -32601,
                        "message": f"Unknown method: {method}"
                    }
                }
                
        except Exception as e:
            logger.error(f"Error handling request: {e}")
            return {
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {
                    "code": -32603,
                    "message": f"Internal error: {str(e)}"
                }
            }
    
    async def latex_compile_tool(self, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """LaTeX compilation tool implementation"""
        try:
            tikz_code = arguments.get("tikz", "")
            engine = arguments.get("engine", "lualatex")
            format_type = arguments.get("format", "all")
            
            logger.info(f"Compiling TikZ code with engine={engine}, format={format_type}")
            logger.info(f"TikZ code length: {len(tikz_code)} characters")
            
            if not tikz_code:
                return {
                    "status": "error",
                    "errors": [{"message": "No TikZ code provided"}],
                    "warnings": [],
                    "metrics": {"latency_ms": 0}
                }
            
            # Create CompileRequest object
            compile_request = CompileRequest(
                tikz=tikz_code,
                engine=engine,
                format=format_type
            )
            
            # Use existing compiler
            start_time = asyncio.get_event_loop().time()
            compile_result = compile_tikz(compile_request)  # Note: this is synchronous
            end_time = asyncio.get_event_loop().time()
            
            latency_ms = int((end_time - start_time) * 1000)
            
            if compile_result.status == "ok":
                artifacts_dict = {}
                if compile_result.artifacts:
                    artifacts_dict = {
                        "pdfPath": compile_result.artifacts.pdfPath,
                        "svgPath": compile_result.artifacts.svgPath, 
                        "pngPath": compile_result.artifacts.pngPath
                    }
                
                return {
                    "status": "ok",
                    "errors": [error.dict() for error in compile_result.errors],
                    "warnings": [warning.dict() for warning in compile_result.warnings],
                    "metrics": {
                        "latency_ms": latency_ms, 
                        "returncode": compile_result.metrics.returncode
                    },
                    "artifacts": artifacts_dict,
                    "file_id": None  # Generate file_id if needed
                }
            else:
                return {
                    "status": "error",
                    "errors": [error.dict() for error in compile_result.errors],
                    "warnings": [warning.dict() for warning in compile_result.warnings],
                    "metrics": {
                        "latency_ms": latency_ms, 
                        "returncode": compile_result.metrics.returncode
                    }
                }
                
        except Exception as e:
            logger.error(f"LaTeX compilation error: {e}")
            return {
                "status": "error", 
                "errors": [{"message": f"Compilation error: {str(e)}"}],
                "warnings": [],
                "metrics": {"latency_ms": 0, "returncode": 1}
            }

    async def run(self):
        """Main server loop"""
        logger.info("LaTeX MCP stdio server starting...")
        
        try:
            while True:
                line = await asyncio.get_event_loop().run_in_executor(
                    None, sys.stdin.readline
                )
                
                if not line:
                    break
                    
                line = line.strip()
                if not line:
                    continue
                
                try:
                    request = json.loads(line)
                    response = await self.handle_request(request)
                    print(json.dumps(response), flush=True)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {e}")
                    error_response = {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {
                            "code": -32700,
                            "message": "Parse error"
                        }
                    }
                    print(json.dumps(error_response), flush=True)
                    
        except KeyboardInterrupt:
            logger.info("Server shutdown requested")
        except Exception as e:
            logger.error(f"Server error: {e}")

async def main():
    server = StdioMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())