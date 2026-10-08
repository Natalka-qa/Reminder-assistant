// sprint-23-tasks.md S23-03 — Appearance values as stored (User.theme) and
// as next-themes names them.
export type ThemeSetting = "SYSTEM" | "LIGHT" | "DARK";

export const THEME_CHOICES: { value: ThemeSetting; label: string }[] = [
  { value: "SYSTEM", label: "System" },
  { value: "LIGHT", label: "Light" },
  { value: "DARK", label: "Dark" },
];

export function toNextTheme(
  setting: ThemeSetting,
): "system" | "light" | "dark" {
  return setting === "LIGHT" ? "light" : setting === "DARK" ? "dark" : "system";
}

export function fromNextTheme(theme: string | undefined): ThemeSetting {
  return theme === "light" ? "LIGHT" : theme === "dark" ? "DARK" : "SYSTEM";
}
