import React from 'react';
import { Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/StatusPill';

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

interface Log {
  id: string;
  timestamp: number;
  level: string;
  source: string;
  message: string;
  data?: any;
}

interface HeaderFixedProps {
  // Left section - Logs
  isLogPanelOpen: boolean;
  onToggleLogPanel: () => void;
  logs: Log[];
  
  // Center section - Optional title
  title?: string;
  
  // Right section - Status
  connectionStatus: ConnectionStatus;
  sseEnabled?: boolean;
  sseConnectionStatus?: SSEConnectionStatus;
  onCopyServerInfo?: () => void;
  
  // Layout
  className?: string;
}

export function HeaderFixed({
  isLogPanelOpen,
  onToggleLogPanel,
  logs,
  title,
  connectionStatus,
  sseEnabled = false,
  sseConnectionStatus = { connected: false },
  onCopyServerInfo,
  className = ''
}: HeaderFixedProps) {
  return (
    <header 
      className={`fixed top-0 left-0 right-0 transition-all duration-200 ${className}`}
      style={{
        zIndex: 'var(--z-fixed)',
        backgroundColor: 'rgb(var(--bg-primary) / 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgb(var(--border-secondary))',
        height: '56px' /* 3.5rem */
      }}
      role="banner"
    >
      <div 
        className="flex items-center h-full overflow-hidden"
        style={{ 
          paddingLeft: 'var(--space-lg)', 
          paddingRight: 'var(--space-lg)',
          gap: 'var(--space-lg)'
        }}
      >
        
        {/* Left Section - Logs Button (fixed width, never shrinks) */}
        <div className="flex items-center flex-shrink-0" style={{ gap: 'var(--space-sm)' }}>
          <button
            onClick={onToggleLogPanel}
            className={`btn-unified-ghost transition-all duration-200 ${isLogPanelOpen ? 'btn-unified-secondary' : ''}`}
            style={{ 
              height: '32px',
              padding: '0 var(--space-md)',
              fontSize: 'var(--text-xs)',
              minWidth: '100px',
              maxWidth: '140px'
            }}
            aria-label={`${isLogPanelOpen ? 'Close' : 'Open'} logs panel. ${logs.length} log entries`}
            aria-expanded={isLogPanelOpen}
            aria-controls="log-panel"
          >
            <Terminal className="h-3 w-3" style={{ marginRight: 'var(--space-sm)' }} />
            <span className="overflow-safe">Logs ({logs.length})</span>
          </button>
          
        </div>
        
        {/* Center Section - Optional Title (flexible, shrinks with ellipsis) */}
        {title && (
          <div className="flex-1 text-center min-w-0 hidden sm:block">
            <h1 
              className="text-sm font-medium overflow-safe"
              style={{ color: 'rgb(var(--text-primary))' }}
            >
              {title}
            </h1>
          </div>
        )}
        
        {/* Spacer when no title */}
        {!title && <div className="flex-1 min-w-0" />}
        
        {/* Right Section - Status Pill (constrained max width with overflow) */}
        <div className="flex-shrink-0" style={{ maxWidth: '40%', minWidth: '0' }}>
          <StatusPill
            connectionStatus={connectionStatus}
            sseEnabled={sseEnabled}
            sseConnectionStatus={sseConnectionStatus}
            onCopyServerInfo={onCopyServerInfo}
          />
        </div>
      </div>
    </header>
  );
}

export default HeaderFixed;