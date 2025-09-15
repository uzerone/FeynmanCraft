import { useState, useCallback, useRef, useEffect } from 'react';

export interface TraceInfo {
  traceId: string;
  stepId: string;
  tool?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}

export interface EnhancedEvent {
  id: string;
  content: any;
  author: string;
  timestamp: number;
  actions?: any;
  usageMetadata?: any;
  traceInfo?: TraceInfo;
}

export interface PollingState {
  isPolling: boolean;
  interval: number;
  failureCount: number;
  lastSuccessTime: number;
}

const INITIAL_INTERVAL = 1000; // 1 second
const MAX_INTERVAL = 10000; // 10 seconds
const EXPONENTIAL_BASE = 1.5;

export const useAdvancedPolling = () => {
  const [pollingState, setPollingState] = useState<PollingState>({
    isPolling: false,
    interval: INITIAL_INTERVAL,
    failureCount: 0,
    lastSuccessTime: Date.now()
  });
  
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const traceMapRef = useRef<Map<string, TraceInfo>>(new Map());
  
  // Enhanced polling with exponential backoff
  const scheduleNextPoll = useCallback((callback: () => Promise<void>, interval: number) => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    
    pollingTimeoutRef.current = setTimeout(async () => {
      try {
        await callback();
        
        // Success - reset interval and failure count
        setPollingState(prev => ({
          ...prev,
          interval: INITIAL_INTERVAL,
          failureCount: 0,
          lastSuccessTime: Date.now()
        }));
        
        // Schedule next poll if still polling
        setPollingState(prev => {
          if (prev.isPolling) {
            scheduleNextPoll(callback, INITIAL_INTERVAL);
          }
          return prev;
        });
        
      } catch (error) {
        console.error('Polling error:', error);
        
        // Failure - increase interval with exponential backoff
        setPollingState(prev => {
          const newFailureCount = prev.failureCount + 1;
          const newInterval = Math.min(
            Math.floor(prev.interval * Math.pow(EXPONENTIAL_BASE, newFailureCount)),
            MAX_INTERVAL
          );
          
          console.log(`Polling failed ${newFailureCount} times, next attempt in ${newInterval}ms`);
          
          // Schedule retry if still polling
          if (prev.isPolling) {
            scheduleNextPoll(callback, newInterval);
          }
          
          return {
            ...prev,
            interval: newInterval,
            failureCount: newFailureCount
          };
        });
      }
    }, interval);
  }, []);
  
  // Start enhanced polling
  const startPolling = useCallback((callback: () => Promise<void>) => {
    setPollingState(prev => ({
      ...prev,
      isPolling: true,
      interval: INITIAL_INTERVAL,
      failureCount: 0
    }));
    
    // Start immediately, then schedule
    callback().then(() => {
      scheduleNextPoll(callback, INITIAL_INTERVAL);
    }).catch(() => {
      scheduleNextPoll(callback, INITIAL_INTERVAL);
    });
  }, [scheduleNextPoll]);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    setPollingState(prev => ({ ...prev, isPolling: false }));
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);
  
  // Enhanced event processing with trace info
  const processEventsWithTracing = useCallback((events: any[]): EnhancedEvent[] => {
    return events.map((event, index) => {
      // Generate trace information
      const traceId = event.id.substring(0, 8);
      const stepId = `step_${index + 1}`;
      
      // Try to extract tool information
      let tool = undefined;
      if (event.content?.parts) {
        const funcCall = event.content.parts.find((part: any) => part.functionCall);
        if (funcCall) {
          tool = funcCall.functionCall.name;
        }
      }
      
      // Create or update trace info
      const startTime = event.timestamp * 1000;
      let traceInfo: TraceInfo = {
        traceId,
        stepId,
        tool,
        startTime,
        status: 'success' // Default to success for now
      };
      
      // Check if this is a continuation of a previous trace
      const existingTrace = traceMapRef.current.get(traceId);
      if (existingTrace && !existingTrace.endTime) {
        traceInfo = {
          ...existingTrace,
          endTime: startTime,
          duration: startTime - existingTrace.startTime
        };
      }
      
      traceMapRef.current.set(traceId, traceInfo);
      
      return {
        ...event,
        traceInfo
      };
    });
  }, []);
  
  // Get current polling status for display
  const getPollingStatus = useCallback(() => {
    if (!pollingState.isPolling) {
      return 'Live updates ready';
    }
    
    if (pollingState.failureCount > 0) {
      const nextPollIn = Math.max(0, pollingState.interval - (Date.now() - pollingState.lastSuccessTime));
      return `Retrying in ${Math.ceil(nextPollIn / 1000)}s (attempt ${pollingState.failureCount + 1})`;
    }
    
    return `Live updates active (${(pollingState.interval / 1000).toFixed(1)}s)`;
  }, [pollingState]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    pollingState,
    startPolling,
    stopPolling,
    processEventsWithTracing,
    getPollingStatus,
    traceMap: traceMapRef.current
  };
};