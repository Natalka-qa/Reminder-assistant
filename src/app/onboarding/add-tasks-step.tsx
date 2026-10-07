import { Button } from "@/components/ui/button";
import { finishOnboardingAction } from "@/features/user/actions";
import { newTaskHref, type TaskExample } from "@/features/onboarding/examples";
import { TelegramConnect } from "@/app/(app)/settings/telegram-connect";

// Step 3 — how tasks are added: a sentence the way you'd say it. Each
// example finishes the setup and opens New task with it typed in; Telegram
// (if the bot is on) can be connected here too. "Go to my day" finishes.
export function AddTasksStep({
  examples,
  telegram,
}: {
  examples: TaskExample[];
  /** Null when the bot isn't configured. */
  telegram: { connected: boolean; summaryMinutes: number | null } | null;
}) {
  return (
    <div className="flex flex-col gap-[26px]">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-[44px] leading-[1.08] font-light">
          Add tasks your way
        </h1>
        <p className="text-text-secondary text-[15px] leading-[1.6]">
          Write a task the way you&apos;d say it — the date, time, repeat and
          deadline are picked up, in English, Russian or Ukrainian. Try one:
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {examples.map((example) => (
          <li key={example.text}>
            <form action={finishOnboardingAction}>
              <input
                type="hidden"
                name="next"
                value={newTaskHref(example.text)}
              />
              <button
                type="submit"
                className="bg-surface border-border hover:border-burgundy flex w-full flex-col items-start gap-0.5 rounded-[18px] border px-5 py-4 text-left transition-colors"
              >
                <span className="text-text-secondary text-[12px] font-semibold tracking-[0.06em] uppercase">
                  {example.kind}
                </span>
                <span className="text-text-primary text-[16px]">
                  {example.text}
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      {telegram && !telegram.connected && (
        <div className="flex flex-col gap-2">
          <p className="text-text-secondary text-[15px] leading-[1.6]">
            Reminders can also come to Telegram, with Done and Snooze right
            under them — and you can add tasks by writing to the bot.
          </p>
          <TelegramConnect
            connected={telegram.connected}
            summaryMinutes={telegram.summaryMinutes}
          />
        </div>
      )}

      <form action={finishOnboardingAction}>
        <input type="hidden" name="next" value="/dashboard" />
        <Button type="submit" className="h-[52px] w-full">
          Go to my day
        </Button>
      </form>
    </div>
  );
}
