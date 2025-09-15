import { useState, useCallback, useRef } from 'react';

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

export const useADKImproved = () => {
  const [messages, setMessages] = useState<ADKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<ADKEvent[]>([]);
  const [processedEvents, setProcessedEvents] = useState<ProcessedEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const createSession = async () => {
    const response = await fetch('/apps/feynmancraft_adk/users/user/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: {},
        events: []
      }),
      signal: abortControllerRef.current?.signal
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.status}`);
    }
    
    return await response.json();
  };

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
          details = textParts.substring(0, 300) + (textParts.length > 300 ? '...' : '');
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

  const sendMessage = useCallback(async (text: string) => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setEvents([]);
    setProcessedEvents([]);
    setError(null);
    
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
      const session = await createSession();
      
      // Send to ADK with timeout
      const response = await fetch('/run', {
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
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Process all events
      setEvents(result);
      const processed = processEvents(result);
      setProcessedEvents(processed);
      
      // Extract assistant messages from events
      const assistantMessages: ADKMessage[] = [];
      
      result.forEach((event: any) => {
        if (event.content && event.content.parts && event.author !== 'user') {
          const textParts = event.content.parts
            .filter((part: any) => part.text && !part.functionCall && !part.functionResponse)
            .map((part: any) => part.text)
            .join('');
            
          if (textParts.trim()) {
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

      if (assistantMessages.length > 0) {
        setMessages(prev => [...prev, ...assistantMessages]);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      
      console.error('Error sending message:', error);
      setError(error.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  }, []);

  return {
    messages,
    events,
    processedEvents,
    isLoading,
    error,
    sendMessage,
    stop
  };
};