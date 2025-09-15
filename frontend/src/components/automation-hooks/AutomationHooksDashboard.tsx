import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  XCircle,
  Play,
  Pause,
  Settings,
  Database,
  FileImage,
  Bug,
  Gauge,
  ChevronDown,
  ChevronRight,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { AutomationHookManager } from './AutomationHookManager';
import {
  AutomationHook,
  HookExecution,
  ProductivityMetrics,
  HookStats,
  formatDuration,
  getHookCategoryColor,
  getExecutionStatusColor
} from './types';

interface AutomationHooksDashboardProps {
  isActive?: boolean;
  className?: string;
}

export function AutomationHooksDashboard({ 
  isActive = false, 
  className 
}: AutomationHooksDashboardProps) {
  const [hooks, setHooks] = useState<AutomationHook[]>([]);
  const [executions, setExecutions] = useState<HookExecution[]>([]);
  const [productivityMetrics, setProductivityMetrics] = useState<ProductivityMetrics>({
    totalTimesSaved: 0,
    automatedTasks: 0,
    manualInterventionsPrevented: 0,
    knowledgeBaseUpdates: 0,
    formatsGenerated: 0,
    errorsAutoFixed: 0,
    reportsMade: 0,
    lastCalculated: Date.now()
  });
  const [hookStats, setHookStats] = useState<HookStats>({
    totalHooks: 0,
    activeHooks: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTime: 0,
    totalTimeSaved: 0,
    productivityGain: 0
  });
  
  const [expandedHooks, setExpandedHooks] = useState<Set<string>>(new Set());
  const [expandedExecutions, setExpandedExecutions] = useState<Set<string>>(new Set());
  const [isSimulating, setIsSimulating] = useState(false);
  
  const managerRef = useRef<AutomationHookManager | null>(null);

  // Initialize hook manager
  useEffect(() => {
    const manager = new AutomationHookManager();
    
    // Set up event callbacks
    manager.setEventCallbacks({
      onHookExecutionStart: (execution) => {
        setExecutions(prev => [execution, ...prev]);
      },
      onHookExecutionComplete: (execution) => {
        setExecutions(prev => prev.map(e => e.id === execution.id ? execution : e));
        setHookStats(manager.getHookStats());
      },
      onHookActionStart: (execution, action) => {
        setExecutions(prev => prev.map(e => e.id === execution.id ? execution : e));
      },
      onHookActionComplete: (execution, action) => {
        setExecutions(prev => prev.map(e => e.id === execution.id ? execution : e));
      },
      onProductivityUpdate: (metrics) => {
        setProductivityMetrics(metrics);
      }
    });

    managerRef.current = manager;
    setHooks(manager.getHooks());
    setProductivityMetrics(manager.getProductivityMetrics());
    setHookStats(manager.getHookStats());

    // Auto-expand enabled hooks initially
    const enabledHooks = manager.getHooks().filter(h => h.enabled);
    setExpandedHooks(new Set(enabledHooks.slice(0, 2).map(h => h.id)));

    return () => {
      managerRef.current = null;
    };
  }, []);

  // Simulate hook events for demo
  const simulateEvent = async (eventType: 'diagram_generated' | 'latex_compiled' | 'physics_validated' | 'error_occurred') => {
    if (!managerRef.current || isSimulating) return;
    
    setIsSimulating(true);
    
    try {
      await managerRef.current.simulateEvent(eventType);
      setHooks(managerRef.current.getHooks());
    } catch (error) {
      console.error('Event simulation failed:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  const toggleHook = (hookId: string) => {
    if (!managerRef.current) return;
    
    const hook = managerRef.current.getHook(hookId);
    if (!hook) return;
    
    if (hook.enabled) {
      managerRef.current.disableHook(hookId);
    } else {
      managerRef.current.enableHook(hookId);
    }
    
    setHooks(managerRef.current.getHooks());
  };

  const toggleHookExpansion = (hookId: string) => {
    setExpandedHooks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(hookId)) {
        newSet.delete(hookId);
      } else {
        newSet.add(hookId);
      }
      return newSet;
    });
  };

  const toggleExecutionExpansion = (executionId: string) => {
    setExpandedExecutions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(executionId)) {
        newSet.delete(executionId);
      } else {
        newSet.add(executionId);
      }
      return newSet;
    });
  };

  const getHookIcon = (hook: AutomationHook) => {
    switch (hook.category) {
      case 'productivity': return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'quality': return <CheckCircle className="w-5 h-5 text-blue-400" />;
      case 'automation': return <Zap className="w-5 h-5 text-purple-400" />;
      case 'debugging': return <Bug className="w-5 h-5 text-red-400" />;
      default: return <Settings className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getExecutionStatusIcon = (status: HookExecution['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'running': return <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'skipped': return <Clock className="w-4 h-4 text-yellow-400" />;
      default: return <Clock className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'knowledge_update': return <Database className="w-4 h-4 text-green-400" />;
      case 'format_generation': return <FileImage className="w-4 h-4 text-blue-400" />;
      case 'report_creation': return <Bug className="w-4 h-4 text-orange-400" />;
      case 'system_optimization': return <Gauge className="w-4 h-4 text-purple-400" />;
      default: return <Activity className="w-4 h-4 text-neutral-400" />;
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Agent Hooks Automation Engine
              </h2>
              <p className="text-sm text-neutral-400">
                Intelligent workflow automation enhancing development productivity
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              {hookStats.activeHooks} Active
            </Badge>
            
            <Badge variant="outline" className="text-blue-400 border-blue-500/30">
              {hookStats.productivityGain.toFixed(1)}% Gain
            </Badge>
          </div>
        </div>

        {/* Demo Controls */}
        <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <Zap className="w-4 h-4" />
            <span>Trigger Events:</span>
          </div>
          
          <button
            onClick={() => simulateEvent('diagram_generated')}
            disabled={isSimulating}
            className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded text-xs hover:bg-green-500/20 disabled:opacity-50"
          >
            Diagram Success
          </button>
          
          <button
            onClick={() => simulateEvent('latex_compiled')}
            disabled={isSimulating}
            className="px-3 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-xs hover:bg-blue-500/20 disabled:opacity-50"
          >
            LaTeX Compiled
          </button>
          
          <button
            onClick={() => simulateEvent('physics_validated')}
            disabled={isSimulating}
            className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-xs hover:bg-purple-500/20 disabled:opacity-50"
          >
            Physics Validated
          </button>
          
          <button
            onClick={() => simulateEvent('error_occurred')}
            disabled={isSimulating}
            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/20 disabled:opacity-50"
          >
            Error Pattern
          </button>
          
          {isSimulating && (
            <div className="flex items-center gap-2 text-xs text-blue-400 ml-auto">
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              Processing...
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-neutral-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-neutral-700">
            Overview
          </TabsTrigger>
          <TabsTrigger value="hooks" className="data-[state=active]:bg-neutral-700">
            Hooks ({hooks.length})
          </TabsTrigger>
          <TabsTrigger value="executions" className="data-[state=active]:bg-neutral-700">
            Executions
          </TabsTrigger>
          <TabsTrigger value="metrics" className="data-[state=active]:bg-neutral-700">
            Productivity
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {productivityMetrics.automatedTasks}
              </div>
              <div className="text-sm text-neutral-400">Tasks Automated</div>
            </div>
            
            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">
                {formatDuration(productivityMetrics.totalTimesSaved)}
              </div>
              <div className="text-sm text-neutral-400">Time Saved</div>
            </div>
            
            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">
                {productivityMetrics.manualInterventionsPrevented}
              </div>
              <div className="text-sm text-neutral-400">Interventions Prevented</div>
            </div>
            
            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">
                {hookStats.productivityGain.toFixed(1)}%
              </div>
              <div className="text-sm text-neutral-400">Productivity Gain</div>
            </div>
          </div>

          {/* Automation Breakdown */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
              <h3 className="text-lg font-semibold text-neutral-100 mb-4">Automation Impact</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Knowledge Base Updates</span>
                  <Badge variant="outline" size="sm">{productivityMetrics.knowledgeBaseUpdates}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Formats Generated</span>
                  <Badge variant="outline" size="sm">{productivityMetrics.formatsGenerated}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Errors Auto-Fixed</span>
                  <Badge variant="outline" size="sm">{productivityMetrics.errorsAutoFixed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Reports Generated</span>
                  <Badge variant="outline" size="sm">{productivityMetrics.reportsMade}</Badge>
                </div>
              </div>
            </div>

            <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
              <h3 className="text-lg font-semibold text-neutral-100 mb-4">Execution Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Success Rate</span>
                  <span className="text-sm font-medium text-green-400">
                    {hookStats.totalExecutions > 0 
                      ? Math.round((hookStats.successfulExecutions / hookStats.totalExecutions) * 100)
                      : 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Avg Execution Time</span>
                  <span className="text-sm font-medium text-neutral-300">
                    {formatDuration(hookStats.averageExecutionTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Total Executions</span>
                  <span className="text-sm font-medium text-blue-400">{hookStats.totalExecutions}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-300">Failed Executions</span>
                  <span className="text-sm font-medium text-red-400">{hookStats.failedExecutions}</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Hooks Tab */}
        <TabsContent value="hooks" className="space-y-4">
          {hooks.map((hook) => (
            <div key={hook.id} className="bg-neutral-900 rounded-lg border border-neutral-700">
              <div 
                className={cn(
                  "p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors",
                  getHookCategoryColor(hook.category)
                )}
                onClick={() => toggleHookExpansion(hook.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedHooks.has(hook.id) ? (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-neutral-400" />
                    )}
                    
                    {getHookIcon(hook)}
                    
                    <div>
                      <div className="font-medium text-sm text-neutral-200">
                        {hook.name}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {hook.description}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="text-neutral-300">
                        {hook.executionCount} executions
                      </div>
                      <div className="text-neutral-500">
                        {hook.executionCount > 0 
                          ? `${Math.round((hook.successCount / hook.executionCount) * 100)}% success`
                          : 'No executions'
                        }
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHook(hook.id);
                      }}
                      className={cn(
                        "px-2 py-1 rounded text-xs font-medium transition-colors",
                        hook.enabled
                          ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                          : "bg-neutral-600/20 text-neutral-400 hover:bg-neutral-600/30"
                      )}
                    >
                      {hook.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    
                    <Badge variant="outline" size="sm" className={getHookCategoryColor(hook.category)}>
                      {hook.category}
                    </Badge>
                  </div>
                </div>
              </div>

              {expandedHooks.has(hook.id) && (
                <div className="border-t border-neutral-700 p-4 space-y-4">
                  {/* Conditions */}
                  <div>
                    <h4 className="text-sm font-medium text-neutral-200 mb-2">Trigger Conditions</h4>
                    <div className="space-y-2">
                      {hook.conditions.map((condition, idx) => (
                        <div key={idx} className="bg-neutral-800 p-3 rounded text-xs">
                          <div className="font-medium text-neutral-300 mb-1">{condition.name}</div>
                          <div className="text-neutral-400">{condition.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <h4 className="text-sm font-medium text-neutral-200 mb-2">Automated Actions</h4>
                    <div className="space-y-2">
                      {hook.actions.map((action, idx) => (
                        <div key={idx} className="bg-neutral-800 p-3 rounded text-xs flex items-center gap-3">
                          {getActionIcon(action.type)}
                          <div className="flex-1">
                            <div className="font-medium text-neutral-300 mb-1">
                              {action.name} (Priority {action.priority})
                            </div>
                            <div className="text-neutral-400">{action.description}</div>
                          </div>
                          <div className="text-neutral-500">
                            ~{formatDuration(action.estimatedDuration)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        {/* Executions Tab */}
        <TabsContent value="executions" className="space-y-4">
          {executions.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hook executions yet</p>
              <p className="text-xs">Trigger events above to see automation in action</p>
            </div>
          ) : (
            executions.map((execution) => (
              <div key={execution.id} className="bg-neutral-900 rounded-lg border border-neutral-700">
                <div 
                  className="p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                  onClick={() => toggleExecutionExpansion(execution.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {expandedExecutions.has(execution.id) ? (
                        <ChevronDown className="w-5 h-5 text-neutral-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-neutral-400" />
                      )}
                      
                      {getExecutionStatusIcon(execution.status)}
                      
                      <div>
                        <div className="font-medium text-sm text-neutral-200">
                          {hooks.find(h => h.id === execution.hookId)?.name || 'Unknown Hook'}
                        </div>
                        <div className="text-xs text-neutral-400">
                          Triggered by {execution.triggeredBy.type} • {execution.actions.length} actions
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-neutral-400">
                        {new Date(execution.startTime).toLocaleTimeString()}
                      </span>
                      <span className={getExecutionStatusColor(execution.status)}>
                        {formatDuration((execution.endTime || Date.now()) - execution.startTime)}
                      </span>
                      <Badge variant="outline" size="sm" className={getExecutionStatusColor(execution.status)}>
                        {execution.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {expandedExecutions.has(execution.id) && (
                  <div className="border-t border-neutral-700 p-4 space-y-4">
                    {/* Actions */}
                    <div>
                      <h4 className="text-sm font-medium text-neutral-200 mb-2">Action Results</h4>
                      <div className="space-y-2">
                        {execution.actions.map((actionExec, idx) => (
                          <div key={idx} className="bg-neutral-800 p-3 rounded text-xs">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getExecutionStatusIcon(actionExec.status)}
                                <span className="font-medium text-neutral-300">
                                  Action #{idx + 1}
                                </span>
                              </div>
                              <span className={getExecutionStatusColor(actionExec.status)}>
                                {actionExec.endTime && formatDuration(actionExec.endTime - actionExec.startTime)}
                              </span>
                            </div>
                            {actionExec.result && (
                              <div className="text-neutral-400 bg-neutral-900 p-2 rounded">
                                {actionExec.result}
                              </div>
                            )}
                            {actionExec.error && (
                              <div className="text-red-400 bg-red-500/10 p-2 rounded">
                                Error: {actionExec.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>

        {/* Productivity Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-6">
            <h3 className="text-lg font-semibold text-neutral-100 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Productivity Impact Analysis
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-neutral-200 mb-3">Time Savings Breakdown</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-neutral-800 rounded">
                    <span className="text-sm text-neutral-300">Direct Automation</span>
                    <span className="font-medium text-green-400">
                      {formatDuration(productivityMetrics.totalTimesSaved)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-800 rounded">
                    <span className="text-sm text-neutral-300">Manual Work Prevented</span>
                    <span className="font-medium text-blue-400">
                      {formatDuration(productivityMetrics.manualInterventionsPrevented * 30000)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-neutral-800 rounded">
                    <span className="text-sm text-neutral-300">Error Resolution</span>
                    <span className="font-medium text-purple-400">
                      {formatDuration(productivityMetrics.errorsAutoFixed * 180000)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-neutral-200 mb-3">Automation Efficiency</h4>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-neutral-300">Overall Productivity Gain</span>
                      <span className="font-medium text-neutral-200">{hookStats.productivityGain.toFixed(1)}%</span>
                    </div>
                    <Progress value={hookStats.productivityGain} className="h-2" />
                  </div>
                  
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-neutral-300">Hook Success Rate</span>
                      <span className="font-medium text-neutral-200">
                        {hookStats.totalExecutions > 0 
                          ? Math.round((hookStats.successfulExecutions / hookStats.totalExecutions) * 100)
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={hookStats.totalExecutions > 0 
                        ? (hookStats.successfulExecutions / hookStats.totalExecutions) * 100
                        : 0} 
                      className="h-2" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}