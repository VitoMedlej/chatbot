"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Check if we have auth tokens in URL (for OAuth redirects)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      if (accessToken) {
        try {
          // Set the session from the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });
          
          if (error) {
            console.error('Error setting session:', error);
            router.replace('/login');          } else if (data.session) {
            // Clean the URL and redirect to dashboard
            window.history.replaceState({}, document.title, window.location.pathname);
            router.replace('/');
          }
        } catch (error) {
          console.error('Auth callback error:', error);
          router.replace('/login');
        }
      }
    };

    // Also handle regular auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {        // User signed in successfully
        const currentPath = window.location.pathname;
        if (currentPath === '/login' || currentPath === '/') {
          router.replace('/');
        }
      } else if (event === 'SIGNED_OUT') {
        // User signed out
        router.replace('/login');
      }
    });

    handleAuthCallback();

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return null; // This component doesn't render anything
}
