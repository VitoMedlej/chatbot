// Chatbot Playground Selector: Lets user pick a chatbot before entering a specific playground.

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Label from "@/components/form/Label";

export default function PlaygroundSelectorPage() {
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchChatbots = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/signin");
        return;
      }
      const res = await fetch(`http://localhost:8080/api/chatbot/list?user_id=${user.id}`);
      const result = await res.json();
      setChatbots(result.responseObject || []);
      setLoading(false);
    };
    fetchChatbots();
  }, [router]);

  const handleSelect = (id: string) => {
    if (!id || id === "undefined") return;
    router.replace(`/playground/${id}`);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-6">Select a Chatbot</h1>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        {chatbots.length === 0 ? (
          <div className="text-gray-500">No chatbots found. Create one first.</div>
        ) : (
          <ul className="space-y-3">
            {chatbots.map((cb) => (
              <li key={cb.id} className="flex items-center justify-between py-2">
                <span>{cb.business_name}</span>
                <Button size="sm" onClick={() => handleSelect(cb.id)}>
                  Open Playground
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}