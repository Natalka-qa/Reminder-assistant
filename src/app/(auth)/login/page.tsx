import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const destination =
    typeof callbackUrl === "string" ? callbackUrl : "/dashboard";

  if (session?.user) {
    redirect(destination);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          to your Reminder account
        </p>
      </div>
      <LoginForm callbackUrl={destination} />
    </div>
  );
}
