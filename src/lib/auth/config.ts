import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { toSessionPayload } from "@/lib/auth/session-payload";
import {
  GOOGLE_CALENDAR_FREEBUSY_SCOPE,
  GOOGLE_CALENDAR_PROVIDER_ID,
  isGoogleCalendarEnabled,
} from "@/lib/google-calendar/google-calendar.config";

// Not a sign-in method: the Settings page's "Connect Google Calendar"
// (sprint-11-tasks.md S11-02). A separate provider rather than extra scopes
// on "google", because Auth.js never updates an already-linked account's
// tokens — a fresh refresh_token only lands with a new Account row
// ("Расхождения" п.3). access_type=offline + prompt=consent make Google
// return a refresh_token on every connect, not only the first.
const googleCalendarProvider = Google({
  id: GOOGLE_CALENDAR_PROVIDER_ID,
  name: "Google Calendar",
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  authorization: {
    params: {
      scope: `openid email profile ${GOOGLE_CALENDAR_FREEBUSY_SCOPE}`,
      access_type: "offline",
      prompt: "consent",
    },
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  secret: env.AUTH_SECRET,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
    }),
    ...(isGoogleCalendarEnabled() ? [googleCalendarProvider] : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // The calendar provider only links to whoever is already signed in.
    // Without a session Auth.js would otherwise treat it as a sign-in:
    // log in whoever connected that Google account, or create a new user
    // for an unknown email (handle-login.js).
    async signIn({ account }) {
      if (account?.provider === GOOGLE_CALENDAR_PROVIDER_ID) {
        const session = await auth();
        return Boolean(session?.user);
      }
      return true;
    },
    // Never return `session` itself — see toSessionPayload.
    session({ session, user }) {
      return toSessionPayload(session.expires, user);
    },
  },
});
