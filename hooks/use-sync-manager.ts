"use client";

import { useEffect, useState } from "react";

import { syncPendingData } from "@/lib/client-sync";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function useSyncManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();

  useEffect(() => {
    const runSync = async () => {
      setIsSyncing(true);
      try {
        await syncPendingData(createBrowserSupabaseClient());
        setLastSyncedAt(new Date().toISOString());
      } finally {
        setIsSyncing(false);
      }
    };

    void runSync();

    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);
    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
    };
  }, []);

  return {
    isSyncing,
    lastSyncedAt,
    syncNow: async () => {
      setIsSyncing(true);
      try {
        await syncPendingData(createBrowserSupabaseClient());
        setLastSyncedAt(new Date().toISOString());
      } finally {
        setIsSyncing(false);
      }
    }
  };
}

