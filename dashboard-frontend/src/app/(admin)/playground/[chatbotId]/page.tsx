// Chatbot Playground/Test Page for a specific chatbot (production logic)

"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import KnowledgeCheck from "@/components/KnowledgeCheck";
import { apiClient } from "@/lib/apiClient";

export default function ChatbotPlaygroundPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params?.chatbotId as string;

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  console.log('messages: ', messages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [chatbot, setChatbot] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [contextChunks, setContextChunks] = useState<any[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the real userId from Supabase Auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id ?? null);
    })();
  }, []);  // Fetch chatbot info (persona/instructions)
  useEffect(() => {
    if (!chatbotId) return;
    (async () => {
      try {
        const res = await apiClient.get<any>(`/api/chatbot/${chatbotId}`);
        if (res?.success && res?.data) setChatbot(res.data);
        else setError("Failed to load chatbot info.");
      } catch {
        setError("Failed to load chatbot info.");
      }
    })();
  }, [chatbotId]);  // Fetch context chunks for display
  useEffect(() => {
    if (!chatbotId) return;
    setContextLoading(true);
    (async () => {
      try {
        const res = await apiClient.get<any>(`/api/chatbot/${chatbotId}/sources`);
        setContextChunks(res?.responseObject || []);
      } catch (error) {
        console.error("Failed to load context chunks:", error);
      } finally {
        setContextLoading(false);
      }
    })();
  }, [chatbotId]);  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || !userId) return;
    setError(null);
    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    try {      const res = await apiClient.post<any>("/api/chatbot/rag-qa", {
        chatbotId,
        question: userMessage.content,
        userId: userId,
      });let assistantReply = null;
      if (res?.success) {
        // RAG service returns { answer: string } in responseObject
        if (res.responseObject?.answer) {
          assistantReply = res.responseObject.answer;
        }
      }
      if (!res?.success || !assistantReply) {
        setError(res?.message || "Failed to get answer.");
        setLoading(false);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: assistantReply }]);
    } catch (err: any) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [inputRef, loading]);

  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-4" />
        <div>Loading user session…</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-2">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Chatbot Playground</h1>
        {chatbot && (
          <div className="bg-gray-50 border rounded p-3 mb-2">
            <div className="font-semibold text-lg">{chatbot.name}</div>
            <div className="text-sm text-gray-700 mb-1">{chatbot.business_name}</div>
            <div className="text-xs text-gray-500 mb-1">Personality: {chatbot.personality}</div>
            <div className="text-xs text-gray-600 mb-1">Persona: {chatbot.persona}</div>
            <div className="text-xs text-gray-600">Instructions: {chatbot.instructions}</div>
          </div>
        )}
      </div>
      <div className="bg-white border rounded-lg shadow p-4 min-h-[350px] flex flex-col">
        <div className="flex-1 overflow-y-auto mb-2">
          {messages.length === 0 && (
            <div className="text-gray-400 text-center py-8">Start chatting with your chatbot…</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`mb-2 flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg text-sm whitespace-pre-line ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-100 text-gray-900 rounded-bl-none border"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="mb-2 flex justify-start">
              <div className="max-w-[80%] px-4 py-2 rounded-lg text-sm bg-gray-100 text-gray-400 border rounded-bl-none animate-pulse">
                Thinking…
              </div>
            </div>
          )}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 mt-2">
          <input
            ref={inputRef}
            className="flex-1 border rounded px-3 py-2 focus:outline-none"
            placeholder="Type your message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            maxLength={1000}
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
        {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
      </div>
      <div className="mt-8">
        <h2 className="font-semibold mb-2 text-lg">Knowledge Context</h2>
        {contextLoading ? (
          <div className="text-gray-400">Loading context…</div>
        ) : contextChunks.length === 0 ? (
          <div className="text-gray-400">No knowledge sources found for this chatbot.</div>
        ) : (
          <div className="space-y-2">
            {contextChunks.slice(0, 8).map((chunk: any, i: number) => (
              <div key={i} className="bg-gray-50 border rounded p-2 text-xs">
                <div className="mb-1 font-semibold text-gray-700 truncate">
                  {chunk.source_name || chunk.source_url ? (
                    <a
                      href={ chunk.source_name || chunk.source_url }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      {chunk.source_name || chunk.source_url}
                    </a>
                  ) : (
                    <span>No source URL</span>
                  )}
                </div>
                <div className="text-gray-800 whitespace-pre-line">{chunk.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-8">
        <KnowledgeCheck chatbotId={chatbotId} />
      </div>
    </div>
  );
}