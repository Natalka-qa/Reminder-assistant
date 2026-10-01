// sprint-14-tasks.md S14-07 — which channels a due reminder goes out on, on
// this attempt, and which one's delivery the reminder's status and retries
// follow. Email only if the user wants it ("Email reminders" on
// /settings); then email is what's retried, and Telegram goes once, on the
// first attempt — each email retry used to send the same Telegram message
// again. With email off, Telegram is the reminder: sent on every attempt
// until it gets through, and retried like an email would be. The in-app
// toast isn't a channel here — it already fires once, on the first claim.
export type ReminderChannels = {
  email: boolean;
  telegram: boolean;
  /** Whose failure retries the reminder; null — nothing to retry. */
  retryOn: "email" | "telegram" | null;
};

export function reminderChannels({
  emailEnabled,
  telegramLinked,
  attemptCount,
}: {
  emailEnabled: boolean;
  telegramLinked: boolean;
  attemptCount: number;
}): ReminderChannels {
  if (emailEnabled) {
    return {
      email: true,
      telegram: telegramLinked && attemptCount === 0,
      retryOn: "email",
    };
  }
  return telegramLinked
    ? { email: false, telegram: true, retryOn: "telegram" }
    : { email: false, telegram: false, retryOn: null };
}
