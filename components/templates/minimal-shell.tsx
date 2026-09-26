import type { ReactNode } from "react";

// Shell without the simulation sidebar or banner: used where no SIMULATED
// context exists (the human expert area).
export function MinimalShell({ brand, actions, children }: { brand: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="flex h-14 items-center gap-3 border-b px-4">
        {brand}
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">{children}</main>
    </div>
  );
}
