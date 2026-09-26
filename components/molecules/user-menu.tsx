"use client";

import { Logout01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { RoleBadge } from "@/components/atoms/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Role } from "@/lib/auth/roles";
import { useT } from "@/lib/i18n/client";

function initials(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({
  name,
  email,
  image,
  role,
  onSignOut,
}: {
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  onSignOut: () => Promise<void>;
}) {
  const t = useT();
  const display = name ?? email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="sm" className="gap-2 px-1.5" aria-label={`${t("auth.signedInAs")} ${display}`} />}
      >
        <Avatar className="size-7">
          {image ? <AvatarImage src={image} alt="" /> : null}
          <AvatarFallback className="text-xs">{initials(display)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-32 truncate text-sm lg:inline">{display}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">{t("auth.signedInAs")}</span>
            <span className="truncate font-medium text-foreground">{display}</span>
            {name ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
            <RoleBadge role={role} label={t(`roles.${role}`)} />
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <form action={onSignOut} className="p-1">
          <Button type="submit" variant="ghost" size="sm" className="w-full justify-start">
            <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
            {t("auth.signOut")}
          </Button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
