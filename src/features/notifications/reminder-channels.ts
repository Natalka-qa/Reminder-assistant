// sprint-14-tasks.md S14-07 — which channels a due reminder goes out on, on
// this attempt. Email only if the user wants it ("Email reminders" on
// /settings). Telegram only on the first attempt: a notification is
// retried while its email keeps failing, and each retry used to send the
// same Telegram message again. The in-app toast isn't a channel here — it
// already fires once, on the first claim.
export function reminderChannels({
  emailEnabled,
  telegramLinked,
  attemptCount,
}: {
  emailEnabled: boolean;
  telegramLinked: boolean;
  attemptCount: number;
}): { email: boolean; telegram: boolean } {
  return {
    email: emailEnabled,
    telegram: telegramLinked && attemptCount === 0,
  };
}
