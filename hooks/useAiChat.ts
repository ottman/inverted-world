import { useCallback, useState } from 'react';
import { callAI, buildResearchPrompt } from '@/lib/ai';
import { useRecursiv } from '@/contexts/RecursivContext';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function useAiChat(agentId: string | null) {
  const { sdk } = useRecursiv();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'What door are we opening first: Skywatch, Black Vault, Power Web, Machine State, High Strangeness, Off-World Signals, or something stranger?',
    },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = useCallback(
    async (raw: string, agentOverride?: string | null) => {
      const content = raw.trim();
      if (!content || isStreaming) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
      };
      const assistantId = `assistant-${Date.now()}`;
      setMessages((current) => [
        ...current,
        userMessage,
        { id: assistantId, role: 'assistant', content: 'Pulling the thread...' },
      ]);
      setIsStreaming(true);

      try {
        const result = await callAI(
          sdk,
          agentOverride ?? agentId,
          buildResearchPrompt(content),
          conversationId,
        );
        setConversationId(result.conversationId);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId ? { ...message, content: result.content } : message,
          ),
        );
      } catch (error) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content:
                    error instanceof Error
                      ? error.message
                      : 'The research agent failed to answer.',
                }
              : message,
          ),
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [agentId, conversationId, isStreaming, sdk],
  );

  return { messages, isStreaming, conversationId, sendMessage };
}
