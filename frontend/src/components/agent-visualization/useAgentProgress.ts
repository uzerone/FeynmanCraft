import { useMemo } from 'react';
import { useWorkbench } from '../WorkbenchLayout';
import { 
  AgentStageStatus, 
  AGENT_CONFIGS, 
  ORDERED_AGENTS,
  mapADKEventToAgentStatus 
} from './types';

// 这是从useADKFinal来的处理事件类型定义
interface ProcessedEvent {
  title: string;
  author: string;
  timestamp: number;
  data?: any;
  details?: string;
}

interface UseAgentProgressProps {
  processedEvents?: ProcessedEvent[];
  isLoading?: boolean;
  error?: string | null;
  messages?: any[];
}

export function useAgentProgress({ 
  processedEvents = [], 
  isLoading = false, 
  error = null,
  messages = []
}: UseAgentProgressProps) {
  const { state } = useWorkbench();
  const { jobState } = state;

  // 将ADK事件和WorkbenchContext状态转换为智能体状态
  const agentStatuses = useMemo((): AgentStageStatus[] => {
    return ORDERED_AGENTS.map((agentConfig) => {
      // 查找该智能体的最新事件
      const agentEvents = processedEvents.filter(event => 
        event.author === agentConfig.id
      ).sort((a, b) => b.timestamp - a.timestamp);

      const latestEvent = agentEvents[0];
      const hasCompleted = agentEvents.length > 0;
      const isCurrentlyActive = jobState.currentAgent === agentConfig.id && 
                               jobState.status !== 'idle' && 
                               jobState.status !== 'failed' && 
                               jobState.status !== 'preview_ready';
      const hasError = error !== null && isCurrentlyActive;

      // 计算智能体状态
      let agentStatus = mapADKEventToAgentStatus(
        agentConfig.id,
        isCurrentlyActive,
        hasError,
        hasCompleted && !isCurrentlyActive
      );

      // 特殊处理：如果整个任务失败，将所有智能体标记为error或idle
      if (jobState.status === 'failed') {
        if (hasCompleted || isCurrentlyActive) {
          agentStatus = 'error';
        } else {
          agentStatus = 'idle';
        }
      }

      // 特殊处理：如果任务完成，将完成的智能体标记为success
      if (jobState.status === 'preview_ready' && hasCompleted) {
        agentStatus = 'success';
      }

      // 计算进度
      let progress = 0;
      if (agentStatus === 'success') {
        progress = 100;
      } else if (agentStatus === 'running') {
        progress = Math.min(jobState.progress || 0, 90); // 运行中时最多90%
      } else if (agentStatus === 'error') {
        progress = hasCompleted ? 100 : 0;
      } else if (hasCompleted) {
        progress = 100;
      }

      // 计算处理时间
      let processingTime = 0;
      if (latestEvent) {
        if (agentStatus === 'running') {
          processingTime = Date.now() - latestEvent.timestamp;
        } else if (agentEvents.length > 1) {
          // 如果有多个事件，使用第一个和最后一个的时间差
          const firstEvent = agentEvents[agentEvents.length - 1];
          processingTime = latestEvent.timestamp - firstEvent.timestamp;
        } else {
          // 否则使用一个估算值
          processingTime = Math.random() * 3000 + 1000; // 1-4秒随机
        }
      }

      // 模拟内存使用（基于智能体类型）
      const memoryUsageMap: Record<string, number> = {
        'planner_agent': 12.5,
        'kb_retriever_agent': 45.2,
        'physics_validator_agent': 23.8,
        'diagram_generator_agent': 67.3,
        'tikz_validator_agent': 34.6,
        'feedback_agent': 18.9
      };

      // 生成推理过程描述
      let reasoning = '';
      if (latestEvent) {
        reasoning = generateReasoningText(agentConfig.id, latestEvent, agentStatus);
      }

      return {
        id: agentConfig.id,
        name: agentConfig.name,
        emoji: agentConfig.emoji,
        status: agentStatus,
        progress,
        processingTime,
        retryCount: agentEvents.length > 1 ? agentEvents.length - 1 : 0,
        memoryUsage: memoryUsageMap[agentConfig.id] || 15.0,
        color: agentConfig.color,
        reasoning,
        startTime: latestEvent?.timestamp,
        endTime: agentStatus === 'success' || agentStatus === 'error' ? 
                 (latestEvent?.timestamp || Date.now()) : undefined,
        inputData: latestEvent?.data,
        outputData: latestEvent?.details ? { result: latestEvent.details } : undefined
      };
    });
  }, [processedEvents, jobState, error, isLoading]);

  // 计算总处理时间
  const totalProcessingTime = useMemo(() => {
    if (jobState.startTime === 0) return 0;
    
    if (jobState.status === 'preview_ready' || jobState.status === 'failed') {
      // 任务完成，计算实际总时间
      return Date.now() - jobState.startTime;
    } else if (isLoading) {
      // 任务进行中，计算当前经过时间
      return Date.now() - jobState.startTime;
    }
    
    return 0;
  }, [jobState.startTime, jobState.status, isLoading]);

  return {
    agentStatuses,
    totalProcessingTime,
    isActive: isLoading,
    currentStage: agentStatuses.findIndex(a => a.status === 'running') + 1,
    overallProgress: jobState.progress || 0
  };
}

// 生成智能体推理过程描述的辅助函数
function generateReasoningText(agentId: string, event: ProcessedEvent, status: AgentStageStatus['status']): string {
  const reasoningTemplates: Record<string, Record<string, string>> = {
    'planner_agent': {
      running: 'Analyzing natural language input and extracting physics entities. Identifying particles, interactions, and diagram requirements.',
      success: 'Successfully parsed physics request. Extracted key particles and interaction types for diagram generation.',
      error: 'Failed to parse physics requirements. Unable to identify valid particle interactions from input.'
    },
    'kb_retriever_agent': {
      running: 'Searching vector knowledge base for similar physics processes. Computing similarity scores across 150+ examples.',
      success: 'Retrieved relevant physics examples from knowledge base. Found matching processes and diagram patterns.',
      error: 'Knowledge base search failed. No matching physics processes found for the requested interaction.'
    },
    'physics_validator_agent': {
      running: 'Validating physics constraints using MCP tools. Checking conservation laws and quantum numbers.',
      success: 'Physics validation complete. All conservation laws and constraints satisfied for the proposed diagram.',
      error: 'Physics validation failed. Detected violations of conservation laws or invalid particle interactions.'
    },
    'diagram_generator_agent': {
      running: 'Generating TikZ-Feynman LaTeX code. Creating vertex connections and particle representations.',
      success: 'Successfully generated TikZ diagram code. Created complete LaTeX representation of physics process.',
      error: 'Diagram generation failed. Unable to create valid TikZ-Feynman code for the requested process.'
    },
    'tikz_validator_agent': {
      running: 'Compiling LaTeX code and validating syntax. Running correction loops to fix any compilation errors.',
      success: 'LaTeX compilation successful. Generated clean PDF output with proper physics diagram formatting.',
      error: 'LaTeX compilation failed. Syntax errors or invalid TikZ commands detected in generated code.'
    },
    'feedback_agent': {
      running: 'Synthesizing results from all agents. Aggregating outputs and preparing final response.',
      success: 'Successfully synthesized multi-agent results. Generated comprehensive physics diagram response.',
      error: 'Result synthesis failed. Unable to aggregate agent outputs into coherent final response.'
    }
  };

  return reasoningTemplates[agentId]?.[status] || 
         `${status.charAt(0).toUpperCase() + status.slice(1)} - Processing ${agentId.replace('_', ' ')}`;
}