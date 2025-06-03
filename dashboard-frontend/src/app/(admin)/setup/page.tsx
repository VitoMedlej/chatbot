// Create this file: src/app/setup/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

export default function SetupPage() {
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    // Call backend API to create chatbot
    const res = await fetch("/api/chatbot/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ business_name: businessName, user_id: user.id }),
    });
    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(result.error || "Failed to create chatbot.");
      return;
    }

    router.replace(`/setup/${result.id}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-md dark:border-gray-800 dark:bg-white/[0.03]">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white/90">Create Your Chatbot</h1>
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
          <Button className="w-full" type="submit" size="sm" disabled={loading}>
            {loading ? "Creating..." : "Create Chatbot"}
          </Button>
        </form>
      </div>
    </div>
  );
}