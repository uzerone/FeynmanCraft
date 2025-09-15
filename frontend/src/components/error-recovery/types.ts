// Error recovery system types and configurations

export interface ErrorRecoveryAttempt {
  id: string;
  attemptNumber: number;
  errorType: 'latex_compilation' | 'physics_validation' | 'knowledge_gap' | 'agent_communication' | 'timeout';
  originalError: string;
  strategy: CorrectionStrategy;
  status: 'pending' | 'running' | 'success' | 'failed';
  startTime: number;
  endTime?: number;
  result?: string;
  nextStrategy?: string;
  agentInvolved: string;
}

export interface CorrectionStrategy {
  id: string;
  name: string;
  type: 'retry_with_modification' | 'fallback_agent' | 'parameter_adjustment' | 'research_activation' | 'manual_intervention';
  description: string;
  maxAttempts: number;
  priority: number; // 1 = highest priority
  applicableErrors: ErrorRecoveryAttempt['errorType'][];
  estimatedSuccessRate: number; // 0-100
}

export interface ErrorContext {
  originalRequest: string;
  failedAgent: string;
  errorMessage: string;
  errorType: ErrorRecoveryAttempt['errorType'];
  attemptHistory: ErrorRecoveryAttempt[];
  systemState: {
    availableAgents: string[];
    resourceUsage: number;
    previousResults: any[];
  };
}

export interface RecoverySession {
  id: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'resolved' | 'escalated' | 'abandoned';
  totalAttempts: number;
  errorContext: ErrorContext;
  attempts: ErrorRecoveryAttempt[];
  finalResolution?: {
    method: string;
    result: string;
    learnings: string[];
  };
}

// Pre-defined correction strategies
export const CORRECTION_STRATEGIES: CorrectionStrategy[] = [
  {
    id: 'latex_syntax_fix',
    name: 'LaTeX Syntax Correction',
    type: 'retry_with_modification',
    description: 'Automatically fix common LaTeX syntax errors and recompile',
    maxAttempts: 3,
    priority: 1,
    applicableErrors: ['latex_compilation'],
    estimatedSuccessRate: 85
  },
  {
    id: 'physics_constraint_relaxation',
    name: 'Physics Constraint Relaxation',
    type: 'parameter_adjustment',
    description: 'Relax strict physics validation rules for edge cases',
    maxAttempts: 2,
    priority: 2,
    applicableErrors: ['physics_validation'],
    estimatedSuccessRate: 70
  },
  {
    id: 'deep_research_activation',
    name: 'Deep Research Activation',
    type: 'research_activation',
    description: 'Activate DeepResearchAgent to find additional physics examples',
    maxAttempts: 1,
    priority: 1,
    applicableErrors: ['knowledge_gap'],
    estimatedSuccessRate: 90
  },
  {
    id: 'alternative_diagram_approach',
    name: 'Alternative Diagram Approach',
    type: 'fallback_agent',
    description: 'Try alternative TikZ generation approach with simplified diagram',
    maxAttempts: 2,
    priority: 3,
    applicableErrors: ['latex_compilation', 'physics_validation'],
    estimatedSuccessRate: 60
  },
  {
    id: 'agent_restart',
    name: 'Agent Restart',
    type: 'retry_with_modification',
    description: 'Restart failed agent with fresh context and updated parameters',
    maxAttempts: 2,
    priority: 2,
    applicableErrors: ['agent_communication', 'timeout'],
    estimatedSuccessRate: 75
  },
  {
    id: 'manual_intervention_request',
    name: 'Manual Intervention',
    type: 'manual_intervention',
    description: 'Request user guidance for complex physics or LaTeX issues',
    maxAttempts: 1,
    priority: 5,
    applicableErrors: ['latex_compilation', 'physics_validation', 'knowledge_gap'],
    estimatedSuccessRate: 95
  }
];

// Error pattern recognition
export const ERROR_PATTERNS = {
  latex_compilation: [
    {
      pattern: /Undefined control sequence/i,
      strategy: 'latex_syntax_fix',
      confidence: 0.9
    },
    {
      pattern: /Missing \$ inserted/i,
      strategy: 'latex_syntax_fix',
      confidence: 0.95
    },
    {
      pattern: /Package tikz-feynman Error/i,
      strategy: 'alternative_diagram_approach',
      confidence: 0.8
    }
  ],
  physics_validation: [
    {
      pattern: /charge conservation/i,
      strategy: 'physics_constraint_relaxation',
      confidence: 0.7
    },
    {
      pattern: /unknown particle/i,
      strategy: 'deep_research_activation',
      confidence: 0.9
    },
    {
      pattern: /invalid interaction/i,
      strategy: 'deep_research_activation',
      confidence: 0.85
    }
  ],
  knowledge_gap: [
    {
      pattern: /no similar examples found/i,
      strategy: 'deep_research_activation',
      confidence: 0.95
    },
    {
      pattern: /insufficient knowledge base/i,
      strategy: 'deep_research_activation',
      confidence: 0.9
    }
  ],
  agent_communication: [
    {
      pattern: /agent timeout/i,
      strategy: 'agent_restart',
      confidence: 0.8
    },
    {
      pattern: /connection failed/i,
      strategy: 'agent_restart',
      confidence: 0.85
    }
  ]
};

// Learning system for strategy effectiveness
export interface StrategyLearning {
  strategyId: string;
  totalAttempts: number;
  successfulAttempts: number;
  averageTimeToSuccess: number;
  commonFailureReasons: string[];
  adaptedParameters: Record<string, any>;
  lastUpdated: number;
}

// Utility functions
export function classifyError(errorMessage: string): ErrorRecoveryAttempt['errorType'] {
  const message = errorMessage.toLowerCase();
  
  if (message.includes('latex') || message.includes('compilation') || message.includes('tikz')) {
    return 'latex_compilation';
  }
  if (message.includes('physics') || message.includes('conservation') || message.includes('particle')) {
    return 'physics_validation';
  }
  if (message.includes('knowledge') || message.includes('examples') || message.includes('research')) {
    return 'knowledge_gap';
  }
  if (message.includes('timeout') || message.includes('connection') || message.includes('agent')) {
    return 'agent_communication';
  }
  
  return 'timeout'; // default fallback
}

export function selectBestStrategy(
  errorType: ErrorRecoveryAttempt['errorType'],
  errorMessage: string,
  attemptHistory: ErrorRecoveryAttempt[]
): CorrectionStrategy | null {
  // Filter strategies applicable to this error type
  const applicableStrategies = CORRECTION_STRATEGIES.filter(s => 
    s.applicableErrors.includes(errorType)
  );

  // Remove strategies that have exceeded max attempts
  const usedStrategies = attemptHistory.map(a => a.strategy.id);
  const availableStrategies = applicableStrategies.filter(s => {
    const usageCount = usedStrategies.filter(id => id === s.id).length;
    return usageCount < s.maxAttempts;
  });

  if (availableStrategies.length === 0) {
    return null;
  }

  // Try pattern matching first
  const patterns = ERROR_PATTERNS[errorType] || [];
  for (const { pattern, strategy, confidence } of patterns) {
    if (pattern.test(errorMessage) && confidence > 0.8) {
      const matchingStrategy = availableStrategies.find(s => s.id === strategy);
      if (matchingStrategy) {
        return matchingStrategy;
      }
    }
  }

  // Fallback to highest priority available strategy
  return availableStrategies.sort((a, b) => a.priority - b.priority)[0];
}

export function generateRecoveryId(): string {
  return `recovery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function calculateSuccessProbability(
  strategy: CorrectionStrategy,
  attemptNumber: number,
  learningData?: StrategyLearning
): number {
  let baseProbability = strategy.estimatedSuccessRate;
  
  // Apply learning adjustments if available
  if (learningData) {
    const actualSuccessRate = (learningData.successfulAttempts / learningData.totalAttempts) * 100;
    baseProbability = (baseProbability + actualSuccessRate) / 2;
  }
  
  // Decrease probability with each attempt
  const attemptPenalty = Math.max(0, (attemptNumber - 1) * 15);
  
  return Math.max(10, baseProbability - attemptPenalty);
}