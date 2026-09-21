"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithEmail,
  signInWithGoogle,
  type EmailSignInState,
} from "./actions";

const initialState: EmailSignInState = { status: "idle" };

// design_handoff_reminder_assistant/README.md § Login — email is the
// primary path (PrimaryButton "Email me a link"), Google secondary; no "or"
// divider in the mockup, so this drops the one the previous layout had.
export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithEmail.bind(null, callbackUrl),
    initialState,
  );

  if (state.status === "sent") {
    return (
      <p className="text-text-secondary text-[15px]">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="animate-rise-540 flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="px-[18px] py-[17px]"
          />
        </div>
        {state.status === "error" && (
          <p className="text-destructive text-sm">{state.message}</p>
        )}
        <Button
          type="submit"
          disabled={pending}
          className="animate-rise-640 h-[52px] w-full"
        >
          {pending ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      <form action={signInWithGoogle.bind(null, callbackUrl)}>
        <Button
          type="submit"
          variant="secondary"
          className="animate-rise-720 h-[50px] w-full"
        >
          Continue with Google
        </Button>
      </form>
    </div>
  );
}
