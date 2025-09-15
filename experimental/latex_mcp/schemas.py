from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field


class CompileRequest(BaseModel):
    tikz: str = Field(..., description="TikZ or LaTeX body to compile")
    engine: Literal["lualatex", "pdflatex"] = Field(
        default="lualatex", description="LaTeX engine"
    )
    timeoutSec: int = Field(default=15, ge=1, le=120, description="Timeout seconds")
    format: Literal["pdf", "svg", "png", "both", "all"] = Field(
        default="pdf", description="Output format: pdf, svg, png, both, or all"
    )


class CompilerMessage(BaseModel):
    source: Optional[str] = None
    line: Optional[int] = None
    code: Optional[str] = None
    message: str
    suggest: Optional[str] = None


class CompileArtifacts(BaseModel):
    pdfPath: Optional[str] = None
    svgPath: Optional[str] = None
    pngPath: Optional[str] = None


class CompileMetrics(BaseModel):
    latency_ms: int
    returncode: int


class CompileResult(BaseModel):
    status: Literal["ok", "error"]
    errors: List[CompilerMessage] = []
    warnings: List[CompilerMessage] = []
    metrics: CompileMetrics
    artifacts: Optional[CompileArtifacts] = None


class JsonRpcRequest(BaseModel):
    jsonrpc: Literal["2.0"]
    id: Any
    method: str
    params: Dict[str, Any]


class JsonRpcResponse(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: Any
    result: Dict[str, Any]
