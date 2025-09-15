import React from 'react';
import { Wifi, WifiOff, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

interface ConnectionStatus {
  isConnected: boolean;
  error?: string;
  lastChecked: number;
  serverInfo?: {
    edition?: string;
    uptime?: number;
    tools_count?: number;
    cors_status?: string;
  };
}

interface SSEConnectionStatus {
  connected: boolean;
}

interface StatusPillProps {
  connectionStatus: ConnectionStatus;
  sseEnabled?: boolean;
  sseConnectionStatus?: SSEConnectionStatus;
  onCopyServerInfo?: () => void;
  className?: string;
}

export function StatusPill({
  connectionStatus,
  sseEnabled = false,
  sseConnectionStatus = { connected: false },
  onCopyServerInfo,
  className = ''
}: StatusPillProps) {
  const isConnected = connectionStatus.isConnected;
  
  // Create full status text for tooltip
  const getFullStatusText = () => {
    if (!isConnected) {
      const errorText = connectionStatus.error 
        ? `Disconnected: ${connectionStatus.error}`
        : 'Backend Disconnected';
      return errorText;
    }

    if (connectionStatus.serverInfo) {
      const parts = [
        `Connected to ${connectionStatus.serverInfo.edition || 'ADK'}`,
        sseEnabled
          ? `SSE ${sseConnectionStatus.connected ? 'Connected' : 'Disconnected'}`
          : 'Polling Mode',
        `Uptime: ${Math.floor((connectionStatus.serverInfo.uptime || 0) / 60)}m`,
        `${connectionStatus.serverInfo.tools_count || 0} tools available`,
      ];
      return parts.join(' • ');
    }

    return 'Backend Connected';
  };

  // Create display text for pill (let CSS handle truncation)
  const getDisplayText = () => {
    if (!isConnected) {
      return connectionStatus.error 
        ? `Disconnected: ${connectionStatus.error}`
        : 'Backend Disconnected';
    }

    if (connectionStatus.serverInfo) {
      const edition = connectionStatus.serverInfo.edition || 'ADK';
      const sseStatus = sseEnabled 
        ? (sseConnectionStatus.connected ? 'SSE ✓' : 'SSE ⚠')
        : 'Polling';
      
      return `Connected • ${edition} • ${sseStatus}`;
    }

    return 'Backend Connected';
  };

  const fullStatusText = getFullStatusText();
  const displayText = getDisplayText();
  
  const pillContent = (
    <div 
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-sm border transition-all w-full min-w-0 ${
        isConnected 
          ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
          : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
      } ${className}`}
      role="status"
      aria-label={fullStatusText}
    >
      {/* Fixed-width icon container to prevent jumping */}
      <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
        {isConnected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
      </div>
      
      {/* Status text that truncates properly */}
      <span className="truncate min-w-0 flex-1">
        {displayText}
      </span>
      
      {/* Copy button - only show when connected and server info available */}
      {isConnected && connectionStatus.serverInfo && onCopyServerInfo && (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onCopyServerInfo();
          }}
          className="h-5 w-5 p-0 hover:bg-green-500/20 rounded flex-shrink-0"
          title="Copy server info"
          aria-label="Copy server information to clipboard"
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );

  // Always show tooltip for additional detail when available
  const shouldShowTooltip = displayText !== fullStatusText || 
    (isConnected && connectionStatus.serverInfo);

  if (shouldShowTooltip) {
    return (
      <Tooltip 
        content={fullStatusText}
        side="bottom"
        align="end"
        delayDuration={500}
      >
        {pillContent}
      </Tooltip>
    );
  }

  return pillContent;
}