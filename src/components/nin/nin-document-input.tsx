"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { uploadNinDocument } from "@/app/nin/actions";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

/**
 * NIN document picker. Uploads to the public bucket and reports the URL back
 * through `onChange`. The parent stores the URL alongside the NIN number.
 */
export function NinDocumentInput({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      const result = await uploadNinDocument(file);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("NIN document uploaded");
      onChange(result.url ?? null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {value ? "Replace document" : "Upload NIN document"}
      </Button>
      {value ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="size-3.5" />
          Document uploaded
        </span>
      ) : null}
    </div>
  );
}
