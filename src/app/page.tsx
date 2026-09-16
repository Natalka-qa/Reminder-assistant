import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Reminder</h1>
      <p className="text-muted-foreground max-w-md">
        Your personal scheduling assistant.
      </p>
      <Button size="lg" nativeButton={false} render={<Link href="/login" />}>
        Sign in
      </Button>
    </div>
  );
}
