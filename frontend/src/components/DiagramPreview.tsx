import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Download, Eye, FileImage, FileText, Info } from 'lucide-react';
import PDFViewer from './PDFViewer';
import SVGViewer from './SVGViewer';
import FormatSelector from './FormatSelector';

interface DiagramPreviewProps {
  fileId?: string;
  fileUrls?: {
    pdf?: string;
    svg?: string;
    png?: string;
    pdf_url?: string;
    svg_url?: string;
    png_url?: string;
    info_url?: string;
  };
  compilationStatus?: string;
  className?: string;
}

interface FileInfo {
  file_id: string;
  created_at: number;
  available_formats: string[];
  file_sizes: Record<string, number>;
}

const DiagramPreview: React.FC<DiagramPreviewProps> = ({
  fileId,
  fileUrls,
  compilationStatus = "unknown",
  className = ""
}) => {
  // Debug logging
  console.log('[DiagramPreview] Received props:', {
    fileId,
    fileUrls,
    compilationStatus,
    className
  });
  const [selectedFormat, setSelectedFormat] = useState<string>('pdf');
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageLoadStates, setImageLoadStates] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});

  // Load file info when fileId changes
  useEffect(() => {
    if (fileId && fileUrls?.info_url) {
      loadFileInfo();
    }
  }, [fileId, fileUrls?.info_url]);

  // Preload images for faster switching
  useEffect(() => {
    if (fileUrls && fileInfo?.available_formats) {
      fileInfo.available_formats.forEach(format => {
        const url = getPreviewUrlForFormat(format);
        if (url && (format === 'svg' || format === 'png')) {
          preloadImage(url, format);
        }
      });
    }
  }, [fileUrls, fileInfo]);

  const loadFileInfo = async () => {
    if (!fileUrls?.info_url) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let info;
      
      // Handle data: URLs (direct JSON data)
      if (fileUrls.info_url.startsWith('data:')) {
        const dataUrlParts = fileUrls.info_url.split(',');
        if (dataUrlParts.length !== 2) {
          throw new Error('Invalid data URL format');
        }
        const jsonString = decodeURIComponent(dataUrlParts[1]);
        info = JSON.parse(jsonString);
      } else {
        // Handle HTTP URLs
        const response = await fetch(fileUrls.info_url);
        if (!response.ok) {
          throw new Error(`Failed to load file info: ${response.status}`);
        }
        info = await response.json();
      }
      
      setFileInfo(info);
      
      // Set default format based on available formats
      if (info.available_formats?.length > 0 && !info.available_formats.includes(selectedFormat)) {
        setSelectedFormat(info.available_formats[0]);
      }
    } catch (err) {
      console.error('Error loading file info:', err);
      setError(err instanceof Error ? err.message : 'Failed to load file info');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getPreviewUrlForFormat = (format: string): string | null => {
    if (!fileUrls) return null;
    
    switch (format) {
      case 'pdf':
        return fileUrls.pdf || fileUrls.pdf_url || null;
      case 'svg':
        return fileUrls.svg || fileUrls.svg_url || null;
      case 'png':
        return fileUrls.png || fileUrls.png_url || null;
      default:
        return null;
    }
  };

  const preloadImage = (url: string, format: string) => {
    if (imageLoadStates[format] === 'loaded' || imageLoadStates[format] === 'loading') {
      return; // Already loaded or loading
    }

    setImageLoadStates(prev => ({ ...prev, [format]: 'loading' }));

    const img = new Image();
    img.onload = () => {
      setImageLoadStates(prev => ({ ...prev, [format]: 'loaded' }));
    };
    img.onerror = () => {
      setImageLoadStates(prev => ({ ...prev, [format]: 'error' }));
    };
    img.src = url;
  };

  const getPreviewUrl = (): string | null => {
    if (!fileUrls) return null;
    
    if (selectedFormat === 'pdf') {
      return fileUrls.pdf || fileUrls.pdf_url || null;
    }
    if (selectedFormat === 'svg') {
      return fileUrls.svg || fileUrls.svg_url || null;
    }
    if (selectedFormat === 'png') {
      return fileUrls.png || fileUrls.png_url || null;
    }
    return null;
  };

  const downloadFile = async (format: string) => {
    let url: string | undefined;
    
    switch (format) {
      case 'pdf':
        url = fileUrls?.pdf_url || fileUrls?.pdf;
        break;
      case 'svg':
        url = fileUrls?.svg_url || fileUrls?.svg;
        break;
      case 'png':
        url = fileUrls?.png_url || fileUrls?.png;
        break;
      default:
        url = undefined;
    }
    
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
      setError('Download failed');
    }
  };

  if (compilationStatus !== 'ok' && !fileId && (!fileUrls || Object.keys(fileUrls).length === 0)) {
    return (
      <Card className={`w-full ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Diagram Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No diagram available</p>
              <p className="text-sm mt-1">
                {compilationStatus === 'error' ? 'Compilation failed' : 'Compile TikZ code to generate preview'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            Diagram Preview
            <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">RENDERING</span>
          </CardTitle>

          {/* Format selector moved to content section */}
        </div>
        
        {/* File info */}
        {fileInfo && (
          <div className="text-sm text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              ID: {fileInfo.file_id}
            </span>
            <span>Created: {formatDate(fileInfo.created_at)}</span>
            {fileInfo.file_sizes[selectedFormat] && (
              <span>Size: {formatFileSize(fileInfo.file_sizes[selectedFormat])}</span>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {error && (
          <div className="flex items-center justify-center h-64 text-red-500">
            <div className="text-center">
              <p>Error: {error}</p>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={loadFileInfo}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          </div>
        )}
        
        {!loading && !error && (fileInfo || fileUrls) && (
          <div className="w-full">
            {/* Format Selector Section */}
            <div className="mb-4">
              <FormatSelector
                availableFormats={fileInfo?.available_formats || ['pdf', 'svg', 'png']}
                selectedFormat={selectedFormat}
                onFormatChange={setSelectedFormat}
                fileUrls={fileUrls}
                fileId={fileId}
                className="mb-4"
              />
            </div>

            {/* Preview Section */}
            <div className="preview-container rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
              {selectedFormat === 'pdf' && getPreviewUrl() && (
                <PDFViewer 
                  pdfUrl={getPreviewUrl()!}
                  className="w-full"
                />
              )}
              
              {selectedFormat === 'svg' && getPreviewUrl() && (
                <SVGViewer 
                  svgUrl={getPreviewUrl()!}
                  className="w-full"
                />
              )}
              
              {selectedFormat === 'png' && getPreviewUrl() && (
                <div className="flex items-center justify-center p-4 bg-white dark:bg-neutral-100 relative">
                  {imageLoadStates.png === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-100">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
                    </div>
                  )}
                  <img 
                    src={getPreviewUrl()!}
                    alt="Feynman Diagram PNG"
                    className={`max-w-full h-auto rounded shadow-sm transition-opacity duration-200 ${
                      imageLoadStates.png === 'loaded' ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                      maxHeight: '600px'
                    }}
                    onLoad={() => setImageLoadStates(prev => ({ ...prev, png: 'loaded' }))}
                    onError={() => setImageLoadStates(prev => ({ ...prev, png: 'error' }))}
                  />
                  {imageLoadStates.png === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-neutral-100">
                      <div className="text-center text-neutral-500">
                        <FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Failed to load image</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {getPreviewUrl() === null && (
                <div className="flex items-center justify-center h-32 text-neutral-500 dark:text-neutral-400">
                  <div className="text-center">
                    <FileImage className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Format not available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DiagramPreview;