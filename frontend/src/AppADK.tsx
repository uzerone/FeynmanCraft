import { useState, useEffect, useRef } from "react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { ChatMessagesView } from "@/components/ChatMessagesView";
import { Button } from "@/components/ui/button";
import { useADK } from "@/hooks/useADK";

export interface ProcessedEvent {
  title: string;
  data: string;
}

export default function AppADK() {
  const [processedEventsTimeline, setProcessedEventsTimeline] = useState<ProcessedEvent[]>([]);
  const [historicalActivities, setHistoricalActivities] = useState<Record<string, ProcessedEvent[]>>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { messages, events, isLoading, sendMessage, stop } = useADK();

  // Process ADK events into timeline
  useEffect(() => {
    const newProcessedEvents: ProcessedEvent[] = [];
    
    events.forEach((event) => {
      let processedEvent: ProcessedEvent | null = null;
      
      if (event.author === 'planner_agent') {
        processedEvent = {
          title: "Planning Request",
          data: "Parsing natural language request and extracting physics entities",
        };
      } else if (event.author === 'kb_retriever_agent') {
        processedEvent = {
          title: "Knowledge Base Search",
          data: "Searching for similar Feynman diagram examples",
        };
      } else if (event.author === 'physics_validator_agent') {
        processedEvent = {
          title: "Physics Validation",
          data: "Validating particle interactions and physics rules",
        };
      } else if (event.author === 'diagram_generator_agent') {
        processedEvent = {
          title: "Diagram Generation",
          data: "Generating TikZ-Feynman LaTeX code",
        };
      } else if (event.author === 'tikz_validator_agent') {
        processedEvent = {
          title: "LaTeX Compilation",
          data: "Compiling and validating TikZ code",
        };
      } else if (event.author === 'feedback_agent') {
        processedEvent = {
          title: "Final Response",
          data: "Preparing Feynman diagram output",
        };
      }
      
      if (processedEvent) {
        newProcessedEvents.push(processedEvent);
      }
    });
    
    setProcessedEventsTimeline(newProcessedEvents);
  }, [events]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]);

  // Save historical activities when conversation ends
  useEffect(() => {
    if (!isLoading && messages.length > 0 && processedEventsTimeline.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        setHistoricalActivities((prev) => ({
          ...prev,
          [lastMessage.id]: [...processedEventsTimeline],
        }));
      }
    }
  }, [messages, isLoading, processedEventsTimeline]);

  const handleSubmit = async (submittedInputValue: string) => {
    if (!submittedInputValue.trim()) return;
    
    setProcessedEventsTimeline([]);
    setError(null);
    
    try {
      await sendMessage(submittedInputValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleCancel = () => {
    stop();
    window.location.reload();
  };

  // Convert ADK messages to LangGraph format for compatibility
  const langGraphMessages = messages.map(msg => ({
    id: msg.id,
    type: msg.role,
    content: msg.content,
  }));

  return (
    <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      <main className="h-full w-full max-w-4xl mx-auto">
        {messages.length === 0 ? (
          <WelcomeScreen
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            onCancel={handleCancel}
          />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center gap-4">
              <h1 className="text-2xl text-red-400 font-bold">Error</h1>
              <p className="text-red-400">{error}</p>
              <Button
                variant="destructive"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <ChatMessagesView
            messages={langGraphMessages as any}
            isLoading={isLoading}
            scrollAreaRef={scrollAreaRef}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            liveActivityEvents={processedEventsTimeline}
            historicalActivities={historicalActivities}
          />
        )}
      </main>
    </div>
  );
}