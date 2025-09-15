import { useState, useEffect, useRef, useCallback } from 'react';
import { ProcessedEvent, TraceInfo } from './useADKEnhanced';

export interface SSEEvent {
  type: string;
  seq: number;
  ts: number;
  traceId?: string;
  stepId?: string;
  tool?: string;
  agent?: string;
  status?: 'running' | 'ok' | 'err';
  latency_ms?: number;
  level: number;
  payload?: any;
  sessionId?: string;
  message?: string;
  total_subscribers?: number;
  active_subscribers?: number;
}

export interface SSEConnectionStatus {
  connected: boolean;
  error?: string;
  reconnectAttempts: number;
  lastEventId?: number;
  subscriberCount?: number;
}

export interface UseSSEClientOptions {
  url: string;
  enabled?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  pollingFallbackDelayMs?: number;
  onEvent?: (event: SSEEvent) => void;
  onConnectionChange?: (status: SSEConnectionStatus) => void;
}

export const useSSEClient = ({
  url,
  enabled = true,
  maxReconnectAttempts = 10,
  reconnectDelayMs = 1000,
  pollingFallbackDelayMs = 10000,
  onEvent,
  onConnectionChange,
}: UseSSEClientOptions) => {
  const [connectionStatus, setConnectionStatus] = useState<SSEConnectionStatus>({
    connected: false,
    reconnectAttempts: 0,
  });
  const [events, setEvents] = useState<SSEEvent[]>([]);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventIdRef = useRef<number | undefined>(undefined);
  const isPollingFallbackRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const updateConnectionStatus = useCallback((update: Partial<SSEConnectionStatus>) => {
    setConnectionStatus(prev => {
      const newStatus = {
        connected: prev.connected,
        error: prev.error,
        reconnectAttempts: reconnectAttemptsRef.current,
        lastEventId: lastEventIdRef.current,
        subscriberCount: prev.subscriberCount,
        ...update,
      };
      onConnectionChange?.(newStatus);
      return newStatus;
    });
  }, [onConnectionChange]);

  const handleEvent = useCallback((event: SSEEvent) => {
    console.log('SSE Event received:', event.type, event);
    
    // Update last event ID for replay
    if (event.seq) {
      lastEventIdRef.current = event.seq;
    }

    // Track subscriber count
    if (event.total_subscribers !== undefined || event.active_subscribers !== undefined) {
      updateConnectionStatus({ 
        subscriberCount: event.total_subscribers || event.active_subscribers 
      });
    }

    // Add to events list (with deduplication)
    setEvents(prev => {
      const isDuplicate = prev.some(e => 
        e.seq === event.seq && 
        e.type === event.type && 
        e.traceId === event.traceId
      );
      
      if (!isDuplicate) {
        onEvent?.(event);
        return [...prev, event];
      }
      return prev;
    });
  }, [onEvent, updateConnectionStatus]);

  const connectSSE = useCallback(() => {
    console.log('Attempting SSE connection to:', url);
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Build URL with Last-Event-ID for replay
      const sseUrl = new URL(url);
      if (lastEventIdRef.current !== undefined) {
        sseUrl.searchParams.set('since', lastEventIdRef.current.toString());
      }

      const eventSource = new EventSource(sseUrl.toString());
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('SSE connection established');
        reconnectAttemptsRef.current = 0;
        isPollingFallbackRef.current = false;
        
        // Clear fallback polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        updateConnectionStatus({ 
          connected: true, 
          error: undefined, 
          reconnectAttempts: 0 
        });
      };

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          handleEvent(data);
          
          // Set Last-Event-ID header for next reconnect
          if (data.seq) {
            lastEventIdRef.current = data.seq;
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        eventSource.close();
        
        updateConnectionStatus({ 
          connected: false, 
          error: 'SSE connection failed' 
        });

        // Exponential backoff reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectDelayMs * Math.pow(2, reconnectAttemptsRef.current),
            30000
          );
          
          console.log(`SSE reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectSSE();
          }, delay);
        } else {
          console.log('SSE max reconnect attempts reached, falling back to polling');
          startPollingFallback();
        }
      };

      // Start polling fallback timer
      if (pollingFallbackTimeoutRef.current) {
        clearTimeout(pollingFallbackTimeoutRef.current);
      }
      
      pollingFallbackTimeoutRef.current = setTimeout(() => {
        if (!connectionStatus.connected || reconnectAttemptsRef.current > 3) {
          console.log('SSE taking too long, starting polling fallback');
          startPollingFallback();
        }
      }, pollingFallbackDelayMs);

    } catch (err) {
      console.error('Failed to create SSE connection:', err);
      updateConnectionStatus({ 
        connected: false, 
        error: 'Failed to create SSE connection' 
      });
      
      startPollingFallback();
    }
  }, [url, maxReconnectAttempts, reconnectDelayMs, pollingFallbackDelayMs, connectionStatus.connected, handleEvent, updateConnectionStatus]);

  const startPollingFallback = useCallback(() => {
    if (isPollingFallbackRef.current) {
      return; // Already polling
    }

    console.log('Starting polling fallback');
    isPollingFallbackRef.current = true;
    
    updateConnectionStatus({ 
      connected: true, // Consider polling as "connected"
      error: 'Using polling fallback' 
    });

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch('/events', {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            ...(lastEventIdRef.current !== undefined && {
              'Last-Event-ID': lastEventIdRef.current.toString()
            })
          }
        });

        if (!response.ok) {
          throw new Error(`Polling failed: ${response.status}`);
        }

        // Try to parse as JSON (for health check endpoint)
        try {
          const data = await response.json();
          if (Array.isArray(data)) {
            data.forEach(handleEvent);
          } else if (data.type) {
            handleEvent(data);
          }
        } catch {
          // Not JSON, might be SSE stream - ignore
        }

      } catch (err) {
        console.error('Polling fallback error:', err);
        updateConnectionStatus({ 
          error: `Polling failed: ${err}` 
        });
      }
    }, 2000);
  }, [handleEvent, updateConnectionStatus]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting SSE client');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pollingFallbackTimeoutRef.current) {
      clearTimeout(pollingFallbackTimeoutRef.current);
      pollingFallbackTimeoutRef.current = null;
    }
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    isPollingFallbackRef.current = false;
    reconnectAttemptsRef.current = 0;
    
    updateConnectionStatus({ 
      connected: false, 
      error: undefined, 
      reconnectAttempts: 0 
    });
  }, [updateConnectionStatus]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    lastEventIdRef.current = undefined;
  }, []);

  // Connect/disconnect based on enabled flag
  useEffect(() => {
    if (enabled) {
      connectSSE();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connectSSE, disconnect]);

  return {
    events,
    connectionStatus,
    connect: connectSSE,
    disconnect,
    clearEvents,
  };
};