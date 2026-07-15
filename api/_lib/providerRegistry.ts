import { LlmProvider } from './provider.js';
import { anthropicProvider } from './anthropic.js';
import { geminiProvider } from './gemini.js';
import { openaiProvider } from './openai.js';

/**
 * Selects the active LLM provider from the LLM_PROVIDER env var.
 * Switching providers is a single env-var change - no code edits needed.
 *
 *   LLM_PROVIDER=gemini     -> Google Gemini (free tier)   [needs GEMINI_API_KEY]
 *   LLM_PROVIDER=openai     -> OpenAI GPT (paid)           [needs OPENAI_API_KEY]
 *   LLM_PROVIDER=anthropic  -> Anthropic Claude (paid)     [needs ANTHROPIC_API_KEY]
 *
 * Defaults to 'anthropic' if unset.
 */
export function getProvider(): LlmProvider {
  const choice = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
  switch (choice) {
    case 'gemini':
      return geminiProvider;
    case 'openai':
      return openaiProvider;
    case 'anthropic':
      return anthropicProvider;
    default:
      throw new Error(`Unknown LLM_PROVIDER "${choice}". Use "gemini", "openai", or "anthropic".`);
  }
}
