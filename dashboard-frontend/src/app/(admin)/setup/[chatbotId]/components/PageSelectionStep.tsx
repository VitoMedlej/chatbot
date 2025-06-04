"use client";
import { useState } from "react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";

interface PageSelectionStepProps {
  website: string;
  setWebsite: (v: string) => void;
  manualLinks: string;
  setManualLinks: (v: string) => void;
  allPages: string[];
  setAllPages: (v: string[]) => void;
  selectedPages: string[];
  setSelectedPages: (v: string[]) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  error: string | null;
  setError: (v: string | null) => void;
  handleFetchLinks: (e: React.FormEvent) => Promise<void>;
  handlePageToggle: (url: string) => void;
  handleCrawlSelected: () => Promise<void>;
  handleIngestManualLinks: () => Promise<void>;
}

export default function PageSelectionStep({
  website,
  setWebsite,
  manualLinks,
  setManualLinks,
  allPages,
  setAllPages,
  selectedPages,
  setSelectedPages,
  loading,
  setLoading,
  error,
  setError,
  handleFetchLinks,
  handlePageToggle,
  handleCrawlSelected,
  handleIngestManualLinks,
}: PageSelectionStepProps) {
  const cleanPages = allPages.filter((url) => !url.includes("#"));

  return (
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
        <div>
          <Label>Or paste links (one per line)</Label>
          <textarea
            className="w-full border rounded p-2 text-sm"
            rows={4}
            value={manualLinks}
            onChange={e => setManualLinks(e.target.value)}
            placeholder="https://example.com/page1\nhttps://example.com/page2"
          />
        </div>
        {error && <div className="text-red-500">{error}</div>}
        <Button className="w-full" type="submit" size="sm" disabled={loading}>
          {loading ? "Fetching Links..." : "Fetch Pages"}
        </Button>
      </form>
      {cleanPages.length > 0 && (
        <div className="mt-6">
          <Label>Select pages to include</Label>
          <div className="max-h-64 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900">
            {cleanPages.map((url, i) => (
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
      <Button
        className="w-full mt-2"
        type="button"
        size="sm"
        onClick={handleIngestManualLinks}
      >
        Ingest Manual Links
      </Button>
    </>
  );
}