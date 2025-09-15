from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
import os
from pathlib import Path
import hashlib
import tempfile
from typing import Dict, Any
from schemas import JsonRpcRequest, JsonRpcResponse, CompileRequest
from compiler import compile_tikz

app = FastAPI(title="Latex Compile MCP (Isolated)")

# Enable CORS for local static test page and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8088", 
        "http://127.0.0.1:8088",
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # React dev server
        "http://localhost:8000",  # ADK server
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# Store compilation results for file serving
_compilation_cache: Dict[str, Any] = {}


@app.post("/mcp")
async def mcp_endpoint(payload: dict):
    try:
        req = JsonRpcRequest(**payload)
    except ValidationError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

    if req.method != "tools/call":
        return JsonRpcResponse(id=req.id, result={"error": "Unsupported method"})

    name = (req.params or {}).get("name")
    args = (req.params or {}).get("arguments", {})

    if name != "latex_compile":
        return JsonRpcResponse(id=req.id, result={"error": f"Unknown tool: {name}"})

    try:
        compile_req = CompileRequest(**args)
        result = compile_tikz(compile_req)
        
        # Generate file ID and cache result for file serving
        if result.status == "ok" and result.artifacts:
            tikz_hash = hashlib.sha256(compile_req.tikz.encode('utf-8')).hexdigest()[:16]
            file_id = f"tikz_{tikz_hash}_{int(__import__('time').time())}"
            
            _compilation_cache[file_id] = {
                "artifacts": result.artifacts,
                "created_at": __import__('time').time(),
                "tikz_code": compile_req.tikz
            }
            
            # Add file_id to result
            result_dict = result.model_dump()
            result_dict["file_id"] = file_id
            return JsonRpcResponse(id=req.id, result=result_dict)
        
        return JsonRpcResponse(id=req.id, result=result.model_dump())
    except ValidationError as e:
        return JsonRpcResponse(id=req.id, result={"error": str(e)})


@app.get("/health")
async def health():
    return {"status": "ok", "tools": ["latex_compile"]}


@app.get("/debug/cache")
async def debug_cache():
    """Debug endpoint to inspect cache state"""
    return {
        "cache_size": len(_compilation_cache),
        "cache_keys": list(_compilation_cache.keys()),
        "cache_details": {k: {"created_at": v.get("created_at"), "has_artifacts": v.get("artifacts") is not None} for k, v in _compilation_cache.items()}
    }


@app.get("/files/{file_id}/info")
async def get_file_info(file_id: str):
    """Get information about available files"""
    if file_id not in _compilation_cache:
        raise HTTPException(status_code=404, detail=f"File ID not found: {file_id}")
    
    cached_data = _compilation_cache[file_id]
    artifacts = cached_data["artifacts"]
    
    info = {
        "file_id": file_id,
        "created_at": cached_data["created_at"],
        "available_formats": [],
        "file_sizes": {}
    }
    
    if artifacts.pdfPath and os.path.exists(artifacts.pdfPath):
        info["available_formats"].append("pdf")
        info["file_sizes"]["pdf"] = os.path.getsize(artifacts.pdfPath)
    
    if artifacts.svgPath and os.path.exists(artifacts.svgPath):
        info["available_formats"].append("svg")
        info["file_sizes"]["svg"] = os.path.getsize(artifacts.svgPath)
    
    return info


@app.get("/files/{file_id}/{file_format}")
async def get_file(file_id: str, file_format: str):
    """Serve compiled diagram files (PDF, SVG)"""
    if file_id not in _compilation_cache:
        raise HTTPException(status_code=404, detail=f"File ID not found: {file_id}")
    
    cached_data = _compilation_cache[file_id]
    artifacts = cached_data["artifacts"]
    
    if file_format.lower() == "pdf" and artifacts.pdfPath:
        if os.path.exists(artifacts.pdfPath):
            return FileResponse(
                path=artifacts.pdfPath,
                media_type="application/pdf",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "X-File-ID": file_id
                }
            )
    elif file_format.lower() == "svg" and artifacts.svgPath:
        if os.path.exists(artifacts.svgPath):
            return FileResponse(
                path=artifacts.svgPath,
                media_type="image/svg+xml",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "X-File-ID": file_id
                }
            )
    elif file_format.lower() == "png" and artifacts.pngPath:
        if os.path.exists(artifacts.pngPath):
            return FileResponse(
                path=artifacts.pngPath,
                media_type="image/png",
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "X-File-ID": file_id
                }
            )
    
    raise HTTPException(status_code=404, detail=f"File not found: {file_id}.{file_format}")


@app.get("/files")
async def list_files():
    """List all cached files"""
    files = []
    for file_id, data in _compilation_cache.items():
        artifacts = data["artifacts"]
        formats = []
        if artifacts.pdfPath and os.path.exists(artifacts.pdfPath):
            formats.append("pdf")
        if artifacts.svgPath and os.path.exists(artifacts.svgPath):
            formats.append("svg")
        if artifacts.pngPath and os.path.exists(artifacts.pngPath):
            formats.append("png")
        
        if formats:  # Only include files that actually exist
            files.append({
                "file_id": file_id,
                "created_at": data["created_at"],
                "available_formats": formats
            })
    
    return {"files": files, "total": len(files)}


if __name__ == "__main__":
    import uvicorn
    import sys
    
    port = 8003
    if "--port" in sys.argv:
        port_idx = sys.argv.index("--port")
        if port_idx + 1 < len(sys.argv):
            port = int(sys.argv[port_idx + 1])
    
    host = "127.0.0.1"
    if "--host" in sys.argv:
        host_idx = sys.argv.index("--host")
        if host_idx + 1 < len(sys.argv):
            host = sys.argv[host_idx + 1]
    
    print(f"Starting LaTeX MCP server on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
