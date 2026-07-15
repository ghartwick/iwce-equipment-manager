import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Loader2, Bot, User as UserIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { agentService, AgentChatMessage } from '../services/agentService';

/**
 * Floating AI assistant widget.
 *
 * Read-only in this build: it can answer questions by querying the system via
 * the /api/agent serverless endpoint. Write actions are added in a later phase.
 */
export function AgentChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!user) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput('');

    const history = messages;
    const nextMessages: AgentChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await agentService.sendMessage(user.id, text, history);
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err) {
      setError((err as Error).message);
      setMessages([...nextMessages, { role: 'assistant', content: `Sorry, something went wrong: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center justify-center h-14 w-14 rounded-full bg-yellow-500 text-black shadow-lg hover:bg-yellow-400 transition-colors"
          title="Ask the assistant"
        >
          <MessageSquare className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col w-[calc(100vw-2.5rem)] sm:w-96 h-[70vh] max-h-[600px] bg-yellow-100 dark:bg-black border border-yellow-600 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-yellow-700 dark:bg-yellow-900 dark:bg-opacity-40 border-b border-yellow-600">
            <div className="flex items-center space-x-2 text-yellow-100 dark:text-yellow-300">
              <Bot className="h-5 w-5" />
              <span className="font-semibold">Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-yellow-100 dark:text-yellow-300 hover:text-white"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-yellow-700 dark:text-yellow-500 text-center mt-6 px-4">
                Ask me about equipment, clients, sites, maintenance history, or time entries.
                <div className="mt-2 text-xs opacity-70">Read-only for now — I can look things up but can't make changes yet.</div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-yellow-500 text-black' : 'bg-yellow-700 text-yellow-100'}`}>
                    {m.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`px-3 py-2 rounded-lg text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-yellow-500 text-black' : 'bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-30 text-gray-900 dark:text-yellow-100'}`}>
                    {m.content}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-200 dark:bg-yellow-900 dark:bg-opacity-30 text-gray-700 dark:text-yellow-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking…</span>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 border-t border-red-300 dark:border-red-800">
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-yellow-600 p-2 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question…"
              rows={1}
              className="flex-1 resize-none px-3 py-2 rounded-lg bg-yellow-200 dark:bg-black border border-yellow-600 text-gray-900 dark:text-yellow-100 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 max-h-32"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex-shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
