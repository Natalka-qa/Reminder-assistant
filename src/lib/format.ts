export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}min`;
}

export function formatReminderOffset(minutes: number): string {
  if (minutes <= 0) return "At time of task";
  if (minutes < 60) return `${minutes} minutes before`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = `${hours} hour${hours === 1 ? "" : "s"}`;
  return rest === 0 ? `${hourLabel} before` : `${hourLabel} ${rest}min before`;
}
