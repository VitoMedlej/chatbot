// Chatbot Onboarding Stepper Page with page selection for scraping and skippable persona

"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ChevronLeftIcon } from "@/icons";

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
  const [allPages, setAllPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [scrapedPages, setScrapedPages] = useState<string[]>([]);

  useEffect(() => {
    const fetchPersonaAndChunks = async () => {
      setLoading(true);
      const { data: personaData } = await supabase
        .from("chatbots")
        .select("business_name,persona,instructions")
        .eq("id", chatbotId)
        .single();
      if (personaData) setPersona(personaData);

      const res = await fetch(`http://localhost:8080/api/chatbot/list-chunks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatbotId: Number(chatbotId) }),
      });
      const result = await res.json();
      if (result?.responseObject?.length) {
        setScrapedPages(
          result.responseObject
            .map((c: any) => c.source_url)
            .filter((v: string | null) => !!v)
        );
        setStep(2);
      }
      setLoading(false);
    };
    if (chatbotId && chatbotId !== "undefined") fetchPersonaAndChunks();
  }, [chatbotId]);

  // Step 1: Enter website and fetch links for selection
  const handleFetchLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("http://localhost:8080/api/chatbot/website-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: website }),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok || !Array.isArray(result.responseObject)) {
      setError(result.message || "Failed to fetch links.");
      return;
    }
    setAllPages(result.responseObject);
    setSelectedPages(result.responseObject.slice(0, 10)); // Preselect first 10
  };

  // Step 1b: User selects pages to crawl
  const handlePageToggle = (url: string) => {
    setSelectedPages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleCrawlSelected = async () => {
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
      body: JSON.stringify({
        url: website,
        chatbotId,
        userId: user.id,
        selectedUrls: selectedPages,
      }),
    });
    const result = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to crawl website.");
      return;
    }
    if (result.responseObject?.crawledUrls) {
      setScrapedPages(result.responseObject.crawledUrls);
    }
    setStep(2);
  };

  // Step 2: Generate persona (skippable)
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

  // Step 2: Skip persona (use default)
  const handleSkipPersona = async () => {
    setError(null);
    setLoading(true);
    // Try to get website title from scrapedPages or fallback to generic
    let businessName = "Your Business";
    if (scrapedPages.length > 0) {
      try {
        const url = scrapedPages[0];
        const res = await fetch("http://localhost:8080/api/chatbot/extract-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const result = await res.json();
        if (result?.responseObject?.title) {
          businessName = result.responseObject.title;
        }
      } catch {}
    }
    setPersona({
      business_name: businessName,
      persona: `You are the helpful assistant for ${businessName}.`,
      instructions:
        "Be concise and helpful. Never say you are ChatGPT. Always answer as a representative of the business. If you don't know, suggest contacting support.",
    });
    setLoading(false);
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

  const handleBack = () => {
    router.replace("/setup");
  };

  if (!chatbotId || chatbotId === "undefined") {
    return <div className="p-8 text-center text-red-500">Invalid chatbot ID.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03] shadow-theme-md">
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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 ml-2">Chatbot Setup</h1>
        </div>
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
          <>
            <form onSubmit={handleFetchLinks} className="space-y-6">
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
                {loading ? "Fetching Links..." : "Fetch Pages"}
              </Button>
            </form>
            {allPages.length > 0 && (
              <div className="mt-6">
                <Label>Select pages to include</Label>
                <div className="max-h-64 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900">
                  {allPages.map((url, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedPages.includes(url)}
                        onChange={() => handlePageToggle(url)}
                        id={`page-${i}`}
                      />
                      <label htmlFor={`page-${i}`} className="truncate text-sm">{url}</label>
                    </div>
                  ))}
                </div>
                <Button
                  className="w-full mt-4"
                  type="button"
                  size="sm"
                  disabled={loading || selectedPages.length === 0}
                  onClick={handleCrawlSelected}
                >
                  {loading ? "Crawling..." : "Crawl Selected Pages"}
                </Button>
              </div>
            )}
          </>
        )}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <Label>Persona & Instructions</Label>
              <div className="text-gray-700 dark:text-gray-300 mb-2">
                You can auto-generate a persona, or skip and use a default persona.
              </div>
            </div>
            {scrapedPages.length > 0 && (
              <div className="mb-4">
                <Label>Scraped Pages</Label>
                <ul className="list-disc ml-6 text-sm text-gray-700 dark:text-gray-300">
                  {scrapedPages.map((url, i) => (
                    <li key={i}>{url}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && <div className="text-red-500">{error}</div>}
            <div className="flex gap-2">
              <Button className="w-full" type="button" size="sm" disabled={loading} onClick={handleGeneratePersona}>
                {loading ? "Generating..." : "Auto-Generate Persona"}
              </Button>
              <Button className="w-full" type="button" size="sm" disabled={loading} onClick={handleSkipPersona} variant="outline">
                {loading ? "..." : "Skip"}
              </Button>
            </div>
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