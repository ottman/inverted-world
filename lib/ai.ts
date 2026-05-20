import type { Recursiv } from '@recursiv/sdk';

export async function callAI(
  sdk: Recursiv,
  agentId: string | null,
  prompt: string,
  conversationId?: string | null,
): Promise<{ content: string; conversationId: string }> {
  if (!agentId) {
    throw new Error('No Inverted World research agent is available yet.');
  }

  const client = (sdk.agents as any).client;
  const baseUrl: string = client.baseUrl;
  const apiKey: string = client.apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${baseUrl}/agents/${agentId}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        message: prompt,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`AI request failed: HTTP ${response.status} ${body.slice(0, 160)}`);
    }

    const text = await response.text();
    let content = '';
    let returnedConversationId = conversationId || '';

    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'text_delta' && parsed.delta) content += parsed.delta;
        if (parsed.type === 'message_start' && parsed.conversation_id) {
          returnedConversationId = parsed.conversation_id;
        }
        if (parsed.conversation_id && !returnedConversationId) {
          returnedConversationId = parsed.conversation_id;
        }
        if (parsed.type === 'error') throw new Error(parsed.error || 'AI error');
      } catch (error: any) {
        if (error?.message && !error.message.startsWith('Unexpected')) throw error;
      }
    }

    if (!content.trim()) throw new Error('AI returned an empty response.');
    return { content, conversationId: returnedConversationId };
  } finally {
    clearTimeout(timer);
  }
}

export function buildResearchPrompt(input: string) {
  return [
    'You are the Inverted World research desk.',
    `Investigate: ${input}`,
    'Be critical, visionary, document-first, and honest about uncertainty.',
    'Separate confirmed facts, strong leads, disputed claims, missing records, and speculation.',
    'Prioritize primary documents, court records, FOIA/declassified archives, datasets, original media, and reputable counterarguments.',
    'Return a concise source map, narrative angle, strongest counterread, and the next three documents to pull.',
  ].join('\n');
}
