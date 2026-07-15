import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { getProvider } from './_lib/providerRegistry.js';
import { AgentMessage, LlmToolResult } from './_lib/provider.js';
import { AgentUser, executeTool, getToolDefsForUser } from './_lib/tools.js';

const MAX_ITERATIONS = 6;

/** Plain-text conversation turn sent by the client. */
interface ClientMessage {
  role: 'user' | 'assistant';
  content: string;
}

function buildSystemPrompt(user: AgentUser): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'You are the assistant for the IWCE Equipment Manager, an internal tool for tracking equipment, maintenance, and survey time entries.',
    `Today is ${today}.`,
    `You are currently helping ${user.name} (username: ${user.username}, role: ${user.role}).`,
    '',
    'Guidelines:',
    '- Use the provided tools to look up real data before answering questions about equipment, clients, sites, users, maintenance, or time entries. Never invent data.',
    '- Be concise and factual. Present lists and records clearly.',
    '- Respect roles: field users only see their own time entries; do not attempt to access data the tools deny.',
    '- If a tool returns an error, explain it plainly to the user instead of guessing.',
    '- This build is READ-ONLY. You cannot create, edit, or delete records yet. If asked to perform such an action, explain that write actions are not enabled yet.',
  ].join('\n');
}

/**
 * Resolve the acting user from the request.
 *
 * PHASE 1 (read-only): we accept the user id claimed by the client and validate
 * that it exists in Firestore, then use the AUTHORITATIVE role from the database
 * (never the role sent by the client). This is NOT cryptographic authentication -
 * it is acceptable only for read-only access on an internal tool. Phase 3 will
 * replace this with a signed session token verified server-side before any writes.
 */
async function resolveUser(claimedUserId: unknown): Promise<AgentUser | null> {
  if (!claimedUserId || typeof claimedUserId !== 'string') return null;
  const db = getDb();
  const snap = await db.collection('users').doc(claimedUserId).get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  if (data.isActive === false) return null;
  const role = (data.role === 'technician' ? 'field' : data.role) as AgentUser['role'];
  return { id: snap.id, username: data.username, name: data.name, role };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { message, history, userId } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Missing "message" string in request body.' });
      return;
    }

    const user = await resolveUser(userId);
    if (!user) {
      res.status(401).json({ error: 'Unable to verify user. Please sign in again.' });
      return;
    }

    const db = getDb();
    const ctx = { db, user };
    const system = buildSystemPrompt(user);
    const tools = getToolDefsForUser(user);
    const provider = getProvider();

    // Build message history (plain text turns) + the new user message.
    const priorTurns: ClientMessage[] = Array.isArray(history) ? history.slice(-20) : [];
    const messages: AgentMessage[] = priorTurns
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, text: m.content } as AgentMessage));
    messages.push({ role: 'user', text: message });

    const toolsUsed: string[] = [];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const resp = await provider.callModel({ system, messages, tools });
      messages.push({ role: 'assistant', text: resp.text, toolCalls: resp.toolCalls });

      if (resp.toolCalls.length === 0) {
        res.status(200).json({ reply: resp.text || '(no response)', toolsUsed });
        return;
      }

      const results: LlmToolResult[] = [];
      for (const call of resp.toolCalls) {
        toolsUsed.push(call.name);
        let result: any;
        try {
          result = await executeTool(call.name, call.input, ctx);
        } catch (err) {
          result = { error: (err as Error).message };
        }
        results.push({ id: call.id, name: call.name, content: JSON.stringify(result) });
      }
      messages.push({ role: 'tool', results });
    }

    res.status(200).json({
      reply: "I wasn't able to complete that request within the allowed number of steps. Please try rephrasing or narrowing your question.",
      toolsUsed,
    });
  } catch (err) {
    console.error('Agent error:', err);
    res.status(500).json({ error: (err as Error).message || 'Internal agent error.' });
  }
}
