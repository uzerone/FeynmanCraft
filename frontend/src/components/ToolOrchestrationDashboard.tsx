import React, { useState, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Activity, Clock, Zap, TrendingUp, Filter, RefreshCw, Maximize2 } from 'lucide-react';

interface ToolMetrics {
  name: string;
  category: 'mcp' | 'search' | 'validation' | 'generation' | 'compilation' | 'analysis';
  calls: number;
  totalDuration: number;
  avgDuration: number;
  successRate: number;
  lastUsed: number;
  p95Duration: number;
  p99Duration: number;
  errorCount: number;
  concurrentCalls: number;
  correlationIds: string[];
}

interface HeatmapCell {
  hour: number;
  day: string;
  value: number;
  calls: number;
  avgDuration: number;
  errors: number;
}

interface ToolOrchestrationDashboardProps {
  events: Array<{
    timestamp: number;
    tool?: string;
    duration?: number;
    status?: string;
    traceInfo?: {
      traceId: string;
      stepId: string;
      sessionId?: string;
    };
  }>;
  isLive?: boolean;
  onRefresh?: () => void;
  onExpandedChange?: (isExpanded: boolean) => void;
}

const categoryColors = {
  mcp: 'rgb(59 130 246)',        // blue-500
  search: 'rgb(34 197 94)',      // green-500 
  validation: 'rgb(245 158 11)', // amber-500
  generation: 'rgb(168 85 247)', // purple-500
  compilation: 'rgb(239 68 68)', // red-500
  analysis: 'rgb(6 182 212)'     // cyan-500
};

const categoryLabels = {
  mcp: 'MCP Tools',
  search: 'Search Tools',
  validation: 'Validation Tools', 
  generation: 'Generation Tools',
  compilation: 'Compilation Tools',
  analysis: 'Analysis Tools'
};

function categorializeTool(toolName: string): ToolMetrics['category'] {
  const name = toolName.toLowerCase();
  if (name.includes('mcp') || name.includes('particle') || name.includes('physics')) return 'mcp';
  if (name.includes('search') || name.includes('kb') || name.includes('retriev')) return 'search';
  if (name.includes('valid') || name.includes('check')) return 'validation';
  if (name.includes('generat') || name.includes('diagram') || name.includes('tikz')) return 'generation';
  if (name.includes('compil') || name.includes('latex')) return 'compilation';
  return 'analysis';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function getIntensityColor(value: number, max: number): string {
  const intensity = Math.min(value / max, 1);
  if (intensity === 0) return 'rgb(var(--surface-secondary))';
  if (intensity <= 0.2) return 'rgb(var(--status-success) / 0.3)';
  if (intensity <= 0.4) return 'rgb(var(--status-success) / 0.5)';
  if (intensity <= 0.6) return 'rgb(var(--status-warning) / 0.5)';
  if (intensity <= 0.8) return 'rgb(var(--status-error) / 0.4)';
  return 'rgb(var(--status-error) / 0.6)';
}

export function ToolOrchestrationDashboard({ events, isLive, onRefresh, onExpandedChange }: ToolOrchestrationDashboardProps) {
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('6h');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'calls' | 'duration' | 'errors' | 'performance'>('calls');

  // Process events into tool metrics
  const toolMetrics = useMemo(() => {
    const now = Date.now();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000, 
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    }[timeRange];

    // Filter events by time range and presence of tool
    const relevantEvents = events.filter(e => 
      e.tool && 
      e.timestamp > (now - timeRangeMs)
    );

    // Group by tool name
    const toolGroups = new Map<string, typeof relevantEvents>();
    relevantEvents.forEach(event => {
      if (!event.tool) return;
      if (!toolGroups.has(event.tool)) {
        toolGroups.set(event.tool, []);
      }
      toolGroups.get(event.tool)!.push(event);
    });

    // Calculate metrics for each tool
    const metrics: ToolMetrics[] = [];
    toolGroups.forEach((toolEvents, toolName) => {
      const durations = toolEvents.filter(e => e.duration).map(e => e.duration!);
      const errors = toolEvents.filter(e => e.status === 'failed' || e.status === 'error');
      const successes = toolEvents.filter(e => e.status === 'completed' || e.status === 'success');
      const correlationIds = [...new Set(toolEvents.map(e => e.traceInfo?.traceId).filter(Boolean))] as string[];

      // Calculate percentiles
      const sortedDurations = durations.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p99Index = Math.floor(sortedDurations.length * 0.99);

      metrics.push({
        name: toolName,
        category: categorializeTool(toolName),
        calls: toolEvents.length,
        totalDuration: durations.reduce((sum, d) => sum + d, 0),
        avgDuration: durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0,
        successRate: toolEvents.length > 0 ? (successes.length / toolEvents.length) * 100 : 0,
        lastUsed: Math.max(...toolEvents.map(e => e.timestamp)),
        p95Duration: sortedDurations[p95Index] || 0,
        p99Duration: sortedDurations[p99Index] || 0,
        errorCount: errors.length,
        concurrentCalls: 0, // TODO: Calculate based on overlapping timestamps
        correlationIds
      });
    });

    return metrics;
  }, [events, timeRange]);

  // Filter and sort metrics
  const filteredMetrics = useMemo(() => {
    let filtered = toolMetrics;
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(m => m.category === categoryFilter);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'calls': return b.calls - a.calls;
        case 'duration': return b.totalDuration - a.totalDuration;
        case 'errors': return b.errorCount - a.errorCount;
        case 'performance': return a.avgDuration - b.avgDuration;
        default: return 0;
      }
    });
  }, [toolMetrics, categoryFilter, sortBy]);

  // Generate heatmap data
  const heatmapData = useMemo(() => {
    const now = new Date();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    const cells: HeatmapCell[] = [];
    const cellMap = new Map<string, { calls: number; durations: number[]; errors: number }>();

    // Initialize cells
    days.forEach((day, dayIndex) => {
      hours.forEach(hour => {
        const key = `${dayIndex}-${hour}`;
        cellMap.set(key, { calls: 0, durations: [], errors: 0 });
      });
    });

    // Populate with event data
    events.filter(e => e.tool && e.timestamp > (Date.now() - 7 * 24 * 60 * 60 * 1000))
      .forEach(event => {
        const date = new Date(event.timestamp);
        const dayIndex = (date.getDay() + 6) % 7; // Convert Sunday=0 to Monday=0
        const hour = date.getHours();
        const key = `${dayIndex}-${hour}`;
        
        const cell = cellMap.get(key);
        if (cell) {
          cell.calls++;
          if (event.duration) cell.durations.push(event.duration);
          if (event.status === 'failed' || event.status === 'error') cell.errors++;
        }
      });

    // Convert to cells array
    days.forEach((day, dayIndex) => {
      hours.forEach(hour => {
        const key = `${dayIndex}-${hour}`;
        const data = cellMap.get(key)!;
        cells.push({
          hour,
          day,
          value: data.calls,
          calls: data.calls,
          avgDuration: data.durations.length > 0 ? data.durations.reduce((a, b) => a + b) / data.durations.length : 0,
          errors: data.errors
        });
      });
    });

    return cells;
  }, [events]);

  const maxHeatmapValue = Math.max(...heatmapData.map(c => c.value));
  const totalCalls = toolMetrics.reduce((sum, m) => sum + m.calls, 0);
  const avgDuration = toolMetrics.length > 0 ? 
    toolMetrics.reduce((sum, m) => sum + m.avgDuration, 0) / toolMetrics.length : 0;
  const overallSuccessRate = toolMetrics.length > 0 ?
    toolMetrics.reduce((sum, m) => sum + m.successRate, 0) / toolMetrics.length : 0;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm transition-all duration-200" style={{ padding: 'var(--space-lg)', gap: 'var(--space-lg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex items-center" style={{ gap: 'var(--space-md)', minWidth: 0, flex: 1 }}>
          <BarChart3 className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(var(--interactive-primary))' }} />
          <h3 className="text-lg font-semibold overflow-safe" style={{ color: 'rgb(var(--text-primary))' }}>
            Tool Orchestration Dashboard
          </h3>
          {isLive && (
            <Badge 
              variant="outline" 
              className="status-success animate-pulse flex-shrink-0"
              style={{ fontSize: 'var(--text-xs)' }}
            >
              LIVE
            </Badge>
          )}
        </div>
        
        <div className="flex items-center flex-shrink-0" style={{ gap: 'var(--space-sm)' }}>
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="btn-unified-ghost"
              style={{ padding: 'var(--space-sm)', height: '32px', width: '32px' }}
              title="Refresh dashboard"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="dashboard-metric">
          <div className="flex items-center justify-between h-full">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Total Calls</p>
              <p className="text-lg font-semibold text-card-foreground">{formatNumber(totalCalls)}</p>
            </div>
            <Activity className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(var(--interactive-primary))' }} />
          </div>
        </div>
        
        <div className="dashboard-metric">
          <div className="flex items-center justify-between h-full">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Avg Duration</p>
              <p className="text-lg font-semibold text-card-foreground">{formatDuration(avgDuration)}</p>
            </div>
            <Clock className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(var(--status-success))' }} />
          </div>
        </div>
        
        <div className="dashboard-metric">
          <div className="flex items-center justify-between h-full">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-lg font-semibold text-card-foreground">{overallSuccessRate.toFixed(1)}%</p>
            </div>
            <TrendingUp className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(var(--status-success))' }} />
          </div>
        </div>
        
        <div className="dashboard-metric">
          <div className="flex items-center justify-between h-full">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">Active Tools</p>
              <p className="text-lg font-semibold text-card-foreground">{toolMetrics.length}</p>
            </div>
            <Zap className="h-5 w-5 flex-shrink-0" style={{ color: 'rgb(var(--status-warning))' }} />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="flex flex-wrap items-center" style={{ gap: 'var(--space-md)' }}>
          <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))', whiteSpace: 'nowrap' }}>Time:</span>
            <div className="flex" style={{ gap: 'var(--space-xs)' }}>
              {(['1h', '6h', '24h', '7d'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={timeRange === range ? 'btn-unified-primary' : 'btn-unified-ghost'}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: 'var(--text-xs)',
                    minWidth: '36px',
                    height: '28px'
                  }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center" style={{ gap: 'var(--space-sm)' }}>
            <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))', whiteSpace: 'nowrap' }}>Sort:</span>
            <div className="flex" style={{ gap: 'var(--space-xs)' }}>
              {([
                { key: 'calls', label: 'Calls' },
                { key: 'duration', label: 'Duration' }, 
                { key: 'errors', label: 'Errors' },
                { key: 'performance', label: 'Performance' }
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={sortBy === key ? 'btn-unified-primary' : 'btn-unified-ghost'}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: 'var(--text-xs)',
                    height: '28px'
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center" style={{ gap: 'var(--space-sm)' }}>
          <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))', whiteSpace: 'nowrap' }}>Category:</span>
          <button
            onClick={() => setCategoryFilter('all')}
            className={categoryFilter === 'all' ? 'btn-unified-primary' : 'btn-unified-ghost'}
            style={{ 
              padding: '4px 8px', 
              fontSize: 'var(--text-xs)',
              height: '28px'
            }}
          >
            All
          </button>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={categoryFilter === key ? 'btn-unified-primary' : 'btn-unified-ghost'}
              style={{ 
                padding: '4px 8px', 
                fontSize: 'var(--text-xs)',
                height: '28px'
              }}
            >
              <span className="overflow-safe">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Tool Metrics Table */}
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm">
          <div style={{ padding: 'var(--space-lg)' }}>
            <h4 className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))', marginBottom: 'var(--space-md)' }}>
              Tool Performance Metrics
            </h4>
            <div 
              className="space-y-2 scrollbar-themed" 
              style={{ 
                maxHeight: '320px', 
                overflowY: 'auto',
                paddingRight: 'var(--space-xs)'
              }}
            >
              {filteredMetrics.slice(0, 12).map((metric, index) => (
                <div 
                  key={metric.name} 
                  className="bg-card text-card-foreground border border-border/50 rounded-lg hover:border-border hover:shadow-sm transition-all duration-200"
                  style={{ padding: 'var(--space-md)', marginBottom: 'var(--space-sm)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0" style={{ gap: 'var(--space-md)' }}>
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: categoryColors[metric.category] }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                          <span className="text-sm font-medium overflow-safe" style={{ color: 'rgb(var(--text-primary))' }}>
                            {metric.name}
                          </span>
                          <span 
                            className="text-xs px-2 py-1 rounded-md flex-shrink-0"
                            style={{ 
                              backgroundColor: 'rgb(var(--interactive-muted))',
                              color: 'rgb(var(--text-secondary))',
                              fontSize: '10px'
                            }}
                          >
                            {categoryLabels[metric.category]}
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap" style={{ gap: 'var(--space-md)' }}>
                          <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                            {metric.calls} calls
                          </span>
                          <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                            {formatDuration(metric.avgDuration)} avg
                          </span>
                          <span className="text-xs" style={{ color: 'rgb(var(--text-secondary))' }}>
                            {metric.successRate.toFixed(1)}% success
                          </span>
                          {metric.errorCount > 0 && (
                            <span className="text-xs" style={{ color: 'rgb(var(--status-error))' }}>
                              {metric.errorCount} errors
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs flex-shrink-0" style={{ color: 'rgb(var(--text-tertiary))' }}>
                      P95: {formatDuration(metric.p95Duration)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Heatmap */}
        <div className="bg-card text-card-foreground border border-border rounded-xl shadow-sm">
          <div style={{ padding: 'var(--space-lg)' }}>
            <h4 className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))', marginBottom: 'var(--space-md)' }}>
              7-Day Activity Heatmap
            </h4>
            <div className="space-y-2">
              {/* Hour labels */}
              <div 
                className="grid gap-px"
                style={{ 
                  gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))',
                  alignItems: 'center'
                }}
              >
                <div style={{ width: '32px' }} />
                {Array.from({ length: 24 }, (_, i) => (
                  <div 
                    key={i} 
                    className="text-xs text-center" 
                    style={{ 
                      color: 'rgb(var(--text-secondary))',
                      fontSize: '10px',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {i % 6 === 0 ? i : ''}
                  </div>
                ))}
              </div>
              
              {/* Days and cells */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, dayIndex) => (
                <div 
                  key={day} 
                  className="grid gap-px"
                  style={{ 
                    gridTemplateColumns: 'auto repeat(24, minmax(0, 1fr))',
                    alignItems: 'center'
                  }}
                >
                  <div 
                    className="text-xs" 
                    style={{ 
                      color: 'rgb(var(--text-secondary))',
                      width: '32px',
                      fontSize: '11px'
                    }}
                  >
                    {day}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = heatmapData.find(c => c.day === day && c.hour === hour);
                    const intensity = getIntensityColor(cell?.value || 0, maxHeatmapValue);
                    return (
                      <div
                        key={hour}
                        className="rounded-sm border transition-all duration-200"
                        style={{
                          width: '16px',
                          height: '16px',
                          backgroundColor: intensity,
                          borderColor: 'rgb(var(--border-secondary))'
                        }}
                        title={cell ? 
                          `${day} ${hour}:00 - ${cell.calls} calls, ${formatDuration(cell.avgDuration)} avg${cell.errors > 0 ? `, ${cell.errors} errors` : ''}` : 
                          `${day} ${hour}:00 - No activity`
                        }
                      />
                    );
                  })}
                </div>
              ))}
              
              {/* Legend */}
              <div 
                className="flex items-center text-xs pt-2" 
                style={{ 
                  gap: 'var(--space-sm)',
                  borderTop: '1px solid rgb(var(--border-secondary))',
                  marginTop: 'var(--space-md)',
                  paddingTop: 'var(--space-md)',
                  color: 'rgb(var(--text-secondary))'
                }}
              >
                <span>Less</span>
                <div className="flex gap-px">
                  {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity, i) => (
                    <div 
                      key={i} 
                      className="rounded-sm" 
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: getIntensityColor(intensity * maxHeatmapValue, maxHeatmapValue)
                      }}
                    />
                  ))}
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredMetrics.length === 0 && (
        <div className="text-center" style={{ padding: 'var(--space-3xl) var(--space-lg)' }}>
          <BarChart3 
            className="h-12 w-12 mx-auto opacity-50" 
            style={{ 
              color: 'rgb(var(--text-muted))',
              marginBottom: 'var(--space-lg)'
            }} 
          />
          <p style={{ color: 'rgb(var(--text-muted))' }}>
            No tool activity data available for the selected time range.
          </p>
        </div>
      )}
    </div>
  );
}