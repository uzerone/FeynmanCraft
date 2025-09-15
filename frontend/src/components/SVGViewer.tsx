import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, RotateCw, Maximize, Download } from 'lucide-react';

interface SVGViewerProps {
  svgUrl: string;
  className?: string;
}

const SVGViewer: React.FC<SVGViewerProps> = ({ svgUrl, className = "" }) => {
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    // Preload SVG to check if it loads successfully
    const img = new Image();
    img.onload = () => {
      setLoading(false);
    };
    img.onerror = () => {
      setError('Failed to load SVG');
      setLoading(false);
    };
    img.src = svgUrl;
  }, [svgUrl]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 5.0));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      svgContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = svgUrl;
    link.download = 'feynman_diagram.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setScale(1.0);
    setRotation(0);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-400"></div>
        <span className="ml-2 text-neutral-400">Loading SVG...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-red-400 text-center">
          <p>{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`svg-viewer bg-neutral-900 border border-neutral-700 rounded-lg ${className}`}>
      {/* Controls */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-700 bg-neutral-800">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.25}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          
          <span className="text-sm text-neutral-300 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 5.0}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            Reset
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFullscreen}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            <Maximize className="w-4 h-4" />
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="bg-neutral-700 border-neutral-600 hover:bg-neutral-600"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* SVG Display */}
      <div 
        ref={svgContainerRef}
        className="svg-container overflow-auto p-4 bg-white flex items-center justify-center min-h-[400px]"
        style={{ 
          maxHeight: isFullscreen ? '100vh' : '600px',
        }}
      >
        <div
          className="svg-wrapper flex items-center justify-center"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease-in-out',
          }}
        >
          <object
            data={svgUrl}
            type="image/svg+xml"
            className="max-w-full max-h-full"
            style={{
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
          >
            <img src={svgUrl} alt="Feynman Diagram" className="max-w-full max-h-full" />
          </object>
        </div>
      </div>
    </div>
  );
};

export default SVGViewer;