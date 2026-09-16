import { getCurrentUser } from "@/lib/auth/dal";
import { UserMenuClient } from "./user-menu-client";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  return <UserMenuClient email={user.email} name={user.name} />;
}
