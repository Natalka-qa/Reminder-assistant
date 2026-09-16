import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";

export const verifySession = cache(async () => {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
});

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  timezone: string;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    timezone: session.user.timezone,
  };
});
