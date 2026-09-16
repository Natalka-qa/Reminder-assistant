import { verifySession, getCurrentUser } from "@/lib/auth/dal";
import { formatDateInZone } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  await verifySession();
  const user = await getCurrentUser();
  const timezone = user?.timezone ?? "UTC";
  const today = formatDateInZone(new Date(), timezone);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {user?.name ? `Hi, ${user.name}` : "Hi there"}
        </h1>
        <p className="text-muted-foreground text-sm">{today}</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Today</CardTitle>
          <Button size="sm" disabled title="Coming in Sprint 2">
            Quick Add
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No tasks yet.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No tasks yet.</p>
        </CardContent>
      </Card>
    </div>
  );
}
