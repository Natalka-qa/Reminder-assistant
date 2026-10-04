export class OccurrenceNotFoundError extends Error {
  constructor(occurrenceId: string) {
    super(`Occurrence "${occurrenceId}" was not found`);
    this.name = "OccurrenceNotFoundError";
  }
}

export class InvalidOccurrenceTransitionError extends Error {
  constructor(occurrenceId: string) {
    super(`Occurrence "${occurrenceId}" is no longer scheduled`);
    this.name = "InvalidOccurrenceTransitionError";
  }
}

export class OccurrenceNotMovableError extends Error {
  constructor(occurrenceId: string) {
    super(`Occurrence "${occurrenceId}" can't be moved to today`);
    this.name = "OccurrenceNotMovableError";
  }
}

export class OccurrenceNotRemovableError extends Error {
  constructor(occurrenceId: string) {
    super(
      `Occurrence "${occurrenceId}" can't be removed — only an open one of a repeating task can`,
    );
    this.name = "OccurrenceNotRemovableError";
  }
}

// sprint-19-tasks.md п.3 — "Only this day" refused; the message says why
// (planOccurrenceReschedule) and goes straight to the form.
export class OccurrenceNotReschedulableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OccurrenceNotReschedulableError";
  }
}

// sprint-19-tasks.md п.8 — Undo / Restore refused; the message says why
// (restoreRefusal).
export class OccurrenceNotRestorableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OccurrenceNotRestorableError";
  }
}
