export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentResponse {
  reply: string;
  toolsUsed: string[];
}

/**
 * Client wrapper for the /api/agent serverless endpoint.
 *
 * We send the current user's id so the server can resolve their authoritative
 * role from Firestore. The LLM API key and all data access live server-side.
 */
export const agentService = {
  async sendMessage(
    userId: string,
    message: string,
    history: AgentChatMessage[]
  ): Promise<AgentResponse> {
    const res = await fetch('/api/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, history }),
    });

    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        if (data?.error) detail = data.error;
      } catch {
        // ignore parse errors, keep default detail
      }
      throw new Error(detail);
    }

    return res.json();
  },
};
