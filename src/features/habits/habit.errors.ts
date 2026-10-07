export class HabitNotFoundError extends Error {
  constructor() {
    super("Habit not found.");
    this.name = "HabitNotFoundError";
  }
}

export class InvalidHabitError extends Error {
  constructor(
    message: string,
    /** The form field it's about, or "". */
    readonly field: string,
  ) {
    super(message);
    this.name = "InvalidHabitError";
  }
}

export class HabitDateNotEditableError extends Error {
  constructor() {
    super("Only the last 7 days can be changed.");
    this.name = "HabitDateNotEditableError";
  }
}
