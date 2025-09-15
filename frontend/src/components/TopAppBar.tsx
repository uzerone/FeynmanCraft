
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Square, 
  Download, 
  Globe, 
  User, 
  Settings,
  PanelLeftClose,
  PanelRightClose,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TopAppBarProps {
  projectName?: string;
  isRunning?: boolean;
  onRun?: () => void;
  onStop?: () => void;
  onExport?: () => void;
  language?: 'en' | 'zh';
  onLanguageToggle?: () => void;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  isLeftPanelCollapsed?: boolean;
  isRightPanelCollapsed?: boolean;
  connectionStatus?: {
    isConnected: boolean;
    lastChecked: number;
  };
  className?: string;
}

export function TopAppBar({
  projectName = "FeynmanCraft Workbench",
  isRunning = false,
  onRun,
  onStop,
  onExport,
  language = 'en',
  onLanguageToggle,
  onToggleLeftPanel,
  onToggleRightPanel,
  isLeftPanelCollapsed = false,
  isRightPanelCollapsed = false,
  connectionStatus,
  className
}: TopAppBarProps) {
  
  const handleRunClick = () => {
    if (isRunning && onStop) {
      onStop();
    } else if (!isRunning && onRun) {
      onRun();
    }
  };

  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-3 bg-neutral-800 border-b border-neutral-700",
      className
    )}>
      {/* Left Section - Project Info & Controls */}
      <div className="flex items-center gap-4">
        {/* Panel Toggle Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleLeftPanel}
            className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200"
            title={isLeftPanelCollapsed ? "Show left panel" : "Hide left panel"}
          >
            <PanelLeftClose className={cn(
              "h-4 w-4 transition-transform",
              isLeftPanelCollapsed && "rotate-180"
            )} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRightPanel}
            className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200"
            title={isRightPanelCollapsed ? "Show right panel" : "Hide right panel"}
          >
            <PanelRightClose className={cn(
              "h-4 w-4 transition-transform",
              isRightPanelCollapsed && "rotate-180"
            )} />
          </Button>
        </div>

        {/* Project Name */}
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-neutral-100">
            {projectName}
          </h1>
          
          {/* Connection Status */}
          {connectionStatus && (
            <Badge 
              variant={connectionStatus.isConnected ? "default" : "destructive"}
              className={cn(
                "text-xs px-2 py-0.5",
                connectionStatus.isConnected 
                  ? "bg-green-500/20 border-green-500/30 text-green-400" 
                  : "bg-red-500/20 border-red-500/30 text-red-400"
              )}
            >
              {connectionStatus.isConnected ? "Connected" : "Disconnected"}
            </Badge>
          )}
        </div>
      </div>

      {/* Center Section - Main Actions */}
      <div className="flex items-center gap-3">
        {/* Run/Stop Button */}
        <Button
          onClick={handleRunClick}
          disabled={!onRun && !onStop}
          className={cn(
            "flex items-center gap-2 px-4 py-2",
            isRunning 
              ? "bg-red-600 hover:bg-red-700 text-white" 
              : "bg-blue-600 hover:bg-blue-700 text-white"
          )}
        >
          {isRunning ? (
            <>
              <Square className="h-4 w-4" />
              Stop
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run
            </>
          )}
        </Button>

        {/* Export Button */}
        <Button
          variant="outline"
          onClick={onExport}
          disabled={!onExport}
          className="flex items-center gap-2 px-4 py-2 border-neutral-600 text-neutral-200 hover:bg-neutral-700"
        >
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Right Section - Settings & User */}
      <div className="flex items-center gap-3">
        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onLanguageToggle}
          className="flex items-center gap-2 px-3 py-2 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-700"
        >
          <Globe className="h-4 w-4" />
          <span className="text-sm font-medium">
            {language === 'en' ? 'EN' : '中'}
          </span>
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200"
        >
          <Settings className="h-4 w-4" />
        </Button>

        {/* User Menu */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-200"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Loading indicator for when operations are in progress
export function TopAppBarLoadingIndicator({ 
  isVisible, 
  message = "Processing..." 
}: { 
  isVisible: boolean; 
  message?: string; 
}) {
  if (!isVisible) return null;

  return (
    <div className="absolute top-full left-0 right-0 bg-blue-600/90 backdrop-blur-sm border-b border-blue-500/30 px-6 py-2 z-50">
      <div className="flex items-center gap-3 max-w-[1400px] mx-auto">
        <Loader2 className="h-4 w-4 animate-spin text-blue-200" />
        <span className="text-sm text-blue-100">{message}</span>
      </div>
    </div>
  );
}