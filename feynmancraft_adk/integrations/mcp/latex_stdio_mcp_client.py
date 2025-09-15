#!/usr/bin/env python3
"""
LaTeX Stdio MCP Client for FeynmanCraft ADK
Uses stdio protocol to communicate with LaTeX MCP server
"""

import asyncio
import json
import logging
import subprocess
import uuid
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class LaTeXCompileResult:
    """LaTeX编译结果"""
    status: str
    errors: List[Dict[str, Any]]
    warnings: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    artifacts: Optional[Dict[str, Any]] = None
    file_id: Optional[str] = None

class LaTeXStdioMCPClient:
    """LaTeX Stdio MCP客户端"""
    
    def __init__(self, server_path: str = None):
        if server_path is None:
            # Default to the stdio server in experimental directory
            self.server_path = str(Path(__file__).parent.parent.parent.parent / "experimental" / "latex_mcp" / "stdio_server.py")
        else:
            self.server_path = server_path
        self.process = None
        self._lock = asyncio.Lock()
    
    async def _ensure_process(self):
        """确保MCP进程正在运行"""
        if self.process is None or self.process.returncode is not None:
            try:
                logger.info(f"Starting LaTeX MCP stdio server: {self.server_path}")
                self.process = await asyncio.create_subprocess_exec(
                    "python", self.server_path,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=str(Path(self.server_path).parent)
                )
                
                # Initialize the MCP connection
                init_request = {
                    "jsonrpc": "2.0",
                    "id": str(uuid.uuid4()),
                    "method": "initialize",
                    "params": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {
                            "name": "feynmancraft-adk",
                            "version": "1.0.0"
                        }
                    }
                }
                
                request_line = json.dumps(init_request) + "\n"
                self.process.stdin.write(request_line.encode())
                await self.process.stdin.drain()
                
                # Read initialization response
                response_line = await self.process.stdout.readline()
                if response_line:
                    response = json.loads(response_line.decode().strip())
                    logger.info(f"MCP server initialized: {response.get('result', {}).get('serverInfo', {})}")
                else:
                    raise Exception("No response from MCP server during initialization")
                    
            except Exception as e:
                logger.error(f"Failed to start MCP server: {e}")
                raise
    
    async def _send_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """发送请求到MCP服务器"""
        async with self._lock:
            await self._ensure_process()
            
            try:
                # Send request
                request_line = json.dumps(request) + "\n"
                self.process.stdin.write(request_line.encode())
                await self.process.stdin.drain()
                
                # Read response
                response_line = await asyncio.wait_for(
                    self.process.stdout.readline(), 
                    timeout=60.0  # 60 second timeout
                )
                
                if not response_line:
                    raise Exception("No response from MCP server")
                
                response = json.loads(response_line.decode().strip())
                return response
                
            except asyncio.TimeoutError:
                logger.error("MCP request timeout")
                raise
            except Exception as e:
                logger.error(f"MCP communication error: {e}")
                # Try to restart the process
                if self.process:
                    try:
                        self.process.terminate()
                        await self.process.wait()
                    except:
                        pass
                    self.process = None
                raise
    
    async def compile_tikz(
        self, 
        tikz_code: str, 
        engine: str = "pdflatex",
        format: str = "all",
        timeout: int = 30
    ) -> LaTeXCompileResult:
        """
        编译TikZ代码
        
        Args:
            tikz_code: TikZ代码
            engine: LaTeX引擎 (pdflatex, lualatex)
            format: 输出格式 (pdf, svg, png, all)
            timeout: 超时时间
            
        Returns:
            编译结果
        """
        # Convert format parameter - ADK may send "pdf,svg,png" but schema expects single values
        if format == "pdf,svg,png":
            format = "all"
        elif "," in format:
            # For other comma-separated formats, default to "all"
            format = "all"
        
        request = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "tools/call",
            "params": {
                "name": "latex_compile",
                "arguments": {
                    "tikz": tikz_code,
                    "engine": engine,
                    "format": format
                }
            }
        }
        
        try:
            logger.info(f"Sending LaTeX compilation request: engine={engine}, format={format}")
            response = await self._send_request(request)
            
            if "error" in response:
                logger.error(f"MCP error: {response['error']}")
                return LaTeXCompileResult(
                    status="error",
                    errors=[{"message": str(response["error"])}],
                    warnings=[],
                    metrics={"latency_ms": 0}
                )
            
            result_data = response.get("result", {})
            logger.info(f"MCP compilation result: status={result_data.get('status')}, latency={result_data.get('metrics', {}).get('latency_ms')}ms")
            
            return LaTeXCompileResult(
                status=result_data.get("status", "error"),
                errors=result_data.get("errors", []),
                warnings=result_data.get("warnings", []),
                metrics=result_data.get("metrics", {"latency_ms": 0}),
                artifacts=result_data.get("artifacts"),
                file_id=result_data.get("file_id")
            )
            
        except Exception as e:
            logger.error(f"LaTeX compilation failed: {e}")
            return LaTeXCompileResult(
                status="error",
                errors=[{"message": f"Communication error: {str(e)}"}],
                warnings=[],
                metrics={"latency_ms": 0}
            )
    
    async def health_check(self) -> bool:
        """检查MCP服务是否可用"""
        try:
            request = {
                "jsonrpc": "2.0",
                "id": str(uuid.uuid4()),
                "method": "tools/list",
                "params": {}
            }
            
            response = await self._send_request(request)
            
            if "error" in response:
                return False
            
            tools = response.get("result", {}).get("tools", [])
            has_latex_compile = any(tool.get("name") == "latex_compile" for tool in tools)
            return has_latex_compile
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    async def close(self):
        """关闭MCP连接"""
        if self.process and self.process.returncode is None:
            try:
                self.process.terminate()
                await self.process.wait()
            except:
                pass
            self.process = None

# 全局客户端实例
latex_stdio_mcp_client = LaTeXStdioMCPClient()

async def compile_tikz_mcp(tikz_code: str, engine: str = "pdflatex", format: str = "all") -> Dict[str, Any]:
    """
    MCP工具函数：编译TikZ代码 (stdio版本)
    
    这个函数可以被ADK智能体作为工具调用
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"compile_tikz_mcp (stdio) called with engine={engine}, format={format}")
    logger.info(f"TikZ code length: {len(tikz_code)} characters")

    # Fix double-escaped backslashes issue
    # Check if the code starts with \\d (likely \\documentclass)
    if tikz_code.startswith('\\\\'):
        logger.info("Detected double-escaped LaTeX code, fixing...")
        # Replace all double backslashes with single backslashes
        tikz_code = tikz_code.replace('\\\\', '\\')
        logger.info(f"Fixed TikZ code length: {len(tikz_code)} characters")

    try:
        logger.info(f"About to call latex_stdio_mcp_client.compile_tikz")
        result = await latex_stdio_mcp_client.compile_tikz(tikz_code, engine, format)
        logger.info(f"latex_stdio_mcp_client.compile_tikz returned: {result}")
        
        if not result:
            logger.error("latex_stdio_mcp_client.compile_tikz returned None")
            return {
                "success": False,
                "status": "error",
                "errors": [{"message": "latex_stdio_mcp_client.compile_tikz returned None"}],
                "warnings": [],
                "compilation_time_ms": 0,
                "artifacts": None,
                "file_id": None,
                "file_urls": {},
                "latex_log": "",
                "suggestions": ["Check stdio MCP service connectivity"]
            }
        
        # Check if result indicates communication failure
        if result.status == "error" and result.metrics.get("latency_ms", 0) == 0:
            logger.error(f"stdio MCP communication failure detected. Errors: {result.errors}")
            # Test direct connection
            health_ok = await latex_stdio_mcp_client.health_check()
            logger.error(f"Health check result: {health_ok}")
            
    except Exception as e:
        logger.error(f"Exception in compile_tikz_mcp (stdio): {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "status": "error",
            "errors": [{"message": f"Exception in compile_tikz_mcp (stdio): {str(e)}"}],
            "warnings": [],
            "compilation_time_ms": 0,
            "artifacts": None,
            "file_id": None,
            "file_urls": {},
            "latex_log": "",
            "suggestions": [f"Fix stdio exception: {type(e).__name__}"]
        }
    
    # 生成文件URL和文件ID
    file_urls = {}
    file_id = None
    if result.status == "ok" and result.artifacts:
        import shutil
        import hashlib
        import time
        from pathlib import Path
        
        # Generate unique file_id
        content_hash = hashlib.md5(tikz_code.encode()).hexdigest()[:16]
        timestamp = int(time.time())
        file_id = f"tikz_{content_hash}_{timestamp}"
        
        # Copy files to frontend public directory for direct access
        frontend_public_dir = Path(__file__).parent.parent.parent.parent / "frontend" / "public" / "generated"
        frontend_public_dir.mkdir(exist_ok=True)
        file_dir = frontend_public_dir / file_id
        file_dir.mkdir(exist_ok=True)
        
        artifacts_dict = result.artifacts
        if artifacts_dict.get("pdfPath"):
            pdf_dest = file_dir / "doc.pdf"
            shutil.copy2(artifacts_dict["pdfPath"], pdf_dest)
            file_urls["pdf_url"] = f"http://localhost:5174/app/generated/{file_id}/doc.pdf"
            
        if artifacts_dict.get("svgPath"):
            svg_dest = file_dir / "doc.svg"
            shutil.copy2(artifacts_dict["svgPath"], svg_dest)
            file_urls["svg_url"] = f"http://localhost:5174/app/generated/{file_id}/doc.svg"
            
        if artifacts_dict.get("pngPath"):
            png_dest = file_dir / "doc.png"
            shutil.copy2(artifacts_dict["pngPath"], png_dest)
            file_urls["png_url"] = f"http://localhost:5174/app/generated/{file_id}/doc.png"
            
        # Create a simple info structure
        file_urls["info_url"] = f"data:application/json,{{\"file_id\":\"{file_id}\",\"available_formats\":[\"pdf\",\"svg\",\"png\"],\"created_at\":{timestamp}}}"
        
        logger.info(f"Generated file_id: {file_id}, URLs: {file_urls}")
    
    # 转换为智能体友好的格式
    return {
        "success": result.status == "ok",
        "status": result.status,
        "errors": result.errors,
        "warnings": result.warnings,
        "compilation_time_ms": result.metrics.get("latency_ms", 0),
        "artifacts": result.artifacts,
        "file_id": file_id,
        "file_urls": file_urls,
        "latex_log": "",  # stdio版本暂不提供详细日志
        "suggestions": _generate_suggestions_from_errors(result.errors, result.warnings)
    }

def _generate_suggestions_from_errors(errors: List[Dict], warnings: List[Dict]) -> List[str]:
    """根据错误和警告生成修复建议"""
    suggestions = []
    
    for error in errors:
        message = error.get("message", "").lower()
        if "tikz-feynman" in message and "luatex" in message:
            suggestions.append("建议使用LuaLaTeX引擎以获得TikZ-Feynman的完整功能")
        elif "package" in message and "not found" in message:
            suggestions.append("检查是否安装了所需的LaTeX包")
        elif "undefined control sequence" in message:
            suggestions.append("检查TikZ命令拼写和语法")
    
    for warning in warnings:
        message = warning.get("message", "").lower()
        if "luatex" in message:
            suggestions.append("考虑切换到LuaLaTeX引擎获得更好的支持")
    
    return suggestions