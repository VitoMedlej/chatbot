// Place this in a top-level client component, e.g. src/app/layout.tsx or a custom AuthProvider
"use client";
import { useEffect } from "react";

export default function AuthCleanup() {
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      // Optionally: parse and use the token here if you want to store it somewhere
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    }
  }, []);
  return null;
}