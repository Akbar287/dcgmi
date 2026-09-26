// An empty cell must read differently from a low value (docs/06 §4, Delphi matrix).
export function EmptyValue({ srLabel }: { srLabel: string }) {
  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{srLabel}</span>
    </span>
  );
}
