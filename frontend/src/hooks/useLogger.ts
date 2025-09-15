import { useState, useCallback, useEffect, useRef } from 'react';
import { LogEntry } from '@/components/LogPanel';

export const useLogger = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdCounter = useRef(0);
  
  // Create unique log ID
  const createLogId = () => {
    logIdCounter.current += 1;
    return `log-${Date.now()}-${logIdCounter.current}`;
  };

  // Add log entry
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
    
    setLogs(prev => [...prev, newLog]);
    
    // Also log to console for debugging
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : 
                         console.log;
    consoleMethod(`[${source}] ${message}`, details || '');
  }, []);

  // Logger methods
  const logger = {
    info: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('info', source, message, details),
    warn: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('warn', source, message, details),
    error: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('error', source, message, details),
    debug: (source: LogEntry['source'], message: string, details?: any) => 
      addLog('debug', source, message, details),
  };

  // Clear logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    logIdCounter.current = 0;
  }, []);

  // Intercept console methods
  useEffect(() => {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };

    // Override console methods to capture logs
    console.log = (...args) => {
      originalConsole.log(...args);
      try {
        addLog('info', 'frontend', args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '));
      } catch (e) {
        // Ignore circular reference errors
      }
    };
    
    console.warn = (...args) => {
      originalConsole.warn(...args);
      try {
        addLog('warn', 'frontend', args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '));
      } catch (e) {
        // Ignore circular reference errors
      }
    };
    
    console.error = (...args) => {
      originalConsole.error(...args);
      try {
        addLog('error', 'frontend', args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '));
      } catch (e) {
        // Ignore circular reference errors
      }
    };
    
    console.debug = (...args) => {
      originalConsole.debug(...args);
      try {
        addLog('debug', 'frontend', args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' '));
      } catch (e) {
        // Ignore circular reference errors
      }
    };

    // Cleanup: restore original console methods
    return () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.debug = originalConsole.debug;
    };
  }, [addLog]);

  // Intercept fetch to log API calls
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = async (...args) => {
      const [url, options] = args;
      const method = options?.method || 'GET';
      
      // Log request
      logger.info('api', `${method} ${url}`, {
        headers: options?.headers,
        body: options?.body
      });

      try {
        const response = await originalFetch(...args);
        
        // Log response
        logger.info('api', `${method} ${url} - ${response.status}`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });

        return response;
      } catch (error) {
        // Log error
        logger.error('api', `${method} ${url} - Failed`, error);
        throw error;
      }
    };

    // Cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, [logger]);

  return {
    logs,
    logger,
    clearLogs
  };
};