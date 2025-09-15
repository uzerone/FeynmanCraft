import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  RotateCcw, 
  Brain,
  Play,
  Pause,
  RefreshCw
} from 'lucide-react';

import { ErrorRecoveryOrchestrator } from './ErrorRecoveryOrchestrator';
import { CorrectionLoopVisualizer } from './CorrectionLoopVisualizer';
import { ErrorAnalysisEngine } from './ErrorAnalysisEngine';
import { 
  RecoverySession, 
  ErrorRecoveryAttempt,
  StrategyLearning
} from './types';

interface ErrorRecoveryDashboardProps {
  isActive?: boolean;
  className?: string;
}

export function ErrorRecoveryDashboard({ 
  isActive = false, 
  className 
}: ErrorRecoveryDashboardProps) {
  const [sessions, setSessions] = useState<RecoverySession[]>([]);
  const [strategyLearning, setStrategyLearning] = useState<Map<string, StrategyLearning>>(new Map());
  const [isSimulating, setIsSimulating] = useState(false);
  const orchestratorRef = useRef<ErrorRecoveryOrchestrator | null>(null);

  // Initialize orchestrator
  useEffect(() => {
    const orchestrator = new ErrorRecoveryOrchestrator();
    
    // Set up event callbacks
    orchestrator.setEventCallbacks({
      onSessionStart: (session) => {
        setSessions(prev => [...prev, session]);
      },
      onAttemptStart: (attempt) => {
        setSessions(prev => prev.map(s => 
          s.id === attempt.id.split('_attempt_')[0] 
            ? { ...s, attempts: [...s.attempts.filter(a => a.id !== attempt.id), attempt] }
            : s
        ));
      },
      onAttemptComplete: (attempt) => {
        setSessions(prev => prev.map(s => 
          s.id === attempt.id.split('_attempt_')[0]
            ? { 
                ...s, 
                attempts: s.attempts.map(a => a.id === attempt.id ? attempt : a)
              }
            : s
        ));
      },
      onSessionComplete: (session) => {
        setSessions(prev => prev.map(s => s.id === session.id ? session : s));
        setStrategyLearning(orchestrator.getStrategyLearning());
      }
    });

    orchestratorRef.current = orchestrator;
    setStrategyLearning(orchestrator.getStrategyLearning());

    return () => {
      orchestratorRef.current = null;
    };
  }, []);

  // Simulate error scenarios for demo
  const simulateError = async (errorType: 'latex_compilation' | 'physics_validation' | 'knowledge_gap') => {
    if (!orchestratorRef.current || isSimulating) return;
    
    setIsSimulating(true);
    
    try {
      await orchestratorRef.current.simulateError(errorType);
    } catch (error) {
      console.error('Error simulation failed:', error);
    } finally {
      setIsSimulating(false);
    }
  };

  // Clear all sessions
  const clearSessions = () => {
    setSessions([]);
  };

  const activeSessionsCount = sessions.filter(s => s.status === 'active').length;
  const resolvedSessionsCount = sessions.filter(s => s.status === 'resolved').length;
  const escalatedSessionsCount = sessions.filter(s => s.status === 'escalated').length;

  return (
    <div className={className}>
      {/* Header with Controls */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-400" />
            <div>
              <h2 className="text-xl font-semibold text-neutral-100">
                Intelligent Error Recovery System
              </h2>
              <p className="text-sm text-neutral-400">
                Advanced AI-driven error detection, analysis, and automatic correction
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={
              activeSessionsCount > 0 
                ? "text-blue-400 border-blue-500/30 animate-pulse" 
                : "text-neutral-400 border-neutral-600"
            }>
              {activeSessionsCount} Active
            </Badge>
            
            <Badge variant="outline" className="text-green-400 border-green-500/30">
              {resolvedSessionsCount} Resolved
            </Badge>
            
            {escalatedSessionsCount > 0 && (
              <Badge variant="outline" className="text-red-400 border-red-500/30">
                {escalatedSessionsCount} Escalated
              </Badge>
            )}
          </div>
        </div>

        {/* Demo Controls */}
        <div className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-700">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <Brain className="w-4 h-4" />
            <span>Demo Controls:</span>
          </div>
          
          <button
            onClick={() => simulateError('latex_compilation')}
            disabled={isSimulating}
            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded text-xs hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            LaTeX Error
          </button>
          
          <button
            onClick={() => simulateError('physics_validation')}
            disabled={isSimulating}
            className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 rounded text-xs hover:bg-yellow-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Physics Error
          </button>
          
          <button
            onClick={() => simulateError('knowledge_gap')}
            disabled={isSimulating}
            className="px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded text-xs hover:bg-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Knowledge Gap
          </button>
          
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={clearSessions}
              disabled={isSimulating || sessions.length === 0}
              className="px-3 py-1 bg-neutral-600/10 text-neutral-400 border border-neutral-600/30 rounded text-xs hover:bg-neutral-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
            
            {isSimulating && (
              <div className="flex items-center gap-2 text-xs text-blue-400">
                <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                Simulating...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-neutral-800">
          <TabsTrigger 
            value="monitor" 
            className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Recovery Monitor</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="analysis" 
            className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
          >
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Analysis Engine</span>
          </TabsTrigger>
          
          <TabsTrigger 
            value="learning" 
            className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Learning Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* Recovery Monitor Tab */}
        <TabsContent value="monitor" className="space-y-4">
          <CorrectionLoopVisualizer 
            sessions={sessions}
            isActive={isActive}
            className="text-neutral-100"
          />
        </TabsContent>

        {/* Analysis Engine Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <ErrorAnalysisEngine 
            sessions={sessions}
            strategyLearning={strategyLearning}
            className="text-neutral-100"
          />
        </TabsContent>

        {/* Learning Statistics Tab */}
        <TabsContent value="learning" className="space-y-4">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Strategy Learning Statistics
            </h3>
            
            {strategyLearning.size === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No learning data yet</p>
                <p className="text-xs">Statistics will appear as the system learns from recovery attempts</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {Array.from(strategyLearning.entries()).map(([strategyId, learning]) => (
                  <div key={strategyId} className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-neutral-200">
                        {strategyId.replace('_', ' ').toUpperCase()}
                      </h4>
                      <Badge variant="outline" size="sm" className="text-neutral-300 border-neutral-600">
                        {learning.totalAttempts} attempts
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-green-400">
                          {learning.totalAttempts > 0 
                            ? Math.round((learning.successfulAttempts / learning.totalAttempts) * 100)
                            : 0}%
                        </div>
                        <div className="text-xs text-neutral-400">Success Rate</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">
                          {learning.averageTimeToSuccess > 0
                            ? `${(learning.averageTimeToSuccess / 1000).toFixed(1)}s`
                            : 'N/A'
                          }
                        </div>
                        <div className="text-xs text-neutral-400">Avg Time</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-neutral-300">
                          {learning.successfulAttempts}
                        </div>
                        <div className="text-xs text-neutral-400">Successes</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-lg font-semibold text-neutral-300">
                          {new Date(learning.lastUpdated).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-neutral-400">Last Updated</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Real-time Status Indicator */}
      {activeSessionsCount > 0 && (
        <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
            <div>
              <div className="text-sm font-medium text-blue-300">
                Recovery System Active
              </div>
              <div className="text-xs text-blue-400">
                {activeSessionsCount} session(s) currently running intelligent error correction
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}