import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  Code, 
  FileText, 
  GitCompare,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CenterTabsPanelProps {
  activeTab: 'preview' | 'tikz' | 'latex' | 'diff';
  onTabChange: (tab: 'preview' | 'tikz' | 'latex' | 'diff') => void;
  
  // Preview data - support all formats
  pdfUrl?: string;
  svgUrl?: string;
  pngUrl?: string;
  previewFormat?: 'pdf' | 'svg' | 'png';  // Which format to display
  previewStatus: 'loading' | 'ready' | 'error' | 'empty';
  
  // Code data
  tikzCode?: string;
  latexCode?: string;
  
  // Diff data
  diffData?: {
    oldVersion: string;
    newVersion: string;
    changes: Array<{
      type: 'added' | 'removed' | 'unchanged';
      content: string;
      lineNumber: number;
    }>;
  };
  
  className?: string;
}

export function CenterTabsPanel({
  activeTab,
  onTabChange,
  pdfUrl,
  svgUrl,
  pngUrl,
  previewFormat: initialPreviewFormat,
  previewStatus,
  tikzCode = '',
  latexCode = '',
  diffData,
  className
}: CenterTabsPanelProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(1); // Will be dynamic with PDF.js
  const [currentFormat, setCurrentFormat] = useState<'pdf' | 'svg' | 'png'>(initialPreviewFormat || 'pdf');

  // Determine available formats based on provided URLs
  const availableFormats = [
    pdfUrl && 'pdf',
    svgUrl && 'svg', 
    pngUrl && 'png'
  ].filter(Boolean) as ('pdf' | 'svg' | 'png')[];

  // Use the first available format if current format is not available
  React.useEffect(() => {
    if (!availableFormats.includes(currentFormat) && availableFormats.length > 0) {
      setCurrentFormat(availableFormats[0]);
    }
  }, [pdfUrl, svgUrl, pngUrl]);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 25));
  const handleZoomReset = () => setZoomLevel(100);

  return (
    <div className={cn("flex flex-col h-full bg-neutral-900", className)}>
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as 'preview' | 'tikz' | 'latex' | 'diff')} className="flex flex-col h-full">
        {/* Tab Headers */}
        <div className="flex-shrink-0 border-b border-neutral-800 px-4 py-2">
          <TabsList className="grid w-full grid-cols-4 bg-neutral-800">
            <TabsTrigger 
              value="preview" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="tikz" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">TikZ</span>
            </TabsTrigger>
            <TabsTrigger 
              value="latex" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">LaTeX</span>
            </TabsTrigger>
            <TabsTrigger 
              value="diff" 
              className="flex items-center gap-2 data-[state=active]:bg-neutral-700"
            >
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Diff</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {/* Preview Tab */}
          <TabsContent value="preview" className="h-full m-0 p-0">
            <div className="flex flex-col h-full">
              {/* Preview Controls */}
              {previewStatus === 'ready' && (
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
                  <div className="flex items-center gap-2">
                    {/* Format Selector */}
                    {availableFormats.length > 1 && (
                      <div className="flex items-center gap-1 mr-2 p-1 bg-neutral-700 rounded">
                        {availableFormats.map(format => (
                          <Button
                            key={format}
                            variant={currentFormat === format ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentFormat(format)}
                            className="h-6 px-2 text-xs"
                          >
                            {format.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleZoomOut}
                      disabled={zoomLevel <= 25}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    
                    <Badge variant="outline" className="px-2 py-1 text-xs">
                      {zoomLevel}%
                    </Badge>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={zoomLevel >= 300}
                      className="h-8 w-8 p-0"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleZoomReset}
                      className="h-8 px-2 text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Page Navigation */}
                    {totalPages > 1 && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage <= 1}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <Badge variant="outline" className="px-2 py-1 text-xs">
                          {currentPage} / {totalPages}
                        </Badge>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage >= totalPages}
                          className="h-8 w-8 p-0"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )}

                    {/* Export Options */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Preview Content */}
              <div className="flex-1 overflow-auto bg-neutral-900">
                {previewStatus === 'loading' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400 mx-auto" />
                      <div className="space-y-2">
                        <p className="text-neutral-300">Compiling LaTeX...</p>
                        <p className="text-sm text-neutral-500">This may take a few seconds</p>
                      </div>
                    </div>
                  </div>
                )}

                {previewStatus === 'ready' && (
                  <div className="p-4 flex justify-center">
                    <div 
                      className="bg-white shadow-lg"
                      style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
                    >
                      {/* Render based on format */}
                      {currentFormat === 'pdf' && pdfUrl && (
                        <iframe
                          src={pdfUrl}
                          className="w-[595px] h-[842px] border-0"
                          title="PDF Preview"
                        />
                      )}
                      
                      {currentFormat === 'svg' && svgUrl && (
                        <div className="w-[595px] h-[842px] flex items-center justify-center p-8">
                          {svgUrl.startsWith('data:') ? (
                            // Handle data URL for SVG
                            <img
                              src={svgUrl}
                              alt="Feynman Diagram"
                              className="max-w-full max-h-full object-contain"
                            />
                          ) : (
                            // Handle regular URL for SVG
                            <object
                              data={svgUrl}
                              type="image/svg+xml"
                              className="max-w-full max-h-full"
                              title="SVG Preview"
                            >
                              <img src={svgUrl} alt="Feynman Diagram" />
                            </object>
                          )}
                        </div>
                      )}
                      
                      {currentFormat === 'png' && pngUrl && (
                        <div className="w-[595px] h-[842px] flex items-center justify-center p-8">
                          <img
                            src={pngUrl}
                            alt="Feynman Diagram"
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                      )}
                      
                      {/* Show error if no URL for selected format */}
                      {!((currentFormat === 'pdf' && pdfUrl) || 
                         (currentFormat === 'svg' && svgUrl) || 
                         (currentFormat === 'png' && pngUrl)) && (
                        <div className="w-[595px] h-[842px] flex items-center justify-center">
                          <p className="text-neutral-500">
                            No {currentFormat.toUpperCase()} preview available
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {previewStatus === 'error' && (
                  <div className="flex items-center justify-center h-full">
                    <Card className="p-6 bg-red-500/10 border-red-500/30 max-w-md">
                      <div className="text-center space-y-3">
                        <div className="text-red-400 text-lg">⚠️</div>
                        <h3 className="text-red-300 font-medium">Preview Error</h3>
                        <p className="text-sm text-neutral-400">
                          Unable to generate preview. Check the logs for details.
                        </p>
                      </div>
                    </Card>
                  </div>
                )}

                {previewStatus === 'empty' && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-4 text-neutral-500">
                      <Eye className="h-12 w-12 mx-auto opacity-50" />
                      <div className="space-y-2">
                        <p className="text-lg">No Preview Available</p>
                        <p className="text-sm">Run a generation to see the preview</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TikZ Code Tab */}
          <TabsContent value="tikz" className="h-full m-0 p-0">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-4 py-2 bg-neutral-800 border-b border-neutral-700">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    TikZ-Feynman Code
                  </Badge>
                  {tikzCode && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Download className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {tikzCode ? (
                  <pre className="p-4 text-sm text-neutral-300 font-mono bg-neutral-900 whitespace-pre-wrap">
                    {tikzCode}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-500">
                    <div className="text-center space-y-2">
                      <Code className="h-8 w-8 mx-auto opacity-50" />
                      <p>No TikZ code generated yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* LaTeX Code Tab */}
          <TabsContent value="latex" className="h-full m-0 p-0">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-4 py-2 bg-neutral-800 border-b border-neutral-700">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs px-2 py-1">
                    Complete LaTeX Document
                  </Badge>
                  {latexCode && (
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                      <Download className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {latexCode ? (
                  <pre className="p-4 text-sm text-neutral-300 font-mono bg-neutral-900 whitespace-pre-wrap">
                    {latexCode}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-500">
                    <div className="text-center space-y-2">
                      <FileText className="h-8 w-8 mx-auto opacity-50" />
                      <p>No LaTeX code generated yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Diff Tab */}
          <TabsContent value="diff" className="h-full m-0 p-0">
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 px-4 py-2 bg-neutral-800 border-b border-neutral-700">
                <Badge variant="outline" className="text-xs px-2 py-1">
                  Version Comparison
                </Badge>
              </div>
              
              <div className="flex-1 overflow-auto">
                {diffData ? (
                  <div className="p-4 space-y-2 font-mono text-sm">
                    {diffData.changes.map((change, index) => (
                      <div
                        key={index}
                        className={cn(
                          "px-2 py-1 rounded",
                          change.type === 'added' && "bg-green-500/20 text-green-300",
                          change.type === 'removed' && "bg-red-500/20 text-red-300",
                          change.type === 'unchanged' && "text-neutral-400"
                        )}
                      >
                        <span className="text-neutral-500 mr-4 text-xs">
                          {change.lineNumber}
                        </span>
                        <span className="mr-2">
                          {change.type === 'added' && '+'}
                          {change.type === 'removed' && '-'}
                          {change.type === 'unchanged' && ' '}
                        </span>
                        {change.content}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-500">
                    <div className="text-center space-y-2">
                      <GitCompare className="h-8 w-8 mx-auto opacity-50" />
                      <p>No version comparison available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}