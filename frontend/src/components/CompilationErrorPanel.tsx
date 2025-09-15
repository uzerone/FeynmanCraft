import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, RefreshCw, Lightbulb, AlertTriangle } from 'lucide-react';

interface CompilerError {
  line_number?: number;
  error_type?: string;
  message: string;
  suggestion?: string;
}

interface CompilerWarning {
  line_number?: number;
  message: string;
  suggestion?: string;
}

interface CompilationErrorPanelProps {
  errors: CompilerError[];
  warnings: CompilerWarning[];
  suggestions?: string[];
  onRetry?: () => void;
  className?: string;
}

const CompilationErrorPanel: React.FC<CompilationErrorPanelProps> = ({
  errors = [],
  warnings = [],
  suggestions = [],
  onRetry,
  className = ""
}) => {
  return (
    <Card className={`w-full border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="h-5 w-5" />
          Compilation Failed
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="ml-auto bg-red-100 border-red-300 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-800"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry Compilation
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Compilation Errors */}
        {errors.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Errors ({errors.length})
            </h4>
            {errors.map((error, index) => (
              <div key={index} className="bg-red-100 dark:bg-red-900 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <div className="font-medium text-red-800 dark:text-red-200">
                  {error.error_type && (
                    <span className="inline-block bg-red-200 dark:bg-red-800 px-2 py-1 rounded text-xs mr-2">
                      {error.error_type}
                    </span>
                  )}
                  {error.line_number && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      Line {error.line_number}:
                    </span>
                  )}
                </div>
                <div className="text-red-700 dark:text-red-300 mt-1">
                  {error.message}
                </div>
                {error.suggestion && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Suggestion: {error.suggestion}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Compilation Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-orange-700 dark:text-orange-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings ({warnings.length})
            </h4>
            {warnings.map((warning, index) => (
              <div key={index} className="bg-orange-50 dark:bg-orange-950 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="font-medium text-orange-800 dark:text-orange-200">
                  {warning.line_number && (
                    <span className="text-sm text-orange-600 dark:text-orange-400">
                      Line {warning.line_number}:
                    </span>
                  )}
                </div>
                <div className="text-orange-700 dark:text-orange-300 mt-1">
                  {warning.message}
                </div>
                {warning.suggestion && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded text-blue-700 dark:text-blue-300 text-sm flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>Suggestion: {warning.suggestion}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* General Improvement Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Improvement Suggestions
            </h4>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <ul className="space-y-1 text-blue-700 dark:text-blue-300">
                {suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">•</span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* No specific errors/warnings case */}
        {errors.length === 0 && warnings.length === 0 && (
          <div className="text-center text-red-600 dark:text-red-400 py-4">
            <AlertCircle className="w-8 h-8 mx-auto mb-2" />
            <p>Compilation failed with unknown errors.</p>
            <p className="text-sm text-red-500 dark:text-red-400 mt-1">
              Please check your TikZ code syntax and try again.
            </p>
          </div>
        )}

        {/* Help section */}
        <div className="bg-neutral-50 dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 mt-4">
          <h5 className="font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Common TikZ-Feynman Issues:
          </h5>
          <ul className="text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
            <li>• Use LuaLaTeX for advanced features and automatic layout</li>
            <li>• Ensure proper particle naming: \\(e^-\\), \\(\\gamma\\), \\(\\nu_e\\)</li>
            <li>• Check closing braces and bracket matching</li>
            <li>• Verify TikZ-Feynman package syntax</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default CompilationErrorPanel;