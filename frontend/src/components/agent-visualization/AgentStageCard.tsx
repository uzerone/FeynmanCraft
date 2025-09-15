import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Clock, RotateCcw, MemoryStick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentStageStatus, STATUS_COLORS, STATUS_ICONS } from './types';

interface AgentStageCardProps {
  agent: AgentStageStatus;
  isActive?: boolean;
  className?: string;
}

export function AgentStageCard({ agent, isActive = false, className }: AgentStageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: AgentStageStatus['status']) => {
    const colorMap = {
      idle: 'bg-gray-100 text-gray-800 border-gray-300',
      queued: 'bg-slate-100 text-slate-800 border-slate-300',
      waiting: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      running: 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse',
      success: 'bg-green-100 text-green-800 border-green-300',
      error: 'bg-red-100 text-red-800 border-red-300'
    };
    return colorMap[status] || colorMap.idle;
  };

  const getProgressBarColor = (status: AgentStageStatus['status']) => {
    const colorMap = {
      idle: 'bg-gray-200',
      queued: 'bg-slate-200',
      waiting: 'bg-yellow-200',
      running: 'bg-blue-500',
      success: 'bg-green-500',
      error: 'bg-red-500'
    };
    return colorMap[status] || colorMap.idle;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatMemory = (mb: number) => {
    if (mb < 1) return `${(mb * 1024).toFixed(0)}KB`;
    if (mb < 1024) return `${mb.toFixed(1)}MB`;
    return `${(mb / 1024).toFixed(1)}GB`;
  };

  return (
    <div className={cn(
      "border rounded-lg p-4 transition-all duration-300",
      isActive ? "border-blue-300 bg-blue-50 shadow-md" : "border-neutral-200 bg-white",
      agent.status === 'running' ? "ring-2 ring-blue-200" : "",
      className
    )}>
      {/* Agent Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{agent.emoji}</span>
          <div>
            <h3 className="font-semibold text-sm text-neutral-900">{agent.name}</h3>
            <p className="text-xs text-neutral-500">Stage {agent.id === 'planner_agent' ? 1 : agent.id === 'kb_retriever_agent' ? 2 : agent.id === 'physics_validator_agent' ? 3 : agent.id === 'diagram_generator_agent' ? 4 : agent.id === 'tikz_validator_agent' ? 5 : 6}</p>
          </div>
        </div>
        
        {/* Status Badge */}
        <Badge variant="outline" className={cn("text-xs font-medium", getStatusColor(agent.status))}>
          <span className="mr-1">{STATUS_ICONS[agent.status]}</span>
          {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
        </Badge>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-neutral-600">Progress</span>
          <span className="text-xs font-medium text-neutral-900">{agent.progress}%</span>
        </div>
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div 
            className={cn(
              "h-2 rounded-full transition-all duration-500 ease-out",
              getProgressBarColor(agent.status),
              agent.status === 'running' ? "animate-pulse" : ""
            )}
            style={{ width: `${agent.progress}%` }}
          />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-xs text-neutral-600 mb-3">
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{formatTime(agent.processingTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <RotateCcw className="w-3 h-3" />
          <span>{agent.retryCount} retries</span>
        </div>
        <div className="flex items-center gap-1">
          <MemoryStick className="w-3 h-3" />
          <span>{formatMemory(agent.memoryUsage)}</span>
        </div>
      </div>

      {/* Expandable Details */}
      {agent.reasoning && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-between text-xs text-neutral-600 h-7 p-2"
          >
            <span>View Details</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          
          {isExpanded && (
            <div className="mt-2 p-3 bg-neutral-50 rounded-md border">
              <h4 className="text-xs font-semibold text-neutral-700 mb-2">Reasoning Process</h4>
              <p className="text-xs text-neutral-600 leading-relaxed">{agent.reasoning}</p>
              
              {agent.inputData && (
                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-neutral-700 mb-1">Input Data</h5>
                  <pre className="text-xs text-neutral-600 bg-white p-2 rounded border overflow-x-auto">
                    {JSON.stringify(agent.inputData, null, 2)}
                  </pre>
                </div>
              )}
              
              {agent.outputData && (
                <div className="mt-3">
                  <h5 className="text-xs font-semibold text-neutral-700 mb-1">Output Data</h5>
                  <pre className="text-xs text-neutral-600 bg-white p-2 rounded border overflow-x-auto">
                    {JSON.stringify(agent.outputData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}