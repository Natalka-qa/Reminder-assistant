import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage, LegalSection } from "../legal";

export const metadata: Metadata = { title: "Terms of Service — Reminder" };

// Draft for the owner's review (sprint-11-tasks.md S11-12).
export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="September 25, 2026">
      <p className="text-text-primary text-[15px] leading-[1.65]">
        These terms apply when you use Reminder, a personal scheduling
        assistant. By signing in you agree to them. Questions: <ContactEmail />.
      </p>

      <LegalSection heading="The service">
        <p>
          Reminder lets you keep tasks, get reminders by email or Telegram, and
          — if you connect it — check new tasks against the busy times in your
          Google Calendar. It is free, and provided as is.
        </p>
      </LegalSection>

      <LegalSection heading="Reminders are best-effort">
        <p>
          We try to send every reminder on time, but delivery depends on email
          and Telegram and can be late or fail. Don&apos;t rely on Reminder as
          the only way to remember something where missing it would cause
          serious harm.
        </p>
      </LegalSection>

      <LegalSection heading="Your account and your content">
        <p>
          You are responsible for what happens under your account. What you add
          is yours; you allow us to store and process it only to run the service
          for you, as described in the{" "}
          <Link href="/privacy" className="text-burgundy font-semibold">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Don&apos;t use Reminder for anything unlawful, don&apos;t try to get
          into other people&apos;s accounts or data, and don&apos;t try to
          disrupt the service. We may suspend accounts that do.
        </p>
      </LegalSection>

      <LegalSection heading="Other services">
        <p>
          Signing in with Google, connecting Google Calendar, and connecting
          Telegram are subject to those services&apos; own terms as well.
        </p>
      </LegalSection>

      <LegalSection heading="Ending">
        <p>
          You can stop using Reminder at any time and ask us to delete your
          account (see the Privacy Policy). We may change or discontinue the
          service; where we can, we&apos;ll give notice first.
        </p>
      </LegalSection>

      <LegalSection heading="No warranty, limited liability">
        <p>
          Reminder is provided without warranties of any kind. To the extent the
          law allows, we are not liable for missed reminders, lost data, or any
          indirect or consequential loss arising from using it.
        </p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If these terms change, we update this page and the date at the top.
          Continuing to use Reminder after that means you accept the new terms.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
