import type React from "react";
import type { Message } from "@langchain/langgraph-sdk";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Copy, CopyCheck } from "lucide-react";
import { InputForm } from "@/components/InputForm";
import { Button } from "@/components/ui/button";
import { useState, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  ActivityTimeline,
  ProcessedEvent,
} from "@/components/ActivityTimeline"; // Assuming ActivityTimeline is in the same dir or adjust path
import { DiagramPreview } from "@/components/DiagramPreview";

// Utility function to extract file URLs and IDs from message content
const extractFileInfo = (content: string) => {
  const patterns = {
    fileId: /(?:file_id|\*\*File ID\*\*):\s*`?([a-zA-Z0-9_]+)`?/gi,
    pdfMarkdownLink: /\*\*PDF\*\*:\s*\[Download\]\(([^)]+)\)/gi,
    svgMarkdownLink: /\*\*SVG\*\*:\s*\[Download\]\(([^)]+)\)/gi,
    pngMarkdownLink: /\*\*PNG\*\*:\s*\[Download\]\(([^)]+)\)/gi,
    infoMarkdownLink: /\*\*File Info\*\*:\s*\[Details\]\(([^)]+)\)/gi,
    // Fallback patterns for direct URLs
    pdfUrl: /(?:PDF|pdf)\s*(?:URL|url|link):\s*(http[^\s]+)/gi,
    svgUrl: /(?:SVG|svg)\s*(?:URL|url|link):\s*(http[^\s]+)/gi,
    pngUrl: /(?:PNG|png)\s*(?:URL|url|link):\s*(http[^\s]+)/gi,
    downloadUrl: /(?:Download|download)\s*(?:URL|url|link):\s*(http[^\s]+)/gi,
  };

  const fileIds: string[] = [];
  const fileUrls: { [key: string]: string } = {};

  let match;
  
  // Extract file IDs
  patterns.fileId.lastIndex = 0; // Reset regex state
  while ((match = patterns.fileId.exec(content)) !== null) {
    fileIds.push(match[1]);
  }

  // Extract PDF URLs from markdown links
  patterns.pdfMarkdownLink.lastIndex = 0;
  while ((match = patterns.pdfMarkdownLink.exec(content)) !== null) {
    fileUrls.pdf_url = match[1];
  }

  // Extract SVG URLs from markdown links
  patterns.svgMarkdownLink.lastIndex = 0;
  while ((match = patterns.svgMarkdownLink.exec(content)) !== null) {
    fileUrls.svg_url = match[1];
  }

  // Extract PNG URLs from markdown links
  patterns.pngMarkdownLink.lastIndex = 0;
  while ((match = patterns.pngMarkdownLink.exec(content)) !== null) {
    fileUrls.png_url = match[1];
  }

  // Extract info URLs from markdown links
  patterns.infoMarkdownLink.lastIndex = 0;
  while ((match = patterns.infoMarkdownLink.exec(content)) !== null) {
    fileUrls.info_url = match[1];
  }

  // Fallback: Extract direct PDF URLs
  if (!fileUrls.pdf_url) {
    patterns.pdfUrl.lastIndex = 0;
    while ((match = patterns.pdfUrl.exec(content)) !== null) {
      fileUrls.pdf_url = match[1];
    }
  }

  // Fallback: Extract direct SVG URLs
  if (!fileUrls.svg_url) {
    patterns.svgUrl.lastIndex = 0;
    while ((match = patterns.svgUrl.exec(content)) !== null) {
      fileUrls.svg_url = match[1];
    }
  }

  // Fallback: Extract direct PNG URLs
  if (!fileUrls.png_url) {
    patterns.pngUrl.lastIndex = 0;
    while ((match = patterns.pngUrl.exec(content)) !== null) {
      fileUrls.png_url = match[1];
    }
  }

  // Fallback: Extract download URLs
  patterns.downloadUrl.lastIndex = 0;
  while ((match = patterns.downloadUrl.exec(content)) !== null) {
    if (!fileUrls.pdf_url && match[1].includes('pdf')) {
      fileUrls.pdf_url = match[1];
    }
    if (!fileUrls.svg_url && match[1].includes('svg')) {
      fileUrls.svg_url = match[1];
    }
    if (!fileUrls.png_url && match[1].includes('png')) {
      fileUrls.png_url = match[1];
    }
  }

  // Debug logging
  if (fileIds.length > 0 || Object.keys(fileUrls).length > 0) {
    console.log('[DiagramPreview Debug] Extracted file info:', {
      fileIds,
      fileUrls,
      content: content.substring(0, 200) + '...'
    });
  }

  return {
    fileIds,
    fileUrls,
    hasDiagram: fileIds.length > 0 || Object.keys(fileUrls).length > 0
  };
};

// Markdown component props type from former ReportView
type MdComponentProps = {
  className?: string;
  children?: ReactNode;
  [key: string]: any;
};

// Markdown components (from former ReportView.tsx)
const mdComponents = {
  h1: ({ className, children, ...props }: MdComponentProps) => (
    <h1 className={cn("text-2xl font-bold mt-4 mb-2", className)} {...props}>
      {children}
    </h1>
  ),
  h2: ({ className, children, ...props }: MdComponentProps) => (
    <h2 className={cn("text-xl font-bold mt-3 mb-2", className)} {...props}>
      {children}
    </h2>
  ),
  h3: ({ className, children, ...props }: MdComponentProps) => (
    <h3 className={cn("text-lg font-bold mt-3 mb-1", className)} {...props}>
      {children}
    </h3>
  ),
  p: ({ className, children, ...props }: MdComponentProps) => (
    <p className={cn("mb-3 leading-7", className)} {...props}>
      {children}
    </p>
  ),
  a: ({ className, children, href, ...props }: MdComponentProps) => (
    <Badge className="text-xs mx-0.5">
      <a
        className={cn("text-blue-400 hover:text-blue-300 text-xs", className)}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    </Badge>
  ),
  ul: ({ className, children, ...props }: MdComponentProps) => (
    <ul className={cn("list-disc pl-6 mb-3", className)} {...props}>
      {children}
    </ul>
  ),
  ol: ({ className, children, ...props }: MdComponentProps) => (
    <ol className={cn("list-decimal pl-6 mb-3", className)} {...props}>
      {children}
    </ol>
  ),
  li: ({ className, children, ...props }: MdComponentProps) => (
    <li className={cn("mb-1", className)} {...props}>
      {children}
    </li>
  ),
  blockquote: ({ className, children, ...props }: MdComponentProps) => (
    <blockquote
      className={cn(
        "border-l-4 border-neutral-600 pl-4 italic my-3 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }: MdComponentProps) => (
    <code
      className={cn(
        "bg-neutral-900 rounded px-1 py-0.5 font-mono text-xs",
        className
      )}
      {...props}
    >
      {children}
    </code>
  ),
  pre: ({ className, children, ...props }: MdComponentProps) => (
    <pre
      className={cn(
        "bg-neutral-900 p-3 rounded-lg overflow-x-auto font-mono text-xs my-3",
        className
      )}
      {...props}
    >
      {children}
    </pre>
  ),
  hr: ({ className, ...props }: MdComponentProps) => (
    <hr className={cn("border-neutral-600 my-4", className)} {...props} />
  ),
  table: ({ className, children, ...props }: MdComponentProps) => (
    <div className="my-3 overflow-x-auto">
      <table className={cn("border-collapse w-full", className)} {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ className, children, ...props }: MdComponentProps) => (
    <th
      className={cn(
        "border border-neutral-600 px-3 py-2 text-left font-bold",
        className
      )}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ className, children, ...props }: MdComponentProps) => (
    <td
      className={cn("border border-neutral-600 px-3 py-2", className)}
      {...props}
    >
      {children}
    </td>
  ),
};

// Props for HumanMessageBubble
interface HumanMessageBubbleProps {
  message: Message;
  mdComponents: typeof mdComponents;
}

// HumanMessageBubble Component
const HumanMessageBubble: React.FC<HumanMessageBubbleProps> = ({
  message,
  mdComponents,
}) => {
  return (
    <div
      className={`text-white rounded-3xl break-words min-h-7 bg-neutral-700 max-w-[100%] sm:max-w-[90%] px-4 pt-3 rounded-br-lg`}
    >
      <ReactMarkdown components={mdComponents}>
        {typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content)}
      </ReactMarkdown>
    </div>
  );
};

// Props for AiMessageBubble
interface AiMessageBubbleProps {
  message: Message;
  historicalActivity: ProcessedEvent[] | undefined;
  liveActivity: ProcessedEvent[] | undefined;
  isLastMessage: boolean;
  isOverallLoading: boolean;
  mdComponents: typeof mdComponents;
  handleCopy: (text: string, messageId: string) => void;
  copiedMessageId: string | null;
}

// AiMessageBubble Component
const AiMessageBubble: React.FC<AiMessageBubbleProps> = ({
  message,
  historicalActivity,
  liveActivity,
  isLastMessage,
  isOverallLoading,
  mdComponents,
  handleCopy,
  copiedMessageId,
}) => {
  // Determine which activity events to show and if it's for a live loading message
  const activityForThisBubble =
    isLastMessage && isOverallLoading ? liveActivity : historicalActivity;
  const isLiveActivityForThisBubble = isLastMessage && isOverallLoading;

  // Extract file info from message content
  const messageContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
  const { fileIds, fileUrls, hasDiagram } = extractFileInfo(messageContent);

  return (
    <div className={`relative break-words flex flex-col`}>
      {activityForThisBubble && activityForThisBubble.length > 0 && (
        <div className="mb-3 border-b border-neutral-700 pb-3 text-xs">
          <ActivityTimeline
            processedEvents={activityForThisBubble}
            isLoading={isLiveActivityForThisBubble}
          />
        </div>
      )}
      <ReactMarkdown components={mdComponents}>
        {messageContent}
      </ReactMarkdown>
      
      {/* Display inline PNG image if available */}
      {hasDiagram && fileUrls.png_url && (
        <div className="mt-4">
          <div className="border border-neutral-600 rounded-lg overflow-hidden bg-white p-4 flex items-center justify-center">
            <img
              src={fileUrls.png_url}
              alt="Generated Feynman Diagram"
              className="max-w-full h-auto"
              style={{ maxHeight: '400px' }}
              onError={(e) => {
                console.error('Failed to load inline PNG:', fileUrls.png_url);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          {/* Keep the original DiagramPreview for format selection and downloads */}
          <div className="mt-2 border border-neutral-600 rounded-lg overflow-hidden">
            <DiagramPreview
              fileId={fileIds[0] || ""}
              fileUrls={fileUrls}
              compilationStatus="ok"
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Display diagram preview only if no PNG available for inline display */}
      {hasDiagram && !fileUrls.png_url && (
        <div className="mt-4 border border-neutral-600 rounded-lg overflow-hidden">
          <DiagramPreview
            fileId={fileIds[0] || ""}
            fileUrls={fileUrls}
            compilationStatus="ok"
            className="w-full"
          />
        </div>
      )}
      
      <Button
        variant="default"
        className={`cursor-pointer bg-neutral-700 border-neutral-600 text-neutral-300 self-end ${
          message.content.length > 0 ? "visible" : "hidden"
        }`}
        onClick={() =>
          handleCopy(
            messageContent,
            message.id!
          )
        }
      >
        {copiedMessageId === message.id ? "Copied" : "Copy"}
        {copiedMessageId === message.id ? <CopyCheck /> : <Copy />}
      </Button>
    </div>
  );
};

interface ChatMessagesViewProps {
  messages: Message[];
  isLoading: boolean;
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (inputValue: string) => void;
  onCancel: () => void;
  liveActivityEvents: ProcessedEvent[];
  historicalActivities: Record<string, ProcessedEvent[]>;
}

// Export the function for use in other components
export { extractFileInfo as extractFileUrls };

export function ChatMessagesView({
  messages,
  isLoading,
  scrollAreaRef,
  onSubmit,
  onCancel,
  liveActivityEvents,
  historicalActivities,
}: ChatMessagesViewProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopy = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-y-auto" ref={scrollAreaRef}>
        <div className="p-4 md:p-6 space-y-2 max-w-4xl mx-auto pt-16">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            return (
              <div key={message.id || `msg-${index}`} className="space-y-3">
                <div
                  className={`flex items-start gap-3 ${
                    message.type === "human" ? "justify-end" : ""
                  }`}
                >
                  {message.type === "human" ? (
                    <HumanMessageBubble
                      message={message}
                      mdComponents={mdComponents}
                    />
                  ) : (
                    <AiMessageBubble
                      message={message}
                      historicalActivity={historicalActivities[message.id!]}
                      liveActivity={liveActivityEvents} // Pass global live events
                      isLastMessage={isLast}
                      isOverallLoading={isLoading} // Pass global loading state
                      mdComponents={mdComponents}
                      handleCopy={handleCopy}
                      copiedMessageId={copiedMessageId}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {isLoading &&
            (messages.length === 0 ||
              messages[messages.length - 1].type === "human") && (
              <div className="flex items-start gap-3 mt-3">
                {" "}
                {/* AI message row structure */}
                <div className="relative group max-w-[85%] md:max-w-[80%] rounded-xl p-3 shadow-sm break-words bg-neutral-800 text-neutral-100 rounded-bl-none w-full min-h-[56px]">
                  {liveActivityEvents.length > 0 ? (
                    <div className="text-xs">
                      <ActivityTimeline
                        processedEvents={liveActivityEvents}
                        isLoading={true}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-start h-full">
                      <Loader2 className="h-5 w-5 animate-spin text-neutral-400 mr-2" />
                      <span>Processing...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>
      </ScrollArea>
      <InputForm
        onSubmit={onSubmit}
        isLoading={isLoading}
        onCancel={onCancel}
        hasHistory={messages.length > 0}
      />
    </div>
  );
}
