"""LaTeX MCP Client for FeynmanCraft ADK."""

import aiohttp
import json
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

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

class LaTeXMCPClient:
    """LaTeX MCP 客户端"""
    
    def __init__(self, base_url: str = "http://localhost:8003"):
        self.base_url = base_url
        self.mcp_endpoint = f"{base_url}/mcp"
        
    async def compile_tikz(
        self, 
        tikz_code: str, 
        engine: str = "pdflatex",
        format: str = "both",
        timeout: int = 30
    ) -> LaTeXCompileResult:
        """
        编译TikZ代码
        
        Args:
            tikz_code: TikZ代码
            engine: LaTeX引擎 (pdflatex, lualatex)
            timeout: 超时时间
            
        Returns:
            编译结果
        """
        payload = {
            "jsonrpc": "2.0",
            "id": "tikz-compile",
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
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
                async with session.post(
                    self.mcp_endpoint,
                    json=payload,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    
                    if response.status != 200:
                        logger.error(f"MCP request failed with status {response.status}")
                        return LaTeXCompileResult(
                            status="error",
                            errors=[{"message": f"HTTP {response.status}: {await response.text()}"}],
                            warnings=[],
                            metrics={"latency_ms": 0}
                        )
                    
                    data = await response.json()
                    
                    if "error" in data:
                        logger.error(f"MCP error: {data['error']}")
                        return LaTeXCompileResult(
                            status="error",
                            errors=[{"message": str(data["error"])}],
                            warnings=[],
                            metrics={"latency_ms": 0}
                        )
                    
                    result_data = data.get("result", {})
                    
                    return LaTeXCompileResult(
                        status=result_data.get("status", "error"),
                        errors=result_data.get("errors", []),
                        warnings=result_data.get("warnings", []),
                        metrics=result_data.get("metrics", {"latency_ms": 0}),
                        artifacts=result_data.get("artifacts"),
                        file_id=result_data.get("file_id")
                    )
                    
        except aiohttp.ClientError as e:
            logger.error(f"MCP client error: {e}")
            return LaTeXCompileResult(
                status="error",
                errors=[{"message": f"Connection error: {str(e)}"}],
                warnings=[],
                metrics={"latency_ms": 0}
            )
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            return LaTeXCompileResult(
                status="error",
                errors=[{"message": f"Unexpected error: {str(e)}"}],
                warnings=[],
                metrics={"latency_ms": 0}
            )
    
    async def health_check(self) -> bool:
        """检查MCP服务是否可用"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/health") as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get("status") == "ok" and "latex_compile" in data.get("tools", [])
            return False
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False

# 全局客户端实例
latex_mcp_client = LaTeXMCPClient()

async def compile_tikz_mcp(tikz_code: str, engine: str = "pdflatex", format: str = "both") -> Dict[str, Any]:
    """
    MCP工具函数：编译TikZ代码
    
    这个函数可以被ADK智能体作为工具调用
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"compile_tikz_mcp called with engine={engine}, format={format}")
    logger.info(f"TikZ code length: {len(tikz_code)} characters")
    
    try:
        result = await latex_mcp_client.compile_tikz(tikz_code, engine, format)
        logger.info(f"latex_mcp_client.compile_tikz returned: {result}")
        
        if not result:
            logger.error("latex_mcp_client.compile_tikz returned None")
            return {
                "success": False,
                "status": "error",
                "errors": [{"message": "latex_mcp_client.compile_tikz returned None"}],
                "warnings": [],
                "compilation_time_ms": 0,
                "artifacts": None,
                "file_id": None,
                "file_urls": {},
                "latex_log": "",
                "suggestions": ["Check MCP service connectivity"]
            }
        
    except Exception as e:
        logger.error(f"Exception in compile_tikz_mcp: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "status": "error",
            "errors": [{"message": f"Exception in compile_tikz_mcp: {str(e)}"}],
            "warnings": [],
            "compilation_time_ms": 0,
            "artifacts": None,
            "file_id": None,
            "file_urls": {},
            "latex_log": "",
            "suggestions": [f"Fix exception: {type(e).__name__}"]
        }
    
    # 生成文件URL
    file_urls = {}
    if result.file_id and result.status == "ok":
        base_url = "http://localhost:8003"
        file_urls = {
            "pdf_url": f"{base_url}/files/{result.file_id}/pdf",
            "svg_url": f"{base_url}/files/{result.file_id}/svg",
            "png_url": f"{base_url}/files/{result.file_id}/png",
            "info_url": f"{base_url}/files/{result.file_id}/info"
        }
    
    # 转换为智能体友好的格式
    return {
        "success": result.status == "ok",
        "status": result.status,
        "errors": result.errors,
        "warnings": result.warnings,
        "compilation_time_ms": result.metrics.get("latency_ms", 0),
        "artifacts": result.artifacts,
        "file_id": result.file_id,
        "file_urls": file_urls,
        "latex_log": "",  # MCP版本暂不提供详细日志
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