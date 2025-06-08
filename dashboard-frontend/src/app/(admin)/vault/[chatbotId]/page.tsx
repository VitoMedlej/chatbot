// Knowledge Vault: view, add, and delete knowledge sources (manual text, URLs, PDFs, CSVs). Shows chatbot info and all sources.

"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { supabase } from "@/lib/supabase";

type Source = {
  id: number;
  source_type: string;
  source_name: string | null;
  title: string | null;
  description: string | null;
  content: string | null;
  links: any;
  buttons: any;
  created_at: string;
};

export default function KnowledgeVaultPage() {
  const params = useParams();
  const chatbotId = params?.chatbotId as string;
  const [chatbot, setChatbot] = useState<any>(null);
  console.log('chatbot: ', chatbot);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Manual text state
  const [manualTitle, setManualTitle] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualText, setManualText] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // URL state
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // Fetch chatbot info and sources
  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);

      try {
        const chatbotResponse = await fetch(`http://localhost:8080/api/chatbot/${chatbotId}`);
        const chatbotData = await chatbotResponse.json();

        const sourcesResponse = await fetch(`http://localhost:8080/api/chatbot/${chatbotId}/sources`);
        const sourcesData = await sourcesResponse.json();

        setChatbot(chatbotData.responseObject);
        setSources(sourcesData.responseObject);
      } catch (err: any) {
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    }

    if (chatbotId) fetchAll();
  }, [chatbotId]);

  // Add manual text
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setError(null);
    const res = await fetch("http://localhost:8080/api/chatbot/manual-ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbotId,
        title: manualTitle,
        description: manualDesc,
        content: manualText,
      }),
    });
    const result = await res.json();
    setManualLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to ingest manual text.");
      return;
    }
    setManualText("");
    setManualTitle("");
    setManualDesc("");
    // Refresh sources
    const { data: srcs } = await supabase
      .from("chatbot_knowledge")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false });
    setSources(srcs || []);
  };

  // Add URL (extract and ingest)
  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlLoading(true);
    setError(null);
    const res = await fetch("http://localhost:8080/api/chatbot/extract-website", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urlInput,
        chatbotId,
      }),
    });
    const result = await res.json();
    setUrlLoading(false);
    if (!res.ok) {
      setError(result.message || "Failed to ingest URL.");
      return;
    }
    setUrlInput("");
    // Refresh sources
    const { data: srcs } = await supabase
      .from("chatbot_knowledge")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false });
    setSources(srcs || []);
  };

  // File upload (PDF/CSV) - TODO: implement backend endpoint
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chatbotId", chatbotId);

      const res = await fetch("http://localhost:8080/api/chatbot/upload-file", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      setFileLoading(false);

      if (!res.ok) {
        setError(result.message || "Failed to upload file.");
        return;
      }

      // Refresh sources
      const { data: srcs } = await supabase
        .from("chatbot_knowledge")
        .select("*")
        .eq("chatbot_id", chatbotId)
        .order("created_at", { ascending: false });
      setSources(srcs || []);
    } catch (err) {
      setFileLoading(false);
      setError("An error occurred while uploading the file.");
    }
  };

  // Delete source
  const handleDeleteSource = async (id: number) => {
    setLoading(true);
    setError(null);
    await supabase.from("chatbot_knowledge").delete().eq("id", id);
    const { data: srcs } = await supabase
      .from("chatbot_knowledge")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .order("created_at", { ascending: false });
    setSources(srcs || []);
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 mb-10">
      <h1 className="text-2xl font-bold mb-2">Knowledge Vault</h1>
      {chatbot && (
        <div className="mb-6 p-4 rounded bg-gray-50 dark:bg-gray-900 border">
          <h2 className="text-lg font-bold">{chatbot.business_name}</h2>
          <p className="text-sm text-gray-500">Chatbot ID: {chatbot.id}</p>
        </div>
      )}
      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">{error}</div>}

      {/* Add Manual Text */}
      <div className="mb-6">
        <Label>Add Manual Text</Label>
        <form onSubmit={handleManualIngest} className="space-y-2">
          <Input
            type="text"
            value={manualTitle}
            onChange={e => setManualTitle(e.target.value)}
            placeholder="Title (optional, e.g. FAQ, Policy, Product Name)"
          />
          <Input
            type="text"
            value={manualDesc}
            onChange={e => setManualDesc(e.target.value)}
            placeholder="Description (optional, e.g. Short summary)"
          />
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={4}
            value={manualText}
            onChange={e => setManualText(e.target.value)}
            placeholder="Paste any info, FAQ, product details, or text here"
            required
          />
          <Button className="w-full" type="submit" size="sm" disabled={manualLoading}>
            {manualLoading ? "Adding..." : "Add Manual Text"}
          </Button>
        </form>
      </div>

      {/* Add URL */}
      <div className="mb-6">
        <Label>Add Website URL</Label>
        <form onSubmit={handleUrlIngest} className="flex gap-2">
          <Input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com/page"
            required
          />
          <Button type="submit" size="sm" disabled={urlLoading}>
            {urlLoading ? "Adding..." : "Add URL"}
          </Button>
        </form>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <Label>Upload PDF/CSV (coming soon)</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          onChange={handleFileUpload}
          disabled
        />
      </div>

      {/* Knowledge Sources */}
      <div>
        <Label>Current Knowledge Sources</Label>
        <ul className="list-disc ml-6 text-sm text-gray-700 dark:text-gray-300">
          {(!Array.isArray(sources) || sources.length === 0) && (
            <li className="text-gray-400">No knowledge sources yet.</li>
          )}
          {Array.isArray(sources) && sources.map((src) => (
            <li key={src.id} className="flex flex-col gap-1 mb-2 border-b pb-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">
                  {src.title || src.source_name || src.source_type}
                </span>
                <Button
                  // size="xs"
                  variant="outline"
                  className="ml-2"
                  onClick={() => handleDeleteSource(src.id)}
                >
                  Delete
                </Button>
              </div>
              {src.description && (
                <div className="text-xs text-gray-500">{src.description}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}