import { useState, useCallback } from 'react';

export interface ADKMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

export interface ADKEvent {
  id: string;
  content: any;
  author: string;
  timestamp: number;
}

export const useADK = () => {
  const [messages, setMessages] = useState<ADKMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState<ADKEvent[]>([]);

  const createSession = async () => {
    const response = await fetch('/apps/feynmancraft_adk/users/user/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: {},
        events: []
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to create session');
    }
    
    return await response.json();
  };

  const sendMessage = useCallback(async (text: string) => {
    setIsLoading(true);
    setEvents([]);
    
    try {
      // Add user message immediately
      const userMessage: ADKMessage = {
        id: Date.now().toString(),
        content: text,
        role: 'user',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);

      // Create session
      const session = await createSession();
      
      // Send to ADK
      const response = await fetch('/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appName: "feynmancraft_adk",
          userId: "user",
          sessionId: session.id,
          newMessage: {
            parts: [{ text }],
            role: "user"
          },
          streaming: false
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const result = await response.json();
      
      // Process events
      setEvents(result);
      
      // Extract final assistant message
      const lastEvent = result[result.length - 1];
      if (lastEvent && lastEvent.content && lastEvent.content.parts) {
        const textParts = lastEvent.content.parts
          .filter((part: any) => part.text)
          .map((part: any) => part.text)
          .join('');
          
        if (textParts) {
          const assistantMessage: ADKMessage = {
            id: lastEvent.id,
            content: textParts,
            role: 'assistant',
            timestamp: lastEvent.timestamp * 1000
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      }

    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const stop = useCallback(() => {
    setIsLoading(false);
  }, []);

  return {
    messages,
    events,
    isLoading,
    sendMessage,
    stop
  };
};