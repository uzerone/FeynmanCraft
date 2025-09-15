import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Clock, BarChart3, Minimize2, Maximize2 } from 'lucide-react';

interface ProcessedEvent {
  title: string;
  data: string;
  timestamp: number;
  author: string;
  details?: string;
  traceInfo?: {
    traceId: string;
    stepId: string;
    sessionId?: string;
    tool?: string;
    duration?: number;
    stage?: string;
    status?: string;
    correlationChain?: string[];
  };
}

interface EventGroup {
  type: 'Planning' | 'Transfer' | 'Search' | 'Validation' | 'Generation' | 'Compilation' | 'Response' | 'Other';
  events: ProcessedEvent[];
  totalDuration: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
}

interface AgentWorkflowEnhancedProps {
  events: ProcessedEvent[];
  isLoading: boolean;
  isCompleted?: boolean;
  pollingStatus?: string;
}

export function AgentWorkflowEnhanced({ events, isLoading, isCompleted, pollingStatus }: AgentWorkflowEnhancedProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showLatencies, setShowLatencies] = useState(false);
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number) => {
    return `${duration}ms`;
  };

  // Group events by stage type with deduplication
  const groupEvents = (): EventGroup[] => {
    const groups = new Map<string, ProcessedEvent[]>();
    const seenEvents = new Set<string>();
    
    events.forEach(event => {
      // Create unique key to prevent duplicates
      const eventKey = `${event.author}_${event.title}_${Math.floor(event.timestamp / 1000)}`;
      if (seenEvents.has(eventKey)) return;
      seenEvents.add(eventKey);
      
      let groupType = 'Other';
      
      if (event.title.includes('Planning')) {
        groupType = 'Planning';
      } else if (event.title.includes('Transfer')) {
        groupType = 'Transfer';
      } else if (event.title.includes('Search')) {
        groupType = 'Search';
      } else if (event.title.includes('Validation')) {
        groupType = 'Validation';
      } else if (event.title.includes('Generation')) {
        groupType = 'Generation';
      } else if (event.title.includes('Compilation')) {
        groupType = 'Compilation';
      } else if (event.title.includes('Response')) {
        groupType = 'Response';
      }
      
      if (!groups.has(groupType)) {
        groups.set(groupType, []);
      }
      groups.get(groupType)!.push(event);
    });

    // Convert to EventGroup array with statistics
    return Array.from(groups.entries()).map(([type, groupEvents]) => {
      const durations = groupEvents
        .map(e => e.traceInfo?.duration || 0)
        .filter(d => d > 0)
        .sort((a, b) => a - b);

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0;
      const p50Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.5)] : 0;
      const p95Duration = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;

      return {
        type: type as EventGroup['type'],
        events: groupEvents,
        totalDuration,
        avgDuration,
        p50Duration,
        p95Duration
      };
    }).sort((a, b) => {
      // Sort by first event timestamp in group
      const aTime = Math.min(...a.events.map(e => e.timestamp));
      const bTime = Math.min(...b.events.map(e => e.timestamp));
      return aTime - bTime;
    });
  };

  const toggleGroup = (groupType: string) => {
    const newCollapsed = new Set(collapsedGroups);
    if (newCollapsed.has(groupType)) {
      newCollapsed.delete(groupType);
    } else {
      newCollapsed.add(groupType);
    }
    setCollapsedGroups(newCollapsed);
  };

  const collapseAll = () => {
    const allGroups = groupEvents().map(g => g.type);
    setCollapsedGroups(new Set(allGroups));
  };

  const expandAll = () => {
    setCollapsedGroups(new Set());
  };

  const eventGroups = groupEvents();

  // Always show workflow if loading or has events
  if (!isLoading && events.length === 0) {
    return null;
  }

  const getGroupIcon = (type: EventGroup['type']) => {
    switch (type) {
      case 'Planning': return '📋';
      case 'Transfer': return '🔄';
      case 'Search': return '📚';
      case 'Validation': return '⚖️';
      case 'Generation': return '🎨';
      case 'Compilation': return '⚙️';
      case 'Response': return '✅';
      default: return '📌';
    }
  };

  const getGroupColor = (type: EventGroup['type']) => {
    switch (type) {
      case 'Planning': return 'bg-blue-500/10 border-blue-500/30';
      case 'Transfer': return 'bg-purple-500/10 border-purple-500/30';
      case 'Search': return 'bg-green-500/10 border-green-500/30';
      case 'Validation': return 'bg-yellow-500/10 border-yellow-500/30';
      case 'Generation': return 'bg-orange-500/10 border-orange-500/30';
      case 'Compilation': return 'bg-red-500/10 border-red-500/30';
      case 'Response': return 'bg-emerald-500/10 border-emerald-500/30';
      default: return 'bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="openwebui-card w-full">
      {/* Enhanced Header */}
      <div className="flex flex-wrap items-center gap-3 p-4 border-b border-border/10">
        {/* Title area - can truncate, allows shrinking */}
        <div className="flex-1 min-w-0 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-primary animate-pulse'}`}></div>
            <h4 className="text-base font-medium text-card-foreground">
              Agent Workflow {isCompleted && '(Completed)'}
            </h4>
          </div>
          {eventGroups.length > 1 && (
            <Badge variant="secondary" className="text-xs shrink-0 px-2 py-1">
              {eventGroups.length} stages
            </Badge>
          )}
        </div>
        
        {/* Button area - no shrinking, can wrap on small screens */}
        <div className="flex items-center gap-2 shrink-0">
          {events.length > 0 && (
            <>
              <button
                onClick={() => setShowLatencies(!showLatencies)}
                className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                title="Toggle latency display"
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              
              {eventGroups.length > 1 && (
                <>
                  <button
                    onClick={collapseAll}
                    className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Collapse all stages"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={expandAll}
                    className="p-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Expand all stages"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </>
              )}
              
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Expand ({events.length} events)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Event timeline with swim lanes */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {eventGroups.map((group) => {
            const isGroupCollapsed = collapsedGroups.has(group.type);
            
            return (
              <div 
                key={group.type}
                className="openwebui-card border-l-2 border-l-primary/50"
              >
                {/* Group Header */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 rounded-lg transition-colors"
                  onClick={() => toggleGroup(group.type)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getGroupIcon(group.type)}</span>
                    <span className="font-medium text-card-foreground">{group.type}</span>
                    <Badge variant="outline" className="text-xs">
                      {group.events.length}
                    </Badge>
                    {showLatencies && group.p50Duration > 0 && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>P50: {formatDuration(group.p50Duration)}</span>
                        <span>P95: {formatDuration(group.p95Duration)}</span>
                        <span>Avg: {formatDuration(group.avgDuration)}</span>
                      </div>
                    )}
                  </div>
                  {isGroupCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </div>

                {/* Group Events */}
                {!isGroupCollapsed && (
                  <div className="space-y-2 px-3 pb-3">
                    {group.events.map((event, index) => (
                      <div 
                        key={`${event.author}-${index}`}
                        className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm border border-border/10"
                      >
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant="secondary" className="text-xs px-2 py-1 font-medium">
                              {event.title}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(event.timestamp)}
                            </span>
                            {event.traceInfo && (
                              <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground font-mono">
                                <span title={`Trace ID: ${event.traceInfo.traceId}`} className="bg-muted/50 px-2 py-0.5 rounded">
                                  #{event.traceInfo.traceId.substring(0, 8)}
                                </span>
                                <span title={`Step ID: ${event.traceInfo.stepId}`} className="bg-muted/50 px-2 py-0.5 rounded">
                                  .{event.traceInfo.stepId}
                                </span>
                                {event.traceInfo.sessionId && (
                                  <span title={`Session ID: ${event.traceInfo.sessionId}`} className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">
                                    @{event.traceInfo.sessionId.substring(0, 6)}
                                  </span>
                                )}
                                {event.traceInfo.stage && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-purple-400 border-purple-400/30 bg-purple-400/10">
                                    {event.traceInfo.stage}
                                  </Badge>
                                )}
                                {event.traceInfo.tool && (
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 text-cyan-400 border-cyan-400/30 bg-cyan-400/10">
                                    {event.traceInfo.tool}
                                  </Badge>
                                )}
                                {event.traceInfo.duration && (
                                  <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded font-medium">
                                    {formatDuration(event.traceInfo.duration)}
                                  </span>
                                )}
                                {event.traceInfo.status && (
                                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                                    event.traceInfo.status === 'completed' ? 'text-green-400 bg-green-400/10' :
                                    event.traceInfo.status === 'failed' ? 'text-red-400 bg-red-400/10' :
                                    event.traceInfo.status === 'started' ? 'text-yellow-400 bg-yellow-400/10' :
                                    'text-muted-foreground bg-muted/50'
                                  }`}>
                                    {event.traceInfo.status}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-card-foreground mb-2">
                            {event.data}
                          </p>
                          {event.details && (
                            <div className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded-lg">
                              {event.details.length > 100 ? `${event.details.substring(0, 100)}...` : event.details}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* Enhanced loading indicator */}
          {isLoading && !isCompleted && (
            <div className="openwebui-card border-l-4 border-l-primary animate-pulse">
              <div className="flex items-center gap-3 p-3">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                <span className="text-sm text-card-foreground font-medium">
                  {pollingStatus || 'Processing...'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && eventGroups.length > 0 && (
        <div className="p-4 border-t border-border/20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Stages: {eventGroups.map(g => `${getGroupIcon(g.type)} ${g.events.length}`).join(', ')}</span>
            {showLatencies && (
              <span className="ml-2 font-medium">
                Total time: {formatDuration(eventGroups.reduce((sum, g) => sum + g.totalDuration, 0))}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}