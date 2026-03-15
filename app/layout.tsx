import type { Metadata } from "next";

import "@/app/globals.css";
import { NetworkStatusBanner } from "@/components/network-status-banner";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "Rotating Equipment Audit",
  description: "Mobile-first rotating equipment audit workflow.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegistration />
        <NetworkStatusBanner />
        {children}
      </body>
    </html>
  );
}
