import React, { useMemo } from 'react';
import { AgentStageCard } from './AgentStageCard';
import { 
  AgentStageStatus, 
  LiveProgressState, 
  ORDERED_AGENTS, 
  AGENT_CONFIGS,
  calculateOverallProgress,
  getCurrentStage
} from './types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Activity, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface LiveProgressTrackerProps {
  agents: AgentStageStatus[];
  isActive?: boolean;
  totalProcessingTime?: number;
  className?: string;
}

export function LiveProgressTracker({ 
  agents, 
  isActive = false, 
  totalProcessingTime = 0,
  className 
}: LiveProgressTrackerProps) {

  // Calculate live progress state
  const progressState = useMemo((): LiveProgressState => {
    const currentStage = getCurrentStage(agents);
    const overallProgress = calculateOverallProgress(agents);
    
    return {
      agents,
      currentStage,
      overallProgress,
      isActive,
      totalProcessingTime
    };
  }, [agents, isActive, totalProcessingTime]);

  // Get summary statistics
  const summaryStats = useMemo(() => {
    const completed = agents.filter(a => a.status === 'success').length;
    const running = agents.filter(a => a.status === 'running').length;
    const failed = agents.filter(a => a.status === 'error').length;
    const waiting = agents.filter(a => a.status === 'queued' || a.status === 'waiting').length;
    
    return { completed, running, failed, waiting };
  }, [agents]);

  const formatTotalTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const getStatusSummaryColor = () => {
    if (summaryStats.failed > 0) return 'text-red-600';
    if (summaryStats.running > 0) return 'text-blue-600';
    if (summaryStats.completed === agents.length) return 'text-green-600';
    return 'text-neutral-600';
  };

  return (
    <div className={className}>
      {/* Header with Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Agent Collaboration Pipeline
          </h2>
          <Badge variant="outline" className={getStatusSummaryColor()}>
            Stage {progressState.currentStage}/6
          </Badge>
        </div>
        
        {/* Overall Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-neutral-600">Overall Progress</span>
            <span className="text-sm font-medium text-neutral-900">
              {progressState.overallProgress}%
            </span>
          </div>
          <Progress 
            value={progressState.overallProgress} 
            className="h-2"
          />
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-neutral-600">Completed:</span>
            <span className="font-medium">{summaryStats.completed}</span>
          </div>
          <div className="flex items-center gap-1">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-neutral-600">Running:</span>
            <span className="font-medium">{summaryStats.running}</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4 text-yellow-500" />
            <span className="text-neutral-600">Waiting:</span>
            <span className="font-medium">{summaryStats.waiting}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-neutral-600">Failed:</span>
            <span className="font-medium">{summaryStats.failed}</span>
          </div>
        </div>

        {/* Total Processing Time */}
        {totalProcessingTime > 0 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-neutral-600">
            <Clock className="w-4 h-4" />
            <span>Total Processing Time: {formatTotalTime(totalProcessingTime)}</span>
          </div>
        )}
      </div>

      {/* Agent Stage Cards */}
      <div className="space-y-3">
        {ORDERED_AGENTS.map((agentConfig) => {
          // Find the agent data or create default
          const agentData = agents.find(a => a.id === agentConfig.id) || {
            id: agentConfig.id,
            name: agentConfig.name,
            emoji: agentConfig.emoji,
            status: 'idle' as const,
            progress: 0,
            processingTime: 0,
            retryCount: 0,
            memoryUsage: 0,
            color: agentConfig.color
          };

          const isCurrentlyActive = agentData.status === 'running' || 
            (progressState.currentStage === agentConfig.stage && isActive);

          return (
            <div key={agentConfig.id} className="relative">
              {/* Connection Line to Next Agent */}
              {agentConfig.stage < 6 && (
                <div className="absolute left-6 top-full w-0.5 h-3 bg-neutral-200 z-0" />
              )}
              
              {/* Agent Card */}
              <AgentStageCard
                agent={agentData}
                isActive={isCurrentlyActive}
                className="relative z-10"
              />
            </div>
          );
        })}
      </div>

      {/* Pipeline Status Footer */}
      {isActive && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="font-medium">
              Physics diagram generation in progress...
            </span>
          </div>
          <p className="text-xs text-blue-600 mt-1">
            {summaryStats.running > 0 
              ? `Currently executing: ${agents.find(a => a.status === 'running')?.name || 'Unknown Agent'}`
              : 'Preparing next agent...'
            }
          </p>
        </div>
      )}

      {/* Completion Status */}
      {!isActive && summaryStats.completed === agents.length && agents.length > 0 && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-medium">
              Physics diagram generation completed successfully!
            </span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            All agents have finished processing. Total time: {formatTotalTime(totalProcessingTime)}
          </p>
        </div>
      )}

      {/* Error Status */}
      {!isActive && summaryStats.failed > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-red-800">
            <XCircle className="w-4 h-4" />
            <span className="font-medium">
              Generation failed with errors
            </span>
          </div>
          <p className="text-xs text-red-600 mt-1">
            {summaryStats.failed} agent(s) encountered errors. Check individual agent details for more information.
          </p>
        </div>
      )}
    </div>
  );
}