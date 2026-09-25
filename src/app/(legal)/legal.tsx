import type { ReactNode } from "react";
import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";

// Shared by /privacy and /terms (sprint-11-tasks.md S11-12) — Google Cloud's
// Branding page requires both, on the app's own domain, before the OAuth app
// can be published.

// Also the "User support email" on Google Cloud's Branding page — keep the
// two the same.
export const LEGAL_CONTACT_EMAIL = "techremindy@gmail.com";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[620px] flex-col gap-8 px-6 py-10 md:py-16">
      <Link href="/" className="font-display text-text-primary text-[26px]">
        Reminder
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-text-primary text-[44px] leading-[1.05] font-light">
          {title}
        </h1>
        <p className="text-text-secondary text-xs">
          Last updated {lastUpdated}
        </p>
      </div>
      <div className="flex flex-col gap-7">{children}</div>
      <LegalLinks />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="text-text-primary flex flex-col gap-3 text-[15px] leading-[1.65]">
      <h2 className="text-[17px] font-semibold">{heading}</h2>
      {children}
    </section>
  );
}

export function ContactEmail() {
  return (
    <a
      href={`mailto:${LEGAL_CONTACT_EMAIL}`}
      className="text-burgundy font-semibold"
    >
      {LEGAL_CONTACT_EMAIL}
    </a>
  );
}
