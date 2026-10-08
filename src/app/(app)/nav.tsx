import { getCurrentUser } from "@/lib/auth/dal";
import { displayName } from "@/features/user/display-name";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";

// Fetches the user once for Sidebar's identity block; BottomNav needs none.
export async function Nav() {
  const user = await getCurrentUser();

  return (
    <>
      <Sidebar
        name={displayName(user?.name, user?.email)}
        email={user?.email ?? ""}
        timezone={user?.timezone ?? "UTC"}
      />
      <BottomNav />
    </>
  );
}
