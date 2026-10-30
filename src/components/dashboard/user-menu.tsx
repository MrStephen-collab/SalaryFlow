"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, LogOut, Settings, UserCircle2 } from "lucide-react";

export function UserMenu({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initials = (name ?? email ?? "U").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              <AvatarImage src={avatarUrl ?? ""} alt={name ?? email ?? ""} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {name}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
          <UserCircle2 className="size-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard/settings")}>
          <Settings className="size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard/notifications")}>
          <Bell className="size-4" />
          Notifications
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={isPending}
          onClick={() => startTransition(() => signOut())}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
