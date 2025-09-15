// MCP Integration Dashboard - 实时时间线 + 性能面板
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  Server,
  Settings,
  TrendingUp
} from 'lucide-react';
import { MCPClient } from './mcpClient';
import { PhysicsOrchestrator, createDemonstrationScenarios, WorkflowEvent } from './orchestration';
import { 
  useMCPIntegrationStore, 
  useWorkflowProgress, 
  useWorkflowStats,
  useToolMetrics,
  useCircuitBreakers,
  useRecentErrors 
} from './store';

interface MCPIntegrationDashboardProps {
  isActive: boolean;
  className?: string;
}

export function MCPIntegrationDashboard({ isActive, className }: MCPIntegrationDashboardProps) {
  // State management
  const [activeTab, setActiveTab] = useState<'timeline' | 'metrics' | 'health'>('timeline');
  const [selectedScenario, setSelectedScenario] = useState('comprehensive');
  const [mcpClient] = useState(() => new MCPClient());
  const [orchestrator] = useState(() => new PhysicsOrchestrator(mcpClient));
  
  // Store hooks
  const { 
    events, 
    isWorkflowRunning, 
    currentWorkflow,
    pushEvent, 
    clearEvents, 
    startWorkflow, 
    endWorkflow,
    reset 
  } = useMCPIntegrationStore();
  
  const progress = useWorkflowProgress();
  const stats = useWorkflowStats();
  const toolMetrics = useToolMetrics();
  const circuitBreakers = useCircuitBreakers();
  const recentErrors = useRecentErrors();
  
  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Demo scenarios
  const scenarios = createDemonstrationScenarios();
  
  // Auto-scroll timeline
  useEffect(() => {
    if (timelineRef.current && isActive) {
      timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
    }
  }, [events, isActive]);

  // Handle workflow execution
  const handleStartWorkflow = async () => {
    if (isWorkflowRunning) return;
    
    const scenario = scenarios[selectedScenario as keyof typeof scenarios];
    if (!scenario) return;

    abortControllerRef.current = new AbortController();
    
    try {
      startWorkflow(scenario.name, scenario.particles, getTotalExpectedCalls(scenario.particles));
      
      await orchestrator.runDemonstrationWorkflow(
        scenario.particles,
        pushEvent,
        {
          concurrency: 2,
          pedantic: false,
          abortSignal: abortControllerRef.current.signal
        }
      );
    } catch (error) {
      console.error('Workflow failed:', error);
    } finally {
      endWorkflow();
      abortControllerRef.current = null;
    }
  };

  const handleStopWorkflow = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    orchestrator.abort();
  };

  const handleReset = () => {
    reset();
    mcpClient.resetMetrics();
  };

  // Helper functions
  const getTotalExpectedCalls = (particles: string[]) => {
    const demonstrations = {
      electron: 5, muon: 7, pi0: 6, B0: 8, H0: 7,
      'pi+': 6, 'B+': 8, Z0: 7
    };
    return particles.reduce((total, p) => total + (demonstrations[p as keyof typeof demonstrations] || 5), 0);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isActive) return null;

  return (
    <div className={`flex flex-col h-full bg-neutral-900 text-white ${className || ''}`}>
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-neutral-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-400" />
            MCP Integration Dashboard
          </h2>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <div className={`h-2 w-2 rounded-full ${isWorkflowRunning ? 'bg-green-400 animate-pulse' : 'bg-neutral-600'}`} />
            {isWorkflowRunning ? 'Running' : 'Idle'}
          </div>
        </div>

        {/* Control Panel */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
            disabled={isWorkflowRunning}
            className="px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm"
          >
            {Object.entries(scenarios).map(([key, scenario]) => (
              <option key={key} value={key}>
                {scenario.name}
              </option>
            ))}
          </select>

          <button
            onClick={handleStartWorkflow}
            disabled={isWorkflowRunning}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-600 rounded text-sm flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Start Demo
          </button>

          <button
            onClick={handleStopWorkflow}
            disabled={!isWorkflowRunning}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-600 rounded text-sm flex items-center gap-2"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>

          <button
            onClick={handleReset}
            disabled={isWorkflowRunning}
            className="px-3 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-600 rounded text-sm flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        {/* Progress Bar */}
        {currentWorkflow && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{currentWorkflow.name}</span>
              <span>{progress.completedSteps + progress.failedSteps} / {currentWorkflow.expectedCalls}</span>
            </div>
            <div className="w-full bg-neutral-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress.progress * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1">
          {[
            { key: 'timeline', label: 'Timeline', icon: Activity },
            { key: 'metrics', label: 'Metrics', icon: TrendingUp },
            { key: 'health', label: 'Health', icon: Settings }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`px-3 py-2 text-sm rounded flex items-center gap-2 ${
                activeTab === key 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'timeline' && (
          <TimelineView 
            events={events} 
            stats={stats}
            ref={timelineRef}
            formatDuration={formatDuration}
            formatTimestamp={formatTimestamp}
          />
        )}
        {activeTab === 'metrics' && (
          <MetricsView 
            toolMetrics={toolMetrics}
            circuitBreakers={circuitBreakers}
            stats={stats}
            formatDuration={formatDuration}
          />
        )}
        {activeTab === 'health' && (
          <HealthView 
            recentErrors={recentErrors}
            mcpClient={mcpClient}
            formatTimestamp={formatTimestamp}
          />
        )}
      </div>
    </div>
  );
}

// Timeline View Component
const TimelineView = React.forwardRef<HTMLDivElement, {
  events: WorkflowEvent[];
  stats: any;
  formatDuration: (ms: number) => string;
  formatTimestamp: (timestamp: number) => string;
}>((props, ref) => {
  const { events, stats, formatDuration, formatTimestamp } = props;

  return (
    <div className="flex h-full">
      {/* Timeline */}
      <div className="flex-1 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-neutral-300">Event Timeline</h3>
          <div className="text-xs text-neutral-500">
            {events.length} events
          </div>
        </div>
        
        <div ref={ref} className="h-80 overflow-y-auto space-y-2 bg-neutral-800 rounded p-3">
          {events.length === 0 ? (
            <div className="text-center text-neutral-500 py-8">
              No events yet. Start a demonstration workflow.
            </div>
          ) : (
            events.map((event, index) => (
              <TimelineEvent
                key={index}
                event={event}
                index={index}
                formatDuration={formatDuration}
                formatTimestamp={formatTimestamp}
              />
            ))
          )}
        </div>
      </div>

      {/* Stats Panel */}
      <div className="w-64 p-4 border-l border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Live Statistics</h3>
        <div className="space-y-4">
          <StatCard
            icon={Activity}
            label="Total Calls"
            value={stats.totalCalls}
            color="blue"
          />
          <StatCard
            icon={CheckCircle}
            label="Success Rate"
            value={`${stats.totalCalls > 0 ? Math.round((stats.successfulCalls / stats.totalCalls) * 100) : 0}%`}
            color="green"
          />
          <StatCard
            icon={Clock}
            label="Avg Response"
            value={formatDuration(stats.avgResponseTime)}
            color="yellow"
          />
          <StatCard
            icon={Zap}
            label="Active Particles"
            value={stats.activeParticles.length}
            color="purple"
          />
        </div>
      </div>
    </div>
  );
});

// Timeline Event Component
function TimelineEvent({ event, index, formatDuration, formatTimestamp }: {
  event: WorkflowEvent;
  index: number;
  formatDuration: (ms: number) => string;
  formatTimestamp: (timestamp: number) => string;
}) {
  const getEventIcon = () => {
    switch (event.type) {
      case 'workflow.start':
      case 'workflow.end':
        return <Activity className="h-4 w-4 text-blue-400" />;
      case 'particle.start':
      case 'particle.end':
        return <Zap className="h-4 w-4 text-purple-400" />;
      case 'step.success':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'step.error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'step.fallback':
        return <AlertTriangle className="h-4 w-4 text-yellow-400" />;
      default:
        return <Clock className="h-4 w-4 text-neutral-400" />;
    }
  };

  const getEventDescription = () => {
    switch (event.type) {
      case 'workflow.start':
        return `Started workflow with ${event.particles.length} particles`;
      case 'workflow.end':
        return `Completed workflow (${formatDuration(event.duration)})`;
      case 'particle.start':
        return `Processing ${event.particle} (${event.index + 1}/${event.total})`;
      case 'particle.end':
        return `${event.success ? 'Completed' : 'Failed'} ${event.particle} (${formatDuration(event.duration)})`;
      case 'step.success':
        return `${event.particle}: ${event.step} (${formatDuration(event.duration)})`;
      case 'step.error':
        return `${event.particle}: ${event.step} failed - ${event.error?.message}`;
      case 'step.fallback':
        return `${event.particle}: ${event.step} → fallback to ${event.fallbackStep}`;
      default:
        return 'Unknown event';
    }
  };

  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="flex-shrink-0 mt-0.5">
        {getEventIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-white">{getEventDescription()}</div>
        <div className="text-xs text-neutral-500">
          {formatTimestamp(event.timestamp)}
        </div>
      </div>
    </div>
  );
}

// Metrics View Component
function MetricsView({ toolMetrics, circuitBreakers, stats, formatDuration }: {
  toolMetrics: Map<string, any>;
  circuitBreakers: Map<string, any>;
  stats: any;
  formatDuration: (ms: number) => string;
}) {
  const metricsArray = Array.from(toolMetrics.entries());

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tool Performance */}
        <div>
          <h3 className="text-sm font-medium text-neutral-300 mb-4">Tool Performance</h3>
          <div className="bg-neutral-800 rounded p-4 space-y-3">
            {metricsArray.length === 0 ? (
              <div className="text-neutral-500 text-center py-4">No metrics available</div>
            ) : (
              metricsArray.map(([tool, metrics]) => (
                <div key={tool} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{tool}</div>
                    <div className="text-xs text-neutral-400">
                      {metrics.calls} calls • {Math.round(metrics.successRate * 100)}% success
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{formatDuration(metrics.avgLatency)}</div>
                    <div className="text-xs text-neutral-400">avg latency</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Circuit Breakers */}
        <div>
          <h3 className="text-sm font-medium text-neutral-300 mb-4">Circuit Breakers</h3>
          <div className="bg-neutral-800 rounded p-4 space-y-3">
            {Array.from(circuitBreakers.entries()).length === 0 ? (
              <div className="text-neutral-500 text-center py-4">All circuits healthy</div>
            ) : (
              Array.from(circuitBreakers.entries()).map(([tool, breaker]) => (
                <div key={tool} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white">{tool}</div>
                    <div className="text-xs text-neutral-400">
                      {breaker.failures} failures
                    </div>
                  </div>
                  <div className={`text-sm ${breaker.isOpen ? 'text-red-400' : 'text-green-400'}`}>
                    {breaker.isOpen ? 'OPEN' : 'CLOSED'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Health View Component
function HealthView({ recentErrors, mcpClient, formatTimestamp }: {
  recentErrors: any[];
  mcpClient: MCPClient;
  formatTimestamp: (timestamp: number) => string;
}) {
  const [serverHealth, setServerHealth] = useState<any>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/latex-mcp/health');
        const health = await response.json();
        setServerHealth(health);
      } catch (error) {
        setServerHealth({ status: 'error', error: error.message });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 h-full overflow-y-auto space-y-6">
      {/* Server Status */}
      <div>
        <h3 className="text-sm font-medium text-neutral-300 mb-4">MCP Server Health</h3>
        <div className="bg-neutral-800 rounded p-4">
          {serverHealth ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-400">Status</span>
                <span className={`text-sm ${serverHealth.status === 'healthy' ? 'text-green-400' : 'text-red-400'}`}>
                  {serverHealth.status}
                </span>
              </div>
              {serverHealth.version && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Version</span>
                  <span className="text-sm text-white">{serverHealth.version}</span>
                </div>
              )}
              {serverHealth.uptime_sec && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-400">Uptime</span>
                  <span className="text-sm text-white">{Math.round(serverHealth.uptime_sec)}s</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-neutral-500">Checking server health...</div>
          )}
        </div>
      </div>

      {/* Recent Errors */}
      <div>
        <h3 className="text-sm font-medium text-neutral-300 mb-4">Recent Errors</h3>
        <div className="bg-neutral-800 rounded p-4 max-h-64 overflow-y-auto">
          {recentErrors.length === 0 ? (
            <div className="text-neutral-500 text-center py-4">No recent errors</div>
          ) : (
            <div className="space-y-3">
              {recentErrors.map((error, index) => (
                <div key={index} className="border-l-2 border-red-400 pl-3">
                  <div className="text-sm text-white">{error.particle}: {error.step}</div>
                  <div className="text-xs text-red-400">{error.error.message}</div>
                  <div className="text-xs text-neutral-500">{formatTimestamp(error.timestamp)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  color: string;
}) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-green-400', 
    yellow: 'text-yellow-400',
    purple: 'text-purple-400',
    red: 'text-red-400'
  };

  return (
    <div className="bg-neutral-800 rounded p-3">
      <div className="flex items-center justify-between mb-1">
        <Icon className={`h-4 w-4 ${colorClasses[color as keyof typeof colorClasses]}`} />
        <div className="text-lg font-semibold text-white">{value}</div>
      </div>
      <div className="text-xs text-neutral-400">{label}</div>
    </div>
  );
}