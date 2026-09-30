import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { analyticsService } from "@/features/analytics/analytics.service";
import { userService } from "@/features/user/user.service";
import { isTelegramEnabled } from "@/lib/telegram/telegram.config";
import { googleCalendarService } from "@/features/google-calendar/google-calendar.service";
import { isGoogleCalendarEnabled } from "@/lib/google-calendar/google-calendar.config";
import { SectionLabel } from "@/components/ui/section-label";
import {
  DEFAULT_REMINDER_PREFERENCES,
  DEFAULT_SCHEDULE_PREFERENCES,
} from "@/lib/validation/user";
import { SettingsForm } from "./settings-form";
import { TelegramConnect } from "./telegram-connect";
import { GoogleCalendarConnect } from "./google-calendar-connect";
import { SignOutButton } from "./sign-out-button";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";

// design_handoff_reminder_assistant/README.md § Settings.
export default async function SettingsPage() {
  await verifySession();
  const user = await getCurrentUser();
  // S13-04 — the numbers live on /progress; here, one row pointing there.
  const stats = user
    ? await analyticsService.getRecentActivity(user.id, user.timezone)
    : null;
  const profile = user ? await userService.getProfile(user.id) : null;
  const preferences =
    (user && (await userService.getSchedulePreferences(user.id))) ??
    DEFAULT_SCHEDULE_PREFERENCES;
  const calendarStatus =
    user && isGoogleCalendarEnabled()
      ? await googleCalendarService.getConnectionStatus(user.id)
      : null;

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

      <SettingsForm
        currentTimezone={user?.timezone ?? "UTC"}
        preferences={preferences}
        reminderPreferences={
          profile
            ? {
                defaultReminderMinutes: profile.defaultReminderMinutes,
                emailRemindersEnabled: profile.emailRemindersEnabled,
              }
            : DEFAULT_REMINDER_PREFERENCES
        }
        telegramLinked={isTelegramEnabled() && Boolean(profile?.telegramChatId)}
      />

      {isTelegramEnabled() && (
        <TelegramConnect connected={Boolean(profile?.telegramChatId)} />
      )}

      {calendarStatus && <GoogleCalendarConnect status={calendarStatus} />}

      <GroupedRows>
        <GroupedRow
          label="How it's going"
          hint="Last 7 days and your patterns"
          value={stats?.percent == null ? undefined : `${stats.percent}% done`}
          href="/progress"
        />
      </GroupedRows>

      <SignOutButton />
    </div>
  );
}
