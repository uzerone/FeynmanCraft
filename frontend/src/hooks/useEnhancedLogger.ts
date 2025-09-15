import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { LogEntry } from '@/components/LogPanelFixed';

const MAX_LOGS = 1000; // Increased limit for backend logs

export const useEnhancedLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdCounter = useRef(0);
  const isSetupRef = useRef(false);
  const sseConnectionRef = useRef<EventSource | null>(null);
  
  // Create unique log ID
  const createLogId = useCallback(() => {
    logIdCounter.current += 1;
    return `log-${Date.now()}-${logIdCounter.current}`;
  }, []);

  // Memoize addLog to prevent re-renders
  const addLog = useCallback((
    level: LogEntry['level'],
    source: LogEntry['source'],
    message: string,
    details?: any
  ) => {
    const newLog: LogEntry = {
      id: createLogId(),
      timestamp: Date.now(),
      level,
      source,
      message,
      details
    };
    
    setLogs(prev => {
      const newLogs = [...prev, newLog];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, [createLogId]);

  // Memoize logger object
  const logger = useMemo(() => ({
    info: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('info', source, message, details),
    warn: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('warn', source, message, details),
    error: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('error', source, message, details),
    debug: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('debug', source, message, details),
  }), [addLog]);

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    logIdCounter.current = 0;
  }, []);

  // Connect to backend logs via SSE
  const connectToBackendLogs = useCallback(() => {
    try {
      // Close existing connection
      if (sseConnectionRef.current) {
        sseConnectionRef.current.close();
      }

      // Create SSE connection to get backend logs
      const eventSource = new EventSource('/run_sse?include_logs=true');
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle different types of backend messages
          if (data.type === 'log') {
            logger.info('backend', data.message, data.details);
          } else if (data.type === 'error') {
            logger.error('backend', data.message, data.details);
          } else if (data.type === 'event') {
            // ADK event logs
            logger.debug('backend', `ADK Event: ${data.author}`, data);
          } else if (data.message) {
            // Generic backend message
            const level = data.level || 'info';
            logger[level]('backend', data.message, data.details);
          }
        } catch (e) {
          // Raw log message
          if (event.data && event.data !== 'ping') {
            logger.info('backend', event.data);
          }
        }
      };

      eventSource.onerror = (error) => {
        logger.error('backend', 'SSE connection error', error);
        // Reconnect after 5 seconds
        setTimeout(() => connectToBackendLogs(), 5000);
      };

      sseConnectionRef.current = eventSource;
    } catch (error) {
      logger.error('backend', 'Failed to connect to backend logs', error);
    }
  }, [logger]);

  // Setup console interception
  useEffect(() => {
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    const originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    };

    console.log = (...args: any[]) => {
      originalConsole.log(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 500) : String(arg)
        ).join(' ');
        setTimeout(() => addLog('info', 'frontend', message), 0);
      } catch (e) {}
    };
    
    console.warn = (...args: any[]) => {
      originalConsole.warn(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 500) : String(arg)
        ).join(' ');
        setTimeout(() => addLog('warn', 'frontend', message), 0);
      } catch (e) {}
    };
    
    console.error = (...args: any[]) => {
      originalConsole.error(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 500) : String(arg)
        ).join(' ');
        setTimeout(() => addLog('error', 'frontend', message), 0);
      } catch (e) {}
    };

    const cleanupRef = { originalConsole };

    return () => {
      console.log = cleanupRef.originalConsole.log;
      console.warn = cleanupRef.originalConsole.warn;
      console.error = cleanupRef.originalConsole.error;
      console.debug = cleanupRef.originalConsole.debug;
      isSetupRef.current = false;
    };
  }, [addLog]);

  // Intercept fetch and add backend log parsing
  useEffect(() => {
    const originalFetch = window.fetch;
    let interceptCount = 0;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      const requestId = ++interceptCount;
      
      logger.info('api', `[${requestId}] ${method} ${url}`);

      try {
        const response = await originalFetch(...args);
        
        logger.info('api', `[${requestId}] ${method} ${url} - ${response.status}`);

        // Clone response to parse for logs
        const clonedResponse = response.clone();
        
        // Try to extract logs from response
        if (url.includes('/apps/') && url.includes('/sessions/')) {
          try {
            const data = await clonedResponse.json();
            
            // Extract ADK session events as logs
            if (data.events) {
              data.events.forEach((event: any) => {
                if (event.author && event.author !== 'user') {
                  logger.debug('backend', `${event.author}: ${event.content?.parts?.[0]?.text || 'Event'}`, {
                    timestamp: event.timestamp,
                    actions: event.actions
                  });
                }
              });
            }
          } catch (e) {
            // Not JSON or parsing failed
          }
        }

        return response;
      } catch (error: any) {
        logger.error('api', `[${requestId}] ${method} ${url} - Failed`, { error: error.message });
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logger]);

  // Connect to backend logs on mount
  useEffect(() => {
    connectToBackendLogs();
    
    return () => {
      if (sseConnectionRef.current) {
        sseConnectionRef.current.close();
      }
    };
  }, [connectToBackendLogs]);

  return {
    logs,
    logger,
    clearLogs
  };
};