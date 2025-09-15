import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface ProcessedEvent {
  title: string;
  data: string;
  timestamp: number;
  author: string;
  details?: string;
  traceInfo?: {
    traceId: string;
    stepId: string;
    tool?: string;
    duration?: number;
  };
}

interface AgentWorkflowProps {
  events: ProcessedEvent[];
  isLoading: boolean;
  isCompleted?: boolean;
  pollingStatus?: string;
}

export function AgentWorkflow({ events, isLoading, isCompleted, pollingStatus }: AgentWorkflowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Always show workflow if loading or has events
  if (!isLoading && events.length === 0) {
    return null;
  }

  return (
    <div className="relative group max-w-[85%] md:max-w-[80%] rounded-xl p-3 shadow-sm break-words bg-neutral-700 text-neutral-100 rounded-bl-none w-full">
      {/* Header with expand/collapse button */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-neutral-200">
          🔄 Agent Workflow {isCompleted && '(Completed)'}
        </h4>
        {events.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-2 text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Expand ({events.length} steps)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Event timeline */}
      {isExpanded && (
        <div className="space-y-2">
          {events.map((event, index) => (
            <div 
              key={`${event.author}-${index}`}
              className={`flex items-start gap-2 p-2 rounded bg-neutral-800/50 border-l-2 ${
                isCompleted ? 'border-green-500/30' : 'border-blue-500/30'
              }`}
            >
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs px-2 py-0.5">
                    {event.title}
                  </Badge>
                  <span className="text-xs text-neutral-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(event.timestamp)}
                  </span>
                  {event.traceInfo && (
                    <span className="text-xs text-neutral-500 font-mono">
                      #{event.traceInfo.traceId}
                      {event.traceInfo.duration && (
                        <span className="text-green-400 ml-1">
                          • {event.traceInfo.duration}ms
                        </span>
                      )}
                    </span>
                  )}
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
          
          {/* Enhanced loading indicator */}
          {isLoading && !isCompleted && (
            <div className="flex items-center gap-2 pt-2">
              <div className="animate-spin h-3 w-3 border border-blue-400 border-t-transparent rounded-full"></div>
              <span className="text-sm text-neutral-300">
                {pollingStatus || 'Processing...'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && events.length > 0 && (
        <div className="text-sm text-neutral-400">
          Last step: {events[events.length - 1].title} at {formatTimestamp(events[events.length - 1].timestamp)}
        </div>
      )}
    </div>
  );
}