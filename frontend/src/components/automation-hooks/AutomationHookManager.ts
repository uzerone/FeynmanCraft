import {
  AutomationHook,
  HookEvent,
  HookExecution,
  HookActionExecution,
  ProductivityMetrics,
  HookStats,
  DEFAULT_HOOKS,
  generateExecutionId,
  evaluateCondition,
  calculateProductivityGain,
} from './types';

export class AutomationHookManager {
  private hooks: Map<string, AutomationHook> = new Map();
  private executions: Map<string, HookExecution> = new Map();
  private eventHistory: HookEvent[] = [];
  private productivityMetrics: ProductivityMetrics = {
    totalTimesSaved: 0,
    automatedTasks: 0,
    manualInterventionsPrevented: 0,
    knowledgeBaseUpdates: 0,
    formatsGenerated: 0,
    errorsAutoFixed: 0,
    reportsMade: 0,
    lastCalculated: Date.now()
  };

  // Event callbacks
  private onHookExecutionStart?: (execution: HookExecution) => void;
  private onHookExecutionComplete?: (execution: HookExecution) => void;
  private onHookActionStart?: (execution: HookExecution, action: HookActionExecution) => void;
  private onHookActionComplete?: (execution: HookExecution, action: HookActionExecution) => void;
  private onProductivityUpdate?: (metrics: ProductivityMetrics) => void;

  constructor() {
    // Initialize with default hooks
    DEFAULT_HOOKS.forEach(hook => {
      this.hooks.set(hook.id, { ...hook });
    });
  }

  // Set event callbacks
  setEventCallbacks(callbacks: {
    onHookExecutionStart?: (execution: HookExecution) => void;
    onHookExecutionComplete?: (execution: HookExecution) => void;
    onHookActionStart?: (execution: HookExecution, action: HookActionExecution) => void;
    onHookActionComplete?: (execution: HookExecution, action: HookActionExecution) => void;
    onProductivityUpdate?: (metrics: ProductivityMetrics) => void;
  }) {
    this.onHookExecutionStart = callbacks.onHookExecutionStart;
    this.onHookExecutionComplete = callbacks.onHookExecutionComplete;
    this.onHookActionStart = callbacks.onHookActionStart;
    this.onHookActionComplete = callbacks.onHookActionComplete;
    this.onProductivityUpdate = callbacks.onProductivityUpdate;
  }

  // Process incoming events
  async processEvent(event: HookEvent): Promise<void> {
    // Add to event history
    this.eventHistory.push(event);
    
    // Keep only last 1000 events
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }

    // Find matching hooks
    const matchingHooks = this.findMatchingHooks(event);
    
    // Execute matching hooks
    for (const hook of matchingHooks) {
      await this.executeHook(hook, event);
    }
  }

  // Find hooks that match the event
  private findMatchingHooks(event: HookEvent): AutomationHook[] {
    const matchingHooks: AutomationHook[] = [];
    
    for (const hook of this.hooks.values()) {
      if (!hook.enabled) continue;
      
      // Check cooldown
      if (hook.lastExecuted && Date.now() - hook.lastExecuted < hook.cooldownMs) {
        continue;
      }
      
      // Check conditions
      const conditionsMatch = hook.conditions.every(condition => 
        evaluateCondition(condition, event)
      );
      
      if (conditionsMatch) {
        matchingHooks.push(hook);
      }
    }
    
    return matchingHooks;
  }

  // Execute a hook
  private async executeHook(hook: AutomationHook, triggeringEvent: HookEvent): Promise<void> {
    const execution: HookExecution = {
      id: generateExecutionId(),
      hookId: hook.id,
      triggeredBy: triggeringEvent,
      startTime: Date.now(),
      status: 'running',
      actions: []
    };

    this.executions.set(execution.id, execution);
    this.onHookExecutionStart?.(execution);

    try {
      // Execute actions in priority order
      const sortedActions = [...hook.actions].sort((a, b) => a.priority - b.priority);
      
      for (const action of sortedActions) {
        const actionExecution: HookActionExecution = {
          id: generateExecutionId(),
          actionId: action.id,
          startTime: Date.now(),
          status: 'running'
        };
        
        execution.actions.push(actionExecution);
        this.onHookActionStart?.(execution, actionExecution);
        
        try {
          const result = await this.executeAction(action, triggeringEvent);
          
          actionExecution.status = 'completed';
          actionExecution.endTime = Date.now();
          actionExecution.result = result;
          
          this.onHookActionComplete?.(execution, actionExecution);
          
          // Update productivity metrics
          this.updateProductivityMetrics(action, actionExecution.endTime - actionExecution.startTime);
          
        } catch (error) {
          actionExecution.status = 'failed';
          actionExecution.endTime = Date.now();
          actionExecution.error = error instanceof Error ? error.message : 'Unknown error';
          
          this.onHookActionComplete?.(execution, actionExecution);
        }
      }
      
      // Mark execution as completed
      execution.status = 'completed';
      execution.endTime = Date.now();
      execution.result = 'All actions completed successfully';
      
      // Update hook statistics
      this.updateHookStats(hook, execution.endTime - execution.startTime, true);
      
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = Date.now();
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      
      this.updateHookStats(hook, (execution.endTime || Date.now()) - execution.startTime, false);
    }

    hook.lastExecuted = Date.now();
    this.onHookExecutionComplete?.(execution);
  }

  // Execute a specific action
  private async executeAction(action: HookActionExecution, triggeringEvent: HookEvent): Promise<any> {
    // Simulate action execution based on type
    await this.delay(action.estimatedDuration || 1000);
    
    switch (action.type) {
      case 'knowledge_update':
        return this.executeKnowledgeUpdate(action, triggeringEvent);
      case 'format_generation':
        return this.executeFormatGeneration(action, triggeringEvent);
      case 'report_creation':
        return this.executeReportCreation(action, triggeringEvent);
      case 'notification':
        return this.executeNotification(action, triggeringEvent);
      case 'system_optimization':
        return this.executeSystemOptimization(action, triggeringEvent);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async executeKnowledgeUpdate(action: HookActionExecution, event: HookEvent): Promise<string> {
    // Simulate knowledge base update
    const patterns = this.extractPhysicsPatterns(event.data);
    const entriesAdded = Math.floor(Math.random() * 3) + 1;
    
    return `Added ${entriesAdded} new physics patterns to knowledge base. Patterns: ${patterns.join(', ')}`;
  }

  private async executeFormatGeneration(action: HookActionExecution, event: HookEvent): Promise<string> {
    // Simulate format generation
    const format = action.parameters.format || 'unknown';
    const quality = action.parameters.quality || 'standard';
    const fileSize = Math.floor(Math.random() * 500) + 100; // KB
    
    return `Generated ${format.toUpperCase()} (${quality} quality, ${fileSize}KB)`;
  }

  private async executeReportCreation(action: HookActionExecution, event: HookEvent): Promise<string> {
    // Simulate debugging report creation
    const issuesFound = Math.floor(Math.random() * 5) + 2;
    const suggestionsCount = Math.floor(Math.random() * 3) + 1;
    
    return `Created debugging report: ${issuesFound} issues identified, ${suggestionsCount} improvement suggestions provided`;
  }

  private async executeNotification(action: HookActionExecution, event: HookEvent): Promise<string> {
    // Simulate notification sending
    const channels = action.parameters.channels || ['system'];
    
    return `Notification sent to ${channels.join(', ')} channels`;
  }

  private async executeSystemOptimization(action: HookActionExecution, event: HookEvent): Promise<string> {
    // Simulate system optimization
    const optimizations = [
      'Cache cleared (120MB freed)',
      'Memory usage reduced by 15%',
      'Background processes optimized'
    ];
    
    return `System optimization completed: ${optimizations.join(', ')}`;
  }

  // Extract physics patterns from event data
  private extractPhysicsPatterns(data: any): string[] {
    const patterns = [
      'electron-positron-annihilation',
      'photon-exchange-qed',
      'lepton-number-conservation',
      'energy-momentum-conservation',
      'charge-conservation-law'
    ];
    
    // Return random subset
    const count = Math.floor(Math.random() * 3) + 1;
    return patterns.slice(0, count);
  }

  // Update hook statistics
  private updateHookStats(hook: AutomationHook, executionTime: number, success: boolean): void {
    hook.executionCount++;
    
    if (success) {
      hook.successCount++;
      // Update average execution time (weighted average)
      const weight = 0.2;
      hook.averageExecutionTime = hook.averageExecutionTime * (1 - weight) + executionTime * weight;
    }
    
    this.hooks.set(hook.id, hook);
  }

  // Update productivity metrics
  private updateProductivityMetrics(action: HookActionExecution, executionTime: number): void {
    this.productivityMetrics.automatedTasks++;
    this.productivityMetrics.totalTimesSaved += executionTime;
    
    switch (action.type) {
      case 'knowledge_update':
        this.productivityMetrics.knowledgeBaseUpdates++;
        this.productivityMetrics.manualInterventionsPrevented++;
        break;
      case 'format_generation':
        this.productivityMetrics.formatsGenerated++;
        this.productivityMetrics.totalTimesSaved += 30000; // 30 seconds saved per format
        break;
      case 'report_creation':
        this.productivityMetrics.reportsMade++;
        this.productivityMetrics.manualInterventionsPrevented++;
        break;
      case 'system_optimization':
        this.productivityMetrics.errorsAutoFixed++;
        break;
    }
    
    this.productivityMetrics.lastCalculated = Date.now();
    this.onProductivityUpdate?.(this.productivityMetrics);
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public getters
  getHooks(): AutomationHook[] {
    return Array.from(this.hooks.values());
  }

  getHook(id: string): AutomationHook | undefined {
    return this.hooks.get(id);
  }

  getExecutions(): HookExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 50); // Last 50 executions
  }

  getExecution(id: string): HookExecution | undefined {
    return this.executions.get(id);
  }

  getProductivityMetrics(): ProductivityMetrics {
    return { ...this.productivityMetrics };
  }

  getHookStats(): HookStats {
    const hooks = Array.from(this.hooks.values());
    const executions = Array.from(this.executions.values());
    
    return {
      totalHooks: hooks.length,
      activeHooks: hooks.filter(h => h.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      averageExecutionTime: hooks.reduce((sum, h) => sum + h.averageExecutionTime, 0) / hooks.length || 0,
      totalTimeSaved: this.productivityMetrics.totalTimesSaved,
      productivityGain: calculateProductivityGain(this.productivityMetrics)
    };
  }

  // Hook management methods
  enableHook(id: string): void {
    const hook = this.hooks.get(id);
    if (hook) {
      hook.enabled = true;
      this.hooks.set(id, hook);
    }
  }

  disableHook(id: string): void {
    const hook = this.hooks.get(id);
    if (hook) {
      hook.enabled = false;
      this.hooks.set(id, hook);
    }
  }

  // Simulate events for demo purposes
  async simulateEvent(eventType: HookEvent['type']): Promise<void> {
    const event: HookEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      source: 'system',
      timestamp: Date.now(),
      data: {
        qualityScore: 0.85 + Math.random() * 0.15,
        processingTime: Math.random() * 5000 + 1000,
        complexity: Math.random(),
        cpuUsage: eventType === 'error_occurred' ? 85 : 45
      },
      metadata: {
        success: eventType !== 'error_occurred',
        duration: Math.random() * 3000 + 500,
        retryCount: eventType === 'error_occurred' ? Math.floor(Math.random() * 3) + 1 : 0,
        errorMessage: eventType === 'error_occurred' ? 'Simulated error for demonstration' : undefined
      }
    };

    await this.processEvent(event);
  }
}