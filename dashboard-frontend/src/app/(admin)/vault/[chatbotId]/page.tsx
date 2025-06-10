// Knowledge Vault: view, add, and delete knowledge sources (manual text, URLs, PDFs, CSVs). Shows chatbot info and all sources.

"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { supabase } from "@/lib/supabase";
import { apiUrl } from "@/lib/server";

const PERSONALITIES = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "enthusiastic", label: "Enthusiastic" },
  { value: "concise", label: "Concise" },
  { value: "empathetic", label: "Empathetic" },
];

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

  // Edit mode for chatbot customization
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [personality, setPersonality] = useState("friendly");
  const [saveLoading, setSaveLoading] = useState(false);

  // Fetch chatbot info and sources
  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/chatbot/${chatbotId}`));
      const result = await res.json();
      if (result?.responseObject) {
        setChatbot(result.responseObject);
        setName(result.responseObject.name || "");
        setAvatarUrl(result.responseObject.avatar_url || "");
        setLogoUrl(result.responseObject.logo_url || "");
        setPersonality(result.responseObject.personality || "friendly");
      }
      // Fetch sources from backend
      const sourcesRes = await fetch(apiUrl(`/api/chatbot/${chatbotId}/sources`));
      const sourcesData = await sourcesRes.json();
      setSources(sourcesData?.responseObject || []);
    } catch (err: any) {
      setError("Failed to load chatbot info.");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (chatbotId) fetchAll();
  }, [chatbotId]);

  // Add manual text
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setError(null);
    // Call backend API, not Supabase directly
    const res = await fetch(apiUrl("/api/chatbot/manual-ingest"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatbotId,
        userId: chatbot?.user_id, // Pass userId if available
        title: manualTitle,
        description: manualDesc,
        content: manualText,
      }),
    });
    const result = await res.json();
    setManualLoading(false);
    if (!res.ok) {
      setError(result?.message || "Failed to ingest text");
      return;
    }
    setManualText("");
    setManualTitle("");
    setManualDesc("");
    // Refresh sources from backend API (not direct DB)
    fetchAll();
  };

  // Add URL (extract and ingest)
  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlLoading(true);
    setError(null);

    // Ensure chatbot and chatbot.user_id are available
    if (!chatbot || !chatbot.user_id) {
      setError("Chatbot user ID is not available. Please reload the page.");
      setUrlLoading(false);
      return;
    }

    const res = await fetch(apiUrl("/api/chatbot/website/extract-website"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: urlInput,
        chatbotId,
        userId: chatbot.user_id, // Add userId to the request body
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

      const res = await fetch(apiUrl("/api/chatbot/website/upload-file"), {
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

  // Save chatbot customization
  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    const res = await fetch(apiUrl("/api/chatbot/update"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: chatbotId,
        name,
        avatar_url: avatarUrl,
        logo_url: logoUrl,
        personality,
      }),
    });
    setSaveLoading(false);
    if (!res.ok) {
      setError("Failed to update chatbot customization.");
      return;
    }
    setEditMode(false);
    fetchAll();
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

      {/* Chatbot Customization */}
      <div className="mb-8 p-4 border rounded bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4 mb-2">
          {chatbot?.avatar_url && (
            <img src={chatbot.avatar_url} alt="Avatar" className="w-12 h-12 rounded-full" />
          )}
          {chatbot?.logo_url && (
            <img src={chatbot.logo_url} alt="Logo" className="w-12 h-12 rounded" />
          )}
          <div>
            <div className="font-bold text-lg">{chatbot?.name || chatbot?.business_name}</div>
            <div className="text-xs text-gray-500">Personality: {chatbot?.personality}</div>
          </div>
          <Button size="sm" className="ml-auto" onClick={() => setEditMode((v) => !v)}>
            {editMode ? "Cancel" : "Edit"}
          </Button>
        </div>
        {editMode && (
          <form onSubmit={handleSaveCustomization} className="space-y-3 mt-2">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <Label>Avatar URL</Label>
              <Input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>Personality</Label>
              <select
                className="w-full border rounded p-2"
                value={personality}
                onChange={e => setPersonality(e.target.value)}
                required
              >
                {PERSONALITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <Button type="submit" size="sm" disabled={saveLoading}>
              {saveLoading ? "Saving..." : "Save"}
            </Button>
          </form>
        )}
      </div>

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