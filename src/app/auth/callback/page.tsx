"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SalaryFlowLoader } from "@/components/brand/salaryflow-loader";

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

  return <SalaryFlowLoader status="Securing your session..." />;
}
