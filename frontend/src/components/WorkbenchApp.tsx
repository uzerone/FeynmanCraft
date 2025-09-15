import React, { useState, useCallback, useEffect } from 'react';
import { WorkbenchLayout, WorkbenchProvider, useWorkbench } from './WorkbenchLayout';
import { TopAppBar } from './TopAppBar';
import { LeftPromptPanel, RunParameters } from './LeftPromptPanel';
import { CenterTabsPanel } from './CenterTabsPanel';
import { RightInfoPanel } from './RightInfoPanel';
import { useADKFinal } from '@/hooks/useADKFinal';
import { extractFileUrls } from './ChatMessagesView';

// Default run parameters
const defaultParameters: RunParameters = {
  compilationEngine: 'pdflatex',
  precisionLevel: 'standard',
  physicsConstraints: {
    conservation: true,
    quantumNumbers: true,
    topology: false
  },
  language: 'en'
};

// Sample templates for demonstration
const sampleTemplates = [
  {
    id: 'electron-positron-scattering',
    name: 'Electron-Positron Scattering',
    category: 'Scattering',
    description: 'Basic QED scattering process with photon exchange',
    promptTemplate: 'Draw an electron-positron scattering diagram with photon exchange in the s-channel'
  },
  {
    id: 'muon-decay',
    name: 'Muon Decay',
    category: 'Decay',
    description: 'Weak interaction muon decay to electron and neutrinos',
    promptTemplate: 'Show muon decay: μ⁻ → e⁻ + ν̄ₑ + νμ with W boson exchange'
  },
  {
    id: 'electron-self-energy',
    name: 'Electron Self-Energy',
    category: 'Loop',
    description: 'One-loop electron self-energy correction',
    promptTemplate: 'Draw the one-loop electron self-energy diagram with virtual photon'
  },
  {
    id: 'compton-scattering',
    name: 'Compton Scattering',
    category: 'Scattering',
    description: 'Photon-electron scattering process',
    promptTemplate: 'Create a Compton scattering diagram: γ + e⁻ → γ + e⁻'
  }
];

// Internal component that uses WorkbenchContext
function WorkbenchAppContent() {
  // Core state
  const [prompt, setPrompt] = useState('');
  const [parameters, setParameters] = useState<RunParameters>(defaultParameters);
  
  // Workbench context integration
  const { state: workbenchState, setState: setWorkbenchState, updateJobState, resetJob } = useWorkbench();

  // ADK integration
  const {
    messages,
    processedEvents,
    isLoading,
    error,
    connectionStatus,
    sendMessage,
    stop
  } = useADKFinal();

  // WebSocket integration for real-time updates
  useEffect(() => {
    if (isLoading && workbenchState.jobState.status === 'idle') {
      // Job just started
      updateJobState({
        status: 'planning',
        currentAgent: 'planner_agent',
        progress: 0,
        startTime: Date.now(),
        estimatedCompletion: Date.now() + 30000 // 30 seconds estimate
      });
    } else if (!isLoading && workbenchState.jobState.status !== 'idle') {
      // Job completed
      if (error) {
        updateJobState({
          status: 'failed',
          progress: 100,
          errorMessage: error
        });
      } else if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        updateJobState({
          status: 'preview_ready',
          progress: 100
        });
      }
    }
  }, [isLoading, error, messages, workbenchState.jobState.status, updateJobState]);

  // Update job state based on processed events
  useEffect(() => {
    if (processedEvents.length > 0) {
      const latestEvent = processedEvents[processedEvents.length - 1];
      const progressPercent = (processedEvents.length / 6) * 100; // Assuming 6 agents
      
      updateJobState({
        currentAgent: latestEvent.author,
        progress: Math.min(progressPercent, 90) // Keep 10% for final compilation
      });

      // Map agent names to job states
      const agentToStateMap: Record<string, string> = {
        'planner_agent': 'planning',
        'kb_retriever_agent': 'generating',
        'physics_validator_agent': 'validating',
        'diagram_generator_agent': 'generating',
        'tikz_validator_agent': 'prechecking',
        'feedback_agent': 'compiling'
      };

      const jobState = agentToStateMap[latestEvent.author] || 'generating';
      if (jobState !== workbenchState.jobState.status) {
        updateJobState({
          status: jobState as any
        });
      }
    }
  }, [processedEvents, updateJobState, workbenchState.jobState.status]);

  // Generated content state
  const [generatedContent, setGeneratedContent] = useState({
    pdfUrl: undefined as string | undefined,
    svgUrl: undefined as string | undefined,
    pngUrl: undefined as string | undefined,
    previewFormat: 'pdf' as 'pdf' | 'svg' | 'png',
    tikzCode: '',
    latexCode: '',
    previewStatus: 'empty' as 'loading' | 'ready' | 'error' | 'empty'
  });

  // Handlers
  const handleRun = useCallback(() => {
    if (!prompt.trim()) return;
    
    resetJob(); // Reset job state
    setGeneratedContent(prev => ({ ...prev, previewStatus: 'loading' }));
    sendMessage(prompt);
  }, [prompt, sendMessage, resetJob]);

  const handleStop = useCallback(() => {
    stop();
    updateJobState({
      status: 'failed',
      progress: 100,
      errorMessage: 'Job stopped by user'
    });
    setGeneratedContent(prev => ({ ...prev, previewStatus: 'error' }));
  }, [stop, updateJobState]);

  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    console.log('Export requested');
  }, []);

  const handleLanguageToggle = useCallback(() => {
    setParameters(prev => ({
      ...prev,
      language: prev.language === 'en' ? 'zh' : 'en'
    }));
    setWorkbenchState(prev => ({
      ...prev,
      activeTab: prev.activeTab // Trigger re-render with language change
    }));
  }, [setWorkbenchState]);

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = sampleTemplates.find(t => t.id === templateId);
    if (template) {
      setPrompt(template.promptTemplate);
    }
  }, []);

  // Convert processed events to format expected by RightInfoPanel
  const agentEvents = processedEvents.map(event => ({
    id: `${event.author}-${event.timestamp}`,
    title: event.title,
    status: isLoading && processedEvents.indexOf(event) === processedEvents.length - 1 ? 'processing' as const : 'completed' as const,
    progress: isLoading && processedEvents.indexOf(event) === processedEvents.length - 1 ? 75 : 100,
    timestamp: event.timestamp,
    data: event.data,
    details: event.details
  }));

  // Generate sample logs from messages and errors
  const logs = [
    ...(error ? [{
      id: `error-${Date.now()}`,
      level: 'error' as const,
      message: error,
      timestamp: Date.now(),
      source: 'System'
    }] : []),
    ...messages.slice(-5).map((msg, index) => ({
      id: `msg-${msg.id}-${index}`,
      level: 'info' as const,
      message: msg.role === 'user' ? `User: ${msg.content.substring(0, 100)}...` : `Assistant: Response generated`,
      timestamp: msg.timestamp,
      source: msg.role === 'user' ? 'User' : 'Assistant'
    }))
  ];

  // Generate sample versions
  const versions = messages.filter(msg => msg.role === 'assistant').map((msg, index) => ({
    id: `v${index + 1}`,
    timestamp: msg.timestamp,
    triggerSource: 'user_input',
    summary: `Generated diagram from user prompt`,
    starred: false
  }));

  // Update preview status and extract diagram URLs from messages
  React.useEffect(() => {
    if (isLoading) {
      setGeneratedContent(prev => ({ ...prev, previewStatus: 'loading' }));
    } else if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
      const lastMessage = messages[messages.length - 1];
      const { fileUrls, hasDiagram } = extractFileUrls(lastMessage.content);
      
      // Extract TikZ code from message
      const tikzMatch = lastMessage.content.match(/```(?:tikz|latex)?\n([\s\S]*?)```/);
      const tikzCode = tikzMatch ? tikzMatch[1] : '';
      
      // Extract full LaTeX document
      const latexMatch = lastMessage.content.match(/\\documentclass[\s\S]*?\\end\{document\}/);
      const latexCode = latexMatch ? latexMatch[0] : '';
      
      setGeneratedContent(prev => ({
        ...prev,
        previewStatus: hasDiagram ? 'ready' : prev.previewStatus,
        pdfUrl: fileUrls.pdf_url || prev.pdfUrl,
        svgUrl: fileUrls.svg_url || prev.svgUrl,
        pngUrl: fileUrls.png_url || prev.pngUrl,
        tikzCode: tikzCode || prev.tikzCode,
        latexCode: latexCode || prev.latexCode,
        // Set format based on available URLs
        previewFormat: fileUrls.svg_url ? 'svg' : fileUrls.png_url ? 'png' : 'pdf'
      }));
    } else if (error) {
      setGeneratedContent(prev => ({ ...prev, previewStatus: 'error' }));
    }
  }, [isLoading, messages, error]);

  return (
    <WorkbenchLayout
        topBar={
          <TopAppBar
            projectName="FeynmanCraft Workbench"
            isRunning={isLoading}
            onRun={handleRun}
            onStop={handleStop}
            onExport={handleExport}
            language={parameters.language}
            onLanguageToggle={handleLanguageToggle}
            connectionStatus={connectionStatus}
          />
        }
        leftPanel={
          <LeftPromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            parameters={parameters}
            onParametersChange={setParameters}
            onRun={handleRun}
            onTemplateSelect={handleTemplateSelect}
            isRunning={isLoading}
            templates={sampleTemplates}
          />
        }
        centerPanel={
          <CenterTabsPanel
            activeTab={workbenchState.activeTab}
            onTabChange={(tab) => setWorkbenchState(prev => ({ ...prev, activeTab: tab }))}
            pdfUrl={generatedContent.pdfUrl}
            svgUrl={generatedContent.svgUrl}
            pngUrl={generatedContent.pngUrl}
            previewFormat={generatedContent.previewFormat}
            previewStatus={generatedContent.previewStatus}
            tikzCode={generatedContent.tikzCode}
            latexCode={generatedContent.latexCode}
          />
        }
        rightPanel={
          <RightInfoPanel
            activeTab={workbenchState.rightPanel}
            onTabChange={(tab) => setWorkbenchState(prev => ({ ...prev, rightPanel: tab }))}
            agentEvents={agentEvents}
            processedEvents={processedEvents}
            isLoading={isLoading}
            error={error}
            messages={messages}
            logs={logs}
            versions={versions}
          />
        }
        className="h-screen"
      />
  );
}

// Main export component with WorkbenchProvider wrapper
export function WorkbenchApp() {
  return (
    <WorkbenchProvider>
      <WorkbenchAppContent />
    </WorkbenchProvider>
  );
}