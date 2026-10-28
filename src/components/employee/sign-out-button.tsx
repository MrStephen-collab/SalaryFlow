"use client";

import { useTransition } from "react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPending}
      onClick={() => startTransition(() => signOut())}
      aria-label="Sign out"
      className="text-muted-foreground hover:text-foreground"
    >
      <LogOut />
    </Button>
  );
}
