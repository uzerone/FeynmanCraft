import { useState, useEffect, useRef } from "react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Button } from "@/components/ui/button";
import { useADKImproved } from "@/hooks/useADKImproved";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import { Copy, CopyCheck, AlertCircle } from "lucide-react";

export default function AppImproved() {
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
    <div className="flex h-screen bg-neutral-800 text-neutral-100 font-sans antialiased">
      <main className="h-full w-full max-w-6xl mx-auto flex gap-4 p-4">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <Card key={message.id} className={`${
                  message.role === 'user' 
                    ? 'bg-blue-900/20 border-blue-700/50' 
                    : 'bg-neutral-700/50 border-neutral-600/50'
                }`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {message.role === 'user' ? '👤 You' : `🤖 ${message.author || 'Assistant'}`}
                      </CardTitle>
                      <span className="text-xs text-neutral-400">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                    {message.role === 'assistant' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-neutral-400 hover:text-neutral-200"
                        onClick={() => handleCopy(message.content, message.id)}
                      >
                        {copiedMessageId === message.id ? (
                          <>
                            <CopyCheck className="h-4 w-4 mr-2" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {isLoading && (
                <Card className="bg-neutral-700/50 border-neutral-600/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      <span>Generating response...</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
          
          {/* Input area */}
          <div className="mt-4 p-4 bg-neutral-700/50 rounded-lg">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask for a Feynman diagram..."
                className="flex-1 bg-neutral-600 text-white rounded px-3 py-2 border border-neutral-500 focus:border-blue-400 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const target = e.target as HTMLInputElement;
                    if (target.value.trim()) {
                      handleSubmit(target.value);
                      target.value = '';
                    }
                  }
                }}
                disabled={isLoading}
              />
              {isLoading ? (
                <Button 
                  variant="destructive" 
                  onClick={handleCancel}
                  className="min-w-[80px]"
                >
                  Stop
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      handleSubmit(input.value);
                      input.value = '';
                    }
                  }}
                  className="min-w-[80px]"
                >
                  Generate
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Agent timeline sidebar */}
        <div className="w-80 flex flex-col">
          <Card className="h-full bg-neutral-900/50 border-neutral-700/50">
            <CardHeader>
              <CardTitle className="text-lg">🔄 Agent Workflow</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {processedEvents.map((event, index) => (
                    <div 
                      key={`${event.author}-${index}`}
                      className="border-l-2 border-blue-500/30 pl-3 pb-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {event.title}
                        </Badge>
                      </div>
                      <p className="text-sm text-neutral-300 mb-1">
                        {event.data}
                      </p>
                      {event.details && (
                        <div className="text-xs text-neutral-400 bg-neutral-800/50 p-2 rounded">
                          {event.details}
                        </div>
                      )}
                      <p className="text-xs text-neutral-500 mt-1">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>
                  ))}
                  
                  {isLoading && processedEvents.length === 0 && (
                    <div className="text-center text-neutral-400 py-4">
                      <div className="animate-spin h-6 w-6 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm">Initializing agents...</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}