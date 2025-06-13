"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/apiClient";

interface KnowledgeCheckProps {
  chatbotId: string;
}

export default function KnowledgeCheck({ chatbotId }: KnowledgeCheckProps) {
  const [loading, setLoading] = useState(true);
  const [hasKnowledge, setHasKnowledge] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const checkKnowledge = async () => {
      try {
        const response = await apiClient.get<any>(`/api/chatbot/${chatbotId}/sources`);
        let sources: any[] = [];
        if (response && Array.isArray(response.responseObject)) {
          sources = response.responseObject;
        } else if (response && response.data && Array.isArray(response.data.responseObject)) {
          sources = response.data.responseObject;
        } else if (Array.isArray(response)) {
          sources = response;
        }
        if (isMounted) {
          setHasKnowledge(Array.isArray(sources) && sources.length > 0);
          setLoading(false);
          if (!Array.isArray(sources) || sources.length === 0) {
            router.replace(`/vault/${chatbotId}`);
          }
        }
      } catch {
        if (isMounted) {
          setHasKnowledge(false);
          setLoading(false);
          router.replace(`/vault/${chatbotId}`);
        }
      }
    };
    checkKnowledge();
    return () => { isMounted = false; };
  }, [chatbotId, router]);

  if (loading) return <div>Loading...</div>;
  if (!hasKnowledge) return null;
  return null;
}
