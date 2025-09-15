import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Zap, Play, EyeOff } from 'lucide-react';

interface OneClickAction {
  id: string;
  label: string;
  description: string;
  action_type: string;
  handler?: string;
  params?: Record<string, any>;
  dangerous?: boolean;
}

interface StructuredError {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: string;
  timestamp: number;
  session_id: string;
  trace_id: string;
  step_id: string;
  agent?: string;
  tool?: string;
  stack_trace?: string;
  user_message?: string;
  technical_details?: string;
  actions?: OneClickAction[];
  related_events?: string[];
  documentation_url?: string;
}

interface ErrorCardPanelProps {
  errors: StructuredError[];
  onDismissError: (errorId: string) => void;
  onExecuteAction: (actionId: string, actionType: string, params?: Record<string, any>) => Promise<{ success: boolean; message?: string; result?: any }>;
  onClearAllErrors: () => void;
}

const severityConfig = {
  critical: {
    color: 'bg-red-600 text-white border-red-600',
    badge: 'bg-red-100 text-red-800 border-red-300',
    icon: '🚨'
  },
  high: {
    color: 'bg-orange-600 text-white border-orange-600',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    icon: '⚠️'
  },
  medium: {
    color: 'bg-yellow-600 text-white border-yellow-600',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: '⚡'
  },
  low: {
    color: 'bg-blue-600 text-white border-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
    icon: 'ℹ️'
  }
};

const categoryConfig = {
  physics_validation: { label: 'Physics Validation', color: 'text-purple-600' },
  mcp_connection: { label: 'MCP Connection', color: 'text-red-600' },
  tikz_compilation: { label: 'TikZ Compilation', color: 'text-orange-600' },
  agent_transfer: { label: 'Agent Transfer', color: 'text-blue-600' },
  sse_streaming: { label: 'SSE Streaming', color: 'text-green-600' },
  frontend_ui: { label: 'Frontend UI', color: 'text-pink-600' },
  system: { label: 'System', color: 'text-gray-600' }
};

const actionTypeIcons: Record<string, any> = {
  retry_mcp_connection: RefreshCw,
  restart_agent: Play,
  fix_tikz_compilation: Zap,
  reload_frontend: RefreshCw,
  ignore_error: EyeOff
};

function ErrorCard({ error, onDismiss, onExecuteAction }: {
  error: StructuredError;
  onDismiss: (errorId: string) => void;
  onExecuteAction: (actionId: string, actionType: string, params?: Record<string, any>) => Promise<{ success: boolean; message?: string; result?: any }>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [executingActions, setExecutingActions] = useState<Set<string>>(new Set());
  const [actionResults, setActionResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const severityInfo = severityConfig[error.severity as keyof typeof severityConfig] || severityConfig.medium;
  const categoryInfo = categoryConfig[error.category as keyof typeof categoryConfig] || categoryConfig.system;

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleActionClick = useCallback(async (action: OneClickAction) => {
    if (action.dangerous) {
      const confirmed = window.confirm(
        `Are you sure you want to execute "${action.label}"?\n\n${action.description}\n\nThis action may have significant effects.`
      );
      if (!confirmed) return;
    }

    setExecutingActions(prev => new Set([...prev, action.id]));

    try {
      const result = await onExecuteAction(action.id, action.action_type, action.params);
      setActionResults(prev => ({
        ...prev,
        [action.id]: {
          success: result.success,
          message: result.message || (result.success ? 'Action completed successfully' : 'Action failed')
        }
      }));

      // Auto-dismiss success messages after 3 seconds
      if (result.success) {
        setTimeout(() => {
          setActionResults(prev => {
            const newResults = { ...prev };
            delete newResults[action.id];
            return newResults;
          });
        }, 3000);
      }
    } catch (error) {
      setActionResults(prev => ({
        ...prev,
        [action.id]: {
          success: false,
          message: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }));
    } finally {
      setExecutingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(action.id);
        return newSet;
      });
    }
  }, [onExecuteAction]);

  return (
    <div className={`border-l-4 ${severityInfo.color} bg-neutral-800/50 rounded-r-lg mb-3 overflow-hidden`}>
      {/* Header */}
      <div className="p-3 bg-neutral-800/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">{severityInfo.icon}</span>
              <div>
                <h4 className="font-medium text-white">{error.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={`text-xs ${severityInfo.badge}`}>
                    {error.severity.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${categoryInfo.color} border-current`}>
                    {categoryInfo.label}
                  </Badge>
                  <span className="text-xs text-neutral-400">
                    {formatTimestamp(error.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {error.actions && error.actions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="h-6 px-2 text-xs"
                title={isExpanded ? 'Collapse details' : 'Expand details'}
              >
                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(error.id)}
              className="h-6 px-2 text-xs hover:bg-neutral-700"
              title="Dismiss error"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        {/* User message */}
        <p className="text-sm text-neutral-300 mt-2">
          {error.user_message || error.message}
        </p>
        
        {/* Correlation info */}
        <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500 font-mono">
          <span title={`Trace ID: ${error.trace_id}`}>#{error.trace_id.substring(0, 8)}</span>
          <span title={`Session ID: ${error.session_id}`}>@{error.session_id.substring(0, 6)}</span>
          {error.agent && <span className="text-blue-400">Agent: {error.agent}</span>}
          {error.tool && <span className="text-cyan-400">Tool: {error.tool}</span>}
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-neutral-700">
          {/* Technical details */}
          {error.technical_details && (
            <div className="p-3 bg-neutral-900/30">
              <h5 className="text-xs font-medium text-neutral-400 mb-2">Technical Details</h5>
              <pre className="text-xs text-neutral-300 bg-neutral-900/50 p-2 rounded overflow-x-auto">
                {error.technical_details}
              </pre>
            </div>
          )}

          {/* Actions */}
          {error.actions && error.actions.length > 0 && (
            <div className="p-3 bg-neutral-800/20">
              <h5 className="text-xs font-medium text-neutral-400 mb-3">Suggested Actions</h5>
              <div className="grid gap-2">
                {error.actions.map((action) => {
                  const IconComponent = actionTypeIcons[action.action_type] || Zap;
                  const isExecuting = executingActions.has(action.id);
                  const result = actionResults[action.id];

                  return (
                    <div key={action.id} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant={action.dangerous ? "destructive" : "secondary"}
                          size="sm"
                          onClick={() => handleActionClick(action)}
                          disabled={isExecuting}
                          className="flex items-center gap-2 h-8 text-xs"
                        >
                          {isExecuting ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <IconComponent className="h-3 w-3" />
                          )}
                          {action.label}
                          {action.dangerous && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
                        </Button>
                        <span className="text-xs text-neutral-400 flex-1">
                          {action.description}
                        </span>
                      </div>
                      
                      {/* Action result */}
                      {result && (
                        <div className={`text-xs p-2 rounded ${
                          result.success 
                            ? 'bg-green-900/30 text-green-300 border border-green-800/50' 
                            : 'bg-red-900/30 text-red-300 border border-red-800/50'
                        }`}>
                          {result.message}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Documentation link */}
          {error.documentation_url && (
            <div className="p-3 bg-neutral-800/20 border-t border-neutral-700">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 text-xs"
              >
                <a href={error.documentation_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Documentation
                </a>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorCardPanel({ errors, onDismissError, onExecuteAction, onClearAllErrors }: ErrorCardPanelProps) {
  if (errors.length === 0) {
    return null;
  }

  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const highErrors = errors.filter(e => e.severity === 'high');
  const otherErrors = errors.filter(e => !['critical', 'high'].includes(e.severity));

  return (
    <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-500" />
          Error Reports ({errors.length})
        </h3>
        
        <div className="flex items-center gap-2">
          {errors.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAllErrors}
              className="h-7 text-xs"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        {/* Critical errors first */}
        {criticalErrors.map(error => (
          <ErrorCard
            key={error.id}
            error={error}
            onDismiss={onDismissError}
            onExecuteAction={onExecuteAction}
          />
        ))}
        
        {/* High priority errors */}
        {highErrors.map(error => (
          <ErrorCard
            key={error.id}
            error={error}
            onDismiss={onDismissError}
            onExecuteAction={onExecuteAction}
          />
        ))}
        
        {/* Other errors */}
        {otherErrors.map(error => (
          <ErrorCard
            key={error.id}
            error={error}
            onDismiss={onDismissError}
            onExecuteAction={onExecuteAction}
          />
        ))}
      </div>
      
      {errors.length > 3 && (
        <div className="text-xs text-neutral-400 text-center mt-3 pt-3 border-t border-neutral-700">
          Showing {Math.min(3, errors.length)} of {errors.length} errors
        </div>
      )}
    </div>
  );
}