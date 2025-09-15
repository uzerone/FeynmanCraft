import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { LogEntry } from '@/components/LogPanel';

const MAX_LOGS = 500; // Limit log storage to prevent memory issues

export const useLoggerFixed = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdCounter = useRef(0);
  const isSetupRef = useRef(false);
  
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
      // Limit logs to prevent unbounded growth
      const newLogs = [...prev, newLog];
      if (newLogs.length > MAX_LOGS) {
        return newLogs.slice(-MAX_LOGS);
      }
      return newLogs;
    });
  }, [createLogId]);

  // Memoize logger object to prevent re-renders
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

  // Setup console interception only once on mount
  useEffect(() => {
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    // Store original console methods
    const originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      debug: console.debug.bind(console)
    };

    // Override console methods
    console.log = (...args: any[]) => {
      originalConsole.log(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 200) : String(arg)
        ).join(' ');
        // Use setTimeout to avoid state updates during render
        setTimeout(() => addLog('info', 'frontend', message), 0);
      } catch (e) {
        // Ignore errors
      }
    };
    
    console.warn = (...args: any[]) => {
      originalConsole.warn(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 200) : String(arg)
        ).join(' ');
        setTimeout(() => addLog('warn', 'frontend', message), 0);
      } catch (e) {
        // Ignore errors
      }
    };
    
    console.error = (...args: any[]) => {
      originalConsole.error(...args);
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2).substring(0, 200) : String(arg)
        ).join(' ');
        setTimeout(() => addLog('error', 'frontend', message), 0);
      } catch (e) {
        // Ignore errors
      }
    };

    // Store reference for cleanup
    const cleanupRef = {
      originalConsole
    };

    // Cleanup function
    return () => {
      console.log = cleanupRef.originalConsole.log;
      console.warn = cleanupRef.originalConsole.warn;
      console.error = cleanupRef.originalConsole.error;
      console.debug = cleanupRef.originalConsole.debug;
      isSetupRef.current = false;
    };
  }, []); // Empty deps - only run once

  // Intercept fetch - simplified version
  useEffect(() => {
    const originalFetch = window.fetch;
    let interceptCount = 0;

    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      const requestId = ++interceptCount;
      
      // Log request (avoid logging body to prevent memory issues)
      logger.info('api', `[${requestId}] ${method} ${url}`);

      try {
        const response = await originalFetch(...args);
        
        logger.info('api', `[${requestId}] ${method} ${url} - ${response.status}`);

        return response;
      } catch (error: any) {
        logger.error('api', `[${requestId}] ${method} ${url} - Failed`, { error: error.message });
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [logger]); // logger is stable due to useMemo

  return {
    logs,
    logger,
    clearLogs
  };
};