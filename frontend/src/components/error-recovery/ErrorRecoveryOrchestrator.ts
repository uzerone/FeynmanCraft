import { 
  ErrorRecoveryAttempt,
  CorrectionStrategy,
  ErrorContext,
  RecoverySession,
  StrategyLearning,
  classifyError,
  selectBestStrategy,
  generateRecoveryId,
  calculateSuccessProbability,
  CORRECTION_STRATEGIES
} from './types';

export class ErrorRecoveryOrchestrator {
  private activeSessions: Map<string, RecoverySession> = new Map();
  private strategyLearning: Map<string, StrategyLearning> = new Map();
  private maxConcurrentSessions = 3;
  private maxAttemptsPerSession = 5;
  
  // Event callbacks
  private onSessionStart?: (session: RecoverySession) => void;
  private onAttemptStart?: (attempt: ErrorRecoveryAttempt) => void;
  private onAttemptComplete?: (attempt: ErrorRecoveryAttempt) => void;
  private onSessionComplete?: (session: RecoverySession) => void;

  constructor() {
    // Initialize learning data with default values
    CORRECTION_STRATEGIES.forEach(strategy => {
      this.strategyLearning.set(strategy.id, {
        strategyId: strategy.id,
        totalAttempts: 0,
        successfulAttempts: 0,
        averageTimeToSuccess: 0,
        commonFailureReasons: [],
        adaptedParameters: {},
        lastUpdated: Date.now()
      });
    });
  }

  // Set event callbacks
  setEventCallbacks(callbacks: {
    onSessionStart?: (session: RecoverySession) => void;
    onAttemptStart?: (attempt: ErrorRecoveryAttempt) => void;
    onAttemptComplete?: (attempt: ErrorRecoveryAttempt) => void;
    onSessionComplete?: (session: RecoverySession) => void;
  }) {
    this.onSessionStart = callbacks.onSessionStart;
    this.onAttemptStart = callbacks.onAttemptStart;
    this.onAttemptComplete = callbacks.onAttemptComplete;
    this.onSessionComplete = callbacks.onSessionComplete;
  }

  // Start a new recovery session
  async startRecoverySession(
    originalRequest: string,
    failedAgent: string,
    errorMessage: string,
    systemState: ErrorContext['systemState']
  ): Promise<string> {
    // Check concurrent session limit
    if (this.activeSessions.size >= this.maxConcurrentSessions) {
      throw new Error('Maximum concurrent recovery sessions reached');
    }

    const sessionId = generateRecoveryId();
    const errorType = classifyError(errorMessage);
    
    const errorContext: ErrorContext = {
      originalRequest,
      failedAgent,
      errorMessage,
      errorType,
      attemptHistory: [],
      systemState
    };

    const session: RecoverySession = {
      id: sessionId,
      startTime: Date.now(),
      status: 'active',
      totalAttempts: 0,
      errorContext,
      attempts: []
    };

    this.activeSessions.set(sessionId, session);
    this.onSessionStart?.(session);

    // Start first recovery attempt
    await this.executeNextAttempt(sessionId);

    return sessionId;
  }

  // Execute the next recovery attempt
  private async executeNextAttempt(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return;
    }

    // Check if we've exceeded max attempts
    if (session.totalAttempts >= this.maxAttemptsPerSession) {
      await this.escalateSession(sessionId, 'Max attempts exceeded');
      return;
    }

    // Select best strategy for this attempt
    const strategy = selectBestStrategy(
      session.errorContext.errorType,
      session.errorContext.errorMessage,
      session.errorContext.attemptHistory
    );

    if (!strategy) {
      await this.escalateSession(sessionId, 'No suitable strategy available');
      return;
    }

    // Create new attempt
    const attempt: ErrorRecoveryAttempt = {
      id: `${sessionId}_attempt_${session.totalAttempts + 1}`,
      attemptNumber: session.totalAttempts + 1,
      errorType: session.errorContext.errorType,
      originalError: session.errorContext.errorMessage,
      strategy,
      status: 'running',
      startTime: Date.now(),
      agentInvolved: session.errorContext.failedAgent
    };

    session.attempts.push(attempt);
    session.totalAttempts++;
    session.errorContext.attemptHistory.push(attempt);

    this.onAttemptStart?.(attempt);

    // Execute the strategy
    try {
      const result = await this.executeStrategy(attempt, session);
      
      attempt.status = 'success';
      attempt.endTime = Date.now();
      attempt.result = result;

      // Update learning data
      this.updateStrategyLearning(strategy.id, true, attempt.endTime - attempt.startTime);

      // Mark session as resolved
      session.status = 'resolved';
      session.endTime = Date.now();
      session.finalResolution = {
        method: strategy.name,
        result,
        learnings: this.extractLearnings(session)
      };

      this.onAttemptComplete?.(attempt);
      this.onSessionComplete?.(session);
      this.activeSessions.delete(sessionId);

    } catch (error) {
      attempt.status = 'failed';
      attempt.endTime = Date.now();
      attempt.result = error instanceof Error ? error.message : 'Unknown error';

      // Update learning data
      this.updateStrategyLearning(strategy.id, false, attempt.endTime - attempt.startTime);

      this.onAttemptComplete?.(attempt);

      // Try next strategy or escalate
      await this.executeNextAttempt(sessionId);
    }
  }

  // Execute a specific correction strategy
  private async executeStrategy(
    attempt: ErrorRecoveryAttempt, 
    session: RecoverySession
  ): Promise<string> {
    const { strategy } = attempt;
    
    // Simulate strategy execution based on type
    switch (strategy.type) {
      case 'retry_with_modification':
        return this.executeRetryWithModification(attempt, session);
      
      case 'fallback_agent':
        return this.executeFallbackAgent(attempt, session);
      
      case 'parameter_adjustment':
        return this.executeParameterAdjustment(attempt, session);
      
      case 'research_activation':
        return this.executeResearchActivation(attempt, session);
      
      case 'manual_intervention':
        return this.executeManualIntervention(attempt, session);
      
      default:
        throw new Error(`Unknown strategy type: ${strategy.type}`);
    }
  }

  private async executeRetryWithModification(
    attempt: ErrorRecoveryAttempt,
    session: RecoverySession
  ): Promise<string> {
    // Simulate LaTeX syntax fix or agent restart
    await this.delay(2000 + Math.random() * 3000);
    
    if (attempt.strategy.id === 'latex_syntax_fix') {
      // Simulate LaTeX correction
      const successRate = calculateSuccessProbability(
        attempt.strategy, 
        attempt.attemptNumber,
        this.strategyLearning.get(attempt.strategy.id)
      );
      
      if (Math.random() * 100 < successRate) {
        return 'LaTeX syntax errors corrected and compilation successful';
      } else {
        throw new Error('LaTeX syntax correction failed - complex errors detected');
      }
    } else if (attempt.strategy.id === 'agent_restart') {
      // Simulate agent restart
      const successRate = calculateSuccessProbability(
        attempt.strategy,
        attempt.attemptNumber,
        this.strategyLearning.get(attempt.strategy.id)
      );
      
      if (Math.random() * 100 < successRate) {
        return `${session.errorContext.failedAgent} restarted successfully with fresh context`;
      } else {
        throw new Error('Agent restart failed - persistent communication issues');
      }
    }
    
    throw new Error('Retry with modification failed');
  }

  private async executeFallbackAgent(
    attempt: ErrorRecoveryAttempt,
    session: RecoverySession
  ): Promise<string> {
    await this.delay(3000 + Math.random() * 2000);
    
    const successRate = calculateSuccessProbability(
      attempt.strategy,
      attempt.attemptNumber,
      this.strategyLearning.get(attempt.strategy.id)
    );
    
    if (Math.random() * 100 < successRate) {
      return 'Alternative diagram generation approach successful with simplified TikZ code';
    } else {
      throw new Error('Fallback agent approach failed - fundamental diagram issue');
    }
  }

  private async executeParameterAdjustment(
    attempt: ErrorRecoveryAttempt,
    session: RecoverySession
  ): Promise<string> {
    await this.delay(1500 + Math.random() * 1000);
    
    const successRate = calculateSuccessProbability(
      attempt.strategy,
      attempt.attemptNumber,
      this.strategyLearning.get(attempt.strategy.id)
    );
    
    if (Math.random() * 100 < successRate) {
      return 'Physics constraints relaxed for edge case - validation now passes';
    } else {
      throw new Error('Parameter adjustment failed - physics violation too severe');
    }
  }

  private async executeResearchActivation(
    attempt: ErrorRecoveryAttempt,
    session: RecoverySession
  ): Promise<string> {
    await this.delay(5000 + Math.random() * 3000);
    
    const successRate = calculateSuccessProbability(
      attempt.strategy,
      attempt.attemptNumber,
      this.strategyLearning.get(attempt.strategy.id)
    );
    
    if (Math.random() * 100 < successRate) {
      return 'DeepResearchAgent activated and found 3 relevant physics examples from arXiv';
    } else {
      throw new Error('Deep research activation failed - no relevant examples found');
    }
  }

  private async executeManualIntervention(
    attempt: ErrorRecoveryAttempt,
    session: RecoverySession
  ): Promise<string> {
    await this.delay(1000);
    
    // Manual intervention always "succeeds" by requesting user help
    return 'Manual intervention requested - user guidance needed for complex physics validation';
  }

  // Escalate session when all strategies fail
  private async escalateSession(sessionId: string, reason: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'escalated';
    session.endTime = Date.now();
    session.finalResolution = {
      method: 'escalation',
      result: `Session escalated: ${reason}`,
      learnings: this.extractLearnings(session)
    };

    this.onSessionComplete?.(session);
    this.activeSessions.delete(sessionId);
  }

  // Update strategy learning data
  private updateStrategyLearning(
    strategyId: string,
    success: boolean,
    duration: number
  ): void {
    const learning = this.strategyLearning.get(strategyId);
    if (!learning) return;

    learning.totalAttempts++;
    if (success) {
      learning.successfulAttempts++;
      learning.averageTimeToSuccess = 
        (learning.averageTimeToSuccess + duration) / learning.successfulAttempts;
    }
    learning.lastUpdated = Date.now();

    this.strategyLearning.set(strategyId, learning);
  }

  // Extract learnings from completed session
  private extractLearnings(session: RecoverySession): string[] {
    const learnings: string[] = [];
    
    const failedStrategies = session.attempts.filter(a => a.status === 'failed');
    const successfulStrategy = session.attempts.find(a => a.status === 'success');
    
    if (failedStrategies.length > 0) {
      learnings.push(`${failedStrategies.length} strategies failed before success`);
    }
    
    if (successfulStrategy) {
      learnings.push(`${successfulStrategy.strategy.name} was effective for ${session.errorContext.errorType}`);
    }
    
    const totalTime = (session.endTime || Date.now()) - session.startTime;
    learnings.push(`Total recovery time: ${(totalTime / 1000).toFixed(1)}s`);
    
    return learnings;
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public getters for monitoring
  getActiveSessions(): RecoverySession[] {
    return Array.from(this.activeSessions.values());
  }

  getSession(sessionId: string): RecoverySession | undefined {
    return this.activeSessions.get(sessionId);
  }

  getStrategyLearning(): Map<string, StrategyLearning> {
    return new Map(this.strategyLearning);
  }

  // Simulate error for demo purposes
  async simulateError(
    errorType: 'latex_compilation' | 'physics_validation' | 'knowledge_gap' = 'latex_compilation'
  ): Promise<string> {
    const errorMessages = {
      latex_compilation: 'LaTeX Error: Undefined control sequence \\feynmandiagram',
      physics_validation: 'Physics Error: Charge conservation violated in electron-positron interaction',
      knowledge_gap: 'Knowledge Error: No similar examples found for exotic particle interaction'
    };

    return this.startRecoverySession(
      'Generate Feynman diagram for electron-positron scattering',
      'diagram_generator_agent',
      errorMessages[errorType],
      {
        availableAgents: ['planner_agent', 'kb_retriever_agent', 'physics_validator_agent'],
        resourceUsage: 0.3,
        previousResults: []
      }
    );
  }
}