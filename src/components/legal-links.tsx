import Link from "next/link";
import { cn } from "@/lib/utils";

// Footer row on /, /login and the legal pages themselves — Google's OAuth
// Branding expects the privacy policy to be reachable from the home page
// (sprint-11-tasks.md S11-12).
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={cn("text-text-secondary flex gap-4 text-xs", className)}>
      <Link href="/privacy" className="hover:text-text-primary">
        Privacy Policy
      </Link>
      <Link href="/terms" className="hover:text-text-primary">
        Terms of Service
      </Link>
    </nav>
  );
}
