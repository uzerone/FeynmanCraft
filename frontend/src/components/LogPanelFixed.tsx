import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Terminal, X, Trash2, Filter, Download, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: 'frontend' | 'backend' | 'api';
  message: string;
  details?: any;
}

interface LogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  onClear: () => void;
}

export function LogPanelFixed({ isOpen, onClose, logs, onClear }: LogPanelProps) {
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollContainerRef.current && isOpen) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter || log.source === filter;
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details && JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'debug': return 'text-gray-400';
      default: return 'text-blue-400';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'backend': return 'bg-purple-600/20 text-purple-400';
      case 'api': return 'bg-green-600/20 text-green-400';
      default: return 'bg-blue-600/20 text-blue-400';
    }
  };

  const copyLog = async (log: LogEntry) => {
    const logText = `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${
      log.details ? '\nDetails: ' + JSON.stringify(log.details, null, 2) : ''
    }`;
    
    try {
      await navigator.clipboard.writeText(logText);
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy log:', err);
    }
  };

  const exportLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}${
        log.details ? '\nDetails: ' + JSON.stringify(log.details, null, 2) : ''
      }`
    ).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-700 transform transition-transform duration-300 ${
      isOpen ? 'translate-y-0' : 'translate-y-full'
    }`} style={{ height: '40vh', zIndex: 45 }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <Terminal className="h-5 w-5 text-neutral-400" />
          <h3 className="text-sm font-semibold">System Logs</h3>
          <Badge variant="secondary" className="text-xs">
            {filteredLogs.length} / {logs.length}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Search */}
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:border-neutral-600"
          />
          
          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="warn">Warnings</option>
            <option value="error">Errors</option>
            <option value="debug">Debug</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="api">API</option>
          </select>
          
          {/* Actions */}
          <Button variant="ghost" size="sm" onClick={exportLogs} className="h-7 px-2">
            <Download className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2">
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Log content - Fixed scrolling */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 p-3 overflow-y-auto"
        style={{ 
          maxHeight: 'calc(100% - 60px)', 
          overflowY: 'auto',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="space-y-1 font-mono text-xs">
          {filteredLogs.map((log) => (
            <div 
              key={log.id}
              className="flex items-start gap-2 p-2 rounded hover:bg-neutral-800/50 group"
            >
              <span className="text-neutral-500 flex-shrink-0">
                {formatTimestamp(log.timestamp)}
              </span>
              <Badge 
                variant="outline" 
                className={`text-xs px-1.5 py-0 flex-shrink-0 ${getSourceColor(log.source)}`}
              >
                {log.source}
              </Badge>
              <span className={`flex-shrink-0 ${getLevelColor(log.level)}`}>
                [{log.level.toUpperCase()}]
              </span>
              <span className="flex-1 text-neutral-300 break-all">
                {log.message}
                {log.details && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-neutral-500 hover:text-neutral-400">
                      Details
                    </summary>
                    <pre className="mt-1 p-2 bg-neutral-800 rounded text-xs overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </details>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyLog(log)}
                className="h-6 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copiedId === log.id ? (
                  <Copy className="h-3 w-3 text-green-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}