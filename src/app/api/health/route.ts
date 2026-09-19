import { isDatabaseHealthy } from "@/lib/db/health";

// No auth — external uptime monitors need to reach this without a secret.
export async function GET() {
  const healthy = await isDatabaseHealthy();
  if (!healthy) {
    return Response.json({ status: "error" }, { status: 503 });
  }
  return Response.json({ status: "ok" });
}
