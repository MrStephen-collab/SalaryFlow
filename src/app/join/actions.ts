"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allocateEmployeeNumber } from "@/lib/employee-number";

const BUCKET = "nin-documents";

const inviteSchema = z.object({
  organizationId: z.string().uuid("This registration link is not valid"),
  firstName: z
    .string()
    .min(2, "First name is required")
    .max(100, "First name is too long"),
  lastName: z
    .string()
    .min(2, "Last name is required")
    .max(100, "Last name is too long"),
  otherNames: z.string().max(100).optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address"),
  phone: z.string().min(6, "Enter a valid phone number").max(30),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.enum(["Male", "Female", "Other"]).optional().or(z.literal("")),
  address: z.string().max(255, "Address is too long").optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  lga: z.string().max(100).optional().or(z.literal("")),
  nin: z.string().regex(/^\d{11}$/, "NIN must be 11 digits"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type InviteKind = "employee" | "member";

export type InviteResult = {
  success?: string;
  error?: string;
  email?: string;
  kind?: InviteKind;
  /** True when the account was created but the email address still needs verification. */
  needsEmailVerification?: boolean;
};

function fileExtension(type: string) {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/**
 * Self-registration through a shareable organization invite link. Creates the
 * auth account, links (or creates) the employee/member record and stores the
 * NIN details. The NIN document is uploaded with the service role because the
 * person is not signed in yet.
 */
export async function registerViaInvite(
  formData: FormData
): Promise<InviteResult> {
  try {
    const kind: InviteKind =
      formData.get("kind") === "member" ? "member" : "employee";

    const parsed = inviteSchema.safeParse({
      organizationId: String(formData.get("organizationId") ?? ""),
      firstName: String(formData.get("firstName") ?? "").trim(),
      lastName: String(formData.get("lastName") ?? "").trim(),
      otherNames: String(formData.get("otherNames") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      phone: String(formData.get("phone") ?? "").trim(),
      dateOfBirth: String(formData.get("dateOfBirth") ?? ""),
      gender: String(formData.get("gender") ?? ""),
      address: String(formData.get("address") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim(),
      lga: String(formData.get("lga") ?? "").trim(),
      nin: String(formData.get("nin") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const values = parsed.data;

    const document = formData.get("ninDocument");
    if (!(document instanceof File) || document.size === 0) {
      return { error: "Upload your NIN document" };
    }
    if (document.size > 5 * 1024 * 1024) {
      return { error: "NIN document must be 5MB or smaller" };
    }
    if (
      !document.type.startsWith("image/") &&
      document.type !== "application/pdf"
    ) {
      return { error: "NIN document must be an image or PDF" };
    }

    const admin = createAdminClient();

    const { data: organization } = await admin
      .from("organizations")
      .select("id, name")
      .eq("id", values.organizationId)
      .maybeSingle();

    if (!organization) {
      return { error: "This registration link is not valid" };
    }

    const fullName = `${values.firstName} ${values.lastName}`;

    // Upload the NIN document first.
    const path = `${organization.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}.${fileExtension(document.type)}`;

    const arrayBuffer = await document.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, arrayBuffer, {
        contentType: document.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        error:
          uploadError.message.toLowerCase().includes("bucket")
            ? "Document storage is not set up yet. Please contact your employer."
            : uploadError.message,
      };
    }

    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

    const ninDocumentUrl = signed?.signedUrl ?? null;

    const table = kind === "member" ? "members" : "employees";

    const { data: existing } = await admin
      .from(table)
      .select("id, user_id")
      .eq("organization_id", organization.id)
      .ilike("email", values.email)
      .maybeSingle();

    if (existing?.user_id) {
      return {
        error:
          "An account already exists for this email. Please sign in instead.",
      };
    }

    const supabaseAuth = await createClient();
    const { data: authUser, error: authError } =
      await supabaseAuth.auth.signUp({
        email: values.email,
        password: values.password,
        options: { data: { full_name: fullName } },
      });

    if (authError || !authUser.user) {
      const message = authError?.message ?? "";
      return {
        error: /already|registered|exists/i.test(message)
          ? "An account already exists for this email. Please sign in instead."
          : message || "Could not create your account",
      };
    }

    const userId = authUser.user.id;

    const cleanup = async () => {
      await admin.from(table).delete().eq("user_id", userId);
      await admin.from("user_profiles").delete().eq("user_id", userId);
      await admin.from("users").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      await admin.storage.from(BUCKET).remove([path]).catch(() => undefined);
    };

    const { error: userError } = await admin.from("users").insert({
      id: userId,
      email: values.email,
      full_name: fullName,
      phone: values.phone,
    });
    if (userError) {
      await cleanup();
      return { error: userError.message };
    }

    const { error: profileError } = await admin.from("user_profiles").insert({
      user_id: userId,
      organization_id: organization.id,
      role: kind === "member" ? "MEMBER" : "EMPLOYEE",
    });
    if (profileError) {
      await cleanup();
      return { error: profileError.message };
    }

    if (kind === "member") {
      if (existing) {
        const { error } = await admin
          .from("members")
          .update({
            user_id: userId,
            first_name: values.firstName,
            last_name: values.lastName,
            phone: values.phone,
            address: values.address || null,
            date_of_birth: values.dateOfBirth || null,
            nin: values.nin,
            nin_document_url: ninDocumentUrl,
          })
          .eq("id", existing.id);
        if (error) {
          await cleanup();
          return { error: error.message };
        }
      } else {
        const { count } = await admin
          .from("members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organization.id);

        const memberNumber = `MBR-${String((count ?? 0) + 1).padStart(4, "0")}`;

        const { error } = await admin.from("members").insert({
          organization_id: organization.id,
          user_id: userId,
          member_number: memberNumber,
          first_name: values.firstName,
          last_name: values.lastName,
          email: values.email,
          phone: values.phone,
          address: values.address || null,
          date_of_birth: values.dateOfBirth || null,
          nin: values.nin,
          nin_document_url: ninDocumentUrl,
          status: "ACTIVE",
          kyc_status: "PENDING",
        });
        if (error) {
          await cleanup();
          return { error: error.message };
        }
      }
    } else {
      if (existing) {
        const { error } = await admin
          .from("employees")
          .update({
            user_id: userId,
            first_name: values.firstName,
            last_name: values.lastName,
            other_names: values.otherNames || null,
            phone: values.phone,
            gender: values.gender || null,
            address: values.address || null,
            state: values.state || null,
            lga: values.lga || null,
            date_of_birth: values.dateOfBirth || null,
            nin: values.nin,
            nin_document_url: ninDocumentUrl,
          })
          .eq("id", existing.id);
        if (error) {
          await cleanup();
          return { error: error.message };
        }
      } else {
        const nextNumber = await allocateEmployeeNumber(admin, organization.id);

        let inserted = false;
        for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
          const employeeNumber =
            attempt === 0
              ? nextNumber
              : `${nextNumber}-${Math.floor(1000 + Math.random() * 9000)}`;

          const { error } = await admin.from("employees").insert({
            organization_id: organization.id,
            user_id: userId,
            employee_number: employeeNumber,
            first_name: values.firstName,
            last_name: values.lastName,
            other_names: values.otherNames || null,
            email: values.email,
            phone: values.phone,
            date_of_birth: values.dateOfBirth || null,
            gender: values.gender || null,
            address: values.address || null,
            state: values.state || null,
            lga: values.lga || null,
            nin: values.nin,
            nin_document_url: ninDocumentUrl,
            employment_type: "Full-time",
            employment_status: "Active",
            date_joined: new Date().toISOString().slice(0, 10),
          });

          if (!error) {
            inserted = true;
            break;
          }

          if (error.code !== "23505") {
            await cleanup();
            return { error: error.message };
          }
        }

        if (!inserted) {
          await cleanup();
          return { error: "Could not generate an employee number. Try again." };
        }
      }
    }

    return {
      success: "Account created",
      email: values.email,
      kind,
      needsEmailVerification: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
