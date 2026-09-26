import { Badge } from "@/components/ui/badge";

// R1-V1.7 §3.10.3: composite categories are not calibrated; the label is fixed text.
export function ProvisionalLabel() {
  return (
    <Badge variant="outline" className="font-mono tracking-wide text-muted-foreground">
      PROVISIONAL
    </Badge>
  );
}
