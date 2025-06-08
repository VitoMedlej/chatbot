// Chatbot Playground/Test Page for a specific chatbot (production logic)

"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { supabase } from "@/lib/supabase";
import KnowledgeCheck from "@/components/KnowledgeCheck";

export default function ChatbotPlaygroundPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  console.log('chatbotId: ', chatbotId);

  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the real userId from Supabase Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
    });
  }, []);

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading || !userId) return;
    const userMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    const res = await fetch("http://localhost:8080/api/chatbot/chat-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        chatbotId,
        message: userMessage.content,
      }),
    });
    const result = await res.json();
    setLoading(false);
    if (result?.responseObject) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.responseObject },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    }
    inputRef.current?.focus();
  };

  if (!userId) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-10">
      <KnowledgeCheck chatbotId={chatbotId} />
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-md">
        <h1 className="text-2xl font-bold mb-2">Chatbot Playground</h1>
        <div className="h-80 overflow-y-auto border rounded p-4 bg-gray-50 dark:bg-gray-900 mb-4">
          {messages.length === 0 && (
            <div className="text-gray-400 text-center">Start chatting with your bot…</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
              <span
                className={`inline-block px-3 py-2 rounded-lg ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            // ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1"
            disabled={loading}
            // autoFocus
          />
          <Button type="submit" disabled={loading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}