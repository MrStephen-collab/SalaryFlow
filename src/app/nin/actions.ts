"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "nin-documents";

export type NinRecordKind = "employee" | "member" | "organization";
export type NinStatus = "PENDING" | "VERIFIED" | "REJECTED";

/**
 * Upload a NIN document (slip/card image or PDF) to the private bucket and
 * return a long-lived signed URL for storage on the owner record.
 */
export async function uploadNinDocument(
  file: File
): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Please sign in to upload a NIN document" };

    if (file.size > 5 * 1024 * 1024) {
      return { error: "NIN document must be 5MB or smaller" };
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return { error: "NIN document must be an image or PDF" };
    }

    const ext =
      file.type === "application/pdf"
        ? "pdf"
        : file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) return { error: uploadError.message };

    // Bucket is private: hand back a long-lived signed URL so admins can open
    // the document without exposing it publicly.
    const { data: signed, error: signError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    if (signError || !signed?.signedUrl) {
      return { error: signError?.message ?? "Could not create a document link" };
    }

    return { url: signed.signedUrl };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Manually mark a submitted NIN as verified or rejected. Only organization
 * owners/admins (and super admins) can verify.
 */
export async function verifyNin(
  kind: NinRecordKind,
  id: string,
  status: Exclude<NinStatus, "PENDING">
): Promise<{ success?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const allowed =
    profile &&
    ["ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "SUPER_ADMIN"].includes(
      profile.role
    );
  if (!allowed) return { error: "You do not have permission to verify NIN" };

  const table =
    kind === "employee"
      ? "employees"
      : kind === "member"
        ? "members"
        : "organizations";

  const admin = createAdminClient();

  let query = admin.from(table).update({ nin_status: status }).eq("id", id);

  if (profile.role !== "SUPER_ADMIN") {
    if (!profile.organization_id) {
      return { error: "No organization associated with this account" };
    }
    if (kind === "organization") {
      if (id !== profile.organization_id) {
        return { error: "You can only verify your own organization" };
      }
    } else {
      query = query.eq("organization_id", profile.organization_id);
    }
  }

  const { error } = await query;

  if (error) return { error: error.message };

  return { success: `NIN ${status.toLowerCase()}` };
}
