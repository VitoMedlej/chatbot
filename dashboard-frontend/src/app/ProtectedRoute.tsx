"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // First, handle any auth tokens in the URL (for redirects after login)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          router.replace("/login");
          return;
        }

        if (data.session) {
          setIsAuthenticated(true);
        } else {
          router.replace("/login");
        }
      } catch (error) {
        console.error("Session check error:", error);
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    };

    checkSession();
    
    // Listen for session changes
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setIsAuthenticated(true);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        router.replace("/login");
      } else if (!session) {
        setIsAuthenticated(false);
        router.replace("/login");
      }
    });
    
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }
  
  return <>{children}</>;
}