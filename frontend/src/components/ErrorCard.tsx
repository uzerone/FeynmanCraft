import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings, X, ChevronDown, ChevronUp } from 'lucide-react';

export type ErrorSource = 'LaTeX' | 'TikZ' | 'Physics' | 'MCP' | 'Network' | 'Unknown';
export type ErrorAction = 'retry' | 'degrade' | 'ignore';

export interface StructuredError {
  id: string;
  source: ErrorSource;
  location?: string;
  title: string;
  description: string;
  suggestion: string;
  details?: string;
  timestamp: number;
  retryCount?: number;
  isRetryable?: boolean;
  isDegradable?: boolean;
}

interface ErrorCardProps {
  error: StructuredError;
  onAction: (errorId: string, action: ErrorAction) => void;
  isCompact?: boolean;
}

const ERROR_SOURCE_CONFIG = {
  LaTeX: {
    color: 'bg-red-500/10 border-red-500/30 text-red-300',
    icon: '📝',
    badgeColor: 'bg-red-500/20 text-red-300 border-red-500/30'
  },
  TikZ: {
    color: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    icon: '🎨',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30'
  },
  Physics: {
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    icon: '⚛️',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30'
  },
  MCP: {
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
    icon: '🔧',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30'
  },
  Network: {
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    icon: '🌐',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
  },
  Unknown: {
    color: 'bg-gray-500/10 border-gray-500/30 text-gray-300',
    icon: '❓',
    badgeColor: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }
};

export function ErrorCard({ error, onAction, isCompact = false }: ErrorCardProps) {
  const [isExpanded, setIsExpanded] = useState(!isCompact);
  const config = ERROR_SOURCE_CONFIG[error.source];

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const handleAction = (action: ErrorAction) => {
    onAction(error.id, action);
  };

  const getRetryButtonText = () => {
    if (error.retryCount && error.retryCount > 0) {
      return `Retry (${error.retryCount + 1})`;
    }
    return 'Retry';
  };

  const getDegradeButtonText = () => {
    switch (error.source) {
      case 'Physics':
        return 'Use Non-pedantic Mode';
      case 'LaTeX':
      case 'TikZ':
        return 'Use Fallback Renderer';
      case 'MCP':
        return 'Skip Tool Validation';
      case 'Network':
        return 'Work Offline';
      default:
        return 'Degrade Gracefully';
    }
  };

  return (
    <div className={`rounded-lg border-2 p-3 ${config.color} transition-all duration-200`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={`text-xs px-2 py-0.5 border ${config.badgeColor}`}>
                {error.source}
              </Badge>
              {error.location && (
                <span className="text-xs font-mono text-neutral-400">
                  {error.location}
                </span>
              )}
              <span className="text-xs text-neutral-500">
                {formatTimestamp(error.timestamp)}
              </span>
              {error.retryCount && error.retryCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  Retry #{error.retryCount}
                </Badge>
              )}
            </div>
            <h4 className="font-medium text-sm mb-1">{error.title}</h4>
            <p className="text-sm opacity-90 mb-2">{error.description}</p>
            <p className="text-xs text-neutral-300 bg-neutral-800/30 p-2 rounded">
              💡 {error.suggestion}
            </p>
          </div>
        </div>
        
        {/* Expand/Collapse button */}
        {isCompact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 p-0 flex-shrink-0"
          >
            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* Details */}
      {isExpanded && error.details && (
        <div className="mt-3 p-2 bg-neutral-900/30 rounded text-xs font-mono text-neutral-400 max-h-24 overflow-y-auto">
          {error.details}
        </div>
      )}

      {/* Action buttons */}
      {isExpanded && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {error.isRetryable !== false && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('retry')}
              className="h-7 px-3 text-xs border-current"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {getRetryButtonText()}
            </Button>
          )}
          
          {error.isDegradable !== false && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('degrade')}
              className="h-7 px-3 text-xs border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10"
            >
              <Settings className="h-3 w-3 mr-1" />
              {getDegradeButtonText()}
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('ignore')}
            className="h-7 px-3 text-xs border-gray-500/30 text-gray-400 hover:bg-gray-500/10"
          >
            <X className="h-3 w-3 mr-1" />
            Ignore
          </Button>
        </div>
      )}
    </div>
  );
}

// Error parsing utilities
export const parseErrorFromMessage = (message: string, source?: string): StructuredError | null => {
  const timestamp = Date.now();
  const id = `error_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

  // LaTeX/TikZ errors
  if (message.includes('LaTeX Error') || message.includes('tikz')) {
    return {
      id,
      source: message.includes('tikz') ? 'TikZ' : 'LaTeX',
      title: 'Compilation Error',
      description: 'Failed to compile TikZ-Feynman diagram',
      suggestion: 'Try simplifying the diagram or using fallback rendering',
      details: message.substring(0, 500),
      timestamp,
      isRetryable: true,
      isDegradable: true
    };
  }

  // Physics validation errors
  if (message.includes('physics') || message.includes('particle') || message.includes('conservation')) {
    return {
      id,
      source: 'Physics',
      title: 'Physics Validation Failed',
      description: 'The requested interaction violates physics rules',
      suggestion: 'Check particle properties or enable non-pedantic mode',
      details: message.substring(0, 500),
      timestamp,
      isRetryable: true,
      isDegradable: true
    };
  }

  // MCP errors
  if (message.includes('MCP') || message.includes('tool') || message.includes('HTTP 500')) {
    return {
      id,
      source: 'MCP',
      title: 'Tool Integration Error',
      description: 'Failed to call physics validation tools',
      suggestion: 'Check MCP server connection or skip validation',
      details: message.substring(0, 500),
      timestamp,
      isRetryable: true,
      isDegradable: true
    };
  }

  // Network errors
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
    return {
      id,
      source: 'Network',
      title: 'Connection Error',
      description: 'Network request failed or timed out',
      suggestion: 'Check internet connection or enable offline mode',
      details: message.substring(0, 500),
      timestamp,
      isRetryable: true,
      isDegradable: true
    };
  }

  // Generic error
  return {
    id,
    source: 'Unknown',
    title: 'Unexpected Error',
    description: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
    suggestion: 'Try refreshing or contact support if the issue persists',
    details: message.substring(0, 500),
    timestamp,
    isRetryable: true,
    isDegradable: false
  };
};