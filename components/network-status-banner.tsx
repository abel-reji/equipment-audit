"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-ember px-4 py-3 text-sm font-semibold text-white">
      <WifiOff className="h-4 w-4" />
      Offline mode: drafts will stay on this device until sync is available.
    </div>
  );
}

