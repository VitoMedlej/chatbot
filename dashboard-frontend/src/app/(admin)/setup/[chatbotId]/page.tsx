// Chatbot Onboarding Stepper Page with page selection for scraping and skippable persona

"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ChevronLeftIcon } from "@/icons";

type Step = 1 | 2 | 3;

export default function ChatbotSetupPage() {
  const router = useRouter();
  const params = useParams();
  const chatbotId = params?.chatbotId as string;

  const [step, setStep] = useState<Step>(1);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allPages, setAllPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [scrapedPages, setScrapedPages] = useState<string[]>([]);

  useEffect(() => {
    async function checkSetup() {
      if (!chatbotId) {
        router.replace("/(admin)");
        return;
      }
      // Fetch chatbot info
      const { data } = await supabase
        .from("chatbots")
        .select("id,setup_complete")
        .eq("id", chatbotId)
        .single();
      if (!data) {
        router.replace("/(admin)");
        return;
      }
      if (data.setup_complete) {
        // Already setup, redirect to dashboard or chatbot details
        router.replace(`/dashboard/${chatbotId}`);
        return;
      }
      setLoading(false);
    }
    checkSetup();
  }, [chatbotId, router]);

  useEffect(() => {
    const fetchChunks = async () => {
      setLoading(true);
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
    if (chatbotId && chatbotId !== "undefined") fetchChunks();
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
    // Auto-generate persona after ingestion
    await fetch("http://localhost:8080/api/chatbot/auto-generate-persona", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId }),
    });
    setStep(3);
  };

  // Step 3: Done
  const handleGoToDashboard = () => {
    router.replace("/(admin)");
  };

  const handleBack = () => {
    router.replace("/setup");
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

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
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 3 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"}`}>3</div>
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
              <Label>Scraped Pages</Label>
              <ul className="list-disc ml-6 text-sm text-gray-700 dark:text-gray-300">
                {scrapedPages.map((url, i) => (
                  <li key={i}>{url}</li>
                ))}
              </ul>
            </div>
            <Button className="w-full" type="button" size="sm" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        )}
        {step === 3 && (
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