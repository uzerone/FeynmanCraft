import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Wand2, 
  Settings2, 
  ChevronDown, 
  ChevronUp,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RunParameters {
  compilationEngine: 'pdflatex' | 'lualatex';
  precisionLevel: 'standard' | 'conservative' | 'aggressive';
  physicsConstraints: {
    conservation: boolean;
    quantumNumbers: boolean;
    topology: boolean;
  };
  language: 'en' | 'zh';
}

export interface LeftPromptPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  parameters: RunParameters;
  onParametersChange: (parameters: RunParameters) => void;
  onRun: () => void;
  onTemplateSelect?: (template: string) => void;
  isRunning?: boolean;
  templates?: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    promptTemplate: string;
  }>;
  className?: string;
}

export function LeftPromptPanel({
  prompt,
  onPromptChange,
  parameters,
  onParametersChange,
  onRun,
  onTemplateSelect,
  isRunning = false,
  templates = [],
  className
}: LeftPromptPanelProps) {
  const [isParametersExpanded, setIsParametersExpanded] = useState(false);
  const [isTemplatesExpanded, setIsTemplatesExpanded] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
  };

  const togglePhysicsConstraint = (constraint: keyof RunParameters['physicsConstraints']) => {
    onParametersChange({
      ...parameters,
      physicsConstraints: {
        ...parameters.physicsConstraints,
        [constraint]: !parameters.physicsConstraints[constraint]
      }
    });
  };

  const handleTemplateSelect = (template: any) => {
    onPromptChange(template.promptTemplate);
    if (onTemplateSelect) {
      onTemplateSelect(template.id);
    }
    setIsTemplatesExpanded(false);
  };

  return (
    <div className={cn("flex flex-col h-full bg-neutral-900 p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">Input & Settings</h2>
        <Badge variant="outline" className="text-xs px-2 py-1 bg-blue-500/20 border-blue-500/30">
          Prompt
        </Badge>
      </div>

      {/* Main Prompt Input */}
      <Card className="flex-1 p-4 bg-neutral-800 border-neutral-700">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-neutral-200">
              Physics Process Description
            </label>
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {parameters.language === 'en' ? 'English' : '中文'}
            </Badge>
          </div>
          
          <Textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              parameters.language === 'en' 
                ? "Describe the physics process you want to visualize (e.g., 'electron-positron scattering with photon exchange')..."
                : "描述您想要可视化的物理过程（例如：'电子-正电子散射与光子交换'）..."
            }
            className="min-h-[120px] bg-neutral-900 border-neutral-600 text-neutral-100 placeholder:text-neutral-500 resize-none"
          />
          
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Press Ctrl/Cmd + Enter to run</span>
            <span>{prompt.length} characters</span>
          </div>
        </div>
      </Card>

      {/* Quick Templates */}
      <Card className="bg-neutral-800 border-neutral-700">
        <div className="p-3">
          <Button
            variant="ghost"
            onClick={() => setIsTemplatesExpanded(!isTemplatesExpanded)}
            className="w-full flex items-center justify-between p-2 text-neutral-200 hover:bg-neutral-700"
          >
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="text-sm font-medium">Quick Templates</span>
            </div>
            {isTemplatesExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {isTemplatesExpanded && (
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {templates.length > 0 ? (
                templates.map((template) => (
                  <Button
                    key={template.id}
                    variant="ghost"
                    onClick={() => handleTemplateSelect(template)}
                    className="w-full p-3 text-left bg-neutral-900 hover:bg-neutral-700 border border-neutral-600"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-neutral-200">
                          {template.name}
                        </span>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-2">
                        {template.description}
                      </p>
                    </div>
                  </Button>
                ))
              ) : (
                <div className="text-center py-4 text-neutral-500 text-sm">
                  No templates available
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Physics Constraints */}
      <Card className="bg-neutral-800 border-neutral-700">
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-neutral-200">Physics Constraints</span>
          </div>
          
          <div className="space-y-2">
            {Object.entries(parameters.physicsConstraints).map(([key, enabled]) => (
              <Button
                key={key}
                variant="ghost"
                onClick={() => togglePhysicsConstraint(key as keyof RunParameters['physicsConstraints'])}
                className={cn(
                  "w-full flex items-center justify-between p-2 text-sm",
                  enabled 
                    ? "bg-blue-500/20 border border-blue-500/30 text-blue-200" 
                    : "bg-neutral-900 border border-neutral-600 text-neutral-400"
                )}
              >
                <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 transition-colors",
                  enabled 
                    ? "bg-blue-500 border-blue-500" 
                    : "border-neutral-500"
                )} />
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Run Parameters */}
      <Card className="bg-neutral-800 border-neutral-700">
        <div className="p-3">
          <Button
            variant="ghost"
            onClick={() => setIsParametersExpanded(!isParametersExpanded)}
            className="w-full flex items-center justify-between p-2 text-neutral-200 hover:bg-neutral-700"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="text-sm font-medium">Advanced Settings</span>
            </div>
            {isParametersExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          
          {isParametersExpanded && (
            <div className="mt-3 space-y-3">
              {/* Compilation Engine */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300">
                  Compilation Engine
                </label>
                <Select
                  value={parameters.compilationEngine}
                  onValueChange={(value: 'pdflatex' | 'lualatex') =>
                    onParametersChange({ ...parameters, compilationEngine: value })
                  }
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-600 text-neutral-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdflatex">pdfLaTeX (Standard)</SelectItem>
                    <SelectItem value="lualatex">LuaLaTeX (Advanced)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Precision Level */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300">
                  Auto-fix Precision
                </label>
                <Select
                  value={parameters.precisionLevel}
                  onValueChange={(value: 'standard' | 'conservative' | 'aggressive') =>
                    onParametersChange({ ...parameters, precisionLevel: value })
                  }
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-600 text-neutral-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Run Button */}
      <Button
        onClick={onRun}
        disabled={isRunning || !prompt.trim()}
        className={cn(
          "w-full flex items-center justify-center gap-2 py-3 text-base font-medium",
          isRunning 
            ? "bg-neutral-700 text-neutral-400" 
            : "bg-blue-600 hover:bg-blue-700 text-white"
        )}
      >
        {isRunning ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-neutral-400 border-t-transparent rounded-full" />
            Generating...
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Generate Diagram
          </>
        )}
      </Button>

      {/* Help Text */}
      <div className="text-xs text-neutral-500 text-center space-y-1">
        <p>Describe physics processes in natural language</p>
        <p>AI agents will collaborate to create TikZ diagrams</p>
      </div>
    </div>
  );
}