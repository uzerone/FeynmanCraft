import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SquarePen, Send, StopCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

// Updated InputFormProps
interface InputFormProps {
  onSubmit: (inputValue: string) => void;
  onCancel: () => void;
  isLoading: boolean;
  hasHistory: boolean;
  shouldClearInput?: boolean; // Add prop to control input clearing
}

export const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  onCancel,
  isLoading,
  hasHistory,
  shouldClearInput = false,
}) => {
  const [internalInputValue, setInternalInputValue] = useState("");

  // Clear input when shouldClearInput changes to true
  useEffect(() => {
    if (shouldClearInput) {
      setInternalInputValue("");
    }
  }, [shouldClearInput]);

  const handleInternalSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!internalInputValue.trim()) return;
    onSubmit(internalInputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit with Ctrl+Enter (Windows/Linux) or Cmd+Enter (Mac)
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleInternalSubmit();
    }
  };

  const isSubmitDisabled = !internalInputValue.trim() || isLoading;

  return (
    <form
      onSubmit={handleInternalSubmit}
      className={`flex flex-col gap-2 p-3 pb-4`}
    >
      <div
        className={`flex flex-row items-center justify-between text-foreground rounded-3xl rounded-bl-sm ${
          hasHistory ? "rounded-br-sm" : ""
        } break-words min-h-7 bg-muted px-4 pt-3`}
      >
        <Textarea
          value={internalInputValue}
          onChange={(e) => setInternalInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Generate Feynman diagram for electron-positron annihilation"
          className={`w-full text-foreground placeholder:text-muted-foreground caret-foreground resize-none border-0 focus:outline-none focus:ring-0 outline-none focus-visible:ring-0 shadow-none bg-transparent md:text-base min-h-[56px] max-h-[200px] dark:text-foreground dark:placeholder:text-muted-foreground dark:caret-foreground`}
          rows={1}
        />
        <div className="-mt-3">
          {isLoading ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 p-2 cursor-pointer rounded-full transition-all duration-200"
              onClick={onCancel}
            >
              <StopCircle className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="ghost"
              className={`${
                isSubmitDisabled
                  ? "text-muted-foreground"
                  : "text-primary hover:text-primary/80 hover:bg-primary/10"
              } p-2 cursor-pointer rounded-full transition-all duration-200 text-base`}
              disabled={isSubmitDisabled}
            >
              Generate
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        {hasHistory && (
          <Button
            className="bg-secondary border-border text-secondary-foreground cursor-pointer rounded-xl rounded-t-sm pl-2 "
            variant="default"
            onClick={() => window.location.reload()}
          >
            <SquarePen size={16} />
            New Diagram
          </Button>
        )}
      </div>
    </form>
  );
};
