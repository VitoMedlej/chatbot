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
    const checkKnowledge = async () => {
      try {
        const response = await apiClient.get(`/api/chatbot/${chatbotId}/sources`);
        const data = (response as { data: any }).data;

        console.log('data: ', data);
        if (data && data?.success && data?.responseObject) {
          setHasKnowledge(true);
        } else {
          setHasKnowledge(false);
          router.replace(`/vault/${chatbotId}`); // Redirect to add information source
        }
      } catch (error) {
        console.error("Error checking knowledge sources:", error);
        setHasKnowledge(false);
        router.replace(`/vault/${chatbotId}`);
      } finally {
        setLoading(false);
      }
    };

    checkKnowledge();
  }, [chatbotId, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!hasKnowledge) {
    return null; // Redirecting, so no need to render anything
  }

  return <></>; // Render nothing if knowledge exists
}
