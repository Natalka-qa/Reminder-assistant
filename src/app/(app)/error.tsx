"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-muted-foreground text-sm">Something went wrong.</p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}
