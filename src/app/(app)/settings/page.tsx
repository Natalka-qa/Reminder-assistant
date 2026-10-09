import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { displayName } from "@/features/user/display-name";
import { daySummary } from "@/features/user/day-summary";
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
// Photo upload is off until a Vercel Blob store is connected — see
// profile-photo.tsx and the commented-out <ProfilePhoto> below.
// import { ProfilePhoto } from "./profile-photo";
// import { isAvatarUploadEnabled } from "@/lib/blob/blob.config";
import { GroupedRows, GroupedRow } from "@/components/ui/grouped-rows";

// design_handoff_reminder_assistant/README.md § Settings.
export default async function SettingsPage() {
  await verifySession();
  const user = await getCurrentUser();
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
        {/* <ProfilePhoto
          image={user?.image ?? null}
          initial={(displayName(user?.name, user?.email) ?? user?.email ?? "?")
            .charAt(0)
            .toUpperCase()}
          uploadEnabled={isAvatarUploadEnabled()}
        /> */}
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
          <div className="bg-burgundy rounded-pill text-on-accent flex size-[72px] shrink-0 items-center justify-center text-2xl font-semibold">
            {(displayName(user?.name, user?.email) ?? user?.email ?? "?")
              .charAt(0)
              .toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <SectionLabel>Settings</SectionLabel>
          <p className="font-display truncate text-[44px] leading-[1.04] font-light">
            {displayName(user?.name, user?.email) ?? user?.email ?? "Account"}
          </p>
        </div>
      </div>

      <SettingsForm
        currentName={profile?.name ?? ""}
        emailName={displayName(null, user?.email)}
        theme={user?.theme ?? "SYSTEM"}
        currentTimezone={user?.timezone ?? "UTC"}
        daySummary={daySummary(preferences)}
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
        <TelegramConnect
          connected={Boolean(profile?.telegramChatId)}
          summaryMinutes={profile?.telegramSummaryMinutes ?? null}
          habitReminderMinutes={profile?.habitReminderMinutes ?? null}
        />
      )}

      {calendarStatus && <GoogleCalendarConnect status={calendarStatus} />}

      <GroupedRows>
        {/* sprint-21-tasks.md п.4 — Inbox's place in the nav went to
            Progress; the history of sent reminders lives here now. */}
        <GroupedRow
          label="Sent reminders"
          hint="What reached you, and when"
          href="/inbox"
        />
      </GroupedRows>

      <SignOutButton />
    </div>
  );
}
