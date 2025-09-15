import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Brain, 
  Lightbulb, 
  BookOpen, 
  TrendingUp,
  ChevronDown,
  ChevronRight,
  Target,
  Zap,
  HelpCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  RecoverySession,
  ErrorRecoveryAttempt,
  StrategyLearning,
  classifyError
} from './types';

interface RootCauseAnalysis {
  id: string;
  errorType: string;
  rootCause: string;
  confidence: number; // 0-100
  evidence: string[];
  relatedPatterns: string[];
  suggestedFixes: string[];
  preventionStrategies: string[];
}

interface ManualIntervention {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: string;
  complexity: 'beginner' | 'intermediate' | 'expert';
  steps: string[];
  risks: string[];
  alternatives: string[];
}

interface EducationalContent {
  topic: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  keyPoints: string[];
  examples: string[];
  relatedTopics: string[];
}

interface ErrorAnalysisEngineProps {
  sessions: RecoverySession[];
  strategyLearning: Map<string, StrategyLearning>;
  className?: string;
}

export function ErrorAnalysisEngine({ 
  sessions, 
  strategyLearning, 
  className 
}: ErrorAnalysisEngineProps) {
  const [activeTab, setActiveTab] = useState<'analysis' | 'interventions' | 'education'>('analysis');
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set());
  const [expandedInterventions, setExpandedInterventions] = useState<Set<string>>(new Set());

  // Generate root cause analyses
  const rootCauseAnalyses = useMemo((): RootCauseAnalysis[] => {
    const analyses: RootCauseAnalysis[] = [];
    
    sessions.forEach((session, index) => {
      const errorType = session.errorContext.errorType;
      const failedAttempts = session.attempts.filter(a => a.status === 'failed');
      
      let rootCause = '';
      let confidence = 70;
      let evidence: string[] = [];
      let suggestedFixes: string[] = [];
      let preventionStrategies: string[] = [];

      switch (errorType) {
        case 'latex_compilation':
          rootCause = 'Complex TikZ-Feynman syntax incompatibility with LaTeX engine';
          confidence = 85;
          evidence = [
            'Multiple syntax correction attempts failed',
            'Error pattern matches known TikZ-Feynman issues',
            'Alternative approaches had different failure modes'
          ];
          suggestedFixes = [
            'Update TikZ-Feynman package to latest version',
            'Use simpler particle representation',
            'Switch to alternative LaTeX engine (LuaLaTeX)',
            'Pre-validate TikZ syntax before compilation'
          ];
          preventionStrategies = [
            'Implement TikZ syntax validation in DiagramGeneratorAgent',
            'Maintain compatibility matrix for LaTeX packages',
            'Add fallback diagram templates for common failures'
          ];
          break;
          
        case 'physics_validation':
          rootCause = 'Edge case physics process not covered by validation rules';
          confidence = 75;
          evidence = [
            'Physics constraint relaxation partially worked',
            'Similar patterns in historical data',
            'Knowledge base lacks edge case examples'
          ];
          suggestedFixes = [
            'Expand physics validation rule set',
            'Add edge case handling to PhysicsValidatorAgent',
            'Implement fuzzy physics matching',
            'Consult physics databases for rare processes'
          ];
          preventionStrategies = [
            'Continuous learning from physics literature',
            'Expand knowledge base with edge cases',
            'Implement confidence-based validation thresholds'
          ];
          break;
          
        case 'knowledge_gap':
          rootCause = 'Insufficient training data for exotic particle interactions';
          confidence = 90;
          evidence = [
            'Knowledge base search returned no results',
            'Deep research found limited relevant examples',
            'Similar requests failed previously'
          ];
          suggestedFixes = [
            'Expand knowledge base with arXiv papers',
            'Implement dynamic learning from research',
            'Create synthetic training examples',
            'Partner with physics research institutions'
          ];
          preventionStrategies = [
            'Automated knowledge base updates from arXiv',
            'Crowdsourced physics example collection',
            'Implement active learning for rare cases'
          ];
          break;
          
        default:
          rootCause = 'System communication or resource constraint';
          confidence = 60;
          evidence = ['Timeout or communication errors observed'];
          suggestedFixes = ['Increase timeout limits', 'Implement retry logic'];
          preventionStrategies = ['Monitor system resources', 'Implement circuit breakers'];
      }

      analyses.push({
        id: `analysis_${index}`,
        errorType,
        rootCause,
        confidence,
        evidence,
        relatedPatterns: [`Pattern ${index + 1}`, `Similar to case #${Math.floor(Math.random() * 50) + 1}`],
        suggestedFixes,
        preventionStrategies
      });
    });

    return analyses;
  }, [sessions]);

  // Generate manual interventions
  const manualInterventions = useMemo((): ManualIntervention[] => {
    const interventions: ManualIntervention[] = [];
    
    sessions.forEach((session, index) => {
      if (session.status === 'escalated' || session.attempts.some(a => a.strategy.type === 'manual_intervention')) {
        const errorType = session.errorContext.errorType;
        
        let intervention: Omit<ManualIntervention, 'id'>;
        
        switch (errorType) {
          case 'latex_compilation':
            intervention = {
              title: 'Manual LaTeX Compilation Fix',
              description: 'Complex TikZ-Feynman diagram requires manual LaTeX expertise',
              priority: 'high' as const,
              estimatedTime: '15-30 minutes',
              complexity: 'intermediate' as const,
              steps: [
                'Review the generated TikZ-Feynman code for syntax errors',
                'Check package compatibility and version requirements',
                'Test compilation with different LaTeX engines',
                'Simplify complex diagram elements if necessary',
                'Validate final output matches physics requirements'
              ],
              risks: [
                'Manual fixes may introduce physics errors',
                'Time-consuming debugging process',
                'Solution may not be generalizable'
              ],
              alternatives: [
                'Use simplified diagram template',
                'Switch to alternative diagram format (e.g., hand-drawn style)',
                'Request physics expert review'
              ]
            };
            break;
            
          case 'physics_validation':
            intervention = {
              title: 'Physics Expert Consultation',
              description: 'Complex physics validation requires domain expert review',
              priority: 'critical' as const,
              estimatedTime: '30-60 minutes',
              complexity: 'expert' as const,
              steps: [
                'Consult with physics domain expert',
                'Review conservation laws and quantum numbers',
                'Verify interaction is physically valid',
                'Update validation rules if appropriate',
                'Document decision for future cases'
              ],
              risks: [
                'May require external expert consultation',
                'Could reveal fundamental system limitations',
                'Time-sensitive decisions'
              ],
              alternatives: [
                'Use conservative physics assumptions',
                'Flag diagram as "theoretical/speculative"',
                'Implement user warning system'
              ]
            };
            break;
            
          case 'knowledge_gap':
            intervention = {
              title: 'Knowledge Base Enhancement',
              description: 'Missing physics examples require manual research and curation',
              priority: 'medium' as const,
              estimatedTime: '45-90 minutes',
              complexity: 'intermediate' as const,
              steps: [
                'Search physics literature (arXiv, journals)',
                'Identify relevant experimental or theoretical examples',
                'Extract key physics parameters and constraints',
                'Create standardized knowledge base entries',
                'Validate new entries with physics experts'
              ],
              risks: [
                'Research may not find relevant examples',
                'Quality control for new entries',
                'Potential licensing issues with published content'
              ],
              alternatives: [
                'Generate synthetic examples based on similar cases',
                'Contact physics research community',
                'Implement "best guess" with confidence intervals'
              ]
            };
            break;
            
          default:
            intervention = {
              title: 'System Debugging',
              description: 'Technical system issues require debugging and optimization',
              priority: 'medium' as const,
              estimatedTime: '20-40 minutes',
              complexity: 'beginner' as const,
              steps: [
                'Review system logs and error traces',
                'Check resource usage and performance metrics',
                'Identify bottlenecks or communication failures',
                'Apply appropriate fixes or workarounds',
                'Monitor system stability'
              ],
              risks: [
                'May require system restart',
                'Temporary performance degradation',
                'User experience interruption'
              ],
              alternatives: [
                'Scale system resources',
                'Implement graceful degradation',
                'Use cached results when available'
              ]
            };
        }

        interventions.push({
          ...intervention,
          id: `intervention_${index}`
        });
      }
    });

    return interventions;
  }, [sessions]);

  // Educational content
  const educationalContent: EducationalContent[] = [
    {
      topic: 'error_recovery',
      title: 'Intelligent Error Recovery Systems',
      description: 'Understanding how AI systems can automatically detect, analyze, and recover from failures',
      difficulty: 'intermediate',
      keyPoints: [
        'Multi-strategy approach to error correction',
        'Learning from failure patterns',
        'Graceful degradation under constraints',
        'Human-in-the-loop for complex cases'
      ],
      examples: [
        'LaTeX compilation error correction loops',
        'Physics validation constraint relaxation',
        'Automatic research activation for knowledge gaps'
      ],
      relatedTopics: ['machine_learning', 'system_reliability', 'ai_safety']
    },
    {
      topic: 'correction_strategies',
      title: 'Correction Strategy Selection',
      description: 'How AI systems choose the most effective approach for different types of failures',
      difficulty: 'advanced',
      keyPoints: [
        'Pattern matching for error classification',
        'Success probability estimation',
        'Resource-aware strategy selection',
        'Adaptive learning from outcomes'
      ],
      examples: [
        'Retry with modification vs. fallback agents',
        'Parameter adjustment vs. research activation',
        'Escalation triggers and thresholds'
      ],
      relatedTopics: ['decision_theory', 'optimization', 'pattern_recognition']
    },
    {
      topic: 'learning_systems',
      title: 'Continuous Learning from Failures',
      description: 'How AI systems improve their error recovery capabilities over time',
      difficulty: 'advanced',
      keyPoints: [
        'Strategy effectiveness tracking',
        'Failure pattern recognition',
        'Parameter adaptation',
        'Knowledge base expansion'
      ],
      examples: [
        'Success rate evolution over time',
        'Adaptive timeout and retry parameters',
        'Dynamic strategy prioritization'
      ],
      relatedTopics: ['machine_learning', 'adaptive_systems', 'knowledge_management']
    }
  ];

  const getPriorityColor = (priority: ManualIntervention['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-500/10 border-green-500/30';
      default: return 'text-neutral-400 bg-neutral-500/10 border-neutral-500/30';
    }
  };

  const getComplexityColor = (complexity: ManualIntervention['complexity']) => {
    switch (complexity) {
      case 'expert': return 'text-red-400';
      case 'intermediate': return 'text-yellow-400';
      case 'beginner': return 'text-green-400';
      default: return 'text-neutral-400';
    }
  };

  const getDifficultyColor = (difficulty: EducationalContent['difficulty']) => {
    switch (difficulty) {
      case 'advanced': return 'text-red-400';
      case 'intermediate': return 'text-yellow-400';
      case 'beginner': return 'text-green-400';
      default: return 'text-neutral-400';
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Error Analysis Engine
          </h3>
          <Badge variant="outline" className="text-neutral-300 border-neutral-600">
            {rootCauseAnalyses.length} Analyses
          </Badge>
        </div>
        <p className="text-sm text-neutral-400">
          Advanced failure analysis, manual intervention guidance, and AI problem-solving education
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-neutral-800 p-1 rounded-lg">
          {[
            { id: 'analysis', label: 'Root Cause Analysis', icon: AlertTriangle },
            { id: 'interventions', label: 'Manual Interventions', icon: HelpCircle },
            { id: 'education', label: 'Educational Content', icon: BookOpen }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === id
                  ? "bg-neutral-700 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700/50"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {/* Root Cause Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-4">
            {rootCauseAnalyses.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No error analyses available</p>
                <p className="text-xs">Analyses will appear when errors occur</p>
              </div>
            ) : (
              rootCauseAnalyses.map((analysis) => (
                <div key={analysis.id} className="bg-neutral-900 rounded-lg border border-neutral-700">
                  <div 
                    className="p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                    onClick={() => {
                      const newSet = new Set(expandedAnalyses);
                      if (newSet.has(analysis.id)) {
                        newSet.delete(analysis.id);
                      } else {
                        newSet.add(analysis.id);
                      }
                      setExpandedAnalyses(newSet);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedAnalyses.has(analysis.id) ? (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        )}
                        
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        
                        <div>
                          <div className="font-medium text-sm text-neutral-200">
                            {analysis.errorType.replace('_', ' ').toUpperCase()} Error Analysis
                          </div>
                          <div className="text-xs text-neutral-400">
                            {analysis.rootCause}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" size="sm" className="text-blue-300 border-blue-500/30">
                          {analysis.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {expandedAnalyses.has(analysis.id) && (
                    <div className="border-t border-neutral-700 p-4 space-y-4">
                      {/* Evidence */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          Evidence
                        </h4>
                        <ul className="space-y-1 text-sm text-neutral-300">
                          {analysis.evidence.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-green-400 mt-1">•</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Suggested Fixes */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2 flex items-center gap-2">
                          <Zap className="w-4 h-4 text-yellow-400" />
                          Suggested Fixes
                        </h4>
                        <ul className="space-y-1 text-sm text-neutral-300">
                          {analysis.suggestedFixes.map((fix, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Target className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
                              {fix}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Prevention Strategies */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2 flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-400" />
                          Prevention Strategies
                        </h4>
                        <ul className="space-y-1 text-sm text-neutral-300">
                          {analysis.preventionStrategies.map((strategy, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-400 mt-1">→</span>
                              {strategy}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Manual Interventions Tab */}
        {activeTab === 'interventions' && (
          <div className="space-y-4">
            {manualInterventions.length === 0 ? (
              <div className="text-center py-12 text-neutral-500">
                <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No manual interventions needed</p>
                <p className="text-xs">Guidance will appear when automatic recovery fails</p>
              </div>
            ) : (
              manualInterventions.map((intervention) => (
                <div key={intervention.id} className="bg-neutral-900 rounded-lg border border-neutral-700">
                  <div 
                    className={cn(
                      "p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors border-l-4",
                      getPriorityColor(intervention.priority)
                    )}
                    onClick={() => {
                      const newSet = new Set(expandedInterventions);
                      if (newSet.has(intervention.id)) {
                        newSet.delete(intervention.id);
                      } else {
                        newSet.add(intervention.id);
                      }
                      setExpandedInterventions(newSet);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedInterventions.has(intervention.id) ? (
                          <ChevronDown className="w-5 h-5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-neutral-400" />
                        )}
                        
                        <HelpCircle className="w-5 h-5 text-orange-400" />
                        
                        <div>
                          <div className="font-medium text-sm text-neutral-200">
                            {intervention.title}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {intervention.description}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" size="sm" className={getPriorityColor(intervention.priority)}>
                          {intervention.priority}
                        </Badge>
                        <Badge variant="outline" size="sm" className={getComplexityColor(intervention.complexity)}>
                          {intervention.complexity}
                        </Badge>
                        <span className="text-neutral-400">{intervention.estimatedTime}</span>
                      </div>
                    </div>
                  </div>

                  {expandedInterventions.has(intervention.id) && (
                    <div className="border-t border-neutral-700 p-4 space-y-4">
                      {/* Steps */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2">Steps</h4>
                        <ol className="space-y-2 text-sm text-neutral-300">
                          {intervention.steps.map((step, idx) => (
                            <li key={idx} className="flex gap-3">
                              <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                                {idx + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      {/* Risks */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-400" />
                          Risks
                        </h4>
                        <ul className="space-y-1 text-sm text-red-300">
                          {intervention.risks.map((risk, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-red-400 mt-1">⚠</span>
                              {risk}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Alternatives */}
                      <div>
                        <h4 className="text-sm font-medium text-neutral-200 mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-400" />
                          Alternatives
                        </h4>
                        <ul className="space-y-1 text-sm text-yellow-300">
                          {intervention.alternatives.map((alt, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-yellow-400 mt-1">💡</span>
                              {alt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Educational Content Tab */}
        {activeTab === 'education' && (
          <div className="space-y-4">
            {educationalContent.map((content) => (
              <div key={content.topic} className="bg-neutral-900 rounded-lg border border-neutral-700 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    <div>
                      <div className="font-medium text-sm text-neutral-200">
                        {content.title}
                      </div>
                      <div className="text-xs text-neutral-400">
                        {content.description}
                      </div>
                    </div>
                  </div>
                  
                  <Badge variant="outline" size="sm" className={getDifficultyColor(content.difficulty)}>
                    {content.difficulty}
                  </Badge>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium text-neutral-300 mb-1">Key Points</h4>
                    <ul className="space-y-1 text-sm text-neutral-400">
                      {content.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-green-400 mt-1 flex-shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-neutral-300 mb-1">Examples</h4>
                    <ul className="space-y-1 text-sm text-neutral-400">
                      {content.examples.map((example, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Lightbulb className="w-3 h-3 text-yellow-400 mt-1 flex-shrink-0" />
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-neutral-300 mb-1">Related Topics</h4>
                    <div className="flex flex-wrap gap-1">
                      {content.relatedTopics.map((topic, idx) => (
                        <Badge key={idx} variant="outline" size="sm" className="text-xs">
                          {topic.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}