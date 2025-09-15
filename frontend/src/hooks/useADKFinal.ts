import { useState, useCallback, useRef, useEffect } from 'react';

export interface ADKMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  author?: string;
}

export interface ADKEvent {
  id: string;
  content: any;
  author: string;
  timestamp: number;
  actions?: any;
  usageMetadata?: any;
}

export interface ProcessedEvent {
  title: string;
  data: string;
  timestamp: number;
  author: string;
  details?: string;
}

export interface ConnectionStatus {
  isConnected: boolean;
  lastChecked: number;
  error?: string;
}

export const useADKFinal = () => {
  const [messages, setMessages] = useState<ADKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<ADKEvent[]>([]);
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({ isConnected: true, lastChecked: Date.now() });
  const [isWorkflowComplete, setIsWorkflowComplete] = useState(false);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check backend connection
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
        setConnectionStatus({ isConnected: true, lastChecked: Date.now() });
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

  // Stop all monitoring
  const stopAllMonitoring = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (connectionCheckRef.current) {
      clearInterval(connectionCheckRef.current);
      connectionCheckRef.current = null;
    }
  }, []);

  const processEvents = (eventList: ADKEvent[]) => {
    const processed: ProcessedEvent[] = [];
    
    eventList.forEach((event, index) => {
      let processedEvent: ProcessedEvent | null = null;
      
      // Process based on author
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
          title: "📋 Planning Request",
          data: "Analyzing request and creating execution plan",
          timestamp: event.timestamp * 1000,
          author: event.author,
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
          title: "🔬 Deep Research",
          data: "Performing comprehensive research on physics topic",
          timestamp: event.timestamp * 1000,
          author: event.author,
          details
        };
      } else if (event.author === 'kb_retriever_agent') {
        processedEvent = {
          title: "📚 Knowledge Base Search",
          data: "Searching for similar Feynman diagram examples",
          timestamp: event.timestamp * 1000,
          author: event.author
        };
      } else if (event.author === 'physics_validator_agent') {
        processedEvent = {
          title: "⚖️ Physics Validation",
          data: "Validating particle interactions and physics rules",
          timestamp: event.timestamp * 1000,
          author: event.author
        };
      } else if (event.author === 'diagram_generator_agent') {
        processedEvent = {
          title: "🎨 Diagram Generation",
          data: "Generating TikZ-Feynman LaTeX code",
          timestamp: event.timestamp * 1000,
          author: event.author
        };
      } else if (event.author === 'tikz_validator_agent') {
        processedEvent = {
          title: "⚙️ LaTeX Compilation",
          data: "Compiling and validating TikZ code",
          timestamp: event.timestamp * 1000,
          author: event.author
        };
      } else if (event.author === 'feedback_agent') {
        processedEvent = {
          title: "✅ Final Response",
          data: "Preparing Feynman diagram output",
          timestamp: event.timestamp * 1000,
          author: event.author
        };
      } else if (event.author === 'root_agent') {
        // Check if this is a transfer event
        if (event.actions?.transferToAgent) {
          processedEvent = {
            title: "🔄 Agent Transfer",
            data: `Transferring to ${event.actions.transferToAgent}`,
            timestamp: event.timestamp * 1000,
            author: event.author
          };
        }
      }
      
      if (processedEvent) {
        processed.push(processedEvent);
      }
    });
    
    return processed;
  };

  // Poll session for updates with improved completion detection
  const pollSession = useCallback(async (sessionId: string) => {
    try {
      console.log(`Polling session: ${sessionId}`);
      const response = await fetch(`/apps/feynmancraft_adk/users/user/sessions/${sessionId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log(`Session ${sessionId} not found (404)`);
          setError('Session expired. Please try again.');
          setIsLoading(false);
          stopAllMonitoring();
          return;
        }
        throw new Error(`Session polling failed: ${response.status}`);
      }
      
      const session = await response.json();
      console.log(`Session ${sessionId} has ${session.events?.length || 0} events`);
      
      // Update events
      setEvents(session.events || []);
      const processed = processEvents(session.events || []);
      setProcessedEvents(processed);
      
      // Improved completion detection
      const events = session.events || [];
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        
        // Check for completion conditions
        const hasCompletedWorkflow = events.some((event: any) => event.author === 'feedback_agent');
        const hasNoRecentActivity = lastEvent && (Date.now() - lastEvent.timestamp * 1000) > 60000; // 60 seconds
        
        // Don't mark as complete if we're still in early stages
        const hasSufficientProgress = events.length > 5; // At least 5 events
        
        if (hasCompletedWorkflow || (hasNoRecentActivity && hasSufficientProgress)) {
          console.log('Workflow completed, extracting results...');
          setIsLoading(false);
          setIsWorkflowComplete(true);
          stopAllMonitoring();
          
          // Keep processedEvents for display - don't clear them!
          
          // Extract final assistant message from feedback_agent or last meaningful text
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
          
          // If no feedback message, look for other agent messages with text
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
    } catch (err: any) {
      console.error('Polling error:', err);
      setError(`Connection error: ${err.message}`);
      setIsLoading(false);
      stopAllMonitoring();
    }
  }, [stopAllMonitoring]);

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
    
    stopAllMonitoring();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setEvents([]);
    setProcessedEvents([]);
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
      
      // Start polling immediately and more frequently
      pollingIntervalRef.current = setInterval(() => {
        const sessionId = sessionIdRef.current || currentSessionId;
        if (sessionId) {
          pollSession(sessionId);
        }
      }, 2000); // Poll every 2 seconds

    } catch (error: any) {
      setError(`Failed to start request: ${error.message}`);
      setIsLoading(false);
      stopAllMonitoring();
    }
  }, [checkConnection, pollSession, stopAllMonitoring]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopAllMonitoring();
    setIsLoading(false);
    setError(null);
  }, [stopAllMonitoring]);

  // Initialize connection monitoring
  useEffect(() => {
    checkConnection();
    
    return () => {
      stopAllMonitoring();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [checkConnection, stopAllMonitoring]);

  return {
    messages,
    events,
    processedEvents,
    isLoading,
    error,
    connectionStatus,
    sendMessage,
    stop,
    checkConnection
  };
};