import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Zap,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Brain,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  RecoverySession, 
  ErrorRecoveryAttempt, 
  CorrectionStrategy 
} from './types';

interface CorrectionLoopVisualizerProps {
  sessions: RecoverySession[];
  isActive?: boolean;
  className?: string;
}

export function CorrectionLoopVisualizer({ 
  sessions, 
  isActive = false, 
  className 
}: CorrectionLoopVisualizerProps) {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [expandedAttempts, setExpandedAttempts] = useState<Set<string>>(new Set());

  // Auto-expand active sessions
  useEffect(() => {
    const activeSessions = sessions.filter(s => s.status === 'active');
    if (activeSessions.length > 0) {
      setExpandedSessions(new Set(activeSessions.map(s => s.id)));
    }
  }, [sessions]);

  const sessionStats = useMemo(() => {
    const active = sessions.filter(s => s.status === 'active').length;
    const resolved = sessions.filter(s => s.status === 'resolved').length;
    const escalated = sessions.filter(s => s.status === 'escalated').length;
    const totalAttempts = sessions.reduce((sum, s) => sum + s.totalAttempts, 0);
    
    return { active, resolved, escalated, totalAttempts };
  }, [sessions]);

  const toggleSessionExpansion = (sessionId: string) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const toggleAttemptExpansion = (attemptId: string) => {
    setExpandedAttempts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(attemptId)) {
        newSet.delete(attemptId);
      } else {
        newSet.add(attemptId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: RecoverySession['status'] | ErrorRecoveryAttempt['status']) => {
    switch (status) {
      case 'active':
      case 'running':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'resolved':
      case 'success':
        return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'escalated':
      case 'failed':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'pending':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
    }
  };

  const getStatusIcon = (status: RecoverySession['status'] | ErrorRecoveryAttempt['status']) => {
    switch (status) {
      case 'active':
      case 'running':
        return <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />;
      case 'resolved':
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'escalated':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-neutral-400" />;
    }
  };

  const getStrategyIcon = (strategy: CorrectionStrategy) => {
    switch (strategy.type) {
      case 'retry_with_modification':
        return <RotateCcw className="w-4 h-4 text-blue-400" />;
      case 'fallback_agent':
        return <Target className="w-4 h-4 text-purple-400" />;
      case 'parameter_adjustment':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'research_activation':
        return <Brain className="w-4 h-4 text-green-400" />;
      case 'manual_intervention':
        return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      default:
        return <Zap className="w-4 h-4 text-neutral-400" />;
    }
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const calculateProgress = (session: RecoverySession) => {
    if (session.status === 'resolved') return 100;
    if (session.status === 'escalated') return 100;
    if (session.totalAttempts === 0) return 0;
    
    // Estimate progress based on attempts and their success probability
    const completedAttempts = session.attempts.filter(a => a.status !== 'running').length;
    const runningAttempts = session.attempts.filter(a => a.status === 'running').length;
    
    return Math.min(90, (completedAttempts / Math.max(session.totalAttempts, 1)) * 100 + 
                     (runningAttempts > 0 ? 10 : 0));
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <RotateCcw className="w-5 h-5" />
            Correction Loop Monitor
          </h3>
          <Badge variant="outline" className="text-neutral-300 border-neutral-600">
            {sessionStats.active} Active Sessions
          </Badge>
        </div>
        <p className="text-sm text-neutral-400">
          Real-time monitoring of intelligent error recovery and self-correction loops
        </p>
      </div>

      {/* Statistics Dashboard */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-3 text-center">
          <div className="text-lg font-semibold text-blue-400">
            {sessionStats.active}
          </div>
          <div className="text-xs text-neutral-400">Active</div>
        </div>
        
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-3 text-center">
          <div className="text-lg font-semibold text-green-400">
            {sessionStats.resolved}
          </div>
          <div className="text-xs text-neutral-400">Resolved</div>
        </div>
        
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-3 text-center">
          <div className="text-lg font-semibold text-red-400">
            {sessionStats.escalated}
          </div>
          <div className="text-xs text-neutral-400">Escalated</div>
        </div>
        
        <div className="bg-neutral-900 rounded-lg border border-neutral-700 p-3 text-center">
          <div className="text-lg font-semibold text-neutral-300">
            {sessionStats.totalAttempts}
          </div>
          <div className="text-xs text-neutral-400">Total Attempts</div>
        </div>
      </div>

      {/* Recovery Sessions */}
      <div className="space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-12 text-neutral-500">
            <RotateCcw className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No recovery sessions yet</p>
            <p className="text-xs">Error recovery will appear here when needed</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="bg-neutral-900 rounded-lg border border-neutral-700">
              {/* Session Header */}
              <div 
                className={cn(
                  "p-4 cursor-pointer transition-colors hover:bg-neutral-800/50",
                  getStatusColor(session.status)
                )}
                onClick={() => toggleSessionExpansion(session.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedSessions.has(session.id) ? (
                      <ChevronDown className="w-5 h-5 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-neutral-400" />
                    )}
                    
                    {getStatusIcon(session.status)}
                    
                    <div>
                      <div className="font-medium text-sm">
                        Recovery Session {session.id.split('_')[2]}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {session.errorContext.errorType.replace('_', ' ')} • 
                        {session.errorContext.failedAgent}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right text-xs">
                      <div className="text-neutral-300">
                        {session.totalAttempts} attempts
                      </div>
                      <div className="text-neutral-500">
                        {formatDuration(session.startTime, session.endTime)}
                      </div>
                    </div>
                    
                    <Badge variant="outline" size="sm" className={getStatusColor(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-400">Recovery Progress</span>
                    <span className="text-xs font-medium text-neutral-300">
                      {calculateProgress(session)}%
                    </span>
                  </div>
                  <Progress 
                    value={calculateProgress(session)} 
                    className="h-2"
                  />
                </div>
              </div>

              {/* Expanded Session Content */}
              {expandedSessions.has(session.id) && (
                <div className="border-t border-neutral-700">
                  {/* Error Context */}
                  <div className="p-4 bg-neutral-800/30">
                    <h4 className="text-sm font-medium text-neutral-200 mb-2">
                      Original Error
                    </h4>
                    <div className="bg-neutral-800 p-3 rounded text-sm font-mono text-red-300">
                      {session.errorContext.errorMessage}
                    </div>
                  </div>

                  {/* Correction Attempts */}
                  <div className="p-4">
                    <h4 className="text-sm font-medium text-neutral-200 mb-3">
                      Correction Attempts ({session.attempts.length})
                    </h4>
                    
                    <div className="space-y-3">
                      {session.attempts.map((attempt, index) => (
                        <div key={attempt.id} className="relative">
                          {/* Connection Line to Next Attempt */}
                          {index < session.attempts.length - 1 && (
                            <div className="absolute left-6 top-12 w-0.5 h-6 bg-neutral-600" />
                          )}

                          <div 
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-colors",
                              getStatusColor(attempt.status)
                            )}
                            onClick={() => toggleAttemptExpansion(attempt.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedAttempts.has(attempt.id) ? (
                                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-neutral-400" />
                                )}
                                
                                {getStatusIcon(attempt.status)}
                                {getStrategyIcon(attempt.strategy)}
                                
                                <div>
                                  <div className="text-sm font-medium">
                                    Attempt #{attempt.attemptNumber}: {attempt.strategy.name}
                                  </div>
                                  <div className="text-xs text-neutral-400">
                                    {attempt.strategy.description}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs">
                                <Clock className="w-3 h-3 text-neutral-500" />
                                <span className="text-neutral-400">
                                  {formatDuration(attempt.startTime, attempt.endTime)}
                                </span>
                              </div>
                            </div>

                            {/* Expanded Attempt Details */}
                            {expandedAttempts.has(attempt.id) && (
                              <div className="mt-3 pt-3 border-t border-neutral-600 space-y-2">
                                <div>
                                  <span className="text-xs text-neutral-500 uppercase tracking-wide">
                                    Strategy Details:
                                  </span>
                                  <div className="text-xs text-neutral-300 mt-1">
                                    <div>Type: {attempt.strategy.type.replace('_', ' ')}</div>
                                    <div>Priority: {attempt.strategy.priority}</div>
                                    <div>Success Rate: {attempt.strategy.estimatedSuccessRate}%</div>
                                  </div>
                                </div>
                                
                                {attempt.result && (
                                  <div>
                                    <span className="text-xs text-neutral-500 uppercase tracking-wide">
                                      Result:
                                    </span>
                                    <p className="text-sm text-neutral-300 mt-1 bg-neutral-800 p-2 rounded font-mono text-xs">
                                      {attempt.result}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Resolution */}
                  {session.finalResolution && (
                    <div className="p-4 bg-neutral-800/30 border-t border-neutral-700">
                      <h4 className="text-sm font-medium text-neutral-200 mb-2">
                        Final Resolution
                      </h4>
                      <div className="space-y-2">
                        <div className="text-sm text-neutral-300">
                          <strong>Method:</strong> {session.finalResolution.method}
                        </div>
                        <div className="text-sm text-neutral-300">
                          <strong>Result:</strong> {session.finalResolution.result}
                        </div>
                        {session.finalResolution.learnings.length > 0 && (
                          <div>
                            <div className="text-sm text-neutral-300 mb-1">
                              <strong>Learnings:</strong>
                            </div>
                            <ul className="text-xs text-neutral-400 space-y-1">
                              {session.finalResolution.learnings.map((learning, idx) => (
                                <li key={idx} className="flex items-center gap-2">
                                  <ArrowRight className="w-3 h-3" />
                                  {learning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Active Recovery Indicator */}
      {sessionStats.active > 0 && (
        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <div>
              <div className="text-sm font-medium text-blue-300">
                Active Recovery in Progress
              </div>
              <div className="text-xs text-blue-400">
                {sessionStats.active} session(s) working to resolve errors automatically
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}