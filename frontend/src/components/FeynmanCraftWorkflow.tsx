import { useState, useCallback, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock, Play, Square, RotateCcw, CheckCircle, AlertCircle, Zap, Loader2, Pause, ArrowRight } from 'lucide-react';

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
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface FeynmanCraftWorkflowProps {
  events: ProcessedEvent[];
  isLoading: boolean;
  isCompleted?: boolean;
  pollingStatus?: string;
  onStop?: () => void;
  onSubmit?: (input: string) => void;
}

// Workflow presets
const WORKFLOW_PRESETS = [
  {
    id: 'basic-qed',
    title: 'Basic QED Process',
    description: 'Simple electron-positron interactions',
    example: 'Generate a Feynman diagram for electron-positron annihilation to photons'
  },
  {
    id: 'loop-corrections',
    title: 'Loop Corrections',
    description: 'One-loop quantum corrections',
    example: 'Draw the one-loop QED correction to electron-muon scattering'
  },
  {
    id: 'multi-particle',
    title: 'Multi-particle Collision',
    description: 'Complex scattering processes',
    example: 'Show the Feynman diagram for proton-proton collision producing W and Z bosons'
  },
  {
    id: 'decay-chain',
    title: 'Decay Chain Analysis',
    description: 'Sequential decay processes',
    example: 'Generate diagrams for the decay chain: τ → μ + ν_μ + ν_τ'
  }
];

export function FeynmanCraftWorkflow({
  events,
  isLoading,
  isCompleted,
  pollingStatus,
  onStop,
  onSubmit
}: FeynmanCraftWorkflowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [inputText, setInputText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<'ready' | 'running' | 'paused' | 'completed' | 'error'>('ready');
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [completedStages, setCompletedStages] = useState<Set<string>>(new Set());

  // Update workflow status based on props
  useEffect(() => {
    if (isCompleted) {
      setWorkflowStatus('completed');
    } else if (isLoading) {
      setWorkflowStatus('running');
    } else {
      setWorkflowStatus('ready');
    }
  }, [isLoading, isCompleted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isLoading && inputText.trim()) {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        handleStopClick();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, inputText]);

  // Estimate time remaining based on average durations
  useEffect(() => {
    const eventGroups = groupEvents();
    if (isLoading && eventGroups.length > 0) {
      const totalAvgTime = eventGroups.reduce((sum, group) => sum + group.avgDuration, 0);
      setEstimatedTime(totalAvgTime);
    } else {
      setEstimatedTime(null);
    }
  }, [events, isLoading]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number) => {
    return `${duration}ms`;
  };

  // Group events by stage type with status determination
  const groupEvents = (): EventGroup[] => {
    const groups = new Map<string, ProcessedEvent[]>();
    const seenEvents = new Set<string>();

    events.forEach(event => {
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

    return Array.from(groups.entries()).map(([type, groupEvents]) => {
      const durations = groupEvents
        .map(e => e.traceInfo?.duration || 0)
        .filter(d => d > 0)
        .sort((a, b) => a - b);

      const totalDuration = durations.reduce((sum, d) => sum + d, 0);
      const avgDuration = durations.length > 0 ? Math.round(totalDuration / durations.length) : 0;

      // Determine status based on events
      let status: EventGroup['status'] = 'pending';
      const hasErrors = groupEvents.some(e => e.traceInfo?.status === 'failed');
      const hasCompleted = groupEvents.some(e => e.traceInfo?.status === 'completed');
      const hasInProgress = groupEvents.some(e => e.traceInfo?.status === 'started');

      if (hasErrors) {
        status = 'failed';
      } else if (hasCompleted) {
        status = 'completed';
      } else if (hasInProgress) {
        status = 'in_progress';
      }

      return {
        type: type as EventGroup['type'],
        events: groupEvents,
        totalDuration,
        avgDuration,
        status
      };
    }).sort((a, b) => {
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

  const handlePresetClick = (preset: typeof WORKFLOW_PRESETS[0]) => {
    setSelectedPreset(preset.id);
    setInputText(preset.example);

    // Smooth scroll to input area
    setTimeout(() => {
      const inputElement = document.querySelector('textarea');
      if (inputElement) {
        inputElement.focus();
        inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleSubmit = () => {
    if (inputText.trim() && onSubmit) {
      onSubmit(inputText.trim());
      setInputText('');
      setSelectedPreset(null);
      setWorkflowStatus('running');
      setShowStopConfirm(false);
    }
  };

  const handleStopClick = () => {
    if (showStopConfirm) {
      if (onStop) {
        onStop();
        setWorkflowStatus('ready');
      }
      setShowStopConfirm(false);
    } else {
      setShowStopConfirm(true);
      // Auto-hide confirmation after 3 seconds
      setTimeout(() => setShowStopConfirm(false), 3000);
    }
  };

  const handleReset = () => {
    setInputText('');
    setSelectedPreset(null);
    setShowStopConfirm(false);
    setCompletedStages(new Set());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    } else if (e.key === 'Escape' && isLoading) {
      handleStopClick();
    }
  };

  const eventGroups = groupEvents();

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

  const getGroupStatusColor = (status: EventGroup['status']) => {
    switch (status) {
      case 'completed': return 'border-green-500/30 bg-green-500/5';
      case 'in_progress': return 'border-blue-500/30 bg-blue-500/5';
      case 'failed': return 'border-red-500/30 bg-red-500/5';
      default: return 'border-gray-500/30 bg-gray-500/5';
    }
  };

  const getStatusIcon = (status: EventGroup['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress': return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">FeynmanCraft Workflow</h1>
        <p className="text-muted-foreground">Interactive Feynman diagram generation pipeline</p>
      </div>

      {/* Enhanced Preset Buttons */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Start Workflows
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKFLOW_PRESETS.map((preset, index) => (
            <button
              key={preset.id}
              onClick={() => handlePresetClick(preset)}
              disabled={isLoading}
              className={`group relative p-6 rounded-xl border-2 transition-all duration-300 text-left transform hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
                selectedPreset === preset.id
                  ? 'border-primary bg-primary/10 shadow-primary/20 shadow-lg'
                  : 'border-border bg-card hover:bg-accent hover:border-primary/50'
              }`}
              style={{
                animationDelay: `${index * 100}ms`,
                animation: 'fadeInUp 0.5s ease-out forwards'
              }}
            >
              {/* Selected indicator */}
              {selectedPreset === preset.id && (
                <div className="absolute -top-2 -right-2 h-6 w-6 bg-primary rounded-full flex items-center justify-center animate-in zoom-in-50 duration-200">
                  <CheckCircle className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {preset.title}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {preset.description}
                </div>
              </div>

              {/* Hover indicator */}
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ArrowRight className="h-4 w-4 text-primary" />
              </div>

              {/* Ripple effect placeholder */}
              <div className="absolute inset-0 rounded-xl bg-primary/5 opacity-0 group-active:opacity-100 transition-opacity duration-150"></div>
            </button>
          ))}
        </div>

        {/* Instruction text */}
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Click any workflow above to populate the input field with an example
        </div>
      </div>

      {/* Workflow Stages */}
      {eventGroups.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground">Workflow Stages</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Expand ({eventGroups.length} stages)
                </>
              )}
            </Button>
          </div>

          {isExpanded && (
            <div className="space-y-3">
              {eventGroups.map((group) => {
                const isGroupCollapsed = collapsedGroups.has(group.type);

                return (
                  <div
                    key={group.type}
                    className={`border-2 rounded-lg transition-all duration-200 hover:shadow-md ${getGroupStatusColor(group.status)}`}
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 rounded-lg transition-colors"
                      onClick={() => toggleGroup(group.type)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getGroupIcon(group.type)}</span>
                        <span className="font-medium text-foreground">{group.type}</span>
                        {getStatusIcon(group.status)}
                        <Badge variant="outline" className="text-xs">
                          {group.events.length} events
                        </Badge>
                        {group.avgDuration > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(group.avgDuration)} avg
                          </span>
                        )}
                      </div>
                      {isGroupCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </div>

                    {!isGroupCollapsed && (
                      <div className="px-4 pb-4 space-y-2">
                        {group.events.map((event, index) => (
                          <div
                            key={`${event.author}-${index}`}
                            className="flex items-start gap-3 p-3 rounded-lg bg-card/50 border border-border/10 hover:bg-accent/20 transition-colors text-sm"
                          >
                            <div className="flex flex-col flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <Badge variant="secondary" className="text-xs px-2 py-1">
                                  {event.title}
                                </Badge>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatTimestamp(event.timestamp)}
                                </span>
                                {event.traceInfo?.duration && (
                                  <span className="text-xs text-green-400 font-medium">
                                    {formatDuration(event.traceInfo.duration)}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-foreground">
                                {event.data}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Enhanced Live Status */}
      {isLoading && (
        <div className="mb-8 p-4 border-2 border-blue-500/30 bg-blue-500/5 rounded-lg animate-in slide-in-from-top-5 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {pollingStatus || 'Processing workflow...'}
              </span>
            </div>
            {estimatedTime && (
              <div className="text-xs text-muted-foreground">
                Est. {Math.round(estimatedTime / 1000)}s remaining
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full bg-blue-200/20 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-500 animate-pulse"
              style={{ width: `${Math.min((eventGroups.length * 20), 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success Animation */}
      {workflowStatus === 'completed' && (
        <div className="mb-8 p-4 border-2 border-green-500/30 bg-green-500/5 rounded-lg animate-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 animate-in zoom-in-50 duration-300" />
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <span className="text-sm font-medium text-foreground">
              Workflow completed successfully!
            </span>
          </div>
        </div>
      )}

      {/* Enhanced Input Area */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Input Header */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Play className="h-4 w-4" />
                Workflow Input
              </h4>
              {selectedPreset && (
                <Badge variant="secondary" className="text-xs">
                  Using: {WORKFLOW_PRESETS.find(p => p.id === selectedPreset)?.title}
                </Badge>
              )}
            </div>

            {/* Enhanced Input Field */}
            <div className="relative group">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Describe your Feynman diagram workflow..."
                maxLength={1000}
                className={`w-full min-h-[120px] sm:min-h-[140px] p-4 sm:p-6 rounded-xl border-2 transition-all duration-200 resize-none focus:outline-none ${
                  inputText.trim()
                    ? 'border-primary/50 bg-card focus:border-primary focus:ring-2 focus:ring-primary/20'
                    : 'border-border bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/10'
                } ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/30'} text-foreground placeholder-muted-foreground`}
                disabled={isLoading}
              />

              {/* Character Counter with Style */}
              <div className={`absolute bottom-3 right-3 text-xs transition-colors duration-200 ${
                inputText.length > 800 ? 'text-yellow-500' :
                inputText.length > 950 ? 'text-red-500' :
                'text-muted-foreground'
              }`}>
                {inputText.length}/1000
              </div>

              {/* Focus indicator */}
              <div className="absolute inset-0 rounded-xl border-2 border-primary opacity-0 group-focus-within:opacity-20 transition-opacity duration-200 pointer-events-none"></div>
            </div>

            {/* Enhanced Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Left side - Info and Status */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {/* Keyboard shortcuts - hidden on mobile */}
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  <span>Ctrl+Enter to submit • Escape to stop</span>
                </div>

                {/* Workflow Status Indicator */}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`h-2 w-2 rounded-full transition-all duration-200 ${
                    workflowStatus === 'ready' ? 'bg-gray-500' :
                    workflowStatus === 'running' ? 'bg-blue-500 animate-pulse' :
                    workflowStatus === 'completed' ? 'bg-green-500' :
                    workflowStatus === 'error' ? 'bg-red-500' : 'bg-gray-500'
                  }`}></div>
                  <span className="text-muted-foreground capitalize font-medium">
                    {workflowStatus}
                  </span>
                  {estimatedTime && workflowStatus === 'running' && (
                    <span className="text-xs text-muted-foreground ml-2">
                      (~{Math.round(estimatedTime / 1000)}s)
                    </span>
                  )}
                </div>
              </div>

              {/* Right side - Action buttons */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Enhanced Stop Button with Confirmation */}
                {isLoading && onStop && (
                  <div className="relative">
                    <Button
                      onClick={handleStopClick}
                      variant="destructive"
                      size="sm"
                      className={`transition-all duration-200 ${
                        showStopConfirm
                          ? 'bg-red-700 hover:bg-red-800 animate-pulse'
                          : 'bg-red-600 hover:bg-red-700 hover:scale-105'
                      }`}
                    >
                      <Square className="h-4 w-4 mr-1" />
                      {showStopConfirm ? 'Confirm Stop?' : 'Stop'}
                    </Button>
                    {showStopConfirm && (
                      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-red-600 text-white text-xs rounded animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                        Click again to confirm
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Start Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !inputText.trim()}
                  size="default"
                  className={`transition-all duration-200 min-w-[120px] sm:min-w-[140px] ${
                    inputText.trim() && !isLoading
                      ? 'bg-green-600 hover:bg-green-700 hover:scale-105 animate-in fade-in-0 duration-200'
                      : 'bg-gray-600'
                  } text-white font-medium`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      <span className="hidden sm:inline">Running...</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Start Workflow</span>
                      <span className="sm:hidden">Start</span>
                    </>
                  )}
                </Button>

                {/* Enhanced Reset Button */}
                <Button
                  onClick={handleReset}
                  variant="outline"
                  size="default"
                  disabled={isLoading}
                  className="transition-all duration-200 hover:scale-105 min-w-[80px] sm:min-w-[100px]"
                >
                  <RotateCcw className="h-4 w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Reset</span>
                  <span className="sm:hidden text-xs">↻</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}