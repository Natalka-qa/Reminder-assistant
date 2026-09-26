import type { Metadata } from "next";
import { ContactEmail, LegalPage, LegalSection } from "../legal";

export const metadata: Metadata = { title: "Privacy Policy — Reminder" };

// Draft for the owner's review (sprint-11-tasks.md S11-12). Keep it in step
// with what the code actually stores and sends — every claim here is checked
// against the schema and the outbound calls, not aspirational.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="September 25, 2026">
      <p className="text-text-primary text-[15px] leading-[1.65]">
        Reminder is a personal scheduling assistant: you keep your tasks and
        reminders in it, and it reminds you about them. This page explains what
        we store, what we use it for and who else is involved. Questions:{" "}
        <ContactEmail />.
      </p>

      <LegalSection heading="What we store">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Your account</strong> — your email address, and if you sign
            in with Google, your name and profile picture from your Google
            account.
          </li>
          <li>
            <strong>What you add</strong> — your tasks (title, description,
            date, time, duration, priority, flexibility, repeat rule), their
            history (done, skipped, snoozed), your reminder settings and time
            zone.
          </li>
          <li>
            <strong>Reminders</strong> — when each reminder is due and whether
            it was sent.
          </li>
          <li>
            <strong>Telegram</strong>, only if you connect it — the ID of your
            chat with our bot, so reminders can be sent there.
          </li>
          <li>
            <strong>Google Calendar</strong>, only if you connect it — the
            access tokens Google gives us for that connection. See below for
            what they allow.
          </li>
        </ul>
        <p>
          We use cookies only to keep you signed in. There are no analytics,
          advertising or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="Google Calendar">
        <p>
          If you connect Google Calendar on the Settings page, we ask Google for
          one permission: to see when you are busy in your primary calendar (the{" "}
          <code>calendar.freebusy</code> scope). That permission returns busy
          time ranges only — never event titles, descriptions, locations or
          attendees, which we never request.
        </p>
        <p>
          When you create or edit a task, we ask Google when you are busy around
          that time (a day either side), so we can warn you about an overlap
          before you save. The busy times are used for that check and then
          discarded; they are not stored.
        </p>
        <p>
          Reminder&apos;s use and transfer of information received from Google
          APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            className="text-burgundy font-semibold"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Data from Google is not used
          for advertising, not sold, not shared with anyone else, and not used
          to train AI models.
        </p>
        <p>
          You can disconnect at any time with &quot;Disconnect&quot; on the
          Settings page — that revokes our access at Google and deletes the
          tokens — or from your Google account at{" "}
          <a
            href="https://myaccount.google.com/permissions"
            className="text-burgundy font-semibold"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>
          Only to run Reminder for you: to show your schedule, warn you about
          overlapping tasks, and send your reminders. We don&apos;t sell your
          data, show ads, or build profiles of you.
        </p>
      </LegalSection>

      <LegalSection heading="Who else is involved">
        <p>
          These services process data on our behalf, only for the purpose given:
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Vercel</strong> — hosts the app.
          </li>
          <li>
            <strong>Neon</strong> — hosts the database.
          </li>
          <li>
            <strong>Resend</strong> — delivers sign-in links and email reminders
            (your email address and the reminder text).
          </li>
          <li>
            <strong>Telegram</strong> — delivers reminders to your chat, if you
            connected it.
          </li>
          <li>
            <strong>Google</strong> — sign-in with Google, and Google Calendar
            if you connected it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Keeping and deleting your data">
        <p>
          We keep your data for as long as you have an account. You can
          disconnect Google Calendar and Telegram yourself on the Settings page.
          To delete your account and everything in it, email <ContactEmail />{" "}
          from the address you sign in with; we delete it within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="Children">
        <p>Reminder is not directed at children under 13.</p>
      </LegalSection>

      <LegalSection heading="Changes">
        <p>
          If this policy changes, we update this page and the date at the top.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
