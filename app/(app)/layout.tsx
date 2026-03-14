import { AuthGate } from "@/components/auth-gate";

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
