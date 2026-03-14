"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const OFFLINE_ACCESS_KEY = "plant-audit-offline-access";

function hasOfflineAccess() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(OFFLINE_ACCESS_KEY) === "true";
}

function grantOfflineAccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(OFFLINE_ACCESS_KEY, "true");
}

function revokeOfflineAccess() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(OFFLINE_ACCESS_KEY);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<"checking" | "allowed" | "blocked">("checking");

  useEffect(() => {
    let mounted = true;
    const supabase = createBrowserSupabaseClient();

    const resolveAccess = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session) {
        grantOfflineAccess();
        setStatus("allowed");
        return;
      }

      if (!navigator.onLine && hasOfflineAccess()) {
        setStatus("allowed");
        return;
      }

      revokeOfflineAccess();
      setStatus("blocked");
      router.replace(`/sign-in?next=${encodeURIComponent(pathname)}`);
    };

    void resolveAccess();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      if (session) {
        grantOfflineAccess();
        setStatus("allowed");
        return;
      }

      if (!navigator.onLine && hasOfflineAccess()) {
        setStatus("allowed");
        return;
      }

      revokeOfflineAccess();
      setStatus("blocked");
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (status !== "allowed") {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <section className="panel w-full p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            Plant Audit
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">
            {status === "checking" ? "Checking access" : "Redirecting to sign-in"}
          </h1>
          <p className="mt-3 text-sm text-slate">
            {status === "checking"
              ? "Restoring your session or local offline access for this device."
              : "A valid session is required for online use. Offline access works only after a prior sign-in on this device."}
          </p>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

export function markOfflineAccessGranted() {
  grantOfflineAccess();
}

