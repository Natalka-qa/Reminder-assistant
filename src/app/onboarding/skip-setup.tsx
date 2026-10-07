import { finishOnboardingAction } from "@/features/user/actions";

// Leaves the setup at any step: it isn't shown again, and the defaults
// (or whatever was saved so far) stay — all of it is on /settings.
export function SkipSetup() {
  return (
    <form action={finishOnboardingAction}>
      <input type="hidden" name="next" value="/dashboard" />
      <button
        type="submit"
        className="text-text-secondary hover:text-text-primary min-h-11 text-[14px] underline-offset-4 hover:underline"
      >
        Skip setup
      </button>
    </form>
  );
}
