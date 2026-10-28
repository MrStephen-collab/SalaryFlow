"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/schemas/auth";

export type ActionResult = {
  error?: string;
  success?: string;
};

export async function login(values: unknown): Promise<ActionResult> {
  try {
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return {
        error:
          error.message === "Invalid login credentials"
            ? "Incorrect email or password"
            : error.message,
      };
    }

    if (!data.user) {
      return { error: "Unable to sign you in" };
    }

    const adminClient = createAdminClient();
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("role, organization_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (profile?.role === "SUPER_ADMIN") {
      redirect("/super-admin");
    }

    if (profile?.role === "EMPLOYEE") {
      redirect("/employee");
    }

    if (profile?.organization_id) {
      redirect("/dashboard");
    }

    redirect("/onboarding");
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function register(values: unknown): Promise<ActionResult> {
  try {
    const parsed = registerSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.[0] as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
        },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return { error: "An account with this email already exists" };
      }
      return { error: error.message };
    }

    if (!data.user) {
      return { success: "Check your email to confirm your account" };
    }

    // Create the users record
    const adminClient = createAdminClient();
    const { error: userError } = await adminClient.from("users").insert({
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
    });

    if (userError) {
      return { error: "Unable to complete account setup" };
    }

    // Create default employee user profile (no organization yet)
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .insert({
        user_id: data.user.id,
        role: "EMPLOYEE",
      });

    if (profileError) {
      return { error: "Unable to complete account setup" };
    }

    redirect("/onboarding");
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}

export async function forgotPassword(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = forgotPasswordSchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/reset-password`,
      }
    );

    if (error) {
      return { error: "Unable to send reset link. Please try again." };
    }

    return {
      success:
        "If an account exists with that email, a reset link has been sent.",
    };
  } catch {
    return { error: "An unexpected error occurred" };
  }
}

export async function resetPassword(
  values: unknown
): Promise<ActionResult> {
  try {
    const parsed = resetPasswordSchema.safeParse(values);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const field = firstIssue?.path?.[0] as string | undefined;
      return {
        error: field ? `${field}: ${firstIssue?.message}` : "Invalid input",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      return { error: "Unable to reset password. Please try again." };
    }

    redirect("/auth/login?reset=success");
  } catch (err) {
    if (err instanceof Error && "digest" in err) {
      throw err;
    }
    return { error: "An unexpected error occurred" };
  }
}
