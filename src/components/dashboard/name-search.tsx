"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Filter a list page by a person's name or number. Writes a `q` query param
 * and keeps every other filter (status, method, page) intact.
 */
export function NameSearch({
  placeholder = "Search by name or number…",
  param = "q",
  className,
}: {
  placeholder?: string;
  param?: string;
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";
  const [value, setValue] = useState(current);

  function apply(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) {
      params.set(param, trimmed);
    } else {
      params.delete(param);
    }
    const query = params.toString();
    router.push(`${window.location.pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        apply(value);
      }}
      className={cn("flex w-full max-w-sm items-center gap-2", className)}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-8"
        />
        {current ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              apply("");
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <Button type="submit" variant="outline" size="sm">
        Search
      </Button>
    </form>
  );
}
