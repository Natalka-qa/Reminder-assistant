import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await verifySession();
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsForm currentTimezone={user?.timezone ?? "UTC"} />
    </div>
  );
}
