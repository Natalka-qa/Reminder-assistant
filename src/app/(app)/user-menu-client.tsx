"use client";

import { LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/(auth)/login/actions";

export function UserMenuClient({
  email,
  name,
}: {
  email: string;
  name: string | null;
}) {
  const initial = (name ?? email).charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="bg-primary text-primary-foreground focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full text-sm font-medium outline-none focus-visible:ring-3">
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              {name && (
                <span className="text-foreground font-medium">{name}</span>
              )}
              <span className="text-muted-foreground truncate">{email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOutAction()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
