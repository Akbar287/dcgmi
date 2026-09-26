"use client";

import { DashboardSquare01Icon, TestTube01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { NavModuleItem } from "@/components/molecules/nav-module-item";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useT } from "@/lib/i18n/client";
import { moduleHref, NAV_MODULES } from "@/lib/navigation";

export function AppSidebar() {
  const t = useT();
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-simulated text-simulated-foreground">
                <HugeiconsIcon icon={TestTube01Icon} strokeWidth={2} aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold">{t("app.shortName")}</span>
                <span className="truncate text-xs text-muted-foreground">{t("app.tagline")}</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={t("nav.dashboard")}
                isActive={pathname === "/"}
                aria-current={pathname === "/" ? "page" : undefined}
                render={<Link href="/" />}
              >
                <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} aria-hidden="true" />
                <span>{t("nav.dashboard")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {NAV_MODULES.map((m) => {
              const base = moduleHref(m.key);
              return (
                <NavModuleItem
                  key={m.key}
                  label={t(`nav.modules.${m.key}`)}
                  icon={m.icon}
                  active={pathname === base || pathname.startsWith(`${base}/`)}
                  sections={m.sections.map((slug) => {
                    const href = moduleHref(m.key, slug);
                    return {
                      href,
                      label: t.maybe(`nav.sections.${m.key}.${slug}`) ?? slug,
                      active: pathname === href,
                    };
                  })}
                />
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
