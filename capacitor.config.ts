import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.abelreji.rotatingequipmentaudit",
  appName: "Rotating Equipment Audit",
  webDir: "public",
  server: {
    url: "https://equipment-audit.vercel.app",
    cleartext: false
  }
};

export default config;
