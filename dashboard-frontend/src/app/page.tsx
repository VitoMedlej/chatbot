"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          router.replace('/login');
          return;
        }
        
        setAuthenticated(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null; // Will redirect to login
  }

  // If authenticated, show a simple dashboard landing page
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Chatbot Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your chatbots and monitor their performance
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Quick Start</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first chatbot and start engaging with customers
          </p>
          <button 
            onClick={() => router.push('/setup')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Chatbot
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">View Chatbots</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Manage and test your existing chatbots
          </p>
          <button 
            onClick={() => router.push('/vault')}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            View Vault
          </button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">Playground</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Test your chatbots in a safe environment
          </p>
          <button 
            onClick={() => router.push('/playground')}
            className="border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Open Playground
          </button>
        </div>
      </div>
    </div>
  );
}
