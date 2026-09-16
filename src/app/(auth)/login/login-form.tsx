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

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithEmail.bind(null, callbackUrl),
    initialState,
  );

  if (state.status === "sent") {
    return (
      <p className="text-muted-foreground text-sm">
        Check your email for a sign-in link.
      </p>
    );
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <form action={signInWithGoogle.bind(null, callbackUrl)}>
        <Button type="submit" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <div className="bg-border h-px flex-1" />
        or
        <div className="bg-border h-px flex-1" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
          />
        </div>
        {state.status === "error" && (
          <p className="text-destructive text-sm">{state.message}</p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Continue with email"}
        </Button>
      </form>
    </div>
  );
}
