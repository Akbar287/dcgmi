import { cn } from "@/lib/utils";

export function CodeText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code className={cn("rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground", className)}>
      {children}
    </code>
  );
}
