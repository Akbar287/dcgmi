"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react";
import Link from "next/link";
import { useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export interface NavSectionLink {
  href: string;
  label: string;
  active: boolean;
}

export function NavModuleItem({
  label,
  icon,
  active,
  sections,
}: {
  label: string;
  icon: HugeiconsIconProps["icon"];
  active: boolean;
  sections: NavSectionLink[];
}) {
  // Controlled: `active` changes on client navigation, and Base UI warns when an
  // uncontrolled Collapsible's defaultOpen changes after mount. Navigating into
  // a module opens it; the user can still collapse it manually.
  const [open, setOpen] = useState(active);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setOpen(true);
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} render={<SidebarMenuItem />} className="group/collapsible">
      <CollapsibleTrigger render={<SidebarMenuButton tooltip={label} isActive={active} />}>
        <HugeiconsIcon icon={icon} strokeWidth={2} aria-hidden="true" />
        <span>{label}</span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          aria-hidden="true"
          className="ml-auto transition-transform duration-200 group-data-[open]/collapsible:rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenuSub>
          {sections.map((s) => (
            <SidebarMenuSubItem key={s.href}>
              <SidebarMenuSubButton
                isActive={s.active}
                aria-current={s.active ? "page" : undefined}
                render={<Link href={s.href} />}
              >
                <span>{s.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  );
}
