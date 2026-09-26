import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";

export function GoogleSignInButton({
  label,
  callbackUrl,
  action,
}: {
  label: string;
  callbackUrl: string;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <Button type="submit" variant="outline" className="w-full">
        <HugeiconsIcon icon={GoogleIcon} strokeWidth={2} aria-hidden="true" data-icon="inline-start" />
        {label}
      </Button>
    </form>
  );
}
