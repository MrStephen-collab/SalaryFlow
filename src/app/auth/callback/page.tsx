"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.getSession();

      if (error) {
        router.push("/auth/login?error=Unable to authenticate");
        return;
      }

      const redirect = new URLSearchParams(window.location.search).get(
        "redirect"
      );
      if (redirect) {
        router.push(redirect);
      } else {
        router.push("/dashboard");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Completing authentication...
        </p>
      </div>
    </div>
  );
}
