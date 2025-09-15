export type AgentStatus = 'queued' | 'running' | 'success' | 'error' | 'waiting' | 'idle';

export interface AgentStageStatus {
  id: string;                    // 智能体ID
  name: string;                  // 显示名称
  emoji: string;                 // 智能体图标
  status: AgentStatus;           // 当前状态
  progress: number;              // 0-100进度
  processingTime: number;        // 处理时间（毫秒）
  retryCount: number;           // 重试次数
  memoryUsage: number;          // 内存使用量（MB）
  reasoning?: string;           // 推理过程（可展开）
  inputData?: any;              // 输入数据
  outputData?: any;             // 输出数据
  startTime?: number;           // 开始时间
  endTime?: number;             // 结束时间
  color: string;                // 主题颜色
}

export interface LiveProgressState {
  agents: AgentStageStatus[];
  currentStage: number;         // 当前执行阶段
  overallProgress: number;      // 总体进度
  isActive: boolean;           // 是否有活跃任务
  totalProcessingTime: number; // 总处理时间
}

export interface AgentConfig {
  id: string;
  emoji: string;
  name: string;
  color: string;
  description: string;
  stage: number;
}

// 7个FeynmanCraft ADK智能体配置
export const AGENT_CONFIGS: Record<string, AgentConfig> = {
  planner_agent: {
    id: 'planner_agent',
    emoji: '🧠',
    name: 'Physics Planner',
    color: 'blue',
    description: 'Parses natural language and extracts physics entities',
    stage: 1
  },
  kb_retriever_agent: {
    id: 'kb_retriever_agent',
    emoji: '📚',
    name: 'Knowledge Base',
    color: 'purple',
    description: 'Searches local knowledge base using vector similarity',
    stage: 2
  },
  physics_validator_agent: {
    id: 'physics_validator_agent',
    emoji: '⚖️',
    name: 'Physics Validator',
    color: 'green',
    description: 'Validates physics using MCP tools and conservation laws',
    stage: 3
  },
  diagram_generator_agent: {
    id: 'diagram_generator_agent',
    emoji: '🎨',
    name: 'Diagram Generator',
    color: 'orange',
    description: 'Generates TikZ-Feynman LaTeX code',
    stage: 4
  },
  tikz_validator_agent: {
    id: 'tikz_validator_agent',
    emoji: '🔍',
    name: 'TikZ Validator',
    color: 'red',
    description: 'Compiles and validates LaTeX with correction loops',
    stage: 5
  },
  feedback_agent: {
    id: 'feedback_agent',
    emoji: '💬',
    name: 'Feedback Synthesis',
    color: 'teal',
    description: 'Aggregates results and synthesizes responses',
    stage: 6
  }
};

// 有序智能体列表（按执行顺序）
export const ORDERED_AGENTS = Object.values(AGENT_CONFIGS).sort((a, b) => a.stage - b.stage);

// 状态颜色映射
export const STATUS_COLORS: Record<AgentStatus, string> = {
  idle: 'gray',
  queued: 'slate',
  waiting: 'yellow',
  running: 'blue',
  success: 'green',
  error: 'red'
};

// 状态图标映射
export const STATUS_ICONS: Record<AgentStatus, string> = {
  idle: '⏸️',
  queued: '⏳',
  waiting: '⏰', 
  running: '⚡',
  success: '✅',
  error: '❌'
};

// 辅助函数：根据ADK事件映射智能体状态
export function mapADKEventToAgentStatus(
  agentId: string, 
  isActive: boolean, 
  hasError: boolean,
  hasCompleted: boolean
): AgentStatus {
  if (hasError) return 'error';
  if (hasCompleted) return 'success';
  if (isActive) return 'running';
  return 'queued';
}

// 辅助函数：计算总体进度
export function calculateOverallProgress(agents: AgentStageStatus[]): number {
  const totalProgress = agents.reduce((sum, agent) => sum + agent.progress, 0);
  return Math.round(totalProgress / agents.length);
}

// 辅助函数：获取当前活跃阶段
export function getCurrentStage(agents: AgentStageStatus[]): number {
  const runningAgent = agents.find(agent => agent.status === 'running');
  if (runningAgent) {
    const config = AGENT_CONFIGS[runningAgent.id];
    return config ? config.stage : 0;
  }
  
  const completedCount = agents.filter(agent => agent.status === 'success').length;
  return completedCount + 1;
}