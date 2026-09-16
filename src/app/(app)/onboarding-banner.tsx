import { getCurrentUser } from "@/lib/auth/dal";
import { userService } from "@/features/user/user.service";
import { OnboardingBannerClient } from "./onboarding-banner-client";

export async function OnboardingBanner() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return null;
  }

  const profile = await userService.getProfile(currentUser.id);
  if (!profile || profile.timezoneConfirmedAt) {
    return null;
  }

  return <OnboardingBannerClient storedTimezone={profile.timezone} />;
}
