"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AccountStatus = "trial" | "active" | "inactive" | "expired" | "unknown";

export default function AccountPage() {
  const [status, setStatus] = useState<AccountStatus>("unknown");
  const [trialEnds, setTrialEnds] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/signin");
        return;
      }
      // TODO: Replace with your own logic to fetch account status from your DB
      // Example: fetch from /api/account-status or Supabase table
      // Simulate with dummy data for now:
      setStatus("trial");
      setTrialEnds("2025-07-01");
      setLoading(false);
    };
    fetchStatus();
  }, [router]);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <div className="max-w-lg mx-auto mt-20 p-8 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Account Status</h1>
      <div className="mb-4">
        <span className="font-semibold">Status:</span>{" "}
        <span className="capitalize">{status}</span>
      </div>
      {status === "trial" && (
        <div className="mb-4">
          <span className="font-semibold">Trial ends:</span> {trialEnds}
        </div>
      )}
      {status === "inactive" || status === "expired" ? (
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          // TODO: Link to your payment/checkout page
          onClick={() => router.push("/payment")}
        >
          Activate Account
        </button>
      ) : status === "trial" ? (
        <div className="text-green-600">Your trial is active.</div>
      ) : status === "active" ? (
        <div className="text-green-600">Your account is active and paid.</div>
      ) : null}
    </div>
  );
}