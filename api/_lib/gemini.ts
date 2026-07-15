import { AgentMessage, CallModelArgs, LlmProvider, LlmResponse, LlmToolCall } from './provider';

/**
 * Google Gemini adapter using the stable REST API (no SDK, so no version drift).
 * Gemini has a genuine free tier - get a key from https://aistudio.google.com
 * with no billing required.
 */

const DEFAULT_MODEL = 'gemini-2.0-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const TYPE_MAP: Record<string, string> = {
  object: 'OBJECT',
  string: 'STRING',
  number: 'NUMBER',
  integer: 'INTEGER',
  boolean: 'BOOLEAN',
  array: 'ARRAY',
};

/** Convert a JSON-schema-ish object into Gemini's schema format (uppercase types). */
function toGeminiSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return undefined;
  const out: any = {};
  if (schema.type) out.type = TYPE_MAP[schema.type] || String(schema.type).toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      out.properties[k] = toGeminiSchema(v);
    }
  }
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (Array.isArray(schema.required) && schema.required.length > 0) out.required = schema.required;
  return out;
}

/** Only include a `parameters` block if the tool actually takes arguments. */
function toGeminiFunctionDecl(name: string, description: string, inputSchema: any) {
  const hasProps = inputSchema?.properties && Object.keys(inputSchema.properties).length > 0;
  return {
    name,
    description,
    ...(hasProps ? { parameters: toGeminiSchema(inputSchema) } : {}),
  };
}

function safeParse(content: string): any {
  try {
    return JSON.parse(content);
  } catch {
    return { result: content };
  }
}

/** Convert neutral conversation into Gemini `contents`. */
function toGeminiContents(messages: AgentMessage[]): any[] {
  return messages.map((m) => {
    if (m.role === 'user') {
      return { role: 'user', parts: [{ text: m.text }] };
    }
    if (m.role === 'assistant') {
      const parts: any[] = [];
      if (m.text) parts.push({ text: m.text });
      for (const call of m.toolCalls) {
        parts.push({ functionCall: { name: call.name, args: call.input } });
      }
      // Gemini requires at least one part.
      if (parts.length === 0) parts.push({ text: '' });
      return { role: 'model', parts };
    }
    // tool results -> functionResponse parts on a user turn
    return {
      role: 'user',
      parts: m.results.map((r) => {
        const parsed = safeParse(r.content);
        const response = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { result: parsed };
        return { functionResponse: { name: r.name, response } };
      }),
    };
  });
}

export const geminiProvider: LlmProvider = {
  async callModel({ system, messages, tools, maxTokens = 1024 }: CallModelArgs): Promise<LlmResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY env var is not set.');
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      tools: [
        {
          functionDeclarations: tools.map((t) => toGeminiFunctionDecl(t.name, t.description, t.input_schema)),
        },
      ],
      generationConfig: { maxOutputTokens: maxTokens },
    };

    const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const candidate = data?.candidates?.[0];
    const parts: any[] = candidate?.content?.parts || [];

    const toolCalls: LlmToolCall[] = [];
    let text = '';
    let callIndex = 0;

    for (const part of parts) {
      if (typeof part.text === 'string') {
        text += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          // Gemini has no native call id; synthesize a stable one.
          id: `${part.functionCall.name}_${callIndex++}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      }
    }

    return {
      stopReason: toolCalls.length > 0 ? 'tool_use' : candidate?.finishReason || 'end_turn',
      text,
      toolCalls,
    };
  },
};
