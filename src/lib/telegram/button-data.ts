// sprint-15-tasks.md "Расхождения" п.7 — what an inline button sends back
// as `callback_data`: "<action>:<id>", an occurrence id for the reminder
// buttons, a task id for Undo. Telegram caps callback_data at 64 bytes; a
// cuid is 25 characters, so the longest ("snooze15:" + cuid) is 34.
// "remove" is "Remove this one" on a repeating task (S14-10, п.13);
// "later1h" / "tomorrow" fix a just-added task's time or day (п.15);
// "sdone" is Done from the morning summary, which redraws it (п.19).
// "restore" is Undo under "Removed this one" (sprint-19-tasks.md п.8), an
// occurrence id.
export const BUTTON_ACTIONS = [
  "done",
  "snooze15",
  "skip",
  "remove",
  "undo",
  "later1h",
  "tomorrow",
  "sdone",
  "restore",
] as const;

export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

export const CALLBACK_DATA_MAX_BYTES = 64;

export function buttonData(action: ButtonAction, id: string): string {
  return `${action}:${id}`;
}

// Pure. Anything that isn't one of our actions followed by an id — an old
// button from a later-renamed action, a hand-crafted payload — is null.
export function parseButtonData(
  data: string | undefined,
): { action: ButtonAction; id: string } | null {
  const match = /^([a-z0-9]+):([A-Za-z0-9_-]+)$/.exec(data ?? "");
  if (!match) return null;
  const action = BUTTON_ACTIONS.find((known) => known === match[1]);
  return action ? { action, id: match[2] } : null;
}
