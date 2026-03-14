"use client";

import { Mail } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { markOfflineAccessGranted } from "@/components/auth-gate";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { signInSchema } from "@/lib/validation";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        markOfflineAccessGranted();
        router.replace(searchParams.get("next") || "/home");
      }
    });
  }, [router, searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = signInSchema.safeParse({
      email
    });

    if (!result.success) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("sending");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: result.data.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for a magic link.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
      <section className="panel w-full overflow-hidden">
        <div className="bg-grid bg-[size:26px_26px] px-6 py-8 md:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
            Plant Audit
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink">
            Capture equipment before the signal comes back.
          </h1>
          <p className="mt-4 text-sm text-slate">
            Sign in with a magic link, then use the app on your phone or iPad to
            capture assets, queue photos, and sync once the network is reliable.
          </p>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5 px-6 py-8 md:px-8">
          <div>
            <label className="label" htmlFor="email">
              Work Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <button className="button-primary w-full" type="submit" disabled={status === "sending"}>
            <Mail className="mr-2 h-4 w-4" />
            {status === "sending" ? "Sending link..." : "Email me a sign-in link"}
          </button>

          {message ? (
            <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{message}</p>
          ) : null}

          <p className="text-xs text-slate">
            After your first successful login, this device can reopen the app offline for local draft work.
          </p>
        </form>
      </section>
    </main>
  );
}
