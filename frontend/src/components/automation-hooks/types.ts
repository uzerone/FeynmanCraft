// Agent Hooks automation system types and configurations

export interface HookEvent {
  id: string;
  type: 'diagram_generated' | 'latex_compiled' | 'physics_validated' | 'error_occurred' | 'agent_completed';
  source: 'planner_agent' | 'kb_retriever_agent' | 'physics_validator_agent' | 'diagram_generator_agent' | 'tikz_validator_agent' | 'feedback_agent' | 'system';
  timestamp: number;
  data: any;
  metadata: {
    success: boolean;
    duration: number;
    retryCount?: number;
    errorMessage?: string;
  };
}

export interface HookCondition {
  id: string;
  name: string;
  type: 'event_match' | 'pattern_match' | 'threshold_check' | 'time_based' | 'sequence_match';
  parameters: Record<string, any>;
  description: string;
}

export interface HookAction {
  id: string;
  name: string;
  type: 'knowledge_update' | 'format_generation' | 'report_creation' | 'notification' | 'system_optimization';
  parameters: Record<string, any>;
  estimatedDuration: number;
  priority: number; // 1 = highest
  description: string;
}

export interface AutomationHook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: HookCondition[];
  actions: HookAction[];
  cooldownMs: number; // Minimum time between executions
  maxRetries: number;
  createdAt: number;
  lastExecuted?: number;
  executionCount: number;
  successCount: number;
  averageExecutionTime: number;
  category: 'productivity' | 'quality' | 'automation' | 'debugging';
}

export interface HookExecution {
  id: string;
  hookId: string;
  triggeredBy: HookEvent;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  actions: HookActionExecution[];
  result?: string;
  error?: string;
}

export interface HookActionExecution {
  id: string;
  actionId: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  outputFiles?: string[];
  metrics?: Record<string, number>;
}

export interface ProductivityMetrics {
  totalTimesSaved: number; // in milliseconds
  automatedTasks: number;
  manualInterventionsPrevented: number;
  knowledgeBaseUpdates: number;
  formatsGenerated: number;
  errorsAutoFixed: number;
  reportsMade: number;
  lastCalculated: number;
}

export interface HookStats {
  totalHooks: number;
  activeHooks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalTimeSaved: number;
  productivityGain: number; // percentage
}

// Predefined hooks configuration
export const DEFAULT_HOOKS: AutomationHook[] = [
  {
    id: 'knowledge_base_updater',
    name: 'Knowledge Base Updater',
    description: 'Automatically saves successful physics diagrams to the knowledge base',
    enabled: true,
    conditions: [
      {
        id: 'diagram_success',
        name: 'Diagram Generation Success',
        type: 'event_match',
        parameters: {
          eventType: 'diagram_generated',
          success: true,
          minQualityScore: 0.8
        },
        description: 'Triggers when a high-quality diagram is successfully generated'
      }
    ],
    actions: [
      {
        id: 'save_to_kb',
        name: 'Save to Knowledge Base',
        type: 'knowledge_update',
        parameters: {
          includeMetadata: true,
          extractPatterns: true,
          validatePhysics: true
        },
        estimatedDuration: 2000,
        priority: 2,
        description: 'Extract patterns and save diagram to structured knowledge base'
      }
    ],
    cooldownMs: 5000,
    maxRetries: 3,
    createdAt: Date.now() - 86400000, // 1 day ago
    executionCount: 0,
    successCount: 0,
    averageExecutionTime: 0,
    category: 'productivity'
  },
  {
    id: 'format_generator',
    name: 'Multi-Format Generator',
    description: 'Automatically generates PDF, SVG, and PNG formats after successful LaTeX compilation',
    enabled: true,
    conditions: [
      {
        id: 'latex_success',
        name: 'LaTeX Compilation Success',
        type: 'event_match',
        parameters: {
          eventType: 'latex_compiled',
          success: true,
          source: 'tikz_validator_agent'
        },
        description: 'Triggers when LaTeX compilation completes successfully'
      }
    ],
    actions: [
      {
        id: 'generate_pdf',
        name: 'Generate PDF',
        type: 'format_generation',
        parameters: {
          format: 'pdf',
          quality: 'high',
          resolution: 300
        },
        estimatedDuration: 3000,
        priority: 1,
        description: 'Generate high-quality PDF output'
      },
      {
        id: 'generate_svg',
        name: 'Generate SVG',
        type: 'format_generation',
        parameters: {
          format: 'svg',
          quality: 'vector',
          optimized: true
        },
        estimatedDuration: 2000,
        priority: 2,
        description: 'Generate optimized SVG vector output'
      },
      {
        id: 'generate_png',
        name: 'Generate PNG',
        type: 'format_generation',
        parameters: {
          format: 'png',
          quality: 'high',
          resolution: 600,
          transparent: false
        },
        estimatedDuration: 2500,
        priority: 3,
        description: 'Generate high-resolution PNG output'
      }
    ],
    cooldownMs: 1000,
    maxRetries: 2,
    createdAt: Date.now() - 86400000,
    executionCount: 0,
    successCount: 0,
    averageExecutionTime: 0,
    category: 'automation'
  },
  {
    id: 'physics_rules_updater',
    name: 'Physics Rules Updater',
    description: 'Updates physics validation rules based on successful validations',
    enabled: true,
    conditions: [
      {
        id: 'physics_validated',
        name: 'Physics Validation Complete',
        type: 'event_match',
        parameters: {
          eventType: 'physics_validated',
          success: true,
          source: 'physics_validator_agent',
          novelty: 'high' // New physics patterns detected
        },
        description: 'Triggers when novel physics patterns are successfully validated'
      }
    ],
    actions: [
      {
        id: 'update_rules',
        name: 'Update Physics Rules',
        type: 'knowledge_update',
        parameters: {
          extractConstraints: true,
          updateValidationRules: true,
          preserveExisting: true
        },
        estimatedDuration: 4000,
        priority: 2,
        description: 'Extract and integrate new physics validation patterns'
      }
    ],
    cooldownMs: 10000,
    maxRetries: 3,
    createdAt: Date.now() - 86400000,
    executionCount: 0,
    successCount: 0,
    averageExecutionTime: 0,
    category: 'quality'
  },
  {
    id: 'debugging_reporter',
    name: 'Debugging Report Generator',
    description: 'Creates detailed debugging reports when repeated errors occur',
    enabled: true,
    conditions: [
      {
        id: 'repeated_errors',
        name: 'Repeated Error Pattern',
        type: 'pattern_match',
        parameters: {
          errorCount: 3,
          timeWindow: 300000, // 5 minutes
          similarityThreshold: 0.8
        },
        description: 'Triggers when similar errors occur repeatedly within time window'
      }
    ],
    actions: [
      {
        id: 'create_debug_report',
        name: 'Create Debug Report',
        type: 'report_creation',
        parameters: {
          includeStackTrace: true,
          analyzePatterns: true,
          suggestFixes: true,
          prioritize: 'high'
        },
        estimatedDuration: 5000,
        priority: 1,
        description: 'Generate comprehensive debugging report with fix suggestions'
      },
      {
        id: 'notify_developers',
        name: 'Notify Development Team',
        type: 'notification',
        parameters: {
          channels: ['system', 'dashboard'],
          urgency: 'high',
          includeReport: true
        },
        estimatedDuration: 500,
        priority: 2,
        description: 'Alert development team about critical error patterns'
      }
    ],
    cooldownMs: 30000, // 30 seconds to prevent spam
    maxRetries: 2,
    createdAt: Date.now() - 86400000,
    executionCount: 0,
    successCount: 0,
    averageExecutionTime: 0,
    category: 'debugging'
  },
  {
    id: 'performance_optimizer',
    name: 'Performance Optimizer',
    description: 'Automatically optimizes system performance based on usage patterns',
    enabled: true,
    conditions: [
      {
        id: 'high_load_detected',
        name: 'High System Load',
        type: 'threshold_check',
        parameters: {
          metric: 'cpu_usage',
          threshold: 80,
          duration: 60000, // 1 minute
          consecutive: true
        },
        description: 'Triggers when system CPU usage exceeds 80% for 1 minute'
      }
    ],
    actions: [
      {
        id: 'optimize_resources',
        name: 'Optimize Resource Usage',
        type: 'system_optimization',
        parameters: {
          clearCache: true,
          prioritizeCore: true,
          reduceQuality: false
        },
        estimatedDuration: 3000,
        priority: 1,
        description: 'Optimize system resources while maintaining quality'
      }
    ],
    cooldownMs: 120000, // 2 minutes
    maxRetries: 1,
    createdAt: Date.now() - 86400000,
    executionCount: 0,
    successCount: 0,
    averageExecutionTime: 0,
    category: 'automation'
  }
];

// Utility functions
export function generateHookId(): string {
  return `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function evaluateCondition(condition: HookCondition, event: HookEvent): boolean {
  switch (condition.type) {
    case 'event_match':
      return evaluateEventMatch(condition.parameters, event);
    case 'pattern_match':
      return evaluatePatternMatch(condition.parameters, event);
    case 'threshold_check':
      return evaluateThresholdCheck(condition.parameters, event);
    default:
      return false;
  }
}

function evaluateEventMatch(params: Record<string, any>, event: HookEvent): boolean {
  if (params.eventType && event.type !== params.eventType) return false;
  if (params.source && event.source !== params.source) return false;
  if (params.success !== undefined && event.metadata.success !== params.success) return false;
  if (params.minQualityScore && (!event.data.qualityScore || event.data.qualityScore < params.minQualityScore)) return false;
  return true;
}

function evaluatePatternMatch(params: Record<string, any>, event: HookEvent): boolean {
  // Simplified pattern matching - in real implementation would check error history
  return event.type === 'error_occurred' && event.metadata.retryCount >= (params.errorCount || 3);
}

function evaluateThresholdCheck(params: Record<string, any>, event: HookEvent): boolean {
  // Simplified threshold check - in real implementation would check system metrics
  return event.data?.cpuUsage > (params.threshold || 80);
}

export function calculateProductivityGain(metrics: ProductivityMetrics): number {
  const timesSaved = metrics.totalTimesSaved / 1000; // Convert to seconds
  const manualTimeEquivalent = metrics.automatedTasks * 30; // Assume 30 seconds per manual task
  const totalTimeSaved = timesSaved + manualTimeEquivalent;
  
  // Calculate productivity gain as percentage
  const workingHoursInSeconds = 8 * 60 * 60; // 8 hours
  return Math.min(100, (totalTimeSaved / workingHoursInSeconds) * 100);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function getHookCategoryColor(category: AutomationHook['category']): string {
  switch (category) {
    case 'productivity': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'quality': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'automation': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    case 'debugging': return 'text-red-400 bg-red-500/10 border-red-500/30';
    default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
  }
}

export function getExecutionStatusColor(status: HookExecution['status']): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'running': return 'text-blue-400';
    case 'failed': return 'text-red-400';
    case 'skipped': return 'text-yellow-400';
    case 'pending': return 'text-neutral-400';
    default: return 'text-neutral-400';
  }
}