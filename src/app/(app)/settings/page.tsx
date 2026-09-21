import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { dashboardService } from "@/features/scheduling/dashboard.service";
import { userService } from "@/features/user/user.service";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { SectionLabel } from "@/components/ui/section-label";
import { SettingsForm } from "./settings-form";
import { TelegramConnect } from "./telegram-connect";
import { SignOutButton } from "./sign-out-button";

// design_handoff_reminder_assistant/README.md § Settings.
export default async function SettingsPage() {
  await verifySession();
  const user = await getCurrentUser();
  const stats = user
    ? await dashboardService.getRecentActivityCounts(user.id, user.timezone)
    : { completed: 0, partial: 0, skipped: 0 };
  const profile = user ? await userService.getProfile(user.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        {user?.image ? (
          // External OAuth avatar URL; next/image would need remotePatterns
          // config for a single small circular image that's never resized.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="rounded-pill size-[72px] shrink-0 object-cover"
          />
        ) : (
          <div className="bg-burgundy rounded-pill flex size-[72px] shrink-0 items-center justify-center text-2xl font-semibold text-white">
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <SectionLabel>Settings</SectionLabel>
          <p className="font-display truncate text-[44px] leading-[1.04] font-light">
            {user?.name ?? user?.email ?? "Account"}
          </p>
        </div>
      </div>

      <SettingsForm currentTimezone={user?.timezone ?? "UTC"} />

      {isTelegramEnabled() && (
        <TelegramConnect connected={Boolean(profile?.telegramChatId)} />
      )}

      <div className="flex flex-col gap-3">
        <SectionLabel>Last 7 days</SectionLabel>
        <div className="flex flex-wrap gap-8">
          <Stat value={stats.completed} label="Completed" />
          <Stat value={stats.partial} label="Partial" />
          <Stat value={stats.skipped} label="Skipped" />
        </div>
      </div>

      <SignOutButton />
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-display text-[38px] leading-none font-light">
        {value}
      </span>
      <span className="text-text-secondary text-xs">{label}</span>
    </div>
  );
}
