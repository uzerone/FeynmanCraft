import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { LogEntry } from '@/components/LogPanelFixed';

const MAX_LOGS = 1000;

export const useBackendLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdCounter = useRef(0);
  const isSetupRef = useRef(false);
  const processedEventsRef = useRef(new Set<string>());
  
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

  // Memoize logger object - FIXED: Don't call as function
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
    processedEventsRef.current.clear();
  }, []);

  // Process ADK events as logs
  const processADKEvents = useCallback((events: any[]) => {
    if (!events || !Array.isArray(events)) return;
    
    events.forEach((event: any) => {
      // Create unique event ID
      const eventId = `${event.timestamp}-${event.author}-${event.id || ''}`;
      
      // Skip if already processed
      if (processedEventsRef.current.has(eventId)) return;
      processedEventsRef.current.add(eventId);
      
      // Extract message from event
      let message = '';
      let details: any = {};
      
      if (event.content?.parts?.[0]?.text) {
        message = event.content.parts[0].text;
      } else if (event.content) {
        message = typeof event.content === 'string' ? event.content : JSON.stringify(event.content);
      }
      
      // Add event metadata
      if (event.actions) {
        details.actions = event.actions;
      }
      if (event.status) {
        details.status = event.status;
      }
      if (event.error) {
        details.error = event.error;
      }
      
      // Skip user messages
      if (event.author === 'user') return;
      
      // Determine log level based on content
      let level: LogEntry['level'] = 'info';
      if (event.error || message.toLowerCase().includes('error')) {
        level = 'error';
      } else if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('warn')) {
        level = 'warn';
      } else if (event.author.includes('validator') || event.author.includes('debug')) {
        level = 'debug';
      }
      
      // Add log entry
      addLog(level, 'backend', `[${event.author}] ${message}`, details);
    });
  }, [addLog]);

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

  // Intercept fetch to capture API logs
  useEffect(() => {
    const originalFetch = window.fetch;
    let interceptCount = 0;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      const requestId = ++interceptCount;
      
      // Log API request
      addLog('info', 'api', `[${requestId}] ${method} ${url}`);

      try {
        const response = await originalFetch(...args);
        
        // Log API response
        addLog('info', 'api', `[${requestId}] ${method} ${url} - ${response.status}`);

        // Clone response to parse for events
        if (typeof url === 'string' && url.includes('/apps/') && url.includes('/sessions/') && response.ok) {
          try {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            
            // Process ADK events from session polling
            if (data.events) {
              processADKEvents(data.events);
            }
          } catch (e) {
            // Not JSON or parsing failed
          }
        }

        return response;
      } catch (error: any) {
        addLog('error', 'api', `[${requestId}] ${method} ${url} - Failed`, { error: error.message });
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [addLog, processADKEvents]);

  return {
    logs,
    logger, // FIXED: Don't call as function
    clearLogs,
    processADKEvents
  };
};