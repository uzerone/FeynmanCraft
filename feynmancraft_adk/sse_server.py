#!/usr/bin/env python3
"""
FastAPI SSE Server for FeynmanCraft ADK
Provides real-time event streaming with replay and heartbeat
"""

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import logging
from typing import Optional, Dict, Any
import os
from pathlib import Path
from .sse_bus import stream, publish, get_stats
from .error_handler import execute_error_action
from .tool_metrics import get_dashboard_data
from .tools.latex_compiler import get_diagram_file_path, list_cached_diagrams

logger = logging.getLogger(__name__)

# CORS whitelist as per Zhang Gong's B-B-B plan
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000", 
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    # Added for local Playwright/static test page
    "http://localhost:8088"
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifecycle management"""
    logger.info("Starting FeynmanCraft SSE Server")
    publish({
        "type": "server.ready",
        "message": "SSE server started - ready for real-time events",
        "level": 1
    })
    yield
    logger.info("Shutting down SSE Server")

# Create FastAPI app
app = FastAPI(
    title="FeynmanCraft SSE Server",
    description="Real-time event streaming for ADK workflow visualization",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS per B-B-B plan
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-Client-Origin", "Last-Event-ID", "X-Trace-Id", "X-Step-Id"],
)

def _parse_last_event_id(request: Request) -> Optional[int]:
    """Parse Last-Event-ID header for event replay"""
    lei = request.headers.get("Last-Event-ID")
    if not lei:
        return None
    try:
        return int(lei)
    except (ValueError, TypeError):
        logger.warning(f"Invalid Last-Event-ID: {lei}")
        return None

@app.get("/events")
async def events_endpoint(request: Request, since: Optional[int] = None):
    """Main SSE endpoint with replay capability"""
    try:
        # Get replay point from header or query param
        replay_since = since or _parse_last_event_id(request)
        
        async def event_stream():
            async for chunk in stream(replay_since):
                yield chunk
        
        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            }
        )
    
    except Exception as e:
        logger.error(f"Error in SSE endpoint: {e}")
        raise HTTPException(status_code=500, detail="SSE stream error")

@app.post("/emit")
async def emit_test_event(event: Dict[str, Any]):
    """Test endpoint for manual event emission"""
    try:
        publish(event)
        return {"status": "success", "message": "Event published"}
    except Exception as e:
        logger.error(f"Error emitting event: {e}")
        raise HTTPException(status_code=500, detail="Failed to emit event")


class ErrorActionRequest(BaseModel):
    action_id: str
    action_type: str
    params: Dict[str, Any] = {}


@app.post("/execute-error-action")
async def execute_error_action_endpoint(request: ErrorActionRequest):
    """Execute an error action with the given parameters"""
    try:
        result = execute_error_action(request.action_id, request.action_type, request.params)
        return result
    except Exception as e:
        logger.error(f"Error executing error action {request.action_id}: {e}")
        return {
            "success": False,
            "message": f"Failed to execute action: {str(e)}"
        }


@app.get("/health")
async def health_check():
    """Health check with detailed status"""
    stats = get_stats()
    return {
        "status": "healthy",
        "service": "FeynmanCraft SSE Server",
        "version": "1.0.0",
        **stats
    }

@app.get("/stats")
async def statistics():
    """Get detailed server statistics"""
    return get_stats()


@app.get("/dashboard-data")
async def get_dashboard_metrics():
    """Get tool orchestration dashboard data"""
    try:
        return get_dashboard_data()
    except Exception as e:
        logger.error(f"Error getting dashboard data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard data")


# Diagram File Serving Endpoints

@app.get("/diagrams/{file_id}/{file_format}")
async def get_diagram_file(file_id: str, file_format: str):
    """Serve compiled diagram files (PDF, SVG, PNG)"""
    try:
        # Validate file format
        allowed_formats = ["pdf", "svg", "png"]
        if file_format.lower() not in allowed_formats:
            raise HTTPException(status_code=400, detail=f"Unsupported format. Allowed: {', '.join(allowed_formats)}")
        
        # Get file path
        file_path = get_diagram_file_path(file_id, file_format.lower())
        
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"Diagram file not found: {file_id}.{file_format}")
        
        # Determine media type
        media_types = {
            "pdf": "application/pdf",
            "svg": "image/svg+xml", 
            "png": "image/png"
        }
        
        # Serve file with appropriate headers
        return FileResponse(
            path=file_path,
            media_type=media_types[file_format.lower()],
            headers={
                "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
                "X-File-ID": file_id,
                "X-File-Format": file_format.lower()
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving diagram file {file_id}.{file_format}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve diagram file")


@app.get("/diagrams/{file_id}/info")
async def get_diagram_info(file_id: str):
    """Get information about available formats for a diagram"""
    try:
        info = {
            "file_id": file_id,
            "available_formats": [],
            "file_sizes": {},
            "creation_time": None
        }
        
        for format_type in ["pdf", "svg", "png"]:
            file_path = get_diagram_file_path(file_id, format_type)
            if file_path and os.path.exists(file_path):
                info["available_formats"].append(format_type)
                info["file_sizes"][format_type] = os.path.getsize(file_path)
                
                # Get creation time from the first available file
                if not info["creation_time"]:
                    info["creation_time"] = os.path.getctime(file_path)
        
        if not info["available_formats"]:
            raise HTTPException(status_code=404, detail=f"No files found for diagram ID: {file_id}")
        
        return info
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting diagram info for {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get diagram info")


@app.get("/diagrams")
async def list_diagrams():
    """List all cached diagram files"""
    try:
        diagrams = list_cached_diagrams()
        return {
            "diagrams": diagrams,
            "total_count": len(diagrams)
        }
    except Exception as e:
        logger.error(f"Error listing diagrams: {e}")
        raise HTTPException(status_code=500, detail="Failed to list diagrams")


@app.delete("/diagrams/{file_id}")
async def delete_diagram(file_id: str):
    """Delete a diagram and all its associated files"""
    try:
        deleted_files = []
        
        for format_type in ["pdf", "svg", "png"]:
            file_path = get_diagram_file_path(file_id, format_type)
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                deleted_files.append(f"{file_id}.{format_type}")
        
        if not deleted_files:
            raise HTTPException(status_code=404, detail=f"No files found for diagram ID: {file_id}")
        
        return {
            "file_id": file_id,
            "deleted_files": deleted_files,
            "message": f"Deleted {len(deleted_files)} files for diagram {file_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting diagram {file_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete diagram")

# Development utilities
@app.post("/test/agent-event")
async def test_agent_event(
    agent: str = "test_agent",
    event_type: str = "transfer", 
    trace_id: str = "test-trace",
    step_id: str = "test-step"
):
    """Test agent event emission"""
    publish({
        "type": f"step.{event_type}",
        "traceId": trace_id,
        "stepId": step_id,
        "agent": agent,
        "level": 2,
        "payload": {"summary": f"Test {event_type} event from {agent}"}
    })
    return {"status": "emitted", "type": f"step.{event_type}"}

@app.post("/test/mcp-event")
async def test_mcp_event(
    tool: str = "get_property",
    status: str = "ok",
    trace_id: str = "test-trace",
    latency_ms: int = 150
):
    """Test MCP tool call event"""
    publish({
        "type": "tool.end",
        "traceId": trace_id,
        "stepId": f"step-{tool}",
        "tool": tool,
        "status": status,
        "latency_ms": latency_ms,
        "level": 2,
        "payload": {"summary": f"Test {tool} call completed"}
    })
    return {"status": "emitted", "tool": tool}

if __name__ == "__main__":
    import uvicorn
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger.info("Starting FeynmanCraft SSE Server on port 8001")
    
    # Start server
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info",
        access_log=True
    )
