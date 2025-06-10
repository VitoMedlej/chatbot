// Chatbot management page. Streamlined interface for managing existing chatbots.

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/server";
import Button from "@/components/ui/button/Button";

export default function ChatbotManagementPage() {
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
      const res = await fetch(apiUrl(`/api/chatbot/list?user_id=${user.id}`));
      const result = await res.json();
      setChatbots(result.responseObject || []);
      setLoading(false);
    };
    fetchChatbots();
  }, [router]);

  const handleManage = (id: string) => {
    if (!id || id === "undefined") return;
    router.replace(`/vault/${id}`);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-6">Manage Your Chatbots</h1>
        {chatbots.length > 0 ? (
          <ul className="space-y-4">
            {chatbots.map((cb) => (
              <li key={cb.id} className="flex items-center justify-between py-2 border-b">
                <span>{cb.business_name}</span>
                <Button size="sm" onClick={() => handleManage(cb.id)}>
                  Manage
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center text-gray-500">No chatbots found. Please create one.</div>
        )}
      </div>
    </div>
  );
}