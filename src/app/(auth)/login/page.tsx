import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { LoginForm } from "./login-form";

// design_handoff_reminder_assistant/README.md § Login. The one screen with a
// choreographed entrance (see globals.css's --animate-veil-in/wipe-in/
// rise-*/sparkle-breathe and the reduced-motion override next to them).
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const destination =
    typeof callbackUrl === "string" ? callbackUrl : "/dashboard";

  if (session?.user) {
    redirect(destination);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="flex w-full max-w-[380px] flex-col gap-[26px] pt-[18px]">
        {/* Hero asset not supplied yet (README § Assets: "Login hero — not
            yet supplied... Placeholder slot in the prototype") — a plain
            bordered block, not a fabricated illustration. */}
        <div
          aria-hidden
          className="bg-border-soft border-border animate-veil-in h-[230px] rounded-[20px] border"
        />

        <div className="flex flex-col gap-3">
          <span
            aria-hidden
            className="text-rose-gold animate-sparkle-breathe text-[14px]"
          >
            &#10022;
          </span>
          <h1 className="font-display animate-wipe-in text-[54px] leading-[1.05] font-light">
            A calmer way to remember.
          </h1>
          <p className="text-text-secondary animate-rise-420 text-[15px] leading-[1.65]">
            Sign in with a link — no password to keep.
          </p>
        </div>

        <LoginForm callbackUrl={destination} />

        <p className="text-text-secondary animate-rise-820 text-xs leading-[1.6]">
          We&apos;ll only use your email to send you a sign-in link.
        </p>
      </div>
    </div>
  );
}
