"""
Tool Orchestration Metrics Collector for P1-14.2
Provides real-time metrics and analytics for tool usage patterns
"""

import asyncio
import logging
import time
from collections import defaultdict, deque
from dataclasses import dataclass, asdict
from typing import Dict, List, Any, Optional, Tuple
from threading import Lock
import statistics

from .sse_bus import publish

logger = logging.getLogger(__name__)

@dataclass
class ToolCall:
    """Individual tool call record"""
    tool_name: str
    start_time: float
    end_time: Optional[float] = None
    duration: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    session_id: str = ""
    trace_id: str = ""
    step_id: str = ""
    params: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.params is None:
            self.params = {}

@dataclass 
class ToolMetrics:
    """Aggregated metrics for a specific tool"""
    name: str
    category: str
    total_calls: int = 0
    successful_calls: int = 0
    failed_calls: int = 0
    total_duration: float = 0.0
    avg_duration: float = 0.0
    min_duration: float = float('inf')
    max_duration: float = 0.0
    p50_duration: float = 0.0
    p95_duration: float = 0.0
    p99_duration: float = 0.0
    success_rate: float = 100.0
    last_called: float = 0.0
    calls_per_hour: float = 0.0
    error_rate: float = 0.0
    recent_errors: List[str] = None
    concurrent_calls: int = 0
    
    def __post_init__(self):
        if self.recent_errors is None:
            self.recent_errors = []

class ToolMetricsCollector:
    """Collects and aggregates tool usage metrics"""
    
    def __init__(self, max_history_hours: int = 24):
        self.max_history_hours = max_history_hours
        self.max_history_seconds = max_history_hours * 3600
        
        # Thread-safe data structures
        self._lock = Lock()
        self._active_calls: Dict[str, ToolCall] = {}  # call_id -> ToolCall
        self._completed_calls: deque = deque()  # Historical calls
        self._tool_metrics: Dict[str, ToolMetrics] = {}  # tool_name -> metrics
        
        # Performance counters
        self._call_counter = 0
        self._last_cleanup = time.time()
        
        # Background cleanup task
        self._cleanup_task = None
        self._start_cleanup_task()
    
    def _start_cleanup_task(self):
        """Start background cleanup task"""
        try:
            loop = asyncio.get_event_loop()
            self._cleanup_task = loop.create_task(self._periodic_cleanup())
        except RuntimeError:
            # No event loop running, cleanup will happen manually
            logger.debug("No event loop available for background cleanup")
    
    async def _periodic_cleanup(self):
        """Periodically clean old data"""
        while True:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                self._cleanup_old_data()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {e}")
    
    def _cleanup_old_data(self):
        """Remove data older than max_history_hours"""
        cutoff_time = time.time() - self.max_history_seconds
        
        with self._lock:
            # Clean completed calls
            while self._completed_calls and self._completed_calls[0].start_time < cutoff_time:
                self._completed_calls.popleft()
            
            # Clean stale active calls (> 1 hour)
            stale_cutoff = time.time() - 3600
            stale_calls = [
                call_id for call_id, call in self._active_calls.items()
                if call.start_time < stale_cutoff
            ]
            for call_id in stale_calls:
                logger.warning(f"Cleaning stale active call: {call_id}")
                del self._active_calls[call_id]
            
            self._last_cleanup = time.time()
    
    def start_tool_call(self, 
                       tool_name: str, 
                       session_id: str = "",
                       trace_id: str = "",
                       step_id: str = "",
                       params: Dict[str, Any] = None) -> str:
        """Record start of a tool call"""
        self._call_counter += 1
        call_id = f"{tool_name}_{self._call_counter}_{int(time.time() * 1000)}"
        
        call = ToolCall(
            tool_name=tool_name,
            start_time=time.time(),
            session_id=session_id,
            trace_id=trace_id,
            step_id=step_id,
            params=params or {}
        )
        
        with self._lock:
            self._active_calls[call_id] = call
            
            # Update concurrent calls counter
            if tool_name in self._tool_metrics:
                self._tool_metrics[tool_name].concurrent_calls += 1
        
        # Emit SSE event
        try:
            publish({
                "type": "tool_call_start",
                "tool": tool_name,
                "call_id": call_id,
                "trace_id": trace_id,
                "step_id": step_id,
                "session_id": session_id,
                "timestamp": int(call.start_time * 1000),
                "params": params or {}
            })
        except Exception as e:
            logger.error(f"Failed to emit tool call start event: {e}")
        
        return call_id
    
    def end_tool_call(self, 
                     call_id: str, 
                     success: bool = True, 
                     error: Optional[str] = None) -> Optional[ToolCall]:
        """Record end of a tool call"""
        with self._lock:
            if call_id not in self._active_calls:
                logger.warning(f"Tool call {call_id} not found in active calls")
                return None
            
            call = self._active_calls.pop(call_id)
            call.end_time = time.time()
            call.duration = call.end_time - call.start_time
            call.success = success
            call.error = error
            
            # Add to completed calls
            self._completed_calls.append(call)
            
            # Update metrics
            self._update_tool_metrics(call)
            
            # Emit SSE event
            try:
                publish({
                    "type": "tool_call_end",
                    "tool": call.tool_name,
                    "call_id": call_id,
                    "trace_id": call.trace_id,
                    "step_id": call.step_id,
                    "session_id": call.session_id,
                    "timestamp": int(call.end_time * 1000),
                    "duration": int(call.duration * 1000),
                    "success": success,
                    "error": error
                })
            except Exception as e:
                logger.error(f"Failed to emit tool call end event: {e}")
        
        return call
    
    def _categorize_tool(self, tool_name: str) -> str:
        """Categorize tool based on name"""
        name = tool_name.lower()
        if 'mcp' in name or 'particle' in name or 'physics' in name:
            return 'mcp'
        elif 'search' in name or 'kb' in name or 'retriev' in name:
            return 'search'
        elif 'valid' in name or 'check' in name:
            return 'validation'
        elif 'generat' in name or 'diagram' in name or 'tikz' in name:
            return 'generation'
        elif 'compil' in name or 'latex' in name:
            return 'compilation'
        else:
            return 'analysis'
    
    def _update_tool_metrics(self, call: ToolCall):
        """Update aggregated metrics for a tool"""
        tool_name = call.tool_name
        
        if tool_name not in self._tool_metrics:
            self._tool_metrics[tool_name] = ToolMetrics(
                name=tool_name,
                category=self._categorize_tool(tool_name)
            )
        
        metrics = self._tool_metrics[tool_name]
        
        # Update counters
        metrics.total_calls += 1
        if call.success:
            metrics.successful_calls += 1
        else:
            metrics.failed_calls += 1
            if call.error:
                metrics.recent_errors.append(call.error)
                # Keep only last 5 errors
                if len(metrics.recent_errors) > 5:
                    metrics.recent_errors = metrics.recent_errors[-5:]
        
        # Update duration stats
        if call.duration is not None:
            metrics.total_duration += call.duration
            metrics.avg_duration = metrics.total_duration / metrics.total_calls
            metrics.min_duration = min(metrics.min_duration, call.duration)
            metrics.max_duration = max(metrics.max_duration, call.duration)
            
            # Calculate percentiles from recent calls
            recent_durations = [
                c.duration for c in self._completed_calls
                if c.tool_name == tool_name and c.duration is not None
            ]
            
            if recent_durations:
                recent_durations.sort()
                n = len(recent_durations)
                metrics.p50_duration = recent_durations[int(n * 0.5)] if n > 0 else 0
                metrics.p95_duration = recent_durations[int(n * 0.95)] if n > 0 else 0
                metrics.p99_duration = recent_durations[int(n * 0.99)] if n > 0 else 0
        
        # Update rates
        metrics.success_rate = (metrics.successful_calls / metrics.total_calls) * 100
        metrics.error_rate = (metrics.failed_calls / metrics.total_calls) * 100
        metrics.last_called = call.end_time or call.start_time
        
        # Calculate calls per hour from recent data
        one_hour_ago = time.time() - 3600
        recent_calls = sum(1 for c in self._completed_calls 
                          if c.tool_name == tool_name and c.start_time > one_hour_ago)
        metrics.calls_per_hour = recent_calls
        
        # Update concurrent calls counter
        metrics.concurrent_calls = max(0, metrics.concurrent_calls - 1)
    
    def get_tool_metrics(self, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """Get metrics for specific tool or all tools"""
        with self._lock:
            if tool_name:
                if tool_name in self._tool_metrics:
                    return asdict(self._tool_metrics[tool_name])
                else:
                    return {}
            else:
                return {name: asdict(metrics) for name, metrics in self._tool_metrics.items()}
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get overall system statistics"""
        with self._lock:
            total_calls = sum(m.total_calls for m in self._tool_metrics.values())
            total_duration = sum(m.total_duration for m in self._tool_metrics.values())
            total_errors = sum(m.failed_calls for m in self._tool_metrics.values())
            active_tools = len(self._tool_metrics)
            concurrent_calls = len(self._active_calls)
            
            # Calculate overall success rate
            if total_calls > 0:
                overall_success_rate = sum(m.successful_calls for m in self._tool_metrics.values()) / total_calls * 100
                avg_duration = total_duration / total_calls
            else:
                overall_success_rate = 100.0
                avg_duration = 0.0
            
            return {
                "total_calls": total_calls,
                "total_duration": total_duration,
                "total_errors": total_errors,
                "active_tools": active_tools,
                "concurrent_calls": concurrent_calls,
                "overall_success_rate": overall_success_rate,
                "avg_duration": avg_duration,
                "active_calls": len(self._active_calls),
                "completed_calls": len(self._completed_calls),
                "uptime": time.time() - (getattr(self, '_start_time', time.time()))
            }
    
    def get_activity_heatmap(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Generate activity heatmap data"""
        now = time.time()
        cutoff = now - (hours * 3600)
        
        # Create hour buckets
        buckets = {}
        for i in range(hours):
            hour_start = now - (i * 3600)
            hour_key = int(hour_start // 3600)
            buckets[hour_key] = {
                'hour': hour_key,
                'timestamp': hour_start,
                'calls': 0,
                'errors': 0,
                'avg_duration': 0,
                'durations': []
            }
        
        # Fill buckets with data
        with self._lock:
            for call in self._completed_calls:
                if call.start_time < cutoff:
                    continue
                
                hour_key = int(call.start_time // 3600)
                if hour_key in buckets:
                    buckets[hour_key]['calls'] += 1
                    if not call.success:
                        buckets[hour_key]['errors'] += 1
                    if call.duration:
                        buckets[hour_key]['durations'].append(call.duration)
        
        # Calculate averages
        for bucket in buckets.values():
            if bucket['durations']:
                bucket['avg_duration'] = sum(bucket['durations']) / len(bucket['durations'])
            del bucket['durations']  # Don't need raw data in response
        
        return list(buckets.values())
    
    def cleanup(self):
        """Cleanup resources"""
        if self._cleanup_task:
            self._cleanup_task.cancel()

# Global metrics collector instance
tool_metrics_collector = ToolMetricsCollector()

# Convenience functions for integration
def start_tool_measurement(tool_name: str, session_id: str = "", trace_id: str = "", step_id: str = "", params: Dict[str, Any] = None) -> str:
    """Start measuring a tool call"""
    return tool_metrics_collector.start_tool_call(tool_name, session_id, trace_id, step_id, params)

def end_tool_measurement(call_id: str, success: bool = True, error: Optional[str] = None) -> Optional[ToolCall]:
    """End measuring a tool call"""
    return tool_metrics_collector.end_tool_call(call_id, success, error)

def get_tool_stats(tool_name: Optional[str] = None) -> Dict[str, Any]:
    """Get tool statistics"""
    return tool_metrics_collector.get_tool_metrics(tool_name)

def get_dashboard_data() -> Dict[str, Any]:
    """Get complete dashboard data"""
    return {
        "system_stats": tool_metrics_collector.get_system_stats(),
        "tool_metrics": tool_metrics_collector.get_tool_metrics(),
        "activity_heatmap": tool_metrics_collector.get_activity_heatmap()
    }

# Context manager for easy tool measurement
class tool_measurement:
    """Context manager for measuring tool calls"""
    
    def __init__(self, tool_name: str, session_id: str = "", trace_id: str = "", step_id: str = "", params: Dict[str, Any] = None):
        self.tool_name = tool_name
        self.session_id = session_id
        self.trace_id = trace_id
        self.step_id = step_id
        self.params = params
        self.call_id = None
    
    def __enter__(self):
        self.call_id = start_tool_measurement(
            self.tool_name, self.session_id, self.trace_id, self.step_id, self.params
        )
        return self.call_id
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.call_id:
            success = exc_type is None
            error = str(exc_val) if exc_val else None
            end_tool_measurement(self.call_id, success, error)