"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth/config";
import { isEmailSignInEnabled } from "@/lib/auth/email-sign-in";

export async function signInWithGoogle(callbackUrl: string) {
  await signIn("google", { redirectTo: callbackUrl });
}

export type EmailSignInState = {
  status: "idle" | "error" | "sent";
  message?: string;
};

const genericEmailError =
  "Couldn't send the sign-in email. Check the address and try again.";

export async function signInWithEmail(
  callbackUrl: string,
  _prevState: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  if (!isEmailSignInEnabled()) {
    return { status: "error", message: "Sign in with Google instead." };
  }
  try {
    // With `redirect: false`, next-auth never throws for a failed email send —
    // it resolves to a URL, and a failure is only visible as an `error` query
    // param on that URL (see next-auth/lib/actions.js `signIn`).
    const result = await signIn("resend", {
      email: formData.get("email"),
      redirect: false,
      redirectTo: callbackUrl,
    });

    if (
      typeof result === "string" &&
      new URL(result).searchParams.has("error")
    ) {
      return { status: "error", message: genericEmailError };
    }

    return { status: "sent" };
  } catch (error) {
    if (error instanceof AuthError) {
      return { status: "error", message: genericEmailError };
    }
    throw error;
  }
}

// `signedOut` keeps /login inside the Telegram Mini App from signing
// straight back in (telegram-login-gate.tsx); a browser ignores it.
export async function signOutAction() {
  await signOut({ redirectTo: "/login?signedOut=1" });
}
