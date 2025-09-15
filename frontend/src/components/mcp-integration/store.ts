// MCP Integration Event Bus & State Management
// @ts-nocheck
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { WorkflowEvent } from './orchestration';

export interface MCPIntegrationState {
  // Events and Timeline
  events: WorkflowEvent[];
  isWorkflowRunning: boolean;
  currentWorkflow?: {
    name: string;
    particles: string[];
    startTime: number;
    expectedCalls: number;
  };
  
  // Real-time Statistics
  stats: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgResponseTime: number;
    activeParticles: string[];
    completedParticles: string[];
    failedParticles: string[];
  };
  
  // Tool Performance Metrics
  toolMetrics: Map<string, {
    calls: number;
    successes: number;
    totalLatency: number;
    lastUsed?: number;
    avgLatency: number;
    successRate: number;
  }>;
  
  // Circuit Breaker Status
  circuitBreakers: Map<string, {
    isOpen: boolean;
    failures: number;
    lastFailTime?: number;
    nextRetryTime?: number;
  }>;
  
  // Error Tracking
  recentErrors: Array<{
    timestamp: number;
    particle: string;
    step: string;
    error: any;
    severity: 'low' | 'medium' | 'high';
  }>;
  
  // UI State
  selectedParticle?: string;
  selectedStep?: string;
  showDetails: boolean;
  autoScroll: boolean;
}

export interface MCPIntegrationActions {
  // Event Management
  pushEvent: (event: WorkflowEvent) => void;
  clearEvents: () => void;
  
  // Workflow Control
  startWorkflow: (name: string, particles: string[], expectedCalls: number) => void;
  endWorkflow: () => void;
  
  // Statistics Updates
  updateToolMetrics: (toolName: string, success: boolean, latency: number) => void;
  updateCircuitBreaker: (toolName: string, isOpen: boolean, failures: number) => void;
  
  // Error Tracking
  addError: (error: {
    particle: string;
    step: string;
    error: any;
    severity: 'low' | 'medium' | 'high';
  }) => void;
  clearErrors: () => void;
  
  // UI Actions
  selectParticle: (particle?: string) => void;
  selectStep: (step?: string) => void;
  toggleDetails: () => void;
  toggleAutoScroll: () => void;
  
  // Utility
  reset: () => void;
  getWorkflowProgress: () => {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    progress: number;
  };
}

const initialState: MCPIntegrationState = {
  events: [],
  isWorkflowRunning: false,
  stats: {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    avgResponseTime: 0,
    activeParticles: [],
    completedParticles: [],
    failedParticles: []
  },
  toolMetrics: new Map(),
  circuitBreakers: new Map(),
  recentErrors: [],
  showDetails: false,
  autoScroll: true
};

export const useMCPIntegrationStore = create<MCPIntegrationState & MCPIntegrationActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    pushEvent: (event: WorkflowEvent) => {
      set(state => {
        const newEvents = [...state.events, event];
        const newStats = updateStatsFromEvent(state.stats, event);
        
        // Handle specific event types
        const updates: Partial<MCPIntegrationState> = {
          events: newEvents,
          stats: newStats
        };

        switch (event.type) {
          case 'workflow.start':
            updates.isWorkflowRunning = true;
            break;
          case 'workflow.end':
            updates.isWorkflowRunning = false;
            break;
          case 'step.error':
            // Add to recent errors
            const newError = {
              timestamp: event.timestamp,
              particle: event.particle,
              step: event.step,
              error: event.error,
              severity: determineSeverity(event.error)
            };
            updates.recentErrors = [...state.recentErrors.slice(-19), newError]; // Keep last 20 errors
            break;
        }

        return { ...state, ...updates };
      });
    },

    clearEvents: () => set(state => ({
      ...state,
      events: [],
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        avgResponseTime: 0,
        activeParticles: [],
        completedParticles: [],
        failedParticles: []
      },
      recentErrors: []
    })),

    startWorkflow: (name: string, particles: string[], expectedCalls: number) => {
      set(state => ({
        ...state,
        isWorkflowRunning: true,
        currentWorkflow: {
          name,
          particles,
          startTime: Date.now(),
          expectedCalls
        }
      }));
    },

    endWorkflow: () => {
      set(state => ({
        ...state,
        isWorkflowRunning: false,
        currentWorkflow: undefined
      }));
    },

    updateToolMetrics: (toolName: string, success: boolean, latency: number) => {
      set(state => {
        const newMetrics = new Map(state.toolMetrics);
        const current = newMetrics.get(toolName) || {
          calls: 0,
          successes: 0,
          totalLatency: 0,
          avgLatency: 0,
          successRate: 0
        };

        const updated = {
          calls: current.calls + 1,
          successes: current.successes + (success ? 1 : 0),
          totalLatency: current.totalLatency + latency,
          lastUsed: Date.now(),
          avgLatency: (current.totalLatency + latency) / (current.calls + 1),
          successRate: (current.successes + (success ? 1 : 0)) / (current.calls + 1)
        };

        newMetrics.set(toolName, updated);
        return { ...state, toolMetrics: newMetrics };
      });
    },

    updateCircuitBreaker: (toolName: string, isOpen: boolean, failures: number) => {
      set(state => {
        const newBreakers = new Map(state.circuitBreakers);
        const current = newBreakers.get(toolName) || {
          isOpen: false,
          failures: 0
        };

        newBreakers.set(toolName, {
          ...current,
          isOpen,
          failures,
          lastFailTime: isOpen ? Date.now() : current.lastFailTime,
          nextRetryTime: isOpen ? Date.now() + 60000 : undefined // 60s timeout
        });

        return { ...state, circuitBreakers: newBreakers };
      });
    },

    addError: (error) => {
      set(state => ({
        ...state,
        recentErrors: [...state.recentErrors.slice(-19), {
          ...error,
          timestamp: Date.now()
        }]
      }));
    },

    clearErrors: () => {
      set(state => ({ ...state, recentErrors: [] }));
    },

    selectParticle: (particle?: string) => {
      set(state => ({ ...state, selectedParticle: particle }));
    },

    selectStep: (step?: string) => {
      set(state => ({ ...state, selectedStep: step }));
    },

    toggleDetails: () => {
      set(state => ({ ...state, showDetails: !state.showDetails }));
    },

    toggleAutoScroll: () => {
      set(state => ({ ...state, autoScroll: !state.autoScroll }));
    },

    reset: () => {
      set(() => ({
        ...initialState,
        toolMetrics: new Map(),
        circuitBreakers: new Map()
      }));
    },

    getWorkflowProgress: () => {
      const { events } = get();
      const stepEvents = events.filter(e => 
        e.type === 'step.success' || e.type === 'step.error'
      );
      
      const completedSteps = events.filter(e => e.type === 'step.success').length;
      const failedSteps = events.filter(e => e.type === 'step.error').length;
      const totalSteps = stepEvents.length;
      
      return {
        totalSteps,
        completedSteps,
        failedSteps,
        progress: totalSteps > 0 ? (completedSteps + failedSteps) / totalSteps : 0
      };
    }
  }))
);

// Helper function to update statistics from events
function updateStatsFromEvent(
  currentStats: MCPIntegrationState['stats'],
  event: WorkflowEvent
): MCPIntegrationState['stats'] {
  const newStats = { ...currentStats };

  switch (event.type) {
    case 'particle.start':
      if (!newStats.activeParticles.includes(event.particle)) {
        newStats.activeParticles = [...newStats.activeParticles, event.particle];
      }
      break;

    case 'particle.end':
      newStats.activeParticles = newStats.activeParticles.filter(p => p !== event.particle);
      if (event.success) {
        if (!newStats.completedParticles.includes(event.particle)) {
          newStats.completedParticles = [...newStats.completedParticles, event.particle];
        }
      } else {
        if (!newStats.failedParticles.includes(event.particle)) {
          newStats.failedParticles = [...newStats.failedParticles, event.particle];
        }
      }
      break;

    case 'step.success':
      newStats.totalCalls++;
      newStats.successfulCalls++;
      // Update average response time
      const totalTime = (newStats.avgResponseTime * (newStats.totalCalls - 1)) + event.duration;
      newStats.avgResponseTime = totalTime / newStats.totalCalls;
      break;

    case 'step.error':
      newStats.totalCalls++;
      newStats.failedCalls++;
      // Update average response time (even for failed calls)
      const totalTimeError = (newStats.avgResponseTime * (newStats.totalCalls - 1)) + event.duration;
      newStats.avgResponseTime = totalTimeError / newStats.totalCalls;
      break;

    case 'workflow.end':
      // Clear active particles at workflow end
      newStats.activeParticles = [];
      break;
  }

  return newStats;
}

// Helper function to determine error severity
function determineSeverity(error: any): 'low' | 'medium' | 'high' {
  if (!error?.code) return 'medium';
  
  // Critical system errors
  if (error.code >= -32099 && error.code <= -32000) {
    return 'high';
  }
  
  // Domain-specific errors (particle not found, etc.)
  if (error.code === -32001) {
    return 'medium';
  }
  
  // Network/timeout errors
  if (!error.isRetryable) {
    return 'high';
  }
  
  return 'low';
}

// Selectors for computed values
export const useWorkflowProgress = () => 
  useMCPIntegrationStore(state => state.getWorkflowProgress());

export const useActiveWorkflow = () => 
  useMCPIntegrationStore(state => state.currentWorkflow);

export const useWorkflowStats = () => 
  useMCPIntegrationStore(state => state.stats);

export const useRecentEvents = (limit = 50) =>
  useMCPIntegrationStore(state => state.events.slice(-limit));

export const useToolMetrics = () =>
  useMCPIntegrationStore(state => state.toolMetrics);

export const useCircuitBreakers = () =>
  useMCPIntegrationStore(state => state.circuitBreakers);

export const useRecentErrors = (limit = 10) =>
  useMCPIntegrationStore(state => state.recentErrors.slice(-limit));

// Event subscription helpers
export const subscribeToWorkflowEvents = (callback: (event: WorkflowEvent) => void) => {
  return useMCPIntegrationStore.subscribe(
    (state) => state.events,
    (events, prevEvents) => {
      if (events.length > prevEvents.length) {
        callback(events[events.length - 1]);
      }
    }
  );
};