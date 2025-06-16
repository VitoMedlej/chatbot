// Knowledge Vault: view, add, and delete knowledge sources (manual text, URLs, PDFs, CSVs). Shows chatbot info and all sources.

"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/apiClient";
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
  console.log('sources: ', sources);
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

  // Embed configuration state
  const [embedMode, setEmbedMode] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [embedLoading, setEmbedLoading] = useState(false);// Fetch chatbot info and sources
  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<any>(`/api/chatbot/${chatbotId}`);
      if (res?.responseObject) {
        setChatbot(res.responseObject);
        setName(res.responseObject.name || "");
        setAvatarUrl(res.responseObject.avatar_url || "");
        setLogoUrl(res.responseObject.logo_url || "");
        setPersonality(res.responseObject.personality || "friendly");
        // Load embed configuration
        setApiKey(res.responseObject.api_key || "");
        setAllowedDomains(res.responseObject.allowed_domains || []);
      }
      // Fetch sources from backend
      const sourcesRes = await apiClient.get<any>(`/api/chatbot/${chatbotId}/sources`);
      setSources(sourcesRes?.responseObject || []);
    } catch (err: any) {
      setError("Failed to load chatbot info.");
    }
    setLoading(false);
  };
  useEffect(() => {
    if (!chatbotId) return;
    fetchAll();
  }, [chatbotId]);  // Add manual text
  const handleManualIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    setError(null);
    try {
      // Call backend API, not Supabase directly
      const res = await apiClient.post<any>("/api/chatbot/manual-ingest", {
        chatbotId,
        userId: chatbot?.user_id, // Pass userId if available
        title: manualTitle,
        description: manualDesc,
        content: manualText,
      });
      setManualLoading(false);
      setManualText("");
      setManualTitle("");
      setManualDesc("");
      // Refresh sources from backend API (not direct DB)
      fetchAll();
    } catch (err: any) {
      setManualLoading(false);
      setError(err.response?.data?.message || "Failed to ingest text");
    }
  };
  // Add URL (extract and ingest)
  const handleUrlIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlLoading(true);
    setError(null);

    if (!chatbot || !chatbot.user_id) {
      setError("Chatbot user ID is not available. Please reload the page.");
      setUrlLoading(false);
      return;
    }

    try {
      const res = await apiClient.post("/api/chatbot/website/extract-website", {
        url: urlInput,
        chatbotId,
        userId: chatbot.user_id,
      });
      setUrlLoading(false);
      setUrlInput("");
      fetchAll();
    } catch (err: any) {
      setUrlLoading(false);
      setError("Failed to ingest URL.");
    }
  };  // File upload (PDF/CSV) - TODO: implement backend endpoint
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chatbotId", chatbotId);
      
      // Get token from Supabase session for auth header
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch(apiUrl("/api/chatbot/website/upload-file"), {
        method: "POST",
        body: formData,
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      await res.json();
      setFileLoading(false);
      if (!res.ok) {
        setError("Failed to upload file.");
        return;
      }
      fetchAll();
    } catch (err) {
      setFileLoading(false);
      setError("An error occurred while uploading the file.");
    }
  };  // Delete source
  const handleDeleteSource = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.deleteWithBody<any>("/api/chatbot/knowledge/chunks", {
        chatbotId,
        chunkIds: [id]
      });
      fetchAll();
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError("Failed to delete source.");
    }
  };  // Save chatbot customization
  const handleSaveCustomization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<any>("/api/chatbot/update", {
        id: chatbotId,
        name,
        avatar_url: avatarUrl,
        logo_url: logoUrl,
        personality,
      });
      setSaveLoading(false);
      setEditMode(false);
      fetchAll();
    } catch (err: any) {
      setSaveLoading(false);
      setError("Failed to update chatbot customization.");
    }
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

      {/* Website Embed Section */}
      <div className="mb-8 p-4 border rounded bg-white dark:bg-gray-900">
        <div className="flex items-center gap-4 mb-2">
          <h3 className="font-semibold text-lg">Website Embed</h3>
          <Button size="sm" onClick={() => setEmbedMode((v) => !v)}>
            {embedMode ? "Hide" : "Setup Embed"}
          </Button>
        </div>
        
        {apiKey ? (
          <div className="space-y-4">
            <div>
              <Label>Embed Code (Copy & Paste to Your Website)</Label>
              <div className="bg-gray-100 p-3 rounded border text-sm font-mono">
                {`<script src="${process.env.NODE_ENV === 'production' ? process.env.NEXT_PUBLIC_API_URL || 'https://yourapi.com' : 'http://localhost:3000'}/api/embed/widget/${apiKey}.js"></script>`}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Just paste this code anywhere in your website's HTML and the chatbot will appear automatically.
              </p>
            </div>
            
            {embedMode && (
              <div className="space-y-3">
                <div>
                  <Label>Allowed Domains (Optional - Leave empty to allow all)</Label>
                  <div className="space-y-2">
                    {allowedDomains.map((domain, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">{domain}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAllowedDomains(prev => prev.filter((_, i) => i !== index))}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        value={newDomain}
                        onChange={e => setNewDomain(e.target.value)}
                        placeholder="example.com or *.example.com"
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (newDomain.trim() && !allowedDomains.includes(newDomain.trim())) {
                            setAllowedDomains(prev => [...prev, newDomain.trim()]);
                            setNewDomain("");
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      setEmbedLoading(true);
                      try {
                        await apiClient.post(`/api/chatbot/${chatbotId}/update-domains`, {
                          allowedDomains
                        });
                        await fetchAll();
                      } catch (err) {
                        setError("Failed to update domains");
                      }
                      setEmbedLoading(false);
                    }}
                    disabled={embedLoading}
                  >
                    {embedLoading ? "Saving..." : "Save Domains"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (confirm("Generate new API key? This will break existing embeds.")) {
                        setEmbedLoading(true);
                        try {
                          await apiClient.post(`/api/chatbot/${chatbotId}/generate-api-key`);
                          await fetchAll();
                        } catch (err) {
                          setError("Failed to generate new API key");
                        }
                        setEmbedLoading(false);
                      }
                    }}
                    disabled={embedLoading}
                  >
                    Regenerate Key
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-gray-600">Generate an API key to embed this chatbot on your website.</p>
            <Button
              size="sm"
              onClick={async () => {
                setEmbedLoading(true);
                try {
                  await apiClient.post(`/api/chatbot/${chatbotId}/generate-api-key`);
                  await fetchAll();
                } catch (err) {
                  setError("Failed to generate API key");
                }
                setEmbedLoading(false);
              }}
              disabled={embedLoading}
            >
              {embedLoading ? "Generating..." : "Generate Embed Code"}
            </Button>
          </div>
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
                  {src.source_type === "website" && src.source_name ? (
                    <a href={src.source_name} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">
                      {src.title || src.source_name}
                    </a>
                  ) : (
                    src.title || src.source_name || src.source_type
                  )}
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
              {src.content && (
                <div className="text-xs text-gray-700 whitespace-pre-line mt-1 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
                  {src.content}
                </div>
              )}

            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}