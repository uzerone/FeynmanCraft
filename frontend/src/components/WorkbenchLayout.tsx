import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface WorkbenchLayoutProps {
  topBar: ReactNode;
  leftPanel: ReactNode;
  centerPanel: ReactNode;
  rightPanel: ReactNode;
  className?: string;
}

export interface JobState {
  status: 'idle' | 'planning' | 'generating' | 'validating' | 'prechecking' | 'compiling' | 'preview_ready' | 'failed';
  currentAgent: string;
  progress: number;
  startTime: number;
  estimatedCompletion: number;
  errorMessage?: string;
}

export interface WorkbenchState {
  layout: 'desktop' | 'tablet' | 'mobile';
  activeTab: 'preview' | 'tikz' | 'latex' | 'diff';
  rightPanel: 'agents' | 'logs' | 'versions' | 'recovery' | 'automation' | 'mcp';
  isRightPanelCollapsed: boolean;
  isLeftPanelCollapsed: boolean;
  jobState: JobState;
  realTimeUpdates: boolean;
}

export function WorkbenchLayout({
  topBar,
  leftPanel,
  centerPanel,
  rightPanel,
  className
}: WorkbenchLayoutProps) {
  // Use context state instead of local state
  const { state: workbenchState, setState } = useWorkbench();

  // Responsive layout detection
  React.useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      let newLayout: WorkbenchState['layout'] = 'desktop';
      
      if (width < 768) {
        newLayout = 'mobile';
      } else if (width < 1024) {
        newLayout = 'tablet';
      }
      
      setState(prev => ({ ...prev, layout: newLayout }));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setState]);

  // Mobile layout: vertical stack
  if (workbenchState.layout === 'mobile') {
    return (
      <div className={cn("flex flex-col h-screen bg-neutral-900", className)}>
        {/* Top Bar */}
        <div className="flex-shrink-0 border-b border-neutral-800">
          {topBar}
        </div>
        
        {/* Main Content - Vertical Stack */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Left Panel - Collapsible */}
          {!workbenchState.isLeftPanelCollapsed && (
            <div className="flex-shrink-0 border-b border-neutral-800 max-h-[40vh] overflow-y-auto">
              {leftPanel}
            </div>
          )}
          
          {/* Center Panel */}
          <div className="flex-1 overflow-hidden">
            {centerPanel}
          </div>
          
          {/* Right Panel - Drawer Style */}
          {!workbenchState.isRightPanelCollapsed && (
            <div className="flex-shrink-0 border-t border-neutral-800 max-h-[50vh] overflow-y-auto">
              {rightPanel}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop/Tablet layout: three-column
  return (
    <div className={cn("flex flex-col h-screen bg-neutral-900", className)}>
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-neutral-800">
        {topBar}
      </div>
      
      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1400px] mx-auto w-full">
        {/* Left Panel */}
        <div className={cn(
          "flex-shrink-0 border-r border-neutral-800 transition-all duration-300",
          workbenchState.isLeftPanelCollapsed ? "w-0 overflow-hidden" : "w-80 lg:w-96"
        )}>
          {leftPanel}
        </div>
        
        {/* Center Panel */}
        <div className="flex-1 overflow-hidden">
          {centerPanel}
        </div>
        
        {/* Right Panel */}
        <div className={cn(
          "flex-shrink-0 border-l border-neutral-800 transition-all duration-300",
          workbenchState.isRightPanelCollapsed ? "w-0 overflow-hidden" : "w-80 lg:w-96"
        )}>
          {rightPanel}
        </div>
      </div>
    </div>
  );
}

// Context for workbench state management
export const WorkbenchContext = React.createContext<{
  state: WorkbenchState;
  setState: React.Dispatch<React.SetStateAction<WorkbenchState>>;
  toggleRightPanel: () => void;
  toggleLeftPanel: () => void;
  updateJobState: (updates: Partial<JobState>) => void;
  resetJob: () => void;
} | null>(null);

export function useWorkbench() {
  const context = React.useContext(WorkbenchContext);
  if (!context) {
    throw new Error('useWorkbench must be used within WorkbenchProvider');
  }
  return context;
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkbenchState>({
    layout: 'desktop',
    activeTab: 'preview',
    rightPanel: 'agents',
    isRightPanelCollapsed: false,
    isLeftPanelCollapsed: false,
    jobState: {
      status: 'idle',
      currentAgent: '',
      progress: 0,
      startTime: 0,
      estimatedCompletion: 0
    },
    realTimeUpdates: true
  });

  const toggleRightPanel = () => {
    setState(prev => ({
      ...prev,
      isRightPanelCollapsed: !prev.isRightPanelCollapsed
    }));
  };

  const toggleLeftPanel = () => {
    setState(prev => ({
      ...prev,
      isLeftPanelCollapsed: !prev.isLeftPanelCollapsed
    }));
  };

  const updateJobState = (updates: Partial<JobState>) => {
    setState(prev => ({
      ...prev,
      jobState: { ...prev.jobState, ...updates }
    }));
  };

  const resetJob = () => {
    setState(prev => ({
      ...prev,
      jobState: {
        status: 'idle',
        currentAgent: '',
        progress: 0,
        startTime: 0,
        estimatedCompletion: 0
      }
    }));
  };

  return (
    <WorkbenchContext.Provider value={{ 
      state, 
      setState, 
      toggleRightPanel, 
      toggleLeftPanel,
      updateJobState,
      resetJob
    }}>
      {children}
    </WorkbenchContext.Provider>
  );
}