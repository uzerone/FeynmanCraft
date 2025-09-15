#!/usr/bin/env python3
"""
Tracing Wrapper for FeynmanCraft ADK
Implements end-to-end correlation tracking with session-based tracing
Following Zhang Gong's P0-13.2 correlation ID strategy
"""

import time
import uuid
import logging
import functools
from typing import Dict, Any, Optional, Callable, List
from google.adk.agents import Agent
from .event_bridge import (
    setup_session_tracking, 
    teardown_session_tracking,
    emit_agent_transfer,
    emit_workflow_stage,
    WorkflowStage,
    generate_trace_id,
    generate_step_id
)

logger = logging.getLogger(__name__)

class TracingContext:
    """Session-based tracing context for correlation tracking"""
    
    def __init__(self, session_id: str, user_request: str):
        self.session_id = session_id
        self.trace_id = setup_session_tracking(session_id)
        self.user_request = user_request
        self.start_time = time.time()
        self.agent_transfers: List[Dict[str, Any]] = []
        self.current_agent = "root_agent"
        self.workflow_stages: List[Dict[str, Any]] = []
        
    def transfer_to_agent(self, from_agent: str, to_agent: str, context: Optional[str] = None):
        """Record agent transfer with correlation tracking"""
        step_id = generate_step_id()
        
        transfer_info = {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "step_id": step_id,
            "timestamp": time.time(),
            "context": context
        }
        
        self.agent_transfers.append(transfer_info)
        self.current_agent = to_agent
        
        # Emit SSE event for real-time tracking
        emit_agent_transfer(
            from_agent=from_agent,
            to_agent=to_agent,
            trace_id=self.trace_id,
            session_id=self.session_id
        )
        
        logger.info(f"Agent transfer: {from_agent} → {to_agent} (trace: {self.trace_id}, step: {step_id})")
        
    def start_workflow_stage(self, stage: str, agent: str, **kwargs) -> str:
        """Start a workflow stage with correlation tracking"""
        step_id = generate_step_id()
        
        stage_info = {
            "stage": stage,
            "agent": agent,
            "step_id": step_id,
            "start_time": time.time(),
            "status": "running",
            **kwargs
        }
        
        self.workflow_stages.append(stage_info)
        
        # Emit SSE event
        emit_workflow_stage(
            stage=stage,
            agent=agent,
            trace_id=self.trace_id,
            status="running",
            sessionId=self.session_id,
            stepId=step_id,
            **kwargs
        )
        
        return step_id
        
    def complete_workflow_stage(self, step_id: str, success: bool = True, **kwargs):
        """Complete a workflow stage with result tracking"""
        # Find the stage by step_id
        stage_info = None
        for stage in self.workflow_stages:
            if stage.get("step_id") == step_id:
                stage_info = stage
                break
                
        if stage_info:
            stage_info["end_time"] = time.time()
            stage_info["duration"] = stage_info["end_time"] - stage_info["start_time"]
            stage_info["status"] = "ok" if success else "err"
            stage_info.update(kwargs)
            
            # Emit completion event
            emit_workflow_stage(
                stage=stage_info["stage"],
                agent=stage_info["agent"],
                trace_id=self.trace_id,
                status=stage_info["status"],
                sessionId=self.session_id,
                stepId=step_id,
                latency_ms=int(stage_info["duration"] * 1000),
                **kwargs
            )
            
    def finalize(self, success: bool = True):
        """Finalize the tracing session"""
        teardown_session_tracking(
            session_id=self.session_id,
            trace_id=self.trace_id,
            success=success
        )
        
        duration = time.time() - self.start_time
        logger.info(
            f"Session {self.session_id} finalized - "
            f"Duration: {duration:.2f}s, Agents: {len(set(t['to_agent'] for t in self.agent_transfers))}, "
            f"Stages: {len(self.workflow_stages)}"
        )

# Global context store for active sessions
_active_contexts: Dict[str, TracingContext] = {}

def create_tracing_context(session_id: str, user_request: str) -> TracingContext:
    """Create and register a new tracing context"""
    context = TracingContext(session_id, user_request)
    _active_contexts[session_id] = context
    return context

def get_tracing_context(session_id: str) -> Optional[TracingContext]:
    """Get active tracing context by session ID"""
    return _active_contexts.get(session_id)

def cleanup_tracing_context(session_id: str):
    """Clean up tracing context"""
    context = _active_contexts.pop(session_id, None)
    if context:
        context.finalize()

class TracedAgent:
    """Wrapper for ADK Agent with correlation tracking"""
    
    def __init__(self, agent: Agent):
        self.agent = agent
        self.agent_name = getattr(agent, 'name', 'unknown_agent')
        
    def __call__(self, request: str, session_id: Optional[str] = None, **kwargs) -> Any:
        """Execute agent with correlation tracking"""
        
        # Create or get tracing context
        if session_id:
            context = get_tracing_context(session_id)
            if not context:
                context = create_tracing_context(session_id, request)
        else:
            # Generate temporary session for non-session calls
            session_id = f"temp-{str(uuid.uuid4())[:8]}"
            context = create_tracing_context(session_id, request)
            
        # Start workflow stage for this agent execution
        stage_step_id = context.start_workflow_stage(
            stage="execution",
            agent=self.agent_name,
            input_length=len(request),
            **kwargs
        )
        
        try:
            # Execute the actual agent
            with WorkflowStage(
                stage=f"{self.agent_name}_execution",
                agent=self.agent_name,
                trace_id=context.trace_id,
                session_id=context.session_id
            ):
                result = self.agent(request, **kwargs)
                
            # Mark stage as completed
            context.complete_workflow_stage(
                step_id=stage_step_id,
                success=True,
                output_length=len(str(result)) if result else 0
            )
            
            return result
            
        except Exception as e:
            # Mark stage as failed
            context.complete_workflow_stage(
                step_id=stage_step_id,
                success=False,
                error=str(e)[:200]
            )
            
            logger.error(f"Agent {self.agent_name} failed in session {session_id}: {e}")
            raise

def trace_agent(agent: Agent) -> TracedAgent:
    """Create a traced wrapper for an ADK agent"""
    return TracedAgent(agent)

# Decorator for tracing agent calls
def with_agent_tracing(session_id_param: str = "session_id"):
    """Decorator to add automatic agent tracing"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            session_id = kwargs.get(session_id_param)
            
            if session_id:
                context = get_tracing_context(session_id)
                if context:
                    # Add correlation IDs to kwargs
                    kwargs["trace_id"] = context.trace_id
                    kwargs["session_id"] = session_id
                    
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Tool tracing functions for MCP integration
def emit_tool_start(trace_id: str, step_id: str, tool: str, session_id: str, params: Dict = None) -> float:
    """Emit tool start event and return start time"""
    import time
    from .sse_bus import publish
    
    start_time = time.time()
    
    try:
        publish({
            "type": "tool_start",
            "trace_id": trace_id,
            "step_id": step_id,
            "session_id": session_id,
            "tool": tool,
            "timestamp": int(start_time * 1000),
            "params": params or {},
            "status": "started"
        })
    except Exception as e:
        logger.error(f"Failed to emit tool start event: {e}")
    
    return start_time


def emit_tool_complete(trace_id: str, step_id: str, tool: str, session_id: str, 
                      start_time: float, success: bool, result_summary: str = None, 
                      error: str = None) -> None:
    """Emit tool completion event"""
    import time
    from .sse_bus import publish
    
    end_time = time.time()
    duration = int((end_time - start_time) * 1000)  # Duration in milliseconds
    
    try:
        event_data = {
            "type": "tool_complete",
            "trace_id": trace_id,
            "step_id": step_id,
            "session_id": session_id,
            "tool": tool,
            "timestamp": int(end_time * 1000),
            "duration": duration,
            "status": "completed" if success else "failed"
        }
        
        if success and result_summary:
            event_data["result_summary"] = result_summary
        elif not success and error:
            event_data["error"] = error
        
        publish(event_data)
    except Exception as e:
        logger.error(f"Failed to emit tool complete event: {e}")


def get_current_correlation_ids() -> tuple[str, str, str]:
    """Get current correlation IDs from context or generate defaults"""
    import uuid
    
    # Try to get from thread-local context first
    context = globals().get("_current_tracing_context")
    if context:
        return context.trace_id, context.get_next_step_id(), context.session_id
    
    # Default fallback - generate new IDs
    session_id = str(uuid.uuid4())[:8]
    trace_id = str(uuid.uuid4())[:8]
    step_id = "1"
    
    return trace_id, step_id, session_id


# Global context management for thread-local tracing
_current_tracing_context: Optional[TracingContext] = None

def set_current_tracing_context(context: TracingContext) -> None:
    """Set current tracing context for the thread"""
    global _current_tracing_context
    _current_tracing_context = context

def get_current_tracing_context() -> Optional[TracingContext]:
    """Get current tracing context for the thread"""
    return _current_tracing_context

# Utility functions for correlation tracking
def get_correlation_ids(session_id: str) -> Dict[str, str]:
    """Get correlation IDs for a session"""
    context = get_tracing_context(session_id)
    if context:
        return {
            "session_id": session_id,
            "trace_id": context.trace_id,
            "current_agent": context.current_agent
        }
    return {}

def track_mcp_call(session_id: str, tool_name: str, **kwargs):
    """Track MCP tool call with correlation"""
    context = get_tracing_context(session_id)
    if context:
        step_id = generate_step_id()
        
        # This would integrate with MCP tools to add correlation headers
        correlation_headers = {
            "X-Trace-Id": context.trace_id,
            "X-Step-Id": step_id,
            "X-Session-Id": session_id,
            "X-Agent": context.current_agent
        }
        
        return correlation_headers
    return {}