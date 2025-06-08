"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        const res = await fetch(`/api/chatbot/${chatbotId}/sources`);
        const data = await res.json();

        if (data && data.length > 0) {
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
