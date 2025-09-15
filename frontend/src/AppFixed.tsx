import React, { useState, useEffect, useRef, useCallback } from "react";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { InputForm } from "@/components/InputForm";
import { Button } from "@/components/ui/button";
import { useADKEnhanced } from "@/hooks/useADKEnhanced";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";
import { CopyCheck, Copy, AlertCircle, User, Bot, RefreshCw, Server, WifiOff } from "lucide-react";
import { AgentWorkflowEnhanced } from "@/components/AgentWorkflowEnhanced";
import { FeynmanCraftWorkflow } from "@/components/FeynmanCraftWorkflow";
import { LogPanelFixed } from "@/components/LogPanelFixed";
import { ErrorCard, StructuredError, parseErrorFromMessage, ErrorAction } from "@/components/ErrorCard";
import { ErrorCardPanel } from "@/components/ErrorCardPanel";
import { ToolOrchestrationDashboard } from "@/components/ToolOrchestrationDashboard";
import { HeaderFixed } from "@/components/HeaderFixed";
import { useBackendLogger } from "@/hooks/useBackendLogger";

const MAX_HISTORICAL_WORKFLOWS = 10;

export default function AppFixed() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [completedWorkflows, setCompletedWorkflows] = useState<Record<string, any>>({});
  const [shouldClearInput, setShouldClearInput] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'workflow' | 'logs'>('workflow');

  const { logs, logger, clearLogs, processADKEvents } = useBackendLogger();
  
  const { 
    messages, 
    processedEvents, 
    isLoading, 
    error, 
    connectionStatus,
    sendMessage, 
    stop,
    checkConnection,
    pollingStatus,
    sseEnabled,
    sseConnectionStatus,
    structuredErrors,
    dismissError,
    clearAllErrors,
    executeErrorAction
  } = useADKEnhanced();

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
  }, [messages.length, processedEvents.length]);

  // Log connection status changes
  useEffect(() => {
    if (connectionStatus.isConnected) {
      logger.info('frontend', 'Backend connection established');
    } else if (connectionStatus.error) {
      logger.error('frontend', 'Backend connection lost', { error: connectionStatus.error });
    }
  }, [connectionStatus.isConnected, connectionStatus.error, logger]);

  // Enhanced error handling with structured errors
  useEffect(() => {
    if (error) {
      logger.error('frontend', 'Error occurred', error);
      
      // Parse error into structured format - handled by the hook
      const structuredError = parseErrorFromMessage(error);
      if (structuredError) {
        // Error handling is managed by useADKEnhanced hook
        console.log('Parsed structured error:', structuredError);
      }
    }
  }, [error, logger]);

  // Process events for logging
  useEffect(() => {
    if (processedEvents.length > 0) {
      processADKEvents(processedEvents);
    }
  }, [processedEvents, processADKEvents]);

  // Save completed workflows with cleanup - fix infinite loop
  useEffect(() => {
    if (!isLoading && processedEvents.length > 0 && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && !completedWorkflows[lastMessage.id]) {
        setCompletedWorkflows(prev => {
          const updated = {
            ...prev,
            [lastMessage.id]: [...processedEvents]
          };
          
          // Cleanup old workflows
          const keys = Object.keys(updated);
          if (keys.length > MAX_HISTORICAL_WORKFLOWS) {
            const keysToDelete = keys.slice(0, keys.length - MAX_HISTORICAL_WORKFLOWS);
            keysToDelete.forEach(key => delete updated[key]);
          }
          
          return updated;
        });
        
        logger.info('frontend', 'Workflow completed', { 
          messageId: lastMessage.id, 
          steps: processedEvents.length 
        });
      }
    }
  }, [isLoading, processedEvents.length, messages.length]);

  const handleSubmit = useCallback(async (submittedInputValue: string) => {
    if (!submittedInputValue.trim()) return;
    
    setShouldClearInput(false);
    
    try {
      await sendMessage(submittedInputValue);
      setShouldClearInput(true);
    } catch (err) {
      console.error('Submit error:', err);
    }
  }, [sendMessage]);

  const handleCancel = useCallback(() => {
    stop();
  }, [stop]);

  const handleCopy = useCallback(async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }, []);

  const handleRetry = useCallback(async () => {
    await checkConnection();
  }, [checkConnection]);

  // Handle error card actions
  const handleErrorAction = useCallback((errorId: string, action: ErrorAction) => {
    // Find the error to get details for logging
    const error = structuredErrors.find(e => e.id === errorId);
    if (!error) return;
    
    switch (action) {
      case 'retry':
        logger.info('frontend', `Retrying error: ${error.title}`, { errorId });
        // The actual retry logic would be implemented here
        executeErrorAction(errorId, action);
        break;
        
      case 'degrade':
        logger.info('frontend', `Degrading gracefully for error: ${error.title}`, { errorId });
        executeErrorAction(errorId, action);
        break;
        
      case 'ignore':
        logger.info('frontend', `Ignoring error: ${error.title}`, { errorId });
        executeErrorAction(errorId, action);
        break;
        
      default:
        break;
    }
  }, [logger, structuredErrors, executeErrorAction]);

  const toggleLogPanel = useCallback(() => {
    setIsLogPanelOpen(prev => !prev);
  }, []);

  // Copy server info for debugging
  const copyServerInfo = useCallback(async () => {
    const info = connectionStatus.serverInfo;
    const serverDetails = `
FeynmanCraft Demo Environment
============================
Backend: ${info?.edition || 'ADK'} 
Uptime: ${Math.floor((info?.uptime || 0) / 60)} minutes
MCP Tools: ${info?.tools_count || 0}
CORS Status: ${info?.cors_status || 'Unknown'}
Connection: ${connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
Last Checked: ${new Date(connectionStatus.lastChecked).toISOString()}

Available Physics Tools:
- search_particle, get_property, list_decays
- find_decays, list_properties, resolve_identifier  
- database_info, get_property_details

Citation: ParticlePhysics MCP Server v1.0.0
Database: PDG 2025 edition
    `.trim();
    
    try {
      await navigator.clipboard.writeText(serverDetails);
      logger.info('frontend', 'Server info copied to clipboard');
    } catch (err) {
      console.error('Failed to copy server info:', err);
    }
  }, [connectionStatus, logger]);


  // Function to safely render content
  const renderMessageContent = useCallback((content: string) => {
    try {
      // Check if content is JSON
      if ((content.trim().startsWith('{') && content.trim().endsWith('}')) || 
          (content.trim().startsWith('[') && content.trim().endsWith(']'))) {
        const parsed = JSON.parse(content);
        return (
          <pre className="overflow-x-auto text-xs bg-neutral-800 p-2 rounded max-w-full">
            <code>{JSON.stringify(parsed, null, 2)}</code>
          </pre>
        );
      }
    } catch (e) {
      // Not JSON, render as markdown
    }
    
    return <ReactMarkdown>{content}</ReactMarkdown>;
  }, []);

  // Backend not connected screen
  if (!connectionStatus.isConnected && messages.length === 0) {
    return (
      <div className="flex h-screen bg-background text-foreground font-sans antialiased transition-all duration-200">
        <HeaderFixed
          isLogPanelOpen={isLogPanelOpen}
          onToggleLogPanel={toggleLogPanel}
          logs={logs}
          connectionStatus={connectionStatus}
          sseEnabled={sseEnabled}
          sseConnectionStatus={sseConnectionStatus}
          onCopyServerInfo={copyServerInfo}
        />
        <main className="h-full w-full max-w-4xl mx-auto pt-14">
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <Server className="h-12 w-12 text-red-400" />
                <WifiOff className="h-8 w-8 text-red-400" />
              </div>
              <h1 className="text-3xl font-bold text-red-400">Backend Not Available</h1>
              <div className="text-center max-w-md">
                <p className="text-neutral-300 mb-2">
                  Cannot connect to the FeynmanCraft ADK backend server.
                </p>
                <p className="text-sm text-neutral-400">
                  {connectionStatus.error || 'Please ensure the backend is running on port 8000.'}
                </p>
              </div>
              
              <div className="flex flex-col gap-3 mt-4">
                <Button
                  onClick={handleRetry}
                  className="flex items-center gap-2"
                  variant="default"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry Connection
                </Button>
                
                <div className="text-xs text-neutral-500 text-center">
                  <p>To start the backend, run:</p>
                  <code className="bg-neutral-700 px-2 py-1 rounded mt-1 inline-block">
                    adk web . --port 8000
                  </code>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Render FeynmanCraft Workflow interface
  if (messages.length === 0) {
    return (
      <div className="flex h-screen bg-background text-foreground font-sans antialiased transition-all duration-200">
        <HeaderFixed
          isLogPanelOpen={isLogPanelOpen}
          onToggleLogPanel={toggleLogPanel}
          logs={logs}
          title="FeynmanCraft Physics Diagram Generator"
          connectionStatus={connectionStatus}
          sseEnabled={sseEnabled}
          sseConnectionStatus={sseConnectionStatus}
          onCopyServerInfo={copyServerInfo}
        />
        <div className="flex flex-1" style={{ paddingTop: '56px' }}>
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-6">
              <FeynmanCraftWorkflow
                events={processedEvents}
                isLoading={isLoading}
                isCompleted={false}
                pollingStatus={pollingStatus}
                onStop={handleCancel}
                onSubmit={handleSubmit}
              />
            </div>
          </main>

          {/* Simplified Right Panel */}
          <div className="w-80 border-l bg-card flex-shrink-0 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="flex border-b">
                <button
                  onClick={() => setRightPanelTab('workflow')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    rightPanelTab === 'workflow'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Workflow
                </button>
                <button
                  onClick={() => setRightPanelTab('logs')}
                  className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                    rightPanelTab === 'logs'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Logs
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {rightPanelTab === 'workflow' && (
                  <div className="p-4 space-y-4">
                    <div className="rounded-lg border p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-2 w-2 rounded-full ${
                          connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <span className="text-sm font-medium">Connection Status</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {connectionStatus.isConnected ? 'Connected to ADK backend' : 'Disconnected'}
                      </p>
                    </div>

                    {processedEvents.length > 0 && (
                      <div className="rounded-lg border p-4">
                        <h4 className="text-sm font-medium mb-2">Current Activity</h4>
                        <div className="space-y-2">
                          {processedEvents.slice(-3).map((event, index) => (
                            <div key={index} className="text-xs text-muted-foreground">
                              <span className="font-medium">{event.title}</span>
                              <br />
                              <span>{event.data.slice(0, 50)}...</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {rightPanelTab === 'logs' && (
                  <LogPanelFixed
                    logs={logs}
                    onClearLogs={clearLogs}
                    className="h-full"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex h-screen bg-background text-foreground font-sans antialiased transition-all duration-200">
        <HeaderFixed
          isLogPanelOpen={isLogPanelOpen}
          onToggleLogPanel={toggleLogPanel}
          logs={logs}
          connectionStatus={connectionStatus}
          sseEnabled={sseEnabled}
          sseConnectionStatus={sseConnectionStatus}
          onCopyServerInfo={copyServerInfo}
        />
        <main className="h-full w-full max-w-4xl mx-auto pt-14">
          <div className="flex flex-col items-center justify-center h-full">
            <div className="flex flex-col items-center justify-center gap-4">
              <AlertCircle className="h-16 w-16 text-red-400" />
              <h1 className="text-2xl text-red-400 font-bold">Request Error</h1>
              <p className="text-red-400 text-center max-w-md">{error}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRetry}
                >
                  Check Connection
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground antialiased relative transition-all duration-200">
      <HeaderFixed
        isLogPanelOpen={isLogPanelOpen}
        onToggleLogPanel={toggleLogPanel}
        logs={logs}
        connectionStatus={connectionStatus}
        sseEnabled={sseEnabled}
        sseConnectionStatus={sseConnectionStatus}
        onCopyServerInfo={copyServerInfo}
      />
      
      {/* Main content */}
      <div className="flex flex-1" style={{ paddingTop: '56px' }}>
        {/* Left side - Main chat area */}
        <div className="flex flex-col flex-1 xl:pr-80 min-w-0">
          <ScrollArea ref={scrollAreaRef} className="flex-1 overflow-y-auto scrollbar-themed">
            <div className="responsive-padding space-y-6 chat-width mx-auto" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-lg)' }}>
              {messages.map((message, index) => {
                return (
                  <div key={message.id || `msg-${index}`} className="space-y-3">
                    <div
                      className={`flex items-start gap-3 ${
                        message.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {message.role === "user" ? (
                        // Human message bubble - OpenWebUI style
                        <div className="flex items-start gap-4 justify-end">
                          <div className="chat-bubble chat-bubble-user px-4 py-3 max-w-[80%] md:max-w-[70%]">
                            <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 mt-1">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <User className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        // AI message bubble - OpenWebUI style
                        <div className="flex flex-col gap-4 w-full">
                          <div className="flex items-start gap-4 w-full">
                            <div className="flex flex-shrink-0 mt-1">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                <Bot className="h-4 w-4" />
                              </div>
                            </div>
                            <div className="chat-bubble chat-bubble-assistant px-4 py-3 w-full min-w-0 overflow-hidden">
                              <div className="prose prose-sm max-w-none dark:prose-invert leading-relaxed">
                                {renderMessageContent(message.content)}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-3 text-muted-foreground hover:text-foreground h-7 px-2 text-xs opacity-60 hover:opacity-100 transition-opacity"
                                onClick={() => handleCopy(message.content, message.id)}
                              >
                                {copiedMessageId === message.id ? (
                                  <>
                                    <CopyCheck className="h-3 w-3 mr-1.5" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 mr-1.5" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                          
                          {/* Show completed workflow for this message */}
                          {completedWorkflows[message.id] && (
                            <div className="flex items-start gap-4 ml-12">
                              <AgentWorkflowEnhanced 
                                events={completedWorkflows[message.id]} 
                                isLoading={false} 
                                isCompleted={true}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {/* Structured Error Cards */}
              <ErrorCardPanel 
                errors={structuredErrors}
                onDismissError={dismissError}
                onExecuteAction={executeErrorAction}
                onClearAllErrors={clearAllErrors}
              />
              
              {/* Loading state with activity timeline */}
              {isLoading && (
                <div className="flex items-start gap-4 mt-4">
                  <div className="flex flex-shrink-0 mt-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Bot className="h-4 w-4" />
                    </div>
                  </div>
                  <AgentWorkflowEnhanced 
                    events={processedEvents} 
                    isLoading={true} 
                    isCompleted={false}
                    pollingStatus={pollingStatus}
                  />
                </div>
              )}
              
              {/* Structured Error Cards */}
              {structuredErrors.length > 0 && (
                <div className="flex flex-col gap-3 mt-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-red-300">
                      Active Issues ({structuredErrors.length})
                    </span>
                  </div>
                  {structuredErrors.map(error => (
                    <ErrorCard
                      key={error.id}
                      error={error as unknown as StructuredError}
                      onAction={handleErrorAction}
                      isCompact={structuredErrors.length > 2}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input area - fixed at bottom */}
          <div className="flex-shrink-0 border-t transition-all duration-200" style={{ borderColor: 'rgb(var(--border-secondary))', backgroundColor: 'rgb(var(--bg-primary) / 0.8)', backdropFilter: 'blur(12px)' }}>
            <div className="chat-width mx-auto responsive-padding" style={{ padding: 'var(--space-lg)' }}>
              <InputForm
                onSubmit={handleSubmit}
                isLoading={isLoading || !connectionStatus.isConnected}
                onCancel={handleCancel}
                hasHistory={messages.length > 0}
                shouldClearInput={shouldClearInput}
              />
            </div>
          </div>
        </div>

        {/* Simplified Right Panel for Chat History */}
        <div className="w-80 border-l bg-card flex-shrink-0 xl:absolute xl:right-0 xl:h-full overflow-hidden"
             style={{ top: '56px', height: 'calc(100vh - 56px)' }}>
          <div className="h-full flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-medium text-foreground">Chat History</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-sm text-muted-foreground">
                Chat messages will appear here once conversation starts.
              </div>
            </div>
          </div>
        </div>
      </div>
          
      {/* Log Panel */}
      <LogPanelFixed 
        isOpen={isLogPanelOpen}
        onClose={() => setIsLogPanelOpen(false)}
        logs={logs}
        onClear={clearLogs}
      />
    </div>
  );
}