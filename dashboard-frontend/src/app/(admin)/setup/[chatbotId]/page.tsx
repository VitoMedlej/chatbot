// Chatbot Onboarding Stepper Page (dashboard layout, consistent with your template)

"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

type Step = 1 | 2 | 3 | 4;

export default function ChatbotSetupPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params?.chatbotId as string;

  const [step, setStep] = useState<Step>(1);
  const [website, setWebsite] = useState("");
  const [persona, setPersona] = useState<{ business_name?: string; persona?: string; instructions?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optionally, fetch chatbot info to prefill persona if exists
  useEffect(() => {
    const fetchPersona = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("chatbots")
        .select("business_name,persona,instructions")
        .eq("id", chatbotId)
        .single();
      if (data) setPersona(data);
      setLoading(false);
    };
    if (chatbotId) fetchPersona();
  }, [chatbotId]);

  // Step 1: Enter website and crawl
  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }
    const res = await fetch("http://localhost:8080/api/chatbot/crawl-and-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: website, chatbotId, userId: user.id }),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to crawl website.");
      return;
    }
    setStep(2);
  };

  // Step 2: Generate persona
  const handleGeneratePersona = async () => {
    setError(null);
    setLoading(true);
    const res = await fetch("http://localhost:8080/api/chatbot/auto-generate-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId }),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to generate persona.");
      return;
    }
    setPersona(result.responseObject);
    setStep(3);
  };

  // Step 3: Review & edit persona
  const handleSavePersona = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("http://localhost:8080/api/chatbot/update-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId, ...persona }),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to save persona.");
      return;
    }
    setStep(4);
  };

  // Step 4: Done
  const handleGoToDashboard = () => {
    router.replace("/(admin)");
  };

  // Make sure to check chatbotId is defined and valid before rendering steps
  if (!chatbotId || chatbotId === "undefined") {
    return <div className="p-8 text-center text-red-500">Invalid chatbot ID.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-md">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white/90">Chatbot Setup</h1>
        <div className="mb-8 flex items-center gap-4">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>1</div>
          <div className={`h-1 w-8 ${step > 1 ? "bg-blue-600" : "bg-gray-200"}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>2</div>
          <div className={`h-1 w-8 ${step > 2 ? "bg-blue-600" : "bg-gray-200"}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>3</div>
          <div className={`h-1 w-8 ${step > 3 ? "bg-blue-600" : "bg-gray-200"}`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 4 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>4</div>
        </div>
        {step === 1 && (
          <form onSubmit={handleCrawl} className="space-y-6">
            <div>
              <Label>Website URL</Label>
              <Input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                required
                placeholder="https://yourwebsite.com"
              />
            </div>
            {error && <div className="text-red-500">{error}</div>}
            <Button className="w-full" type="submit" size="sm" disabled={loading}>
              {loading ? "Crawling..." : "Crawl & Ingest Website"}
            </Button>
          </form>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Persona & Instructions</Label>
              <div className="text-gray-700 dark:text-gray-300 mb-2">
                Click below to auto-generate a persona and instructions from your website content.
              </div>
            </div>
            {error && <div className="text-red-500">{error}</div>}
            <Button className="w-full" type="button" size="sm" disabled={loading} onClick={handleGeneratePersona}>
              {loading ? "Generating..." : "Generate Persona"}
            </Button>
          </div>
        )}
        {step === 3 && persona && (
          <form onSubmit={handleSavePersona} className="space-y-6">
            <div>
              <Label>Business Name</Label>
              <Input
                type="text"
                value={persona.business_name || ""}
                onChange={e => setPersona({ ...persona, business_name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Persona</Label>
              <Input
                type="text"
                value={persona.persona || ""}
                onChange={e => setPersona({ ...persona, persona: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Instructions</Label>
              <textarea
                className="w-full border px-3 py-2 rounded"
                value={persona.instructions || ""}
                onChange={e => setPersona({ ...persona, instructions: e.target.value })}
                required
                rows={4}
              />
            </div>
            {error && <div className="text-red-500">{error}</div>}
            <Button className="w-full" type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : "Save Persona & Finish"}
            </Button>
          </form>
        )}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="text-green-600 text-lg font-semibold mb-4">Your chatbot is ready!</div>
            <Button className="w-full" type="button" size="sm" onClick={handleGoToDashboard}>
              Go to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}