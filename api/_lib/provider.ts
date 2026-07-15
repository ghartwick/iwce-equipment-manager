/**
 * Provider-neutral LLM abstraction.
 *
 * The agent loop and tools speak ONLY this neutral format. Each provider
 * adapter (Anthropic, Gemini, OpenAI, ...) converts the neutral conversation
 * into its own native format and back. This means switching providers is a
 * config change, with no impact on the loop or the tools.
 */

export interface LlmToolDef {
  name: string;
  description: string;
  /** JSON-Schema-style object describing the tool's arguments. */
  input_schema: Record<string, any>;
}

export interface LlmToolCall {
  /** Stable id for this call. Some providers (Gemini) have no native id; we synthesize one. */
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface LlmToolResult {
  id: string;
  name: string;
  /** JSON-stringified tool output. */
  content: string;
}

/** A single conversation turn in neutral form. */
export type AgentMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; toolCalls: LlmToolCall[] }
  | { role: 'tool'; results: LlmToolResult[] };

export interface LlmResponse {
  /** Provider stop reason, normalized loosely (e.g. 'end_turn', 'tool_use'). */
  stopReason: string | null;
  /** Assistant text this turn (may be empty when the model only called tools). */
  text: string;
  /** Tool calls the model wants executed this turn. */
  toolCalls: LlmToolCall[];
}

export interface CallModelArgs {
  system: string;
  messages: AgentMessage[];
  tools: LlmToolDef[];
  maxTokens?: number;
}

export interface LlmProvider {
  callModel(args: CallModelArgs): Promise<LlmResponse>;
}
