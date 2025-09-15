import { useState, useEffect, useRef } from "react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { InputForm } from "@/components/InputForm";
import { Button } from "@/components/ui/button";
import { useADKImproved } from "@/hooks/useADKImproved";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Copy, CopyCheck, AlertCircle, User, Bot } from "lucide-react";

export default function AppBetter() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  const { messages, processedEvents, isLoading, error, sendMessage, stop } = useADKImproved();

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
  }, [messages, processedEvents]);

  const handleSubmit = async (submittedInputValue: string) => {
    if (!submittedInputValue.trim()) return;
    
    try {
      await sendMessage(submittedInputValue);
    } catch (err) {
      console.error('Submit error:', err);
    }
  };

  const handleCancel = () => {
    stop();
  };

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Render welcome screen
  if (messages.length === 0) {
    return (
      <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
        <main className="h-full w-full max-w-4xl mx-auto">
          <WelcomeScreen
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            onCancel={handleCancel}
          />
        </main>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
        <main className="h-full w-full max-w-4xl mx-auto">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center gap-4">
              <AlertCircle className="h-16 w-16 text-red-400" />
              <h1 className="text-2xl text-red-400 font-bold">Error</h1>
              <p className="text-red-400 text-center max-w-md">{error}</p>
              <Button
                variant="destructive"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      {/* Main chat area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-2 max-w-4xl mx-auto pt-16">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            return (
              <div key={message.id || `msg-${index}`} className="space-y-3">
                <div
                  className={`flex items-start gap-3 ${
                    message.role === "user" ? "justify-end" : ""
                  }`}
                >
                  {message.role === "user" ? (
                    // Human message bubble
                    <div className="flex items-start gap-3 max-w-[85%] md:max-w-[80%]">
                      <div className="relative group rounded-xl p-3 shadow-sm break-words bg-blue-600 text-white rounded-br-none">
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                      <div className="relative flex flex-shrink-0 mt-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">
                          <User className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // AI message bubble
                    <div className="flex items-start gap-3 max-w-[85%] md:max-w-[80%] w-full">
                      <div className="relative flex flex-shrink-0 mt-1">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-700 text-neutral-100 text-xs font-medium">
                          <Bot className="h-3 w-3" />
                        </div>
                      </div>
                      <div className="relative group rounded-xl p-3 shadow-sm break-words bg-neutral-700 text-neutral-100 rounded-bl-none w-full">
                        <div className="prose prose-invert max-w-none">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-neutral-400 hover:text-neutral-200 h-6 px-2"
                          onClick={() => handleCopy(message.content, message.id)}
                        >
                          {copiedMessageId === message.id ? (
                            <>
                              <CopyCheck className="h-3 w-3 mr-1" />
                              <span className="text-xs">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 mr-1" />
                              <span className="text-xs">Copy</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Loading state with activity timeline */}
          {isLoading && (
            <div className="flex items-start gap-3 mt-3">
              <div className="relative flex flex-shrink-0 mt-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-700 text-neutral-100 text-xs font-medium">
                  <Bot className="h-3 w-3" />
                </div>
              </div>
              <div className="relative group max-w-[85%] md:max-w-[80%] rounded-xl p-3 shadow-sm break-words bg-neutral-700 text-neutral-100 rounded-bl-none w-full min-h-[56px]">
                {processedEvents.length > 0 ? (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-neutral-200 mb-3">🔄 Agent Workflow</h4>
                    {processedEvents.map((event, index) => (
                      <div 
                        key={`${event.author}-${index}`}
                        className="flex items-start gap-2 p-2 rounded bg-neutral-800/50"
                      >
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs px-2 py-0.5">
                              {event.title}
                            </Badge>
                            <span className="text-xs text-neutral-400">
                              {formatTimestamp(event.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-300">
                            {event.data}
                          </p>
                          {event.details && (
                            <div className="text-xs text-neutral-400 mt-1 bg-neutral-900/50 p-1.5 rounded">
                              {event.details.length > 150 ? `${event.details.substring(0, 150)}...` : event.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-2">
                      <div className="animate-spin h-3 w-3 border border-blue-400 border-t-transparent rounded-full"></div>
                      <span className="text-sm text-neutral-300">Processing...</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                    <span className="text-sm text-neutral-300">Initializing agents...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Input area - fixed at bottom */}
      <div className="flex-shrink-0 border-t border-neutral-700/50 bg-neutral-800">
        <div className="max-w-4xl mx-auto">
          <InputForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onCancel={handleCancel}
            hasHistory={messages.length > 0}
          />
        </div>
      </div>
    </div>
  );
}