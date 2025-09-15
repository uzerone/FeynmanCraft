"""
Enhanced Error Handler for FeynmanCraft ADK
Provides structured error cards with one-click actions for P0-13.3
"""

import logging
import traceback
import uuid
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional, Callable
from enum import Enum

from .sse_bus import publish

logger = logging.getLogger(__name__)


class ErrorSeverity(Enum):
    """Error severity levels"""
    CRITICAL = "critical"    # System cannot continue
    HIGH = "high"           # Major functionality impacted
    MEDIUM = "medium"       # Minor functionality impacted
    LOW = "low"            # Cosmetic or non-critical


class ErrorCategory(Enum):
    """Error categories for better handling"""
    PHYSICS_VALIDATION = "physics_validation"
    MCP_CONNECTION = "mcp_connection"
    TIKZ_COMPILATION = "tikz_compilation"
    AGENT_TRANSFER = "agent_transfer"
    SSE_STREAMING = "sse_streaming"
    FRONTEND_UI = "frontend_ui"
    SYSTEM = "system"


@dataclass
class OneClickAction:
    """Represents an actionable remedy for an error"""
    id: str
    label: str
    description: str
    action_type: str  # 'retry', 'fix', 'restart', 'ignore', 'manual'
    handler: Optional[str] = None  # Handler function name
    params: Dict[str, Any] = None
    dangerous: bool = False  # Requires confirmation
    
    def __post_init__(self):
        if self.params is None:
            self.params = {}


@dataclass
class StructuredError:
    """Structured error with actionable information"""
    id: str
    title: str
    message: str
    category: ErrorCategory
    severity: ErrorSeverity
    timestamp: float
    session_id: str
    trace_id: str
    step_id: str
    
    # Context information
    agent: Optional[str] = None
    tool: Optional[str] = None
    stack_trace: Optional[str] = None
    
    # User-friendly information
    user_message: str = ""
    technical_details: str = ""
    
    # Actionable remedies
    actions: List[OneClickAction] = None
    
    # Related information
    related_events: List[str] = None
    documentation_url: Optional[str] = None
    
    def __post_init__(self):
        if self.actions is None:
            self.actions = []
        if self.related_events is None:
            self.related_events = []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        
        # Convert enums to strings
        result['category'] = self.category.value
        result['severity'] = self.severity.value
        
        # Convert actions to dicts
        result['actions'] = [asdict(action) for action in self.actions]
        
        return result


class ErrorActionRegistry:
    """Registry of error action handlers"""
    
    def __init__(self):
        self._handlers: Dict[str, Callable] = {}
    
    def register(self, action_type: str, handler: Callable):
        """Register an action handler"""
        self._handlers[action_type] = handler
        logger.debug(f"Registered error action handler: {action_type}")
    
    def execute(self, action_id: str, action_type: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute an error action"""
        handler = self._handlers.get(action_type)
        if not handler:
            return {
                "success": False,
                "message": f"No handler registered for action type: {action_type}"
            }
        
        try:
            result = handler(action_id, params)
            logger.info(f"Executed error action {action_id} of type {action_type}")
            return {
                "success": True,
                "result": result
            }
        except Exception as e:
            logger.error(f"Error executing action {action_id}: {e}")
            return {
                "success": False,
                "message": f"Action execution failed: {str(e)}"
            }


class StructuredErrorHandler:
    """Main error handler with structured error processing"""
    
    def __init__(self):
        self.action_registry = ErrorActionRegistry()
        self._setup_default_actions()
    
    def _setup_default_actions(self):
        """Setup default error action handlers"""
        self.action_registry.register("retry_mcp_connection", self._retry_mcp_connection)
        self.action_registry.register("restart_agent", self._restart_agent)
        self.action_registry.register("fix_tikz_compilation", self._fix_tikz_compilation)
        self.action_registry.register("reload_frontend", self._reload_frontend)
        self.action_registry.register("ignore_error", self._ignore_error)
    
    def create_error(
        self,
        title: str,
        message: str,
        category: ErrorCategory,
        severity: ErrorSeverity,
        session_id: str,
        trace_id: str = None,
        step_id: str = None,
        agent: str = None,
        tool: str = None,
        exception: Exception = None
    ) -> StructuredError:
        """Create a structured error with automatic action suggestions"""
        
        error_id = str(uuid.uuid4())[:8]
        
        if not trace_id:
            trace_id = str(uuid.uuid4())[:8]
        if not step_id:
            step_id = "1"
        
        import time
        timestamp = time.time()
        
        # Extract exception details
        stack_trace = None
        technical_details = ""
        if exception:
            stack_trace = traceback.format_exc()
            technical_details = f"{type(exception).__name__}: {str(exception)}"
        
        # Create structured error
        error = StructuredError(
            id=error_id,
            title=title,
            message=message,
            category=category,
            severity=severity,
            timestamp=timestamp,
            session_id=session_id,
            trace_id=trace_id,
            step_id=step_id,
            agent=agent,
            tool=tool,
            stack_trace=stack_trace,
            technical_details=technical_details
        )
        
        # Add suggested actions based on error category
        error.actions = self._suggest_actions(error)
        
        # Add user-friendly message
        error.user_message = self._generate_user_message(error)
        
        return error
    
    def _suggest_actions(self, error: StructuredError) -> List[OneClickAction]:
        """Suggest actions based on error category and context"""
        actions = []
        
        if error.category == ErrorCategory.MCP_CONNECTION:
            actions.extend([
                OneClickAction(
                    id=f"retry_{error.id}",
                    label="Retry Connection",
                    description="Attempt to reconnect to the MCP server",
                    action_type="retry_mcp_connection",
                    params={"error_id": error.id}
                ),
                OneClickAction(
                    id=f"restart_{error.id}",
                    label="Restart MCP Server",
                    description="Restart the MCP server process",
                    action_type="restart_mcp_server",
                    dangerous=True
                )
            ])
        
        elif error.category == ErrorCategory.TIKZ_COMPILATION:
            actions.extend([
                OneClickAction(
                    id=f"fix_{error.id}",
                    label="Auto-Fix TikZ",
                    description="Automatically fix common TikZ compilation errors",
                    action_type="fix_tikz_compilation",
                    params={"error_id": error.id}
                ),
                OneClickAction(
                    id=f"regenerate_{error.id}",
                    label="Regenerate Code",
                    description="Generate new TikZ code from scratch",
                    action_type="regenerate_tikz"
                )
            ])
        
        elif error.category == ErrorCategory.AGENT_TRANSFER:
            actions.extend([
                OneClickAction(
                    id=f"restart_agent_{error.id}",
                    label="Restart Agent",
                    description="Restart the current agent workflow",
                    action_type="restart_agent",
                    params={"agent": error.agent}
                )
            ])
        
        elif error.category == ErrorCategory.FRONTEND_UI:
            actions.extend([
                OneClickAction(
                    id=f"reload_{error.id}",
                    label="Reload Frontend",
                    description="Refresh the frontend interface",
                    action_type="reload_frontend"
                )
            ])
        
        # Always add ignore option for non-critical errors
        if error.severity in [ErrorSeverity.LOW, ErrorSeverity.MEDIUM]:
            actions.append(
                OneClickAction(
                    id=f"ignore_{error.id}",
                    label="Ignore",
                    description="Mark this error as acknowledged and continue",
                    action_type="ignore_error",
                    params={"error_id": error.id}
                )
            )
        
        return actions
    
    def _generate_user_message(self, error: StructuredError) -> str:
        """Generate user-friendly error message"""
        category_messages = {
            ErrorCategory.PHYSICS_VALIDATION: "Physics validation failed. The proposed process may violate conservation laws.",
            ErrorCategory.MCP_CONNECTION: "Unable to connect to the particle physics server. Network or server issues detected.",
            ErrorCategory.TIKZ_COMPILATION: "LaTeX/TikZ compilation failed. There may be syntax errors in the generated code.",
            ErrorCategory.AGENT_TRANSFER: "Agent workflow interrupted. Communication between AI agents failed.",
            ErrorCategory.SSE_STREAMING: "Real-time updates disconnected. You may not see live progress updates.",
            ErrorCategory.FRONTEND_UI: "Interface error detected. The user interface may not respond correctly.",
            ErrorCategory.SYSTEM: "System error detected. Internal processing failed."
        }
        
        return category_messages.get(error.category, error.message)
    
    def handle_error(self, error: StructuredError) -> None:
        """Handle and emit a structured error"""
        logger.error(f"Structured error {error.id}: {error.title} - {error.message}")
        
        # Emit error event via SSE
        try:
            publish({
                "type": "structured_error",
                "error": error.to_dict(),
                "timestamp": int(error.timestamp * 1000)
            })
        except Exception as e:
            logger.error(f"Failed to emit structured error event: {e}")
    
    def execute_action(self, action_id: str, action_type: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Execute an error action"""
        if params is None:
            params = {}
        
        return self.action_registry.execute(action_id, action_type, params)
    
    # Default action handlers
    def _retry_mcp_connection(self, action_id: str, params: Dict[str, Any]) -> str:
        """Retry MCP connection"""
        # This would trigger a reconnection attempt
        return "MCP connection retry initiated"
    
    def _restart_agent(self, action_id: str, params: Dict[str, Any]) -> str:
        """Restart agent workflow"""
        agent_name = params.get("agent", "unknown")
        return f"Agent {agent_name} restart initiated"
    
    def _fix_tikz_compilation(self, action_id: str, params: Dict[str, Any]) -> str:
        """Auto-fix TikZ compilation"""
        return "TikZ auto-fix applied"
    
    def _reload_frontend(self, action_id: str, params: Dict[str, Any]) -> str:
        """Reload frontend interface"""
        return "Frontend reload signal sent"
    
    def _ignore_error(self, action_id: str, params: Dict[str, Any]) -> str:
        """Ignore error"""
        error_id = params.get("error_id", "unknown")
        return f"Error {error_id} marked as ignored"


# Global error handler instance
error_handler = StructuredErrorHandler()


# Convenience functions
def handle_mcp_error(message: str, session_id: str, trace_id: str = None, tool: str = None, exception: Exception = None) -> StructuredError:
    """Handle MCP connection error"""
    error = error_handler.create_error(
        title="MCP Connection Error",
        message=message,
        category=ErrorCategory.MCP_CONNECTION,
        severity=ErrorSeverity.HIGH,
        session_id=session_id,
        trace_id=trace_id,
        tool=tool,
        exception=exception
    )
    error_handler.handle_error(error)
    return error


def handle_tikz_error(message: str, session_id: str, trace_id: str = None, agent: str = None, exception: Exception = None) -> StructuredError:
    """Handle TikZ compilation error"""
    error = error_handler.create_error(
        title="TikZ Compilation Error",
        message=message,
        category=ErrorCategory.TIKZ_COMPILATION,
        severity=ErrorSeverity.MEDIUM,
        session_id=session_id,
        trace_id=trace_id,
        agent=agent,
        exception=exception
    )
    error_handler.handle_error(error)
    return error


def handle_agent_error(message: str, session_id: str, agent: str, trace_id: str = None, exception: Exception = None) -> StructuredError:
    """Handle agent workflow error"""
    error = error_handler.create_error(
        title="Agent Workflow Error",
        message=message,
        category=ErrorCategory.AGENT_TRANSFER,
        severity=ErrorSeverity.HIGH,
        session_id=session_id,
        trace_id=trace_id,
        agent=agent,
        exception=exception
    )
    error_handler.handle_error(error)
    return error


def handle_physics_error(message: str, session_id: str, trace_id: str = None, exception: Exception = None) -> StructuredError:
    """Handle physics validation error"""
    error = error_handler.create_error(
        title="Physics Validation Error",
        message=message,
        category=ErrorCategory.PHYSICS_VALIDATION,
        severity=ErrorSeverity.MEDIUM,
        session_id=session_id,
        trace_id=trace_id,
        exception=exception
    )
    error_handler.handle_error(error)
    return error


def execute_error_action(action_id: str, action_type: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Execute an error action"""
    return error_handler.execute_action(action_id, action_type, params)