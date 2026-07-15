import { AgentMessage, CallModelArgs, LlmProvider, LlmResponse, LlmToolCall } from './provider';

/**
 * OpenAI (GPT) adapter using the stable Chat Completions REST API (no SDK, so
 * no version drift). NOTE: OpenAI's API requires a paid/prepaid billing setup -
 * it does not have a free tier like Gemini.
 * Get a key at https://platform.openai.com > API keys.
 */

const DEFAULT_MODEL = 'gpt-4o-mini';
const API_URL = 'https://api.openai.com/v1/chat/completions';

/** Convert neutral conversation into OpenAI chat messages. */
function toOpenAiMessages(system: string, messages: AgentMessage[]): any[] {
  const out: any[] = [{ role: 'system', content: system }];

  for (const m of messages) {
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.text });
    } else if (m.role === 'assistant') {
      const msg: any = { role: 'assistant', content: m.text || null };
      if (m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.input || {}) },
        }));
      }
      out.push(msg);
    } else {
      // tool results -> one 'tool' message per result, matched by tool_call_id
      for (const r of m.results) {
        out.push({ role: 'tool', tool_call_id: r.id, content: r.content });
      }
    }
  }
  return out;
}

export const openaiProvider: LlmProvider = {
  async callModel({ system, messages, tools, maxTokens = 1024 }: CallModelArgs): Promise<LlmResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY env var is not set.');
    const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;

    const body = {
      model,
      max_tokens: maxTokens,
      messages: toOpenAiMessages(system, messages),
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      })),
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const choice = data?.choices?.[0];
    const msg = choice?.message || {};

    const toolCalls: LlmToolCall[] = [];
    for (const call of msg.tool_calls || []) {
      let input: Record<string, any> = {};
      try {
        input = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        input = {};
      }
      toolCalls.push({ id: call.id, name: call.function?.name, input });
    }

    return {
      stopReason: toolCalls.length > 0 ? 'tool_use' : choice?.finish_reason || 'end_turn',
      text: typeof msg.content === 'string' ? msg.content : '',
      toolCalls,
    };
  },
};
