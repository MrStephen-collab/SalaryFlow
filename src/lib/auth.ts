import { cache as reactCache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const getUser = reactCache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export const getProfile = reactCache(async () => {
  // Read through the admin client: user_profiles is RLS-restricted in a way
  // that shadows the row from the owning user in some cases, so resolve the
  // role with the service role to get a reliable answer.
  const user = await getUser();

  if (!user) return null;

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("*, organizations(name, type)")
    .eq("user_id", user.id)
    .single();

  return profile;
});

export async function requireUser() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user;
}

export async function getOrganization() {
  const supabase = await createClient();

  const user = await getUser();

  if (!user) return null;

  const profile = await getProfile();

  if (!profile?.organization_id) return null;

  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.organization_id)
    .single();

  return data;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("user_profiles")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  return { user, profile };
}