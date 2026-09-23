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
