import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const AVATAR_BUCKET = "avatars";
export const AVATAR_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`;

export class ProfileService {
  private supabase: Awaited<ReturnType<typeof createClient>>;
  private userId: string | null = null;
  private employeeId: string | null = null;

  private constructor(supabase: Awaited<ReturnType<typeof createClient>>) {
    this.supabase = supabase;
  }

  static async create() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const service = new ProfileService(supabase);
    service.userId = user?.id ?? null;

    if (user) {
      const { data: employee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      service.employeeId = employee?.id ?? null;
    }

    return service;
  }

  getUserId() {
    return this.userId;
  }
  getEmployeeId() {
    return this.employeeId;
  }

  // ================= PASSWORD =================

  async changePassword(currentPassword: string, newPassword: string) {
    if (!this.userId) return { error: "Not authenticated" };

    if (newPassword.length < 8) {
      return { error: "New password must be at least 8 characters" };
    }

    // Verify the current password by re-authenticating the user.
    const { data: curUser } = await this.supabase.auth.getUser();
    if (!curUser.user?.email) return { error: "Not authenticated" };

    const { error: signInError } = await this.supabase.auth.signInWithPassword({
      email: curUser.user.email,
      password: currentPassword,
    });
    if (signInError) return { error: "Current password is incorrect" };

    const { error } = await this.supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) return { error: error.message };

    return { success: "Password updated" };
  }

  // ================= AVATAR =================

  async uploadAvatar(file: File) {
    if (!this.userId) return { error: "Not authenticated" };

    if (file.size > 2 * 1024 * 1024) {
      return { error: "Avatar must be 2MB or smaller" };
    }
    if (!file.type.startsWith("image/")) {
      return { error: "Avatar must be an image" };
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${this.userId}/${Date.now()}.${ext}`;

    const admin = createAdminClient();
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(path, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });
    if (uploadError) {
      return { error: uploadError.message };
    }

    // Remove the previous avatar if it exists.
    const { data: curMeta } = await this.supabase.auth.getUser();
    const prevUrl: string | null =
      curMeta.user?.user_metadata?.avatar_url ?? null;
    if (prevUrl && prevUrl.startsWith(AVATAR_URL)) {
      const oldPath = prevUrl.slice(AVATAR_URL.length);
      await admin.storage.from(AVATAR_BUCKET).remove([oldPath]);
    }

    const avatarUrl = `${AVATAR_URL}${path}`;

    await this.supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });
    await this.supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", this.userId);

    return { success: "Avatar updated", url: avatarUrl };
  }

  // ================= WITHDRAWAL PIN =================

  private hashPin(pin: string, salt = randomBytes(16).toString("hex")) {
    const hash = scryptSync(pin, salt, 64).toString("hex");
    return `${salt}:${hash}`;
  }

  private verifyPin(pin: string, stored: string) {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const candidate = scryptSync(pin, salt, 64);
    const storedHash = Buffer.from(hash, "hex");
    return candidate.length === storedHash.length && timingSafeEqual(candidate, storedHash);
  }

  async getWithdrawalPinHash(userId = this.userId) {
    if (!userId) return null;
    const { data } = await this.supabase.auth.admin.getUserById(userId);
    return data.user?.user_metadata?.withdrawal_pin_hash ?? null;
  }

  private async setWithdrawalPinHash(hash: string) {
    const { data: user } = await this.supabase.auth.getUser();
    const meta = user.user?.user_metadata ?? {};
    const { error } = await this.supabase.auth.updateUser({
      data: { ...meta, withdrawal_pin_hash: hash },
    });
    if (error) throw new Error(error.message);
  }

  async setWithdrawalPin(pin: string, currentPin?: string) {
    if (!this.userId) return { error: "Not authenticated" };
    if (!/^\d{4}$/.test(pin)) {
      return { error: "PIN must be exactly 4 digits" };
    }

    const existingHash = await this.getWithdrawalPinHash();
    if (existingHash) {
      if (!currentPin) return { error: "Enter your current PIN to change it" };
      if (!this.verifyPin(currentPin, existingHash)) {
        return { error: "Current PIN is incorrect" };
      }
    }

    await this.setWithdrawalPinHash(this.hashPin(pin));
    return { success: "Withdrawal PIN saved" };
  }

  async verifyWithdrawalPin(pin: string) {
    if (!this.userId) return { error: "Not authenticated" };
    const existingHash = await this.getWithdrawalPinHash();
    if (!existingHash) {
      return { error: "No PIN set. Set a withdrawal PIN in your profile first." };
    }
    if (!this.verifyPin(pin, existingHash)) {
      return { error: "Incorrect PIN" };
    }
    return { success: true };
  }

  async hasWithdrawalPin() {
    const hash = await this.getWithdrawalPinHash();
    return Boolean(hash);
  }
}
