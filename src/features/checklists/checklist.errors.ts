export class ChecklistNotFoundError extends Error {
  constructor() {
    super("List not found.");
    this.name = "ChecklistNotFoundError";
  }
}

export class InvalidChecklistError extends Error {
  constructor(
    message: string,
    /** The form field it's about, or "". */
    readonly field: string,
  ) {
    super(message);
    this.name = "InvalidChecklistError";
  }
}

export class ChecklistFullError extends Error {
  constructor(max: number) {
    super(`A list holds up to ${max} items.`);
    this.name = "ChecklistFullError";
  }
}
