// Chatbot selection/creation page for onboarding

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ChevronLeftIcon } from "@/icons"; // If you have an icon component

export default function SetupPage() {
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchChatbots = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      console.log('user: ', user);
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
    if (!id || id === "undefined") return; // Prevent navigating to /setup/undefined
    router.replace(`/setup/${id}`);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setCreating(false);
      return;
    }
    const res = await fetch("http://localhost:8080/api/chatbot/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_name: businessName, user_id: user.id }),
    });
    const result = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(result.error || "Failed to create chatbot.");
      return;
    }
    if (!result.responseObject?.id) {
      setError("Failed to create chatbot. No ID returned.");
      return;
    }
    router.replace(`/setup/${result.responseObject.id}`);
  };

  const handleBack = () => {
    router.replace("/(admin)");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex items-center mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="mr-2"
            startIcon={<ChevronLeftIcon />}
          >
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 ml-2">Your Chatbots</h1>
        </div>
        {chatbots.length > 0 && (
          <div className="mb-6">
            <Label>Select an existing chatbot</Label>
            <ul className="mb-4">
              {chatbots.map((cb) => (
                <li key={cb.id} className="flex items-center justify-between py-2">
                  <span>{cb.business_name}</span>
                  <Button size="sm" onClick={() => handleSelect(cb.id)}>Setup</Button>
                </li>
              ))}
            </ul>
            <div className="text-center text-gray-500 mb-2">or create a new one</div>
          </div>
        )}
        <form onSubmit={handleCreate} className="space-y-6">
          <div>
            <Label>Business or Website Name</Label>
            <Input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              required
              placeholder="e.g. Acme Inc"
            />
          </div>
          {error && <div className="text-red-500">{error}</div>}
          <Button className="w-full" type="submit" size="sm" disabled={creating}>
            {creating ? "Creating..." : "Create New Chatbot"}
          </Button>
        </form>
      </div>
    </div>
  );
}