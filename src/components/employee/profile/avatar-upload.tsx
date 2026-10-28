"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadAvatar } from "@/app/employee/profile/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2 } from "lucide-react";

export function AvatarUpload({
  url,
  name,
  email,
}: {
  url?: string | null;
  name: string;
  email?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initials = name.trim() ? name.trim().slice(0, 2).toUpperCase() : (email ?? "U").slice(0, 2).toUpperCase();
  const display = preview ?? url ?? "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Avatar must be 2MB or smaller");
    setPreview(URL.createObjectURL(file));
    startTransition(async () => {
      const result = await uploadAvatar(file);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success ?? "Avatar updated");
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <Avatar className="size-24">
          <AvatarImage src={display} alt={name} />
          <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border bg-background text-foreground shadow-sm transition-colors hover:bg-accent disabled:opacity-60"
          aria-label="Upload avatar"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleChange}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isPending ? "Uploading..." : "Click the camera to change your photo"}
      </p>
    </div>
  );
}