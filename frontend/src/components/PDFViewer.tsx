import React, { useRef, useEffect, useState } from 'react';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';

interface PDFViewerProps {
  pdfUrl: string;
  className?: string;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDFViewer: React.FC<PDFViewerProps> = ({ pdfUrl, className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPDF();
  }, [pdfUrl]);

  useEffect(() => {
    if (pdfDoc) {
      renderPage();
    }
  }, [pdfDoc, pageNum, scale, rotation]);

  const loadPDF = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load PDF.js library if not already loaded
      if (!window.pdfjsLib) {
        await loadPDFJSLibrary();
      }

      const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF');
      setLoading(false);
    }
  };

  const loadPDFJSLibrary = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const renderPage = async () => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const viewport = page.getViewport({ scale, rotation });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Error rendering page:', err);
      setError('Failed to render PDF page');
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  const rotate = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  const downloadPDF = async () => {
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'feynman-diagram.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const openFullscreen = () => {
    window.open(pdfUrl, '_blank');
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-96 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 text-red-500 ${className}`}>
        <div className="text-center">
          <p>Error: {error}</p>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={loadPDF}
            className="mt-2"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      {/* PDF Controls */}
      <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={zoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm min-w-[4rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button size="sm" variant="outline" onClick={zoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={rotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {pdfDoc && pdfDoc.numPages > 1 && (
            <div className="flex items-center gap-2 text-sm">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPageNum(prev => Math.max(prev - 1, 1))}
                disabled={pageNum <= 1}
              >
                ←
              </Button>
              <span>
                Page {pageNum} of {pdfDoc.numPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPageNum(prev => Math.min(prev + 1, pdfDoc.numPages))}
                disabled={pageNum >= pdfDoc.numPages}
              >
                →
              </Button>
            </div>
          )}
          
          <Button size="sm" variant="outline" onClick={openFullscreen}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPDF}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="w-full overflow-auto border rounded bg-white flex justify-center">
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto shadow-sm"
          style={{ 
            display: pdfDoc ? 'block' : 'none',
            margin: '20px'
          }}
        />
      </div>
    </div>
  );
};

export default PDFViewer;