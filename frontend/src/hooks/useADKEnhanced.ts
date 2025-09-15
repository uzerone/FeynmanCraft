import { useState, useCallback, useRef, useEffect } from 'react';
import { useAdvancedPolling, EnhancedEvent, TraceInfo } from './useAdvancedPolling';
import { useSSEClient, SSEEvent } from './useSSEClient';

export interface ADKMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  author?: string;
}

export interface ProcessedEvent {
  title: string;
  data: string;
  timestamp: number;
  author: string;
  details?: string;
  traceInfo?: TraceInfo;
  status?: 'pending' | 'success' | 'error';
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: number;
  error?: string;
  serverInfo?: {
    edition?: string;
    uptime?: number;
    tools_count?: number;
    cors_status?: string;
  };
}

export interface StructuredError {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  timestamp: number;
  session_id: string;
  trace_id: string;
  step_id: string;
  agent?: string;
  tool?: string;
  stack_trace?: string;
  user_message?: string;
  technical_details?: string;
  actions?: Array<{
    id: string;
    label: string;
    description: string;
    action_type: string;
    handler?: string;
    params?: Record<string, any>;
    dangerous?: boolean;
  }>;
  related_events?: string[];
  documentation_url?: string;
}

export const useADKEnhanced = () => {
  const [messages, setMessages] = useState<ADKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<EnhancedEvent[]>([]);
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ 
    isConnected: false, 
    lastChecked: Date.now() 
  });
  const [isWorkflowComplete, setIsWorkflowComplete] = useState(false);
  const [structuredErrors, setStructuredErrors] = useState<StructuredError[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null);
  
  const { 
    startPolling, 
    stopPolling, 
    processEventsWithTracing, 
    getPollingStatus,
    pollingState 
  } = useAdvancedPolling();

  // SSE客户端，优先使用SSE，失败时自动降级到轮询
  const [sseEnabled, setSSEEnabled] = useState(false); // Disable SSE by default until server is confirmed working
  const [realTimeEvents, setRealTimeEvents] = useState<SSEEvent[]>([]);
  
  const handleSSEEvent = useCallback((event: SSEEvent) => {
    console.log('Real-time SSE event received:', event);
    
    // Handle structured errors
    if (event.type === 'structured_error' && (event as any).error) {
      const errorData = (event as any).error;
      setStructuredErrors(prev => {
        // Check if error already exists
        const exists = prev.some(e => e.id === errorData.id);
        if (!exists) {
          return [...prev, errorData];
        }
        return prev;
      });
    }
    
    // Convert SSE events to ProcessedEvents for real-time display
    if (event.type.startsWith('step.') || event.type.startsWith('tool.')) {
      const processedEvent: ProcessedEvent = {
        title: getEventTitle(event),
        data: getEventData(event),
        timestamp: event.ts * 1000,
        author: event.agent || event.tool || 'system',
        traceInfo: {
          traceId: event.traceId,
          stepId: event.stepId,
        },
        status: event.status === 'err' ? 'error' : event.status === 'ok' ? 'success' : 'pending'
      };
      
      setProcessedEvents(prev => {
        // Deduplicate based on traceId + stepId + type
        const key = `${event.traceId}-${event.stepId}-${event.type}`;
        const exists = prev.some(e => 
          e.traceInfo?.traceId === event.traceId && 
          e.traceInfo?.stepId === event.stepId &&
          e.title === processedEvent.title
        );
        
        if (!exists) {
          return [...prev, processedEvent];
        }
        return prev;
      });
    }
    
    setRealTimeEvents(prev => [...prev, event]);
  }, []);

  const handleSSEConnectionChange = useCallback((status: any) => {
    console.log('SSE connection status:', status);
    
    // Update connection status with SSE info
    setConnectionStatus(prev => ({
      ...prev,
      isConnected: status.connected,
      error: status.error
    }));
    
    // If SSE fails completely, fall back to polling
    if (!status.connected && status.reconnectAttempts >= 5) {
      console.log('SSE failed, falling back to polling permanently');
      setSSEEnabled(false);
    }
  }, []);

  const { 
    events: sseEvents, 
    connectionStatus: sseConnectionStatus,
    connect: connectSSE,
    disconnect: disconnectSSE,
    clearEvents: clearSSEEvents
  } = useSSEClient({
    url: 'http://localhost:8001/events',
    enabled: sseEnabled,
    maxReconnectAttempts: 10,
    reconnectDelayMs: 1000,
    pollingFallbackDelayMs: 10000,
    onEvent: handleSSEEvent,
    onConnectionChange: handleSSEConnectionChange,
  });

  // Helper functions to convert SSE events to display format
  const getEventTitle = useCallback((event: SSEEvent): string => {
    switch (event.type) {
      case 'step.transfer':
        return '🔄 Agent Transfer';
      case 'step.planning':
        return '📋 Planning';
      case 'step.search':
        return '📚 Knowledge Search';
      case 'step.validation':
        return '⚖️ Physics Validation';
      case 'step.generation':
        return '🎨 Diagram Generation';
      case 'step.compilation':
        return '⚙️ LaTeX Compilation';
      case 'tool.start':
        return `🔧 ${event.tool} Starting`;
      case 'tool.end':
        return `✅ ${event.tool} Complete`;
      case 'job.start':
        return '🚀 Workflow Started';
      case 'job.end':
        return '🎯 Workflow Complete';
      default:
        return `📡 ${event.type}`;
    }
  }, []);

  const getEventData = useCallback((event: SSEEvent): string => {
    if (event.payload?.summary) {
      return event.payload.summary;
    }
    
    switch (event.type) {
      case 'step.transfer':
        return `Transferring to next agent`;
      case 'tool.start':
        return `Executing ${event.tool}`;
      case 'tool.end':
        return `Completed in ${event.latency_ms}ms`;
      default:
        return event.message || 'Processing...';
    }
  }, []);

  // Enhanced connection check with server info
  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/list-apps', {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Try to get additional server info
        let serverInfo = {};
        try {
          // Check LaTeX MCP server (port 8003) - ParticlePhysics MCP uses stdio, no HTTP endpoint
          const mcpResponse = await fetch('/latex-mcp/health');
          if (mcpResponse.ok) {
            const mcpInfo = await mcpResponse.json();
            serverInfo = {
              edition: 'FeynmanCraft ADK',
              uptime: 0, // Not tracked for stdio MCP
              tools_count: Array.isArray(mcpInfo.tools) ? mcpInfo.tools.length : 0,
              cors_status: 'OK'
            };
          }
        } catch (e) {
          // MCP info optional
        }
        
        setConnectionStatus({ 
          isConnected: true, 
          lastChecked: Date.now(),
          serverInfo
        });
        return true;
      } else {
        setConnectionStatus({ 
          isConnected: false, 
          lastChecked: Date.now(),
          error: `Backend responded with status ${response.status}` 
        });
        return false;
      }
    } catch (err: any) {
      const errorMessage = err.name === 'AbortError' 
        ? 'Connection timeout - backend may be starting up'
        : 'Backend not responding - please check if ADK server is running';
        
      setConnectionStatus({ 
        isConnected: false, 
        lastChecked: Date.now(),
        error: errorMessage
      });
      return false;
    }
  }, []);

  // Enhanced event processing with better error handling
  const processEvents = useCallback((eventList: EnhancedEvent[]): ProcessedEvent[] => {
    const processed: ProcessedEvent[] = [];
    const seenSteps = new Set<string>();
    
    eventList.forEach((event, index) => {
      let processedEvent: ProcessedEvent | null = null;
      
      // Check for duplicates using stepId if available
      const stepKey = event.traceInfo?.stepId || `${event.author}_${index}`;
      if (seenSteps.has(stepKey) && event.author === 'planner_agent') {
        // Skip duplicate planning requests
        return;
      }
      seenSteps.add(stepKey);
      
      // Process based on author with enhanced trace info
      const baseEvent = {
        timestamp: event.timestamp * 1000,
        author: event.author,
        traceInfo: event.traceInfo,
        status: 'success' as const
      };
      
      if (event.author === 'planner_agent') {
        let details = '';
        if (event.content?.parts) {
          const textParts = event.content.parts
            .filter((part: any) => part.text)
            .map((part: any) => part.text)
            .join('');
          details = textParts.substring(0, 200) + (textParts.length > 200 ? '...' : '');
        }
        
        processedEvent = {
          ...baseEvent,
          title: "📋 Planning Request",
          data: "Analyzing request and creating execution plan",
          details
        };
      } else if (event.author === 'deep_research_agent') {
        let details = '';
        if (event.content?.parts) {
          const funcCall = event.content.parts.find((part: any) => part.functionCall);
          if (funcCall) {
            details = `Researching: ${funcCall.functionCall.args?.topic || 'Unknown topic'}`;
          }
        }
        
        processedEvent = {
          ...baseEvent,
          title: "🔬 Deep Research",
          data: "Performing comprehensive research on physics topic",
          details
        };
      } else if (event.author === 'kb_retriever_agent') {
        processedEvent = {
          ...baseEvent,
          title: "📚 Knowledge Base Search",
          data: "Searching for similar Feynman diagram examples"
        };
      } else if (event.author === 'physics_validator_agent') {
        processedEvent = {
          ...baseEvent,
          title: "⚖️ Physics Validation",
          data: "Validating particle interactions and physics rules"
        };
      } else if (event.author === 'diagram_generator_agent') {
        processedEvent = {
          ...baseEvent,
          title: "🎨 Diagram Generation",
          data: "Generating TikZ-Feynman LaTeX code"
        };
      } else if (event.author === 'tikz_validator_agent') {
        processedEvent = {
          ...baseEvent,
          title: "⚙️ LaTeX Compilation",
          data: "Compiling and validating TikZ code"
        };
      } else if (event.author === 'feedback_agent') {
        processedEvent = {
          ...baseEvent,
          title: "✅ Final Response",
          data: "Preparing Feynman diagram output"
        };
      } else if (event.author === 'root_agent') {
        // Check if this is a transfer event
        if (event.actions?.transferToAgent) {
          processedEvent = {
            ...baseEvent,
            title: "🔄 Agent Transfer",
            data: `Transferring to ${event.actions.transferToAgent}`
          };
        }
      }
      
      if (processedEvent) {
        processed.push(processedEvent);
      }
    });
    
    return processed;
  }, []);

  // Enhanced session polling
  const pollSession = useCallback(async (sessionId: string) => {
    console.log(`Polling session: ${sessionId}`);
    const response = await fetch(`/apps/feynmancraft_adk/users/user/sessions/${sessionId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Session ${sessionId} not found (404)`);
        setError('Session expired. Please try again.');
        setIsLoading(false);
        stopPolling();
        throw new Error('Session not found');
      }
      throw new Error(`Session polling failed: ${response.status}`);
    }
    
    const session = await response.json();
    console.log(`Session ${sessionId} has ${session.events?.length || 0} events`);
    
    // Process events with tracing
    const rawEvents = session.events || [];
    const enhancedEvents = processEventsWithTracing(rawEvents);
    setEvents(enhancedEvents);
    
    const processed = processEvents(enhancedEvents);
    setProcessedEvents(processed);
    
    // Improved completion detection
    const events = session.events || [];
    if (events.length > 0) {
      const lastEvent = events[events.length - 1];
      
      // Check for completion conditions
      const hasCompletedWorkflow = events.some((event: any) => event.author === 'feedback_agent');
      const hasNoRecentActivity = lastEvent && (Date.now() - lastEvent.timestamp * 1000) > 60000; // 60 seconds
      const hasSufficientProgress = events.length > 5; // At least 5 events
      
      if (hasCompletedWorkflow || (hasNoRecentActivity && hasSufficientProgress)) {
        console.log('Workflow completed, extracting results...');
        setIsLoading(false);
        setIsWorkflowComplete(true);
        stopPolling();
        
        // Extract final assistant message
        const assistantMessages: ADKMessage[] = [];
        
        // Look for feedback_agent messages first
        const feedbackEvents = events.filter((event: any) => event.author === 'feedback_agent');
        if (feedbackEvents.length > 0) {
          const feedbackEvent = feedbackEvents[feedbackEvents.length - 1];
          if (feedbackEvent.content?.parts) {
            const textParts = feedbackEvent.content.parts
              .filter((part: any) => part.text)
              .map((part: any) => part.text)
              .join('');
              
            if (textParts.trim()) {
              assistantMessages.push({
                id: feedbackEvent.id,
                content: textParts,
                role: 'assistant',
                timestamp: feedbackEvent.timestamp * 1000,
                author: feedbackEvent.author
              });
            }
          }
        }
        
        if (assistantMessages.length === 0) {
          events.reverse().forEach((event: any) => {
            if (event.content?.parts && event.author !== 'user' && event.author !== 'root_agent') {
              const textParts = event.content.parts
                .filter((part: any) => part.text && !part.functionCall && !part.functionResponse)
                .map((part: any) => part.text)
                .join('');
                
              if (textParts.trim() && assistantMessages.length === 0) {
                assistantMessages.push({
                  id: event.id,
                  content: textParts,
                  role: 'assistant',
                  timestamp: event.timestamp * 1000,
                  author: event.author
                });
              }
            }
          });
        }

        if (assistantMessages.length > 0) {
          setMessages(prev => [...prev, assistantMessages[0]]);
        } else {
          setError('No response received from agents. Please try again.');
        }
      }
    }
  }, [processEventsWithTracing, processEvents, stopPolling]);

  const sendMessage = useCallback(async (text: string) => {
    // First check connection
    const isConnected = await checkConnection();
    if (!isConnected) {
      setError('Cannot connect to backend. Please ensure ADK server is running on port 8000.');
      return;
    }

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Clear previous events for new request
    setEvents([]);
    setProcessedEvents([]);
    setRealTimeEvents([]);
    clearSSEEvents();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    setIsWorkflowComplete(false);
    
    try {
      // Add user message immediately
      const userMessage: ADKMessage = {
        id: Date.now().toString(),
        content: text,
        role: 'user',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);

      // Create session
      const sessionResponse = await fetch('/apps/feynmancraft_adk/users/user/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: {},
          events: []
        })
      });
      
      if (!sessionResponse.ok) {
        throw new Error(`Failed to create session: ${sessionResponse.status} ${sessionResponse.statusText}`);
      }
      
      const session = await sessionResponse.json();
      sessionIdRef.current = session.id;
      setCurrentSessionId(session.id);
      console.log('Created session:', session.id);
      
      // Start the request (fire and forget)
      fetch('/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appName: "feynmancraft_adk",
          userId: "user",
          sessionId: session.id,
          newMessage: {
            parts: [{ text }],
            role: "user"
          },
          streaming: false
        })
      }).catch(err => {
        console.error('Request error:', err);
      });
      
      // Primary: Use SSE for real-time events (B-B-B方案)
      if (sseEnabled) {
        console.log('Using SSE for real-time events');
        // SSE events are handled by handleSSEEvent callback
        
        // Fallback polling for final result extraction only
        setTimeout(() => {
          startPolling(async () => {
            const sessionId = sessionIdRef.current || currentSessionId;
            if (sessionId) {
              await pollSession(sessionId);
            }
          });
        }, 5000); // Start polling after 5s as fallback for completion detection
      } else {
        console.log('Fallback to polling mode');
        // Fallback: Use traditional polling
        startPolling(async () => {
          const sessionId = sessionIdRef.current || currentSessionId;
          if (sessionId) {
            await pollSession(sessionId);
          }
        });
      }

    } catch (error: any) {
      setError(`Failed to start request: ${error.message}`);
      setIsLoading(false);
      stopPolling();
    }
  }, [checkConnection, pollSession, stopPolling, startPolling, sseEnabled, clearSSEEvents]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopPolling();
    disconnectSSE();
    setIsLoading(false);
    setError(null);
  }, [stopPolling, disconnectSSE]);

  // Initialize connection monitoring
  useEffect(() => {
    checkConnection();
    
    return () => {
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []); // Remove dependencies to prevent infinite loops

  // Error handling functions
  const dismissError = useCallback((errorId: string) => {
    setStructuredErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  const clearAllErrors = useCallback(() => {
    setStructuredErrors([]);
  }, []);

  const executeErrorAction = useCallback(async (
    actionId: string, 
    actionType: string, 
    params: Record<string, any> = {}
  ): Promise<{ success: boolean; message?: string; result?: any }> => {
    try {
      // Call the backend error action endpoint
      const response = await fetch('http://localhost:8001/execute-error-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_id: actionId,
          action_type: actionType,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        message: result.message,
        result: result.result
      };
    } catch (error) {
      console.error('Failed to execute error action:', error);
      return {
        success: false,
        message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }, []);

  return {
    messages,
    events,
    processedEvents,
    isLoading,
    error,
    connectionStatus,
    sendMessage,
    stop,
    checkConnection,
    pollingStatus: getPollingStatus(),
    pollingState,
    // SSE specific exports
    sseEnabled,
    sseConnectionStatus,
    realTimeEvents,
    toggleSSE: () => setSSEEnabled(!sseEnabled),
    // Structured error handling
    structuredErrors,
    dismissError,
    clearAllErrors,
    executeErrorAction
  };
};