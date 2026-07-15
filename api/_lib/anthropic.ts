import Anthropic from '@anthropic-ai/sdk';
import { AgentMessage, CallModelArgs, LlmProvider, LlmResponse, LlmToolCall } from './provider.js';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY env var is not set.');
  }
  client = new Anthropic({ apiKey });
  return client;
}

/** Convert neutral conversation into Anthropic message content blocks. */
function toAnthropicMessages(messages: AgentMessage[]): any[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      return { role: 'user', content: m.text };
    }
    if (m.role === 'assistant') {
      const content: any[] = [];
      if (m.text) content.push({ type: 'text', text: m.text });
      for (const call of m.toolCalls) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
      }
      return { role: 'assistant', content };
    }
    // tool results are sent back as a user turn in Anthropic's protocol
    return {
      role: 'user',
      content: m.results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })),
    };
  });
}

export const anthropicProvider: LlmProvider = {
  async callModel({ system, messages, tools, maxTokens = 1024 }: CallModelArgs): Promise<LlmResponse> {
    const anthropic = getClient();
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as any,
      })),
      messages: toAnthropicMessages(messages),
    });

    const toolCalls: LlmToolCall[] = [];
    let text = '';

    for (const block of response.content) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: (block.input as Record<string, any>) || {},
        });
      }
    }

    return { stopReason: response.stop_reason, text, toolCalls };
  },
};
