
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users, 
  ScrollText, 
  History,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  RotateCcw,
  Zap,
  Server
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiveProgressTracker } from './agent-visualization/LiveProgressTracker';
import { AgentCollaborationGraph } from './agent-visualization/AgentCollaborationGraph';
import { DataFlowVisualizer } from './agent-visualization/DataFlowVisualizer';
import { useAgentProgress } from './agent-visualization/useAgentProgress';
import { ErrorRecoveryDashboard } from './error-recovery/ErrorRecoveryDashboard';
import { AutomationHooksDashboard } from './automation-hooks/AutomationHooksDashboard';
// import { MCPIntegrationDashboard } from './mcp-integration/MCPIntegrationDashboard';

export interface RightInfoPanelProps {
  activeTab: 'agents' | 'logs' | 'versions' | 'recovery' | 'automation' | 'mcp';
  onTabChange: (tab: 'agents' | 'logs' | 'versions' | 'recovery' | 'automation' | 'mcp') => void;
  
  // Agent data - 支持新的LiveProgressTracker数据格式
  agentEvents?: Array<{
    id: string;
    title: string;
    status: 'idle' | 'processing' | 'completed' | 'error';
    progress: number;
    timestamp: number;
    data: string;
    details?: string;
  }>;
  
  // 新增：用于LiveProgressTracker的数据 (来自useADKFinal)
  processedEvents?: Array<{
    title: string;
    author: string;
    timestamp: number;
    data?: any;
    details?: string;
  }>;
  isLoading?: boolean;
  error?: string | null;
  messages?: any[];
  
  // Log data
  logs?: Array<{
    id: string;
    level: 'info' | 'warning' | 'error';
    message: string;
    timestamp: number;
    source?: string;
  }>;
  
  // Version data
  versions?: Array<{
    id: string;
    timestamp: number;
    triggerSource: string;
    summary: string;
    starred?: boolean;
  }>;
  
  className?: string;
}

export function RightInfoPanel({
  activeTab,
  onTabChange,
  agentEvents = [],
  processedEvents = [],
  isLoading = false,
  error = null,
  messages = [],
  logs = [],
  versions = [],
  className
}: RightInfoPanelProps) {
  
  // 使用新的智能体进度钩子
  const agentProgress = useAgentProgress({
    processedEvents,
    isLoading,
    error,
    messages
  });
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'processing':
        return <div className="h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />;
      default:
        return <Activity className="h-4 w-4 text-neutral-400" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-neutral-900", className)}>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'agents' | 'logs' | 'versions' | 'recovery' | 'automation' | 'mcp')} className="flex flex-col h-full">
        {/* Tab Headers */}
        <div className="flex-shrink-0 border-b border-neutral-800 px-4 py-2">
          <TabsList className="grid w-full grid-cols-6 bg-neutral-800">
            <TabsTrigger 
              value="agents" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Agents</span>
              {agentEvents.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">
                  {agentEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="logs" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Logs</span>
              {logs.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">
                  {logs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="versions" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Versions</span>
              {versions.length > 0 && (
                <Badge variant="secondary" className="text-xs px-1 py-0 ml-1">
                  {versions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="recovery" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Recovery</span>
            </TabsTrigger>
            <TabsTrigger 
              value="automation" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Automation</span>
            </TabsTrigger>
            <TabsTrigger 
              value="mcp" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">MCP</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {/* Agents Tab - Agent Visualization */}
          <TabsContent value="agents" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                {/* Agent Collaboration Network Graph */}
                <AgentCollaborationGraph
                  agents={agentProgress.agentStatuses}
                  isActive={agentProgress.isActive}
                  className="text-neutral-100"
                />
                
                {/* Live Progress Tracker */}
                <LiveProgressTracker
                  agents={agentProgress.agentStatuses}
                  isActive={agentProgress.isActive}
                  totalProcessingTime={agentProgress.totalProcessingTime}
                  className="text-neutral-100"
                />

                {/* Data Flow Visualizer */}
                <DataFlowVisualizer
                  agents={agentProgress.agentStatuses}
                  isActive={agentProgress.isActive}
                  className="text-neutral-100"
                />
                
                {/* Empty state for no activity */}
                {processedEvents.length === 0 && agentEvents.length === 0 && (
                  <div className="flex items-center justify-center h-32 text-neutral-500 mt-6">
                    <div className="text-center space-y-2">
                      <Users className="h-8 w-8 mx-auto opacity-50" />
                      <p className="text-sm">No agent activity yet</p>
                      <p className="text-xs">Start a diagram generation to see agent collaboration</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "p-3 rounded-lg border text-sm",
                        getLogLevelColor(log.level)
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className="text-xs px-1 py-0 uppercase"
                            >
                              {log.level}
                            </Badge>
                            {log.source && (
                              <span className="text-xs opacity-75">
                                {log.source}
                              </span>
                            )}
                          </div>
                          <p className="leading-relaxed">
                            {log.message}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs opacity-75 flex-shrink-0">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-32 text-neutral-500">
                    <div className="text-center space-y-2">
                      <ScrollText className="h-8 w-8 mx-auto opacity-50" />
                      <p className="text-sm">No logs available</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-3">
                {versions.length > 0 ? (
                  versions.map((version) => (
                    <div
                      key={version.id}
                      className="p-3 rounded-lg bg-neutral-800 border border-neutral-700 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full" />
                          <span className="text-sm font-medium text-neutral-200">
                            Version {version.id}
                          </span>
                          {version.starred && (
                            <span className="text-yellow-400">⭐</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-neutral-400">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(version.timestamp)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Badge 
                          variant="outline" 
                          className="text-xs px-2 py-0.5 bg-neutral-700 border-neutral-600"
                        >
                          {version.triggerSource}
                        </Badge>
                        <p className="text-sm text-neutral-300">
                          {version.summary}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-32 text-neutral-500">
                    <div className="text-center space-y-2">
                      <History className="h-8 w-8 mx-auto opacity-50" />
                      <p className="text-sm">No versions saved yet</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Recovery Tab */}
          <TabsContent value="recovery" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <ErrorRecoveryDashboard 
                  isActive={isLoading}
                  className="text-neutral-100"
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                <AutomationHooksDashboard 
                  isActive={isLoading}
                  className="text-neutral-100"
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mcp" className="h-full m-0 p-0">
            <ScrollArea className="h-full">
              <div className="p-4">
                {/* <MCPIntegrationDashboard 
                  isActive={isLoading}
                  className="text-neutral-100"
                /> */}
                <div className="text-white">
                  <h3 className="text-lg font-semibold mb-4">MCP Integration Dashboard</h3>
                  <div className="space-y-4">
                    <div className="bg-neutral-800 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                        <span className="font-medium">ParticlePhysics MCP Server</span>
                      </div>
                      <p className="text-sm text-neutral-300">LaTeX MCP on port 8003</p>
                      <p className="text-xs text-neutral-400 mt-1">HTTP API integration active</p>
                    </div>
                    
                    <div className="bg-neutral-800 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
                        <span className="font-medium">ADK Backend Integration</span>
                      </div>
                      <p className="text-sm text-neutral-300">Modified to use HTTP MCP client</p>
                      <p className="text-xs text-neutral-400 mt-1">Fallback to subprocess if needed</p>
                    </div>
                    
                    <div className="bg-neutral-800 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Available Tools</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-neutral-300">• search_particle</div>
                        <div className="text-neutral-300">• get_property</div>
                        <div className="text-neutral-300">• list_decays</div>
                        <div className="text-neutral-300">• find_decays</div>
                        <div className="text-neutral-300">• list_properties</div>
                        <div className="text-neutral-300">• resolve_identifier</div>
                        <div className="text-neutral-300">• database_info</div>
                        <div className="text-neutral-300">• get_property_details</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}