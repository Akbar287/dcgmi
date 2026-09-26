import type { ReactNode } from "react";

import { AppSidebar } from "@/components/organisms/app-sidebar";
import { SimulationBanner } from "@/components/organisms/simulation-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({
  topbar,
  sidebarOpen,
  children,
}: {
  topbar: ReactNode;
  sidebarOpen: boolean;
  children: ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          {topbar}
          {/* The console only produces SIMULATED data; REAL data enters through a
              separate intake (docs/07 P3), so the banner is unconditional here. */}
          <SimulationBanner />
          <div id="main" className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
