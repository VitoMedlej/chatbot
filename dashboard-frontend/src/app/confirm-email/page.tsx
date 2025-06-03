"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ConfirmEmailPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const pendingEmail = localStorage.getItem("pending_email");
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        localStorage.removeItem("pending_email");
        router.replace("/dashboard");
        return;
      }
      if (!pendingEmail) {
        router.replace("/signup");
        return;
      }
      setEmail(pendingEmail);
    };
    check();
  }, [router]);

  const handleResend = async () => {
    setError(null);
    setResent(false);
    if (!email) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      setError(error.message);
    } else {
      setResent(true);
    }
  };

  if (!email) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded shadow max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4">Confirm your email</h1>
        <p className="mb-6">
          We’ve sent a confirmation link to{" "}
          <span className="font-semibold">{email}</span>
          .<br />
          Please check your inbox and confirm your account before logging in.
        </p>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded mb-2"
          onClick={handleResend}
          disabled={resent}
        >
          {resent ? "Confirmation Email Sent" : "Resend Confirmation Email"}
        </button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
        <div className="mt-6 text-sm text-gray-500">
          Already confirmed?{" "}
          <button
            className="text-blue-600 underline"
            onClick={async () => {
              const { data } = await supabase.auth.getSession();
              if (data.session) {
                localStorage.removeItem("pending_email");
                router.replace("/dashboard");
              } else {
                router.replace("/signin");
              }
            }}
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}