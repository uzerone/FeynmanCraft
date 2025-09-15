#!/usr/bin/env python3
"""
Event Bridge for FeynmanCraft ADK
Provides minimal-intrusion wrapper/decorator injection for SSE events
Following Zhang Gong's B-B-B plan: wrapper injection, Level 2 events
"""

import time
import functools
import logging
import uuid
from typing import Dict, Any, Optional, Callable
from .sse_bus import publish

logger = logging.getLogger(__name__)

# Event level configuration (Zhang Gong's B-B-B plan: Level 2 default)
EVENT_LEVEL = 2  # 1=core milestones, 2=core+MCP, 3=debug

def generate_trace_id() -> str:
    """Generate short trace ID for correlation"""
    return f"tr-{str(uuid.uuid4())[:8]}"

def generate_step_id() -> str:
    """Generate short step ID for workflow stages"""
    return f"st-{str(uuid.uuid4())[:8]}"

def emit_step(step_type: str, **kwargs) -> None:
    """Emit workflow step event"""
    event = {
        "type": f"step.{step_type}",
        "level": EVENT_LEVEL,
        **kwargs
    }
    publish(event)
    logger.debug(f"Emitted step event: {step_type}")

def emit_tool_start(trace_id: str, step_id: str, tool: str, session_id: Optional[str] = None, **kwargs) -> float:
    """Emit MCP tool start event and return start time"""
    start_time = time.time()
    event = {
        "type": "tool.start",
        "traceId": trace_id,
        "stepId": step_id, 
        "tool": tool,
        "status": "running",
        "level": EVENT_LEVEL,
        "ts": start_time,
        **kwargs
    }
    if session_id:
        event["sessionId"] = session_id
    
    publish(event)
    logger.debug(f"Tool {tool} started with trace {trace_id[:8]}")
    return start_time

def emit_tool_end(
    success: bool, 
    start_time: float, 
    trace_id: str, 
    step_id: str, 
    tool: str, 
    session_id: Optional[str] = None,
    error_msg: Optional[str] = None,
    **kwargs
) -> None:
    """Emit MCP tool completion event"""
    end_time = time.time()
    latency_ms = int((end_time - start_time) * 1000)
    
    event = {
        "type": "tool.end",
        "traceId": trace_id,
        "stepId": step_id,
        "tool": tool,
        "status": "ok" if success else "err",
        "latency_ms": latency_ms,
        "level": EVENT_LEVEL,
        "ts": end_time,
        **kwargs
    }
    
    if session_id:
        event["sessionId"] = session_id
    if error_msg:
        event["payload"] = {"error": str(error_msg)[:200]}  # Truncate long errors
    
    publish(event)
    logger.debug(f"Tool {tool} {'completed' if success else 'failed'} in {latency_ms}ms")

def emit_agent_transfer(from_agent: str, to_agent: str, trace_id: str, session_id: Optional[str] = None) -> None:
    """Emit agent transfer event"""
    event = {
        "type": "step.transfer",
        "traceId": trace_id,
        "stepId": generate_step_id(),
        "agent": from_agent,
        "status": "running",
        "level": EVENT_LEVEL,
        "payload": {"summary": f"Transferring to {to_agent}"}
    }
    
    if session_id:
        event["sessionId"] = session_id
        
    publish(event)
    logger.debug(f"Agent transfer: {from_agent} -> {to_agent}")

def emit_workflow_stage(stage: str, agent: str, trace_id: str, status: str = "running", **kwargs) -> None:
    """Emit workflow stage event"""
    event = {
        "type": f"step.{stage.lower()}",
        "traceId": trace_id,
        "stepId": generate_step_id(),
        "agent": agent,
        "status": status,
        "level": EVENT_LEVEL,
        **kwargs
    }
    
    publish(event)
    logger.debug(f"Workflow stage: {agent} -> {stage}")

# Decorator for instrumenting MCP calls (minimal intrusion approach)
def instrument_mcp_call(func: Callable) -> Callable:
    """
    Decorator to instrument MCP tool calls with SSE events
    Usage: @instrument_mcp_call on any function that calls MCP tools
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        # Extract common parameters
        tool = kwargs.get('tool') or (args[0] if args else 'unknown_tool')
        trace_id = kwargs.get('trace_id') or generate_trace_id()
        step_id = kwargs.get('step_id') or generate_step_id()
        session_id = kwargs.get('session_id')
        
        # Emit start event
        start_time = emit_tool_start(trace_id, step_id, tool, session_id)
        
        try:
            # Execute original function
            result = func(*args, **kwargs)
            
            # Emit success event
            emit_tool_end(True, start_time, trace_id, step_id, tool, session_id)
            
            return result
            
        except Exception as e:
            # Emit error event
            emit_tool_end(False, start_time, trace_id, step_id, tool, session_id, str(e))
            raise
    
    return wrapper

# Context manager for workflow stages
class WorkflowStage:
    """Context manager for tracking workflow stages"""
    
    def __init__(self, stage: str, agent: str, trace_id: Optional[str] = None, session_id: Optional[str] = None):
        self.stage = stage
        self.agent = agent
        self.trace_id = trace_id or generate_trace_id()
        self.session_id = session_id
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        emit_workflow_stage(self.stage, self.agent, self.trace_id, "running", sessionId=self.session_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            # Success
            emit_workflow_stage(self.stage, self.agent, self.trace_id, "ok", 
                               sessionId=self.session_id,
                               latency_ms=int((time.time() - self.start_time) * 1000))
        else:
            # Error
            emit_workflow_stage(self.stage, self.agent, self.trace_id, "err",
                               sessionId=self.session_id,
                               payload={"error": str(exc_val)[:200]})

# Utility functions for direct integration
def instrument_function(func_name: str, module_name: str) -> Callable:
    """
    Factory for creating instrumented versions of existing functions
    Usage for monkey-patching existing ADK functions with minimal changes
    """
    def decorator(wrapper_func: Callable) -> Callable:
        @functools.wraps(wrapper_func)
        def instrumented(*args, **kwargs):
            trace_id = kwargs.get('trace_id') or generate_trace_id()
            
            # Add tracing to kwargs if not present
            if 'trace_id' not in kwargs:
                kwargs['trace_id'] = trace_id
            
            try:
                return wrapper_func(*args, **kwargs)
            except Exception as e:
                # Log function-level errors
                logger.error(f"Error in {func_name}: {e}")
                raise
        
        return instrumented
    return decorator

# High-level integration helpers
def setup_session_tracking(session_id: str) -> str:
    """Initialize session tracking and return trace ID"""
    trace_id = generate_trace_id()
    
    publish({
        "type": "job.start",
        "sessionId": session_id,
        "traceId": trace_id,
        "level": 1,
        "payload": {"summary": "New diagram generation workflow started"}
    })
    
    logger.info(f"Session {session_id} started with trace {trace_id}")
    return trace_id

def teardown_session_tracking(session_id: str, trace_id: str, success: bool = True) -> None:
    """Finalize session tracking"""
    publish({
        "type": "job.end" if success else "job.error",
        "sessionId": session_id,
        "traceId": trace_id,
        "level": 1,
        "status": "ok" if success else "err",
        "payload": {"summary": "Workflow completed" if success else "Workflow failed"}
    })
    
    logger.info(f"Session {session_id} {'completed' if success else 'failed'}")

# Configuration
def set_event_level(level: int) -> None:
    """Set global event level (1=core, 2=core+MCP, 3=debug)"""
    global EVENT_LEVEL
    if level in [1, 2, 3]:
        EVENT_LEVEL = level
        logger.info(f"Event level set to {level}")
    else:
        logger.warning(f"Invalid event level {level}, keeping {EVENT_LEVEL}")

def get_event_level() -> int:
    """Get current event level"""
    return EVENT_LEVEL