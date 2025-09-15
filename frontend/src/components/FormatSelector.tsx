import React from 'react';
import { Button } from './ui/button';
import { FileText, FileImage, Download, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormatSelectorProps {
  availableFormats: string[];
  selectedFormat: string;
  onFormatChange: (format: string) => void;
  fileUrls?: Record<string, string>;
  fileId?: string;
  className?: string;
}

const FormatSelector: React.FC<FormatSelectorProps> = ({
  availableFormats,
  selectedFormat,
  onFormatChange,
  fileUrls = {},
  fileId,
  className = ""
}) => {
  const formatConfig = {
    pdf: {
      icon: FileText,
      label: 'PDF',
      description: 'Vector format, best for printing',
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
    },
    svg: {
      icon: FileImage,
      label: 'SVG',
      description: 'Scalable vector graphics, web-friendly',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
    },
    png: {
      icon: FileImage,
      label: 'PNG',
      description: 'Raster format, universal compatibility',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
    }
  };

  const downloadFile = async (format: string) => {
    const url = fileUrls[`${format}_url`] || fileUrls[format];
    if (!url || !fileId) return;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${fileId}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  if (availableFormats.length === 0) {
    return null;
  }

  return (
    <div className={`format-selector ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-neutral-500" />
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          Format Options
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {availableFormats.map((format) => {
          const config = formatConfig[format as keyof typeof formatConfig];
          if (!config) return null;
          
          const IconComponent = config.icon;
          const isSelected = selectedFormat === format;
          const hasUrl = !!(fileUrls[`${format}_url`] || fileUrls[format]);
          
          return (
            <div
              key={format}
              className={cn(
                "relative p-3 border rounded-lg transition-all cursor-pointer",
                isSelected 
                  ? `${config.bgColor} border-2` 
                  : "bg-neutral-50 dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800",
                !hasUrl && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => hasUrl && onFormatChange(format)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <IconComponent className={cn("w-5 h-5", config.color)} />
                  <div>
                    <div className="font-medium text-sm">
                      {config.label}
                      {isSelected && (
                        <span className="ml-1 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {config.description}
                    </div>
                  </div>
                </div>
                
                {hasUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadFile(format);
                    }}
                    title={`Download ${format.toUpperCase()}`}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                )}
              </div>
              
              {!hasUrl && (
                <div className="text-xs text-neutral-400 mt-2">
                  Not available
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Quick Actions */}
      {availableFormats.length > 1 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            Quick switch:
          </span>
          {availableFormats.map((format) => {
            const config = formatConfig[format as keyof typeof formatConfig];
            if (!config) return null;
            
            const hasUrl = !!(fileUrls[`${format}_url`] || fileUrls[format]);
            
            return (
              <Button
                key={format}
                variant={selectedFormat === format ? "default" : "outline"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => hasUrl && onFormatChange(format)}
                disabled={!hasUrl}
              >
                {config.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FormatSelector;