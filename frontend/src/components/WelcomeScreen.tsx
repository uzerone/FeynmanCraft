import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, StopCircle, Loader2, Copy, Check } from "lucide-react";

interface WelcomeScreenProps {
  handleSubmit: (submittedInputValue: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  shouldClearInput?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  handleSubmit,
  onCancel,
  isLoading,
  shouldClearInput = false,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [clickedSuggestion, setClickedSuggestion] = useState<number | null>(null);
  const [textareaHeight, setTextareaHeight] = useState("auto");
  const [currentPlaceholder, setCurrentPlaceholder] = useState(0);
  const [generationResult, setGenerationResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Cycling placeholder examples
  const placeholderExamples = [
    "e.g., Two photons converting to electron-positron pair...",
    "e.g., Gluon exchange between two quarks...",
    "e.g., W boson mediating beta decay...",
    "Describe the Feynman diagram you want to generate..."
  ];

  // Clear input when shouldClearInput changes to true
  useEffect(() => {
    if (shouldClearInput) {
      setInputValue("");
      setGenerationResult(null);
      setError(null);
    }
  }, [shouldClearInput]);

  // Cycle placeholder examples every 5 seconds
  useEffect(() => {
    if (!inputValue && !isLoading) {
      const interval = setInterval(() => {
        setCurrentPlaceholder((prev) => (prev + 1) % placeholderExamples.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [inputValue, isLoading, placeholderExamples.length]);

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  // Auto-resize textarea based on content with responsive min-height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const newHeight = Math.min(scrollHeight, 300); // Max height 300px

      // Responsive min-height: 80px on mobile, 100px on larger screens
      const isMobile = window.innerWidth < 640;
      const minHeight = isMobile ? 80 : 100;

      textareaRef.current.style.height = `${Math.max(newHeight, minHeight)}px`;
      setTextareaHeight(`${Math.max(newHeight, minHeight)}px`);
    }
  }, [inputValue]);

  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    setError(null);
    setGenerationResult(null);

    try {
      handleSubmit(inputValue);
    } catch (err) {
      setError("Generation failed. Please try again.");
    }
  };

  const handleSuggestionClick = (suggestion: string, index: number) => {
    // Get the full example prompt
    const fullPrompt = suggestionPrompts[suggestion] || suggestion;

    // Set clicked state for animation
    setClickedSuggestion(index);
    setTimeout(() => setClickedSuggestion(null), 200);

    // Clear any errors
    setError(null);

    // Populate textarea with fade effect
    setInputValue("");
    setTimeout(() => {
      setInputValue(fullPrompt);
      // Focus textarea after population
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(fullPrompt.length, fullPrompt.length);
      }
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit with Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleFormSubmit();
    }
    // Escape key clears textarea
    if (e.key === "Escape") {
      setInputValue("");
      setError(null);
    }
  };

  const handleSuggestionKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, suggestion: string, index: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSuggestionClick(suggestion, index);
    }
    // Arrow key navigation
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = (index + 1) % suggestions.length;
      suggestionRefs.current[nextIndex]?.focus();
      setFocusedSuggestion(nextIndex);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = (index - 1 + suggestions.length) % suggestions.length;
      suggestionRefs.current[prevIndex]?.focus();
      setFocusedSuggestion(prevIndex);
    }
    // Tab to textarea
    if (e.key === "Tab" && !e.shiftKey) {
      textareaRef.current?.focus();
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const isSubmitDisabled = !inputValue.trim() || isLoading;
  const characterCount = inputValue.length;
  const maxCharacters = 500;

  const suggestions = [
    "Electron-positron annihilation",
    "QCD vertex diagram",
    "Higgs boson decay",
    "Compton scattering"
  ];

  const suggestionPrompts = {
    "Electron-positron annihilation": "Generate a Feynman diagram for electron-positron annihilation producing two photons",
    "QCD vertex diagram": "Draw a QCD three-gluon vertex with momentum labels",
    "Higgs boson decay": "Create a Feynman diagram showing Higgs boson decay to two Z bosons",
    "Compton scattering": "Generate Compton scattering diagram with incoming photon and electron"
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-5 sm:px-8 lg:px-8 flex-1 w-full max-w-[720px] mx-auto space-y-6 sm:space-y-8 lg:space-y-8">
      {/* Header Section */}
      <div className="space-y-3 sm:space-y-4">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-foreground">
          FeynmanCraft
        </h1>
        <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground">
          Generate TikZ Feynman diagrams from natural language
        </p>
      </div>

      {/* Suggestion Buttons */}
      <div className="w-full space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              ref={(el) => (suggestionRefs.current[index] = el)}
              variant="outline"
              className={`bg-muted hover:bg-muted-foreground/10 hover:shadow-md border-border text-foreground py-3 sm:py-4 px-4 sm:px-6 rounded-lg text-sm sm:text-base font-normal transition-all duration-200 transform hover:scale-[1.02] focus:ring-2 focus:ring-primary/20 focus:border-primary/30 ${
                clickedSuggestion === index
                  ? "scale-95 bg-primary/10 border-primary/30 shadow-lg"
                  : ""
              } ${
                focusedSuggestion === index
                  ? "ring-2 ring-primary/20 border-primary/30"
                  : ""
              }`}
              onClick={() => handleSuggestionClick(suggestion, index)}
              onKeyDown={(e) => handleSuggestionKeyDown(e, suggestion, index)}
              onFocus={() => setFocusedSuggestion(index)}
              onBlur={() => setFocusedSuggestion(null)}
              disabled={isLoading}
            >
              {suggestion}
            </Button>
          ))}
        </div>
      </div>

      {/* Enhanced Input Form */}
      <div className="w-full space-y-4 sm:space-y-5">
        <form onSubmit={handleFormSubmit} className="space-y-4 sm:space-y-5">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderExamples[currentPlaceholder]}
              className={`w-full min-h-[80px] sm:min-h-[100px] max-h-[300px] resize-none rounded-xl bg-muted border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all duration-200 px-4 py-3 pr-16 text-sm sm:text-base ${
                inputValue.trim() ? "shadow-md" : ""
              } focus:shadow-lg focus:border-primary/50 ${
                error ? "border-red-400/50 focus:border-red-400/70" : ""
              }`}
              disabled={isLoading}
              style={{
                height: textareaHeight,
                transition: "all 0.2s ease, opacity 0.2s ease"
              }}
            />

            {/* Character Counter */}
            <div className="absolute bottom-3 right-4 text-xs text-muted-foreground/70">
              {characterCount}/{maxCharacters}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-400 bg-red-400/5 border border-red-400/20 rounded-lg p-3 transition-all duration-200">
              {error}
            </div>
          )}

          {/* Keyboard Hints */}
          <div className="text-xs text-muted-foreground/60 text-center space-y-1">
            <p>Ctrl+Enter to submit • Escape to clear • Tab to navigate suggestions</p>
          </div>

          <div className="flex justify-center">
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="px-6 sm:px-8 py-3 rounded-xl font-medium transition-all duration-200 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm sm:text-base"
                onClick={onCancel}
              >
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                Generating...
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className={`px-6 sm:px-8 py-3 rounded-xl font-medium transition-all duration-200 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 text-sm sm:text-base ${
                  !isSubmitDisabled
                    ? "shadow-lg hover:shadow-xl animate-pulse [animation-duration:2s]"
                    : ""
                }`}
                disabled={isSubmitDisabled}
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Generate Diagram
              </Button>
            )}
          </div>
        </form>

        {/* Generation Result */}
        {generationResult && (
          <div className="w-full space-y-3">
            <div className="bg-muted border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-foreground">Generated LaTeX Code</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => copyToClipboard(generationResult)}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy LaTeX
                    </>
                  )}
                </Button>
              </div>
              <pre className="text-xs bg-background border border-border rounded-lg p-3 overflow-x-auto text-foreground font-mono">
                <code>{generationResult}</code>
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-2">
        <p className="text-xs text-muted-foreground">
          Powered by Google ADK and Gemini AI
        </p>
      </div>
    </div>
  );
};
